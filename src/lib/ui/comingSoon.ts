// Returns a nicely styled "Coming soon" HTML snippet for use with dangerouslySetInnerHTML
// Keep as a function returning string so it can be concatenated into translated feature strings
export function comingSoonBadge(label: string = 'Coming Soon'): string {
  return '<span class="inline-flex items-center gap-1.5 ml-2 text-[10px] font-semibold text-brand-cta-text bg-brand-cta-light/80 px-2 py-0.5 rounded-full border border-brand-cta-border shadow-sm"><span class="w-1.5 h-1.5 rounded-full bg-brand-cta animate-pulse"></span>' + label + '</span>';
}


