'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckSquare, Sparkles, ChevronLeft, ChevronRight, AlertTriangle, Trophy, XCircle, Send, Loader2, Check, RotateCcw, X, Search, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 7: 품질 검수 + 빨간펜 지시창]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  '경영 고증': { icon: '📊', color: 'blue' },
  '개연성': { icon: '🔗', color: 'green' },
  '설정 충돌': { icon: '🌍', color: 'yellow' },
  '캐릭터 일관성': { icon: '👤', color: 'purple' },
  '문체 품질': { icon: '✍️', color: 'pink' },
  '절단신공': { icon: '⚡', color: 'red' },
};

interface QualityItem { category: string; score: number; grade: string; issues: string[]; suggestions: string[]; }
interface QualityReport { items: QualityItem[]; totalScore: number; overallComment: string; bestPart: string; worstPart: string; }

interface ChatIssue {
  id: number;
  lineNumber: number;
  severity: string;
  problem: string;
  suggestion: string;
  reference: string;
  location: string;
  fixedLine?: string;
  applied?: boolean;
  fixing?: boolean;
}

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
  issues?: ChatIssue[];
}

export default function Step7Page() {
  // ── 기존 상태 ──
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [content, setContent] = useState('');
  const [blueprint, setBlueprint] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [autoGate, setAutoGate] = useState<any>(null);
  const [savedEpisodes, setSavedEpisodes] = useState<Record<number, string>>({});
  const [episodes, setEpisodes] = useState<any[]>([]);

  // ── 빨간펜 지시창 상태 ──
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);

  // ── 본문 검색 상태 ──
  const [searchTerm, setSearchTerm] = useState('');
  const [searchIdx, setSearchIdx] = useState(0);

  // ── 본문 행 분할 ──
  const contentLines = content.split('\n');

  // ── 금지문구 행 매핑 (어느 행에 어떤 금지어가 있는지) ──
  const forbiddenLineMap = new Map<number, string[]>();
  if (autoGate?.forbiddenHits) {
    for (const hit of autoGate.forbiddenHits as string[]) {
      contentLines.forEach((line: string, i: number) => {
        if (line.includes(hit)) {
          const existing = forbiddenLineMap.get(i + 1) || [];
          existing.push(hit);
          forbiddenLineMap.set(i + 1, existing);
        }
      });
    }
  }

  // ── 빨간펜 이슈가 있는 행 (지시창에서 찾은 것) ──
  const issueLineSet = new Set<number>();
  chatMsgs.forEach((msg) => {
    if (msg.issues) msg.issues.forEach((iss) => { if (iss.lineNumber && !iss.applied) issueLineSet.add(iss.lineNumber); });
  });

  // ── 검색 매칭 행 목록 ──
  const searchMatches: number[] = [];
  if (searchTerm.length >= 1) {
    const term = searchTerm.toLowerCase();
    contentLines.forEach((line: string, i: number) => {
      if (line.toLowerCase().includes(term)) searchMatches.push(i + 1);
    });
  }

  // ── 행으로 스크롤 ──
  const scrollToLine = useCallback((lineNum: number) => {
    const el = document.getElementById(`step7-line-${lineNum}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // ── 검색 이동 ──
  const goSearchNext = () => {
    if (searchMatches.length === 0) return;
    const next = (searchIdx + 1) % searchMatches.length;
    setSearchIdx(next);
    scrollToLine(searchMatches[next]);
  };
  const goSearchPrev = () => {
    if (searchMatches.length === 0) return;
    const prev = (searchIdx - 1 + searchMatches.length) % searchMatches.length;
    setSearchIdx(prev);
    scrollToLine(searchMatches[prev]);
  };
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setSearchIdx(0);
  };
  const handleSearchEnter = () => {
    if (searchMatches.length > 0) {
      scrollToLine(searchMatches[0]);
    }
  };

  // ── 데이터 로드 ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const step6Data = localStorage.getItem('novel_step6_episodes');
    if (step6Data) { try { setSavedEpisodes(JSON.parse(step6Data)); } catch {} }
    const step3Data = localStorage.getItem('novel_episodes_skeletons');
    if (step3Data) { try { setEpisodes(JSON.parse(step3Data)); } catch {} }
    const step4Data = localStorage.getItem('novel_step4_designs');
    if (step4Data) { try { const d = JSON.parse(step4Data); setBlueprint(d[5]||d[4]||d[3]||d[2]||d[1]||''); } catch {} }
  }, []);

  // ── 화수 변경 ──
  useEffect(() => {
    if (episodes.length > 0 && episodes[episodeNumber - 1]) {
      setEpisodeTitle(episodes[episodeNumber - 1].title || `제${episodeNumber}화`);
    } else {
      setEpisodeTitle(`제${episodeNumber}화`);
    }
    setContent(''); setReport(null); setAutoGate(null); setChatMsgs([]);
    fetch(`/api/load-episode?episode=${episodeNumber}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.content) setContent(data.content);
        else if (savedEpisodes[episodeNumber]) setContent(savedEpisodes[episodeNumber]);
      })
      .catch(() => { if (savedEpisodes[episodeNumber]) setContent(savedEpisodes[episodeNumber]); });
  }, [episodeNumber, episodes, savedEpisodes]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);

  // ── 대화 지시 전송 (로컬 명령 우선 → AI 교정) ──
  const sendInstruction = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');

    // ━━ 로컬 명령 감지 (API 호출 없이 즉시 처리) ━━
    // "N화 열어줘", "N화 보여줘", "N화로", "N화 검수"
    const epMatch = msg.match(/(\d+)\s*화\s*(열어|보여|로\s*(가|이동|변경)|검수|검토|분석)/);
    if (epMatch) {
      const targetEp = parseInt(epMatch[1]);
      setChatMsgs((prev) => [...prev, { role: 'user', text: msg }]);
      setEpisodeNumber(targetEp);
      setChatMsgs((prev) => [...prev, { role: 'ai', text: `제${targetEp}화로 이동합니다.` }]);
      return;
    }

    // "N행 보여줘", "N행으로 가줘"
    const lineMatch = msg.match(/(\d+)\s*행\s*(보여|으로|로\s*(가|이동)|가줘)/);
    if (lineMatch) {
      const targetLine = parseInt(lineMatch[1]);
      setChatMsgs((prev) => [...prev, { role: 'user', text: msg }]);
      scrollToLine(targetLine);
      setChatMsgs((prev) => [...prev, { role: 'ai', text: `${targetLine}행으로 이동했습니다.` }]);
      return;
    }

    // 에피소드 본문이 없으면 AI 호출 불가
    if (!content) {
      setChatMsgs((prev) => [...prev, { role: 'user', text: msg }, { role: 'ai', text: '에피소드 본문을 먼저 로드해주세요.' }]);
      return;
    }

    // ━━ AI 교정 지시 (Claude API 호출) ━━
    setChatMsgs((prev) => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'instruct', instruction: msg, episodeNumber, episodeContent: content }),
      });
      let data = await res.json();

      // API가 message에 raw JSON을 넣어 보내는 경우 2차 파싱 시도
      if (data.message && typeof data.message === 'string' && (!data.issues || data.issues.length === 0)) {
        const stripped = data.message.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        try {
          const inner = stripped.match(/\{[\s\S]*\}/);
          if (inner) { const parsed = JSON.parse(inner[0]); data = { ...data, ...parsed }; }
        } catch { /* 2차 파싱 실패시 원본 유지 */ }
      }

      if (data.issues && data.issues.length > 0) {
        const issues: ChatIssue[] = data.issues.map((i: any, idx: number) => ({
          id: Date.now() + idx,
          lineNumber: i.lineNumber || 0,
          severity: i.severity || 'warning',
          problem: i.problem || '',
          suggestion: i.suggestion || '',
          reference: i.reference || '',
          location: i.location || '',
        }));
        // message에서 JSON 잔해 제거 후 표시
        let displayMsg = data.message || `${issues.length}건 발견`;
        if (displayMsg.startsWith('{') || displayMsg.startsWith('```')) {
          displayMsg = `${issues.length}건의 문제를 발견했습니다.`;
        }
        setChatMsgs((prev) => [...prev, {
          role: 'ai',
          text: displayMsg,
          issues,
        }]);
        if (issues[0]?.lineNumber) scrollToLine(issues[0].lineNumber);
      } else if (data.message) {
        // JSON 코드블록 잔해가 message에 남아있으면 정리
        let cleanMsg = data.message;
        if (cleanMsg.startsWith('```')) {
          cleanMsg = cleanMsg.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        }
        setChatMsgs((prev) => [...prev, { role: 'ai', text: cleanMsg }]);
      }
    } catch (err: any) {
      setChatMsgs((prev) => [...prev, { role: 'ai', text: `오류: ${err.message}` }]);
    }
    setChatLoading(false);
  };

  // ── 이슈 수정 요청 ──
  const requestFix = async (msgIdx: number, issueIdx: number) => {
    setChatMsgs((prev) => {
      const next = [...prev];
      const msg = { ...next[msgIdx], issues: [...(next[msgIdx].issues || [])] };
      msg.issues[issueIdx] = { ...msg.issues[issueIdx], fixing: true };
      next[msgIdx] = msg;
      return next;
    });

    const issue = chatMsgs[msgIdx]?.issues?.[issueIdx];
    if (!issue) return;

    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fix',
          episodeContent: content,
          issue: {
            lineNumber: issue.lineNumber,
            location: issue.location,
            problem: issue.problem,
            reference: issue.reference,
            suggestion: issue.suggestion,
          },
        }),
      });
      const data = await res.json();

      setChatMsgs((prev) => {
        const next = [...prev];
        const msg = { ...next[msgIdx], issues: [...(next[msgIdx].issues || [])] };
        msg.issues[issueIdx] = { ...msg.issues[issueIdx], fixing: false, fixedLine: data.fixedLine || '' };
        next[msgIdx] = msg;
        return next;
      });
    } catch {
      setChatMsgs((prev) => {
        const next = [...prev];
        const msg = { ...next[msgIdx], issues: [...(next[msgIdx].issues || [])] };
        msg.issues[issueIdx] = { ...msg.issues[issueIdx], fixing: false };
        next[msgIdx] = msg;
        return next;
      });
    }
  };

  // ── 수정 적용 → 화면 + 파일 + DB + localStorage 동시 저장 ──
  const applyFix = async (msgIdx: number, issueIdx: number) => {
    const issue = chatMsgs[msgIdx]?.issues?.[issueIdx];
    if (!issue?.fixedLine || !issue.lineNumber) return;

    const newLines = [...contentLines];
    newLines[issue.lineNumber - 1] = issue.fixedLine;
    const updatedContent = newLines.join('\n');

    // 1. 화면 반영
    setContent(updatedContent);

    // 2. 이슈 상태를 "적용됨"으로 변경
    setChatMsgs((prev) => {
      const next = [...prev];
      const msg = { ...next[msgIdx], issues: [...(next[msgIdx].issues || [])] };
      msg.issues[issueIdx] = { ...msg.issues[issueIdx], applied: true };
      next[msgIdx] = msg;
      return next;
    });

    // 3. localStorage 저장 (본문집필 페이지와 공유)
    try {
      const saved = JSON.parse(localStorage.getItem('savedEpisodes') || '{}');
      saved[episodeNumber] = updatedContent;
      localStorage.setItem('savedEpisodes', JSON.stringify(saved));
    } catch { /* localStorage 실패 무시 */ }

    // 4. 파일 + DB 자동 저장 (save-episode API 호출)
    try {
      await fetch('/api/save-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber,
          episodeTitle: episodeTitle || `제${episodeNumber}화`,
          content: updatedContent,
        }),
      });
    } catch { /* 저장 실패 시 화면에는 이미 반영됨 */ }
  };

  // ── AI 검수 실행 ──
  const handleCheck = async () => {
    if (!content) { alert('검수할 본문이 없습니다.'); return; }
    setIsChecking(true); setReport(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const response = await fetch('/api/quality-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeNumber, episodeTitle, content, blueprint }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.message || `API 오류 (${response.status})`); }
      const data = await response.json();
      if (data.success && data.report) {
        setReport(data.report);
        if (data.autoGate) setAutoGate(data.autoGate);
        const cacheKey = 'novel_step7_reports';
        const existing = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        existing[episodeNumber] = { ...data.report, autoGate: data.autoGate, timestamp: new Date().toISOString() };
        localStorage.setItem(cacheKey, JSON.stringify(existing));
      } else { throw new Error(data.message || '검수 실패'); }
    } catch (error: any) {
      if (error.name === 'AbortError') alert('시간 초과 (60초)');
      else alert(`검수 실패: ${error.message}`);
    } finally { setIsChecking(false); }
  };

  // ── 유틸 ──
  const getScoreColor = (s: number) => s >= 9 ? 'text-green-400' : s >= 7 ? 'text-blue-400' : s >= 5 ? 'text-yellow-400' : 'text-red-400';
  const getGradeBg = (g: string) => g.includes('A+') ? 'bg-green-500/20 text-green-400 border-green-500/30' : g.includes('A') ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : g.includes('B') ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : g.includes('C') ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';
  const getOverallGrade = (t: number) => t >= 54 ? { grade: 'S', label: '화산귀환급', color: 'text-yellow-300' } : t >= 48 ? { grade: 'A', label: '상업 출판 가능', color: 'text-green-400' } : t >= 40 ? { grade: 'B', label: '수정 후 출판 가능', color: 'text-blue-400' } : t >= 30 ? { grade: 'C', label: '대폭 수정 필요', color: 'text-yellow-400' } : { grade: 'D', label: '재작성 권장', color: 'text-red-400' };
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
          <div className="flex items-center gap-3">
            <button onClick={() => setEpisodeNumber(Math.max(1, episodeNumber - 1))} disabled={episodeNumber <= 1} className="p-2 rounded-lg bg-murim-darker border border-murim-border hover:border-murim-accent disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">제</span>
              <input type="number" value={episodeNumber} onChange={(e) => setEpisodeNumber(Math.max(1, Math.min(300, parseInt(e.target.value) || 1)))} className="w-16 px-2 py-1 text-center bg-murim-darker border border-murim-border rounded-lg text-foreground text-lg font-bold focus:outline-none focus:border-murim-accent" min={1} max={300} />
              <span className="text-sm text-gray-500">화</span>
            </div>
            <button onClick={() => setEpisodeNumber(Math.min(300, episodeNumber + 1))} disabled={episodeNumber >= 300} className="p-2 rounded-lg bg-murim-darker border border-murim-border hover:border-murim-accent disabled:opacity-30 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ━━━ 본문 (행번호 포함) + 검수 버튼 ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 widget-card">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-lg font-bold text-foreground shrink-0">{episodeTitle || `제${episodeNumber}화`}</h3>
            {/* 본문 검색 */}
            <div className="flex items-center gap-1.5 bg-murim-darker rounded-lg px-2 py-1 border border-murim-border flex-1 max-w-sm">
              <Search className="w-4 h-4 text-gray-600 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchEnter(); } }}
                placeholder="본문 검색..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-700"
              />
              {searchTerm && (
                <>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {searchMatches.length > 0 ? `${searchIdx + 1}/${searchMatches.length}` : '0건'}
                  </span>
                  <button onClick={goSearchPrev} disabled={searchMatches.length === 0} className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={goSearchNext} disabled={searchMatches.length === 0} className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={() => { setSearchTerm(''); setSearchIdx(0); }} className="p-0.5 hover:bg-white/10 rounded"><X className="w-3.5 h-3.5 text-gray-500" /></button>
                </>
              )}
            </div>
            <span className="text-sm text-gray-500 shrink-0">{charCount.toLocaleString()}자 · {contentLines.length}행</span>
          </div>

          {content ? (
            <div ref={textContainerRef} className="bg-murim-darker rounded-lg max-h-[600px] overflow-y-auto font-mono text-sm leading-relaxed">
              {contentLines.map((line, i) => {
                const lineNum = i + 1;
                const hasForbidden = forbiddenLineMap.has(lineNum);
                const hasIssue = issueLineSet.has(lineNum);
                const isSearchMatch = searchMatches.includes(lineNum);
                const isCurrentSearch = searchMatches[searchIdx] === lineNum;
                const isMarked = hasForbidden || hasIssue;

                return (
                  <div
                    key={i}
                    id={`step7-line-${lineNum}`}
                    onClick={() => { setChatInput(`${lineNum}행: `); chatInputRef.current?.focus(); }}
                    className={`flex cursor-pointer hover:bg-white/3 transition-colors ${
                      isCurrentSearch ? 'bg-yellow-500/20 border-l-2 border-yellow-400'
                      : hasForbidden ? 'bg-red-500/10 border-l-2 border-red-500'
                      : hasIssue ? 'bg-yellow-500/8 border-l-2 border-yellow-500'
                      : isSearchMatch ? 'bg-yellow-500/8 border-l-2 border-yellow-600'
                      : 'border-l-2 border-transparent'
                    }`}
                  >
                    <span className={`w-10 shrink-0 text-right pr-2 py-0.5 select-none text-[11px] ${
                      isCurrentSearch ? 'text-yellow-300 font-bold'
                      : isMarked ? 'text-red-400 font-bold'
                      : isSearchMatch ? 'text-yellow-500'
                      : 'text-gray-700'
                    }`}>{lineNum}</span>
                    <span className={`flex-1 py-0.5 pr-3 whitespace-pre-wrap break-all font-sans ${
                      isCurrentSearch ? 'text-white'
                      : isMarked ? 'text-gray-200'
                      : isSearchMatch ? 'text-gray-200'
                      : 'text-gray-400'
                    }`}>{line || '\u00A0'}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-murim-darker rounded-lg p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <p className="text-gray-400">이 화의 본문이 아직 없습니다.</p>
              <a href="/dashboard/step6" className="inline-block mt-3 px-4 py-2 bg-murim-accent hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                Step 6에서 본문 작성하기
              </a>
            </div>
          )}
        </div>

        {/* 우측: 검수 실행 카드 */}
        <div className="widget-card flex flex-col items-center justify-center text-center space-y-4">
          <CheckSquare className="w-16 h-16 text-murim-accent" />
          <h3 className="text-lg font-bold text-foreground">AI 품질 검수</h3>
          <p className="text-sm text-gray-500">6가지 기준으로 본문을<br />엄격하게 분석합니다</p>
          <div className="text-xs text-gray-600 space-y-1">
            <p>경영 고증 / 개연성 / 설정 충돌</p>
            <p>캐릭터 일관성 / 문체 / 절단신공</p>
          </div>
          <button onClick={handleCheck} disabled={isChecking || !content} className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${isChecking || !content ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-murim-accent to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-lg'}`}>
            {isChecking ? (<><div className="w-5 h-5 border-2 border-gray-500 border-t-white rounded-full animate-spin" /><span>검수 중...</span></>) : (<><Sparkles className="w-5 h-5" /><span>AI 검수 실행</span></>)}
          </button>
        </div>
      </div>

      {/* ━━━ 빨간펜 지시창 (자동 분석보다 위에 배치) ━━━ */}
      {content && (
        <div className="widget-card">
          <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="text-red-500">✏️</span> 빨간펜 지시창
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            본문 행을 클릭하면 행번호가 자동 입력됩니다. 수정 지시도 가능합니다. (예: &quot;194행 현대어를 무협 용어로 고쳐줘&quot;)
          </p>

          {/* 대화 이력 + 이슈 카드 */}
          {chatMsgs.length > 0 && (
            <div className="bg-murim-darker rounded-lg p-3 mb-3 max-h-80 overflow-y-auto space-y-3">
              {chatMsgs.map((msg, mi) => (
                <div key={mi}>
                  {/* 텍스트 메시지 */}
                  <div className={`text-sm ${msg.role === 'user' ? 'text-murim-accent' : 'text-gray-400'}`}>
                    <span className="font-bold text-xs">{msg.role === 'user' ? '나: ' : 'AI: '}</span>
                    <span className="whitespace-pre-wrap">{msg.text}</span>
                  </div>

                  {/* 이슈 카드 (수정 가능) */}
                  {msg.issues && msg.issues.length > 0 && (
                    <div className="mt-2 space-y-2 ml-4">
                      {msg.issues.map((iss, ii) => (
                        <div key={iss.id} className={`rounded border p-2.5 text-xs ${
                          iss.applied ? 'bg-green-500/5 border-green-500/20 opacity-60'
                          : iss.severity === 'error' ? 'bg-red-500/8 border-red-500/30'
                          : 'bg-yellow-500/8 border-yellow-500/30'
                        }`}>
                          {/* 행번호 + 문제 */}
                          <div className="flex items-center gap-2 mb-1">
                            {iss.lineNumber > 0 && (
                              <button onClick={() => scrollToLine(iss.lineNumber)} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition-colors">
                                {iss.lineNumber}행
                              </button>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              iss.severity === 'error' ? 'bg-red-500 text-black' : 'bg-yellow-500 text-black'
                            }`}>{iss.severity === 'error' ? '오류' : '주의'}</span>
                            <span className="flex-1">{iss.problem}</span>
                            {iss.applied && <span className="text-green-400 font-bold">✓ 적용됨</span>}
                          </div>

                          {/* 제안 */}
                          {iss.suggestion && !iss.applied && (
                            <div className="text-murim-accent mt-1">💡 {iss.suggestion}</div>
                          )}

                          {/* 수정 결과 (before/after) */}
                          {iss.fixedLine && !iss.applied && (
                            <div className="mt-2 space-y-1">
                              <div className="text-[10px] text-gray-600">원본:</div>
                              <div className="bg-black/30 rounded px-2 py-1 text-red-300 line-through">{contentLines[iss.lineNumber - 1] || ''}</div>
                              <div className="text-[10px] text-gray-600">수정:</div>
                              <div className="bg-black/30 rounded px-2 py-1 text-green-300">{iss.fixedLine}</div>
                            </div>
                          )}

                          {/* 버튼 */}
                          {!iss.applied && (
                            <div className="flex gap-1.5 mt-2">
                              {!iss.fixedLine ? (
                                <button
                                  onClick={() => requestFix(mi, ii)}
                                  disabled={iss.fixing}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold disabled:opacity-50"
                                >
                                  {iss.fixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                  {iss.fixing ? '수정중...' : 'AI 수정'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => applyFix(mi, ii)}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white hover:bg-green-500 font-bold"
                                >
                                  <Check className="w-3 h-3" /> 적용
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* 입력 */}
          <div className="flex items-center gap-2">
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInstruction(); } }}
              placeholder='본문 행 클릭 또는 직접 입력 (예: "194행 M&A 고쳐줘")'
              className="flex-1 px-4 py-2.5 bg-murim-darker border border-murim-border rounded-lg text-sm outline-none focus:border-murim-accent placeholder:text-gray-700 transition-colors"
              disabled={chatLoading}
            />
            <button
              onClick={sendInstruction}
              disabled={chatLoading || !chatInput.trim()}
              className="shrink-0 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {chatLoading ? '분석중...' : '지시'}
            </button>
          </div>
        </div>
      )}

      {/* ━━━ 자동 텍스트 분석 (금지문구에 행번호 + 클릭 스크롤) ━━━ */}
      {autoGate && (
        <div className="widget-card animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>📊</span> 자동 텍스트 분석 (15개 기준)
            </h3>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-black ${autoGate.grade === 'S' ? 'text-yellow-300' : autoGate.grade === 'A' ? 'text-green-400' : autoGate.grade === 'B' ? 'text-blue-400' : autoGate.grade === 'C' ? 'text-yellow-400' : 'text-red-400'}`}>{autoGate.grade}</span>
              <span className="text-sm text-gray-400">{autoGate.score}/{autoGate.maxScore} ({autoGate.percentage.toFixed(0)}%)</span>
            </div>
          </div>
          <div className="w-full h-2 bg-murim-darker rounded-full mb-4 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-700" style={{ width: `${autoGate.percentage}%` }} />
          </div>

          {/* 금지 문구 경고 — 행번호 표시 + 클릭 스크롤 */}
          {autoGate.forbiddenHits && autoGate.forbiddenHits.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
              <p className="text-sm font-bold text-red-400 mb-2">금지 문구 발견!</p>
              <div className="space-y-1.5">
                {(autoGate.forbiddenHits as string[]).map((hit: string, i: number) => {
                  // 이 금지어가 몇 행에 있는지 찾기
                  const hitLines: number[] = [];
                  contentLines.forEach((line: string, li: number) => {
                    if (line.includes(hit)) hitLines.push(li + 1);
                  });
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-red-300 font-bold">&quot;{hit}&quot;</span>
                      <span className="text-gray-600">→</span>
                      {hitLines.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {hitLines.map((ln) => (
                            <button key={ln} onClick={() => scrollToLine(ln)} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 font-bold transition-colors">
                              {ln}행
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-600">행 위치 미확인</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {autoGate.warnings && autoGate.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-yellow-400 mb-1">미통과 항목 ({autoGate.warnings.length}개)</p>
              {autoGate.warnings.slice(0, 8).map((w: string, i: number) => (
                <p key={i} className="text-xs text-gray-400">• {w}</p>
              ))}
              {autoGate.warnings.length > 8 && <p className="text-xs text-gray-600">... 외 {autoGate.warnings.length - 8}개</p>}
            </div>
          )}
          {autoGate.warnings && autoGate.warnings.length === 0 && <p className="text-sm text-green-400">모든 자동 검사 항목 통과!</p>}
        </div>
      )}

      {/* ━━━ AI 검수 결과 ━━━ */}
      {report && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="widget-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-5xl font-black ${getOverallGrade(report.totalScore).color}`}>{getOverallGrade(report.totalScore).grade}</div>
                  <div className="text-xs text-gray-500 mt-1">{getOverallGrade(report.totalScore).label}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{report.totalScore}<span className="text-lg text-gray-500">/60</span></div>
                  <div className="w-48 h-3 bg-murim-darker rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-1000" style={{ width: `${(report.totalScore / 60) * 100}%` }} />
                  </div>
                </div>
              </div>
              <div className="text-right max-w-md">
                <p className="text-sm text-gray-300">{report.overallComment}</p>
                {report.bestPart && <p className="text-xs text-green-400 mt-2 flex items-center gap-1 justify-end"><Trophy className="w-3 h-3" /> {report.bestPart}</p>}
                {report.worstPart && <p className="text-xs text-red-400 mt-1 flex items-center gap-1 justify-end"><XCircle className="w-3 h-3" /> {report.worstPart}</p>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.items.map((item) => {
              const meta = CATEGORY_META[item.category] || { icon: '📋', color: 'gray' };
              return (
                <div key={item.category} className="widget-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><span className="text-xl">{meta.icon}</span><h4 className="font-bold text-foreground text-sm">{item.category}</h4></div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-black ${getScoreColor(item.score)}`}>{item.score}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${getGradeBg(item.grade)}`}>{item.grade}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-murim-darker rounded-full mb-3 overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${item.score >= 8 ? 'bg-green-500' : item.score >= 6 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${item.score * 10}%` }} /></div>
                  {item.issues.length > 0 && <div className="mb-2"><p className="text-xs font-semibold text-red-400 mb-1">문제점</p><ul className="space-y-1">{item.issues.map((issue, i) => <li key={i} className="text-xs text-gray-400 flex items-start gap-1"><span className="text-red-500 mt-0.5">•</span>{issue}</li>)}</ul></div>}
                  {item.suggestions.length > 0 && <div><p className="text-xs font-semibold text-blue-400 mb-1">개선 제안</p><ul className="space-y-1">{item.suggestions.map((sug, i) => <li key={i} className="text-xs text-gray-400 flex items-start gap-1"><span className="text-blue-500 mt-0.5">→</span>{sug}</li>)}</ul></div>}
                  {item.issues.length === 0 && item.suggestions.length === 0 && <p className="text-xs text-green-500">이상 없음</p>}
                </div>
              );
            })}
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckSquare className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-400">검수 완료 → 에피소드 확정</p>
                <p className="text-sm text-gray-400 mt-1">
                  검수가 만족스러우면 아래 버튼으로 확정하세요.
                  AI가 본문을 분석하여 <strong>기억 카드 + 대시보드</strong>를 자동 업데이트합니다.
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={async () => {
                      if (!content || content.length < 100) { alert('본문이 없거나 너무 짧습니다.'); return; }
                      if (!confirm(`제${episodeNumber}화를 확정하시겠습니까?\n\nAI가 본문을 분석하여 기억 카드와 대시보드를 자동 업데이트합니다.`)) return;
                      setIsChecking(true);
                      try {
                        const res = await fetch('/api/confirm-episode', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ episodeNumber }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          alert(`✅ 제${episodeNumber}화 확정 완료!\n기억 카드 + 대시보드가 업데이트되었습니다.`);
                        } else {
                          alert(`❌ 확정 실패: ${data.error}`);
                        }
                      } catch (err: any) {
                        alert(`❌ 오류: ${err.message}`);
                      } finally {
                        setIsChecking(false);
                      }
                    }}
                    disabled={isChecking || !content}
                    className="px-5 py-2.5 bg-murim-accent hover:bg-murim-accent/80 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isChecking ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />AI 분석 중...</>
                    ) : (
                      <><Check className="w-4 h-4" />제{episodeNumber}화 확정</>
                    )}
                  </button>
                  <a href="/dashboard/memory" className="px-4 py-2 bg-murim-dark hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                    현재 상태 확인
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
