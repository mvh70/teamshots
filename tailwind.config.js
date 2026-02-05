/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    './node_modules/onborda/dist/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        "background": "var(--background, #ffffff)",
        "foreground": "var(--foreground, #171717)",
        "brand-primary": "var(--brand-primary, #6366F1)",
        "brand-primary-hover": "var(--brand-primary-hover, #4F46E5)",
        "brand-primary-light": "var(--brand-primary-light, #EEF2FF)",
        "brand-primary-lighter": "var(--brand-primary-lighter, #E0E7FF)",
        "brand-secondary": "var(--brand-secondary, #10B981)",
        "brand-secondary-hover": "var(--brand-secondary-hover, #059669)",
        "brand-secondary-light": "var(--brand-secondary-light, #F0FDF4)",
        "brand-secondary-lighter": "var(--brand-secondary-lighter, #D1FAE5)",
        "brand-secondary-border": "var(--brand-secondary-border, #A7F3D0)",
        "brand-secondary-text-light": "var(--brand-secondary-text-light, #065F46)",
        "brand-secondary-text": "var(--brand-secondary-text, #047857)",
        "brand-cta": "var(--brand-cta, #C2410C)",
        "brand-cta-hover": "var(--brand-cta-hover, #9A3412)",
        "brand-cta-light": "var(--brand-cta-light, #FFF7ED)",
        "brand-cta-lighter": "var(--brand-cta-lighter, #FFEDD5)",
        "brand-cta-border": "var(--brand-cta-border, #FDBA74)",
        "brand-cta-text": "var(--brand-cta-text, #9A3412)",
        "brand-cta-ring": "var(--brand-cta-ring, #FB923C)",
        "brand-cta-shadow": "var(--brand-cta-shadow, #FED7AA)",
        "brand-premium": "var(--brand-premium, #8B5CF6)",
        "brand-premium-ring": "var(--brand-premium-ring, #8B5CF6)",
        "text-dark": "var(--text-dark, #111827)",
        "text-body": "var(--text-body, #374151)",
        "text-muted": "var(--text-muted, #6B7280)",
        "bg-white": "var(--bg-white, #FFFFFF)",
        "bg-gray-50": "var(--bg-gray-50, #F9FAFB)",
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'stagger-fade': 'fadeIn 0.6s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'depth-sm': '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'depth-md': '0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'depth-lg': '0 10px 15px rgba(0, 0, 0, 0.06), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'depth-xl': '0 20px 25px rgba(0, 0, 0, 0.08), 0 10px 10px rgba(0, 0, 0, 0.04)',
        'depth-2xl': '0 25px 50px rgba(0, 0, 0, 0.12), 0 12px 24px rgba(0, 0, 0, 0.08)',
        'floating': '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        'gradient-mesh': 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(234, 88, 12, 0.1) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.1) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(16, 185, 129, 0.1) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
};
