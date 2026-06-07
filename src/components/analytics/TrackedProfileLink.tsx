"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { emitFacilityCardOpen } from "@/lib/analytics/gtagEvents";

export function TrackedProfileLink({
  href,
  facilityId,
  className,
  children,
}: {
  href: string;
  facilityId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => emitFacilityCardOpen({ facility_id: facilityId })}
    >
      {children}
    </Link>
  );
}
