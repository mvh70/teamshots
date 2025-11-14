/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    './node_modules/onborda/dist/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        "background": "var(--background)",
        "foreground": "var(--foreground)",
        "brand-primary": "#6366F1",
        "brand-primary-hover": "#4F46E5",
        "brand-primary-light": "#EEF2FF",
        "brand-primary-lighter": "#E0E7FF",
        "brand-secondary": "#10B981",
        "brand-secondary-hover": "#059669",
        "brand-cta": "#EA580C",
        "brand-cta-hover": "#C2410C",
        "brand-cta-light": "#FFF7ED",
        "brand-cta-ring": "#FB923C",
        "brand-cta-shadow": "#FED7AA",
        "brand-premium": "#8B5CF6",
        "brand-premium-ring": "#8B5CF6",
        "text-dark": "#111827",
        "text-body": "#374151",
        "text-muted": "#6B7280",
        "bg-white": "#FFFFFF",
        "bg-gray-50": "#F9FAFB",
      },
    },
  },
  plugins: [],
};
