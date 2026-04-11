import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Theme tokens use RGB triplets in CSS (e.g. --bg: 247 249 252) — use rgb() not hsl()
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-2": "rgb(var(--border-2) / <alpha-value>)",
        text: "rgb(var(--text))",
        "text-2": "rgb(var(--text-2))",
        muted: "rgb(var(--muted))",
        primary: {
          DEFAULT: "rgb(var(--accent))",
          hover: "rgb(var(--accent) / 0.9)",
          foreground: "rgb(var(--primary-foreground))",
        },
        "primary-blue": "rgb(var(--accent))",
        danger: "rgb(var(--danger))",
        warning: "rgb(var(--warning))",
        success: "rgb(var(--success))",
        input: "rgb(var(--border))",
        ring: "rgb(var(--accent))",
        background: "rgb(var(--bg) / <alpha-value>)",
        foreground: "rgb(var(--text))",
        secondary: {
          DEFAULT: "rgb(var(--surface-2) / <alpha-value>)",
          foreground: "rgb(var(--text))",
        },
        destructive: {
          DEFAULT: "rgb(var(--danger))",
          foreground: "rgb(var(--destructive-foreground))",
        },
        accent: {
          DEFAULT: "rgb(var(--accent))",
          foreground: "rgb(var(--accent-foreground))",
        },
        "accent-primary": {
          DEFAULT: "rgb(var(--accent))",
          foreground: "rgb(var(--text))",
        },
        "accent-secondary": {
          DEFAULT: "rgb(var(--accent-secondary))",
          foreground: "rgb(var(--text))",
        },
        popover: {
          DEFAULT: "rgb(var(--surface))",
          foreground: "rgb(var(--text))",
        },
        card: {
          DEFAULT: "rgb(var(--surface))",
          foreground: "rgb(var(--text))",
        },
        meta: {
          DEFAULT: "rgb(var(--muted))",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        athletic: ["var(--font-teko)", "var(--font-oswald)", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "card-dark": "0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.2)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        /** Braik dashboard sidebar — active item only; soft orange “heartbeat” (slow, low contrast) */
        "sidebar-active-pulse": {
          "0%, 100%": {
            boxShadow:
              "0 0 0 0 rgba(249, 115, 22, 0.12), inset 0 0 0 0 rgba(249, 115, 22, 0.06)",
          },
          "50%": {
            boxShadow:
              "0 0 14px 2px rgba(249, 115, 22, 0.22), inset 0 0 28px rgba(249, 115, 22, 0.1)",
          },
        },
        "sidebar-active-sheen": {
          "0%, 100%": { opacity: "0.28" },
          "50%": { opacity: "0.52" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "sidebar-active-pulse": "sidebar-active-pulse 3.5s ease-in-out infinite",
        "sidebar-active-sheen": "sidebar-active-sheen 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config

