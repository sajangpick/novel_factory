'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  BookOpen, 
  Database, 
  Users, 
  LayoutDashboard,
  CheckSquare,
  Settings,
  Film,
  Activity,
  PenTool,
  Map,
  ChevronDown,
  ChevronRight,
  Crosshair,
  SearchCheck,
  ClipboardList,
} from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [좌측 사이드바] - 집필 최적화 구조
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 집필 프로젝트 (매일 쓰는 동선):
 *   현재 상태 → 전략 브리핑 → 작품 자료 → 본문 집필 → 품질 검수
 *
 * 기획실 (가끔):
 *   기획 도구 (Step 1~4 통합 페이지)
 *
 * 자료실 (접기):
 *   장르 공통 DB, 인명록, AI 교정, DB 업데이트, 출연진, 설정
 */

interface MenuItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
  highlight?: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [showManagement, setShowManagement] = useState(false);

  // ── 집필 프로젝트 (매일 쓰는 동선) ──
  const workflowMenus: MenuItem[] = [
    { icon: Activity, label: '현재 상태', href: '/dashboard/memory' },
    { icon: Crosshair, label: '전략 브리핑', href: '/dashboard/briefing' },
    { icon: BookOpen, label: '작품 자료', href: '/dashboard/worlddb' },
    { icon: PenTool, label: '본문 집필', href: '/dashboard/step6', highlight: true },
    { icon: CheckSquare, label: '품질 검수', href: '/dashboard/step7' },
  ];

  // ── 자료실 (접기 가능) ──
  const managementMenus: MenuItem[] = [
    { icon: Database, label: '장르 공통 DB', href: '/dashboard/strategy' },
    { icon: Users, label: '인명록 관리', href: '/dashboard/characters' },
    { icon: SearchCheck, label: 'AI 교정', href: '/dashboard/ai-review' },
    { icon: Database, label: 'DB 업데이트', href: '/dashboard/step8' },
    { icon: Film, label: '화수별 출연진', href: '/dashboard/episodes' },
    { icon: Settings, label: '시스템 설정', href: '/dashboard/settings' },
  ];

  const isInManagement = managementMenus.some(m => pathname === m.href);

  return (
    <aside className="w-60 bg-murim-darker border-r border-murim-border flex flex-col">
      {/* ── 헤더 ── */}
      <div className="p-4 border-b border-murim-border">
        <Link href="/dashboard" className="flex items-center space-x-2.5">
          <BookOpen className="w-7 h-7 text-murim-accent" />
          <div>
            <h2 className="text-base font-bold text-foreground">Novel Factory</h2>
            <p className="text-[10px] text-gray-600">무림 M&A · v3 귀환편</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ── 대시보드 홈 ── */}
        <SidebarLink
          icon={LayoutDashboard}
          label="대시보드"
          href="/dashboard"
          isActive={pathname === '/dashboard'}
        />

        {/* ── 집필 흐름 (매일 동선) ── */}
        <div>
          <h3 className="px-2 mb-1.5 text-[10px] font-bold text-murim-gold uppercase tracking-widest">
            집필 흐름
          </h3>
          <div className="space-y-0.5">
            {workflowMenus.map((item) => (
              <SidebarLink
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={pathname === item.href}
                highlight={item.highlight}
                badge={item.badge}
              />
            ))}
          </div>
        </div>

        {/* ── 새 소설 ── */}
        <div>
          <h3 className="px-2 mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            새 소설
          </h3>
          <div className="space-y-0.5">
            <SidebarLink
              icon={ClipboardList}
              label="기획실"
              href="/dashboard/planning"
              isActive={pathname === '/dashboard/planning'}
            />
          </div>
        </div>

        {/* ── 자료실 (접기) ── */}
        <div>
          <button
            onClick={() => setShowManagement(!showManagement)}
            className="w-full flex items-center justify-between px-2 mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors"
          >
            자료실
            {(showManagement || isInManagement) ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          {(showManagement || isInManagement) && (
            <div className="space-y-0.5">
              {managementMenus.map((item) => (
                <SidebarLink
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  isActive={pathname === item.href}
                  compact
                  badge={item.badge}
                />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ── 푸터 ── */}
      <div className="p-3 border-t border-murim-border text-[10px] text-gray-600">
        <p>Novel Factory v0.3.0</p>
        <p className="mt-0.5">© 2026 사장의 Pick</p>
      </div>
    </aside>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 사이드바 링크 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface SidebarLinkProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive: boolean;
  badge?: string;
  highlight?: boolean;
  compact?: boolean;
}

function SidebarLink({ icon: Icon, label, href, isActive, badge, highlight, compact }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={`
        flex items-center justify-between rounded-lg transition-all
        ${compact ? 'px-2 py-1.5 ml-2' : 'px-3 py-2'}
        ${isActive 
          ? highlight
            ? 'bg-murim-gold/20 text-murim-gold border border-murim-gold/30'
            : 'bg-murim-accent/20 text-murim-accent border border-murim-accent/30'
          : highlight && !isActive
            ? 'text-murim-gold/70 hover:bg-murim-gold/10 hover:text-murim-gold'
            : 'text-gray-500 hover:bg-murim-dark hover:text-foreground'
        }
      `}
    >
      <div className="flex items-center space-x-2.5">
        <Icon className={`${compact ? 'w-4 h-4' : 'w-4.5 h-4.5'}`} />
        <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
      </div>
      {badge && (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-murim-danger rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}
