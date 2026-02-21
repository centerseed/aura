import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Drawer 狀態色彩（橋接 CSS Variables）
        drawer: {
          inbox:     { bg: "hsl(var(--drawer-inbox-bg))",     fg: "hsl(var(--drawer-inbox-fg))" },
          active:    { bg: "hsl(var(--drawer-active-bg))",    fg: "hsl(var(--drawer-active-fg))" },
          maintain:  { bg: "hsl(var(--drawer-maintain-bg))",  fg: "hsl(var(--drawer-maintain-fg))" },
          reference: { bg: "hsl(var(--drawer-reference-bg))", fg: "hsl(var(--drawer-reference-fg))" },
          archive:   { bg: "hsl(var(--drawer-archive-bg))",   fg: "hsl(var(--drawer-archive-fg))" },
        },
        // 狀態語意色 token
        status: {
          overdue: "hsl(var(--color-status-overdue))",
          urgent:  "hsl(var(--color-status-urgent))",
          active:  "hsl(var(--color-status-active))",
          success: "hsl(var(--color-status-success))",
          warning: "hsl(var(--color-status-warning))",
        },
        // Panel 深色背景
        panel: {
          dark: "hsl(var(--panel-bg-dark))",
        },
      },
      boxShadow: {
        'float-sm': 'var(--card-shadow-sm)',
        'float-md': 'var(--card-shadow-md)',
        'float-lg': 'var(--card-shadow-lg)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
