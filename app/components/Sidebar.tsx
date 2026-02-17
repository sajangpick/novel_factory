'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
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
  Activity,
  PenTool,
  Map,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
  Shield,
  Crosshair
} from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [좌측 사이드바] - 작업 중심 메뉴 구조
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 그룹 구조:
 * 1. 작업실: 본문 집필(Step 6) + 전략 문서 (가장 많이 쓰는 메뉴)
 * 2. 참조 자료: 인명록, 세계관 DB, 기억 시스템
 * 3. 기획 도구: Step 1~5 (초기 설정, 접어두기 가능)
 * 4. 검수/관리: Step 7~8, 출연진, 설정
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
  const [showPlanning, setShowPlanning] = useState(true);
  const [showManagement, setShowManagement] = useState(true);

  // ── 작업실 (핵심 메뉴) ──
  const workspaceMenus: MenuItem[] = [
    { icon: Crosshair, label: '전략 브리핑', href: '/dashboard/briefing', badge: 'NEW' },
    { icon: PenTool, label: '본문 집필', href: '/dashboard/step6', highlight: true },
    { icon: Map, label: '전략 문서', href: '/dashboard/strategy' },
  ];

  // ── 참조 자료 ──
  const referenceMenus: MenuItem[] = [
    { icon: Users, label: '인명록', href: '/dashboard/characters' },
    { icon: Database, label: '세계관 DB', href: '/dashboard/worlddb' },
    { icon: Activity, label: '현재 상태', href: '/dashboard/memory' },
    { icon: Brain, label: '기억 카드', href: '/dashboard/memory/cards' },
  ];

  // ── 기획 도구 (접기 가능) ──
  const planningMenus: MenuItem[] = [
    { icon: FileText, label: '1. 스펙 정의', href: '/dashboard/step1' },
    { icon: Layers, label: '2. 4단 구조', href: '/dashboard/step2' },
    { icon: BookOpen, label: '3. 전체 화 뼈대', href: '/dashboard/step3' },
    { icon: Sparkles, label: '4. 상세 청사진', href: '/dashboard/step4' },
    { icon: Database, label: '5. DB 연동', href: '/dashboard/step5' },
  ];

  // ── 검수/관리 (접기 가능) ──
  const managementMenus: MenuItem[] = [
    { icon: CheckSquare, label: '품질 검수', href: '/dashboard/step7' },
    { icon: Database, label: 'DB 업데이트', href: '/dashboard/step8' },
    { icon: Film, label: '화수별 출연진', href: '/dashboard/episodes' },
    { icon: Settings, label: '시스템 설정', href: '/dashboard/settings' },
  ];

  // 현재 기획 도구/관리 메뉴에 있으면 자동 펼침
  const isInPlanning = planningMenus.some(m => pathname === m.href);
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

        {/* ── 작업실 (핵심) ── */}
        <div>
          <h3 className="px-2 mb-1.5 text-[10px] font-bold text-murim-gold uppercase tracking-widest">
            작업실
          </h3>
          <div className="space-y-0.5">
            {workspaceMenus.map((item) => (
              <SidebarLink
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={pathname === item.href}
                highlight={item.highlight}
              />
            ))}
          </div>
        </div>

        {/* ── 참조 자료 ── */}
        <div>
          <h3 className="px-2 mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            참조 자료
          </h3>
          <div className="space-y-0.5">
            {referenceMenus.map((item) => (
              <SidebarLink
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
              />
            ))}
          </div>
        </div>

        {/* ── 기획 도구 (접기) ── */}
        <div>
          <button
            onClick={() => setShowPlanning(!showPlanning)}
            className="w-full flex items-center justify-between px-2 mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors"
          >
            기획 도구
            {(showPlanning || isInPlanning) ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          {(showPlanning || isInPlanning) && (
            <div className="space-y-0.5">
              {planningMenus.map((item) => (
                <SidebarLink
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  isActive={pathname === item.href}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        {/* ── 검수/관리 (접기) ── */}
        <div>
          <button
            onClick={() => setShowManagement(!showManagement)}
            className="w-full flex items-center justify-between px-2 mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors"
          >
            검수 · 관리
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
                />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ── 푸터 ── */}
      <div className="p-3 border-t border-murim-border text-[10px] text-gray-600">
        <p>Novel Factory v0.2.0</p>
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
