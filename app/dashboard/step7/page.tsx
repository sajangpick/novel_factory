'use client';

import { useState, useEffect } from 'react';
import { CheckSquare, Sparkles, ChevronLeft, ChevronRight, AlertTriangle, Trophy, XCircle } from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 7: 품질 검수 - AI 기반 소설 품질 리포트]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Step 6에서 작성된 본문을 6가지 기준으로 AI가 검수합니다:
 * 1. 경영 고증  2. 개연성  3. 설정 충돌
 * 4. 캐릭터 일관성  5. 문체 품질  6. 절단신공
 * 
 * 검수 결과를 점수표 + 문제점 + 개선 제안으로 보여줍니다.
 */

// ── 검수 항목별 아이콘/색상 매핑 ──
const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  '경영 고증':     { icon: '📊', color: 'blue' },
  '개연성':       { icon: '🔗', color: 'green' },
  '설정 충돌':     { icon: '🌍', color: 'yellow' },
  '캐릭터 일관성':  { icon: '👤', color: 'purple' },
  '문체 품질':     { icon: '✍️', color: 'pink' },
  '절단신공':      { icon: '⚡', color: 'red' },
};

interface QualityItem {
  category: string;
  score: number;
  grade: string;
  issues: string[];
  suggestions: string[];
}

interface QualityReport {
  items: QualityItem[];
  totalScore: number;
  overallComment: string;
  bestPart: string;
  worstPart: string;
}

export default function Step7Page() {
  // ── 상태 ──
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [content, setContent] = useState('');
  const [blueprint, setBlueprint] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [autoGate, setAutoGate] = useState<any>(null); // 자동 텍스트 분석 결과
  const [savedEpisodes, setSavedEpisodes] = useState<Record<number, string>>({});
  const [episodes, setEpisodes] = useState<any[]>([]);

  // ── 데이터 로드 ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Step 6 저장된 본문들
    const step6Data = localStorage.getItem('novel_step6_episodes');
    if (step6Data) {
      try {
        const parsed = JSON.parse(step6Data);
        setSavedEpisodes(parsed);
      } catch (e) { console.warn('Step 6 데이터 로드 실패:', e); }
    }

    // Step 3 에피소드 목록 (제목용)
    const step3Data = localStorage.getItem('novel_episodes_skeletons');
    if (step3Data) {
      try { setEpisodes(JSON.parse(step3Data)); }
      catch (e) { console.warn('Step 3 데이터 로드 실패:', e); }
    }

    // Step 4 설계도
    const step4Data = localStorage.getItem('novel_step4_designs');
    if (step4Data) {
      try {
        const designs = JSON.parse(step4Data);
        setBlueprint(designs[5] || designs[4] || designs[3] || designs[2] || designs[1] || '');
      } catch (e) { console.warn('Step 4 데이터 로드 실패:', e); }
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
    setReport(null); // 화 변경 시 이전 검수 결과 초기화
    setAutoGate(null);
  }, [episodeNumber, episodes, savedEpisodes]);

  // ── AI 검수 실행 ──
  const handleCheck = async () => {
    if (!content) {
      alert('❌ 검수할 본문이 없습니다.\n\nStep 6에서 먼저 본문을 작성해주세요.');
      return;
    }

    setIsChecking(true);
    setReport(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/quality-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber,
          episodeTitle,
          content,
          blueprint,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API 오류 (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.report) {
        setReport(data.report);
        if (data.autoGate) setAutoGate(data.autoGate);

        // 검수 결과 localStorage에 캐시
        const cacheKey = 'novel_step7_reports';
        const existing = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        existing[episodeNumber] = { ...data.report, autoGate: data.autoGate, timestamp: new Date().toISOString() };
        localStorage.setItem(cacheKey, JSON.stringify(existing));
      } else {
        throw new Error(data.message || '검수 실패');
      }
    } catch (error: any) {
      console.error('검수 오류:', error);
      if (error.name === 'AbortError') {
        alert('⏱️ 시간 초과 (60초). 다시 시도해주세요.');
      } else {
        alert(`❌ 검수 실패: ${error.message}`);
      }
    } finally {
      setIsChecking(false);
    }
  };

  // ── 점수에 따른 색상 ──
  const getScoreColor = (score: number): string => {
    if (score >= 9) return 'text-green-400';
    if (score >= 7) return 'text-blue-400';
    if (score >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  // ── 등급에 따른 배지 색상 ──
  const getGradeBg = (grade: string): string => {
    if (grade.includes('A+')) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (grade.includes('A')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (grade.includes('B')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (grade.includes('C')) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  // ── 총점에 따른 등급 ──
  const getOverallGrade = (total: number): { grade: string; label: string; color: string } => {
    if (total >= 54) return { grade: 'S', label: '화산귀환급', color: 'text-yellow-300' };
    if (total >= 48) return { grade: 'A', label: '상업 출판 가능', color: 'text-green-400' };
    if (total >= 40) return { grade: 'B', label: '수정 후 출판 가능', color: 'text-blue-400' };
    if (total >= 30) return { grade: 'C', label: '대폭 수정 필요', color: 'text-yellow-400' };
    return { grade: 'D', label: '재작성 권장', color: 'text-red-400' };
  };

  const charCount = content.replace(/\s+/g, '').length;

  return (
    <div className="p-8 space-y-8">
      {/* ━━━ 헤더 ━━━ */}
      <div className="border-b border-murim-border pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <CheckSquare className="w-8 h-8 text-murim-accent" />
              <h1 className="text-3xl font-bold text-foreground">Step 7: 품질 검수</h1>
            </div>
            <p className="text-gray-500">AI가 6가지 기준으로 소설의 품질을 진단합니다</p>
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
          </div>
        </div>
      </div>

      {/* ━━━ 본문 미리보기 + 검수 버튼 ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 본문 미리보기 */}
        <div className="lg:col-span-2 widget-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">
              {episodeTitle || `제${episodeNumber}화`}
            </h3>
            <span className="text-sm text-gray-500">{charCount.toLocaleString()}자</span>
          </div>

          {content ? (
            <div className="bg-murim-darker rounded-lg p-4 max-h-[400px] overflow-y-auto">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-serif">
                {content.slice(0, 3000)}
                {content.length > 3000 && (
                  <span className="text-gray-600 block mt-2">... ({content.length - 3000}자 더 있음)</span>
                )}
              </p>
            </div>
          ) : (
            <div className="bg-murim-darker rounded-lg p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <p className="text-gray-400">이 화의 본문이 아직 없습니다.</p>
              <a
                href="/dashboard/step6"
                className="inline-block mt-3 px-4 py-2 bg-murim-accent hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Step 6에서 본문 작성하기
              </a>
            </div>
          )}
        </div>

        {/* 우측: 검수 실행 카드 */}
        <div className="widget-card flex flex-col items-center justify-center text-center space-y-4">
          <CheckSquare className="w-16 h-16 text-murim-accent" />
          <h3 className="text-lg font-bold text-foreground">AI 품질 검수</h3>
          <p className="text-sm text-gray-500">
            6가지 기준으로 본문을<br />엄격하게 분석합니다
          </p>

          <div className="text-xs text-gray-600 space-y-1">
            <p>경영 고증 / 개연성 / 설정 충돌</p>
            <p>캐릭터 일관성 / 문체 / 절단신공</p>
          </div>

          <button
            onClick={handleCheck}
            disabled={isChecking || !content}
            className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
              isChecking || !content
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-murim-accent to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-lg'
            }`}
          >
            {isChecking ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                <span>검수 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>AI 검수 실행</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ━━━ 자동 텍스트 분석 결과 (legacy 품질 게이트) ━━━ */}
      {autoGate && (
        <div className="widget-card animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>📊</span> 자동 텍스트 분석 (15개 기준)
            </h3>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-black ${
                autoGate.grade === 'S' ? 'text-yellow-300' :
                autoGate.grade === 'A' ? 'text-green-400' :
                autoGate.grade === 'B' ? 'text-blue-400' :
                autoGate.grade === 'C' ? 'text-yellow-400' : 'text-red-400'
              }`}>{autoGate.grade}</span>
              <span className="text-sm text-gray-400">{autoGate.score}/{autoGate.maxScore} ({autoGate.percentage.toFixed(0)}%)</span>
            </div>
          </div>

          {/* 진행바 */}
          <div className="w-full h-2 bg-murim-darker rounded-full mb-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-700"
              style={{ width: `${autoGate.percentage}%` }}
            />
          </div>

          {/* 금지 문구 경고 */}
          {autoGate.forbiddenHits && autoGate.forbiddenHits.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
              <p className="text-sm font-bold text-red-400 mb-1">금지 문구 발견!</p>
              <ul className="space-y-1">
                {autoGate.forbiddenHits.map((hit: string, i: number) => (
                  <li key={i} className="text-xs text-red-300">• &quot;{hit}&quot;</li>
                ))}
              </ul>
            </div>
          )}

          {/* 미통과 항목 */}
          {autoGate.warnings && autoGate.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-yellow-400 mb-1">미통과 항목 ({autoGate.warnings.length}개)</p>
              {autoGate.warnings.slice(0, 8).map((w: string, i: number) => (
                <p key={i} className="text-xs text-gray-400">• {w}</p>
              ))}
              {autoGate.warnings.length > 8 && (
                <p className="text-xs text-gray-600">... 외 {autoGate.warnings.length - 8}개</p>
              )}
            </div>
          )}

          {autoGate.warnings && autoGate.warnings.length === 0 && (
            <p className="text-sm text-green-400">모든 자동 검사 항목 통과!</p>
          )}
        </div>
      )}

      {/* ━━━ AI 검수 결과 ━━━ */}
      {report && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* 총점 카드 */}
          <div className="widget-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-5xl font-black ${getOverallGrade(report.totalScore).color}`}>
                    {getOverallGrade(report.totalScore).grade}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {getOverallGrade(report.totalScore).label}
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">
                    {report.totalScore}<span className="text-lg text-gray-500">/60</span>
                  </div>
                  <div className="w-48 h-3 bg-murim-darker rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-1000"
                      style={{ width: `${(report.totalScore / 60) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="text-right max-w-md">
                <p className="text-sm text-gray-300">{report.overallComment}</p>
                {report.bestPart && (
                  <p className="text-xs text-green-400 mt-2 flex items-center gap-1 justify-end">
                    <Trophy className="w-3 h-3" /> {report.bestPart}
                  </p>
                )}
                {report.worstPart && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1 justify-end">
                    <XCircle className="w-3 h-3" /> {report.worstPart}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 항목별 점수 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.items.map((item) => {
              const meta = CATEGORY_META[item.category] || { icon: '📋', color: 'gray' };
              return (
                <div key={item.category} className="widget-card">
                  {/* 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{meta.icon}</span>
                      <h4 className="font-bold text-foreground text-sm">{item.category}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-black ${getScoreColor(item.score)}`}>
                        {item.score}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${getGradeBg(item.grade)}`}>
                        {item.grade}
                      </span>
                    </div>
                  </div>

                  {/* 점수 바 */}
                  <div className="w-full h-2 bg-murim-darker rounded-full mb-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        item.score >= 8 ? 'bg-green-500' :
                        item.score >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${item.score * 10}%` }}
                    />
                  </div>

                  {/* 문제점 */}
                  {item.issues.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-red-400 mb-1">문제점</p>
                      <ul className="space-y-1">
                        {item.issues.map((issue, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <span className="text-red-500 mt-0.5">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 개선 제안 */}
                  {item.suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-400 mb-1">개선 제안</p>
                      <ul className="space-y-1">
                        {item.suggestions.map((sug, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <span className="text-blue-500 mt-0.5">→</span>
                            {sug}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 문제 없음 */}
                  {item.issues.length === 0 && item.suggestions.length === 0 && (
                    <p className="text-xs text-green-500">이상 없음</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* 다음 단계 안내 */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckSquare className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-400">다음 단계</p>
                <p className="text-sm text-gray-400 mt-1">
                  검수가 완료되면 <strong>Step 8 (DB 업데이트)</strong>에서 등장 인물·장소·사건 등을 자동 추출하여 데이터베이스에 기록합니다.
                </p>
                <a
                  href="/dashboard/step8"
                  className="inline-block mt-2 px-4 py-2 bg-murim-success hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Step 8로 이동
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
