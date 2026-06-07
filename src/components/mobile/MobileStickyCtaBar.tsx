"use client";

import { useEffect, useState } from "react";
import { ZipSearch } from "@/components/site/ZipSearch";

const SCROLL_REVEAL_PX = 400;

/**
 * Fixed bottom ZIP row after scroll (brief §3). Same search contract as topbar.
 */
export function MobileStickyCtaBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SCROLL_REVEAL_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`m-cta-bar md:hidden ${show ? "show" : ""}`}>
      <ZipSearch variant="mobileShell" />
    </div>
  );
}
