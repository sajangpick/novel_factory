'use client';

import { useState, useEffect } from 'react';
import { Layers, ChevronRight, X, Circle } from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [스토리 아크 뷰어] - 전체 스토리 흐름 한눈에 보기
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 탭: 프롤로그 / 기 / 승 / 전 / 결
 * 블록카드: skeleton 진행률
 * 에피소드 목록: 초록/회색 뱃지
 * 클릭: skeleton 팝업
 */

// ── 타입 ──
interface Episode {
  id: number;
  title: string;
  skeleton?: string;
  arc?: string;
  arc_block?: string;
  section?: string;
}

// ── 아크 메타데이터 (하드코딩) ──
const ARC_META = [
  {
    key: '프롤로그',
    label: '프롤로그',
    range: '1~13화',
    from: 1,
    to: 13,
    color: '#a855f7',
    colorClass: 'text-purple-400',
    borderClass: 'border-purple-500/40',
    bgClass: 'bg-purple-500/10',
    theme: '세 인격의 탄생과 첫 번째 시험',
    blocks: [],
    checkpoints: [],
  },
  {
    key: '기',
    label: '기(起)',
    range: '14~75화',
    from: 14,
    to: 75,
    color: '#3b82f6',
    colorClass: 'text-blue-400',
    borderClass: 'border-blue-500/40',
    bgClass: 'bg-blue-500/10',
    theme: '개봉에서 강남까지, 천화련의 기초를 세우다',
    blocks: [
      { key: '블록1 (준비)',       from: 14,  to: 25,  label: '블록1',  sub: '준비' },
      { key: '블록2 (개봉 장악)',  from: 26,  to: 35,  label: '블록2',  sub: '개봉 장악' },
      { key: '블록3 (강남 진출)', from: 36,  to: 45,  label: '블록3',  sub: '강남 진출' },
      { key: '블록4 (무림맹)',     from: 46,  to: 55,  label: '블록4',  sub: '무림맹' },
      { key: '블록5 (첫 위기)',   from: 56,  to: 65,  label: '블록5',  sub: '첫 위기' },
      { key: '블록6 (반격)',       from: 66,  to: 75,  label: '블록6',  sub: '반격' },
    ],
    checkpoints: [
      { ep: 75, text: '화경 완전 안정 / 5개 성 / 5호점 / 5대 상품', done: true },
    ],
  },
  {
    key: '승',
    label: '승(承)',
    range: '76~150화',
    from: 76,
    to: 150,
    color: '#22c55e',
    colorClass: 'text-green-400',
    borderClass: 'border-green-500/40',
    bgClass: 'bg-green-500/10',
    theme: '낙양 진출, 100호점 달성, 진짜 전쟁',
    blocks: [
      { key: '블록7 (낙양 입성)',  from: 76,  to: 90,  label: '블록7',  sub: '낙양 입성' },
      { key: '블록8 (진짜 전쟁)', from: 91,  to: 105, label: '블록8',  sub: '진짜 전쟁' },
      { key: '블록9 (동맹과 배신)', from: 106, to: 120, label: '블록9',  sub: '동맹과 배신' },
      { key: '블록10 (반전과 도약)', from: 121, to: 135, label: '블록10', sub: '반전과 도약' },
      { key: '블록11 (승 마무리)', from: 136, to: 150, label: '블록11', sub: '승 마무리' },
    ],
    checkpoints: [
      { ep: 150, text: '기류감응 4단계 / 낙양 거점 / 100호점 / 어음 물류 / 고아원 5개소', done: false },
    ],
  },
  {
    key: '전',
    label: '전(轉)',
    range: '151~225화',
    from: 151,
    to: 225,
    color: '#eab308',
    colorClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/40',
    bgClass: 'bg-yellow-500/10',
    theme: '황실과의 대결, 옥패의 진실, 세 소원의 갈림길',
    blocks: [],
    checkpoints: [
      { ep: 225, text: '(미정)', done: false },
    ],
  },
  {
    key: '결',
    label: '결(結)',
    range: '226~300화',
    from: 226,
    to: 300,
    color: '#ef4444',
    colorClass: 'text-red-400',
    borderClass: 'border-red-500/40',
    bgClass: 'bg-red-500/10',
    theme: '천하재패, 300호점, 배 안 굶는 세상',
    blocks: [],
    checkpoints: [
      { ep: 300, text: '3인 소원 완성', done: false },
    ],
  },
];

export default function ArcPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeArc, setActiveArc] = useState('기');
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [popup, setPopup] = useState<Episode | null>(null);

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    try {
      const res = await fetch('/api/novel-plans?keys=episodes');
      const { success, plans } = await res.json();
      if (success && plans?.episodes?.data?.length) {
        setEpisodes(plans.episodes.data);
      }
    } catch (e) {
      console.error('에피소드 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const arcMeta = ARC_META.find(a => a.key === activeArc) || ARC_META[1];

  // 현재 아크 에피소드
  const arcEpisodes = episodes.filter(ep => ep.id >= arcMeta.from && ep.id <= arcMeta.to);

  // 블록별 에피소드 (선택된 블록 or 첫 블록)
  const currentBlock = arcMeta.blocks.length > 0
    ? arcMeta.blocks.find(b => b.key === activeBlock) || null
    : null;
  const blockEpisodes = currentBlock
    ? arcEpisodes.filter(ep => ep.id >= currentBlock.from && ep.id <= currentBlock.to)
    : arcEpisodes;

  // skeleton 개수
  const skeletonCount = (from: number, to: number) =>
    episodes.filter(ep => ep.id >= from && ep.id <= to && ep.skeleton?.trim()).length;

  // 아크 전환 시 블록 초기화
  const switchArc = (key: string) => {
    setActiveArc(key);
    setActiveBlock(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <Layers className="w-8 h-8 animate-pulse text-murim-accent mx-auto mb-3" />
          <p className="text-sm text-gray-500">아크 데이터 로드 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-murim-darker text-foreground">

      {/* ━━━ 헤더 + 탭 ━━━ */}
      <div className="shrink-0 border-b border-murim-border bg-murim-darker/80 px-5 pt-4 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5 text-murim-accent" />
          <h1 className="text-base font-bold text-foreground">스토리 아크 뷰어</h1>
        </div>
        <div className="flex gap-1">
          {ARC_META.map(a => {
            const done = skeletonCount(a.from, a.to);
            const total = a.to - a.from + 1;
            const isActive = activeArc === a.key;
            return (
              <button
                key={a.key}
                onClick={() => switchArc(a.key)}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg border-t border-x transition-all ${
                  isActive
                    ? `${a.bgClass} ${a.colorClass} ${a.borderClass}`
                    : 'text-gray-600 border-transparent hover:text-gray-400'
                }`}
              >
                {a.label}
                <span className={`ml-1.5 text-[10px] ${isActive ? 'opacity-80' : 'opacity-40'}`}>
                  {done}/{total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ━━━ 메인 컨텐츠 ━━━ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* 왼쪽: 아크 개요 + 블록 카드 */}
        <div className="w-72 flex-shrink-0 border-r border-murim-border overflow-y-auto p-4 space-y-4">

          {/* 아크 개요 */}
          <div className={`rounded-lg border p-3 ${arcMeta.borderClass} ${arcMeta.bgClass}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold ${arcMeta.colorClass}`}>{arcMeta.label} · {arcMeta.range}</span>
              <span className="text-[10px] text-gray-500">
                {skeletonCount(arcMeta.from, arcMeta.to)}/{arcMeta.to - arcMeta.from + 1}화
              </span>
            </div>
            <p className="text-[11px] text-gray-400">{arcMeta.theme}</p>

            {/* 체크포인트 */}
            {arcMeta.checkpoints.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1">
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">체크포인트</p>
                {arcMeta.checkpoints.map(cp => (
                  <div key={cp.ep} className="flex items-start gap-1.5">
                    <span className={`mt-0.5 text-[10px] font-bold flex-shrink-0 ${cp.done ? 'text-green-400' : arcMeta.colorClass}`}>
                      {cp.ep}화
                    </span>
                    <span className="text-[10px] text-gray-500 leading-relaxed">{cp.text}</span>
                    {cp.done && <span className="text-green-400 text-[10px] flex-shrink-0">✅</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 블록 카드 */}
          {arcMeta.blocks.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">블록별 진행</p>
              <div className="space-y-1.5">
                {arcMeta.blocks.map(b => {
                  const done = skeletonCount(b.from, b.to);
                  const total = b.to - b.from + 1;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isSelected = activeBlock === b.key;
                  return (
                    <button
                      key={b.key}
                      onClick={() => setActiveBlock(isSelected ? null : b.key)}
                      className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                        isSelected
                          ? `${arcMeta.bgClass} ${arcMeta.borderClass}`
                          : 'border-murim-border/50 hover:border-murim-border bg-black/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <span className={`text-[10px] font-bold ${isSelected ? arcMeta.colorClass : 'text-gray-400'}`}>
                            {b.label}
                          </span>
                          <span className="text-[10px] text-gray-600 ml-1.5">{b.sub}</span>
                        </div>
                        <span className="text-[10px] text-gray-600">{b.from}~{b.to}화</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: arcMeta.color }}
                          />
                        </div>
                        <span className={`text-[9px] font-bold flex-shrink-0 ${done > 0 ? arcMeta.colorClass : 'text-gray-600'}`}>
                          {done}/{total}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-murim-border/30 p-3 text-center">
              <p className="text-[11px] text-gray-600">블록 설계 미정</p>
            </div>
          )}
        </div>

        {/* 오른쪽: 에피소드 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-300">
                {currentBlock ? `${currentBlock.label} · ${currentBlock.sub}` : arcMeta.label + ' 전체'}
              </p>
              <span className="text-[11px] text-gray-600">
                ({blockEpisodes.length}화 · skeleton {blockEpisodes.filter(e => e.skeleton?.trim()).length}개)
              </span>
            </div>
            {currentBlock && (
              <button
                onClick={() => setActiveBlock(null)}
                className="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> 전체 보기
              </button>
            )}
          </div>

          {/* 에피소드 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {blockEpisodes.map(ep => {
              const hasSkel = !!(ep.skeleton?.trim());
              return (
                <button
                  key={ep.id}
                  onClick={() => hasSkel && setPopup(ep)}
                  className={`text-left rounded-lg border p-2.5 transition-all ${
                    hasSkel
                      ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/50 cursor-pointer'
                      : 'border-murim-border/30 bg-black/10 cursor-default'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-600">제{ep.id}화</span>
                    <Circle
                      className={`w-2 h-2 flex-shrink-0 ${hasSkel ? 'fill-green-500 text-green-500' : 'fill-gray-700 text-gray-700'}`}
                    />
                  </div>
                  <p className={`text-[10px] leading-relaxed truncate ${hasSkel ? 'text-gray-300' : 'text-gray-600'}`}>
                    {ep.title ? ep.title.replace(/^제\d+화\s*/, '') : `(미정)`}
                  </p>
                  {ep.arc_block && (
                    <p className="text-[9px] text-gray-700 mt-0.5 truncate">{ep.arc_block.replace(/\s*\(.*\)/, '')}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ━━━ Skeleton 팝업 ━━━ */}
      {popup && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setPopup(null)}
        >
          <div
            className="bg-murim-dark border border-murim-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* 팝업 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-murim-border">
              <div>
                <span className="text-sm font-bold text-foreground">제{popup.id}화</span>
                <span className="text-xs text-gray-500 ml-2">
                  {popup.title?.replace(/^제\d+화\s*/, '') || ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600">{popup.arc_block || popup.arc}</span>
                <button onClick={() => setPopup(null)} className="text-gray-600 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* 팝업 본문 */}
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-[12px] text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                {popup.skeleton}
              </pre>
            </div>
            {/* 팝업 푸터 */}
            <div className="px-4 py-2.5 border-t border-murim-border flex items-center justify-between">
              <span className="text-[10px] text-gray-600">{(popup.skeleton || '').length}자</span>
              <button
                onClick={() => setPopup(null)}
                className="text-[11px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                닫기 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
