// Returns a nicely styled "Coming soon" HTML snippet for use with dangerouslySetInnerHTML
// Keep as a function returning string so it can be concatenated into translated feature strings
export function comingSoonBadge(label: string = 'Coming Soon'): string {
  return '<span class="inline-flex items-center gap-1.5 ml-2 text-[10px] font-semibold text-orange-700 bg-orange-50/80 px-2 py-0.5 rounded-full border border-orange-200 shadow-sm"><span class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>' + label + '</span>';
}


