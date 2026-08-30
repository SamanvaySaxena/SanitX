"use client";

/* =========================================================================
   The motion toggle — FRONTEND_DESIGN.md §7.2, §7.3.
   -------------------------------------------------------------------------
   §7.2's guarantee is that the OS preference is honoured. This control does
   not weaken it; it lets the visitor say something the OS cannot, in either
   direction:

     System   — the default, and the only state anyone gets without asking.
     Full     — "I turned off Windows animation effects for the taskbar, not
                 for your site." That case is real, and is why commit 65fc1a3
                 deleted the guard outright.
     Reduced  — "my OS does not signal it, but I want less anyway."

   THREE RADIOS, NOT A CHECKBOX. A two-state switch cannot express the
   difference between "follow the system" and "I have chosen the thing the
   system happens to say", and losing that distinction means a visitor whose
   OS setting later changes silently keeps our stale answer. Radios also come
   with roving arrow-key navigation and a group label for free, which a pair
   of buttons would have to reimplement (§7.3).

   §7.1 — the state is a visible word, not a colour and not a screen-reader
   string: the checked radio's label reads the same for everyone.

   Zone A only. §11: "Zone B sells nothing", and it ships no animation library
   at all, so a motion control on /scan would be a switch wired to nothing.
   ========================================================================= */

import * as React from "react";
import {
  type MotionPreference,
  readMotionPreference,
  setMotionPreference,
} from "@/lib/motion/reduced-motion";

const OPTIONS: { value: MotionPreference; label: string; hint: string }[] = [
  { value: "system", label: "System", hint: "Follow my operating system" },
  { value: "full", label: "Full", hint: "Play every scrolled scene" },
  { value: "reduced", label: "Reduced", hint: "No pinned or scrubbed motion" },
];

export function MotionToggle() {
  /* Server-rendered as "system" because the server cannot know. The effect
     below corrects it on mount from the attribute the pre-paint script in
     app/layout.tsx already stamped, so the correction is a checked-state
     change on a control nobody has looked at yet — never a visible flash of
     the wrong scene, because the ATTRIBUTE was right before first paint. */
  const [pref, setPref] = React.useState<MotionPreference>("system");

  React.useEffect(() => {
    setPref(readMotionPreference());
  }, []);

  function choose(next: MotionPreference) {
    setPref(next);
    setMotionPreference(next);
  }

  return (
    <fieldset className="motion-toggle" data-pref={pref}>
      <legend className="motion-toggle-legend about-document">Motion</legend>
      <div className="motion-toggle-options">
        {OPTIONS.map((o) => (
          <label key={o.value} className="motion-toggle-option" title={o.hint}>
            <input
              type="radio"
              name="sanitx-motion"
              value={o.value}
              checked={pref === o.value}
              onChange={() => choose(o.value)}
              className="motion-toggle-input"
            />
            <span className="motion-toggle-label">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
