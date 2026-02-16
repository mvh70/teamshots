import type { ReactNode } from 'react';

interface LandingPageLayoutProps {
  children: ReactNode;
}

export default function LandingPageLayout({ children }: LandingPageLayoutProps) {
  return (
    <main className="min-h-screen bg-bg-white">
      {children}
    </main>
  );
}
