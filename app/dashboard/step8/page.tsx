'use client';

import { useState, useEffect } from 'react';
import { Database, Sparkles, ChevronLeft, ChevronRight, Users, MapPin, Swords, Coins, BookOpen, CheckCircle, AlertTriangle } from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 8: DB 업데이트 - 에피소드 데이터 자동 추출 & 기록]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 완성된 소설 본문에서 AI가 자동으로 추출하여 DB에 기록:
 * - 등장 인물 (이름, 역할, 비중)
 * - 등장 장소 (지명, 유형)
 * - 핵심 사건 (사건명, 요약)
 * - 무공/병기
 * - 자산/경제 정보
 * - 화 요약 (3줄)
 */

interface ExtractedCharacter {
  name: string;
  role: string;
  weight: string;
}

interface ExtractedLocation {
  name: string;
  type: string;
}

interface ExtractedEvent {
  name: string;
  summary: string;
}

interface ExtractedData {
  characters: ExtractedCharacter[];
  locations: ExtractedLocation[];
  events: ExtractedEvent[];
  martialArts: string[];
  assets: string[];
  summary: string;
}

export default function Step8Page() {
  // ── 상태 ──
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [content, setContent] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [savedToSupabase, setSavedToSupabase] = useState(false);
  const [savedEpisodes, setSavedEpisodes] = useState<Record<number, string>>({});
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [extractHistory, setExtractHistory] = useState<Record<number, ExtractedData>>({});

  // ── 데이터 로드 ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Step 6 저장된 본문들
    const step6Data = localStorage.getItem('novel_step6_episodes');
    if (step6Data) {
      try { setSavedEpisodes(JSON.parse(step6Data)); }
      catch (e) { console.warn('Step 6 데이터 로드 실패:', e); }
    }

    // Step 3 에피소드 목록 (제목용)
    const step3Data = localStorage.getItem('novel_episodes_skeletons');
    if (step3Data) {
      try { setEpisodes(JSON.parse(step3Data)); }
      catch (e) { console.warn('Step 3 데이터 로드 실패:', e); }
    }

    // 추출 이력 복원
    const historyData = localStorage.getItem('novel_step8_extractions');
    if (historyData) {
      try { setExtractHistory(JSON.parse(historyData)); }
      catch (e) { console.warn('추출 이력 로드 실패:', e); }
    }
  }, []);

  // ── 화수 변경 시 ──
  useEffect(() => {
    if (episodes.length > 0 && episodes[episodeNumber - 1]) {
      setEpisodeTitle(episodes[episodeNumber - 1].title || `제${episodeNumber}화`);
    }
    if (savedEpisodes[episodeNumber]) {
      setContent(savedEpisodes[episodeNumber]);
    } else {
      setContent('');
    }

    // 이전 추출 결과가 있으면 복원
    if (extractHistory[episodeNumber]) {
      setExtracted(extractHistory[episodeNumber]);
    } else {
      setExtracted(null);
    }
    setSavedToSupabase(false);
  }, [episodeNumber, episodes, savedEpisodes, extractHistory]);

  // ── AI 데이터 추출 실행 ──
  const handleExtract = async () => {
    if (!content) {
      alert('❌ 추출할 본문이 없습니다.\n\nStep 6에서 먼저 본문을 작성해주세요.');
      return;
    }

    setIsExtracting(true);
    setExtracted(null);
    setSavedToSupabase(false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/extract-episode-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber,
          episodeTitle,
          content,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API 오류 (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.extracted) {
        setExtracted(data.extracted);
        setSavedToSupabase(data.savedToSupabase || false);

        // localStorage에 추출 이력 저장
        const updated = { ...extractHistory, [episodeNumber]: data.extracted };
        setExtractHistory(updated);
        localStorage.setItem('novel_step8_extractions', JSON.stringify(updated));
      } else {
        throw new Error(data.message || '데이터 추출 실패');
      }
    } catch (error: any) {
      console.error('추출 오류:', error);
      if (error.name === 'AbortError') {
        alert('⏱️ 시간 초과 (60초). 다시 시도해주세요.');
      } else {
        alert(`❌ 추출 실패: ${error.message}`);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  // ── 비중에 따른 배지 색상 ──
  const getWeightColor = (weight: string): string => {
    if (weight === '높음') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (weight === '중간') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  // ── 역할에 따른 색상 ──
  const getRoleColor = (role: string): string => {
    if (role === '주인공') return 'text-yellow-400';
    if (role === '주요 조연' || role === '조연') return 'text-blue-400';
    if (role === '적대자') return 'text-red-400';
    return 'text-gray-500';
  };

  const charCount = content.replace(/\s+/g, '').length;
  const completedCount = Object.keys(extractHistory).length;

  return (
    <div className="p-8 space-y-8">
      {/* ━━━ 헤더 ━━━ */}
      <div className="border-b border-murim-border pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Database className="w-8 h-8 text-murim-accent" />
              <h1 className="text-3xl font-bold text-foreground">Step 8: DB 업데이트</h1>
            </div>
            <p className="text-gray-500">
              소설 본문에서 인물·장소·사건을 자동 추출하여 데이터베이스에 기록합니다
            </p>
          </div>

          {/* 화수 이동 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEpisodeNumber(Math.max(1, episodeNumber - 1))}
              disabled={episodeNumber <= 1}
              className="p-2 rounded-lg bg-murim-darker border border-murim-border hover:border-murim-accent disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">제</span>
              <input
                type="number"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(Math.max(1, Math.min(300, parseInt(e.target.value) || 1)))}
                className="w-16 px-2 py-1 text-center bg-murim-darker border border-murim-border rounded-lg text-foreground text-lg font-bold focus:outline-none focus:border-murim-accent"
                min={1} max={300}
              />
              <span className="text-sm text-gray-500">화</span>
            </div>

            <button
              onClick={() => setEpisodeNumber(Math.min(300, episodeNumber + 1))}
              disabled={episodeNumber >= 300}
              className="p-2 rounded-lg bg-murim-darker border border-murim-border hover:border-murim-accent disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <span className="text-xs text-gray-600 ml-2">
              추출 완료: {completedCount}화
            </span>
          </div>
        </div>
      </div>

      {/* ━━━ 본문 정보 + 추출 버튼 ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 본문 상태 카드 */}
        <div className="lg:col-span-3 widget-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-foreground">
              {episodeTitle || `제${episodeNumber}화`}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{charCount.toLocaleString()}자</span>
              {extractHistory[episodeNumber] && (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">
                  <CheckCircle className="w-3 h-3" /> 추출 완료
                </span>
              )}
            </div>
          </div>

          {content ? (
            <div className="bg-murim-darker rounded-lg p-4 max-h-[200px] overflow-y-auto">
              <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                {content.slice(0, 1500)}
                {content.length > 1500 && (
                  <span className="text-gray-600">... (이하 생략)</span>
                )}
              </p>
            </div>
          ) : (
            <div className="bg-murim-darker rounded-lg p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">이 화의 본문이 아직 없습니다.</p>
              <a href="/dashboard/step6" className="text-murim-accent text-sm underline mt-1 inline-block">
                Step 6에서 본문 작성
              </a>
            </div>
          )}
        </div>

        {/* 추출 실행 카드 */}
        <div className="widget-card flex flex-col items-center justify-center text-center space-y-3">
          <Database className="w-12 h-12 text-murim-accent" />
          <h3 className="text-sm font-bold text-foreground">데이터 추출</h3>
          <p className="text-xs text-gray-500">
            AI가 본문을 분석하여<br />DB에 기록합니다
          </p>

          <button
            onClick={handleExtract}
            disabled={isExtracting || !content}
            className={`w-full px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
              isExtracting || !content
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-murim-accent to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-lg'
            }`}
          >
            {isExtracting ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                <span>추출 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI 추출 실행</span>
              </>
            )}
          </button>

          {savedToSupabase && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Supabase 저장 완료
            </p>
          )}
        </div>
      </div>

      {/* ━━━ 추출 결과 ━━━ */}
      {extracted && (
        <div className="space-y-6 animate-in fade-in duration-500">

          {/* 화 요약 */}
          {extracted.summary && (
            <div className="widget-card">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-murim-gold" />
                <h3 className="text-lg font-bold text-foreground">화 요약</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {extracted.summary}
              </p>
            </div>
          )}

          {/* 4분할 데이터 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 등장 인물 */}
            <div className="widget-card">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-foreground">등장 인물</h3>
                <span className="text-xs text-gray-500 ml-auto">{extracted.characters.length}명</span>
              </div>

              {extracted.characters.length > 0 ? (
                <div className="space-y-2">
                  {extracted.characters.map((char, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-murim-darker rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${getRoleColor(char.role)}`}>
                          {char.name}
                        </span>
                        <span className="text-xs text-gray-500">{char.role}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border ${getWeightColor(char.weight)}`}>
                        {char.weight}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 text-center py-4">추출된 인물 없음</p>
              )}
            </div>

            {/* 등장 장소 */}
            <div className="widget-card">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-green-400" />
                <h3 className="font-bold text-foreground">등장 장소</h3>
                <span className="text-xs text-gray-500 ml-auto">{extracted.locations.length}곳</span>
              </div>

              {extracted.locations.length > 0 ? (
                <div className="space-y-2">
                  {extracted.locations.map((loc, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-murim-darker rounded-lg">
                      <span className="text-sm font-medium text-foreground">{loc.name}</span>
                      <span className="text-xs text-gray-500 bg-murim-dark px-2 py-0.5 rounded">
                        {loc.type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 text-center py-4">추출된 장소 없음</p>
              )}
            </div>

            {/* 핵심 사건 */}
            <div className="widget-card">
              <div className="flex items-center gap-2 mb-4">
                <Swords className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-foreground">핵심 사건</h3>
                <span className="text-xs text-gray-500 ml-auto">{extracted.events.length}건</span>
              </div>

              {extracted.events.length > 0 ? (
                <div className="space-y-2">
                  {extracted.events.map((evt, i) => (
                    <div key={i} className="p-2 bg-murim-darker rounded-lg">
                      <p className="text-sm font-bold text-yellow-400">{evt.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{evt.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 text-center py-4">추출된 사건 없음</p>
              )}
            </div>

            {/* 무공/병기 + 자산 */}
            <div className="widget-card">
              <div className="flex items-center gap-2 mb-4">
                <Coins className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-foreground">무공/병기 & 자산</h3>
              </div>

              {/* 무공/병기 */}
              {extracted.martialArts.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-purple-400 mb-2">무공/병기</p>
                  <div className="flex flex-wrap gap-2">
                    {extracted.martialArts.map((ma, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-purple-500/10 text-purple-300 rounded-lg border border-purple-500/20">
                        {ma}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 자산/경제 */}
              {extracted.assets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-400 mb-2">자산/경제 정보</p>
                  <ul className="space-y-1">
                    {extracted.assets.map((asset, i) => (
                      <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                        <Coins className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                        {asset}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {extracted.martialArts.length === 0 && extracted.assets.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">추출된 데이터 없음</p>
              )}
            </div>
          </div>

          {/* 완료 안내 */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-400">스노우볼링 8단계 완료!</p>
                <p className="text-sm text-gray-400 mt-1">
                  이 화의 데이터가 {savedToSupabase ? 'Supabase DB와 ' : ''}localStorage에 기록되었습니다.
                  다음 화를 진행하거나, <strong>대시보드</strong>에서 전체 현황을 확인하세요.
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <a
                    href="/dashboard"
                    className="px-4 py-2 bg-murim-accent hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    대시보드로 이동
                  </a>
                  <button
                    onClick={() => setEpisodeNumber(Math.min(300, episodeNumber + 1))}
                    className="px-4 py-2 bg-murim-success hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    다음 화 ({episodeNumber + 1}화) 진행
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
