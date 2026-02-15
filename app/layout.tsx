import type { Metadata } from "next";
import "./globals.css";

/**
 * [전역 레이아웃]
 * 모든 페이지에서 공통으로 사용되는 최상위 레이아웃
 * .cursorrules의 [Role] 무림 경영 시스템 전문가 컨셉 반영
 */
export const metadata: Metadata = {
  title: "Novel Alchemist - 소설 경영 관리 시스템",
  description: "무협소설 제작을 위한 7단계 스노우볼링 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body>
        {/* 
          [다크모드 강제 적용]
          토파즈 4K급 비장한 테마 활성화
        */}
        {children}
      </body>
    </html>
  );
}
