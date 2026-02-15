import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* 
       * [토파즈 4K 다크모드 테마]
       * 비장하고 깔끔한 무림 경영 시스템 전용 색상 팔레트
       */
      colors: {
        // 배경색: 깊은 먹색
        background: "var(--background)",
        foreground: "var(--foreground)",
        
        // 무림 테마 색상
        murim: {
          dark: "#0a0e1a",      // 깊은 밤 하늘
          darker: "#05070f",    // 가장 어두운 배경
          border: "#1a2332",    // 경계선
          accent: "#3b82f6",    // 강조색 (파란빛)
          danger: "#ef4444",    // 리스크 경고
          success: "#10b981",   // 성공 지표
          gold: "#fbbf24",      // 경영 지표
        },
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
