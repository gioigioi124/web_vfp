/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Hanken Grotesk"',
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ['"JetBrains Mono"', "Consolas", "Courier New", "monospace"],
      },
      colors: {
        // ===== Design tokens (Design.md — "Ledger & Vector") =====
        surface: {
          DEFAULT: "#f8f9ff",
          dim: "#ccdbf3",
          bright: "#f8f9ff",
          lowest: "#ffffff",
          low: "#eff4ff",
          container: "#e6eeff",
          high: "#dce9ff",
          highest: "#d5e3fc",
          variant: "#d5e3fc",
        },
        "on-surface": {
          DEFAULT: "#0d1c2e",
          variant: "#444651",
        },
        outline: {
          DEFAULT: "#757682",
          variant: "#c5c5d3",
        },
        // Primary — Navy Deep
        primary: {
          50: "#eff4ff",
          100: "#dce1ff",
          200: "#b6c4ff",
          300: "#90a8ff",
          400: "#5b78e0",
          500: "#4059aa",
          600: "#264191",
          700: "#1e3a8a",
          800: "#00236f",
          900: "#00164e",
        },
        // Secondary — Slate Blue Accent
        secondary: {
          50: "#eaf6ff",
          100: "#cce5ff",
          200: "#93ccff",
          300: "#5bb8fe",
          400: "#2a9df4",
          500: "#0284c7",
          600: "#006398",
          700: "#004b73",
          800: "#00476e",
          900: "#001d31",
        },
        // Tertiary — Amber / Warning Balance
        tertiary: {
          50: "#fff7ed",
          100: "#ffdcc3",
          200: "#ffb77d",
          300: "#fc922b",
          400: "#d97706",
          500: "#b45309",
          600: "#92400e",
          700: "#653400",
          800: "#442100",
          900: "#2f1500",
        },
        // Functional status
        success: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          600: "#059669",
          700: "#065f46",
          800: "#064e3b",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          600: "#dc2626",
          700: "#991b1b",
          800: "#93000a",
        },
        info: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // Neutral — Slate Carbon
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      fontSize: {
        "data-mono": [
          "0.8125rem",
          { lineHeight: "1rem", letterSpacing: "-0.01em" },
        ],
        "label-sm": [
          "0.6875rem",
          { lineHeight: "0.875rem", letterSpacing: "0.04em" },
        ],
        "label-md": [
          "0.75rem",
          { lineHeight: "1rem", letterSpacing: "0.02em" },
        ],
      },
    },
  },
  plugins: [],
};
