/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}",
  ],
  theme: {
    extend: {
      colors: {
        // BAPP Primary (Amarillo marca — dark theme)
        primary: {
          50:  'rgba(253,215,53,0.10)',  // icon bg tint dark
          100: 'rgba(253,215,53,0.15)',  // hover tint dark
          200: 'rgba(253,215,53,0.25)',  // border subtle
          300: '#FFEE58',
          400: '#FFCA28',
          500: '#FDD735', // Brand color
          600: '#FDD735', // ← dark: brand color (en light era F9A825)
          700: '#FDD735', // ← dark: brand color (en light era F57F17)
          800: '#FFCA28', // ← dark: slightly dimmer (en light era E65100)
          900: '#FDD735',
          DEFAULT: '#FDD735',
        },
        // BAPP Accent (Azul cielo para proveedores)
        accent: {
          50:  '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9', // Accent color
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          DEFAULT: '#0EA5E9',
        },
        // Surfaces (dark theme)
        surface: {
          base: '#141414',
          page: '#1A1A1A',
          card: '#232323',
          raised: '#2C2C2C',
          input: '#2A2A2A',
          elevated: '#2C2C2C',
          hover: 'rgba(255, 255, 255, 0.06)',
          active: 'rgba(255, 255, 255, 0.10)',
          DEFAULT: '#232323',
          50:  '#1A1A1A',   // ← dark: page background (era light gray)
          100: '#232323',   // ← dark: card background (era lighter gray)
          200: '#2C2C2C',   // ← dark: raised background (era lightest gray)
        },
        // Borders
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          medium: 'rgba(255, 255, 255, 0.14)',
          strong: 'rgba(255, 255, 255, 0.24)',
          subtle: 'rgba(255, 255, 255, 0.08)',
        },
        // Text colors
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(255, 255, 255, 0.62)',
          tertiary: 'rgba(255, 255, 255, 0.38)',
          disabled: 'rgba(255, 255, 255, 0.24)',
          inverse: '#141414',
        },
        // Semantic colors
        success: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          DEFAULT: '#10B981',
        },
        warning: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          DEFAULT: '#F59E0B',
        },
        danger: {
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          DEFAULT: '#EF4444',
        },
        info: {
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          DEFAULT: '#3B82F6',
        },
      },
      fontFamily: {
        // Noto Sans = fuente oficial BAPP (misma que app Ionic)
        sans: ['Noto Sans', 'NotoSans', '-apple-system', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Good Times', 'Noto Sans', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.35' }],
        xs: ['13px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['15px', { lineHeight: '1.5' }],
        md: ['15px', { lineHeight: '1.5' }],
        lg: ['17px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.35' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['28px', { lineHeight: '1.2' }],
        '4xl': ['32px', { lineHeight: '1.2' }],
        '5xl': ['40px', { lineHeight: '1' }],
      },
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },
      borderRadius: {
        none: '0px',
        xs: '4px',
        sm: '8px',
        DEFAULT: '12px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        full: '9999px',
      },
      boxShadow: {
        // Escala dark-mode (web) — calibrada para fondos oscuros (dark-first)
        xs:        '0 1px 2px rgba(0, 0, 0, 0.30)',
        sm:        '0 2px 8px rgba(0, 0, 0, 0.40)',
        DEFAULT:   '0 2px 8px rgba(0, 0, 0, 0.36)',
        md:        '0 4px 16px rgba(0, 0, 0, 0.44)',
        lg:        '0 8px 32px rgba(0, 0, 0, 0.50)',
        xl:        '0 16px 48px rgba(0, 0, 0, 0.56)',
        // Card: sombra intensa + borde sutil blanco (dark mode — idéntico a Ionic)
        card:      '0 2px 12px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        'card-lg': '0 4px 20px rgba(0, 0, 0, 0.40), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        modal:     '0 24px 64px rgba(0, 0, 0, 0.64)',
        // Sombras coloreadas — extraídas de --bapp-shadow-* del design system
        primary: '0 4px 24px rgba(253, 215, 53, 0.30)',
        accent:  '0 4px 24px rgba(14, 165, 233, 0.28)',
        danger:  '0 4px 24px rgba(239, 68, 68, 0.28)',
        success: '0 4px 24px rgba(16, 185, 129, 0.28)',
      },
      transitionDuration: {
        fast: '120ms',
        DEFAULT: '200ms',
        slow: '300ms',
        xslow: '500ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(-20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
      zIndex: {
        base: '0',
        raised: '10',
        dropdown: '100',
        sticky: '200',
        overlay: '300',
        modal: '400',
        toast: '500',
        tooltip: '600',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}

