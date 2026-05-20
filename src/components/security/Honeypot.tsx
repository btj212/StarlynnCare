"use client";

import { useState } from "react";
import {
  HONEYPOT_FIELD,
  HONEYPOT_TS_FIELD,
} from "@/lib/security/honeypot";

/**
 * Visually-hidden honeypot fields for use inside every PII-collecting form.
 * Audit finding M2.
 *
 * Renders two inputs that real users never see:
 *   - text input named `company` — bots fill all text fields, humans never see it.
 *   - hidden timestamp `_t` — server rejects submissions under 2s old.
 *
 * Aria-hidden + tabindex=-1 keep it out of the accessibility tree.
 *
 * For use in <form action={serverAction}> the inputs are submitted along
 * with the rest of the FormData. For client-controlled forms that fetch()
 * a JSON body, read these values via document.forms[...].elements before
 * stringifying, or use a controlled wrapper if rebuilding the form.
 */
export function Honeypot() {
  // useState ensures the timestamp is the render time, not bundle time.
  const [renderedAt] = useState(() => Date.now());
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: "auto",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <label>
        Company (leave blank)
        <input
          type="text"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </label>
      <input type="hidden" name={HONEYPOT_TS_FIELD} value={renderedAt} />
    </div>
  );
}
