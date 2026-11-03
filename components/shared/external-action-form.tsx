"use client";

import { useActionState, useEffect, useRef } from "react";

import { cn } from "@/lib/cn";
import type { ExternalRedirectState } from "@/lib/external-redirect";

export type ExternalAction = (
  state: ExternalRedirectState,
  formData: FormData,
) => Promise<ExternalRedirectState>;

type ExternalActionFormProps = {
  /** A server action that returns `{ url }` only after every check passed. */
  action: ExternalAction;
  /** Hidden fields (CSRF token, record id, …). */
  fields?: Record<string, string>;
  /** Visible button text, e.g. "Join Live support". */
  label: string;
  /** Button text while the action runs, e.g. "Opening Live support…". */
  pendingLabel: string;
  /** Text of the fallback link when the tab could not be opened. */
  fallbackLabel: string;
  /** Accessible name when it should differ from the visible label. */
  ariaLabel?: string;
  /** Tooltip for the whole control (unavailable/closed reason). */
  title?: string;
  disabled?: boolean;
  className?: string;
  errorClassName?: string;
  linkClassName?: string;
};

const INITIAL_STATE: ExternalRedirectState = {};

/**
 * "Check on the server, then open the result in a new tab."
 *
 * Why not `redirect()` + `target="_blank"`: when React runs a form action it
 * submits with `fetch`, ignores `target`, and applies the server redirect to the
 * current tab. So the action returns the URL instead, and this component:
 *
 *  1. opens a tab **inside the click gesture** (a later `window.open` is a
 *     popup and Safari/strict Chrome may block it), with `opener` severed;
 *  2. navigates that tab once the action returns its URL;
 *  3. closes it again if the action failed (closed shift, rate limit, denial);
 *  4. always renders a real `<a target="_blank" rel="noopener noreferrer">`
 *     fallback, so a blocked popup, a closed tab, or a browser with JavaScript
 *     off still ends in a new tab.
 *
 * Generic by design: no platform, room or route knowledge lives here.
 */
export function ExternalActionForm({
  action,
  fields,
  label,
  pendingLabel,
  fallbackLabel,
  ariaLabel,
  disabled = false,
  className,
  errorClassName,
  linkClassName,
  title,
}: ExternalActionFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const result = state ?? INITIAL_STATE;
  const tabRef = useRef<Window | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  function preOpenTab() {
    if (disabled || pending || result.url) return;

    // Never stack tabs: a second click/Enter reuses the one already open.
    if (tabRef.current && !tabRef.current.closed) return;

    const tab = window.open("", "_blank");
    if (!tab) return; // popup blocked — the fallback link covers this

    // Reverse-tabnabbing: the room page must not get a handle on this app.
    tab.opener = null;

    try {
      tab.document.title = pendingLabel;
      const note = tab.document.createElement("p");
      note.textContent = pendingLabel;
      note.style.cssText =
        "font-family:system-ui,sans-serif;padding:2rem;color:#334155;font-size:14px";
      tab.document.body.replaceChildren(note);
    } catch {
      // A freshly opened tab may refuse DOM access; a blank tab is acceptable.
    }

    tabRef.current = tab;
  }

  useEffect(() => {
    const tab = tabRef.current;

    if (result.error) {
      tab?.close(); // allowed: this window opened it
      tabRef.current = null;
      return;
    }

    if (!result.url) return;

    if (tab && !tab.closed) {
      try {
        tab.location.replace(result.url);
        tabRef.current = null;
        return;
      } catch {
        // Fall through to the link: the tab is unusable.
      }
    }

    // Popup blocked, or the user closed the tab: put the user on the link
    // instead of leaving them with nothing to click.
    tabRef.current = null;
    linkRef.current?.focus();
  }, [result]);

  const buttonDisabled = disabled || pending || Boolean(result.url);

  return (
    <form action={formAction} className="space-y-3" title={title}>
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <button
        type="submit"
        aria-label={ariaLabel ?? label}
        aria-disabled={buttonDisabled}
        className={className}
        disabled={buttonDisabled}
        onClick={preOpenTab}
      >
        {pending ? pendingLabel : label}
      </button>

      {result.error && (
        <p role="alert" className={errorClassName}>
          {result.error}
        </p>
      )}

      {result.url && (
        <p role="status" className="text-sm">
          <a
            ref={linkRef}
            className={cn(
              "font-semibold text-primary underline underline-offset-2 hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
              linkClassName,
            )}
            href={result.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {fallbackLabel}
          </a>
        </p>
      )}
    </form>
  );
}
