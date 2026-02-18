'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Database, Search, Upload, FileText, RefreshCw,
  ChevronRight, ChevronDown, X, BookOpen,
} from 'lucide-react';

/**
 * [세계관 DB 페이지 — 2단 탐색기 레이아웃]
 * 왼쪽: 카테고리별 파일 목록 (접기/펼치기)
 * 오른쪽: 선택한 파일 내용 뷰어
 */

interface WorldDBFile {
  id: string;
  name: string;
  path: string;
  category: string;
}

// ── 참조 파일 목록 (2026-02-18 기준 35개 파일) ──
const WORLDDB_FILES: WorldDBFile[] = [
  { id: 'bible', name: '마스터 스토리 바이블', path: 'novels/murim_mna/master_story_bible.md', category: '🏛️ 지휘부' },
  { id: 'rules_core', name: '집필 규칙 핵심', path: 'novels/murim_mna/집필_규칙_핵심.md', category: '🏛️ 지휘부' },
  { id: 'master', name: '소설 진행 마스터', path: 'novels/murim_mna/소설_진행_마스터.md', category: '🏛️ 지휘부' },
  { id: 'engine_3p', name: '3인격 엔진', path: 'novels/murim_mna/3인격_엔진.md', category: '⚙️ 집필엔진' },
  { id: 'engine_em', name: '이준혁 감정 엔진', path: 'novels/murim_mna/이준혁_감정_엔진.md', category: '⚙️ 집필엔진' },
  { id: 'engine_gi', name: '기류감응 가이드', path: 'novels/murim_mna/기류감응_가이드.md', category: '⚙️ 집필엔진' },
  { id: 'style', name: '문체 가이드', path: 'novels/murim_mna/문체_가이드.md', category: '⚙️ 집필엔진' },
  { id: 'story_arc', name: '스토리 아크 상세', path: 'novels/murim_mna/스토리_아크_상세.md', category: '📋 스토리' },
  { id: 'tournament', name: '무림대회 설정', path: 'novels/murim_mna/무림대회_설정.md', category: '📋 스토리' },
  { id: 'char_main', name: '캐릭터 — 주인공', path: 'novels/murim_mna/캐릭터_주인공.md', category: '👤 인물' },
  { id: 'char_sup', name: '캐릭터 — 조연·세력', path: 'novels/murim_mna/캐릭터_조연_세력.md', category: '👤 인물' },
  { id: 'char_tour', name: '캐릭터 — 무림대회', path: 'novels/murim_mna/캐릭터_무림대회.md', category: '👤 인물' },
  { id: 'char_sys', name: '캐릭터 시스템', path: 'novels/murim_mna/캐릭터_시스템.md', category: '👤 인물' },
  { id: 'martial_sys', name: '무공 시스템', path: 'novels/murim_mna/world_db/무공_시스템.md', category: '🗡️ 무공전투' },
  { id: 'martial_pro', name: '주인공 무공 상세', path: 'novels/murim_mna/world_db/무공_주인공_상세.md', category: '🗡️ 무공전투' },
  { id: 'combat', name: '전투 안무 가이드', path: 'novels/murim_mna/world_db/전투_안무가이드.md', category: '🗡️ 무공전투' },
  { id: 'martial_dic', name: '무공 기법 대전', path: 'novels/murim_mna/world_db/무공_기법_대전.md', category: '🗡️ 무공전투' },
  { id: 'org_ch', name: '천화련 조직·사업', path: 'novels/murim_mna/world_db/천화련_조직_사업.md', category: '🏢 조직세력' },
  { id: 'org_an', name: '안씨표국·안가', path: 'novels/murim_mna/world_db/안씨표국_안가.md', category: '🏢 조직세력' },
  { id: 'power', name: '세력도', path: 'novels/murim_mna/world_db/세력도.md', category: '🏢 조직세력' },
  { id: 'economy', name: '경제 시스템 심화', path: 'novels/murim_mna/world_db/경제_시스템_심화.md', category: '💰 경제' },
  { id: 'biz_terms', name: '경영 용어집', path: 'novels/murim_mna/world_db/경영_용어집.md', category: '💰 경제' },
  { id: 'geo', name: '지리·이동 DB', path: 'novels/murim_mna/world_db/지리_이동_DB.md', category: '📖 세계관' },
  { id: 'food', name: '음식 DB', path: 'novels/murim_mna/world_db/음식_DB.md', category: '📖 세계관' },
  { id: 'food_biz', name: '사업 음식기술', path: 'novels/murim_mna/world_db/사업_음식기술.md', category: '📖 세계관' },
  { id: 'arch', name: '건축·객실 DB', path: 'novels/murim_mna/world_db/건축_객실_DB.md', category: '📖 세계관' },
  { id: 'weapons', name: '무기·병기 DB', path: 'novels/murim_mna/world_db/무기_병기_DB.md', category: '📖 세계관' },
  { id: 'clothing', name: '의복·복식 DB', path: 'novels/murim_mna/world_db/의복_복식_DB.md', category: '📖 세계관' },
  { id: 'inns', name: '지역별 객잔 DB', path: 'novels/murim_mna/world_db/지역별_객잔_DB.md', category: '📖 세계관' },
  { id: 'modern', name: '이준혁 현대지식 DB', path: 'novels/murim_mna/world_db/이준혁_현대지식_DB.md', category: '📖 세계관' },
  { id: 'wuxia', name: '무협 용어집', path: 'novels/murim_mna/world_db/무협_용어집.md', category: '📖 세계관' },
  { id: 'theme', name: '테마·주제의식', path: 'novels/murim_mna/테마_주제의식.md', category: '🧭 전략방향' },
  { id: 'competitive', name: '경쟁작 차별화', path: 'novels/murim_mna/경쟁작_차별화.md', category: '🧭 전략방향' },
  { id: 'reader', name: '독자 타겟 분석', path: 'novels/murim_mna/독자_타겟분석.md', category: '🧭 전략방향' },
  { id: 'index', name: '📚 파일 색인', path: 'novels/murim_mna/_파일_색인.md', category: '🗺️ 색인' },
];

// 카테고리 순서 (사이드바에 표시될 순서)
const CATEGORY_ORDER = [
  '🏛️ 지휘부', '⚙️ 집필엔진', '📋 스토리', '👤 인물',
  '🗡️ 무공전투', '🏢 조직세력', '💰 경제', '📖 세계관',
  '🧭 전략방향', '🗺️ 색인',
];

// 카테고리별 파일 그룹핑 (빌드 타임에 한 번만 계산)
const FILE_GROUPS = CATEGORY_ORDER.map((cat) => ({
  category: cat,
  files: WORLDDB_FILES.filter((f) => f.category === cat),
}));

export default function WorldDBPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(CATEGORY_ORDER)
  );
  const [selectedFile, setSelectedFile] = useState<WorldDBFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'none' | 'syncing' | 'synced' | 'error'>('none');

  // 카테고리 접기/펼치기
  const toggleCategory = useCallback((cat: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // 페이지 진입 시 첫 번째 파일 자동 선택
  const initialLoaded = useRef(false);
  useEffect(() => {
    if (!initialLoaded.current && WORLDDB_FILES.length > 0) {
      initialLoaded.current = true;
      handleViewFile(WORLDDB_FILES[0]);
    }
  });

  // 전체 접기 / 전체 펼치기
  const toggleAll = useCallback(() => {
    setOpenCategories((prev) =>
      prev.size === CATEGORY_ORDER.length ? new Set<string>() : new Set(CATEGORY_ORDER)
    );
  }, []);

  // 파일 내용 불러오기
  const handleViewFile = useCallback(async (file: WorldDBFile) => {
    if (selectedFile?.id === file.id) return;
    try {
      setSelectedFile(file);
      setLoading(true);
      setFileContent('');
      const res = await fetch(`/api/read-file?path=${encodeURIComponent(file.path)}`);
      if (!res.ok) throw new Error('읽기 실패');
      const data = await res.json();
      setFileContent(data.content);
    } catch {
      setFileContent('❌ 파일을 읽을 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedFile?.id]);

  // Supabase 동기화
  const handleSync = useCallback(async () => {
    try {
      setUploading(true);
      setSyncStatus('syncing');
      const res = await fetch('/api/sync-worlddb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: WORLDDB_FILES }),
      });
      if (!res.ok) throw new Error('동기화 실패');
      const result = await res.json();
      setSyncStatus('synced');
      alert(`✅ 동기화 완료! ${result.count}개 파일 업로드`);
    } catch {
      setSyncStatus('error');
      alert('❌ 동기화 실패. 터미널을 확인하세요.');
    } finally {
      setUploading(false);
    }
  }, []);

  // 검색 필터 적용
  const keyword = searchTerm.toLowerCase();
  const visibleGroups = keyword
    ? FILE_GROUPS.map((g) => ({
        ...g,
        files: g.files.filter((f) => f.name.toLowerCase().includes(keyword)),
      })).filter((g) => g.files.length > 0)
    : FILE_GROUPS;

  const totalVisible = visibleGroups.reduce((s, g) => s + g.files.length, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* ── 상단 헤더 ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-murim-border bg-murim-darker/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Database className="w-7 h-7 text-murim-accent" />
            <div>
              <h1 className="text-xl font-bold text-foreground">세계관 DB</h1>
              <p className="text-xs text-gray-500">
                {WORLDDB_FILES.length}개 참조 파일 · {CATEGORY_ORDER.length}개 카테고리
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 동기화 상태 뱃지 */}
            {syncStatus === 'synced' && (
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">✅ 동기화됨</span>
            )}
            {syncStatus === 'error' && (
              <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">❌ 실패</span>
            )}

            <button
              onClick={handleSync}
              disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors bg-murim-accent hover:bg-blue-600 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? '동기화 중...' : 'Supabase 동기화'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 메인: 2단 레이아웃 ── */}
      <div className="flex flex-1 min-h-0">
        {/* 왼쪽 — 파일 탐색기 */}
        <aside className="w-72 lg:w-80 flex-shrink-0 border-r border-murim-border flex flex-col bg-murim-darker/30 overflow-hidden">
          {/* 검색창 */}
          <div className="p-3 border-b border-murim-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="파일 검색..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-accent placeholder:text-gray-600"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* 전체 접기/펼치기 + 파일 수 */}
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[11px] text-gray-500">
                {keyword ? `검색 결과 ${totalVisible}개` : `전체 ${WORLDDB_FILES.length}개`}
              </span>
              <button
                onClick={toggleAll}
                className="text-[11px] text-murim-accent hover:underline"
              >
                {openCategories.size === CATEGORY_ORDER.length ? '전체 접기' : '전체 펼치기'}
              </button>
            </div>
          </div>

          {/* 카테고리 + 파일 리스트 */}
          <nav className="flex-1 overflow-y-auto py-1 scrollbar-thin">
            {visibleGroups.map(({ category, files }) => {
              const isOpen = openCategories.has(category) || !!keyword;
              return (
                <div key={category}>
                  {/* 카테고리 헤더 */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    {isOpen
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                    <span className="truncate">{category}</span>
                    <span className="ml-auto text-[11px] text-gray-600 flex-shrink-0">{files.length}</span>
                  </button>

                  {/* 파일 목록 */}
                  {isOpen && (
                    <div className="pb-1">
                      {files.map((file) => {
                        const active = selectedFile?.id === file.id;
                        return (
                          <button
                            key={file.id}
                            onClick={() => handleViewFile(file)}
                            className={`
                              w-full text-left flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm transition-colors
                              ${active
                                ? 'bg-murim-accent/15 text-murim-accent border-l-2 border-murim-accent'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border-l-2 border-transparent'}
                            `}
                          >
                            <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {visibleGroups.length === 0 && (
              <div className="text-center py-8 text-gray-600 text-sm">
                검색 결과 없음
              </div>
            )}
          </nav>
        </aside>

        {/* 오른쪽 — 파일 내용 뷰어 */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedFile ? (
            <>
              {/* 뷰어 헤더 */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-murim-border bg-murim-darker/30">
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="w-5 h-5 text-murim-accent flex-shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-foreground truncate">{selectedFile.name}</h2>
                    <p className="text-[11px] text-gray-500 truncate">{selectedFile.category}</p>
                  </div>
                </div>
                {/* X 버튼 없음 — 항상 파일이 선택된 상태 유지 */}
              </div>

              {/* 뷰어 본문 */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-40 text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    불러오는 중...
                  </div>
                ) : (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {fileContent}
                  </pre>
                )}
              </div>
            </>
          ) : (
            /* 로딩 전 빈 상태 (자동 선택 전 잠깐 보임) */
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 opacity-40" />
              <span className="text-sm">파일 불러오는 중...</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
