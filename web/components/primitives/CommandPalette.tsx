"use client";

/* =========================================================================
   Command palette (⌘K) and shortcut sheet (?) — FRONTEND_DESIGN.md §6.4.
   -------------------------------------------------------------------------
   "Every shortcut is discoverable in `?` and in the palette." That sentence
   is the whole contract, and it is why these two live in one file: the same
   SHORTCUTS list feeds the sheet and the same COMMAND list feeds the palette,
   so neither can drift out of sync with what the scanner actually binds.

   Designed against Linear's standard (§6): the palette opens instantly, is
   filtered by substring, and the first match is always selected so Enter is
   the fast path. Nothing here animates — §8 puts Zone B's animation library
   count at "none" and its INP budget at 100ms.

   Accessibility (§7.3):
   - A real modal: role="dialog", aria-modal, labelled, focus moved in on open
     and RESTORED on close, Escape closes, Tab is trapped.
   - The option list is a listbox with aria-activedescendant, so the input
     keeps focus (you are typing) while the caret moves.
   - Disabled commands carry the REASON in the row, per §6.3's "disable,
     don't validate".
   ========================================================================= */

import * as React from "react";
import { Kbd } from "./Kbd";

export interface Command {
  id: string;
  label: string;
  /** Shown right-aligned: the shortcut, or a short qualifier. */
  hint?: string;
  /** §6.3 — a disabled command states why, in the row, before the click. */
  disabledReason?: string;
  run: () => void;
}

/* The §6.4 table, verbatim. Rendered by the `?` sheet and used as the source
   of truth for what the scanner binds — a key documented here and unbound is
   a defect the shortcut test catches. */
export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "⌘K / Ctrl+K", action: "Command palette" },
  { keys: "j / k", action: "Next / previous finding" },
  { keys: "Enter", action: "Expand selected finding" },
  { keys: "1 … 9", action: "Jump to page" },
  { keys: "c", action: "Copy JSON response" },
  { keys: "r", action: "Re-scan" },
  { keys: "?", action: "This sheet" },
];

/* -------------------------------------------------------------------------
   A modal shell shared by both dialogs. Focus in, focus back, Escape, trap.
   ------------------------------------------------------------------------- */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function Modal({
  titleId,
  title,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialogRef.current)?.focus();
    // Focus goes back where it came from. A palette that drops the user at
    // the top of the document costs more than it saved.
    return () => restoreRef.current?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="sx-overlay" onKeyDown={onKeyDown}>
      {/* The scrim is decorative; clicking it to close is a convenience and
          Escape is the documented path. */}
      <div className="sx-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="sx-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
      >
        <h2 className="sx-dialog-title" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   The palette.
   ------------------------------------------------------------------------- */
export function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState(0);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Any change to the result set puts the caret back on the first row, so
  // Enter always means "the thing at the top" — which is what makes a palette
  // usable without looking at it.
  React.useEffect(() => setIndex(0), [query]);

  const move = (delta: number) => {
    if (matches.length === 0) return;
    setIndex((i) => (i + delta + matches.length) % matches.length);
  };

  const run = (cmd: Command | undefined) => {
    if (!cmd || cmd.disabledReason) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(matches[index]);
    }
  };

  const activeId = matches[index] ? `sx-cmd-${matches[index].id}` : undefined;

  return (
    <Modal titleId="sx-palette-title" title="Command palette" onClose={onClose}>
      <input
        className="sx-palette-input"
        placeholder="Type a command…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded="true"
        aria-controls="sx-palette-options"
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-label="Command"
      />

      {matches.length === 0 ? (
        <p className="sx-empty-options">No command matches that.</p>
      ) : (
        <ul className="sx-options" id="sx-palette-options" role="listbox">
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`sx-cmd-${c.id}`}
              role="option"
              aria-selected={i === index}
              aria-disabled={c.disabledReason ? true : undefined}
              className="sx-option"
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(c)}
            >
              <span>{c.label}</span>
              <span className="sx-option-hint from-document">
                {c.disabledReason ?? c.hint}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   The `?` sheet. The same table, printed.
   ------------------------------------------------------------------------- */
export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      titleId="sx-shortcuts-title"
      title="Keyboard shortcuts"
      onClose={onClose}
    >
      <dl className="sx-shortcuts from-document">
        {SHORTCUTS.map((s) => (
          <React.Fragment key={s.keys}>
            <dt>
              <Kbd>{s.keys}</Kbd>
            </dt>
            <dd>{s.action}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Modal>
  );
}
