import Sidebar from '@/app/components/Sidebar';

/**
 * [대시보드 레이아웃]
 * 좌측 사이드바 + 중앙 메인 컨텐츠 영역
 * .cursorrules의 요구사항 반영
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-murim-darker">
      {/* 
        [좌측 사이드바]
        - 7단계 집필 프로세스 메뉴
        - World DB 관리
        - 인명록
      */}
      <Sidebar />

      {/* 
        [중앙 메인 컨텐츠 영역]
        - 대시보드 위젯
        - 각 단계별 페이지
      */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
