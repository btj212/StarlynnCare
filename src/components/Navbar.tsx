"use client";

import { useState } from "react";
import { useScrolled } from "@/hooks/useScrolled";

export default function Navbar() {
  const scrolled = useScrolled(40);
  const [open, setOpen] = useState(false);

  const links = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "For Families", href: "#two-path" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? "bg-white shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1100px] mx-auto px-6 lg:px-16 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex flex-col leading-none">
          <span className="font-serif text-xl font-semibold tracking-tight">
            <span className="text-navy">Starlynn</span>
            <span className="text-teal">Care</span>
          </span>
          <span className="hidden lg:block text-[11px] text-muted tracking-widest uppercase font-sans font-medium mt-0.5">
            Memory care, honestly.
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-slate hover:text-navy transition-colors duration-150"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#waitlist"
            className="bg-teal text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-teal/90 transition-colors duration-150"
          >
            Get Early Access
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-slate hover:bg-sc-border/40 transition-colors"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 bg-white border-t border-sc-border ${
          open ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-slate hover:text-navy"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a
            href="#waitlist"
            className="bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-lg text-center hover:bg-teal/90 transition-colors"
            onClick={() => setOpen(false)}
          >
            Get Early Access
          </a>
        </div>
      </div>
    </nav>
  );
}
