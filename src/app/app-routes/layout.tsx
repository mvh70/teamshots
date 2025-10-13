import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_CONFIG } from "@/config/brand";

export const metadata: Metadata = {
  title: `${BRAND_CONFIG.name} App - Dashboard`,
  description: "Manage your team photos and generations",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b bg-white">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-brand-primary">{BRAND_CONFIG.name}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/app-routes/dashboard" className="text-gray-700 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/app-routes/auth" className="text-gray-700 hover:text-gray-900">
              Account
            </Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}

