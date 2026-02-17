'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, Clock, CheckCircle, ChevronDown, ChevronRight,
  Save, ArrowRight, RefreshCw, FileText, Crosshair, Users,
  TrendingUp, BookOpen, Zap
} from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [전략 브리핑 페이지] - 다음 화 전략 분석 + 방향 선택
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 역할:
 * 1. 마스터 파일에서 자동으로 컨텍스트 추출 (복선, 캐릭터, 텐션)
 * 2. 방향 선택 (A/B) + 클리프행어 선택
 * 3. 승인 → 설계도로 사용 → 본문 집필 연결
 * 
 * 작업자는 여기서 "선택"만 하면 됩니다.
 * 분석은 AI가, 실행은 시스템이, 판단은 사람이.
 */

interface PlotThread {
  id: string;
  grade: string;
  episodeStarted: string;
  content: string;
  targetEpisode: string;
  statusIcon: string;
  statusText: string;
  urgency: string;
}

interface BriefingData {
  nextEpisode: number;
  currentState: {
    latestEpisode: number;
    inWorldDate: string;
    location: string;
    health: string;
    martialLevel: string;
    personality3Status: string;
  };
  plotThreads: {
    urgent: PlotThread[];
    active: PlotThread[];
    deferred: PlotThread[];
    total: number;
  };
  sections: {
    nextEpisodeNotes: string;
    relationships: string;
    tensionDesign: string;
    memoryCards: string;
  };
  lastEpisodeEnding: string;
  plannedContent: string;
  savedChoices: any;
  episodeExists: boolean;
}

export default function BriefingPage() {
  // ── 상태 관리 ──
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 사용자 선택 — 방향 4개 (A/B/C/D)
  const [directionA, setDirectionA] = useState('');
  const [directionB, setDirectionB] = useState('');
  const [directionC, setDirectionC] = useState('');
  const [directionD, setDirectionD] = useState('');
  const [selectedDirection, setSelectedDirection] = useState<'A' | 'B' | 'C' | 'D' | ''>('');
  const [cliffhangers, setCliffhangers] = useState<string[]>(['', '', '']);
  const [selectedCliffhanger, setSelectedCliffhanger] = useState<number>(-1);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [recommended, setRecommended] = useState<'A' | 'B' | 'C' | 'D'>('B');

  // ── 연출 변수 ──
  const [casting, setCasting] = useState<{name: string; role: string}[]>([
    { name: '위소운', role: '주연' },
    { name: '천마(내면)', role: '조연' },
    { name: '이준혁(내면)', role: '조연' },
    { name: '당찬', role: '' },
    { name: '소연화', role: '' },
    { name: '남궁현', role: '' },
    { name: '안노사', role: '' },
    { name: '안세진', role: '' },
  ]);
  const [customCharacter, setCustomCharacter] = useState('');
  const [setting, setSetting] = useState('');
  const [personalityBalance, setPersonalityBalance] = useState({ wisoun: 40, chunma: 30, junhyuk: 30 });
  const [emotionDesign, setEmotionDesign] = useState({ start: '평온', peak: '긴장', end: '여운' });

  // UI 상태
  const [showDeferred, setShowDeferred] = useState(false);
  const [showMemoryCards, setShowMemoryCards] = useState(false);
  const [showLastEpisode, setShowLastEpisode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [approved, setApproved] = useState(false);
  const [autoSuggesting, setAutoSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

  // ── §2 주의사항 & 바이블 계획 편집 상태 ──
  const [editingSection2, setEditingSection2] = useState(false);   // §2 편집 모드 토글
  const [section2Draft, setSection2Draft] = useState('');          // §2 편집 중 임시 텍스트
  const [editingBible, setEditingBible] = useState(false);         // 바이블 계획 편집 모드 토글
  const [bibleDraft, setBibleDraft] = useState('');                // 바이블 계획 편집 중 임시 텍스트
  const [autoSaveStatus, setAutoSaveStatus] = useState<{ section2: string; bible: string }>({ section2: '', bible: '' }); // 자동 저장 상태 표시
  const section2TimerRef = useRef<NodeJS.Timeout | null>(null);    // §2 자동 저장 디바운스 타이머
  const bibleTimerRef = useRef<NodeJS.Timeout | null>(null);       // 바이블 자동 저장 디바운스 타이머

  // ── 자동 저장 함수 (공통) ── 타이핑 멈추고 1.5초 후 자동으로 파일에 저장
  const autoSave = async (type: 'section2' | 'bible', content: string) => {
    if (!briefing) return;
    const label = type === 'section2' ? '§2 주의사항' : '바이블 계획';
    setAutoSaveStatus(prev => ({ ...prev, [type]: '저장 중...' }));
    try {
      const res = await fetch('/api/strategic-briefing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, episodeNumber: briefing.nextEpisode }),
      });
      const data = await res.json();
      if (data.success) {
        // 브리핑 데이터도 실시간 반영
        if (type === 'section2') briefing.sections.nextEpisodeNotes = content;
        else briefing.plannedContent = content;
        setAutoSaveStatus(prev => ({ ...prev, [type]: '✅ 자동 저장 완료' }));
      } else {
        setAutoSaveStatus(prev => ({ ...prev, [type]: '❌ 저장 실패' }));
      }
    } catch {
      setAutoSaveStatus(prev => ({ ...prev, [type]: '❌ 저장 오류' }));
    }
    // 3초 후 상태 메시지 사라짐
    setTimeout(() => setAutoSaveStatus(prev => ({ ...prev, [type]: '' })), 3000);
  };

  // ── §2 자동 저장 디바운스 (1.5초) ──
  useEffect(() => {
    if (!editingSection2 || !section2Draft) return;
    if (section2TimerRef.current) clearTimeout(section2TimerRef.current);
    setAutoSaveStatus(prev => ({ ...prev, section2: '✏️ 편집 중...' }));
    section2TimerRef.current = setTimeout(() => autoSave('section2', section2Draft), 1500);
    return () => { if (section2TimerRef.current) clearTimeout(section2TimerRef.current); };
  }, [section2Draft]);

  // ── 바이블 자동 저장 디바운스 (1.5초) ──
  useEffect(() => {
    if (!editingBible || !bibleDraft) return;
    if (bibleTimerRef.current) clearTimeout(bibleTimerRef.current);
    setAutoSaveStatus(prev => ({ ...prev, bible: '✏️ 편집 중...' }));
    bibleTimerRef.current = setTimeout(() => autoSave('bible', bibleDraft), 1500);
    return () => { if (bibleTimerRef.current) clearTimeout(bibleTimerRef.current); };
  }, [bibleDraft]);

  // ── 인명록 자동완성 상태 ──
  const [allCharacterNames, setAllCharacterNames] = useState<string[]>([]); // 인명록에서 파싱한 전체 이름 목록
  const [showSuggestions, setShowSuggestions] = useState(false); // 자동완성 드롭다운 표시 여부
  const suggestionsRef = useRef<HTMLDivElement>(null); // 드롭다운 외부 클릭 감지용

  // ── 브리핑 데이터 로드 ──
  useEffect(() => {
    loadBriefing();
    loadCharacterNames(); // 인명록에서 캐릭터 이름 로드
  }, []);

  // ── 드롭다운 외부 클릭 시 닫기 ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── 인명록에서 캐릭터 이름 파싱 ──
  const loadCharacterNames = async () => {
    try {
      const res = await fetch('/api/strategy-files?file=characters');
      const data = await res.json();
      if (data.success && data.file?.content) {
        // 통계 테이블에서 이름 추출 (| 구분 | 인원 | 인물목록 | 형식)
        const names: string[] = [];
        // ★ Windows 줄바꿈(\r) 제거 — \r이 남으면 정규식 \|$ 매칭 실패
        const lines = data.file.content.replace(/\r/g, '').split('\n');
        for (const line of lines) {
          // "| **주연 (3인격)** | **3명** | 위소운, 이준혁(내면), 천마(내면) |" 같은 행 매칭
          const match = line.match(/\|\s*\*\*.*?\*\*\s*\|\s*\*\*.*?\*\*\s*\|\s*(.+?)\s*\|$/);
          if (match) {
            const nameList = match[1]
              .replace(/등$/, '') // "한소검 등" 에서 "등" 제거
              .split(/[,，]/) // 쉼표로 분리
              .map((n: string) => n.trim())
              .filter((n: string) => n && n !== '—' && !n.startsWith('1~') && !n.startsWith('약'));
            names.push(...nameList);
          }
        }
        // 중복 제거 후 저장
        const unique = [...new Set(names)].filter((n: string) => n.length >= 2);
        setAllCharacterNames(unique);
      }
    } catch {
      // 인명록 로드 실패해도 기능에 영향 없음 (자동완성만 안 됨)
    }
  };

  const loadBriefing = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/strategic-briefing');
      const data = await res.json();
      
      if (data.success) {
        setBriefing(data.briefing);
        
        // 저장된 선택사항이 있으면 복원
        if (data.briefing.savedChoices) {
          const saved = data.briefing.savedChoices;
          if (saved.directionChoice) {
            setDirectionA(saved.directionChoice.a || '');
            setDirectionB(saved.directionChoice.b || '');
            setSelectedDirection(saved.directionChoice.selected || '');
            setRecommended(saved.directionChoice.recommended || 'B');
          }
          if (saved.cliffhangerChoice) {
            setCliffhangers(saved.cliffhangerChoice.options || ['', '', '']);
            setSelectedCliffhanger(saved.cliffhangerChoice.selected ?? -1);
          }
          if (saved.directionChoice?.c) setDirectionC(saved.directionChoice.c);
          if (saved.directionChoice?.d) setDirectionD(saved.directionChoice.d);
          if (saved.notes) setAdditionalNotes(saved.notes);
          if (saved.approved) setApproved(saved.approved);
          // 연출 변수 복원
          if (saved.casting) setCasting(saved.casting);
          if (saved.setting) setSetting(saved.setting);
          if (saved.personalityBalance) setPersonalityBalance(saved.personalityBalance);
          if (saved.emotionDesign) setEmotionDesign(saved.emotionDesign);
        }
      } else {
        setError(data.message || '브리핑 로드 실패');
      }
    } catch (err: any) {
      setError('서버 연결 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── 브리핑 저장 ──
  const saveBriefing = async (isApproval = false) => {
    if (!briefing) return;
    setSaving(true);
    setSaveMessage('');
    
    try {
      const res = await fetch('/api/strategic-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber: briefing.nextEpisode,
          directionChoice: {
            a: directionA,
            b: directionB,
            c: directionC,
            d: directionD,
            selected: selectedDirection,
            recommended,
          },
          cliffhangerChoice: {
            options: cliffhangers,
            selected: selectedCliffhanger,
          },
          casting,
          setting,
          personalityBalance,
          emotionDesign,
          notes: additionalNotes,
          approved: isApproval || approved,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setSaveMessage(isApproval ? '✅ 브리핑 승인 완료!' : '✅ 저장 완료');
        if (isApproval) setApproved(true);
        
        // 승인 시 설계도를 localStorage에도 저장 (step6 연동)
        if (isApproval && selectedDirection) {
          const blueprint = buildBlueprint();
          localStorage.setItem(
            `briefing_ep${briefing.nextEpisode}`,
            JSON.stringify(blueprint)
          );
        }
      } else {
        setSaveMessage('❌ 저장 실패: ' + data.message);
      }
    } catch (err: any) {
      setSaveMessage('❌ 서버 오류: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  // ── 떡밥 삭제 (소설_진행_마스터 §3에서 제거) ──
  const deleteThread = async (threadId: string) => {
    try {
      const res = await fetch('/api/strategic-briefing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      });
      const data = await res.json();
      if (data.success) {
        // UI에서도 즉시 제거
        if (briefing) {
          const removeFromList = (list: PlotThread[]) => list.filter(t => t.id !== threadId);
          setBriefing({
            ...briefing,
            plotThreads: {
              ...briefing.plotThreads,
              urgent: removeFromList(briefing.plotThreads.urgent),
              active: removeFromList(briefing.plotThreads.active),
              deferred: removeFromList(briefing.plotThreads.deferred),
              total: briefing.plotThreads.total - 1,
            },
          });
        }
        setSaveMessage(`✅ 떡밥 ${threadId} 삭제 완료`);
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        alert('삭제 실패: ' + data.message);
      }
    } catch (err: any) {
      alert('서버 오류: ' + err.message);
    }
  };

  // ── 설계도 생성 (step6 연동용) ──
  const buildBlueprint = () => {
    if (!briefing) return null;
    const dir = selectedDirection === 'A' ? directionA : directionB;
    const cliff = selectedCliffhanger >= 0 ? cliffhangers[selectedCliffhanger] : '';
    
    return {
      episodeNumber: briefing.nextEpisode,
      direction: dir,
      cliffhanger: cliff,
      casting: casting.filter(c => c.role),
      setting,
      personalityBalance,
      emotionDesign,
      notes: additionalNotes,
      urgentThreads: briefing.plotThreads.urgent.map(t => t.content),
      plannedContent: briefing.plannedContent,
      approvedAt: new Date().toISOString(),
    };
  };

  // ── AI 자동 제안 (PUT /api/strategic-briefing) ──
  const autoSuggest = async () => {
    if (!briefing) return;
    setAutoSuggesting(true);
    try {
      const res = await fetch(`/api/strategic-briefing?episode=${briefing.nextEpisode}`, {
        method: 'PUT',
      });
      const data = await res.json();
      if (data.success && data.suggestions) {
        const s = data.suggestions;
        setAiSuggestions(s);  // 전체 제안 저장 (UI 표시용)

        // ── 방향 A 채우기 (풍부한 내용) ──
        let aText = `📌 ${s.directionA.title}\n\n${s.directionA.description}`;
        if (s.directionA.scenes) aText += `\n\n🎬 핵심 장면: ${s.directionA.scenes}`;
        if (s.directionA.characters) aText += `\n👥 캐릭터: ${s.directionA.characters}`;
        if (s.directionA.reason) aText += `\n\n💡 ${s.directionA.reason}`;
        setDirectionA(aText);

        // ── 방향 B 채우기 ──
        let bText = `📌 ${s.directionB.title}\n\n${s.directionB.description}`;
        if (s.directionB.scenes) bText += `\n\n🎬 핵심 장면: ${s.directionB.scenes}`;
        if (s.directionB.characters) bText += `\n👥 캐릭터: ${s.directionB.characters}`;
        if (s.directionB.reason) bText += `\n\n💡 ${s.directionB.reason}`;
        setDirectionB(bText);

        // ── 방향 C 채우기 ──
        if (s.directionC) {
          let cText = `📌 ${s.directionC.title}\n\n${s.directionC.description}`;
          if (s.directionC.scenes) cText += `\n\n🎬 핵심 장면: ${s.directionC.scenes}`;
          if (s.directionC.characters) cText += `\n👥 캐릭터: ${s.directionC.characters}`;
          if (s.directionC.reason) cText += `\n\n💡 ${s.directionC.reason}`;
          setDirectionC(cText);
        }

        // ── 방향 D 채우기 ──
        if (s.directionD) {
          let dText = `📌 ${s.directionD.title}\n\n${s.directionD.description}`;
          if (s.directionD.scenes) dText += `\n\n🎬 핵심 장면: ${s.directionD.scenes}`;
          if (s.directionD.characters) dText += `\n👥 캐릭터: ${s.directionD.characters}`;
          if (s.directionD.reason) dText += `\n\n💡 ${s.directionD.reason}`;
          setDirectionD(dText);
        }

        setRecommended(s.recommended);

        // ── 클리프행어 채우기 (제목 + 상세 묘사 + 독자 반응) ──
        if (s.cliffhangers && s.cliffhangers.length > 0) {
          const newCliffs = s.cliffhangers.map((c: any) => {
            let text = c.title ? `📌 ${c.title}\n` : '';
            text += c.description || '';
            if (c.reaction) text += `\n\n🎯 독자 반응: ${c.reaction}`;
            return text;
          });
          while (newCliffs.length < 3) newCliffs.push('');
          setCliffhangers(newCliffs.slice(0, Math.max(3, newCliffs.length)));
        }

        // ── 추가 메모에 종합 정보 기록 ──
        let notes = '';
        if (s.recommendReason) notes += `🎬 AI 추천: ${s.recommended}안 — ${s.recommendReason}`;
        if (s.heartLine) notes += `\n\n💎 심장라인 제안: "${s.heartLine}"`;
        if (s.emotionArc) notes += `\n\n📈 감정 곡선: ${s.emotionArc}`;
        if (s.threadUse) notes += `\n\n🧩 복선 처리: ${s.threadUse}`;
        if (notes) setAdditionalNotes(prev => prev ? `${prev}\n\n${notes}` : notes);

        // ── 연출 변수 채우기 ──
        if (s.casting) setCasting(s.casting);
        if (s.setting) setSetting(s.setting);
        if (s.personalityBalance) setPersonalityBalance(s.personalityBalance);
        if (s.emotionDesign) setEmotionDesign(s.emotionDesign);
      } else {
        alert('AI 제안 생성 실패: ' + (data.message || '알 수 없는 오류'));
      }
    } catch (err: any) {
      alert('서버 연결 오류: ' + err.message);
    } finally {
      setAutoSuggesting(false);
    }
  };

  // ── 로딩/에러 화면 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-murim-accent mx-auto mb-3" />
          <p className="text-gray-400">마스터 파일 분석 중...</p>
        </div>
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error || '브리핑 데이터를 불러올 수 없습니다.'}</p>
          <button onClick={loadBriefing} className="mt-2 text-sm text-murim-accent hover:underline">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-10 bg-murim-darker border-b border-murim-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Crosshair className="w-6 h-6 text-murim-accent" />
              제{briefing.nextEpisode}화 전략 브리핑
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              마스터 파일 기반 자동 분석 · 방향 선택 후 "승인"하면 본문 집필로 연결됩니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 에피소드 생성 상태 표시 */}
            {briefing.episodeExists ? (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                📄 생성 완료
              </span>
            ) : (
              <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium">
                ⏳ 미생성
              </span>
            )}
            {approved && (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                ✅ 승인됨
              </span>
            )}
            <button
              onClick={loadBriefing}
              className="p-2 rounded-lg hover:bg-murim-dark text-gray-500 hover:text-foreground transition"
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ━━━ 1. 현재 상태 요약 ━━━ */}
        <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-murim-gold" />
            현재 상태 (제{briefing.currentState.latestEpisode}화 완료 시점)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StateCard label="작중 시간" value={briefing.currentState.inWorldDate} />
            <StateCard label="위치" value={briefing.currentState.location} />
            <StateCard label="건강" value={briefing.currentState.health} />
            <StateCard label="무공 등급" value={briefing.currentState.martialLevel} />
            <StateCard label="3인격" value={briefing.currentState.personality3Status} />
          </div>
        </section>

        {/* ━━━ 2. 긴급 떡밥 ━━━ */}
        <section className="bg-murim-dark rounded-xl border border-red-500/30 p-5">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            긴급 회수 필요 ({briefing.plotThreads.urgent.length}건)
            <span className="text-xs text-gray-500 font-normal ml-2">이번 화에서 처리해야 할 복선</span>
          </h2>
          {briefing.plotThreads.urgent.length > 0 ? (
            <div className="space-y-2">
              {briefing.plotThreads.urgent.map(thread => (
                <ThreadCard key={thread.id} thread={thread} onDelete={deleteThread} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">긴급 회수 떡밥 없음</p>
          )}
        </section>

        {/* ━━━ 3. 진행 중 떡밥 ━━━ */}
        {briefing.plotThreads.active.length > 0 && (
          <section className="bg-murim-dark rounded-xl border border-yellow-500/30 p-5">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              진행 중 ({briefing.plotThreads.active.length}건)
              <span className="text-xs text-gray-500 font-normal ml-2">힌트만 주거나 축적 중</span>
            </h2>
            <div className="space-y-2">
              {briefing.plotThreads.active.map(thread => (
                <ThreadCard key={thread.id} thread={thread} onDelete={deleteThread} />
              ))}
            </div>
          </section>
        )}

        {/* ━━━ 4. 보류 떡밥 (접기) ━━━ */}
        {briefing.plotThreads.deferred.length > 0 && (
          <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
            <button 
              onClick={() => setShowDeferred(!showDeferred)}
              className="w-full flex items-center justify-between text-foreground"
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-gray-500" />
                보류 가능 ({briefing.plotThreads.deferred.length}건)
              </h2>
              {showDeferred ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showDeferred && (
              <div className="space-y-2 mt-3">
                {briefing.plotThreads.deferred.map(thread => (
                  <ThreadCard key={thread.id} thread={thread} onDelete={deleteThread} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ━━━ 5. 다음 화 주의사항 (마스터 §2) — 편집 가능 + 자동 저장 ━━━ */}
        {briefing.sections.nextEpisodeNotes !== undefined && (
          <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-murim-accent" />
              다음 화 주의사항 (마스터 §2)
              {/* 자동 저장 상태 표시 */}
              {editingSection2 && autoSaveStatus.section2 && (
                <span className={`text-xs font-normal ${autoSaveStatus.section2.includes('완료') ? 'text-green-400' : autoSaveStatus.section2.includes('실패') || autoSaveStatus.section2.includes('오류') ? 'text-red-400' : 'text-yellow-400'}`}>
                  {autoSaveStatus.section2}
                </span>
              )}
              {!editingSection2 ? (
                <button onClick={() => { setEditingSection2(true); setSection2Draft(briefing.sections.nextEpisodeNotes); }}
                  className="ml-auto text-xs px-3 py-1 bg-murim-darker border border-murim-border rounded-lg text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors">
                  ✏️ 편집
                </button>
              ) : (
                <div className="ml-auto flex gap-2">
                  <button onClick={() => { autoSave('section2', section2Draft); }}
                    className="text-xs px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors">💾 저장</button>
                  <button onClick={() => { setEditingSection2(false); setAutoSaveStatus(prev => ({ ...prev, section2: '' })); }}
                    className="text-xs px-3 py-1 bg-murim-darker border border-murim-border rounded-lg text-gray-400 hover:text-red-400 transition-colors">편집 닫기</button>
                </div>
              )}
            </h2>
            {editingSection2 ? (
              <textarea value={section2Draft} onChange={(e) => setSection2Draft(e.target.value)}
                placeholder="주의사항을 입력하세요... (타이핑 멈추면 1.5초 후 자동 저장)"
                className="w-full bg-murim-darker border border-cyan-500/30 rounded-lg p-4 text-sm text-gray-300 leading-relaxed resize-y min-h-[200px] max-h-[500px] focus:outline-none focus:border-cyan-500/60"
                rows={10} />
            ) : (
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-murim-darker rounded-lg p-4 max-h-80 overflow-y-auto">
                {briefing.sections.nextEpisodeNotes || '(내용 없음 — 편집 버튼으로 추가 가능)'}
              </div>
            )}
          </section>
        )}

        {/* ━━━ 6. 스토리 바이블 계획 — 편집 가능 + 자동 저장 ━━━ */}
        {briefing.plannedContent !== undefined && (
          <section className="bg-murim-dark rounded-xl border border-blue-500/30 p-5">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              스토리 바이블 계획
              {/* 자동 저장 상태 표시 */}
              {editingBible && autoSaveStatus.bible && (
                <span className={`text-xs font-normal ${autoSaveStatus.bible.includes('완료') ? 'text-green-400' : autoSaveStatus.bible.includes('실패') || autoSaveStatus.bible.includes('오류') ? 'text-red-400' : 'text-yellow-400'}`}>
                  {autoSaveStatus.bible}
                </span>
              )}
              {!editingBible ? (
                <button onClick={() => { setEditingBible(true); setBibleDraft(briefing.plannedContent); }}
                  className="ml-auto text-xs px-3 py-1 bg-murim-darker border border-murim-border rounded-lg text-gray-400 hover:text-blue-400 hover:border-blue-500/50 transition-colors">
                  ✏️ 편집
                </button>
              ) : (
                <div className="ml-auto flex gap-2">
                  <button onClick={() => { autoSave('bible', bibleDraft); }}
                    className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors">💾 저장</button>
                  <button onClick={() => { setEditingBible(false); setAutoSaveStatus(prev => ({ ...prev, bible: '' })); }}
                    className="text-xs px-3 py-1 bg-murim-darker border border-murim-border rounded-lg text-gray-400 hover:text-red-400 transition-colors">편집 닫기</button>
                </div>
              )}
            </h2>
            {editingBible ? (
              <textarea value={bibleDraft} onChange={(e) => setBibleDraft(e.target.value)}
                placeholder="바이블 계획을 입력하세요... (타이핑 멈추면 1.5초 후 자동 저장)"
                className="w-full bg-murim-darker border border-blue-500/30 rounded-lg p-4 text-sm text-gray-300 leading-relaxed resize-y min-h-[200px] max-h-[500px] focus:outline-none focus:border-blue-500/60"
                rows={8} />
            ) : (
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-murim-darker rounded-lg p-4 overflow-x-auto">
                {briefing.plannedContent || '(내용 없음 — 편집 버튼으로 추가 가능)'}
              </div>
            )}
          </section>
        )}

        {/* ━━━ 7. 이전 화 엔딩 (접기) ━━━ */}
        {briefing.lastEpisodeEnding && (
          <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
            <button 
              onClick={() => setShowLastEpisode(!showLastEpisode)}
              className="w-full flex items-center justify-between text-foreground"
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-gray-400" />
                이전 화 엔딩 (제{briefing.currentState.latestEpisode}화 마지막 부분)
              </h2>
              {showLastEpisode ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showLastEpisode && (
              <div className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed bg-murim-darker rounded-lg p-4 mt-3 max-h-60 overflow-y-auto">
                {briefing.lastEpisodeEnding}
              </div>
            )}
          </section>
        )}

        {/* ━━━ 8. 최근 기억카드 (접기) ━━━ */}
        {briefing.sections.memoryCards && (
          <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
            <button 
              onClick={() => setShowMemoryCards(!showMemoryCards)}
              className="w-full flex items-center justify-between text-foreground"
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                최근 기억카드 (§7)
              </h2>
              {showMemoryCards ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showMemoryCards && (
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-murim-darker rounded-lg p-4 mt-3 max-h-96 overflow-y-auto">
                {briefing.sections.memoryCards}
              </div>
            )}
          </section>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* 구분선: 위 = 자동 분석 / 아래 = 사람의 선택 */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 border-t border-murim-gold/30" />
          <span className="text-murim-gold text-sm font-bold">아래는 사람이 선택하는 영역</span>
          <div className="flex-1 border-t border-murim-gold/30" />
        </div>

        {/* ━━━ AI 자동 제안 버튼 ━━━ */}
        <div className="flex justify-center">
          <button
            onClick={autoSuggest}
            disabled={autoSuggesting}
            className="flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-murim-accent to-purple-600 text-white font-bold text-lg shadow-lg hover:shadow-murim-accent/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {autoSuggesting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                AI가 1~{briefing.currentState.latestEpisode}화 분석 중...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                AI 자동 제안 — 방향 + 클리프행어 한번에 생성
              </>
            )}
          </button>
        </div>

        {/* ━━━ 9. 방향 선택 (A/B/C/D) ━━━ */}
        <section className="bg-murim-dark rounded-xl border-2 border-murim-gold/40 p-5">
          <h2 className="text-lg font-bold text-murim-gold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            방향 선택
            <span className="text-xs text-gray-500 font-normal ml-2">
              4가지 방향 중 하나를 선택 (AI 자동 제안 또는 직접 입력)
            </span>
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {/* A안 */}
            <div 
              className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                selectedDirection === 'A' 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-murim-border hover:border-blue-500/50'
              }`}
              onClick={() => setSelectedDirection('A')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 font-bold text-lg">A안</span>
                <div className="flex items-center gap-2">
                  {recommended === 'A' && (
                    <span className="text-[10px] bg-murim-gold/20 text-murim-gold px-2 py-0.5 rounded-full">추천</span>
                  )}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedDirection === 'A' ? 'border-blue-500' : 'border-gray-600'
                  }`}>
                    {selectedDirection === 'A' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
                  </div>
                </div>
              </div>
              <textarea
                value={directionA}
                onChange={(e) => setDirectionA(e.target.value)}
                placeholder="A안 방향을 입력하세요...&#10;예: 이준혁 중심. 스카우트 협상. 사업 서사 시작."
                className="w-full bg-murim-darker border border-murim-border rounded-lg p-3 text-sm text-gray-300 resize-none focus:outline-none focus:border-blue-500/50 min-h-[220px]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* B안 */}
            <div 
              className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                selectedDirection === 'B' 
                  ? 'border-purple-500 bg-purple-500/10' 
                  : 'border-murim-border hover:border-purple-500/50'
              }`}
              onClick={() => setSelectedDirection('B')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-400 font-bold text-lg">B안</span>
                <div className="flex items-center gap-2">
                  {recommended === 'B' && (
                    <span className="text-[10px] bg-murim-gold/20 text-murim-gold px-2 py-0.5 rounded-full">추천</span>
                  )}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedDirection === 'B' ? 'border-purple-500' : 'border-gray-600'
                  }`}>
                    {selectedDirection === 'B' && <div className="w-3 h-3 rounded-full bg-purple-500" />}
                  </div>
                </div>
              </div>
              <textarea
                value={directionB}
                onChange={(e) => setDirectionB(e.target.value)}
                placeholder="B안 방향을 입력하세요...&#10;예: 균형형. 소연화+천마 꿈. 코미디+미스터리."
                className="w-full bg-murim-darker border border-murim-border rounded-lg p-3 text-sm text-gray-300 resize-none focus:outline-none focus:border-purple-500/50 min-h-[220px]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* C안 */}
            <div 
              className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                selectedDirection === 'C' 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : 'border-murim-border hover:border-emerald-500/50'
              }`}
              onClick={() => setSelectedDirection('C')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 font-bold text-lg">C안</span>
                <div className="flex items-center gap-2">
                  {recommended === 'C' && (
                    <span className="text-[10px] bg-murim-gold/20 text-murim-gold px-2 py-0.5 rounded-full">추천</span>
                  )}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedDirection === 'C' ? 'border-emerald-500' : 'border-gray-600'
                  }`}>
                    {selectedDirection === 'C' && <div className="w-3 h-3 rounded-full bg-emerald-500" />}
                  </div>
                </div>
              </div>
              <textarea
                value={directionC}
                onChange={(e) => setDirectionC(e.target.value)}
                placeholder="C안 방향을 입력하세요...&#10;예: 천마 중심. 과거 회상. 무공 수련 심화."
                className="w-full bg-murim-darker border border-murim-border rounded-lg p-3 text-sm text-gray-300 resize-none focus:outline-none focus:border-emerald-500/50 min-h-[220px]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* D안 */}
            <div 
              className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                selectedDirection === 'D' 
                  ? 'border-orange-500 bg-orange-500/10' 
                  : 'border-murim-border hover:border-orange-500/50'
              }`}
              onClick={() => setSelectedDirection('D')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-400 font-bold text-lg">D안</span>
                <div className="flex items-center gap-2">
                  {recommended === 'D' && (
                    <span className="text-[10px] bg-murim-gold/20 text-murim-gold px-2 py-0.5 rounded-full">추천</span>
                  )}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedDirection === 'D' ? 'border-orange-500' : 'border-gray-600'
                  }`}>
                    {selectedDirection === 'D' && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                  </div>
                </div>
              </div>
              <textarea
                value={directionD}
                onChange={(e) => setDirectionD(e.target.value)}
                placeholder="D안 방향을 입력하세요...&#10;예: 위소운 단독. 일상 속 성장. 관계 강화."
                className="w-full bg-murim-darker border border-murim-border rounded-lg p-3 text-sm text-gray-300 resize-none focus:outline-none focus:border-orange-500/50 min-h-[220px]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </section>

        {/* ━━━ 10. 클리프행어 선택 ━━━ */}
        <section className="bg-murim-dark rounded-xl border-2 border-murim-gold/40 p-5">
          <h2 className="text-lg font-bold text-murim-gold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            클리프행어 선택
            <span className="text-xs text-gray-500 font-normal ml-2">
              이 화의 마지막 장면. 독자가 "다음 화 안 읽으면 못 견디는" 장치
            </span>
          </h2>

          <div className="space-y-3">
            {cliffhangers.map((cliff, idx) => (
              <div 
                key={idx}
                className={`flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all ${
                  selectedCliffhanger === idx 
                    ? 'border-murim-gold bg-murim-gold/10' 
                    : 'border-murim-border hover:border-murim-gold/50'
                }`}
                onClick={() => setSelectedCliffhanger(idx)}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                  selectedCliffhanger === idx ? 'border-murim-gold' : 'border-gray-600'
                }`}>
                  {selectedCliffhanger === idx && <div className="w-3 h-3 rounded-full bg-murim-gold" />}
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-500 font-mono">#{idx + 1}</span>
                  <textarea
                    value={cliff}
                    onChange={(e) => {
                      const newCliffs = [...cliffhangers];
                      newCliffs[idx] = e.target.value;
                      setCliffhangers(newCliffs);
                    }}
                    placeholder={`클리프행어 ${idx + 1}번을 입력하세요...`}
                    className="w-full bg-murim-darker border border-murim-border rounded-lg p-2 text-sm text-gray-300 resize-none focus:outline-none focus:border-murim-gold/50 mt-1 min-h-[60px]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
            
            {/* 클리프행어 추가 버튼 */}
            {cliffhangers.length < 5 && (
              <button
                onClick={() => setCliffhangers([...cliffhangers, ''])}
                className="text-sm text-gray-500 hover:text-murim-accent transition"
              >
                + 클리프행어 추가
              </button>
            )}
          </div>
        </section>

        {/* ━━━ 10.2 등장인물 캐스팅 ━━━ */}
        <section className="bg-murim-dark rounded-xl border border-cyan-500/30 p-5">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            등장인물 캐스팅
            <span className="text-xs text-gray-500 font-normal ml-2">
              클릭하면 역할 변경: 안나옴 → 주연 → 조연 → 카메오
            </span>
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {casting.map((char, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const roles = ['', '주연', '조연', '카메오'];
                  const nextIdx = (roles.indexOf(char.role) + 1) % roles.length;
                  const updated = [...casting];
                  updated[idx] = { ...char, role: roles[nextIdx] };
                  setCasting(updated);
                }}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  char.role === '주연' ? 'border-red-500 bg-red-500/20 text-red-300' :
                  char.role === '조연' ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300' :
                  char.role === '카메오' ? 'border-gray-500 bg-gray-500/20 text-gray-400' :
                  'border-murim-border bg-murim-darker text-gray-600'
                }`}
              >
                {char.name}
                {char.role && <span className="ml-1.5 text-[10px] font-bold opacity-80">{char.role}</span>}
              </button>
            ))}
          </div>
          {/* 커스텀 캐릭터 추가 (인명록 자동완성 포함) */}
          <div className="flex gap-2 relative" ref={suggestionsRef}>
            <div className="flex-1 relative">
              <input
                value={customCharacter}
                onChange={(e) => {
                  setCustomCharacter(e.target.value);
                  // 1글자 이상 입력 시 자동완성 드롭다운 표시
                  setShowSuggestions(e.target.value.trim().length >= 1);
                }}
                onFocus={() => {
                  // 입력란 포커스 시 내용이 있으면 드롭다운 표시
                  if (customCharacter.trim().length >= 1) setShowSuggestions(true);
                }}
                placeholder="인물 추가... (첫 글자 입력 시 인명록 검색)"
                className="w-full bg-murim-darker border border-murim-border rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customCharacter.trim()) {
                    // 이미 캐스팅에 있는 인물이면 추가하지 않음
                    const exists = casting.some(c => c.name === customCharacter.trim());
                    if (!exists) {
                      setCasting(prev => [...prev, { name: customCharacter.trim(), role: '조연' }]);
                    }
                    setCustomCharacter('');
                    setShowSuggestions(false);
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
              />
              {/* ── 인명록 자동완성 드롭다운 ── */}
              {showSuggestions && customCharacter.trim().length >= 1 && (() => {
                // 입력값으로 필터링 (이미 캐스팅에 있는 인물은 제외)
                const castingNames = casting.map(c => c.name);
                const filtered = allCharacterNames.filter(name =>
                  name.includes(customCharacter.trim()) && !castingNames.includes(name)
                );
                if (filtered.length === 0) return null;
                return (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-murim-darker border border-cyan-500/30 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {filtered.map((name, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCasting(prev => [...prev, { name, role: '조연' }]);
                          setCustomCharacter('');
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors border-b border-murim-border/30 last:border-0"
                      >
                        {/* 검색어 부분 하이라이트 */}
                        {name.split(new RegExp(`(${customCharacter.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) =>
                          part.toLowerCase() === customCharacter.trim().toLowerCase()
                            ? <span key={i} className="text-cyan-400 font-bold">{part}</span>
                            : <span key={i}>{part}</span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            <button
              onClick={() => {
                if (customCharacter.trim()) {
                  const exists = casting.some(c => c.name === customCharacter.trim());
                  if (!exists) {
                    setCasting(prev => [...prev, { name: customCharacter.trim(), role: '조연' }]);
                  }
                  setCustomCharacter('');
                  setShowSuggestions(false);
                }
              }}
              className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition"
            >
              추가
            </button>
          </div>
        </section>

        {/* ━━━ 10.3 배경·무대 ━━━ */}
        <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-400" />
            배경·무대
            <span className="text-xs text-gray-500 font-normal ml-2">
              장소, 시간대, 분위기 — 같은 사건도 무대가 다르면 전혀 다른 소설
            </span>
          </h2>
          <textarea
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            placeholder="예: 개봉 만류귀종 객잔 2층 — 이른 아침, 안개가 자욱함. 아래층에서 무인들의 웅성거림."
            className="w-full bg-murim-darker border border-murim-border rounded-lg p-3 text-sm text-gray-300 resize-none focus:outline-none focus:border-green-500/50 min-h-[100px]"
          />
        </section>

        {/* ━━━ 10.4 3인격 비중 + 감정 설계 (2열) ━━━ */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* 3인격 비중 */}
          <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              3인격 비중
            </h2>
            <div className="space-y-4">
              {([
                { key: 'wisoun' as const, label: '위소운', color: 'accent-blue-500' },
                { key: 'chunma' as const, label: '천마', color: 'accent-red-500' },
                { key: 'junhyuk' as const, label: '이준혁', color: 'accent-green-500' },
              ]).map(p => (
                <div key={p.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-400">{p.label}</span>
                    <span className="text-sm text-gray-300 font-mono">{personalityBalance[p.key]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="100" step="5"
                    value={personalityBalance[p.key]}
                    onChange={(e) => setPersonalityBalance(prev => ({ ...prev, [p.key]: parseInt(e.target.value) }))}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-murim-darker ${p.color}`}
                  />
                </div>
              ))}
              <p className="text-[10px] text-gray-600 mt-2">* 합계 100%가 아니어도 됨 — 상대적 비중</p>
            </div>
          </section>

          {/* 감정 설계 */}
          <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pink-400" />
              감정 설계
              <span className="text-[10px] text-gray-500 font-normal">시작 → 절정 → 마무리</span>
            </h2>
            <div className="space-y-3">
              {([
                { key: 'start' as const, label: '시작', desc: '에피소드 첫 장면의 분위기' },
                { key: 'peak' as const, label: '절정', desc: '가장 강렬한 순간의 감정' },
                { key: 'end' as const, label: '마무리', desc: '독자가 마지막에 느낄 감정' },
              ]).map(phase => (
                <div key={phase.key}>
                  <label className="text-xs text-gray-500 mb-1 block">{phase.label} — <span className="text-gray-600">{phase.desc}</span></label>
                  <select
                    value={emotionDesign[phase.key]}
                    onChange={(e) => setEmotionDesign(prev => ({ ...prev, [phase.key]: e.target.value }))}
                    className="w-full bg-murim-darker border border-murim-border rounded-lg p-2.5 text-sm text-gray-300 focus:outline-none focus:border-pink-500/50"
                  >
                    {['평온', '기대', '설렘', '코미디', '긴장', '충격', '슬픔', '분노', '감동', '공포', '전투열기', '여운', '결의', '비장'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ━━━ 10.5 AI 분석 상세 (자동 제안 시에만 표시) ━━━ */}
        {aiSuggestions && (aiSuggestions.scenes?.length > 0 || aiSuggestions.emotionArc || aiSuggestions.heartLine || aiSuggestions.threadUse) && (
          <section className="bg-murim-dark rounded-xl border border-purple-500/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                AI 분석 — 추가 제안
              </h2>
              {/* 전체 삭제 */}
              <button
                onClick={() => { if (confirm('AI 분석 전체를 삭제하시겠습니까?')) setAiSuggestions(null); }}
                className="text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 px-2 py-1 rounded transition-colors"
              >
                전체 삭제
              </button>
            </div>

            {/* 핵심 장면 제안 — 개별 삭제 가능 */}
            {aiSuggestions.scenes?.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-400 mb-2">🎬 핵심 장면 제안 (5막 흐름)</h3>
                <div className="space-y-2">
                  {aiSuggestions.scenes.map((scene: any, idx: number) => (
                    <div key={idx} className="bg-murim-darker rounded-lg p-3 border-l-2 border-purple-500/50 group relative">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-purple-400 font-bold text-sm">{idx + 1}.</span>
                        <span className="text-gray-200 font-bold text-sm">{scene.name}</span>
                        <span className="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full">{scene.emotion}</span>
                        {/* 장면 개별 삭제 */}
                        <button
                          onClick={() => setAiSuggestions((prev: any) => prev ? ({
                            ...prev,
                            scenes: prev.scenes.filter((_: any, i: number) => i !== idx),
                          }) : null)}
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 px-2 py-0.5 rounded"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{scene.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 감정 곡선 — 삭제 가능 */}
            {aiSuggestions.emotionArc && (
              <div className="group relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-400">📈 감정 곡선</h3>
                  <button
                    onClick={() => setAiSuggestions((prev: any) => prev ? ({ ...prev, emotionArc: '' }) : null)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 px-2 py-0.5 rounded"
                  >
                    ✕ 삭제
                  </button>
                </div>
                <p className="text-sm text-gray-300 bg-murim-darker rounded-lg p-3 leading-relaxed">{aiSuggestions.emotionArc}</p>
              </div>
            )}

            {/* 심장라인 — 삭제 가능 */}
            {aiSuggestions.heartLine && (
              <div className="group relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-400">💎 심장라인 — 독자가 스크린샷 찍을 한 마디</h3>
                  <button
                    onClick={() => setAiSuggestions((prev: any) => prev ? ({ ...prev, heartLine: '' }) : null)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 px-2 py-0.5 rounded"
                  >
                    ✕ 삭제
                  </button>
                </div>
                <p className="text-lg text-murim-gold font-bold bg-murim-darker rounded-lg p-4 border border-murim-gold/20 text-center leading-relaxed">
                  &ldquo;{aiSuggestions.heartLine}&rdquo;
                </p>
              </div>
            )}

            {/* 복선 처리 제안 — 삭제 가능 */}
            {aiSuggestions.threadUse && (
              <div className="group relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-400">🧩 복선 처리 제안</h3>
                  <button
                    onClick={() => setAiSuggestions((prev: any) => prev ? ({ ...prev, threadUse: '' }) : null)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 px-2 py-0.5 rounded"
                  >
                    ✕ 삭제
                  </button>
                </div>
                <p className="text-sm text-gray-300 bg-murim-darker rounded-lg p-3 leading-relaxed">{aiSuggestions.threadUse}</p>
              </div>
            )}
          </section>
        )}

        {/* ━━━ 11. 추가 메모 ━━━ */}
        <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
          <h2 className="text-base font-bold text-foreground mb-3">
            추가 메모 (선택)
          </h2>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="전략 회의에서 나온 추가 사항, 주의점 등을 자유롭게 메모하세요..."
            className="w-full bg-murim-darker border border-murim-border rounded-lg p-3 text-sm text-gray-300 resize-y focus:outline-none focus:border-murim-accent/50 min-h-[200px]"
          />
        </section>

        {/* ━━━ 12. 액션 버튼 ━━━ */}
        <section className="bg-murim-dark rounded-xl border border-murim-border p-5">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* 임시 저장 */}
            <button
              onClick={() => saveBriefing(false)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-murim-darker border border-murim-border text-gray-300 hover:bg-murim-border transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              임시 저장
            </button>

            {/* 승인 */}
            <button
              onClick={() => saveBriefing(true)}
              disabled={saving || !selectedDirection || selectedCliffhanger < 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition disabled:opacity-30 ${
                approved 
                  ? 'bg-green-600 text-white'
                  : 'bg-murim-gold text-black hover:bg-murim-gold/90'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {approved ? '승인 완료' : '브리핑 승인'}
            </button>

            {/* 본문 집필로 이동 */}
            {approved && (
              <a
                href={`/dashboard/step6?episode=${briefing.nextEpisode}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-murim-accent text-white font-bold hover:bg-murim-accent/90 transition"
              >
                <ArrowRight className="w-4 h-4" />
                {briefing.episodeExists ? '본문 확인하기' : '본문 집필로 이동'}
              </a>
            )}

            {/* 저장 메시지 */}
            {saveMessage && (
              <span className={`text-sm ${saveMessage.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {saveMessage}
              </span>
            )}
          </div>

          {/* 선택 미완료 안내 */}
          {(!selectedDirection || selectedCliffhanger < 0) && (
            <p className="text-xs text-gray-500 mt-2">
              * 승인하려면 방향(A/B)과 클리프행어를 모두 선택해야 합니다
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 서브 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 상태 카드 */
function StateCard({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="bg-murim-darker rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-300 leading-snug">{value}</p>
    </div>
  );
}

/** 떡밥 카드 — onDelete가 있으면 삭제 버튼 표시 */
function ThreadCard({ thread, onDelete }: { thread: PlotThread; onDelete?: (id: string) => void }) {
  const gradeColors: Record<string, string> = {
    'S': 'text-red-400 bg-red-400/10',
    'A': 'text-orange-400 bg-orange-400/10',
    'B': 'text-yellow-400 bg-yellow-400/10',
    'C': 'text-gray-400 bg-gray-400/10',
  };

  const urgencyBorder: Record<string, string> = {
    'urgent': 'border-l-red-500',
    'active': 'border-l-yellow-500',
    'deferred': 'border-l-gray-600',
    'completed': 'border-l-green-500',
  };

  return (
    <div className={`bg-murim-darker rounded-lg p-3 border-l-4 ${urgencyBorder[thread.urgency] || 'border-l-gray-600'} group relative`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gradeColors[thread.grade] || 'text-gray-400'}`}>
          {thread.grade}등급
        </span>
        <span className="text-[10px] text-gray-600 font-mono">{thread.id}</span>
        <span className="text-[10px] text-gray-600">{thread.episodeStarted}에서 시작</span>
        <span className="text-[10px] text-gray-500">→ 목표: {thread.targetEpisode}</span>
        {/* 삭제 버튼: 마우스 올리면 나타남 */}
        {onDelete && (
          <button
            onClick={() => {
              if (confirm(`떡밥 "${thread.id}: ${thread.content}" 을(를) 보류하시겠습니까?\n\n📦 §8 아카이브로 이동됩니다. (목표 화수가 되면 자동 복원)`)) {
                onDelete(thread.id);
              }
            }}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
            title="이 떡밥 삭제"
          >
            ✕ 삭제
          </button>
        )}
      </div>
      <p className="text-sm text-gray-300">{thread.statusIcon} {thread.content}</p>
      {thread.statusText && (
        <p className="text-xs text-gray-500 mt-1">{thread.statusText}</p>
      )}
    </div>
  );
}
