'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Users, Database, Map, Activity,
  X, ChevronDown, ChevronRight, BookOpen, Pin, Loader2
} from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [공용 참조 서랍장] - 기획실 · 집필실 · 검수실 공용
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 4개 탭:
 *   인명록    → Supabase characters 테이블 검색
 *   세계관    → /api/rag-search 키워드 검색
 *   전략문서  → /api/strategy-files 내용 표시
 *   현재상태  → /api/novel-dashboard 요약 표시
 *
 * 핀 기능: 검색 결과를 핀 → localStorage + Supabase 저장
 */

type Tab = 'characters' | 'worlddb' | 'strategy' | 'status';

interface PinnedRef {
  id: string;
  tab: Tab;
  title: string;
  content: string;
}

interface ReferenceDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
}

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'characters', label: '인명록', icon: Users },
  { key: 'worlddb', label: '세계관', icon: Database },
  { key: 'strategy', label: '전략', icon: Map },
  { key: 'status', label: '현재상태', icon: Activity },
];

export default function ReferenceDrawer({ isOpen, onToggle }: ReferenceDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('characters');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [pinnedItems, setPinnedItems] = useState<PinnedRef[]>([]);

  // 탭별 데이터
  const [characters, setCharacters] = useState<any[]>([]);
  const [worldResults, setWorldResults] = useState<any[]>([]);
  const [strategyFiles, setStrategyFiles] = useState<Record<string, any>>({});
  const [strategyContent, setStrategyContent] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<any>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── 핀 데이터 복원 ──
  useEffect(() => {
    const saved = localStorage.getItem('reference_pins');
    if (saved) {
      try { setPinnedItems(JSON.parse(saved)); } catch {}
    }
  }, []);

  // ── 서랍 열릴 때 기본 데이터 로드 ──
  useEffect(() => {
    if (isOpen) {
      if (characters.length === 0) loadCharacters();
      if (!dashboard) loadDashboard();
      if (Object.keys(strategyFiles).length === 0) loadStrategyList();
      setTimeout(() => searchRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // ── 인명록 로드 ──
  const loadCharacters = async () => {
    try {
      const res = await fetch('/api/upload-characters');
      if (res.ok) {
        const data = await res.json();
        setCharacters(data.characters || []);
      }
    } catch {}
  };

  // ── 현재 상태 로드 ──
  const loadDashboard = async () => {
    try {
      const res = await fetch('/api/novel-dashboard');
      if (res.ok) {
        const data = await res.json();
        if (data.success) setDashboard(data.dashboard);
      }
    } catch {}
  };

  // ── 전략 문서 목록 로드 ──
  const loadStrategyList = async () => {
    try {
      const res = await fetch('/api/strategy-files');
      if (res.ok) {
        const data = await res.json();
        setStrategyFiles(data.files || {});
      }
    } catch {}
  };

  // ── 전략 문서 내용 로드 ──
  const loadStrategyContent = async (key: string) => {
    if (strategyContent[key]) return;
    try {
      const res = await fetch(`/api/strategy-files?file=${key}`);
      if (res.ok) {
        const data = await res.json();
        setStrategyContent(prev => ({ ...prev, [key]: data.content || '' }));
      }
    } catch {}
  };

  // ── 세계관 검색 ──
  const searchWorldDB = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rag-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, top_k: 8 }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorldResults(data.results || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  // ── 통합 검색 (Enter) ──
  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    if (activeTab === 'worlddb') {
      searchWorldDB(query);
    }
    // 인명록은 클라이언트 필터링이므로 별도 호출 불필요
  }, [query, activeTab]);

  // ── 핀 토글 ──
  const togglePin = (item: PinnedRef) => {
    const exists = pinnedItems.some(p => p.id === item.id);
    const updated = exists
      ? pinnedItems.filter(p => p.id !== item.id)
      : [...pinnedItems, item];
    setPinnedItems(updated);
    localStorage.setItem('reference_pins', JSON.stringify(updated));
  };

  const isPinned = (id: string) => pinnedItems.some(p => p.id === id);

  // ── 인명록 필터링 (클라이언트) ──
  const filteredCharacters = query.trim()
    ? characters.filter((c: any) =>
        [c.name, c.title, c.faction, c.role, c.group_title]
          .filter(Boolean)
          .some(v => v.toLowerCase().includes(query.toLowerCase()))
      )
    : characters.slice(0, 20);

  if (!isOpen) {
    return (
      <div className="flex-shrink-0 flex items-center border-l border-murim-border/50">
        <button
          onClick={onToggle}
          className="px-1.5 py-6 bg-murim-darker hover:bg-murim-dark transition-colors group"
          title="참조 서랍 열기 (인명록·세계관·전략·현재상태)"
        >
          <BookOpen className="w-4 h-4 text-gray-600 group-hover:text-murim-accent transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-murim-border bg-murim-darker flex flex-col h-full">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-murim-border">
        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-murim-accent" />
          참조 서랍
        </span>
        <button onClick={onToggle} className="text-gray-500 hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── 탭 ── */}
      <div className="flex border-b border-murim-border">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-[11px] font-medium text-center transition-colors ${
              activeTab === tab.key
                ? 'text-murim-accent border-b-2 border-murim-accent'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 검색바 (인명록, 세계관에서만) ── */}
      {(activeTab === 'characters' || activeTab === 'worlddb') && (
        <div className="px-3 py-2 border-b border-murim-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={activeTab === 'characters' ? '이름, 소속, 역할 검색...' : '세계관 키워드 검색...'}
              className="w-full pl-8 pr-3 py-1.5 bg-black/20 border border-murim-border/50 rounded text-xs text-foreground placeholder-gray-600 focus:outline-none focus:border-murim-accent"
            />
          </div>
        </div>
      )}

      {/* ── 탭 내용 ── */}
      <div className="flex-1 overflow-y-auto">
        {/* 인명록 탭 */}
        {activeTab === 'characters' && (
          <div className="p-2 space-y-1">
            {filteredCharacters.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">
                {query ? '검색 결과 없음' : '인명록을 불러오는 중...'}
              </p>
            ) : (
              filteredCharacters.map((char: any) => {
                const pinId = `char_${char.id}`;
                return (
                  <div key={char.id} className="p-2 bg-black/20 rounded border border-murim-border/30 hover:border-murim-border transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {char.name}
                          {char.title && <span className="text-gray-500 font-normal ml-1">({char.title})</span>}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {[char.role, char.faction].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        onClick={() => togglePin({ id: pinId, tab: 'characters', title: char.name, content: `${char.name} (${char.title || ''}) - ${char.role || ''} / ${char.faction || ''}` })}
                        className={`ml-1 p-1 rounded ${isPinned(pinId) ? 'text-murim-gold' : 'text-gray-600 hover:text-gray-400'}`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            {!query && characters.length > 20 && (
              <p className="text-[10px] text-gray-600 text-center py-1">
                총 {characters.length}명 중 20명 표시 · 검색으로 더 찾기
              </p>
            )}
          </div>
        )}

        {/* 세계관 탭 */}
        {activeTab === 'worlddb' && (
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-murim-accent" />
              </div>
            ) : worldResults.length > 0 ? (
              worldResults.map((r: any, idx: number) => {
                const pinId = `world_${idx}_${r.heading}`;
                return (
                  <div key={idx} className="p-2 bg-black/20 rounded border border-murim-border/30">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{r.heading}</p>
                        <p className="text-[10px] text-gray-600">{r.doc_name} · {r.category}</p>
                      </div>
                      <button
                        onClick={() => togglePin({ id: pinId, tab: 'worlddb', title: r.heading, content: r.text?.slice(0, 200) || '' })}
                        className={`p-1 rounded flex-shrink-0 ${isPinned(pinId) ? 'text-murim-gold' : 'text-gray-600 hover:text-gray-400'}`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-3">{r.text}</p>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-600 text-center py-8">
                검색어를 입력하고 Enter를 누르세요
              </p>
            )}
          </div>
        )}

        {/* 전략문서 탭 */}
        {activeTab === 'strategy' && (
          <div className="p-2 space-y-1">
            {Object.entries(strategyFiles).map(([key, file]: [string, any]) => (
              <StrategyFileItem
                key={key}
                fileKey={key}
                label={file.label || key}
                description={file.description || ''}
                content={strategyContent[key]}
                onLoad={() => loadStrategyContent(key)}
              />
            ))}
            {Object.keys(strategyFiles).length === 0 && (
              <p className="text-xs text-gray-600 text-center py-8">전략 문서를 불러오는 중...</p>
            )}
          </div>
        )}

        {/* 현재상태 탭 */}
        {activeTab === 'status' && (
          <div className="p-2 space-y-2">
            {dashboard ? (
              <>
                <StatusRow label="최신 화" value={`제${dashboard.latest_episode}화`} />
                <StatusRow label="작중 시간" value={dashboard.story_date || '-'} />
                <StatusRow label="위치" value={dashboard.current_location || '-'} />
                <StatusRow label="체력" value={dashboard.mc_health || '-'} />
                <StatusRow label="무공 등급" value={dashboard.mc_martial_rank || '-'} />
                <StatusRow label="자산" value={dashboard.mc_money || '-'} />
                <StatusRow label="감정" value={dashboard.mc_emotion || '-'} />
                <StatusRow label="부상" value={dashboard.mc_injury || '-'} />
                <StatusRow label="현재 목표" value={dashboard.mc_current_goal || '-'} />
                {dashboard.next_cautions && (
                  <div className="p-2 bg-red-900/10 border border-red-900/30 rounded mt-2">
                    <p className="text-[10px] font-bold text-red-400 mb-1">주의사항</p>
                    <p className="text-[10px] text-gray-300 whitespace-pre-wrap">{dashboard.next_cautions}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-600 text-center py-8">현재 상태를 불러오는 중...</p>
            )}
          </div>
        )}
      </div>

      {/* ── 핀된 항목 (하단 고정) ── */}
      {pinnedItems.length > 0 && (
        <div className="border-t border-murim-border max-h-40 overflow-y-auto">
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-murim-gold">📌 핀 ({pinnedItems.length})</span>
            <button
              onClick={() => { setPinnedItems([]); localStorage.removeItem('reference_pins'); }}
              className="text-[10px] text-gray-600 hover:text-red-400"
            >
              전체 삭제
            </button>
          </div>
          <div className="px-2 pb-2 space-y-1">
            {pinnedItems.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 bg-murim-gold/5 border border-murim-gold/20 rounded">
                <Pin className="w-2.5 h-2.5 text-murim-gold flex-shrink-0" />
                <span className="text-[10px] text-gray-300 truncate flex-1">{p.title}</span>
                <button
                  onClick={() => togglePin(p)}
                  className="text-gray-600 hover:text-red-400"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 전략 문서 아이템 (접기/펼치기) ──
function StrategyFileItem({ fileKey, label, description, content, onLoad }: {
  fileKey: string; label: string; description: string; content?: string; onLoad: () => void;
}) {
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    if (!open && !content) onLoad();
    setOpen(!open);
  };

  return (
    <div className="bg-black/20 rounded border border-murim-border/30">
      <button onClick={handleToggle} className="w-full flex items-center justify-between p-2 hover:bg-white/[0.02]">
        <div className="text-left">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="text-[10px] text-gray-600">{description}</p>
        </div>
        {open ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
      </button>
      {open && (
        <div className="px-2 pb-2">
          {content ? (
            <pre className="text-[10px] text-gray-400 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">{content.slice(0, 2000)}</pre>
          ) : (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 상태 표시 행 ──
function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-1.5 bg-black/20 rounded">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className="text-[10px] text-foreground font-medium truncate ml-2 max-w-[160px]">{value}</span>
    </div>
  );
}
