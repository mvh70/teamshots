import { ReactNode } from 'react';

interface BlogLayoutProps {
  children: ReactNode;
}

export default function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <div className="min-h-screen bg-bg-white relative grain-texture overflow-hidden">
      {/* Subtle background with strategic gradient mesh */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-25 -z-10"></div>
      {/* Additional subtle overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-gray-50/30 -z-10"></div>
      {/* Brand-colored accent gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.06),transparent_50%)] pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.04),transparent_50%)] pointer-events-none -z-10" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-24 lg:py-32 relative z-10">
        {children}
      </main>
    </div>
  );
}

