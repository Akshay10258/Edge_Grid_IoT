/** @type {import('tailwindcss').Config} */
export default {
  content: ["./dashboard/index.html", "./dashboard/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#0d1117",
          surface: "#161b22",
          card: "#1f2937",
          border: "#30363d",
        },
        accent: {
          primary: "#4f46e5",
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: "#22d3ee",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(79, 70, 229, 0.3)",
        "glow-sm": "0 0 10px rgba(79, 70, 229, 0.2)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
