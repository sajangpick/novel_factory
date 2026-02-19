'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, RefreshCw, Heart, Sword, Coins, Brain, 
  MapPin, Clock, AlertTriangle, BookOpen, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Edit3, Trash2, RotateCcw, Loader2, Shield
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

// ── 타입 정의 (실제 novel_dashboard 테이블 스키마 기준) ──
interface DashboardData {
  id: number;
  series_id: string;
  // 현재 시점
  latest_episode: number;
  story_date: string;
  season: string;
  weather: string;
  current_location: string;
  next_episode_title: string;
  // 주인공 상태
  mc_age: string;
  mc_health: string;
  mc_martial_rank: string;
  mc_internal_energy: string;
  mc_available_skills: any;
  mc_money: string;
  mc_injury: string;
  mc_emotion: string;
  mc_current_goal: string;
  // 3인격 (JSONB)
  three_personality: any;
  personality_conflict: string;
  personality_agreement: string;
  personality_growth: string;
  // 조직
  org_name: string;
  org_members: any;
  org_base: string;
  org_monthly_income: number;
  org_monthly_expense: number;
  org_businesses: any;
  // 경제/전투
  total_assets: number;
  combat_experience: string;
  latest_combat: string;
  combat_injury: string;
  // 복선/타임라인/주의
  active_foreshadows: any;
  next_cautions: string;
  recent_timeline: any;
  // 타임스탬프
  updated_at: string;
}

// ── JSONB 필드를 읽기 좋은 텍스트로 변환하는 헬퍼 ──
function jsonToText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map((item, i) => {
      if (typeof item === 'string') return `• ${item}`;
      if (typeof item === 'object') return `• ${Object.values(item).join(' — ')}`;
      return `• ${String(item)}`;
    }).join('\n');
  }
  if (typeof val === 'object') {
    return Object.entries(val).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v, null, 2) : v}`).join('\n');
  }
  return String(val);
}

// 3인격 JSONB에서 개별 인격 텍스트 추출
function getPersonality(data: any, key: string): string {
  if (!data) return '';
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return data; }
  }
  if (typeof data === 'object' && data[key]) {
    const v = data[key];
    return typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
  }
  return '';
}

// 숫자를 한국어 금액으로 포맷
function formatMoney(val: any): string {
  if (val === null || val === undefined) return '';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('ko-KR') + '냥';
}

// ── 기억 카드 타입 (memory_cards 테이블) ──
interface MemoryCard {
  id: number;
  episode_number: number;
  episode_title: string;
  when_summary: string;
  where_summary: string;
  who_summary: string;
  what_summary: string;
  why_summary: string;
  how_summary: string;
  asset_change: string;
  martial_change: string;
  org_change: string;
  relationship_change: string;
  location_change: string;
  health_change: string;
  foreshadow_planted: string;
  foreshadow_hinted: string;
  foreshadow_resolved: string;
  dominant_personality: string;
  personality_conflict: string;
  personality_growth: string;
  key_dialogue: string;
  cliffhanger: string;
  next_preview: string;
  next_caution: string;
  created_at: string;
}

// ── 동기화 상태 타입 ──
interface SyncItem {
  episodeNumber: number;
  title: string;
  status: 'confirmed' | 'unconfirmed' | 'modified' | 'deleted';
  wordCount: number;
  lastModified: string;
  hasMemoryCard: boolean;
}

interface SyncSummary {
  confirmed: number;
  unconfirmed: number;
  modified: number;
  deleted: number;
  latestConfirmed: number;
  total: number;
}

export default function MemoryDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentCards, setRecentCards] = useState<MemoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sync: true,
    mc: true,
    personality: true,
    world: false,
    combat: false,
    foreshadow: false,
    cautions: true,
    recentEpisodes: true,
  });

  // ── 동기화 상태 ──
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [confirmingEp, setConfirmingEp] = useState<number | null>(null);
  const [rollingBackEp, setRollingBackEp] = useState<number | null>(null);

  // ── 동기화 상태 로드 ──
  const loadSyncStatus = useCallback(async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('/api/confirm-episode');
      const data = await res.json();
      if (data.success) {
        setSyncItems(data.syncItems || []);
        setSyncSummary(data.summary || null);
      }
    } catch (err) {
      console.warn('동기화 상태 로드 실패:', err);
    } finally {
      setSyncLoading(false);
    }
  }, []);

  // ── 에피소드 확정 ──
  const handleConfirm = async (episodeNumber: number) => {
    if (!confirm(`제${episodeNumber}화를 확정하시겠습니까?\n\nAI가 본문을 분석하여 기억 카드와 대시보드를 자동 업데이트합니다.`)) return;
    setConfirmingEp(episodeNumber);
    try {
      const res = await fetch('/api/confirm-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeNumber }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ 제${episodeNumber}화 확정 완료!\n기억 카드 + 대시보드가 업데이트되었습니다.`);
        loadDashboard();
        loadSyncStatus();
      } else {
        alert(`❌ 확정 실패: ${data.error}`);
      }
    } catch (err: any) {
      alert(`❌ 오류: ${err.message}`);
    } finally {
      setConfirmingEp(null);
    }
  };

  // ── 확정 롤백 ──
  const handleRollback = async (episodeNumber: number) => {
    if (!confirm(`제${episodeNumber}화의 확정을 롤백하시겠습니까?\n\n해당 화의 기억 카드가 삭제되고, 대시보드가 이전 화 기준으로 복원됩니다.`)) return;
    setRollingBackEp(episodeNumber);
    try {
      const res = await fetch(`/api/confirm-episode?episode=${episodeNumber}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert(`🔄 제${episodeNumber}화 롤백 완료!\n최신 확정: 제${data.newLatestConfirmed}화`);
        loadDashboard();
        loadSyncStatus();
      } else {
        alert(`❌ 롤백 실패: ${data.error}`);
      }
    } catch (err: any) {
      alert(`❌ 오류: ${err.message}`);
    } finally {
      setRollingBackEp(null);
    }
  };

  // ── 데이터 로드 (대시보드 + 기억 카드 동시) ──
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, cardsRes] = await Promise.all([
        fetch('/api/novel-dashboard'),
        fetch('/api/memory-card'),
      ]);
      const dashData = await dashRes.json();
      const cardsData = await cardsRes.json();

      if (dashData.success && dashData.dashboard) {
        setDashboard(dashData.dashboard);
      } else {
        setError(dashData.message || '대시보드 데이터를 불러올 수 없습니다.');
      }

      if (cardsData.success && cardsData.cards) {
        const sorted = cardsData.cards.sort(
          (a: MemoryCard, b: MemoryCard) => b.episode_number - a.episode_number
        );
        setRecentCards(sorted);
      }
    } catch (err: any) {
      setError('네트워크 오류: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadSyncStatus();
  }, [loadDashboard, loadSyncStatus]);

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
      <div className="border-b border-murim-border pb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-8 h-8 text-murim-accent" />
            <h1 className="text-2xl font-bold text-foreground">현재 상태</h1>
            <span className="text-xs bg-murim-accent/15 text-murim-accent px-2 py-0.5 rounded-full font-medium">
              제{dashboard.latest_episode}화 기준
            </span>
          </div>
          <p className="text-sm text-gray-500">
            집필 전 체크리스트 — 스냅샷 + 최근 화 기록
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-murim-dark hover:bg-gray-700 text-gray-300 rounded-lg flex items-center space-x-2 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>새로고침</span>
        </button>
      </div>

      {/* ━━━ 동기화 상태 패널 ━━━ */}
      <SyncStatusPanel
        syncItems={syncItems}
        syncSummary={syncSummary}
        syncLoading={syncLoading}
        confirmingEp={confirmingEp}
        rollingBackEp={rollingBackEp}
        expanded={expandedSections.sync}
        onToggle={() => toggleSection('sync')}
        onConfirm={handleConfirm}
        onRollback={handleRollback}
        onRefresh={loadSyncStatus}
      />

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
          <p className="text-xs text-gray-500 mt-1">
            {[dashboard.season, dashboard.weather].filter(Boolean).join(' · ') || '-'}
          </p>
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
          <StatusCard label="나이" value={dashboard.mc_age} icon={<Activity className="w-4 h-4 text-gray-400" />} />
          <StatusCard label="체력 상태" value={dashboard.mc_health} icon={<Heart className="w-4 h-4 text-red-400" />} />
          <StatusCard label="무공 등급" value={dashboard.mc_martial_rank} icon={<Sword className="w-4 h-4 text-blue-400" />} />
          <StatusCard label="내공" value={dashboard.mc_internal_energy} icon={<Activity className="w-4 h-4 text-cyan-400" />} />
          <StatusCard label="자산" value={dashboard.mc_money} icon={<Coins className="w-4 h-4 text-yellow-400" />} />
          <StatusCard label="감정 상태" value={dashboard.mc_emotion} icon={<Brain className="w-4 h-4 text-purple-400" />} />
          <StatusCard label="현재 목표" value={dashboard.mc_current_goal} icon={<Activity className="w-4 h-4 text-green-400" />} />
          <StatusCard label="부상" value={dashboard.mc_injury} icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} />
        </div>
        {dashboard.mc_available_skills && (
          <div className="mt-4 p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-blue-400 mb-2">사용 가능 무공</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{jsonToText(dashboard.mc_available_skills)}</p>
          </div>
        )}
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
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {getPersonality(dashboard.three_personality, 'main') || getPersonality(dashboard.three_personality, '위소운') || '데이터 없음'}
            </p>
          </div>
          <div className="p-4 bg-murim-darker rounded-lg border border-green-900/30">
            <h4 className="text-sm font-bold text-green-400 mb-2">이준혁 (분석가)</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {getPersonality(dashboard.three_personality, 'lee') || getPersonality(dashboard.three_personality, '이준혁') || '데이터 없음'}
            </p>
          </div>
          <div className="p-4 bg-murim-darker rounded-lg border border-red-900/30">
            <h4 className="text-sm font-bold text-red-400 mb-2">천마 (무력)</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {getPersonality(dashboard.three_personality, 'chunma') || getPersonality(dashboard.three_personality, '천마') || '데이터 없음'}
            </p>
          </div>
        </div>
        {/* three_personality가 단순 문자열일 경우 전체 표시 */}
        {dashboard.three_personality && typeof dashboard.three_personality === 'string' && (
          <div className="mt-4 p-4 bg-murim-darker rounded-lg border border-purple-900/30">
            <h4 className="text-sm font-bold text-purple-400 mb-2">3인격 통합 상태</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.three_personality}</p>
          </div>
        )}
        {/* 인격 역학: 갈등/합의/성장 */}
        {(dashboard.personality_conflict || dashboard.personality_agreement || dashboard.personality_growth) && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {dashboard.personality_conflict && (
              <div className="p-4 bg-murim-darker rounded-lg border border-red-900/20">
                <h4 className="text-xs font-bold text-red-400 mb-1">인격 갈등</h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.personality_conflict}</p>
              </div>
            )}
            {dashboard.personality_agreement && (
              <div className="p-4 bg-murim-darker rounded-lg border border-green-900/20">
                <h4 className="text-xs font-bold text-green-400 mb-1">인격 합의</h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.personality_agreement}</p>
              </div>
            )}
            {dashboard.personality_growth && (
              <div className="p-4 bg-murim-darker rounded-lg border border-blue-900/20">
                <h4 className="text-xs font-bold text-blue-400 mb-1">인격 성장</h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.personality_growth}</p>
              </div>
            )}
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
        {/* 조직 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatusCard label="조직명" value={dashboard.org_name} icon={<Activity className="w-4 h-4 text-amber-400" />} />
          <StatusCard label="거점" value={dashboard.org_base} icon={<MapPin className="w-4 h-4 text-green-400" />} />
          <StatusCard label="총 자산" value={dashboard.total_assets ? formatMoney(dashboard.total_assets) : ''} icon={<Coins className="w-4 h-4 text-yellow-400" />} />
          <StatusCard label="월 수입" value={dashboard.org_monthly_income ? formatMoney(dashboard.org_monthly_income) : ''} icon={<Coins className="w-4 h-4 text-green-400" />} />
          <StatusCard label="월 지출" value={dashboard.org_monthly_expense ? formatMoney(dashboard.org_monthly_expense) : ''} icon={<Coins className="w-4 h-4 text-red-400" />} />
        </div>
        {/* 조직원 / 사업 */}
        {(dashboard.org_members || dashboard.org_businesses) && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dashboard.org_members && (
              <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
                <h4 className="text-sm font-bold text-murim-gold mb-2">조직원</h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{jsonToText(dashboard.org_members)}</p>
              </div>
            )}
            {dashboard.org_businesses && (
              <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
                <h4 className="text-sm font-bold text-murim-gold mb-2">운영 사업</h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{jsonToText(dashboard.org_businesses)}</p>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* ━━━ 전투 정보 ━━━ */}
      <CollapsibleSection
        title="전투 정보"
        sectionKey="combat"
        expanded={expandedSections.combat}
        onToggle={toggleSection}
        icon={<Sword className="w-5 h-5 text-blue-400" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-blue-400 mb-2">최근 전투</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.latest_combat || '전투 기록 없음'}</p>
          </div>
          <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-orange-400 mb-2">전투 부상</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.combat_injury || '부상 없음'}</p>
          </div>
          <div className="p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-cyan-400 mb-2">전투 경험</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dashboard.combat_experience || '기록 없음'}</p>
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
          <h4 className="text-sm font-bold text-orange-400 mb-2">활성 복선 목록</h4>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {jsonToText(dashboard.active_foreshadows) || '활성 복선 없음'}
          </p>
        </div>
        {dashboard.recent_timeline && (
          <div className="mt-4 p-4 bg-murim-darker rounded-lg border border-murim-border">
            <h4 className="text-sm font-bold text-gray-400 mb-2">최근 타임라인</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{jsonToText(dashboard.recent_timeline)}</p>
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
            {dashboard.next_cautions || '특별한 주의사항 없음'}
          </p>
        </div>
      </CollapsibleSection>

      {/* ━━━ 최근 화 요약 (기억 카드 통합) ━━━ */}
      <CollapsibleSection
        title={`에피소드 기억 카드 (전화)`}
        sectionKey="recentEpisodes"
        expanded={expandedSections.recentEpisodes}
        onToggle={toggleSection}
        icon={<BookOpen className="w-5 h-5 text-murim-accent" />}
      >
        {recentCards.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">아직 기억 카드가 없습니다</p>
            <p className="text-xs text-gray-700 mt-1">집필 완료 후 자동으로 생성됩니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentCards.map((card, idx) => (
              <EpisodeCard key={card.id} card={card} defaultOpen={idx === 0} />
            ))}
          </div>
        )}
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

// ━━━ 하위 컴포넌트: 화별 기억 카드 (접기/펼치기) ━━━
function EpisodeCard({ card, defaultOpen }: { card: MemoryCard; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const hasContent = (v: string) => v && v.trim().length > 0;

  // 6하원칙 중 내용이 있는 것만 표시
  const sixW = [
    { label: '언제', value: card.when_summary, color: 'text-blue-400' },
    { label: '어디서', value: card.where_summary, color: 'text-green-400' },
    { label: '누가', value: card.who_summary, color: 'text-yellow-400' },
    { label: '무엇을', value: card.what_summary, color: 'text-red-400' },
    { label: '왜', value: card.why_summary, color: 'text-purple-400' },
    { label: '어떻게', value: card.how_summary, color: 'text-cyan-400' },
  ].filter(w => hasContent(w.value));

  // 상태 변화 중 내용이 있는 것만
  const stateChanges = [
    { label: '💰 자산', value: card.asset_change },
    { label: '⚔️ 무공', value: card.martial_change },
    { label: '🏢 조직', value: card.org_change },
    { label: '🤝 관계', value: card.relationship_change },
    { label: '📍 위치', value: card.location_change },
    { label: '🩹 건강', value: card.health_change },
  ].filter(s => hasContent(s.value));

  // 복선
  const foreshadows = [
    { label: '투하', value: card.foreshadow_planted, color: 'text-orange-400' },
    { label: '힌트', value: card.foreshadow_hinted, color: 'text-yellow-400' },
    { label: '회수', value: card.foreshadow_resolved, color: 'text-green-400' },
  ].filter(f => hasContent(f.value));

  return (
    <div className="rounded-lg border border-murim-border overflow-hidden">
      {/* 헤더 (항상 보임) */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-murim-darker/50 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-murim-accent font-bold text-sm">제{card.episode_number}화</span>
          <span className="text-foreground text-sm font-medium truncate">{card.episode_title || '제목 없음'}</span>
          {card.dominant_personality && (
            <span className="text-[11px] px-1.5 py-0.5 bg-purple-500/15 text-purple-400 rounded">
              주도: {card.dominant_personality}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
      </button>

      {/* 내용 (펼쳤을 때) */}
      {open && (
        <div className="px-4 py-4 space-y-4 bg-murim-darker/20">
          {/* 6하원칙 */}
          {sixW.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">6하원칙 요약</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {sixW.map(w => (
                  <div key={w.label} className="p-2 bg-black/20 rounded border border-murim-border/50">
                    <span className={`text-[11px] font-bold ${w.color}`}>{w.label}</span>
                    <p className="text-xs text-gray-300 mt-0.5">{w.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상태 변화 */}
          {stateChanges.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">이 화의 상태 변화</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {stateChanges.map(s => (
                  <div key={s.label} className="p-2 bg-black/20 rounded border border-murim-border/50">
                    <span className="text-[11px] font-bold text-gray-400">{s.label}</span>
                    <p className="text-xs text-gray-300 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 복선 */}
          {foreshadows.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">복선 (떡밥)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {foreshadows.map(f => (
                  <div key={f.label} className="p-2 bg-black/20 rounded border border-murim-border/50">
                    <span className={`text-[11px] font-bold ${f.color}`}>{f.label}</span>
                    <p className="text-xs text-gray-300 mt-0.5 whitespace-pre-wrap">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3인격 + 핵심 대사 */}
          <div className="flex flex-wrap gap-2">
            {hasContent(card.personality_conflict) && (
              <div className="flex-1 min-w-[200px] p-2 bg-black/20 rounded border border-murim-border/50">
                <span className="text-[11px] font-bold text-red-400">인격 갈등</span>
                <p className="text-xs text-gray-300 mt-0.5">{card.personality_conflict}</p>
              </div>
            )}
            {hasContent(card.personality_growth) && (
              <div className="flex-1 min-w-[200px] p-2 bg-black/20 rounded border border-murim-border/50">
                <span className="text-[11px] font-bold text-green-400">인격 성장</span>
                <p className="text-xs text-gray-300 mt-0.5">{card.personality_growth}</p>
              </div>
            )}
          </div>

          {/* 핵심 대사 */}
          {hasContent(card.key_dialogue) && (
            <div className="p-3 bg-black/20 rounded border-l-2 border-murim-gold">
              <p className="text-[11px] text-murim-gold font-bold mb-1">핵심 대사</p>
              <p className="text-sm text-gray-200 italic">"{card.key_dialogue}"</p>
            </div>
          )}

          {/* 다음 화 연결 */}
          {(hasContent(card.cliffhanger) || hasContent(card.next_preview) || hasContent(card.next_caution)) && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">다음 화 연결</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {hasContent(card.cliffhanger) && (
                  <div className="p-2 bg-red-900/10 rounded border border-red-900/30">
                    <span className="text-[11px] font-bold text-red-400">절단신공</span>
                    <p className="text-xs text-gray-300 mt-0.5">{card.cliffhanger}</p>
                  </div>
                )}
                {hasContent(card.next_preview) && (
                  <div className="p-2 bg-blue-900/10 rounded border border-blue-900/30">
                    <span className="text-[11px] font-bold text-blue-400">예고</span>
                    <p className="text-xs text-gray-300 mt-0.5">{card.next_preview}</p>
                  </div>
                )}
                {hasContent(card.next_caution) && (
                  <div className="p-2 bg-orange-900/10 rounded border border-orange-900/30">
                    <span className="text-[11px] font-bold text-orange-400">주의사항</span>
                    <p className="text-xs text-gray-300 mt-0.5">{card.next_caution}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ━━━ 하위 컴포넌트: 동기화 상태 패널 ━━━
interface SyncStatusPanelProps {
  syncItems: SyncItem[];
  syncSummary: SyncSummary | null;
  syncLoading: boolean;
  confirmingEp: number | null;
  rollingBackEp: number | null;
  expanded: boolean;
  onToggle: () => void;
  onConfirm: (ep: number) => void;
  onRollback: (ep: number) => void;
  onRefresh: () => void;
}

function SyncStatusPanel({
  syncItems, syncSummary, syncLoading, confirmingEp, rollingBackEp,
  expanded, onToggle, onConfirm, onRollback, onRefresh,
}: SyncStatusPanelProps) {
  const needsAttention = syncItems.filter(i => i.status !== 'confirmed');
  const hasIssues = needsAttention.length > 0;

  return (
    <div className={`widget-card ${hasIssues ? 'border-yellow-600/50' : 'border-green-600/30'}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <Shield className={`w-5 h-5 ${hasIssues ? 'text-yellow-400' : 'text-green-400'}`} />
          <h3 className="text-lg font-bold text-foreground">에피소드 동기화</h3>
          {syncSummary && (
            <div className="flex items-center gap-2 ml-2">
              {syncSummary.confirmed > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded">
                  ✅ {syncSummary.confirmed}화 확정
                </span>
              )}
              {syncSummary.unconfirmed > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 bg-yellow-500/15 text-yellow-400 rounded animate-pulse">
                  ⏳ {syncSummary.unconfirmed}화 미확정
                </span>
              )}
              {syncSummary.modified > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 bg-orange-500/15 text-orange-400 rounded animate-pulse">
                  ✏️ {syncSummary.modified}화 수정됨
                </span>
              )}
              {syncSummary.deleted > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded">
                  🗑️ {syncSummary.deleted}화 삭제됨
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="p-1 hover:bg-white/5 rounded transition-colors"
            title="동기화 상태 새로고침"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${syncLoading ? 'animate-spin' : ''}`} />
          </button>
          {expanded
            ? <ChevronUp className="w-5 h-5 text-gray-400" />
            : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 mt-3">
          {syncLoading ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              동기화 상태 확인 중...
            </div>
          ) : syncItems.length === 0 ? (
            <div className="text-center py-4 text-gray-600 text-sm">
              DB에 저장된 에피소드가 없습니다.
            </div>
          ) : (
            <>
              {/* 주의 필요 항목 */}
              {needsAttention.length > 0 && (
                <div className="p-3 bg-yellow-900/10 border border-yellow-700/30 rounded-lg mb-3">
                  <p className="text-xs font-bold text-yellow-400 mb-2">
                    ⚠️ {needsAttention.length}개 에피소드에 조치가 필요합니다
                  </p>
                  <div className="space-y-2">
                    {needsAttention.map((item) => (
                      <SyncItemRow
                        key={item.episodeNumber}
                        item={item}
                        confirmingEp={confirmingEp}
                        rollingBackEp={rollingBackEp}
                        onConfirm={onConfirm}
                        onRollback={onRollback}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 전체 에피소드 목록 (확정된 것 포함) */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                {syncItems.map((item) => (
                  <SyncBadge key={item.episodeNumber} item={item} />
                ))}
              </div>

              {needsAttention.filter(i => i.status === 'unconfirmed' || i.status === 'modified').length > 1 && (
                <div className="flex justify-end mt-2">
                  <p className="text-[11px] text-gray-600">
                    💡 순서대로 하나씩 확정하세요 (연속성 분석을 위해)
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 동기화 항목 행 (주의 필요 항목) ──
function SyncItemRow({
  item, confirmingEp, rollingBackEp, onConfirm, onRollback,
}: {
  item: SyncItem;
  confirmingEp: number | null;
  rollingBackEp: number | null;
  onConfirm: (ep: number) => void;
  onRollback: (ep: number) => void;
}) {
  const isConfirming = confirmingEp === item.episodeNumber;
  const isRollingBack = rollingBackEp === item.episodeNumber;

  const statusConfig = {
    unconfirmed: { icon: <XCircle className="w-4 h-4 text-yellow-400" />, label: '미확정', color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
    modified: { icon: <Edit3 className="w-4 h-4 text-orange-400" />, label: '수정됨', color: 'text-orange-400', bg: 'bg-orange-900/20' },
    deleted: { icon: <Trash2 className="w-4 h-4 text-red-400" />, label: '삭제됨', color: 'text-red-400', bg: 'bg-red-900/20' },
    confirmed: { icon: <CheckCircle className="w-4 h-4 text-green-400" />, label: '확정', color: 'text-green-400', bg: 'bg-green-900/20' },
  };
  const cfg = statusConfig[item.status];

  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg ${cfg.bg} border border-murim-border/30 flex-wrap gap-2`}>
      <div className="flex items-center gap-2 min-w-0">
        {cfg.icon}
        <span className="text-sm font-bold text-foreground whitespace-nowrap">제{item.episodeNumber}화</span>
        <span className="text-xs text-gray-500 truncate max-w-[120px]">{item.title}</span>
        <span className={`text-[11px] ${cfg.color} whitespace-nowrap`}>{cfg.label}</span>
        {item.wordCount > 0 && (
          <span className="text-[10px] text-gray-600 whitespace-nowrap">{(item.wordCount / 1000).toFixed(1)}k자</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {item.status !== 'deleted' && (
          <button
            onClick={() => onConfirm(item.episodeNumber)}
            disabled={isConfirming || isRollingBack}
            className="px-2.5 py-1 text-xs font-bold bg-murim-accent/20 border border-murim-accent/50 text-murim-accent hover:bg-murim-accent/30 rounded transition-all disabled:opacity-50"
          >
            {isConfirming ? (
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />분석중...</span>
            ) : item.status === 'modified' ? '재확정' : '확정하기'}
          </button>
        )}
        {item.hasMemoryCard && (
          <button
            onClick={() => onRollback(item.episodeNumber)}
            disabled={isConfirming || isRollingBack}
            className="px-2 py-1 text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/20 border border-murim-border/30 rounded transition-all disabled:opacity-50"
            title="확정 롤백"
          >
            {isRollingBack ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── 동기화 뱃지 (전체 목록용) ──
function SyncBadge({ item }: { item: SyncItem }) {
  const colors = {
    confirmed: 'bg-green-900/30 border-green-700/40 text-green-400',
    unconfirmed: 'bg-yellow-900/30 border-yellow-700/40 text-yellow-400',
    modified: 'bg-orange-900/30 border-orange-700/40 text-orange-400',
    deleted: 'bg-red-900/30 border-red-700/40 text-red-400 line-through',
  };
  const icons = { confirmed: '✅', unconfirmed: '⏳', modified: '✏️', deleted: '🗑️' };

  return (
    <div
      className={`px-2 py-1.5 rounded border text-center text-xs font-medium ${colors[item.status]}`}
      title={`제${item.episodeNumber}화: ${item.title} (${item.status})`}
    >
      {icons[item.status]} {item.episodeNumber}화
    </div>
  );
}
