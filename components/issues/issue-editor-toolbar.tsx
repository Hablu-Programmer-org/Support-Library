"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type { IconSvgProps } from "@/components/icons";
import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  CodeIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  NumberedListIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/issues/issue-editor-icons";
import { cn } from "@/lib/cn";
import { isAllowedIssueLink } from "@/lib/issue-editor-markdown";

type ToolState = { active: boolean; enabled: boolean };
type ToolbarState = Record<ToolId, ToolState>;

type ToolId =
  | "bold"
  | "italic"
  | "code"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "codeBlock"
  | "link"
  | "undo"
  | "redo";

type Tool = {
  id: ToolId;
  label: string;
  icon: FC<IconSvgProps>;
  /** Key after the modifier(s), as shown and as `aria-keyshortcuts` uses it. */
  keys: string[];
  /** Toggles show `aria-pressed`; one-shot actions (undo) do not. */
  toggle: boolean;
  run: (editor: Editor) => void;
};

/** Groups are separated by a divider. Shortcuts are Tiptap's defaults (+ Mod-K). */
export const ISSUE_EDITOR_TOOL_GROUPS: Tool[][] = [
  [
    { id: "bold", label: "Bold", icon: BoldIcon, keys: ["Mod", "B"], toggle: true, run: (e) => e.chain().focus().toggleBold().run() },
    { id: "italic", label: "Italic", icon: ItalicIcon, keys: ["Mod", "I"], toggle: true, run: (e) => e.chain().focus().toggleItalic().run() },
    { id: "code", label: "Inline code", icon: CodeIcon, keys: ["Mod", "E"], toggle: true, run: (e) => e.chain().focus().toggleCode().run() },
  ],
  [
    { id: "heading", label: "Heading", icon: HeadingIcon, keys: ["Mod", "Alt", "2"], toggle: true, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: "bulletList", label: "Bulleted list", icon: BulletListIcon, keys: ["Mod", "Shift", "8"], toggle: true, run: (e) => e.chain().focus().toggleBulletList().run() },
    { id: "orderedList", label: "Numbered list", icon: NumberedListIcon, keys: ["Mod", "Shift", "7"], toggle: true, run: (e) => e.chain().focus().toggleOrderedList().run() },
    { id: "codeBlock", label: "Code block", icon: CodeBlockIcon, keys: ["Mod", "Alt", "C"], toggle: true, run: (e) => e.chain().focus().toggleCodeBlock().run() },
  ],
  [
    // Opening the link panel is handled by the toolbar itself.
    { id: "link", label: "Link", icon: LinkIcon, keys: ["Mod", "K"], toggle: true, run: () => {} },
  ],
  [
    { id: "undo", label: "Undo", icon: UndoIcon, keys: ["Mod", "Z"], toggle: false, run: (e) => e.chain().focus().undo().run() },
    { id: "redo", label: "Redo", icon: RedoIcon, keys: ["Mod", "Shift", "Z"], toggle: false, run: (e) => e.chain().focus().redo().run() },
  ],
];

const TOOLS = ISSUE_EDITOR_TOOL_GROUPS.flat();
/** Flat index of each group's first button, for the roving tabindex. */
const GROUP_STARTS = ISSUE_EDITOR_TOOL_GROUPS.map((_, groupIndex) =>
  ISSUE_EDITOR_TOOL_GROUPS.slice(0, groupIndex).reduce((sum, group) => sum + group.length, 0),
);

function readState(editor: Editor): ToolbarState {
  const can = editor.can();
  const inCodeBlock = editor.isActive("codeBlock");
  return {
    bold: { active: editor.isActive("bold"), enabled: can.toggleBold() },
    italic: { active: editor.isActive("italic"), enabled: can.toggleItalic() },
    code: { active: editor.isActive("code"), enabled: can.toggleCode() },
    heading: { active: editor.isActive("heading", { level: 2 }), enabled: can.toggleHeading({ level: 2 }) },
    bulletList: { active: editor.isActive("bulletList"), enabled: can.toggleBulletList() },
    orderedList: { active: editor.isActive("orderedList"), enabled: can.toggleOrderedList() },
    codeBlock: { active: inCodeBlock, enabled: can.toggleCodeBlock() },
    link: { active: editor.isActive("link"), enabled: !inCodeBlock && !editor.isActive("code") },
    undo: { active: false, enabled: can.undo() },
    redo: { active: false, enabled: can.redo() },
  };
}

const isApplePlatform = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** "Ctrl+Shift+8" / "⌘⇧8" for the tooltip. */
function shortcutLabel(keys: string[], apple: boolean) {
  const glyph: Record<string, string> = apple
    ? { Mod: "⌘", Shift: "⇧", Alt: "⌥" }
    : { Mod: "Ctrl", Shift: "Shift", Alt: "Alt" };
  return keys.map((key) => glyph[key] ?? key).join(apple ? "" : "+");
}

/** `aria-keyshortcuts` value, e.g. "Control+Shift+8". */
function ariaShortcut(keys: string[], apple: boolean) {
  return keys
    .map((key) => (key === "Mod" ? (apple ? "Meta" : "Control") : key))
    .join("+");
}

/**
 * Accepts what students paste: full URLs, or `example.com/page` (made https).
 * Returns null for anything that is not http(s).
 */
export function normalizeIssueLink(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  // "javascript:" / "https:" are schemes; "localhost:3000" is a host and port.
  const hasScheme = /^[a-z][a-z\d+.-]*:(?!\d)/i.test(value);
  const withScheme = hasScheme ? value : `https://${value.replace(/^\/+/, "")}`;
  if (!isAllowedIssueLink(withScheme)) return null;
  // A bare word ("hello") is not a link: require a dot in the host.
  const { hostname } = new URL(withScheme);
  return hostname.includes(".") || hostname === "localhost" ? withScheme : null;
}

type IssueEditorToolbarProps = {
  editor: Editor;
  /** id of the editable element the buttons act on. */
  editorId: string;
  /** Controlled so Mod-K inside the editor can open the panel. */
  linkOpen: boolean;
  onLinkOpenChange: (open: boolean) => void;
};

/**
 * Formatting buttons for the issue editor. One tab stop (WAI-ARIA toolbar
 * pattern): arrows / Home / End move between buttons. Buttons that cannot act
 * at the caret stay focusable with `aria-disabled` so the order never jumps.
 */
export function IssueEditorToolbar({ editor, editorId, linkOpen, onLinkOpenChange }: IssueEditorToolbarProps) {
  const state = useEditorState({ editor, selector: ({ editor: current }) => readState(current) });
  const [apple] = useState(isApplePlatform);
  const [focusIndex, setFocusIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const activate = (tool: Tool) => {
    if (!state[tool.id].enabled) return;
    if (tool.id === "link") {
      onLinkOpenChange(!linkOpen);
      return;
    }
    tool.run(editor);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = TOOLS.length - 1;
    const next =
      event.key === "ArrowRight" ? (focusIndex === last ? 0 : focusIndex + 1)
      : event.key === "ArrowLeft" ? (focusIndex === 0 ? last : focusIndex - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    buttons.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={editorId}
        onKeyDown={onKeyDown}
        className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60"
      >
        {ISSUE_EDITOR_TOOL_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className={cn("flex items-center gap-0.5", groupIndex === ISSUE_EDITOR_TOOL_GROUPS.length - 1 && "ml-auto")}>
            {groupIndex > 0 ? (
              <span aria-hidden="true" className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
            ) : null}
            {group.map((tool, toolIndex) => {
              const position = GROUP_STARTS[groupIndex] + toolIndex;
              const { active, enabled } = state[tool.id];
              const Icon = tool.icon;
              const shortcut = shortcutLabel(tool.keys, apple);
              // Keep tooltips inside the page at both ends of a row.
              const align = position < 2 ? "left-0" : position > TOOLS.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <button
                  key={tool.id}
                  ref={(node) => {
                    buttons.current[position] = node;
                  }}
                  type="button"
                  tabIndex={position === focusIndex ? 0 : -1}
                  aria-label={tool.label}
                  aria-keyshortcuts={ariaShortcut(tool.keys, apple)}
                  aria-pressed={tool.toggle ? (tool.id === "link" ? active || linkOpen : active) : undefined}
                  aria-disabled={enabled ? undefined : true}
                  data-tool={tool.id}
                  // Keep the editor's selection while clicking with a mouse.
                  onMouseDown={(event) => event.preventDefault()}
                  onFocus={() => setFocusIndex(position)}
                  onClick={() => activate(tool)}
                  className={cn(
                    "group relative inline-flex size-11 items-center justify-center rounded-md transition-colors motion-reduce:transition-none",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-500",
                    !enabled
                      ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                      : (tool.id === "link" ? active || linkOpen : active)
                        ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200"
                        : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
                  )}
                >
                  <Icon size={18} />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute top-full z-20 mt-1.5 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900",
                      "group-hover:block group-focus-visible:block",
                      align,
                    )}
                  >
                    {tool.label} <kbd className="ml-1 font-sans text-slate-300 dark:text-slate-500">{shortcut}</kbd>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {linkOpen ? (
        <LinkPanel
          editor={editor}
          initialHref={state.link.active ? String(editor.getAttributes("link").href ?? "") : ""}
          hasLink={state.link.active}
          onClose={() => {
            onLinkOpenChange(false);
            editor.commands.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function LinkPanel({
  editor,
  initialHref,
  hasLink,
  onClose,
}: {
  editor: Editor;
  initialHref: string;
  hasLink: boolean;
  onClose: () => void;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState(initialHref);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // A <form> here would nest inside the issue <form>, so Enter is handled by hand.
  const apply = (event?: FormEvent) => {
    event?.preventDefault();
    const href = normalizeIssueLink(value);
    if (!href) {
      setError("Use a web address, for example https://example.com/page.");
      inputRef.current?.focus();
      return;
    }
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !hasLink) {
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.extendMarkRange("link").setLink({ href }).run();
    }
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  };

  const buttonClass =
    "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 motion-reduce:transition-none";

  return (
    <div
      role="group"
      aria-label="Link"
      data-issue-editor-link-panel=""
      className="flex flex-col gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-end dark:border-slate-700 dark:bg-slate-900"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor={inputId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Link address
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="url"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply(event);
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : undefined}
          placeholder="https://"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-danger-600 dark:text-danger-500">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => apply()} className={cn(buttonClass, "bg-cyan-500 text-slate-950 hover:bg-cyan-400")}>
          {hasLink ? "Update link" : "Add link"}
        </button>
        {hasLink ? (
          <button type="button" onClick={remove} className={cn(buttonClass, "text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-500/10")}>
            Remove link
          </button>
        ) : null}
        <button type="button" onClick={onClose} className={cn(buttonClass, "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
          Cancel
        </button>
      </div>
    </div>
  );
}
