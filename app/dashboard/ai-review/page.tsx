'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Send, X, Check, RotateCcw } from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [AI 빨간펜] — 바이블 기반 빨간펜 교정 + 대화 지시
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 좌: 에피소드 본문 (행번호 + 빨간 표시)
 * 우: 이슈 목록 + 대화 지시창
 */

interface Issue {
  id: number;
  severity: 'error' | 'warning' | 'info';
  category: string;
  lineNumber: number;
  location: string;
  problem: string;
  reference: string;
  suggestion: string;
  fixedLine?: string;
}

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}

const SEV = {
  error:   { label: '오류', dot: 'bg-red-500',    border: 'border-red-500/40', bg: 'bg-red-500/8',    text: 'text-red-400' },
  warning: { label: '주의', dot: 'bg-yellow-500',  border: 'border-yellow-500/40', bg: 'bg-yellow-500/8', text: 'text-yellow-400' },
  info:    { label: '제안', dot: 'bg-blue-500',    border: 'border-blue-500/40', bg: 'bg-blue-500/8',   text: 'text-blue-400' },
};

export default function AIRedPenPage() {
  // ── 에피소드 ──
  const [epNum, setEpNum] = useState(15);
  const [content, setContent] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [loadingEp, setLoadingEp] = useState(false);

  // ── 스캔 ──
  const [scanning, setScanning] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [nextId, setNextId] = useState(100);

  // ── 이슈 상태 ──
  const [fixingId, setFixingId] = useState<number | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);

  // ── 대화 지시 ──
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // ── 선택된 행 (클릭 시 지시창에 행번호 자동 입력) ──
  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  const textAreaRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ── 에피소드 로드 ──
  const loadEp = useCallback(async () => {
    setLoadingEp(true);
    setIssues([]);
    setAppliedIds(new Set());
    setDismissedIds(new Set());
    setChatMsgs([]);
    setSelectedIssueId(null);
    setSelectedLine(null);
    try {
      const res = await fetch(`/api/load-episode?episode=${epNum}`);
      const data = await res.json();
      if (data.content) {
        setContent(data.content);
      } else {
        setContent('');
        setChatMsgs([{ role: 'ai', text: `제${epNum}화를 찾을 수 없습니다.` }]);
      }
    } catch (err: any) {
      setChatMsgs([{ role: 'ai', text: `로드 실패: ${err.message}` }]);
    }
    setLoadingEp(false);
  }, [epNum]);

  useEffect(() => { loadEp(); }, [loadEp]);
  useEffect(() => { setLines(content.split('\n')); }, [content]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);

  // ── 이슈가 있는 행번호 Set ──
  const issueLineMap = new Map<number, Issue[]>();
  issues.forEach((iss) => {
    if (dismissedIds.has(iss.id) || appliedIds.has(iss.id)) return;
    const existing = issueLineMap.get(iss.lineNumber) || [];
    existing.push(iss);
    issueLineMap.set(iss.lineNumber, existing);
  });

  const activeIssues = issues.filter((i) => !dismissedIds.has(i.id) && !appliedIds.has(i.id));

  // ── AI 스캔 ──
  const runScan = async () => {
    if (!content || scanning) return;
    setScanning(true);
    setIssues([]);
    setAppliedIds(new Set());
    setDismissedIds(new Set());
    setChatMsgs((prev) => [...prev, { role: 'ai', text: '스캔 시작... 1→키워드 추출 2→바이블 검색 3→빨간펜 검토' }]);

    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', episodeNumber: epNum, episodeContent: content }),
      });
      const data = await res.json();
      if (data.error) {
        setChatMsgs((prev) => [...prev, { role: 'ai', text: `오류: ${data.error}` }]);
      } else {
        const newIssues: Issue[] = (data.review?.issues || []).map((i: any, idx: number) => ({
          ...i,
          id: i.id || idx + 1,
          lineNumber: i.lineNumber || 0,
        }));
        setIssues(newIssues);
        const errCnt = newIssues.filter((i) => i.severity === 'error').length;
        const warnCnt = newIssues.filter((i) => i.severity === 'warning').length;
        const infoCnt = newIssues.filter((i) => i.severity === 'info').length;
        setChatMsgs((prev) => [
          ...prev,
          { role: 'ai', text: `스캔 완료 — 오류 ${errCnt}건, 주의 ${warnCnt}건, 제안 ${infoCnt}건` },
        ]);
        if (errCnt > 0) {
          const firstErr = newIssues.find((i) => i.severity === 'error');
          if (firstErr) scrollToLine(firstErr.lineNumber);
        }
      }
    } catch (err: any) {
      setChatMsgs((prev) => [...prev, { role: 'ai', text: `스캔 실패: ${err.message}` }]);
    }
    setScanning(false);
  };

  // ── 수정 요청 ──
  const requestFix = async (issue: Issue) => {
    setFixingId(issue.id);
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
      if (data.fixedLine) {
        setIssues((prev) =>
          prev.map((i) => (i.id === issue.id ? { ...i, fixedLine: data.fixedLine } : i))
        );
      }
    } catch (err: any) {
      setChatMsgs((prev) => [...prev, { role: 'ai', text: `수정 실패: ${err.message}` }]);
    }
    setFixingId(null);
  };

  // ── 수정 적용 (본문 반영) ──
  const applyFix = (issue: Issue) => {
    if (!issue.fixedLine) return;
    const newLines = [...lines];
    if (issue.lineNumber >= 1 && issue.lineNumber <= newLines.length) {
      newLines[issue.lineNumber - 1] = issue.fixedLine;
      setContent(newLines.join('\n'));
      setAppliedIds((prev) => new Set([...prev, issue.id]));
      setChatMsgs((prev) => [...prev, { role: 'ai', text: `${issue.lineNumber}행 수정 적용됨` }]);
    }
  };

  // ── 무시 ──
  const dismiss = (id: number) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  // ── 대화 지시 보내기 ──
  const sendInstruction = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatMsgs((prev) => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'instruct',
          instruction: msg,
          episodeNumber: epNum,
          episodeContent: content,
        }),
      });
      const data = await res.json();
      if (data.message) {
        setChatMsgs((prev) => [...prev, { role: 'ai', text: data.message }]);
      }
      if (data.issues && data.issues.length > 0) {
        const newIssues: Issue[] = data.issues.map((i: any, idx: number) => ({
          ...i,
          id: nextId + idx,
          lineNumber: i.lineNumber || 0,
        }));
        setNextId((prev) => prev + data.issues.length);
        setIssues((prev) => [...prev, ...newIssues]);
        if (newIssues[0]?.lineNumber) scrollToLine(newIssues[0].lineNumber);
      }
    } catch (err: any) {
      setChatMsgs((prev) => [...prev, { role: 'ai', text: `오류: ${err.message}` }]);
    }
    setChatLoading(false);
  };

  // ── 행 클릭 → 지시창에 행번호 자동 입력 ──
  const handleLineClick = (lineNum: number) => {
    setSelectedLine(lineNum);
    setChatInput(`${lineNum}행: `);
    chatInputRef.current?.focus();
  };

  // ── 이슈 클릭 → 해당 행으로 스크롤 ──
  const scrollToLine = (lineNum: number) => {
    setSelectedLine(lineNum);
    const el = document.getElementById(`redpen-line-${lineNum}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ── 저장 ──
  const saveEpisode = async () => {
    try {
      const res = await fetch('/api/save-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeNumber: epNum, content, title: `제${epNum}화` }),
      });
      const data = await res.json();
      setChatMsgs((prev) => [
        ...prev,
        { role: 'ai', text: data.success ? `제${epNum}화 저장 완료 (파일+DB)` : `저장 실패: ${data.error}` },
      ]);
    } catch (err: any) {
      setChatMsgs((prev) => [...prev, { role: 'ai', text: `저장 오류: ${err.message}` }]);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 렌더링
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="h-screen flex flex-col bg-murim-darker text-foreground">
      {/* ── 헤더 ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-murim-dark border-b border-murim-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-red-500 font-bold text-lg">✏️ 빨간펜</span>
          <div className="flex items-center gap-1 bg-murim-darker rounded px-2 py-1 border border-murim-border">
            <span className="text-xs text-gray-500">제</span>
            <input
              type="number"
              min={1}
              max={300}
              value={epNum}
              onChange={(e) => setEpNum(Number(e.target.value))}
              className="w-12 bg-transparent text-center text-sm font-bold outline-none"
            />
            <span className="text-xs text-gray-500">화</span>
            <button onClick={loadEp} disabled={loadingEp} className="ml-1 text-xs text-murim-accent hover:underline">
              {loadingEp ? '...' : '열기'}
            </button>
          </div>
          {content && <span className="text-[10px] text-gray-600">{content.length.toLocaleString()}자 · {lines.length}행</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* 스캔 */}
          <button
            onClick={runScan}
            disabled={scanning || !content}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
              scanning ? 'bg-gray-700 text-gray-400' : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {scanning ? (
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />스캔중...</span>
            ) : (
              '🔍 스캔'
            )}
          </button>

          {/* 저장 */}
          {appliedIds.size > 0 && (
            <button onClick={saveEpisode} className="px-3 py-1.5 rounded text-xs font-bold bg-green-600 hover:bg-green-500 text-white">
              💾 저장 ({appliedIds.size}건)
            </button>
          )}

          {/* 이슈 카운트 */}
          {activeIssues.length > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-red-400">{activeIssues.filter((i) => i.severity === 'error').length} 오류</span>
              <span className="text-yellow-400">{activeIssues.filter((i) => i.severity === 'warning').length} 주의</span>
              <span className="text-blue-400">{activeIssues.filter((i) => i.severity === 'info').length} 제안</span>
            </div>
          )}
        </div>
      </header>

      {/* ── 메인 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ━━ 좌: 본문 ━━ */}
        <div ref={textAreaRef} className="flex-1 overflow-y-auto font-mono text-sm leading-relaxed">
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const hasIssue = issueLineMap.has(lineNum);
            const isSelected = selectedLine === lineNum;
            const issuesForLine = issueLineMap.get(lineNum) || [];
            const maxSev = issuesForLine.reduce((max, iss) => {
              const order = { error: 3, warning: 2, info: 1 };
              return order[iss.severity] > order[max] ? iss.severity : max;
            }, 'info' as 'error' | 'warning' | 'info');

            return (
              <div
                key={i}
                id={`redpen-line-${lineNum}`}
                onClick={() => handleLineClick(lineNum)}
                className={`flex cursor-pointer hover:bg-white/3 transition-colors ${
                  hasIssue
                    ? maxSev === 'error'
                      ? 'bg-red-500/8 border-l-2 border-red-500'
                      : maxSev === 'warning'
                      ? 'bg-yellow-500/5 border-l-2 border-yellow-500'
                      : 'bg-blue-500/5 border-l-2 border-blue-500'
                    : isSelected
                    ? 'bg-white/5 border-l-2 border-murim-accent'
                    : 'border-l-2 border-transparent'
                }`}
              >
                {/* 행번호 */}
                <span className={`w-12 shrink-0 text-right pr-3 py-0.5 select-none text-[11px] ${
                  hasIssue ? (maxSev === 'error' ? 'text-red-400' : maxSev === 'warning' ? 'text-yellow-400' : 'text-blue-400') : 'text-gray-700'
                }`}>
                  {lineNum}
                </span>
                {/* 본문 */}
                <span className={`flex-1 py-0.5 pr-4 whitespace-pre-wrap break-all ${
                  hasIssue ? 'text-gray-200' : 'text-gray-400'
                }`}>
                  {line || '\u00A0'}
                </span>
                {/* 이슈 뱃지 */}
                {hasIssue && (
                  <span className="shrink-0 flex items-center gap-1 pr-2">
                    {issuesForLine.map((iss) => (
                      <span
                        key={iss.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedIssueId(iss.id); scrollToLine(iss.lineNumber); }}
                        className={`w-2 h-2 rounded-full ${SEV[iss.severity].dot}`}
                        title={iss.problem}
                      />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
          {!content && !loadingEp && (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              에피소드를 불러오세요
            </div>
          )}
        </div>

        {/* ━━ 우: 이슈 + 대화 ━━ */}
        <div className="w-80 lg:w-96 flex flex-col border-l border-murim-border bg-murim-dark shrink-0">

          {/* 이슈 목록 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {activeIssues.length === 0 && !scanning && (
              <div className="text-center py-8 text-gray-600 text-xs">
                {issues.length > 0
                  ? '모든 이슈 처리 완료'
                  : '스캔을 실행하거나 아래에서 지시하세요'}
              </div>
            )}

            {activeIssues.map((issue) => {
              const s = SEV[issue.severity];
              const isOpen = selectedIssueId === issue.id;

              return (
                <div
                  key={issue.id}
                  className={`rounded border ${s.border} ${s.bg} overflow-hidden transition-all`}
                >
                  {/* 요약 행 */}
                  <button
                    onClick={() => { setSelectedIssueId(isOpen ? null : issue.id); scrollToLine(issue.lineNumber); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                    <span className="text-[10px] text-gray-500 shrink-0 w-8">{issue.lineNumber}행</span>
                    <span className="text-xs truncate flex-1">{issue.problem}</span>
                  </button>

                  {/* 상세 (펼침) */}
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 border-t border-white/5">
                      <div className="mt-2">
                        <div className="text-[9px] text-gray-600 mb-0.5">본문:</div>
                        <div className="text-xs text-red-300 bg-black/30 rounded px-2 py-1 break-all">{issue.location}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-600 mb-0.5">기준:</div>
                        <div className="text-xs text-green-300 bg-black/30 rounded px-2 py-1 break-all">{issue.reference}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-600 mb-0.5">제안:</div>
                        <div className="text-xs text-murim-accent bg-black/30 rounded px-2 py-1 break-all">{issue.suggestion}</div>
                      </div>

                      {/* 수정 결과 */}
                      {issue.fixedLine && (
                        <div className="p-2 rounded bg-green-500/10 border border-green-500/30">
                          <div className="text-[9px] text-green-400 mb-0.5">AI 수정 결과:</div>
                          <div className="text-xs text-green-300 break-all">{issue.fixedLine}</div>
                        </div>
                      )}

                      {/* 버튼 */}
                      <div className="flex gap-1.5 pt-1">
                        {!issue.fixedLine ? (
                          <button
                            onClick={() => requestFix(issue)}
                            disabled={fixingId === issue.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                          >
                            {fixingId === issue.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            {fixingId === issue.id ? '수정중...' : 'AI 수정'}
                          </button>
                        ) : (
                          <button
                            onClick={() => applyFix(issue)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-green-600 text-white hover:bg-green-500"
                          >
                            <Check className="w-3 h-3" /> 적용
                          </button>
                        )}
                        <button
                          onClick={() => dismiss(issue.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-500 hover:text-gray-300 hover:bg-white/5"
                        >
                          <X className="w-3 h-3" /> 무시
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ━━ 대화 지시창 ━━ */}
          <div className="border-t border-murim-border">
            {/* 대화 이력 (최근 5개) */}
            <div className="max-h-32 overflow-y-auto px-3 py-2 space-y-1">
              {chatMsgs.slice(-8).map((msg, i) => (
                <div key={i} className={`text-[11px] ${msg.role === 'user' ? 'text-murim-accent' : 'text-gray-500'}`}>
                  <span className="font-bold">{msg.role === 'user' ? '나: ' : 'AI: '}</span>
                  {msg.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* 입력 */}
            <div className="flex items-center gap-2 px-3 py-2 bg-murim-darker border-t border-murim-border">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInstruction(); } }}
                placeholder='지시 입력 (예: "194행 현대어 고쳐줘")'
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-700"
                disabled={chatLoading}
              />
              <button
                onClick={sendInstruction}
                disabled={chatLoading || !chatInput.trim()}
                className="shrink-0 p-1.5 rounded bg-murim-accent/20 text-murim-accent hover:bg-murim-accent/30 disabled:opacity-30"
              >
                {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
