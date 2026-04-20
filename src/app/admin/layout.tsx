import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-semibold text-navy">
              StarlynnCare
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/admin/reviews"
              className="text-sm font-medium text-slate hover:text-ink"
            >
              Review moderation
            </Link>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
