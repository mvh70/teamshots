import { ReactNode } from 'react';

interface TldrSectionProps {
  children: ReactNode;
}

/**
 * TL;DR Section for blog posts
 * 
 * Optimized for AI extraction (GEO). AI engines frequently extract
 * this summary section directly for search results and overviews.
 * Keep content factual, quotable, and complete.
 */
export function TldrSection({ children }: TldrSectionProps) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-10 rounded-r-lg">
      <h2 className="font-bold text-lg mb-3 text-gray-900">TL;DR: Quick Answer</h2>
      <div className="text-gray-700 space-y-3">{children}</div>
    </div>
  );
}

