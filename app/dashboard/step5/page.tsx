'use client';

import { useState, useEffect } from 'react';
import { Database, Search, Tag, BookOpen, MapPin, Swords, Utensils, Shirt, Users, Building, ChevronRight } from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 5: DB 연동 - 무림 세계관 검색 (@World_DB)]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * novels/murim_mna/world_db의 문서를 RAG 검색으로 활용
 * - 키워드 검색: "화산파 위치"
 * - @태그 검색: @요리, @무공, @객잔, @의복 등
 * - 검색 결과를 "핀" 하여 집필 시 참고 자료로 활용
 * - 핀된 자료는 Step 6에서 AI 프롬프트에 자동 주입
 */

// ── @태그 퀵 버튼 ──
const TAG_BUTTONS = [
  { tag: '요리',   icon: '🍜', label: '요리/음식', color: 'orange' },
  { tag: '객잔',   icon: '🏠', label: '객잔/주막', color: 'amber' },
  { tag: '무공',   icon: '⚔️', label: '무공/심법', color: 'red' },
  { tag: '무기',   icon: '🗡️', label: '무기/병기', color: 'gray' },
  { tag: '의복',   icon: '👘', label: '의복/복식', color: 'purple' },
  { tag: '지리',   icon: '🗺️', label: '지리/지역', color: 'green' },
  { tag: '이동',   icon: '🐎', label: '이동/동선', color: 'blue' },
  { tag: '세력',   icon: '🏯', label: '세력/조직', color: 'yellow' },
  { tag: '인물',   icon: '👤', label: '인물/캐릭터', color: 'pink' },
  { tag: '경영',   icon: '📊', label: '경영/용어', color: 'cyan' },
];

interface SearchResult {
  doc_name: string;
  category: string;
  heading: string;
  text: string;
  score: number;
}

interface PinnedItem {
  heading: string;
  text: string;
  doc_name: string;
}

export default function Step5Page() {
  // ── 상태 ──
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [source, setSource] = useState('');
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // ── 초기: 문서 목록 로드 + 핀 복원 ──
  useEffect(() => {
    loadDocuments();
    // 핀 복원
    const saved = localStorage.getItem('novel_step5_pinned');
    if (saved) {
      try { setPinnedItems(JSON.parse(saved)); }
      catch (e) { console.warn('핀 데이터 복원 실패:', e); }
    }
  }, []);

  // ── 문서 목록 로드 ──
  const loadDocuments = async () => {
    try {
      const res = await fetch('/api/rag-search');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (e) {
      console.warn('문서 목록 로드 실패:', e);
    }
  };

  // ── 검색 실행 ──
  const handleSearch = async (searchQuery?: string, tag?: string) => {
    const q = searchQuery || query;
    if (!q.trim() && !tag) return;

    setIsSearching(true);
    setActiveTag(tag || null);

    try {
      const response = await fetch('/api/rag-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tag ? { tag, top_k: 10 } : { query: q, top_k: 10 }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setSource(data.source || '');
      }
    } catch (error) {
      console.error('검색 오류:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // ── 핀 추가/제거 ──
  const togglePin = (result: SearchResult) => {
    const exists = pinnedItems.some(p => p.heading === result.heading && p.doc_name === result.doc_name);

    let updated: PinnedItem[];
    if (exists) {
      updated = pinnedItems.filter(p => !(p.heading === result.heading && p.doc_name === result.doc_name));
    } else {
      updated = [...pinnedItems, {
        heading: result.heading,
        text: result.text,
        doc_name: result.doc_name,
      }];
    }

    setPinnedItems(updated);
    localStorage.setItem('novel_step5_pinned', JSON.stringify(updated));
  };

  // ── 핀 여부 확인 ──
  const isPinned = (result: SearchResult): boolean => {
    return pinnedItems.some(p => p.heading === result.heading && p.doc_name === result.doc_name);
  };

  // ── 핀 전체 삭제 ──
  const clearPins = () => {
    if (confirm('핀된 항목을 모두 삭제하시겠습니까?')) {
      setPinnedItems([]);
      localStorage.removeItem('novel_step5_pinned');
    }
  };

  // ── Enter 키 검색 ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="p-8 space-y-8">
      {/* ━━━ 헤더 ━━━ */}
      <div className="border-b border-murim-border pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Database className="w-8 h-8 text-murim-accent" />
          <h1 className="text-3xl font-bold text-foreground">Step 5: DB 연동</h1>
        </div>
        <p className="text-gray-500">
          무림 세계관 데이터베이스 (@World_DB)를 검색하여 집필에 활용하세요
        </p>
      </div>

      {/* ━━━ 검색 바 ━━━ */}
      <div className="widget-card">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='검색어를 입력하세요... (예: "화산파 위치", "낙양 객잔 메뉴", "천마신공")'
              className="w-full pl-12 pr-4 py-4 bg-murim-darker border border-murim-border rounded-lg text-foreground text-lg focus:outline-none focus:border-murim-accent"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            className={`px-8 py-4 rounded-lg font-semibold transition-colors ${
              isSearching || !query.trim()
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-murim-accent hover:bg-blue-600 text-white'
            }`}
          >
            {isSearching ? '검색 중...' : '검색'}
          </button>
        </div>

        {/* @태그 퀵 버튼 */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500 font-semibold">@태그 빠른 검색</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TAG_BUTTONS.map((btn) => (
              <button
                key={btn.tag}
                onClick={() => handleSearch(undefined, btn.tag)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeTag === btn.tag
                    ? 'bg-murim-accent text-white ring-2 ring-murim-accent/50'
                    : 'bg-murim-darker text-gray-400 hover:text-white hover:bg-gray-700 border border-murim-border'
                }`}
              >
                <span>{btn.icon}</span>
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ━━━ 메인 영역: 검색 결과 + 핀 패널 ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── 좌측: 검색 결과 ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* 결과 헤더 */}
          {results.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {results.length}개 결과
                {source && <span className="ml-2 text-xs text-gray-600">({source === 'python' ? 'RAG 서버' : '로컬 검색'})</span>}
              </p>
            </div>
          )}

          {/* 결과 카드들 */}
          {results.length > 0 ? (
            results.map((result, idx) => (
              <div
                key={idx}
                className={`widget-card transition-all ${expandedResult === idx ? 'ring-1 ring-murim-accent' : ''}`}
              >
                {/* 헤더 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 bg-murim-accent/20 text-murim-accent rounded">
                        {result.category}
                      </span>
                      <span className="text-xs text-gray-600">{result.doc_name}</span>
                      <span className="text-xs text-gray-700">점수: {result.score}</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-1">{result.heading}</h3>
                  </div>
                  <button
                    onClick={() => togglePin(result)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isPinned(result)
                        ? 'bg-murim-gold text-murim-darker'
                        : 'bg-murim-darker text-gray-400 hover:text-murim-gold border border-murim-border'
                    }`}
                  >
                    {isPinned(result) ? '📌 핀됨' : '📌 핀'}
                  </button>
                </div>

                {/* 내용 미리보기 */}
                <div
                  className={`text-sm text-gray-400 whitespace-pre-wrap leading-relaxed ${
                    expandedResult === idx ? '' : 'max-h-32 overflow-hidden'
                  }`}
                >
                  {result.text}
                </div>

                {/* 더보기/접기 */}
                {result.text.length > 300 && (
                  <button
                    onClick={() => setExpandedResult(expandedResult === idx ? null : idx)}
                    className="mt-2 text-xs text-murim-accent hover:underline"
                  >
                    {expandedResult === idx ? '접기 ▲' : '더보기 ▼'}
                  </button>
                )}
              </div>
            ))
          ) : (
            // 초기 상태: 문서 목록 표시
            <div className="widget-card">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-murim-accent" />
                세계관 데이터베이스 ({documents.length}개 문서)
              </h3>
              {documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {documents.map((doc: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-murim-darker rounded-lg border border-murim-border hover:border-murim-accent transition-colors cursor-pointer"
                      onClick={() => {
                        setQuery(doc.name.replace(/_/g, ' '));
                        handleSearch(doc.name.replace(/_/g, ' '));
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-gray-600">{doc.category}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  문서를 불러오는 중...
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 우측: 핀된 항목 패널 ── */}
        <div className="space-y-4">
          <div className="widget-card sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                📌 핀된 참고 자료
                <span className="text-xs text-gray-500 font-normal">({pinnedItems.length})</span>
              </h3>
              {pinnedItems.length > 0 && (
                <button
                  onClick={clearPins}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  전체 삭제
                </button>
              )}
            </div>

            {pinnedItems.length > 0 ? (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {pinnedItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-murim-darker rounded-lg border border-murim-gold/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-murim-gold font-semibold">{item.heading}</span>
                      <button
                        onClick={() => {
                          const updated = pinnedItems.filter((_, i) => i !== idx);
                          setPinnedItems(updated);
                          localStorage.setItem('novel_step5_pinned', JSON.stringify(updated));
                        }}
                        className="text-xs text-gray-600 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed max-h-24 overflow-hidden">
                      {item.text.slice(0, 300)}
                    </p>
                    <p className="text-xs text-gray-700 mt-1">{item.doc_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600">검색 결과에서 📌 핀 버튼을</p>
                <p className="text-sm text-gray-600">클릭하면 여기에 저장됩니다</p>
                <p className="text-xs text-gray-700 mt-3">
                  핀된 자료는 Step 6 집필 시<br />AI 프롬프트에 자동 주입됩니다
                </p>
              </div>
            )}

            {/* 다음 단계 안내 */}
            <div className="mt-4 pt-4 border-t border-murim-border">
              <a
                href="/dashboard/step6"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-murim-success hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <span>Step 6: 본문 집필로 이동</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
