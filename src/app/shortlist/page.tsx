import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ShortlistView } from "./ShortlistView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Shortlist · StarlynnCare",
  description:
    "Compare shortlisted memory care facilities side-by-side using public inspection records. No commissions, no referral bias.",
  robots: { index: false },
};

export default function ShortlistPage() {
  return (
    <div className="flex flex-col">
      <div className="-order-1">
        <GovernanceBar />
        <SiteNav />
      </div>
      <ShortlistView />
      <SiteFooter />
    </div>
  );
}
