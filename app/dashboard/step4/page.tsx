'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, CheckCircle, Circle, Sparkles } from 'lucide-react';

/**
 * [Step 4: 상세 청사진 - 5단계 스노우볼링 설계]
 * .cursorrules의 핵심 기능
 * 
 * 선택한 한 화를 5단계로 심화 설계
 * 적층식 설계 데이터 보존 (Advanced System Rules #2):
 * - 각 차수별 설계 데이터는 누적 관리
 * - 하위 단계는 상위 단계의 모든 설정을 계승
 */

// 설계 단계 정의
interface DesignStage {
  id: number;
  name: string;
  targetLength: string;
  description: string;
  aiRecommendations: string[];
  required: string[];
}

// 5단계 설계 데이터
const DESIGN_STAGES: DesignStage[] = [
  {
    id: 1,
    name: '1차 설계: 핵심 뼈대',
    targetLength: '100자 내외',
    description: '장면의 DNA 정의',
    required: ['출연자', '장소', '시간대', '핵심 사건(Trigger)'],
    aiRecommendations: [
      '갈등 유형: 적대적 M&A형 대결, 공급망 붕괴에 따른 보복 등',
      '날씨/분위기: 사건의 복선을 암시하는 환경 변수'
    ]
  },
  {
    id: 2,
    name: '2차 설계: 서사 및 인과관계',
    targetLength: '500자 내외',
    description: '뼈대에 개연성과 동기 부여',
    required: ['인물 간의 대립 원인', '이동 동선', '사건의 전조 증상'],
    aiRecommendations: [
      '비즈니스 로직: 주인공의 재기(Re-birth) 로드맵에 미치는 영향 분석',
      '세력 관계: 배후에 숨겨진 문파나 상단의 이해관계'
    ]
  },
  {
    id: 3,
    name: '3차 설계: 고증 및 설정 주입',
    targetLength: '1,500자 내외',
    description: '@World_DB를 호출하여 물리적 실체 부여',
    required: ['건축물의 구조', '메뉴(요리/주류 명칭)', '화폐 가치', '의복 묘사'],
    aiRecommendations: [
      '로컬리티: 지역별 특산물 및 물가 변동 데이터',
      '소품: 장면에 등장하는 기물(집기, 병기)의 상세 스펙'
    ]
  },
  {
    id: 4,
    name: '4차 설계: 감각 및 심리 묘사',
    targetLength: '3,000자 내외',
    description: '독자가 현장에 있는 듯한 몰입감 조성',
    required: ['오감(조명, 소리, 효과음, 냄새)', '내면 심리 지표', '캐릭터별 특화 대사'],
    aiRecommendations: [
      '페르소나: 이준혁(경영학적 냉철함), 천마(압도적 오만함)',
      '효과음: 파공음, 진각에 따른 지면의 파쇄음 등 구체적 의성어/의태어'
    ]
  },
  {
    id: 5,
    name: '5차 설계: 5,000자 최종 설계도',
    targetLength: '5,000자',
    description: '본문 집필(Step 5) 직전의 완벽한 가이드 완성',
    required: ['액션의 정밀한 합(초식의 궤적)', '대사의 뉘앙스 교정', '절단신공 포인트'],
    aiRecommendations: [
      '전략적 배치: 독자의 유료 결제를 유도할 사이다 포인트 점검'
    ]
  }
];

// ── Step 3 에피소드 타입 ──
interface Episode {
  id: number;
  title: string;
  skeleton: string;
  section: '기' | '승' | '전' | '결';
}

export default function Step4Page() {
  const [currentStage, setCurrentStage] = useState(1);
  const [designs, setDesigns] = useState<Record<number, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // ── 에피소드 선택 관련 상태 (신규) ──
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [allDesigns, setAllDesigns] = useState<Record<number, Record<number, string>>>({});

  // [순수 본문 글자 수 계산]
  // 제목, 줄바꿈, 공백 모두 제거 후 순수 글자수만 카운트
  const getContentLength = (text: string): number => {
    if (!text) return 0;
    
    let content = text;
    
    // 1. 제목 패턴 제거: [1차 설계: ...] 또는 [1차 뼈대 - ...] 형태
    content = content.replace(/^\[.*?\]\s*/gm, '');
    
    // 2. 모든 줄바꿈 제거
    content = content.replace(/\n/g, '');
    
    // 3. 모든 공백 제거 (순수 글자수만 카운트)
    content = content.replace(/\s+/g, '');
    
    // 4. 앞뒤 공백 제거 (이미 3번에서 모두 제거됨)
    content = content.trim();
    
    return content.length;
  };

  // ── Step 3 에피소드 목록 + 저장된 설계도 복원 ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Step 3에서 에피소드 목록 로드
    const step3Data = localStorage.getItem('novel_episodes_skeletons');
    if (step3Data) {
      try {
        const parsed = JSON.parse(step3Data);
        setEpisodes(parsed);
      } catch (e) {
        console.error('Step 3 데이터 로드 실패:', e);
      }
    }

    // 전체 설계도 복원 (화별로 저장됨)
    const saved = localStorage.getItem('novel_step4_all_designs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAllDesigns(parsed);
        // 현재 선택된 화의 설계도 세팅
        if (parsed[selectedEpisode]) {
          setDesigns(parsed[selectedEpisode]);
        }
      } catch (e) {
        console.error('저장된 설계도 복원 실패:', e);
      }
    } else {
      // 레거시: 기존 단일 저장 방식 호환
      const legacySaved = localStorage.getItem('novel_step4_designs');
      if (legacySaved) {
        try {
          const parsed = JSON.parse(legacySaved);
          setDesigns(parsed);
          // 레거시 데이터를 1화로 마이그레이션
          const migrated = { 1: parsed };
          setAllDesigns(migrated);
          localStorage.setItem('novel_step4_all_designs', JSON.stringify(migrated));
        } catch (e) {
          console.error('레거시 데이터 복원 실패:', e);
        }
      }
    }
  }, []);

  // ── 에피소드 변경 시 해당 화의 설계도 로드 ──
  useEffect(() => {
    if (allDesigns[selectedEpisode]) {
      setDesigns(allDesigns[selectedEpisode]);
    } else {
      setDesigns({});
    }
    setCurrentStage(1); // 화 변경 시 1차부터 시작
  }, [selectedEpisode]);

  // AI 생성 (실제 API 호출 + 타임아웃)
  const handleGenerate = async (stageId: number) => {
    setIsGenerating(true);
    
    try {
      // 타임아웃 컨트롤러 (30초)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // 현재 에피소드 정보 가져오기
      const currentEp = episodes.find(e => e.id === selectedEpisode);

      // API 호출 (에피소드 번호 동적 전달)
      const response = await fetch('/api/generate-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: stageId,
          previousDesigns: designs,
          episodeNumber: selectedEpisode,
          episodeTitle: currentEp?.title || `제${selectedEpisode}화`,
          episodeSkeleton: currentEp?.skeleton || '',
          region: '우강진',
          mood: 'tension',
          tier: '중'
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('AI 생성 실패');
      }

      const data = await response.json();
      
      if (data.success) {
        const newDesigns = {
          ...designs,
          [stageId]: data.design
        };
        setDesigns(newDesigns);
        
        // 화별 자동 저장
        saveDesignsForEpisode(newDesigns);
      } else {
        alert('AI 생성 실패: ' + (data.message || '알 수 없는 오류'));
      }
    } catch (error: any) {
      console.error('AI 생성 오류:', error);
      alert('AI 생성 중 오류 발생: ' + error.message);
      
      // 실패 시 샘플 데이터 사용 (폴백)
      const stage = DESIGN_STAGES.find(s => s.id === stageId);
      const sampleText = generateSampleText(stageId, stage?.targetLength || '');
      const newDesigns = { ...designs, [stageId]: sampleText };
      setDesigns(newDesigns);
      saveDesignsForEpisode(newDesigns);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── 화별 저장 헬퍼 ──
  const saveDesignsForEpisode = (newDesigns: Record<number, string>) => {
    if (typeof window === 'undefined') return;
    const updated = { ...allDesigns, [selectedEpisode]: newDesigns };
    setAllDesigns(updated);
    localStorage.setItem('novel_step4_all_designs', JSON.stringify(updated));
    // 레거시 호환: 현재 화 설계도를 기존 키에도 저장
    localStorage.setItem('novel_step4_designs', JSON.stringify(newDesigns));
  };

  // 수동 저장
  const handleSave = () => {
    setIsSaving(true);
    saveDesignsForEpisode(designs);
    setTimeout(() => { setIsSaving(false); }, 500);
  };

  // 텍스트 변경 시 자동 저장 (디바운스)
  const handleTextChange = (stageId: number, value: string) => {
    const newDesigns = { ...designs, [stageId]: value };
    setDesigns(newDesigns);
    // 1초 후 자동 저장
    setTimeout(() => { saveDesignsForEpisode(newDesigns); }, 1000);
  };

  // 다음 단계로 이동
  const handleApprove = (stageId: number) => {
    if (stageId < 5) {
      setCurrentStage(stageId + 1);
    } else {
      alert(`✅ 제${selectedEpisode}화 5차 설계 완료! Step 6(본문 집필)로 이동합니다.`);
      window.location.href = '/dashboard/step6';
    }
  };

  // 샘플 텍스트 생성
  const generateSampleText = (stageId: number, targetLength: string): string => {
    const samples: Record<number, string> = {
      1: `[1차 뼈대 - ${targetLength}]\n\n출연자: 독고소준(주인공), 장사장(채무자), 하오문 졸개들\n장소: 낙양 외곽 허름한 주막\n시간대: 황혼 무렵\n핵심 사건: 압류 현장에서 하오문과 첫 충돌\n\n갈등 유형: 채권 추심 vs 세력 침탈 (M&A형 대결)\n날씨/분위기: 석양, 먼지 날리는 건조한 바람 (위기의 복선)`,
      
      2: `[2차 서사 - ${targetLength}]\n\n[이전 단계 계승]\n${designs[1] || ''}\n\n[인과관계 확장]\n대립 원인: 독고소준이 압류하러 온 주막이 하오문의 불법 물자 거점\n이동 동선: 독고가(본가) → 낙양 성문 → 외곽 주막 (3리)\n전조 증상: 주막 주변에 평범하지 않은 말 10필, 졸개들의 긴장한 눈빛\n\n비즈니스 로직: 이 주막 압류 성공 시 현금 500냥 확보 → 재기 자금의 20%\n세력 관계: 하오문이 독고가 몰락을 틈타 낙양 외곽 장악 중`,
      
      3: `[3차 고증 - ${targetLength}]\n\n[이전 2단계 계승]\n${designs[1] || ''}\n${designs[2] || ''}\n\n[World DB 연동]\n건축물: 주막은 2층 목조, 1층 객석 12개, 2층 방 5개, 뒤뜰에 마구간\n메뉴: 양고기 덮밥(30문), 소주(10문/사발), 죽엽청주(50문/병)\n화폐: 압류 목표 500냥 = 500,000문 (주막 건물+토지 가치)\n의복: 독고소준-청색 직령포(파손됨), 하오문 졸개-흑색 무명 협의\n\n로컬리티: 낙양 외곽은 양고기가 저렴(30문), 성내는 80문\n소품: 압류 문서(홍색 낙인), 독고가 가주 인장(청동 육각), 하오문 표식(흑매화)`,
      
      4: `[4차 감각 - ${targetLength}]\n\n[이전 3단계 계승]\n${designs[1] || ''}\n${designs[2] || ''}\n${designs[3] || ''}\n\n[오감 묘사]\n시각: 석양이 주막 기왓장에 붉게 물들고, 먼지가 역광에 반짝임\n청각: 마구간에서 말 10필이 불안하게 발을 구르는 소리, 졸개들의 숨소리\n후각: 양고기 기름 타는 냄새 + 땀과 흙먼지가 섞인 무림인 특유의 냄새\n촉각: 석양의 마지막 열기가 피부를 따갑게 찌름, 손은 차가운 땀\n미각: 입안이 바짝 마른 긴장감\n\n[심리 묘사]\n독고소준 내면: "500냥... 이것만 확보하면 월말 이자를 막는다. 물러설 수 없다."\n이준혁 페르소나: "현재 상황의 리스크가 37% 상승했습니다. 하오문과의 충돌 확률 82%."\n천마 페르소나: "벌레 같은 놈들이 내 집안 땅을 탐하는구나."\n\n[대사 설계]\n독고소준: "이 주막은 독고가의 담보물이다. 당장 비워라." (냉정, 떨림 없는 목소리)\n하오문 두목: "독고가? 크크... 이미 낙양에서 소문났지. 빈털터리 도련님." (비웃음)\n\n효과음: 타닥(장작 타는 소리), 드르륵(칼 뽑는 소리), 쿵(테이블 내려치는 소리)`,
      
      5: `[5차 최종 설계도 - ${targetLength}]\n\n[이전 4단계 완전 계승]\n${designs[1] || ''}\n${designs[2] || ''}\n${designs[3] || ''}\n${designs[4] || ''}\n\n[액션 정밀 설계]\n1. 독고소준 입장 → 압류 문서 제시 (3초)\n2. 하오문 두목 비웃음 → 졸개 10명 포위 (5초)\n3. 긴장 고조 → 독고소준 손이 칼자루로 (2초)\n4. 천마 페르소나 각성 조짐 → 눈빛 변화 (클로즈업)\n5. 폭발 직전 → 주막 주인 끼어들기 "잠깐!" (절단신공 포인트)\n\n[대사 뉘앙스 최종 교정]\n독고소준: "이 주막은 독고가의 담보물이다. 당장 비워라." \n→ (냉정하지만 내면의 불안을 숨김, 목소리 약간 높은 톤으로 권위 유지 시도)\n\n하오문 두목: "독고가? 크크... 이미 낙양에서 소문났지. 빈털터리 도련님."\n→ (느릿하게, 마지막 '도련님'에서 악의적 강조)\n\n[절단신공 포인트]\n"잠깐!" 주막 주인이 끼어든 순간, 독고소준의 눈이 주막 뒤뜰로 향했다.\n그곳에는... (다음 화에서 공개)\n\n[사이다 포인트 배치]\n- 1차 사이다: 독고소준이 압류 문서를 탁자에 내려치며 법적 우위 선점\n- 2차 사이다(예고): 다음 화에서 뒤뜰의 비밀 폭로 → 하오문 약점 노출\n\n[전략적 메모]\n- 이 장면은 유료 전환 직전 배치 (긴장감 최고조)\n- 독자의 "다음 화 궁금증" 80% 이상 확보 목표\n- 천마 페르소나 완전 각성은 3화 후로 지연 (점진적 상승)`
    };
    
    return samples[stageId] || '생성 중...';
  };

  return (
    <div className="p-8 space-y-8">
      {/* 헤더 */}
      <div className="border-b border-murim-border pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Sparkles className="w-8 h-8 text-murim-accent" />
          <h1 className="text-3xl font-bold text-foreground">Step 4: 상세 청사진</h1>
        </div>
        <p className="text-gray-500">
          5단계 스노우볼링 설계 시스템 - 선택한 화를 깊이 있게 설계
        </p>
      </div>

      {/* ━━━ 에피소드 선택 (신규) ━━━ */}
      <div className="widget-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">설계 대상 화 선택</h3>
          {episodes.length === 0 && (
            <a href="/dashboard/step3" className="text-sm text-murim-accent hover:underline">
              Step 3에서 먼저 에피소드를 만드세요 →
            </a>
          )}
        </div>
        
        {episodes.length > 0 ? (
          <div className="flex items-center gap-4">
            {/* 화 번호 드롭다운 */}
            <select
              value={selectedEpisode}
              onChange={(e) => setSelectedEpisode(Number(e.target.value))}
              className="bg-murim-darker border border-murim-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-murim-accent min-w-[300px]"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  제{ep.id}화: {ep.title || '(제목 없음)'} [{ep.section}]
                </option>
              ))}
            </select>
            
            {/* 현재 에피소드 정보 */}
            <div className="flex-1 text-sm text-gray-400">
              {episodes.find(e => e.id === selectedEpisode)?.skeleton && (
                <span className="line-clamp-1">
                  뼈대: {episodes.find(e => e.id === selectedEpisode)?.skeleton}
                </span>
              )}
            </div>

            {/* 설계 완료 여부 표시 */}
            {allDesigns[selectedEpisode]?.[5] ? (
              <span className="px-3 py-1 bg-murim-success/20 text-murim-success rounded-full text-xs font-bold">
                5차 설계 완료
              </span>
            ) : allDesigns[selectedEpisode]?.[1] ? (
              <span className="px-3 py-1 bg-murim-gold/20 text-murim-gold rounded-full text-xs font-bold">
                설계 진행 중
              </span>
            ) : (
              <span className="px-3 py-1 bg-gray-700 text-gray-400 rounded-full text-xs">
                미시작
              </span>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <p>Step 3에서 에피소드 목록을 먼저 생성해 주세요.</p>
          </div>
        )}
      </div>

      {/* 진행 상황 표시 */}
      <div className="widget-card">
        <h3 className="text-lg font-bold text-foreground mb-4">
          제{selectedEpisode}화 설계 진행
        </h3>
        <div className="flex items-center justify-between">
          {DESIGN_STAGES.map((stage, index) => (
            <div key={stage.id} className="flex items-center">
              <StageIndicator
                stage={stage.id}
                current={currentStage}
                completed={stage.id < currentStage}
                hasDesign={!!designs[stage.id]}
              />
              {index < DESIGN_STAGES.length - 1 && (
                <ChevronRight className="w-6 h-6 text-gray-600 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 현재 단계 설계 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 단계 정보 */}
        <div className="lg:col-span-1 space-y-4">
          <div className="widget-card">
            <h3 className="text-lg font-bold text-foreground mb-4">
              {DESIGN_STAGES[currentStage - 1].name}
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">목표 분량</p>
                <p className="text-foreground font-semibold">
                  {DESIGN_STAGES[currentStage - 1].targetLength}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">목표</p>
                <p className="text-foreground">
                  {DESIGN_STAGES[currentStage - 1].description}
                </p>
              </div>
            </div>
          </div>

          {/* 필수 포함 사항 */}
          <div className="widget-card">
            <h4 className="text-sm font-bold text-foreground mb-3">필수 포함</h4>
            <ul className="space-y-2">
              {DESIGN_STAGES[currentStage - 1].required.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-murim-success mt-0.5" />
                  <span className="text-sm text-gray-400">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AI 추천 */}
          <div className="widget-card">
            <h4 className="text-sm font-bold text-foreground mb-3">AI 추천</h4>
            <ul className="space-y-2">
              {DESIGN_STAGES[currentStage - 1].aiRecommendations.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <Sparkles className="w-4 h-4 text-murim-accent mt-0.5" />
                  <span className="text-sm text-gray-400">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 우측: 설계 에디터 */}
        <div className="lg:col-span-2 widget-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">설계 내용</h3>
            <div className="flex items-center space-x-2">
              {designs[currentStage] && (
                <span className="text-sm text-gray-500">
                  본문 {getContentLength(designs[currentStage])}자
                </span>
              )}
            </div>
          </div>

          {/* 에디터 */}
          <div className="relative">
            <textarea
              value={designs[currentStage] || ''}
              onChange={(e) => handleTextChange(currentStage, e.target.value)}
              placeholder={`${DESIGN_STAGES[currentStage - 1].name}을 작성하세요...\n\n✨ AI 생성 버튼을 클릭하면 자동으로 생성됩니다.\n✏️ 생성 후 자유롭게 수정할 수 있습니다.\n💾 수정 내용은 자동 저장됩니다.`}
              className="w-full h-96 bg-murim-darker border border-murim-border rounded-lg p-4 text-foreground resize-none focus:outline-none focus:border-murim-accent font-mono text-sm leading-relaxed"
              spellCheck={false}
            />
            
            {/* 자동 저장 인디케이터 */}
            {designs[currentStage] && (
              <div className="absolute top-2 right-2 px-3 py-1 bg-murim-darker/80 rounded text-xs text-gray-500">
                💾 자동 저장됨
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleGenerate(currentStage)}
                disabled={isGenerating}
                className={`
                  px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2
                  ${isGenerating
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-murim-accent hover:bg-blue-600 text-white'
                  }
                `}
              >
                <Sparkles className="w-5 h-5" />
                <span>{isGenerating ? 'AI 생성 중...' : '✨ AI 자동 생성'}</span>
              </button>

              {designs[currentStage] && !isGenerating && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-3 bg-murim-dark hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <span>{isSaving ? '💾 저장 중...' : '💾 수동 저장'}</span>
                </button>
              )}
            </div>

            {designs[currentStage] && (
              <button
                onClick={() => handleApprove(currentStage)}
                className="px-6 py-3 bg-murim-success hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center space-x-2"
              >
                <CheckCircle className="w-5 h-5" />
                <span>✅ 승인 후 다음 단계</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 완료된 단계 미리보기 */}
      {currentStage > 1 && (
        <div className="widget-card">
          <h3 className="text-lg font-bold text-foreground mb-4">이전 단계 설계 (계승)</h3>
          <div className="space-y-4">
            {Array.from({ length: currentStage - 1 }, (_, i) => i + 1).map(stageId => (
              designs[stageId] && (
                <div key={stageId} className="p-4 bg-murim-darker rounded-lg border border-murim-border">
                  <p className="text-sm font-semibold text-murim-accent mb-2">
                    {DESIGN_STAGES[stageId - 1].name}
                  </p>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap line-clamp-3">
                    {designs[stageId]}
                  </p>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * [단계 표시 인디케이터]
 */
interface StageIndicatorProps {
  stage: number;
  current: number;
  completed: boolean;
  hasDesign: boolean;
}

function StageIndicator({ stage, current, completed, hasDesign }: StageIndicatorProps) {
  const isActive = stage === current;
  
  return (
    <div className="flex flex-col items-center">
      <div className={`
        w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-colors
        ${completed ? 'bg-murim-success text-white' : ''}
        ${isActive ? 'bg-murim-accent text-white animate-pulse' : ''}
        ${!completed && !isActive ? 'bg-murim-border text-gray-600' : ''}
      `}>
        {completed ? <CheckCircle className="w-6 h-6" /> : stage}
      </div>
      <span className={`
        text-xs mt-2 text-center
        ${isActive ? 'text-murim-accent font-semibold' : 'text-gray-600'}
      `}>
        {stage}차
      </span>
    </div>
  );
}
