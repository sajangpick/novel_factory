'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Layers, BookOpen, Sparkles, Save, Search,
  ChevronDown, ChevronRight, ChevronUp, CheckCircle, Circle,
  RefreshCw, Plus, Settings, AlertCircle, Loader2
} from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [기획실] - Step 1~4 통합 페이지
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 왼쪽: 기본설정 / 기승전결 / 화 목록 (접기 가능)
 * 가운데: 선택한 항목의 편집기
 * 오른쪽: 참조 서랍 (공용)
 */

// ── 타입 정의 ──
interface NovelSpec {
  title: string;
  genre: string;
  totalEpisodes: number;
  synopsis: string;
}

interface Section {
  name: '기' | '승' | '전' | '결';
  label: string;
  episodes: number;
  synopsis: string;
  color: string;
}

interface Episode {
  id: number;
  title: string;
  skeleton: string;
  section: '기' | '승' | '전' | '결';
}

// 5단계 설계 정보
const DESIGN_STAGES = [
  { id: 1, name: '1차 핵심 뼈대', target: '100자', desc: '출연자, 장소, 시간, 핵심 사건' },
  { id: 2, name: '2차 서사 인과', target: '500자', desc: '대립 원인, 동선, 전조 증상' },
  { id: 3, name: '3차 고증 설정', target: '1,500자', desc: '건축, 음식, 화폐, 의복 고증' },
  { id: 4, name: '4차 감각 심리', target: '3,000자', desc: '오감, 내면 심리, 대사 설계' },
  { id: 5, name: '5차 최종 설계', target: '5,000자', desc: '액션 정밀 설계, 절단신공 포인트' },
];

type ActiveView =
  | { type: 'settings' }
  | { type: 'structure' }
  | { type: 'design'; episodeId: number };

export default function PlanningPage() {
  // ── 핵심 상태 ──
  const [spec, setSpec] = useState<NovelSpec>({ title: '', genre: '무협', totalEpisodes: 300, synopsis: '' });
  const [sections, setSections] = useState<Section[]>([
    { name: '기', label: '기(起) 시작', episodes: 75, synopsis: '', color: 'blue' },
    { name: '승', label: '승(承) 전개', episodes: 75, synopsis: '', color: 'green' },
    { name: '전', label: '전(轉) 절정', episodes: 75, synopsis: '', color: 'yellow' },
    { name: '결', label: '결(結) 결말', episodes: 75, synopsis: '', color: 'red' },
  ]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [designs, setDesigns] = useState<Record<number, Record<number, string>>>({});

  // ── UI 상태 ──
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'settings' });
  const [currentStage, setCurrentStage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<'전체' | '기' | '승' | '전' | '결'>('전체');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 왼쪽 패널 접기
  const [collapsed, setCollapsed] = useState({ settings: false, structure: true, episodes: false });

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── 초기 데이터 로드 (Supabase → localStorage 폴백) ──
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/novel-plans?keys=spec,sections,episodes,designs');
      if (res.ok) {
        const { success, plans } = await res.json();
        if (success && plans) {
          if (plans.spec?.data) setSpec(plans.spec.data);
          if (plans.sections?.data) setSections(plans.sections.data);
          if (plans.episodes?.data) setEpisodes(plans.episodes.data);
          if (plans.designs?.data) setDesigns(plans.designs.data);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Supabase 실패 시 localStorage 폴백
    migrateFromLocalStorage();
    setLoading(false);
  };

  // ── localStorage에서 기존 데이터 마이그레이션 ──
  const migrateFromLocalStorage = () => {
    try {
      const s1 = localStorage.getItem('novel_step1_spec');
      if (s1) setSpec(JSON.parse(s1));

      const s2 = localStorage.getItem('novel_step2_sections');
      if (s2) setSections(JSON.parse(s2));

      const s3 = localStorage.getItem('novel_episodes_skeletons');
      if (s3) setEpisodes(JSON.parse(s3));

      const s4 = localStorage.getItem('novel_step4_all_designs');
      if (s4) setDesigns(JSON.parse(s4));
    } catch {}
  };

  // ── Supabase + localStorage 동시 저장 (디바운스) ──
  const saveData = useCallback((key: string, data: any) => {
    // localStorage 즉시 캐시
    const lsKeyMap: Record<string, string> = {
      spec: 'novel_step1_spec',
      sections: 'novel_step2_sections',
      episodes: 'novel_episodes_skeletons',
      designs: 'novel_step4_all_designs',
    };
    if (lsKeyMap[key]) {
      localStorage.setItem(lsKeyMap[key], JSON.stringify(data));
    }

    // Supabase 디바운스 저장 (1.5초)
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch('/api/novel-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, data }),
        });
      } catch {}
      setSaving(false);
    }, 1500);
  }, []);

  // ── 기본 설정 업데이트 ──
  const updateSpec = (field: keyof NovelSpec, value: string | number) => {
    const newSpec = { ...spec, [field]: value };
    setSpec(newSpec);
    saveData('spec', newSpec);
  };

  // ── 기승전결 업데이트 ──
  const updateSection = (index: number, field: 'episodes' | 'synopsis', value: string | number) => {
    const newSections = [...sections];
    (newSections[index] as any)[field] = value;
    setSections(newSections);
    saveData('sections', newSections);
  };

  // ── 에피소드 뼈대 업데이트 ──
  const updateSkeleton = (id: number, skeleton: string) => {
    const updated = episodes.map(ep => ep.id === id ? { ...ep, skeleton } : ep);
    setEpisodes(updated);
    saveData('episodes', updated);
  };

  // ── 설계도 업데이트 ──
  const updateDesign = (episodeId: number, stageId: number, text: string) => {
    const newDesigns = {
      ...designs,
      [episodeId]: { ...(designs[episodeId] || {}), [stageId]: text },
    };
    setDesigns(newDesigns);
    saveData('designs', newDesigns);
  };

  // ── 에피소드 초기화 (기승전결 기반) ──
  const initializeEpisodes = () => {
    const initial: Episode[] = [];
    let num = 1;
    for (const s of sections) {
      for (let i = 0; i < s.episodes; i++) {
        initial.push({ id: num, title: `제${num}화`, skeleton: '', section: s.name });
        num++;
      }
    }
    setEpisodes(initial);
    saveData('episodes', initial);
  };

  // ── AI 줄거리 생성 (Step 1) ──
  const generateSynopsis = async () => {
    if (!spec.title) { alert('작품 제목을 먼저 입력해주세요.'); return; }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'synopsis', title: spec.title, genre: spec.genre, totalEpisodes: spec.totalEpisodes }),
      });
      const data = await res.json();
      if (data.success && data.synopsis) {
        updateSpec('synopsis', data.synopsis);
      } else {
        alert('AI 생성 실패: ' + (data.message || ''));
      }
    } catch (e: any) {
      alert('오류: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── AI 기승전결 생성 (Step 2) ──
  const generateStructure = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'structure', title: spec.title, genre: spec.genre,
          totalEpisodes: spec.totalEpisodes, synopsis: spec.synopsis,
          sections: sections.map(s => ({ name: s.name, episodes: s.episodes })),
        }),
      });
      const data = await res.json();
      if (data.success && data.sections) {
        const map: Record<string, string> = {};
        data.sections.forEach((s: any) => { map[s.name] = s.synopsis; });
        const newSections = sections.map(s => ({ ...s, synopsis: map[s.name] || s.synopsis }));
        setSections(newSections);
        saveData('sections', newSections);
      }
    } catch (e: any) {
      alert('오류: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── AI 5단계 설계 생성 (Step 4) ──
  const generateDesign = async (episodeId: number, stageId: number) => {
    setIsGenerating(true);
    try {
      const ep = episodes.find(e => e.id === episodeId);
      const res = await fetch('/api/generate-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: stageId,
          previousDesigns: designs[episodeId] || {},
          episodeNumber: episodeId,
          episodeTitle: ep?.title || `제${episodeId}화`,
          episodeSkeleton: ep?.skeleton || '',
        }),
      });
      const data = await res.json();
      if (data.success && data.design) {
        updateDesign(episodeId, stageId, data.design);
      } else {
        alert('AI 생성 실패: ' + (data.message || ''));
      }
    } catch (e: any) {
      alert('오류: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── 필터링된 에피소드 목록 ──
  const filteredEpisodes = episodes.filter(ep => {
    const matchSearch = !searchQuery || ep.title.includes(searchQuery) || ep.skeleton.includes(searchQuery);
    const matchSection = sectionFilter === '전체' || ep.section === sectionFilter;
    return matchSearch && matchSection;
  });

  const totalSectionEpisodes = sections.reduce((s, sec) => s + sec.episodes, 0);
  const completedSkeletons = episodes.filter(ep => ep.skeleton.length > 0).length;

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-murim-accent mx-auto mb-3" />
          <p className="text-sm text-gray-500">기획 데이터 로드 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ━━━ 왼쪽: 네비게이션 패널 ━━━ */}
      <div className="w-64 flex-shrink-0 border-r border-murim-border overflow-y-auto bg-murim-darker/30">
        {/* 저장 상태 */}
        <div className="px-3 py-2 border-b border-murim-border/50 flex items-center justify-between">
          <span className="text-[10px] text-gray-600">
            {saving ? '저장 중...' : '자동 저장됨'}
          </span>
          <span className="text-[10px] text-gray-600">{spec.title || '제목 미입력'}</span>
        </div>

        {/* ── 기본 설정 ── */}
        <NavSection
          title="기본 설정"
          collapsed={collapsed.settings}
          onToggle={() => setCollapsed(p => ({ ...p, settings: !p.settings }))}
          active={activeView.type === 'settings'}
          onClick={() => setActiveView({ type: 'settings' })}
          badge={spec.title ? '✓' : '!'}
          badgeColor={spec.title ? 'text-green-400' : 'text-yellow-400'}
        />

        {/* ── 기승전결 ── */}
        <NavSection
          title={`기승전결 (${totalSectionEpisodes}화)`}
          collapsed={collapsed.structure}
          onToggle={() => setCollapsed(p => ({ ...p, structure: !p.structure }))}
          active={activeView.type === 'structure'}
          onClick={() => setActiveView({ type: 'structure' })}
          badge={sections.every(s => s.synopsis) ? '✓' : `${sections.filter(s => s.synopsis).length}/4`}
          badgeColor={sections.every(s => s.synopsis) ? 'text-green-400' : 'text-gray-500'}
        />

        {/* ── 화 목록 ── */}
        <div className="border-t border-murim-border/30">
          <button
            onClick={() => setCollapsed(p => ({ ...p, episodes: !p.episodes }))}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.02]"
          >
            <span className="text-xs font-bold text-gray-400">
              화 목록 ({completedSkeletons}/{episodes.length})
            </span>
            {collapsed.episodes
              ? <ChevronRight className="w-3 h-3 text-gray-600" />
              : <ChevronDown className="w-3 h-3 text-gray-600" />}
          </button>

          {!collapsed.episodes && (
            <>
              {/* 검색 + 필터 */}
              <div className="px-2 pb-1 space-y-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="화 검색..."
                    className="w-full pl-6 pr-2 py-1 bg-black/20 border border-murim-border/30 rounded text-[10px] text-foreground focus:outline-none focus:border-murim-accent"
                  />
                </div>
                <div className="flex gap-0.5">
                  {(['전체', '기', '승', '전', '결'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setSectionFilter(f)}
                      className={`flex-1 py-0.5 text-[9px] rounded ${sectionFilter === f ? 'bg-murim-accent text-white' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* 에피소드 없으면 생성 버튼 */}
              {episodes.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] text-gray-600 mb-2">기승전결 설정 후 생성하세요</p>
                  <button
                    onClick={initializeEpisodes}
                    className="px-3 py-1.5 bg-murim-accent text-white text-[10px] rounded hover:bg-blue-600"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />화 목록 생성
                  </button>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-380px)] overflow-y-auto px-1 pb-2">
                  {filteredEpisodes.map(ep => {
                    const isActive = activeView.type === 'design' && activeView.episodeId === ep.id;
                    const hasDesign = !!designs[ep.id]?.[1];
                    const sectionColors: Record<string, string> = { '기': 'text-blue-400', '승': 'text-green-400', '전': 'text-yellow-400', '결': 'text-red-400' };

                    return (
                      <button
                        key={ep.id}
                        onClick={() => { setActiveView({ type: 'design', episodeId: ep.id }); setCurrentStage(1); }}
                        className={`w-full text-left px-2 py-1.5 rounded text-[11px] flex items-center gap-2 transition-colors ${
                          isActive ? 'bg-murim-accent/20 text-murim-accent' : 'text-gray-400 hover:bg-white/[0.02] hover:text-gray-300'
                        }`}
                      >
                        <span className={`font-bold text-[9px] ${sectionColors[ep.section]}`}>{ep.section}</span>
                        <span className="truncate flex-1">{ep.id}화</span>
                        {ep.skeleton && <Circle className="w-2 h-2 fill-green-500 text-green-500 flex-shrink-0" />}
                        {hasDesign && <Sparkles className="w-2.5 h-2.5 text-murim-gold flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ━━━ 가운데: 편집기 ━━━ */}
      <div className="flex-1 overflow-y-auto">
        {/* 기본 설정 편집기 */}
        {activeView.type === 'settings' && (
          <div className="p-6 max-w-3xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-murim-accent" />
              기본 설정
            </h2>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">작품 제목 *</label>
                <input
                  type="text"
                  value={spec.title}
                  onChange={e => updateSpec('title', e.target.value)}
                  placeholder="예: 천마, 경영으로 무림을 좌지우지하다"
                  className="w-full px-3 py-2 bg-murim-darker border border-murim-border rounded text-sm text-foreground focus:outline-none focus:border-murim-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">장르</label>
                <select
                  value={spec.genre}
                  onChange={e => updateSpec('genre', e.target.value)}
                  className="w-full px-3 py-2 bg-murim-darker border border-murim-border rounded text-sm text-foreground focus:outline-none focus:border-murim-accent"
                >
                  <option value="무협">무협</option>
                  <option value="판타지">판타지</option>
                  <option value="현대 판타지">현대 판타지</option>
                  <option value="로맨스">로맨스</option>
                  <option value="로맨스 판타지">로맨스 판타지</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">총 화수</label>
                <input
                  type="number"
                  value={spec.totalEpisodes}
                  onChange={e => updateSpec('totalEpisodes', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-murim-darker border border-murim-border rounded text-sm text-foreground focus:outline-none focus:border-murim-accent"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">전체 줄거리 (1,000자 내외)</label>
                <span className="text-[10px] text-gray-600">{spec.synopsis.replace(/\s+/g, '').length}자</span>
              </div>
              <textarea
                value={spec.synopsis}
                onChange={e => updateSpec('synopsis', e.target.value)}
                placeholder="전체 줄거리를 입력하세요..."
                className="w-full h-64 bg-murim-darker border border-murim-border rounded p-3 text-sm text-foreground resize-none focus:outline-none focus:border-murim-accent font-mono leading-relaxed"
              />
              <button
                onClick={generateSynopsis}
                disabled={isGenerating || !spec.title}
                className={`mt-2 px-4 py-2 rounded text-sm font-medium flex items-center gap-1.5 ${
                  isGenerating || !spec.title ? 'bg-gray-700 text-gray-500' : 'bg-murim-accent hover:bg-blue-600 text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating ? 'AI 생성 중...' : 'AI 줄거리 생성'}
              </button>
            </div>
          </div>
        )}

        {/* 기승전결 편집기 */}
        {activeView.type === 'structure' && (
          <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-murim-accent" />
                기승전결 구조
              </h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${totalSectionEpisodes === spec.totalEpisodes ? 'text-green-400' : 'text-red-400'}`}>
                  합계: {totalSectionEpisodes} / {spec.totalEpisodes}화
                </span>
                <button
                  onClick={generateStructure}
                  disabled={isGenerating || !spec.synopsis}
                  className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                    isGenerating || !spec.synopsis ? 'bg-gray-700 text-gray-500' : 'bg-murim-accent hover:bg-blue-600 text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  {isGenerating ? '생성 중...' : 'AI 자동 생성'}
                </button>
              </div>
            </div>

            {sections.map((sec, idx) => {
              const colors: Record<string, string> = { '기': 'border-blue-500/30', '승': 'border-green-500/30', '전': 'border-yellow-500/30', '결': 'border-red-500/30' };
              const textColors: Record<string, string> = { '기': 'text-blue-400', '승': 'text-green-400', '전': 'text-yellow-400', '결': 'text-red-400' };

              return (
                <div key={sec.name} className={`p-4 bg-murim-darker rounded-lg border ${colors[sec.name]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-bold ${textColors[sec.name]}`}>{sec.label}</span>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-500">화수:</label>
                      <input
                        type="number"
                        value={sec.episodes}
                        onChange={e => updateSection(idx, 'episodes', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-black/20 border border-murim-border/30 rounded text-xs text-foreground text-center focus:outline-none focus:border-murim-accent"
                      />
                      <span className="text-[10px] text-gray-600">{sec.synopsis.replace(/\s+/g, '').length}자</span>
                    </div>
                  </div>
                  <textarea
                    value={sec.synopsis}
                    onChange={e => updateSection(idx, 'synopsis', e.target.value)}
                    placeholder={`${sec.label}의 줄거리 (300자 내외)...`}
                    className="w-full h-24 bg-black/20 border border-murim-border/30 rounded p-2 text-xs text-foreground resize-none focus:outline-none focus:border-murim-accent"
                  />
                </div>
              );
            })}

            {episodes.length === 0 && sections.every(s => s.synopsis) && (
              <button
                onClick={initializeEpisodes}
                className="w-full py-3 bg-murim-accent/10 border border-murim-accent/30 rounded-lg text-murim-accent text-sm font-medium hover:bg-murim-accent/20"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                기승전결 기반으로 {totalSectionEpisodes}화 생성
              </button>
            )}
          </div>
        )}

        {/* 5단계 설계 편집기 */}
        {activeView.type === 'design' && (() => {
          const epId = activeView.episodeId;
          const ep = episodes.find(e => e.id === epId);
          const epDesigns = designs[epId] || {};

          return (
            <div className="p-6 space-y-4">
              {/* 화 정보 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-foreground">제{epId}화 설계</h2>
                  <span className="text-xs text-gray-500">{ep?.section && `[${ep.section}]`}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* 이전/다음 화 */}
                  <button
                    onClick={() => epId > 1 && setActiveView({ type: 'design', episodeId: epId - 1 })}
                    disabled={epId <= 1}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() => epId < episodes.length && setActiveView({ type: 'design', episodeId: epId + 1 })}
                    disabled={epId >= episodes.length}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30"
                  >
                    다음 →
                  </button>
                </div>
              </div>

              {/* 뼈대 입력 */}
              <div className="p-3 bg-murim-darker rounded border border-murim-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500 font-medium">100자 뼈대</span>
                  <span className="text-[10px] text-gray-600">{(ep?.skeleton || '').replace(/\s+/g, '').length}/100자</span>
                </div>
                <textarea
                  value={ep?.skeleton || ''}
                  onChange={e => updateSkeleton(epId, e.target.value)}
                  placeholder="출연자, 장소, 시간대, 핵심 사건..."
                  className="w-full h-16 bg-black/20 border border-murim-border/30 rounded p-2 text-xs text-foreground resize-none focus:outline-none focus:border-murim-accent"
                />
              </div>

              {/* 5단계 진행 표시 */}
              <div className="flex items-center gap-1">
                {DESIGN_STAGES.map(stage => {
                  const hasContent = !!epDesigns[stage.id];
                  const isActive = currentStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => setCurrentStage(stage.id)}
                      className={`flex-1 py-2 rounded text-[10px] font-medium text-center transition-all ${
                        isActive
                          ? 'bg-murim-accent text-white'
                          : hasContent
                            ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                            : 'bg-murim-darker text-gray-600 hover:bg-white/[0.03]'
                      }`}
                    >
                      {stage.id}차
                    </button>
                  );
                })}
              </div>

              {/* 현재 단계 정보 */}
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-foreground">{DESIGN_STAGES[currentStage - 1].name}</span>
                  <span className="text-gray-500 ml-2">{DESIGN_STAGES[currentStage - 1].target} · {DESIGN_STAGES[currentStage - 1].desc}</span>
                </div>
                <span className="text-gray-600">
                  {(epDesigns[currentStage] || '').replace(/\s+/g, '').length}자
                </span>
              </div>

              {/* 설계 에디터 */}
              <textarea
                value={epDesigns[currentStage] || ''}
                onChange={e => updateDesign(epId, currentStage, e.target.value)}
                placeholder={`${DESIGN_STAGES[currentStage - 1].name} 내용을 작성하세요...\n\nAI 생성 버튼으로 자동 생성할 수 있습니다.`}
                className="w-full h-80 bg-murim-darker border border-murim-border rounded p-4 text-sm text-foreground resize-none focus:outline-none focus:border-murim-accent font-mono leading-relaxed"
              />

              {/* 액션 버튼 */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => generateDesign(epId, currentStage)}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-1.5 ${
                    isGenerating ? 'bg-gray-700 text-gray-500' : 'bg-murim-accent hover:bg-blue-600 text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? 'AI 생성 중...' : `${currentStage}차 AI 생성`}
                </button>

                {epDesigns[currentStage] && currentStage < 5 && (
                  <button
                    onClick={() => setCurrentStage(currentStage + 1)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    승인 → {currentStage + 1}차
                  </button>
                )}
                {epDesigns[currentStage] && currentStage === 5 && (
                  <span className="px-3 py-1.5 bg-green-500/15 text-green-400 rounded text-xs font-bold">
                    5차 설계 완료
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

    </div>
  );
}

// ── 왼쪽 네비게이션 섹션 버튼 ──
function NavSection({ title, collapsed, onToggle, active, onClick, badge, badgeColor }: {
  title: string; collapsed: boolean; onToggle: () => void; active: boolean; onClick: () => void; badge: string; badgeColor: string;
}) {
  return (
    <div className="border-t border-murim-border/30">
      <div className="flex items-center">
        <button
          onClick={onClick}
          className={`flex-1 text-left px-3 py-2.5 text-xs font-bold transition-colors ${
            active ? 'text-murim-accent bg-murim-accent/10' : 'text-gray-400 hover:text-gray-300 hover:bg-white/[0.02]'
          }`}
        >
          {title}
        </button>
        <span className={`text-[10px] ${badgeColor} px-2`}>{badge}</span>
      </div>
    </div>
  );
}
