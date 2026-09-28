/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        night: {
          950: "#080C14",
          900: "#111827",
          800: "#182230",
          700: "#1E293B",
          600: "#34445a",
        },
        phosphor: {
          400: "#34D399",
          500: "#10B981",
        },
        amber: {
          signal: "#F59E0B",
        },
        alert: {
          flash: "#EF4444",
        },
        ice: "#60A5FA",
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(168, 201, 74, 0.12), 0 18px 40px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};
