'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, RefreshCw, Heart, Sword, Coins, Brain, 
  MapPin, Clock, AlertTriangle, BookOpen, ChevronDown, ChevronUp
} from 'lucide-react';

/**
 * [Memory System - 현재 상태 대시보드]
 * novel_dashboard 테이블의 데이터를 시각화하여 보여주는 페이지
 * 
 * 집필 전 반드시 이 대시보드를 확인해야 설정 오류를 방지할 수 있음
 * - 주인공 상태: 체력, 무공, 자산, 감정, 부상
 * - 3인격 역학: 위소운/이준혁/천마 상태
 * - 세력 관계, 경제 상황, 전투 정보
 * - 활성 복선, 타임라인, 주의사항
 */

// ── 타입 정의 ──
interface DashboardData {
  id: number;
  series_id: string;
  latest_episode: number;
  story_date: string;
  season: string;
  current_location: string;
  next_episode_title: string;
  // 주인공 상태
  mc_health: string;
  mc_martial_rank: string;
  mc_money: string;
  mc_emotion: string;
  mc_current_goal: string;
  mc_injury: string;
  // 3인격
  personality_main: string;
  personality_lee: string;
  personality_chunma: string;
  personality_dynamics: string;
  // 세력/경제
  org_relationships: string;
  economic_status: string;
  // 전투
  latest_battle: string;
  combat_notes: string;
  // 복선/타임라인/주의
  active_foreshadows: string;
  timeline_summary: string;
  cautions: string;
  // 타임스탬프
  updated_at: string;
}

export default function MemoryDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    mc: true,
    personality: true,
    world: false,
    combat: false,
    foreshadow: false,
    cautions: true,
  });

  // ── 데이터 로드 ──
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/novel-dashboard');
      const data = await res.json();
      if (data.success && data.dashboard) {
        setDashboard(data.dashboard);
      } else {
        setError(data.message || '대시보드 데이터를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      setError('네트워크 오류: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ── 섹션 접기/펼치기 ──
  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── 로딩 상태 ──
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-murim-accent animate-spin mx-auto mb-4" />
          <p className="text-gray-400">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  // ── 에러 상태 ──
  if (error) {
    return (
      <div className="p-8">
        <div className="widget-card border-murim-danger">
          <p className="text-murim-danger mb-4">{error}</p>
          <button onClick={loadDashboard} className="px-4 py-2 bg-murim-accent rounded-lg text-white">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="p-8 space-y-6">
      {/* ━━━ 헤더 ━━━ */}
      <div className="border-b border-murim-border pb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-8 h-8 text-murim-accent" />
            <h1 className="text-3xl font-bold text-foreground">현재 상태 대시보드</h1>
          </div>
          <p className="text-gray-500">
            소설 집필 전 반드시 확인 — 설정 일관성의 핵심
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-murim-dark hover:bg-gray-700 text-gray-300 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>새로고침</span>
        </button>
      </div>

      {/* ━━━ 상단 요약 카드 ━━━ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 최신 화 */}
        <div className="widget-card">
          <div className="flex items-center space-x-2 mb-2">
            <BookOpen className="w-5 h-5 text-murim-accent" />
            <span className="text-sm text-gray-400">최신 에피소드</span>
          </div>
          <p className="text-2xl font-bold text-foreground">제{dashboard.latest_episode}화</p>
          <p className="text-xs text-gray-500 mt-1">{dashboard.next_episode_title || '다음 화 미정'}</p>
        </div>

        {/* 시간 */}
        <div className="widget-card">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-5 h-5 text-murim-gold" />
            <span className="text-sm text-gray-400">작중 시간</span>
          </div>
          <p className="text-lg font-bold text-foreground">{dashboard.story_date || '-'}</p>
          <p className="text-xs text-gray-500 mt-1">{dashboard.season || '-'}</p>
        </div>

        {/* 위치 */}
        <div className="widget-card">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="w-5 h-5 text-murim-success" />
            <span className="text-sm text-gray-400">현재 위치</span>
          </div>
          <p className="text-lg font-bold text-foreground">{dashboard.current_location || '-'}</p>
        </div>

        {/* 업데이트 */}
        <div className="widget-card">
          <div className="flex items-center space-x-2 mb-2">
            <RefreshCw className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-400">마지막 업데이트</span>
          </div>
          <p className="text-sm font-bold text-foreground">
            {dashboard.updated_at ? new Date(dashboard.updated_at).toLocaleString('ko-KR') : '-'}
          </p>
        </div>
      </div>

      {/* ━━━ 주인공 상태 ━━━ */}
      <CollapsibleSection
        title="주인공(위소운) 상태"
        sectionKey="mc"
        expanded={expandedSections.mc}
        onToggle={toggleSection}
        icon={<Heart className="w-5 h-5 text-murim-danger" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatusCard label="체력 상태" value={dashboard.mc_health} icon={<Heart className="w-4 h-4 text-red-400" />} />
          <StatusCard label="무공 등급" value={dashboard.mc_martial_rank} icon={<Sword className="w-4 h-4 text-blue-400" />} />
          <StatusCard label="자산" value={dashboard.mc_money} icon={<Coins className="w-4 h-4 text-yellow-400" />} />
          <StatusCard label="감정 상태" value={dashboard.mc_emotion} icon={<Brain className="w-4 h-4 text-purple-400" />} />
          <StatusCard label="현재 목표" value={dashboard.mc_current_goal} icon={<Activity className="w-4 h-4 text-green-400" />} />
          <StatusCard label="부상" value={dashboard.mc_injury} icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} />
        </div>
      </CollapsibleSection>

      {/* ━━━ 3인격 역학 ━━━ */}
      <CollapsibleSection
        title="3인격 역학"
        sectionKey="personality"
        expanded={expandedSections.personality}
        onToggle={toggleSection}
        icon={<Brain className="w-5 h-5 text-purple-400" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-murim-darker rounded-lg border border-blue-900/30">
            <h4 className="text-sm font-bold text-blue-400 mb-2">위소운 (주인격)</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.personality_main || '데이터 없음'}</p>
          </div>
          <div className="p-4 bg-murim-darker rounded-lg border border-green-900/30">
            <h4 className="text-sm font-bold text-green-400 mb-2">이준혁 (분석가)</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.personality_lee || '데이터 없음'}</p>
          </div>
          <div className="p-4 bg-murim-darker rounded-lg border border-red-900/30">
            <h4 className="text-sm font-bold text-red-400 mb-2">천마 (무력)</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.personality_chunma || '데이터 없음'}</p>
          </div>
        </div>
        {dashboard.personality_dynamics && (
          <div className="mt-4 p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-murim-accent mb-2">인격 간 역학</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.personality_dynamics}</p>
          </div>
        )}
      </CollapsibleSection>

      {/* ━━━ 세력/경제 ━━━ */}
      <CollapsibleSection
        title="세력 관계 & 경제 상황"
        sectionKey="world"
        expanded={expandedSections.world}
        onToggle={toggleSection}
        icon={<Coins className="w-5 h-5 text-yellow-400" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-murim-gold mb-2">세력 관계</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.org_relationships || '데이터 없음'}</p>
          </div>
          <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-murim-gold mb-2">경제 상황</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.economic_status || '데이터 없음'}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* ━━━ 전투 정보 ━━━ */}
      <CollapsibleSection
        title="전투 정보"
        sectionKey="combat"
        expanded={expandedSections.combat}
        onToggle={toggleSection}
        icon={<Sword className="w-5 h-5 text-blue-400" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-blue-400 mb-2">최근 전투</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.latest_battle || '아직 전투 기록 없음'}</p>
          </div>
          <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-blue-400 mb-2">전투 메모</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.combat_notes || '메모 없음'}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* ━━━ 활성 복선 ━━━ */}
      <CollapsibleSection
        title="활성 복선 (떡밥)"
        sectionKey="foreshadow"
        expanded={expandedSections.foreshadow}
        onToggle={toggleSection}
        icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}
      >
        <div className="p-4 bg-murim-darker rounded-lg border border-orange-900/30">
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {dashboard.active_foreshadows || '활성 복선 없음'}
          </p>
        </div>
        {dashboard.timeline_summary && (
          <div className="mt-4 p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-gray-400 mb-2">타임라인 요약</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.timeline_summary}</p>
          </div>
        )}
      </CollapsibleSection>

      {/* ━━━ 주의사항 (항상 노출) ━━━ */}
      <CollapsibleSection
        title="다음 화 집필 시 주의사항"
        sectionKey="cautions"
        expanded={expandedSections.cautions}
        onToggle={toggleSection}
        icon={<AlertTriangle className="w-5 h-5 text-murim-danger" />}
      >
        <div className="p-4 bg-murim-darker rounded-lg border border-red-900/30">
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {dashboard.cautions || '특별한 주의사항 없음'}
          </p>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ━━━ 하위 컴포넌트: 접기/펼치기 섹션 ━━━
interface CollapsibleSectionProps {
  title: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({ title, sectionKey, expanded, onToggle, icon, children }: CollapsibleSectionProps) {
  return (
    <div className="widget-card">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center space-x-2">
          {icon}
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {expanded && children}
    </div>
  );
}

// ━━━ 하위 컴포넌트: 상태 카드 ━━━
interface StatusCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function StatusCard({ label, value, icon }: StatusCardProps) {
  return (
    <div className="p-3 bg-murim-darker rounded-lg border border-murim-border">
      <div className="flex items-center space-x-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{value || '-'}</p>
    </div>
  );
}
