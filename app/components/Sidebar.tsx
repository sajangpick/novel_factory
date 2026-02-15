'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BookOpen, 
  Database, 
  Users, 
  LayoutDashboard,
  FileText,
  CheckSquare,
  Settings,
  Film,
  Brain,
  Activity
} from 'lucide-react';

/**
 * [좌측 사이드바 컴포넌트]
 * .cursorrules의 7단계 집필 프로세스 메뉴 구현
 * - Step 1~7: 스노우볼링 프로세스
 * - World DB: 무림 설정 데이터베이스
 * - 인명록: 캐릭터 관리
 */

// 메뉴 아이템 타입 정의 (재사용 가능하도록 데이터 중심 설계)
interface MenuItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}

export default function Sidebar() {
  const pathname = usePathname();

  // [8단계 집필 프로세스 메뉴]
  const writingSteps: MenuItem[] = [
    { icon: FileText, label: 'Step 1: 스펙 정의', href: '/dashboard/step1' },
    { icon: FileText, label: 'Step 2: 4단 구조', href: '/dashboard/step2' },
    { icon: BookOpen, label: 'Step 3: 전체 화 뼈대', href: '/dashboard/step3' },
    { icon: FileText, label: 'Step 4: 상세 청사진', href: '/dashboard/step4' },
    { icon: Database, label: 'Step 5: DB 연동', href: '/dashboard/step5' },
    { icon: BookOpen, label: 'Step 6: 본문 집필', href: '/dashboard/step6' },
    { icon: CheckSquare, label: 'Step 7: 품질 검수', href: '/dashboard/step7' },
    { icon: Database, label: 'Step 8: DB 업데이트', href: '/dashboard/step8' },
  ];

  // [Memory System 메뉴] - 기억 시스템
  const memoryMenus: MenuItem[] = [
    { icon: Activity, label: '현재 상태 대시보드', href: '/dashboard/memory' },
    { icon: Brain, label: '화별 기억 카드', href: '/dashboard/memory/cards' },
  ];

  // [관리 메뉴]
  const managementMenus: MenuItem[] = [
    { icon: Database, label: 'World DB 관리', href: '/dashboard/worlddb' },
    { icon: Users, label: '인명록 관리', href: '/dashboard/characters' },
    { icon: Film, label: '화수별 출연진', href: '/dashboard/episodes' },
    { icon: Settings, label: '시스템 설정', href: '/dashboard/settings' },
  ];

  return (
    <aside className="w-64 bg-murim-darker border-r border-murim-border flex flex-col">
      {/* 헤더 */}
      <div className="p-6 border-b border-murim-border">
        <Link href="/dashboard" className="flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-murim-accent" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Novel Alchemist</h2>
            <p className="text-xs text-gray-500">무림 경영 시스템</p>
          </div>
        </Link>
      </div>

      {/* 대시보드 메인 */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 대시보드 홈 */}
        <div>
          <SidebarLink
            icon={LayoutDashboard}
            label="대시보드 홈"
            href="/dashboard"
            isActive={pathname === '/dashboard'}
          />
        </div>

        {/* 8단계 집필 프로세스 */}
        <div>
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            스노우볼링 8단계
          </h3>
          <div className="space-y-1">
            {writingSteps.map((item) => (
              <SidebarLink
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={pathname === item.href}
                badge={item.badge}
              />
            ))}
          </div>
        </div>

        {/* Memory System */}
        <div>
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            기억 시스템
          </h3>
          <div className="space-y-1">
            {memoryMenus.map((item) => (
              <SidebarLink
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={pathname === item.href}
              />
            ))}
          </div>
        </div>

        {/* 관리 메뉴 */}
        <div>
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            데이터 관리
          </h3>
          <div className="space-y-1">
            {managementMenus.map((item) => (
              <SidebarLink
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={pathname === item.href}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* 푸터 - 버전 정보 */}
      <div className="p-4 border-t border-murim-border text-xs text-gray-500">
        <p>Version 0.1.0</p>
        <p className="mt-1">© 2026 Novel Alchemist</p>
      </div>
    </aside>
  );
}

/**
 * [사이드바 링크 컴포넌트]
 * 재사용 가능한 메뉴 아이템 (Development Rule #1 준수)
 */
interface SidebarLinkProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive: boolean;
  badge?: string;
}

function SidebarLink({ icon: Icon, label, href, isActive, badge }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={`
        flex items-center justify-between px-3 py-2 rounded-lg transition-colors
        ${isActive 
          ? 'bg-murim-accent text-white' 
          : 'text-gray-400 hover:bg-murim-dark hover:text-foreground'
        }
      `}
    >
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {badge && (
        <span className="px-2 py-0.5 text-xs font-semibold bg-murim-danger rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}
