import Link from "next/link";

/**
 * [메인 페이지]
 * 초기 랜딩 페이지 - 대시보드로 리디렉션 안내
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-murim-darker">
      <div className="text-center space-y-6">
        {/* 타이틀 */}
        <h1 className="text-5xl font-bold text-foreground">
          Novel Alchemist
        </h1>
        
        <p className="text-xl text-gray-400">
          무림 경영 시스템 전문가
        </p>

        <div className="pt-6">
          <Link 
            href="/dashboard"
            className="inline-block px-8 py-3 bg-murim-accent hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
          >
            대시보드 입장 →
          </Link>
        </div>

        {/* 
          [7단계 프로세스 개요]
          .cursorrules의 스노우볼링 7단계 표시
        */}
        <div className="pt-12 text-sm text-gray-500 space-y-1">
          <p>Step 1: 스펙 정의 → Step 2: 4단 구조 → Step 3: 상세 청사진</p>
          <p>Step 4: DB 연동 → Step 5: 본문 집필 → Step 6: 품질 검수 → Step 7: DB 업데이트</p>
        </div>
      </div>
    </main>
  );
}
