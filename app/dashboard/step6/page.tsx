'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Sparkles, Save, ChevronLeft, ChevronRight, Users, Download, RotateCcw, Brain, Activity, CheckCircle, XCircle } from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 6: 본문 집필 - 화산귀환 스타일 소설 생성기]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Step 4의 5,000자 최종 설계도를 바탕으로 실제 소설 본문 생성
 * - 5막 구조: 도입 → 전개 → 위기 → 절정 → 마무리
 * - 페르소나 필터: 캐릭터별 말투/성격 자동 적용
 * - 자동 저장 + Supabase 저장 지원
 */

// ── 5막 구조 탭 정의 ──
const SECTION_TABS = [
  { key: 'full', label: '전체 생성', icon: '📖', desc: '5막 전체를 한 번에 생성' },
  { key: 'intro', label: '제1막: 도입', icon: '🌅', desc: '분위기 조성, 상황 설정' },
  { key: 'development', label: '제2막: 전개', icon: '⚔️', desc: '갈등 심화, 충돌 시작' },
  { key: 'crisis', label: '제3막: 위기', icon: '🔥', desc: '결정적 위기, 선택의 기로' },
  { key: 'climax', label: '제4막: 절정', icon: '💥', desc: '최대 긴장, 액션/반전' },
  { key: 'ending', label: '제5막: 마무리', icon: '🌙', desc: '여운, 절단신공' },
];

export default function Step6Page() {
  // ── 상태 관리 ──
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [blueprint, setBlueprint] = useState('');        // Step 4 설계도
  const [content, setContent] = useState('');             // 생성된 본문
  const [activeSection, setActiveSection] = useState('full');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]); // 등장 캐릭터
  const [previousSummary, setPreviousSummary] = useState('');
  const [showCharPanel, setShowCharPanel] = useState(false);
  const [showBlueprintPanel, setShowBlueprintPanel] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);  // 기억 시스템 패널
  const [episodes, setEpisodes] = useState<any[]>([]);    // Step 3 에피소드 목록
  const [savedEpisodes, setSavedEpisodes] = useState<Record<number, string>>({}); // 저장된 본문들
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // ── ★ 3-Level AI 모델 선택 + 비용 추적 ──
  const [aiLevel, setAiLevel] = useState<1 | 2 | 3>(1);  // 기본: Level 1 (Gemini Flash, 거의 무료)
  const [costInfo, setCostInfo] = useState<any>(null);     // API 응답의 비용 정보
  const [totalSessionCost, setTotalSessionCost] = useState(0);  // 이번 세션 누적 비용

  // Level 정보 (UI 표시용)
  const AI_LEVEL_INFO = {
    1: { name: 'Lv.1 초안', model: 'Gemini 3 Pro', cost: '~$0.25/화', color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700', desc: '고품질 초안. 규칙 준수율 높음' },
    2: { name: 'Lv.2 다듬기', model: 'Claude Sonnet', cost: '~$0.80/화', color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-700', desc: '가성비 좋음. 다듬기용' },
    3: { name: 'Lv.3 최종', model: 'Claude Opus', cost: '~$2.00/화', color: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-700', desc: '최고 품질. 최종 퇴고용' },
  };

  // ── Memory System 상태 (신규) ──
  const [memoryDashboard, setMemoryDashboard] = useState<any>(null);
  const [memoryCards, setMemoryCards] = useState<any[]>([]);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [memoryError, setMemoryError] = useState('');

  // ── ★ 설계도 자동 세팅 상태 ──
  const [isLoadingBlueprint, setIsLoadingBlueprint] = useState(false);

  // ── ★★ AI 작가 파이프라인 상태 ──
  const [structureDesign, setStructureDesign] = useState('');        // 구조 설계 결과
  const [isStructuring, setIsStructuring] = useState(false);         // 구조 설계 중
  const [structureCost, setStructureCost] = useState(0);             // 구조 설계 비용
  const [epCheckResults, setEpCheckResults] = useState<any>(null);   // EP 검사 결과
  const [isEpChecking, setIsEpChecking] = useState(false);           // EP 검사 중
  const [epCheckCost, setEpCheckCost] = useState(0);                 // EP 검사 비용
  const [pipelineStep, setPipelineStep] = useState<'read' | 'blueprint' | 'structure' | 'generate' | 'check' | 'done'>('blueprint'); // 현재 파이프라인 단계 (read=읽기전용)

  // ── ★★ A/B 테스트 모드 ──
  const [premiumMode, setPremiumMode] = useState(false);             // false=A표준, true=B프리미엄

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    // Step 3 에피소드 목록 불러오기
    const step3Data = localStorage.getItem('novel_episodes_skeletons');
    if (step3Data) {
      try {
        const parsed = JSON.parse(step3Data);
        setEpisodes(parsed);
        if (parsed.length > 0 && parsed[0].title) {
          setEpisodeTitle(parsed[0].title);
        }
      } catch (e) {
        console.warn('Step 3 데이터 로드 실패:', e);
      }
    }

    // Step 4 설계도 불러오기 (화별 저장소 우선)
    const step4AllData = localStorage.getItem('novel_step4_all_designs');
    if (step4AllData) {
      try {
        const allDesigns = JSON.parse(step4AllData);
        // 현재 화의 설계도를 우선 로드, 없으면 레거시 폴백
        const epDesigns = allDesigns[1] || {}; // 초기 로드 시 1화
        const finalDesign = epDesigns[5] || epDesigns[4] || epDesigns[3] || epDesigns[2] || epDesigns[1] || '';
        if (finalDesign) setBlueprint(finalDesign);
      } catch (e) {
        console.warn('Step 4 화별 데이터 로드 실패:', e);
      }
    }
    // 레거시 폴백
    if (!blueprint) {
      const step4Data = localStorage.getItem('novel_step4_designs');
      if (step4Data) {
        try {
          const designs = JSON.parse(step4Data);
          const finalDesign = designs[5] || designs[4] || designs[3] || designs[2] || designs[1] || '';
          setBlueprint(finalDesign);
        } catch (e) {
          console.warn('Step 4 레거시 데이터 로드 실패:', e);
        }
      }
    }

    // ★ 파일에서 에피소드 목록 로드 (원본 = 파일)
    loadEpisodesFromFiles();

    // Supabase에서 캐릭터 불러오기
    loadCharacters();
    // Memory System 데이터 로드
    loadMemoryData();
  }, []);

  // ── ★ 파일에서 에피소드 목록 로드 (원본 = 파일, 폴백 = DB) ──
  const loadEpisodesFromFiles = async () => {
    try {
      const res = await fetch('/api/load-episode?list=true');
      const data = await res.json();
      if (data.success && data.episodes?.length > 0) {
        // 파일에서 가져온 에피소드를 savedEpisodes에 등록 (번호만 기록, 내용은 화별 로드)
        const episodeMap: Record<number, string> = {};
        for (const ep of data.episodes) {
          episodeMap[ep.number] = `__file__${ep.charCount}`; // 파일 존재 마커
        }
        setSavedEpisodes(episodeMap);
        console.log(`✅ 파일에서 ${data.episodes.length}화 목록 로드 (최신: ${data.maxEpisode}화)`);
      }
    } catch (e) {
      console.warn('⚠️ 파일 목록 로드 실패, localStorage 폴백:', e);
      // 폴백: localStorage에서 읽기
      const savedData = localStorage.getItem('novel_step6_episodes');
      if (savedData) {
        try { setSavedEpisodes(JSON.parse(savedData)); } catch {}
      }
    }
  };

  // ── ★ 특정 화 본문 로드 (파일 → DB → 없음) ──
  const loadEpisodeContent = async (epNum: number) => {
    try {
      const res = await fetch(`/api/load-episode?episode=${epNum}`);
      const data = await res.json();

      if (data.success && data.found && data.content) {
        setContent(data.content);
        // savedEpisodes에도 반영 (화 번호 표시용)
        setSavedEpisodes(prev => ({ ...prev, [epNum]: data.content }));
        setPipelineStep('read');     // 이미 쓴 화 = 읽기 모드
        console.log(`📖 제${epNum}화 로드 (${data.source}, ${data.charCount}자)`);
      } else {
        setContent('');
        setPipelineStep('blueprint');  // 본문 없으면 작업 모드
      }
    } catch (e) {
      console.warn(`⚠️ 제${epNum}화 로드 실패:`, e);
      setContent('');
      setPipelineStep('blueprint');
    }
  };

  // ── Memory System 데이터 로드 (대시보드 + 기억카드) ──
  const loadMemoryData = useCallback(async () => {
    setMemoryError('');
    try {
      // 대시보드와 기억카드를 동시 로드
      const [dashRes, cardsRes] = await Promise.all([
        fetch('/api/novel-dashboard'),
        fetch('/api/memory-card'),
      ]);

      const dashData = await dashRes.json();
      const cardsData = await cardsRes.json();

      if (dashData.success && dashData.dashboard) {
        setMemoryDashboard(dashData.dashboard);
      }

      if (cardsData.success && cardsData.cards) {
        setMemoryCards(cardsData.cards);
        // 직전 화 기억카드가 있으면 이전 화 요약에 자동 세팅
        const prevCard = cardsData.cards.find((c: any) => c.episode_number === episodeNumber - 1);
        if (prevCard && !previousSummary) {
          const autoSummary = buildPreviousSummary(prevCard);
          setPreviousSummary(autoSummary);
        }
      }

      setMemoryLoaded(true);
    } catch (err: any) {
      setMemoryError('Memory 로드 실패: ' + err.message);
      setMemoryLoaded(false);
    }
  }, [episodeNumber]);

  // ── 기억카드에서 이전 화 요약 자동 생성 ──
  const buildPreviousSummary = (card: any): string => {
    const parts: string[] = [];
    if (card.episode_title) parts.push(`[제${card.episode_number}화: ${card.episode_title}]`);
    if (card.when_summary) parts.push(`시간: ${card.when_summary}`);
    if (card.where_summary) parts.push(`장소: ${card.where_summary}`);
    if (card.what_summary) parts.push(`사건: ${card.what_summary}`);
    if (card.state_changes) parts.push(`상태변화: ${card.state_changes}`);
    if (card.next_episode_hook) parts.push(`다음 화 연결: ${card.next_episode_hook}`);
    return parts.join('\n');
  };

  // ── 화수 변경 시 데이터 연동 ──
  useEffect(() => {
    // 해당 화의 제목 업데이트
    if (episodes.length > 0 && episodes[episodeNumber - 1]) {
      setEpisodeTitle(episodes[episodeNumber - 1].title || `제${episodeNumber}화`);
    }
    // ★ 파일에서 본문 로드 (원본 = 파일)
    // 생성 중일 때는 로드하지 않음 (race condition 방지: autoSave → savedEpisodes 변경 → 파일 아직 미저장 → content 초기화 방지)
    if (!isGenerating) {
      loadEpisodeContent(episodeNumber);
    }

    // 해당 화의 설계도 로드 (Step4 저장 → manual 저장 → auto 저장 순서)
    if (typeof window !== 'undefined') {
      const step4AllData = localStorage.getItem('novel_step4_all_designs');
      let foundDesign = '';
      if (step4AllData) {
        try {
          const allDesigns = JSON.parse(step4AllData);
          const epDesigns = allDesigns[episodeNumber] || {};
          // Step4 5단계 → manual 직접입력 → auto 자동세팅 순서로 찾기
          foundDesign = epDesigns[5] || epDesigns[4] || epDesigns[3] || epDesigns[2] || epDesigns[1] || epDesigns['manual'] || epDesigns['auto'] || '';
        } catch (e) {
          console.warn(`제${episodeNumber}화 설계도 로드 실패:`, e);
        }
      }
      setBlueprint(foundDesign);
    }

    // 직전 화 기억카드 자동 로드
    const prevCard = memoryCards.find((c: any) => c.episode_number === episodeNumber - 1);
    if (prevCard) {
      setPreviousSummary(buildPreviousSummary(prevCard));
    } else if (episodeNumber === 1) {
      setPreviousSummary(''); // 1화는 이전 화 없음
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeNumber, episodes, memoryCards]);

  // ── 캐릭터 로드 (Supabase) ──
  const loadCharacters = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return;

      const supabase = createClient(url, key);
      const { data } = await supabase
        .from('characters')
        .select('name, title, faction, role, speech_style, catchphrase, personality, martial_rank, weapon')
        .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .in('role', ['주인공', '주요 조연'])
        .order('importance_score', { ascending: false })
        .limit(20);

      if (data) {
        setCharacters(data);
        console.log(`✅ 주요 캐릭터 ${data.length}명 로드`);
      }
    } catch (e) {
      console.warn('캐릭터 로드 실패:', e);
    }
  };

  // ── 본문 생성 (AI 호출) ──
  const handleGenerate = async () => {
    if (!blueprint) {
      alert('❌ Step 4의 최종 설계도가 필요합니다.\n\nStep 4에서 먼저 5000자 설계도를 완성해주세요.');
      return;
    }

    if (content && !confirm(`현재 작성된 본문이 있습니다.\n새로 생성하면 덮어씁니다.\n\n계속하시겠습니까?`)) {
      return;
    }

    setIsGenerating(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 360000); // 6분 타임아웃 (품질 엔진 + AI 에디터 포함)

      // Memory System 컨텍스트 구성
      const memoryContext = memoryDashboard ? {
        storyDate: memoryDashboard.story_date,
        season: memoryDashboard.season,
        currentLocation: memoryDashboard.current_location,
        mcHealth: memoryDashboard.mc_health,
        mcMartialRank: memoryDashboard.mc_martial_rank,
        mcMoney: memoryDashboard.mc_money,
        mcEmotion: memoryDashboard.mc_emotion,
        mcInjury: memoryDashboard.mc_injury,
        mcCurrentGoal: memoryDashboard.mc_current_goal,
        personalityMain: memoryDashboard.personality_main,
        personalityLee: memoryDashboard.personality_lee,
        personalityChunma: memoryDashboard.personality_chunma,
        activeForeshadows: memoryDashboard.active_foreshadows,
        cautions: memoryDashboard.cautions,
      } : null;

      const response = await fetch('/api/generate-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber,
          episodeTitle,
          blueprint,
          structureDesign,                      // ★ [파이프라인] 구조 설계 전달
          premiumMode,                          // ★ [A/B 테스트] B모드 여부
          section: activeSection,
          aiLevel,                              // ★ 선택한 AI Level 전달
          characters: characters.slice(0, 10), // 주요 캐릭터 10명
          previousEpisodeSummary: previousSummary,
          memoryContext,  // 현재 상태 대시보드 데이터
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API 오류 (${response.status})`);
      }

      const data = await response.json();

      if (data.success) {
        if (activeSection === 'full') {
          setContent(data.episode.content);
        } else {
          // 부분 생성: 기존 내용에 추가
          setContent(prev => prev ? prev + '\n\n***\n\n' + data.episode.content : data.episode.content);
        }

        // ★ 파일 + DB에 저장 (await로 완료 보장 → 이후 savedEpisodes 업데이트)
        try {
          const saveRes = await fetch('/api/save-episode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ episodeNumber, episodeTitle, content: data.episode.content }),
          });
          const saveData = await saveRes.json();
          setSaveStatus(saveData.message || '');
          console.log('📁 AI 생성 후 자동 저장:', saveData.message);
        } catch (e) {
          console.warn('⚠️ 파일/DB 저장 실패:', e);
        }
        // ★ localStorage에도 저장 (파일 저장 완료 후 → race condition 방지)
        autoSave(data.episode.content);

        // ★ 비용 정보 저장 + 누적
        if (data.costInfo) {
          setCostInfo(data.costInfo);
          setTotalSessionCost(prev => prev + (data.costInfo.estimatedCostUSD || 0));
        }

        console.log(`✅ 제${episodeNumber}화 생성 완료 (${data.episode.charCount}자)`);
        setPipelineStep('check');  // ★ 파이프라인: 생성 완료 → EP 검사 단계로

        // ★★ 전체 생성 완료 시 → 소설_진행_마스터.md 자동 업데이트
        if (activeSection === 'full' && data.episode.content) {
          updateMasterFile(episodeNumber, episodeTitle, data.episode.content);
        }
      } else {
        throw new Error(data.message || 'AI 생성 실패');
      }
    } catch (error: any) {
      console.error('❌ 생성 오류:', error);

      if (error.name === 'AbortError') {
        alert('⏱️ 생성 시간이 초과되었습니다. (6분)\n\n품질 엔진이 포함되어 시간이 걸릴 수 있습니다.\n네트워크 상태를 확인하고 다시 시도해주세요.');
      } else {
        alert(`❌ 생성 실패: ${error.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // ── 자동 저장 (localStorage) ──
  const autoSave = (text?: string) => {
    const textToSave = text || content;
    if (!textToSave) return;

    const updated = { ...savedEpisodes, [episodeNumber]: textToSave };
    setSavedEpisodes(updated);
    localStorage.setItem('novel_step6_episodes', JSON.stringify(updated));
  };

  // ── 수동 저장 (localStorage + 파일 + DB 동시) ──
  const [saveStatus, setSaveStatus] = useState('');
  const handleSave = async () => {
    if (!content) {
      alert('저장할 내용이 없습니다.');
      return;
    }
    setIsSaving(true);
    setSaveStatus('');

    // 1. localStorage (즉시)
    autoSave();

    // 2. 파일 + DB (API 호출)
    try {
      const res = await fetch('/api/save-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber,
          episodeTitle,
          content,
        }),
      });
      const data = await res.json();
      setSaveStatus(data.message || '저장 완료');
      console.log(`💾 제${episodeNumber}화 저장 완료:`, data.message);
    } catch (e: any) {
      setSaveStatus(`⚠️ 파일/DB 저장 실패 (localStorage는 저장됨)`);
      console.error('저장 오류:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 텍스트 파일로 내보내기 ──
  const handleExport = () => {
    if (!content) {
      alert('내보낼 내용이 없습니다.');
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `제${episodeNumber}화_${episodeTitle || '무제'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── 순수 글자수 계산 (공백/제목 제외) ──
  const getCharCount = (text: string): number => {
    if (!text) return 0;
    return text.replace(/\s+/g, '').length;
  };

  // ── ★★ 소설_진행_마스터.md 자동 업데이트 (생성 완료 후 호출) ──
  const [isMasterUpdating, setIsMasterUpdating] = useState(false);
  const [masterUpdateResult, setMasterUpdateResult] = useState<string>('');

  const updateMasterFile = async (epNum: number, epTitle: string, epContent: string) => {
    setIsMasterUpdating(true);
    setMasterUpdateResult('📝 소설_진행_마스터.md 업데이트 중...');
    try {
      const res = await fetch('/api/update-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber: epNum,
          episodeTitle: epTitle,
          episodeContent: epContent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMasterUpdateResult(`✅ 마스터 업데이트 완료! (백업: ${data.details?.backupFile})`);
        // 비용 누적
        if (data.costInfo?.estimatedCostUSD) {
          setTotalSessionCost(prev => prev + data.costInfo.estimatedCostUSD);
        }
        console.log('✅ 소설_진행_마스터.md 자동 업데이트 완료');
      } else {
        setMasterUpdateResult(`⚠️ 마스터 업데이트 실패: ${data.message}`);
        console.warn('마스터 업데이트 실패:', data.message);
      }
    } catch (err: any) {
      setMasterUpdateResult(`❌ 마스터 업데이트 오류: ${err.message}`);
      console.error('마스터 업데이트 오류:', err);
    } finally {
      setIsMasterUpdating(false);
    }
  };

  // ── ★ 설계도 자동 세팅 (소설_진행_마스터에서 로딩) ──
  const handleAutoBlueprint = async () => {
    setIsLoadingBlueprint(true);
    try {
      const res = await fetch(`/api/auto-blueprint?episode=${episodeNumber}`);
      const data = await res.json();
      if (data.success && data.blueprint) {
        setBlueprint(data.blueprint);
        // localStorage에도 저장
        const saved = JSON.parse(localStorage.getItem('novel_step4_all_designs') || '{}');
        if (!saved[episodeNumber]) saved[episodeNumber] = {};
        saved[episodeNumber]['auto'] = data.blueprint;
        localStorage.setItem('novel_step4_all_designs', JSON.stringify(saved));
        alert(`✅ 제${episodeNumber}화 설계도 자동 세팅 완료! (${data.blueprint.length}자)`);
      } else {
        alert(`⚠️ ${data.message || '설계도를 찾을 수 없습니다.'}\n\n직접 입력해주세요.`);
      }
    } catch (err: any) {
      alert(`❌ 설계도 로딩 실패: ${err.message}`);
    } finally {
      setIsLoadingBlueprint(false);
    }
  };

  // ── ★★ [파이프라인 Step B] 구조 설계 호출 ──
  const handleStructureDesign = async () => {
    if (!blueprint || blueprint.length < 50) {
      alert('❌ 먼저 설계도를 작성하세요. (최소 50자)');
      return;
    }
    setIsStructuring(true);
    try {
      const res = await fetch('/api/structure-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber,
          episodeTitle,
          blueprint,
        }),
      });
      const data = await res.json();
      if (data.success && data.structure) {
        setStructureDesign(data.structure);
        if (data.costInfo?.estimatedCostUSD) {
          setStructureCost(data.costInfo.estimatedCostUSD);
          setTotalSessionCost(prev => prev + data.costInfo.estimatedCostUSD);
        }
        setPipelineStep('structure');
      } else {
        alert(`⚠️ 구조 설계 실패: ${data.message}`);
      }
    } catch (err: any) {
      alert(`❌ 구조 설계 오류: ${err.message}`);
    } finally {
      setIsStructuring(false);
    }
  };

  // ── ★★ [파이프라인 Step D] EP 규칙 검사 ──
  const handleEpCheck = async () => {
    if (!content || content.length < 500) {
      alert('❌ 검사할 본문이 부족합니다. (최소 500자)');
      return;
    }
    setIsEpChecking(true);
    setEpCheckResults(null);
    try {
      const res = await fetch('/api/ep-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeNumber,
          content,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEpCheckResults(data);
        if (data.costInfo?.estimatedCostUSD) {
          setEpCheckCost(data.costInfo.estimatedCostUSD);
          setTotalSessionCost(prev => prev + data.costInfo.estimatedCostUSD);
        }
        setPipelineStep('done');
      } else {
        alert(`⚠️ EP 검사 실패: ${data.message}`);
      }
    } catch (err: any) {
      alert(`❌ EP 검사 오류: ${err.message}`);
    } finally {
      setIsEpChecking(false);
    }
  };

  // ── 이전/다음 화 이동 ──
  const goToEpisode = (num: number) => {
    if (content && content !== savedEpisodes[episodeNumber]) {
      autoSave();
    }
    setEpisodeNumber(num);
    // ★ 파이프라인 상태 초기화 (본문 유무는 useEffect에서 판단)
    setStructureDesign('');
    setEpCheckResults(null);
    setMasterUpdateResult('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* ━━━ 상단 헤더 ━━━ */}
      <div className="shrink-0 p-6 border-b border-murim-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BookOpen className="w-8 h-8 text-murim-gold" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Step 6: 본문 집필</h1>
              <p className="text-sm text-gray-500">화산귀환 스타일 소설 생성 엔진</p>
            </div>
          </div>

          {/* 화수 네비게이션 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => goToEpisode(Math.max(1, episodeNumber - 1))}
              disabled={episodeNumber <= 1}
              className="p-2 rounded-lg bg-murim-darker border border-murim-border hover:border-murim-gold disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">제</span>
              <input
                type="number"
                value={episodeNumber}
                onChange={(e) => {
                  const num = parseInt(e.target.value) || 1;
                  goToEpisode(Math.max(1, Math.min(300, num)));
                }}
                className="w-16 px-2 py-1 text-center bg-murim-darker border border-murim-border rounded-lg text-foreground text-lg font-bold focus:outline-none focus:border-murim-gold"
                min={1}
                max={300}
              />
              <span className="text-sm text-gray-500">화</span>
            </div>

            <button
              onClick={() => goToEpisode(Math.min(300, episodeNumber + 1))}
              disabled={episodeNumber >= 300}
              className="p-2 rounded-lg bg-murim-darker border border-murim-border hover:border-murim-gold disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {/* 저장된 화 표시 */}
            <span className="text-xs text-gray-600 ml-2">
              저장: {Object.keys(savedEpisodes).length}화
            </span>
          </div>
        </div>

        {/* 화 제목 */}
        <div className="mt-3">
          <input
            type="text"
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            placeholder="화 제목을 입력하세요..."
            className="w-full px-4 py-2 bg-murim-darker border border-murim-border rounded-lg text-foreground text-lg focus:outline-none focus:border-murim-accent"
          />
        </div>

        {/* ★ 에피소드 목록 (클릭으로 바로 이동) + 다음 화 쓰기 버튼 */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1">📖 저장된 화:</span>
          {Object.keys(savedEpisodes)
            .map(Number)
            .sort((a, b) => a - b)
            .map((epNum) => (
              <button
                key={epNum}
                onClick={() => goToEpisode(epNum)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  epNum === episodeNumber
                    ? 'bg-murim-gold text-black shadow-lg shadow-murim-gold/20'
                    : 'bg-murim-darker border border-murim-border text-gray-400 hover:border-murim-gold hover:text-murim-gold'
                }`}
              >
                {epNum}화
              </button>
            ))}
          {/* ★ 다음 화 쓰기 버튼 — 마지막 저장 화 +1로 이동 */}
          <button
            onClick={() => {
              const maxEp = Math.max(...Object.keys(savedEpisodes).map(Number), 0);
              goToEpisode(maxEp + 1);
            }}
            className="px-2.5 py-1 rounded-md text-xs font-bold bg-murim-accent/20 border border-murim-accent/50 text-murim-accent hover:bg-murim-accent/30 transition-all"
          >
            + {Math.max(...Object.keys(savedEpisodes).map(Number), 0) + 1}화 쓰기
          </button>
        </div>
      </div>

      {/* ━━━ 메인 영역 ━━━ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── 좌측: 참고 패널 (접이식) ── */}
        <div className={`shrink-0 border-r border-murim-border transition-all duration-300 overflow-y-auto ${showBlueprintPanel || showCharPanel || showMemoryPanel ? 'w-80' : 'w-12'}`}>
          {/* 패널 토글 버튼들 */}
          <div className="flex flex-col gap-1 p-1">
            {/* Memory System 버튼 (최상단) */}
            <button
              onClick={() => { setShowMemoryPanel(!showMemoryPanel); setShowBlueprintPanel(false); setShowCharPanel(false); }}
              className={`p-2 rounded-lg text-xs font-medium transition-colors relative ${showMemoryPanel ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              title="기억 시스템"
            >
              {showMemoryPanel ? '🧠 기억' : '🧠'}
              {/* Memory 로드 상태 표시 */}
              {memoryLoaded && !showMemoryPanel && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full" />
              )}
            </button>
            <button
              onClick={() => { setShowBlueprintPanel(!showBlueprintPanel); setShowCharPanel(false); setShowMemoryPanel(false); }}
              className={`p-2 rounded-lg text-xs font-medium transition-colors ${showBlueprintPanel ? 'bg-murim-accent text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              title="설계도 보기"
            >
              {showBlueprintPanel ? '📋 설계도' : '📋'}
            </button>
            <button
              onClick={() => { setShowCharPanel(!showCharPanel); setShowBlueprintPanel(false); setShowMemoryPanel(false); }}
              className={`p-2 rounded-lg text-xs font-medium transition-colors ${showCharPanel ? 'bg-murim-accent text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              title="캐릭터 보기"
            >
              {showCharPanel ? '👤 캐릭터' : '👤'}
            </button>
          </div>

          {/* ━━━ Memory System 패널 (신규) ━━━ */}
          {showMemoryPanel && (
            <div className="p-3 space-y-3">
              <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                기억 시스템
              </h3>

              {/* Memory 로드 상태 */}
              <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${memoryLoaded ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                {memoryLoaded ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {memoryLoaded ? 'Memory 로드 완료' : memoryError || 'Memory 미연결'}
              </div>

              {/* 현재 상태 요약 */}
              {memoryDashboard && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    현재 상태 (제{memoryDashboard.latest_episode}화 후)
                  </h4>
                  <div className="text-xs text-gray-500 space-y-1 p-2 bg-black/20 rounded-lg">
                    <p>시간: {memoryDashboard.story_date}</p>
                    <p>위치: {memoryDashboard.current_location}</p>
                    <p>체력: {memoryDashboard.mc_health}</p>
                    <p>무공: {memoryDashboard.mc_martial_rank}</p>
                    <p>자산: {memoryDashboard.mc_money}</p>
                    <p>감정: {memoryDashboard.mc_emotion}</p>
                    {memoryDashboard.mc_injury && <p>부상: {memoryDashboard.mc_injury}</p>}
                    <p>목표: {memoryDashboard.mc_current_goal}</p>
                  </div>

                  {/* 주의사항 */}
                  {memoryDashboard.cautions && (
                    <div className="p-2 bg-red-900/10 border border-red-900/30 rounded-lg">
                      <h4 className="text-xs font-bold text-red-400 mb-1">주의사항</h4>
                      <p className="text-xs text-gray-400 whitespace-pre-wrap">{memoryDashboard.cautions}</p>
                    </div>
                  )}

                  {/* 활성 복선 */}
                  {memoryDashboard.active_foreshadows && (
                    <div className="p-2 bg-orange-900/10 border border-orange-900/30 rounded-lg">
                      <h4 className="text-xs font-bold text-orange-400 mb-1">활성 복선</h4>
                      <p className="text-xs text-gray-400 whitespace-pre-wrap">{memoryDashboard.active_foreshadows}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 이전 화 기억카드 */}
              {episodeNumber > 1 && (
                <div className="border-t border-murim-border pt-2">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1 mb-2">
                    <Brain className="w-3 h-3" />
                    제{episodeNumber - 1}화 기억카드
                  </h4>
                  {memoryCards.find(c => c.episode_number === episodeNumber - 1) ? (
                    <div className="text-xs text-gray-500 p-2 bg-black/20 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {previousSummary || '(요약 없음)'}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 p-2 text-center">
                      제{episodeNumber - 1}화 기억카드 없음
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={loadMemoryData}
                className="w-full px-3 py-1.5 text-xs bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 rounded-lg transition-colors"
              >
                새로고침
              </button>
            </div>
          )}

          {/* 설계도 패널 — 직접 편집 + 자동 세팅 가능 */}
          {showBlueprintPanel && (
            <div className="p-3 space-y-3">
              <h3 className="text-sm font-bold text-murim-gold">제{episodeNumber}화 설계도</h3>

              {/* ★ 설계도 자동 세팅 버튼 */}
              <button
                onClick={handleAutoBlueprint}
                disabled={isLoadingBlueprint}
                className="w-full px-3 py-2 text-xs bg-murim-gold/20 hover:bg-murim-gold/30 text-murim-gold border border-murim-gold/30 rounded-lg transition-colors disabled:opacity-50 font-semibold"
              >
                {isLoadingBlueprint ? '⏳ 설계도 로딩 중...' : '⚡ 소설_진행_마스터에서 자동 세팅'}
              </button>

              {/* ★ 설계도 직접 편집 가능 textarea */}
              <textarea
                value={blueprint}
                onChange={(e) => setBlueprint(e.target.value)}
                placeholder={`제${episodeNumber}화 설계도를 입력하세요...\n\n예시:\n- 이번 화 핵심 사건\n- 등장 캐릭터\n- 감정 흐름\n- 엔딩 훅\n\n(최소 100자 이상)`}
                className="w-full h-96 p-3 text-xs text-gray-300 bg-black/30 border border-murim-border rounded-lg resize-y focus:outline-none focus:border-murim-gold leading-relaxed"
              />
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{blueprint.length}자 {blueprint.length >= 100 ? '✅' : '(최소 100자)'}</span>
                {blueprint && (
                  <button
                    onClick={() => {
                      // localStorage에 화별 설계도 저장
                      const saved = JSON.parse(localStorage.getItem('novel_step4_all_designs') || '{}');
                      if (!saved[episodeNumber]) saved[episodeNumber] = {};
                      saved[episodeNumber]['manual'] = blueprint;
                      localStorage.setItem('novel_step4_all_designs', JSON.stringify(saved));
                      alert('✅ 설계도 저장 완료');
                    }}
                    className="text-murim-accent hover:underline"
                  >
                    💾 설계도 저장
                  </button>
                )}
              </div>

              {/* 이전 화 요약 입력 */}
              <div className="border-t border-murim-border pt-3">
                <h4 className="text-xs font-bold text-gray-500 mb-2">이전 화 요약 (선택)</h4>
                <textarea
                  value={previousSummary}
                  onChange={(e) => setPreviousSummary(e.target.value)}
                  placeholder="이전 화의 핵심 내용을 요약해 주세요. AI가 자연스럽게 연결합니다."
                  className="w-full h-24 px-2 py-1 bg-black/30 border border-murim-border rounded text-xs text-gray-400 resize-none focus:outline-none focus:border-murim-accent"
                />
              </div>
            </div>
          )}

          {/* 캐릭터 패널 */}
          {showCharPanel && (
            <div className="p-3 space-y-2">
              <h3 className="text-sm font-bold text-murim-gold flex items-center gap-2">
                <Users className="w-4 h-4" />
                주요 캐릭터 ({characters.length}명)
              </h3>
              {characters.length > 0 ? (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {characters.map((char, idx) => (
                    <div key={idx} className="p-2 bg-black/20 rounded-lg border border-murim-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">
                          {char.name}
                          {char.title && <span className="text-murim-gold text-xs ml-1">({char.title})</span>}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-murim-gold/20 text-murim-gold rounded">
                          {char.role}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                        {char.faction && <p>{char.faction} · {char.martial_rank}</p>}
                        {char.speech_style && <p>말투: {char.speech_style}</p>}
                        {char.catchphrase && <p>입버릇: &quot;{char.catchphrase}&quot;</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 p-4 text-center">
                  Supabase에서 캐릭터를 불러오는 중...
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 중앙: 에디터 ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* 5막 구조 탭 */}
          <div className="shrink-0 flex gap-1 p-2 border-b border-murim-border overflow-x-auto">
            {SECTION_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === tab.key
                    ? 'bg-murim-gold text-murim-darker'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={tab.desc}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ★★ 에디터 본체 — 파이프라인 단계별 표시 */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">

            {/* ━━━ 읽기 모드: 이미 작성된 화 (바로 편집 가능) ━━━ */}
            {pipelineStep === 'read' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* 읽기 모드 헤더 */}
                <div className="shrink-0 flex items-center justify-between mb-3 px-1">
                  <h2 className="text-lg font-bold text-foreground">
                    📖 제{episodeNumber}화 {episodeTitle && `— ${episodeTitle}`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {content.replace(/\s/g, '').length.toLocaleString()}자
                    </span>
                    {content !== savedEpisodes[episodeNumber] && (
                      <span className="text-xs text-yellow-400 font-bold animate-pulse">● 수정됨</span>
                    )}
                    {content !== savedEpisodes[episodeNumber] && (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-xs bg-murim-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? '⏳ 저장 중...' : '💾 저장'}
                      </button>
                    )}
                    {saveStatus && (
                      <span className={`text-[10px] ${saveStatus.includes('✅') ? 'text-green-400' : 'text-yellow-400'}`}>
                        {saveStatus}
                      </span>
                    )}
                    <button
                      onClick={() => setPipelineStep('blueprint')}
                      className="px-3 py-1.5 text-xs bg-murim-dark border border-murim-border text-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      🔧 작업 도구
                    </button>
                    {/* ★ 에피소드 확정 버튼 — AI 분석 → 기억카드 + 대시보드 자동 업데이트 */}
                    <button
                      onClick={async () => {
                        if (!content || content.length < 100) { alert('본문이 너무 짧습니다.'); return; }
                        if (!confirm(`제${episodeNumber}화를 확정하시겠습니까?\n\nAI가 본문을 분석하여 기억 카드와 대시보드를 자동 업데이트합니다.`)) return;
                        setIsSaving(true);
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
                          setIsSaving(false);
                        }
                      }}
                      disabled={isSaving || !content}
                      className="px-3 py-1.5 text-xs bg-green-900/40 border border-green-600 text-green-400 hover:bg-green-900/60 hover:text-green-300 rounded-lg transition-colors font-bold disabled:opacity-50"
                    >
                      {isSaving ? '⏳ AI 분석중...' : '✅ 확정하기'}
                    </button>
                    {/* 본문이 있는 에피소드만 폐기 가능 */}
                    {content && (
                      <button
                        onClick={async () => {
                          if (!confirm(`제${episodeNumber}화를 폐기하시겠습니까?\n(파일은 복원 가능하게 보관됩니다)`)) return;
                          try {
                            const res = await fetch(`/api/delete-episode?episode=${episodeNumber}`, { method: 'DELETE' });
                            const data = await res.json();
                            if (data.success) {
                              alert(data.message);
                              setContent('');
                              setSavedEpisodes(prev => { const next = {...prev}; delete next[episodeNumber]; return next; });
                              setPipelineStep('blueprint');
                              loadEpisodesFromFiles();
                            } else {
                              alert('폐기 실패: ' + data.message);
                            }
                          } catch (e: any) {
                            alert('오류: ' + e.message);
                          }
                        }}
                        className="px-3 py-1.5 text-xs bg-red-900/30 border border-red-700 text-red-400 hover:bg-red-900/50 hover:text-red-300 rounded-lg transition-colors"
                      >
                        🗑️ 폐기
                      </button>
                    )}
                  </div>
                </div>
                {/* 본문 편집 영역: 읽기 느낌이지만 클릭하면 바로 수정 가능 */}
                <div className="flex-1 overflow-hidden bg-murim-darker border border-murim-border rounded-lg">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full p-8 bg-transparent text-foreground font-serif text-base leading-[2.2] tracking-wide resize-none focus:outline-none max-w-3xl mx-auto block"
                    style={{ caretColor: '#d4a853' }}
                    spellCheck={false}
                  />
                </div>
              </div>
            )}

            {/* ━━━ A/B 모드 토글 + 파이프라인 진행 표시 바 (작업 모드에서만 표시) ━━━ */}
            {pipelineStep !== 'read' && (
            <div className="shrink-0 mb-3 px-1 space-y-2">
              {/* A/B 모드 스위치 */}
              <div className="flex items-center gap-3 p-2 rounded-lg bg-murim-darker border border-murim-border">
                <span className="text-xs text-gray-400 font-medium">모드:</span>
                <button
                  onClick={() => setPremiumMode(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    !premiumMode
                      ? 'bg-green-600 text-white shadow-lg shadow-green-900/30'
                      : 'bg-murim-darker text-gray-500 border border-murim-border hover:text-gray-300'
                  }`}
                >
                  A 표준 (~$0.37/화)
                </button>
                <button
                  onClick={() => setPremiumMode(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    premiumMode
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                      : 'bg-murim-darker text-gray-500 border border-murim-border hover:text-gray-300'
                  }`}
                >
                  B 프리미엄 (~$0.82/화)
                </button>
                <span className="text-[10px] text-gray-600 ml-2">
                  {premiumMode
                    ? '전편 참조 + 2-pass 퇴고(Sonnet) = 최고 품질'
                    : '전편 참조 + 1-pass 생성 = 빠르고 저렴'}
                </span>
              </div>
              {/* 파이프라인 스텝 바 */}
              <div className="flex items-center gap-1">
                {[
                  { key: 'blueprint', label: 'A. 설계도', icon: '📋' },
                  { key: 'structure', label: 'B. 구조 설계', icon: '🏗️' },
                  { key: 'generate', label: 'C. AI 생성', icon: '📝' },
                  { key: 'check', label: 'D. EP 검사', icon: '🔍' },
                  { key: 'done', label: '완료', icon: '✅' },
                ].map((step, idx, arr) => {
                  const steps = ['blueprint', 'structure', 'generate', 'check', 'done'];
                  const currentIdx = steps.indexOf(pipelineStep);
                  const stepIdx = steps.indexOf(step.key);
                  const isActive = step.key === pipelineStep;
                  const isPast = stepIdx < currentIdx;
                  const isFuture = stepIdx > currentIdx;
                  return (
                    <div key={step.key} className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (isPast || isActive) setPipelineStep(step.key as any);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          isActive ? 'bg-murim-gold text-black font-bold' :
                          isPast ? 'bg-murim-gold/20 text-murim-gold cursor-pointer hover:bg-murim-gold/30' :
                          'bg-murim-darker text-gray-600 border border-murim-border'
                        }`}
                      >
                        {step.icon} {step.label}
                      </button>
                      {idx < arr.length - 1 && (
                        <span className={`text-xs ${isPast ? 'text-murim-gold' : 'text-gray-700'}`}>→</span>
                      )}
                    </div>
                  );
                })}
                {/* 파이프라인 비용 + 모드 표시 */}
                <span className="ml-auto text-xs text-gray-600">
                  <span className={`font-bold ${premiumMode ? 'text-blue-400' : 'text-green-400'}`}>
                    {premiumMode ? 'B모드' : 'A모드'}
                  </span>
                  {' '}비용: <span className="text-green-400 font-bold">${(structureCost + epCheckCost).toFixed(4)}</span>
                </span>
              </div>
            </div>
            )}

            {/* ━━━ Step A: 설계도 모드 ━━━ */}
            {pipelineStep === 'blueprint' && (
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-murim-gold">📋 제{episodeNumber}화 설계도</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAutoBlueprint}
                      disabled={isLoadingBlueprint}
                      className="px-4 py-2 text-sm bg-murim-gold/20 hover:bg-murim-gold/30 text-murim-gold border border-murim-gold/30 rounded-lg transition-colors disabled:opacity-50 font-semibold"
                    >
                      {isLoadingBlueprint ? '⏳ 로딩 중...' : '⚡ 자동 세팅'}
                    </button>
                    <span className={`text-xs ${blueprint.length >= 100 ? 'text-green-400' : 'text-gray-500'}`}>
                      {blueprint.length}자 {blueprint.length >= 100 ? '✅' : '(최소 100자)'}
                    </span>
                  </div>
                </div>

                <textarea
                  value={blueprint}
                  onChange={(e) => setBlueprint(e.target.value)}
                  placeholder={`제${episodeNumber}화 설계도를 입력하세요...\n\n⚡ "자동 세팅" → master_story_bible + 진행마스터에서 자동 로딩\n✏️ 확인/수정 후 → "구조 설계" 버튼 클릭`}
                  className="flex-1 w-full min-h-[500px] bg-murim-darker border border-murim-border rounded-lg p-5 text-gray-300 resize-y focus:outline-none focus:border-murim-gold text-sm leading-relaxed"
                  spellCheck={false}
                />

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      const saved = JSON.parse(localStorage.getItem('novel_step4_all_designs') || '{}');
                      if (!saved[episodeNumber]) saved[episodeNumber] = {};
                      saved[episodeNumber]['manual'] = blueprint;
                      localStorage.setItem('novel_step4_all_designs', JSON.stringify(saved));
                      alert('✅ 설계도 저장 완료');
                    }}
                    disabled={!blueprint}
                    className="px-4 py-2 text-sm bg-murim-darker border border-murim-border text-gray-400 hover:text-murim-gold hover:border-murim-gold rounded-lg transition-colors disabled:opacity-30"
                  >
                    💾 설계도 저장
                  </button>
                  <button
                    onClick={handleStructureDesign}
                    disabled={isStructuring || blueprint.length < 50}
                    className="px-6 py-2.5 text-sm bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-bold transition-all disabled:opacity-30 shadow-lg"
                  >
                    {isStructuring ? '⏳ 구조 설계 중... (Gemini Flash ~$0.01)' : '🏗️ 다음: 구조 설계 →'}
                  </button>
                </div>
              </div>
            )}

            {/* ━━━ Step B: 구조 설계 확인/수정 모드 ━━━ */}
            {pipelineStep === 'structure' && (
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-cyan-400">🏗️ 제{episodeNumber}화 구조 설계</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPipelineStep('blueprint')}
                      className="px-3 py-1.5 text-xs bg-murim-darker border border-murim-border text-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      ← 설계도로 돌아가기
                    </button>
                    <button
                      onClick={handleStructureDesign}
                      disabled={isStructuring}
                      className="px-3 py-1.5 text-xs bg-cyan-900/30 border border-cyan-700 text-cyan-400 hover:bg-cyan-900/50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isStructuring ? '⏳ 재생성 중...' : '🔄 구조 재생성'}
                    </button>
                    <span className="text-xs text-gray-600">{structureDesign.length}자</span>
                  </div>
                </div>

                <p className="text-xs text-gray-500 px-1">
                  아래 구조를 확인/수정하세요. 이 구조가 AI 생성의 &quot;레시피&quot;가 됩니다. 수정할수록 결과가 좋아집니다.
                </p>

                <textarea
                  value={structureDesign}
                  onChange={(e) => setStructureDesign(e.target.value)}
                  className="flex-1 w-full bg-murim-darker border border-cyan-900/50 rounded-lg p-5 text-gray-300 resize-none focus:outline-none focus:border-cyan-500 text-sm leading-relaxed"
                  spellCheck={false}
                />

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setPipelineStep('generate')}
                    disabled={!structureDesign}
                    className="px-6 py-2.5 text-sm bg-gradient-to-r from-murim-gold to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black rounded-lg font-bold transition-all disabled:opacity-30 shadow-lg"
                  >
                    📝 다음: AI 생성 →
                  </button>
                </div>
              </div>
            )}

            {/* ━━━ Step C: AI 생성 (기존 에디터) + Step D: EP 검사 결과 ━━━ */}
            {(pipelineStep === 'generate' || pipelineStep === 'check' || pipelineStep === 'done') && (
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                {/* 상단: 구조로 돌아가기 + 에디터 상태 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPipelineStep('structure')}
                      className="px-3 py-1.5 text-xs bg-murim-darker border border-murim-border text-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      ← 구조 수정
                    </button>
                    {structureDesign && (
                      <span className="text-xs text-cyan-600">구조 설계 반영됨 ✅</span>
                    )}
                  </div>
                  {content && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleEpCheck}
                        disabled={isEpChecking || !content || content.length < 500}
                        className="px-4 py-1.5 text-sm bg-orange-900/30 border border-orange-700 text-orange-400 hover:bg-orange-900/50 rounded-lg font-semibold transition-colors disabled:opacity-30"
                      >
                        {isEpChecking ? '⏳ EP 검사 중...' : '🔍 EP 규칙 검사'}
                      </button>
                    </div>
                  )}
                </div>

                {/* 에디터 + EP 결과 영역 */}
                <div className="flex-1 flex gap-3 overflow-hidden">
                  {/* 에디터 */}
                  <textarea
                    ref={editorRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={isGenerating ? `제${episodeNumber}화 AI 생성 중... (${AI_LEVEL_INFO[aiLevel].model})` : `아래 "AI 생성" 버튼을 클릭하세요.\n\n구조 설계가 반영되어 품질이 높아집니다.`}
                    className={`${epCheckResults ? 'w-2/3' : 'w-full'} bg-murim-darker border border-murim-border rounded-lg p-5 text-foreground resize-none focus:outline-none focus:border-murim-accent font-serif text-base leading-[2] tracking-wide`}
                    spellCheck={false}
                  />

                  {/* EP 검사 결과 패널 */}
                  {epCheckResults && (
                    <div className="w-1/3 bg-murim-darker border border-murim-border rounded-lg p-4 overflow-y-auto">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-orange-400">🔍 EP 검사 결과</h3>
                        <span className={`text-2xl font-black ${
                          epCheckResults.score >= 80 ? 'text-green-400' :
                          epCheckResults.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {epCheckResults.score}점
                        </span>
                      </div>

                      {/* 요약 */}
                      <div className="flex items-center gap-2 mb-3 text-xs">
                        <span className="text-green-400">✅ {epCheckResults.summary?.pass || 0}</span>
                        <span className="text-yellow-400">⚠️ {epCheckResults.summary?.warn || 0}</span>
                        <span className="text-red-400">❌ {epCheckResults.summary?.fail || 0}</span>
                      </div>

                      {/* 상세 결과 */}
                      <div className="space-y-2">
                        {(epCheckResults.results || []).map((r: any, idx: number) => (
                          <div key={idx} className={`p-2 rounded-lg text-xs border ${
                            r.status === 'pass' ? 'bg-green-900/10 border-green-900/30 text-green-400' :
                            r.status === 'warn' ? 'bg-yellow-900/10 border-yellow-900/30 text-yellow-400' :
                            'bg-red-900/10 border-red-900/30 text-red-400'
                          }`}>
                            <div className="font-bold">
                              {r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌'} {r.rule}
                            </div>
                            <div className="text-gray-400 mt-0.5">{r.message}</div>
                            {r.details && r.details.length > 0 && (
                              <div className="mt-1 text-gray-500 text-[10px] space-y-0.5">
                                {r.details.slice(0, 3).map((d: string, i: number) => (
                                  <div key={i}>• {d}</div>
                                ))}
                                {r.details.length > 3 && <div>... 외 {r.details.length - 3}건</div>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* EP 검사 비용 */}
                      <div className="mt-3 text-xs text-gray-600 text-center">
                        검사 비용: ${epCheckCost.toFixed(4)}
                      </div>

                      {/* 닫기 버튼 */}
                      <button
                        onClick={() => setEpCheckResults(null)}
                        className="w-full mt-2 px-3 py-1.5 text-xs bg-murim-darker border border-murim-border text-gray-500 hover:text-white rounded-lg transition-colors"
                      >
                        패널 닫기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ━━━ ★ AI Level 선택 바 ━━━ */}
          <div className="shrink-0 px-4 py-2 border-t border-murim-border bg-murim-darker/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium mr-1">AI 모델:</span>
              {([1, 2, 3] as const).map((lv) => {
                const info = AI_LEVEL_INFO[lv];
                const isActive = aiLevel === lv;
                return (
                  <button
                    key={lv}
                    onClick={() => setAiLevel(lv)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? `${info.bg} ${info.color} ${info.border} border ring-1 ring-current`
                        : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-murim-border'
                    }`}
                    title={info.desc}
                  >
                    {info.name} · {info.model}
                    <span className={`ml-1 ${isActive ? info.color : 'text-gray-600'}`}>({info.cost})</span>
                  </button>
                );
              })}

              {/* 세션 누적 비용 표시 */}
              {totalSessionCost > 0 && (
                <div className="ml-auto flex items-center gap-2 text-xs">
                  <span className="text-gray-600">이번 세션:</span>
                  <span className={`font-bold ${totalSessionCost < 0.10 ? 'text-green-400' : totalSessionCost < 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                    ${totalSessionCost.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 하단 액션 바 (읽기 모드에서는 숨김) */}
          <div className={`shrink-0 p-4 border-t border-murim-border ${pipelineStep === 'read' ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between">
              {/* 좌측: 생성 버튼 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    isGenerating
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-murim-gold to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-murim-darker shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                      AI 집필 중... ({premiumMode ? 'B-프리미엄 2-pass' : `A-${AI_LEVEL_INFO[aiLevel].model}`})
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      AI 생성 ({premiumMode ? 'B-프리미엄' : `A-${AI_LEVEL_INFO[aiLevel].name}`})
                    </>
                  )}
                </button>

                {/* ★ 마스터 업데이트 상태 표시 */}
                {(isMasterUpdating || masterUpdateResult) && (
                  <span className={`text-xs px-3 py-1.5 rounded-lg ${
                    isMasterUpdating ? 'bg-yellow-900/30 text-yellow-400 animate-pulse' :
                    masterUpdateResult.startsWith('✅') ? 'bg-green-900/30 text-green-400' :
                    'bg-red-900/30 text-red-400'
                  }`}>
                    {isMasterUpdating ? '📝 마스터 업데이트 중...' : masterUpdateResult}
                  </span>
                )}

                {content && (
                  <button
                    onClick={() => {
                      if (confirm('본문을 초기화하시겠습니까?')) {
                        setContent('');
                      }
                    }}
                    className="p-3 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    title="본문 초기화"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                )}

                {/* 마지막 생성 비용 표시 */}
                {costInfo && (
                  <div className="text-xs text-gray-500 pl-2 border-l border-murim-border">
                    <span>최근: </span>
                    <span className={`font-bold ${costInfo.estimatedCostUSD < 0.05 ? 'text-green-400' : costInfo.estimatedCostUSD < 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      ${costInfo.estimatedCostUSD?.toFixed(4)}
                    </span>
                    <span className="text-gray-600 ml-1">({costInfo.model})</span>
                  </div>
                )}
              </div>

              {/* 중앙: 글자수 */}
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {getCharCount(content).toLocaleString()}
                  <span className="text-sm text-gray-500 font-normal ml-1">자</span>
                </div>
                <div className={`text-xs ${
                  getCharCount(content) >= 6000 ? 'text-murim-success' :
                  getCharCount(content) >= 3000 ? 'text-murim-gold' :
                  'text-gray-500'
                }`}>
                  {getCharCount(content) >= 6000 ? '적정 분량 달성' :
                   getCharCount(content) >= 3000 ? '분량 부족 (목표: 6,000~8,000자)' :
                   content ? '작성 중...' : '대기 중'}
                </div>
              </div>

              {/* 우측: 저장/내보내기 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!content || isSaving}
                  className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition-colors ${
                    !content || isSaving
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-murim-accent hover:bg-blue-600 text-white'
                  }`}
                >
                  <Save className="w-5 h-5" />
                  {isSaving ? '저장 중...' : '저장'}
                </button>

                {saveStatus && (
                  <span className={`text-xs px-2 ${saveStatus.includes('✅') ? 'text-green-400' : 'text-yellow-400'}`}>
                    {saveStatus}
                  </span>
                )}

                <button
                  onClick={handleExport}
                  disabled={!content}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    !content
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-murim-darker border border-murim-border hover:border-murim-gold text-gray-300'
                  }`}
                  title="텍스트 파일로 내보내기"
                >
                  <Download className="w-5 h-5" />
                  내보내기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
