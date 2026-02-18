'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Save, RotateCcw, Eye, Edit3, Search, BookOpen, Shield, Users, Map, AlertTriangle, ChevronUp, ChevronDown, X, Compass, Target, Palette } from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [전략 문서] - 핵심 참조 문서 뷰어/에디터
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 전략 회의 결과물을 작업자가 확인하고 수정할 수 있는 페이지입니다.
 * - 소설_진행_마스터.md: 현재 상태 + 다음 화 주의사항
 * - master_story_bible.md: 장기 로드맵
 * - 집필_규칙.md: EP 규칙 + 3인격 엔진
 * - 캐릭터_인명록.md: 핵심 캐릭터 상세
 * - 참조자료_색인.md: 파일 가이드 (읽기 전용)
 * - 소설체/전투 규칙: 스타일 가이드 (읽기 전용)
 */

// ── 탭 아이콘 매핑 ──
const TAB_ICONS: Record<string, React.ElementType> = {
  'master': Map,
  'story-bible': BookOpen,
  'rules': Shield,
  'ref-index': FileText,
  'novel-writing-rules': Edit3,
  'combat-rules': AlertTriangle,
  'theme': Compass,
  'competitive': Target,
  'reader': Palette,
  'style-guide': Edit3,
};

// ── 탭 색상 매핑 ──
const TAB_COLORS: Record<string, string> = {
  'master': 'text-yellow-400',
  'story-bible': 'text-blue-400',
  'rules': 'text-red-400',
  'ref-index': 'text-gray-400',
  'novel-writing-rules': 'text-purple-400',
  'combat-rules': 'text-orange-400',
  'theme': 'text-cyan-400',
  'competitive': 'text-pink-400',
  'reader': 'text-emerald-400',
  'style-guide': 'text-violet-400',
};

interface FileInfo {
  key: string;
  label: string;
  description: string;
  editable: boolean;
  exists: boolean;
  lineCount: number;
  charCount: number;
}

export default function StrategyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">전략 문서 불러오는 중...</div>}>
      <StrategyPageInner />
    </Suspense>
  );
}

function StrategyPageInner() {
  const searchParams = useSearchParams();

  // ── 상태 ──
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'master');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);   // 현재 활성 검색 결과 인덱스 (0부터)
  const [searchOpen, setSearchOpen] = useState(false);          // 검색 바 열림/닫힘
  const [searchMode, setSearchMode] = useState<'highlight' | 'filter'>('filter'); // 검색 모드: 전체+하이라이트 vs 필터(해당 줄만)
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);              // 보기 모드 본문 영역 참조
  const searchInputRef = useRef<HTMLInputElement>(null);        // 검색 입력창 포커스용

  // ── URL 파라미터 변경 시 탭 전환 ──
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // ── 파일 목록 로드 ──
  useEffect(() => {
    loadFileList();
  }, []);

  // ── 탭 변경 시 파일 내용 로드 + 검색 초기화 ──
  useEffect(() => {
    if (activeTab) {
      loadFileContent(activeTab);
      setSearchText('');         // 탭마다 검색어 초기화
      setCurrentMatchIdx(0);
    }
  }, [activeTab]);

  // ── 검색어 변경 시 인덱스 리셋 ──
  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [searchText]);

  // ── 보기 모드: 현재 매치로 스크롤 이동 ──
  useEffect(() => {
    if (!searchText || isEditing) return;
    // DOM 업데이트 후 실행 (렌더링 완료 대기)
    const timer = setTimeout(() => {
      if (!contentRef.current) return;
      const marks = contentRef.current.querySelectorAll('mark[data-match-idx]');
      if (marks.length === 0) return;
      // 모든 마크 기본 스타일로 리셋
      marks.forEach(m => {
        (m as HTMLElement).className = 'bg-yellow-500/40 text-white px-0.5 rounded';
      });
      // 현재 활성 매치 강조 (주황색)
      const activeIdx = Math.min(currentMatchIdx, marks.length - 1);
      const activeMark = marks[activeIdx] as HTMLElement;
      if (activeMark) {
        activeMark.className = 'bg-orange-500 text-white px-0.5 rounded ring-2 ring-orange-400';
        activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [currentMatchIdx, searchText, content, isEditing]);

  // ── 편집 모드: 검색 매치 위치로 커서 이동 ──
  const jumpToMatchInEditor = useCallback((matchIdx: number) => {
    if (!editorRef.current || !searchText) return;
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = regex.exec(content)) !== null) {
      if (count === matchIdx) {
        editorRef.current.focus();
        editorRef.current.setSelectionRange(match.index, match.index + match[0].length);
        // 스크롤 위치 계산 (대략적: 한 줄 약 80자, 줄 높이 약 20px)
        const textBefore = content.substring(0, match.index);
        const lineNum = textBefore.split('\n').length;
        const scrollTop = Math.max(0, lineNum * 20 - 200);
        editorRef.current.scrollTop = scrollTop;
        return;
      }
      count++;
    }
  }, [searchText, content]);

  // ── 편집 모드에서 매치 인덱스 변경 시 커서 이동 ──
  useEffect(() => {
    if (isEditing && searchText) {
      jumpToMatchInEditor(currentMatchIdx);
    }
  }, [currentMatchIdx, isEditing]);

  // ── 검색 매치 카운트 (다음/이전 이동에 필요하므로 여기서 먼저 계산) ──
  const searchCount = searchText
    ? (content.match(new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length
    : 0;

  // ── 다음/이전 검색 결과 이동 ──
  const goNextMatch = useCallback(() => {
    if (searchCount <= 0) return;
    setCurrentMatchIdx(prev => (prev + 1) % searchCount);
  }, [searchCount]);

  const goPrevMatch = useCallback(() => {
    if (searchCount <= 0) return;
    setCurrentMatchIdx(prev => (prev - 1 + searchCount) % searchCount);
  }, [searchCount]);

  const loadFileList = async () => {
    try {
      const res = await fetch('/api/strategy-files');
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (e) {
      console.error('파일 목록 로드 실패:', e);
    }
  };

  const loadFileContent = async (fileKey: string) => {
    setIsLoading(true);
    setIsEditing(false);
    setSaveMessage('');
    try {
      const res = await fetch(`/api/strategy-files?file=${fileKey}`);
      const data = await res.json();
      if (data.success) {
        setContent(data.file.content);
        setOriginalContent(data.file.content);
        setFileInfo(data.file);
      } else {
        setContent(`⚠️ ${data.message}`);
        setFileInfo(null);
      }
    } catch (e) {
      setContent('⚠️ 파일 로드 실패');
      setFileInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  // ── 파일 저장 ──
  const handleSave = async () => {
    if (!fileInfo?.editable) return;
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/strategy-files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: activeTab, content }),
      });
      const data = await res.json();
      if (data.success) {
        setOriginalContent(content);
        setSaveMessage(`✅ 저장 완료 (${data.lineCount}줄, ${data.charCount.toLocaleString()}자)`);
        setIsEditing(false);
        loadFileList(); // 목록 갱신
      } else {
        setSaveMessage(`❌ ${data.message}`);
      }
    } catch (e: any) {
      setSaveMessage(`❌ 저장 실패: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 변경 취소 ──
  const handleReset = () => {
    if (content !== originalContent && !confirm('수정한 내용을 되돌리시겠습니까?')) return;
    setContent(originalContent);
    setIsEditing(false);
    setSaveMessage('');
  };

  // ── 변경 여부 ──
  const hasChanges = content !== originalContent;

  // ── 필터 모드: 검색어가 포함된 줄만 추출 (전후 1줄 컨텍스트 포함) ──
  const getFilteredLines = useCallback(() => {
    if (!searchText || !content) return [];
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const lines = content.split('\n');
    const matchedLineNums = new Set<number>();

    // 매칭 줄 + 전후 1줄씩 컨텍스트 포함
    lines.forEach((line, idx) => {
      if (regex.test(line)) {
        if (idx > 0) matchedLineNums.add(idx - 1);  // 이전 줄
        matchedLineNums.add(idx);                     // 매칭 줄
        if (idx < lines.length - 1) matchedLineNums.add(idx + 1); // 다음 줄
      }
    });

    // 연속된 줄끼리 그룹으로 묶기 (섹션 구분용)
    const sorted = Array.from(matchedLineNums).sort((a, b) => a - b);
    const groups: { lineNum: number; text: string; isMatch: boolean }[][] = [];
    let currentGroup: { lineNum: number; text: string; isMatch: boolean }[] = [];

    sorted.forEach((num, i) => {
      const isMatch = regex.test(lines[num]);
      if (i > 0 && num - sorted[i - 1] > 2) {
        // 2줄 이상 떨어지면 새 그룹
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push({ lineNum: num + 1, text: lines[num], isMatch });
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    return groups;
  }, [searchText, content]);

  // ── 필터 결과에서 특정 줄 직접 수정 (줄 번호 기준으로 content 업데이트) ──
  const updateLineContent = useCallback((lineNum: number, newText: string) => {
    const lines = content.split('\n');
    if (lineNum - 1 < lines.length) {
      lines[lineNum - 1] = newText;
      setContent(lines.join('\n'));
    }
  }, [content]);

  // ── 마크다운 렌더링 (테이블·인용문·섹션 구분 지원) ──
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const htmlParts: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // ── 코드 블럭 (``` ... ```) ──
      if (line.trim().startsWith('```')) {
        const codeLines: string[] = [];
        i++; // ``` 여는 줄 건너뛰기
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
          i++;
        }
        i++; // ``` 닫는 줄 건너뛰기
        htmlParts.push(`<pre class="bg-murim-darker border border-murim-border rounded-lg p-3 my-3 text-sm text-green-400 overflow-x-auto">${codeLines.join('\n')}</pre>`);
        continue;
      }

      // ── 테이블 (| ... | 줄이 연속되면 테이블로 렌더링) ──
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        // 테이블 HTML 생성
        let tableHtml = '<div class="overflow-x-auto my-3"><table class="w-full text-sm border-collapse">';
        tableLines.forEach((tl, ti) => {
          // 구분선 줄 (|---|---|) 건너뛰기
          if (/^\|[\s\-:]+\|$/.test(tl.trim().replace(/\|[\s\-:]+/g, '|---'))) return;
          const cells = tl.split('|').slice(1, -1); // 앞뒤 빈 문자열 제거
          const isHeader = ti === 0;
          const tag = isHeader ? 'th' : 'td';
          const headerClass = isHeader
            ? 'bg-murim-dark text-murim-gold font-bold text-left px-3 py-2 border border-murim-border'
            : 'px-3 py-2 border border-murim-border/50 text-gray-300';
          tableHtml += '<tr>';
          cells.forEach(cell => {
            let cellContent = cell.trim()
              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
              .replace(/⭐/g, '⭐');
            tableHtml += `<${tag} class="${headerClass}">${cellContent}</${tag}>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</table></div>';
        htmlParts.push(tableHtml);
        continue;
      }

      // ── 인용문 (> ...) ──
      if (line.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
          i++;
        }
        const quoteContent = quoteLines
          .map(ql => ql.replace(/\*\*(.+?)\*\*/g, '<strong class="text-yellow-300">$1</strong>'))
          .join('<br/>');
        htmlParts.push(`<blockquote class="border-l-4 border-blue-500/50 bg-blue-500/5 rounded-r-lg pl-4 pr-3 py-2 my-3 text-sm text-blue-200 leading-relaxed">${quoteContent}</blockquote>`);
        continue;
      }

      // ── 구분선 (---) ──
      if (line.trim() === '---') {
        htmlParts.push('<hr class="border-murim-border my-5"/>');
        i++;
        continue;
      }

      // ── 제목 ──
      if (line.startsWith('### ')) {
        const titleText = line.slice(4).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        htmlParts.push(`<h3 class="text-lg font-bold text-murim-gold mt-5 mb-2">${titleText}</h3>`);
        i++; continue;
      }
      if (line.startsWith('## ')) {
        const titleText = line.slice(3).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        htmlParts.push(`<h2 class="text-xl font-bold text-blue-400 mt-6 mb-2 border-b border-murim-border pb-2">${titleText}</h2>`);
        i++; continue;
      }
      if (line.startsWith('# ')) {
        const titleText = line.slice(2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        htmlParts.push(`<h1 class="text-2xl font-bold text-white mt-7 mb-3">${titleText}</h1>`);
        i++; continue;
      }

      // ── 리스트 (- ...) ──
      if (line.startsWith('- ')) {
        const listItems: string[] = [];
        while (i < lines.length && lines[i].startsWith('- ')) {
          const itemText = lines[i].slice(2)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
            .replace(/`([^`]+)`/g, '<code class="bg-murim-darker px-1 py-0.5 rounded text-green-400 text-xs">$1</code>');
          listItems.push(`<li class="text-gray-300 mb-1">${itemText}</li>`);
          i++;
        }
        htmlParts.push(`<ul class="list-disc ml-5 my-2 space-y-0.5">${listItems.join('')}</ul>`);
        continue;
      }

      // ── 빈 줄 ──
      if (line.trim() === '') {
        htmlParts.push('<div class="h-2"></div>');
        i++; continue;
      }

      // ── 일반 텍스트 ──
      let processed = line
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em class="text-gray-400">$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-murim-darker px-1 py-0.5 rounded text-green-400 text-xs">$1</code>');
      htmlParts.push(`<p class="text-gray-300 leading-relaxed my-1">${processed}</p>`);
      i++;
    }

    let html = htmlParts.join('\n');

    // 검색 하이라이트 — 각 매치에 고유 인덱스 부여 (▲▼ 네비게이션용)
    if (searchText) {
      const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let matchCounter = 0;
      html = html.replace(
        new RegExp(`(${escaped})`, 'gi'),
        (_match, p1) => {
          const idx = matchCounter++;
          return `<mark data-match-idx="${idx}" class="bg-yellow-500/40 text-white px-0.5 rounded">${p1}</mark>`;
        }
      );
    }

    return html;
  };

  return (
    <div className="flex flex-col h-screen">
      {/* ── 헤더 ── */}
      <div className="shrink-0 p-4 border-b border-murim-border bg-murim-darker">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-murim-gold" />
              전략 문서
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              전략 회의 결과물 · 작업 전 반드시 확인
            </p>
          </div>

          {/* 검색 토글 버튼 (Ctrl+F 대용) */}
          <button
            onClick={() => { setSearchOpen(prev => !prev); setTimeout(() => searchInputRef.current?.focus(), 100); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-murim-dark border border-murim-border rounded-lg text-sm text-gray-400 hover:text-murim-gold hover:border-murim-gold/50 transition-colors"
            title="문서 내 검색 (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
            검색
          </button>
        </div>
      </div>

      {/* ── 탭 바 ── */}
      <div className="shrink-0 border-b border-murim-border bg-murim-dark overflow-x-auto">
        <div className="flex">
          {files.map((file) => {
            const Icon = TAB_ICONS[file.key] || FileText;
            const color = TAB_COLORS[file.key] || 'text-gray-400';
            const isActive = activeTab === file.key;
            return (
              <button
                key={file.key}
                onClick={() => {
                  if (hasChanges && !confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
                  setActiveTab(file.key);
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-murim-gold text-murim-gold bg-murim-darker'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-murim-darker/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? color : ''}`} />
                {file.label}
                {!file.editable && <span className="text-[9px] bg-gray-700 px-1 rounded">읽기</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 툴바 ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-murim-border bg-murim-darker/50">
        <div className="flex items-center gap-3">
          {/* 파일 정보 */}
          {fileInfo && (
            <span className="text-xs text-gray-500">
              {fileInfo.path} · {fileInfo.lineCount}줄 · {fileInfo.charCount.toLocaleString()}자
            </span>
          )}
          {/* 수정 상태 */}
          {hasChanges && (
            <span className="text-xs text-yellow-400 font-bold animate-pulse">● 수정됨</span>
          )}
          {saveMessage && (
            <span className={`text-xs font-medium ${saveMessage.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
              {saveMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 보기/편집 토글 */}
          {fileInfo?.editable && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isEditing
                    ? 'bg-blue-600 text-white'
                    : 'bg-murim-dark text-gray-400 hover:text-white border border-murim-border'
                }`}
              >
                {isEditing ? <><Edit3 className="w-3.5 h-3.5" /> 편집 중</> : <><Eye className="w-3.5 h-3.5" /> 보기 모드</>}
              </button>

              {isEditing && (
                <>
                  <button
                    onClick={handleReset}
                    disabled={!hasChanges}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-white bg-murim-dark border border-murim-border disabled:opacity-30"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> 되돌리기
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !hasChanges}
                    className="flex items-center gap-1 px-4 py-1.5 rounded-md text-xs font-bold bg-murim-gold text-black hover:bg-yellow-500 disabled:opacity-30 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 탭별 검색 바 ── */}
      {searchOpen && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-murim-border bg-murim-dark/80">
          <Search className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearchOpen(false); setSearchText(''); }
              if (searchMode === 'highlight') {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); goNextMatch(); }
                if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrevMatch(); }
              }
            }}
            placeholder={`"${files.find(f => f.key === activeTab)?.label || activeTab}" 문서 내 검색...`}
            className="flex-1 bg-transparent text-sm text-foreground placeholder-gray-500 focus:outline-none"
            autoFocus
          />
          {/* 모드 토글: 필터 / 전체 */}
          <div className="flex items-center shrink-0 bg-murim-darker rounded-lg border border-murim-border overflow-hidden">
            <button onClick={() => setSearchMode('filter')}
              className={`px-2.5 py-1 text-xs transition-colors ${searchMode === 'filter' ? 'bg-murim-gold text-black font-bold' : 'text-gray-400 hover:text-white'}`}
              title="해당 줄만 모아 보기">
              필터
            </button>
            <button onClick={() => setSearchMode('highlight')}
              className={`px-2.5 py-1 text-xs transition-colors ${searchMode === 'highlight' ? 'bg-murim-gold text-black font-bold' : 'text-gray-400 hover:text-white'}`}
              title="전체 문서 + 하이라이트">
              전체
            </button>
          </div>
          {/* 검색 결과 카운트 + 네비게이션 (전체 모드일 때만) */}
          {searchText && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-murim-gold min-w-[50px] text-right">
                {searchCount > 0
                  ? (searchMode === 'highlight' ? `${currentMatchIdx + 1} / ${searchCount}` : `${searchCount}건`)
                  : '0건'}
              </span>
              {searchMode === 'highlight' && (
                <>
                  <button onClick={goPrevMatch} disabled={searchCount === 0} title="이전 (Shift+Enter)"
                    className="p-1 rounded hover:bg-murim-darker text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={goNextMatch} disabled={searchCount === 0} title="다음 (Enter)"
                    className="p-1 rounded hover:bg-murim-darker text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
          {/* 닫기 */}
          <button onClick={() => { setSearchOpen(false); setSearchText(''); }}
            className="p-1 rounded hover:bg-murim-darker text-gray-400 hover:text-white transition-colors" title="검색 닫기 (ESC)">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 본문 영역 ── */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-murim-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">문서 로딩 중...</p>
            </div>
          </div>
        ) : searchText && searchMode === 'filter' && searchCount > 0 ? (
          /* ━━━ 필터 모드: 검색어 포함 줄만 표시 + 직접 편집 가능 ━━━ */
          <div className="h-full overflow-y-auto p-4">
            <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 px-2">
              <span>🔍 &quot;{searchText}&quot; — <span className="text-murim-gold font-bold">{searchCount}건</span></span>
              {fileInfo?.editable && (
                <span className="text-cyan-400">· 매칭 줄을 직접 수정할 수 있습니다</span>
              )}
              {hasChanges && (
                <button onClick={handleSave} disabled={isSaving}
                  className="ml-auto px-3 py-1 bg-murim-gold text-black text-xs font-bold rounded-md hover:bg-yellow-500 disabled:opacity-50 transition-colors">
                  {isSaving ? '저장 중...' : '💾 변경사항 저장'}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {getFilteredLines().map((group, gi) => (
                <div key={gi} className="bg-murim-darker rounded-lg border border-murim-border overflow-hidden">
                  {group.map((item) => (
                    <div key={item.lineNum}
                      className={`flex items-stretch text-sm border-b border-murim-border/30 last:border-b-0 ${
                        item.isMatch ? 'bg-yellow-500/5' : ''
                      }`}
                    >
                      {/* 줄 번호 */}
                      <div className="shrink-0 w-14 py-2 text-right pr-3 text-xs text-gray-600 select-none bg-murim-dark/30">
                        {item.lineNum}
                      </div>
                      {/* 줄 내용 — 매칭 줄은 편집 가능, 컨텍스트 줄은 읽기 전용 */}
                      {item.isMatch && fileInfo?.editable ? (
                        <input
                          type="text"
                          defaultValue={item.text}
                          onBlur={(e) => {
                            if (e.target.value !== item.text) {
                              updateLineContent(item.lineNum, e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="flex-1 py-2 px-2 bg-transparent text-gray-200 font-mono text-sm focus:bg-murim-dark/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
                          spellCheck={false}
                        />
                      ) : (
                        <div className={`flex-1 py-2 px-2 font-mono leading-relaxed whitespace-pre-wrap break-all ${item.isMatch ? 'text-gray-200' : 'text-gray-500'}`}>
                          {item.isMatch ? (() => {
                            const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const parts = item.text.split(new RegExp(`(${escaped})`, 'gi'));
                            return parts.map((part, pi) => {
                              const isHL = new RegExp(`^${escaped}$`, 'i').test(part);
                              return isHL
                                ? <mark key={pi} className="bg-orange-500/80 text-white px-0.5 rounded font-bold">{part}</mark>
                                : <span key={pi}>{part}</span>;
                            });
                          })() : (item.text || ' ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : searchText && searchMode === 'filter' && searchCount === 0 ? (
          /* 필터 모드: 결과 없음 */
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">&quot;{searchText}&quot; 검색 결과가 없습니다</p>
            </div>
          </div>
        ) : isEditing ? (
          /* 편집 모드: 텍스트에리어 (검색 없을 때) */
          <textarea
            ref={editorRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-6 bg-murim-darker text-gray-200 text-sm font-mono leading-relaxed resize-none focus:outline-none"
            spellCheck={false}
          />
        ) : (
          /* 보기 모드: 마크다운 렌더링 (전체 모드 또는 검색 없을 때) */
          <div
            ref={contentRef}
            className="h-full overflow-y-auto p-6 text-sm text-gray-300 leading-relaxed prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
    </div>
  );
}
