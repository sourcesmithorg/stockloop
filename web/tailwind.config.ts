import type { Config } from 'tailwindcss';

/**
 * Cornerstore design tokens.
 *
 * Mirrors the `:root` block of `.template/assets/styles.css` (the authority,
 * ported verbatim to src/styles/cornerstore.css). The same values exist as CSS
 * custom properties there so raw CSS and shadcn/ui components resolve them.
 * Do not introduce shadcn default palettes or any color not listed below.
 *
 * 20 colors, 2 font stacks, 5 text sizes, 3 radii, 6 spacing steps,
 * plus sidebar width, easing curve and elevation shadow.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces — warm mineral paper
        bg: 'oklch(97.5% .006 70)',
        surface: 'oklch(99.5% .003 70)',
        sidebar: 'oklch(96% .009 70)',
        soft: 'oklch(95.4% .006 70)',
        // Type — charcoal
        ink: 'oklch(25% .009 60)',
        muted: 'oklch(49% .011 60)',
        // Lines
        border: 'oklch(88% .012 70)',
        control: 'oklch(64% .015 70)',
        // Terracotta action
        primary: 'oklch(51% .153 37)',
        'primary-hover': 'oklch(45% .145 37)',
        'primary-soft': 'oklch(95% .028 52)',
        // Apricot review rail
        apricot: 'oklch(94% .035 61)',
        // Status text + backgrounds (never status meaning without text)
        success: 'oklch(41% .07 156)',
        'success-bg': 'oklch(94.5% .025 150)',
        warning: 'oklch(42% .089 70)',
        'warning-bg': 'oklch(96% .044 87)',
        danger: 'oklch(44% .135 27)',
        'danger-bg': 'oklch(96% .022 25)',
        info: 'oklch(42% .06 235)',
        'info-bg': 'oklch(95% .018 235)',
      },
      fontFamily: {
        ui: ["'DM Sans'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['.75rem', { lineHeight: '1.4' }],
        sm: ['.8125rem', { lineHeight: '1.5' }],
        body: ['.9375rem', { lineHeight: '1.5' }],
        title: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.025em' }],
        headline: ['2rem', { lineHeight: '1.2', letterSpacing: '-0.045em' }],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        sidebar: '224px',
      },
      transitionTimingFunction: {
        loop: 'cubic-bezier(.16,1,.3,1)',
      },
      boxShadow: {
        card: '0 8px 28px oklch(25% .009 60 / .06)',
      },
      letterSpacing: {
        headline: '-0.045em',
        title: '-0.025em',
      },
      maxWidth: {
        main: '1480px',
      },
    },
  },
  plugins: [],
} satisfies Config;
