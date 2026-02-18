import Sidebar from '@/app/components/Sidebar';
import DashboardShell from '@/app/components/DashboardShell';

/**
 * [대시보드 레이아웃]
 * 좌측 사이드바 + 중앙 메인 컨텐츠 + 오른쪽 참조 서랍
 *
 * 구조:
 *   [사이드바] | [메인 컨텐츠] | [📚 참조 서랍 (토글)]
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-murim-darker">
      <Sidebar />
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
