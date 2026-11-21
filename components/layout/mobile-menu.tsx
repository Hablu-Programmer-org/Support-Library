"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { CloseIcon, ExternalLinkIcon, MenuIcon } from "@/components/icons";
import { navStyles } from "@/components/layout/nav-styles";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/cn";
import { activeHrefFor, type NavItem } from "@/lib/config/nav";

/**
 * The panel's id; also the marker e2e/landing.spec.ts uses to find this lazy
 * chunk, so it must not appear anywhere in the topbar (whose import path
 * already contains "mobile-menu").
 */
export const MOBILE_MENU_ID = "site-mobile-menu";

const subscribe = () => () => undefined;

type MobileMenuProps = {
  items: NavItem[];
};

/**
 * Below-lg navigation in the LMS v2 style: a hamburger in the header opens a
 * full-width panel under the bar with one 44px row per link and the theme
 * toggle. Identity and sign-out live in the profile avatar menu.
 *
 * The panel is portalled to <body>: the header's backdrop-filter makes it the
 * containing block for `fixed` children, which would clip the panel to 64px.
 * It sits under the header (z-40 vs z-50) so the bar and the close button stay
 * visible. It is a separate <nav aria-label="Mobile">, never inside
 * `header nav[aria-label="Primary"]`, whose link count is an E2E contract.
 */
export function MobileMenu({ items }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);
  const reduceMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const activeHref = activeHrefFor(pathname, items);

  // Navigation closes the menu (adjusting state during render, not in an effect).
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  const openMenu = () => {
    setOpenedAt(pathname);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Reaching the desktop layout closes the menu; the inline nav takes over.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (media.matches) setOpen(false);
    };
    closeOnDesktop();
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      };

  const panel = (
    <AnimatePresence>
      {open ? (
        <motion.div
          id={MOBILE_MENU_ID}
          className={cn("fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto lg:hidden", navStyles.panel)}
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          exit={panelMotion.exit}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-1 px-4 pb-8 pt-4 sm:px-6">
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {items.map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                const className = cn(
                  navStyles.row,
                  navStyles.focus,
                  active ? navStyles.rowActive : navStyles.rowIdle,
                );
                const content = (
                  <>
                    <Icon size={18} className={active ? "text-cyan-500" : "opacity-70"} />
                    <span>{item.label}</span>
                    {item.external ? <ExternalLinkIcon className="opacity-60" /> : null}
                  </>
                );

                return item.external ? (
                  <a
                    key={item.href}
                    className={className}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    aria-current={active ? "page" : undefined}
                    className={className}
                    href={item.href}
                    onClick={() => setOpen(false)}
                  >
                    {content}
                  </Link>
                );
              })}
            </nav>

            <div className={cn("mt-3 flex items-center justify-between border-t px-4 pt-4", navStyles.divider)}>
              <span className={cn("text-sm font-medium", navStyles.textMuted)}>Appearance</span>
              <ThemeToggle />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={MOBILE_MENU_ID}
        className={cn(navStyles.iconButton, navStyles.focus, "lg:hidden")}
      >
        {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
      </button>
      {mounted ? createPortal(panel, document.body) : null}
    </>
  );
}
