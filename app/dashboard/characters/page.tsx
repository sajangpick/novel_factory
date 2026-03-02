'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, Search, Plus, Edit, Trash2, ChevronDown, Settings } from 'lucide-react';

/**
 * [캐릭터 인명록 관리 페이지]
 * - 캐릭터 CRUD
 * - 검색/필터링
 */

interface Character {
  id: string;
  name: string;
  title?: string;              // 개인 호 (예: 천마검제)
  role: string;
  faction: string;
  faction_type?: string;       // 문파 유형 (정파/사파/세가)
  group_title?: string;        // 단체 외호 (예: 사대금강)
  group_position?: number;     // 단체 내 순위
  rank_in_faction?: string;    // 문파 내 지위 (장문인, 장로, 제자)
  // ── 출신/배경 ──
  birthplace?: string;         // 태생 (강남 소주 등)
  hometown?: string;           // 고향
  current_residence?: string;  // 현 거주지
  social_class?: string;       // 계급 (평민, 귀족, 몰락귀족)
  family_background?: string;  // 가문 배경
  backstory?: string;          // 과거 이야기
  // ── 외모/체격 ──
  age: string;
  height?: string;             // 키 (185cm)
  weight?: string;             // 몸무게 (90kg)
  build?: string;              // 체형 (근육질, 마른, 거구)
  appearance: string;          // 외모 상세
  distinctive_features?: string; // 특징 (흉터, 문신)
  voice_tone?: string;         // 목소리 (굵고 낮음)
  // ── 무공/전투 ──
  martial_rank: string;
  martial_rank_numeric?: number;
  combat_power?: number;       // 종합 전투력 (0~100)
  attack_power?: number;       // 공격력
  defense_power?: number;      // 방어력
  speed_power?: number;        // 속도
  technique_power?: number;    // 기술력
  internal_energy_years?: number; // 내공 연수
  internal_energy_level?: string; // 내공 깊이 설명
  qi_control_level?: string;   // 기 운용 능력
  weapon?: string;             // 주 무기
  weapon_secondary?: string;   // 보조 무기
  weapon_description?: string; // 무기 상세
  skills?: string[];           // 무공 목록
  skill_proficiency?: Record<string, number>; // 무공별 숙련도
  special_abilities?: string[];// 특수 능력
  fighting_style?: string;     // 전투 스타일
  combat_experience?: string;  // 실전 경험
  // ── 성격/말투 ──
  personality?: string;        // 성격 상세
  personality_keywords?: string[]; // 키워드
  speech_style?: string;       // 말투 (존댓말, 하오체)
  speech_examples?: string[];  // 대사 예시
  habits?: string[];           // 버릇, 습관
  catchphrase?: string;        // 입버릇
  // ── 음식 ──
  favorite_foods?: string[];   // 좋아하는 음식
  disliked_foods?: string[];   // 싫어하는 음식
  dietary_restrictions?: string[]; // 금기 음식
  food_preference_reason?: string; // 음식 선호 이유
  favorite_drink?: string;     // 선호 음료
  alcohol_tolerance?: string;  // 주량
  eating_habits?: string;      // 식사 습관
  // ── 생활 패턴 ──
  daily_routine?: string;      // 하루 일과
  wake_up_time?: string;       // 기상 시간
  sleep_time?: string;         // 취침 시간
  hobbies?: string[];          // 취미
  stress_relief_method?: string; // 스트레스 해소법
  // ── 의복/장신구 ──
  clothing_style?: string;     // 의복 스타일
  clothing_colors?: string[];  // 선호 색상
  accessories?: string[];      // 장신구
  // ── 인간관계 ──
  relationships?: Record<string, string>; // 인간관계 맵
  allies?: string[];           // 동료들
  enemies?: string[];          // 적들
  mentor?: string;             // 스승
  disciples?: string[];        // 제자들
  family_members?: Record<string, string>; // 가족
  // ── 스토리 메타 ──
  first_appearance?: number;   // 첫 등장 화
  last_appearance?: number;    // 마지막 등장 화
  importance_score?: number;   // 중요도 (0~100)
  character_arc?: string;      // 캐릭터 아크
  created_at: string;
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('전체');
  const [selectedFaction, setSelectedFaction] = useState<string>('전체');
  const [selectedGroupTitle, setSelectedGroupTitle] = useState<string>('전체'); // 단체외호 필터
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showTools, setShowTools] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  // ── 30가지 특징 편집용 상태 ──
  const [editingChar, setEditingChar] = useState<Record<string, any> | null>(null);
  const [editTab, setEditTab] = useState(0); // 탭 인덱스
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    role: '조연',
    faction: '',
    group_title: '',
    group_position: undefined as number | undefined,
    age: '',
    martial_rank: '',
    appearance: '',
  });

  // ── 편집 필드 업데이트 헬퍼 (텍스트/숫자) ──
  const updateEditField = (field: string, value: any) => {
    setEditingChar((prev) => prev ? { ...prev, [field]: value } : null);
  };
  // ── 배열 필드 업데이트 헬퍼 (쉼표 구분 입력 → 배열) ──
  const getArrayAsString = (arr: any) => {
    if (Array.isArray(arr)) return arr.join(', ');
    if (typeof arr === 'string') return arr;
    return '';
  };
  const parseArrayFromString = (str: string) => {
    return str.split(',').map(s => s.trim()).filter(Boolean);
  };
  // ── JSON 필드 표시 헬퍼 (예: {부: 사망, 모: 생존}) ──
  const getJsonAsString = (obj: any) => {
    if (!obj || typeof obj !== 'object') return '';
    return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
  };
  const parseJsonFromString = (str: string): Record<string, string> => {
    const result: Record<string, string> = {};
    str.split(',').forEach(pair => {
      const [key, ...vals] = pair.split(':');
      if (key?.trim() && vals.length) {
        result[key.trim()] = vals.join(':').trim();
      }
    });
    return result;
  };

  // 캐릭터 불러오기: Supabase(금고) → localStorage(메모장) → 샘플 데이터 순서
  useEffect(() => {
    const loadCharacters = async () => {
      try {
        // ── 1차: Supabase에서 불러오기 (1000명 데이터가 여기에 저장됨) ──
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data, error } = await supabase
            .from('characters')
            .select('*')
            .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
            .order('id')
            .limit(1100); // 1000명 + 여유분

          if (!error && data && data.length > 0) {
            // Supabase에 데이터가 있으면 사용
            setCharacters(data);
            localStorage.setItem('novel_characters', JSON.stringify(data));
            console.log(`✅ Supabase에서 ${data.length}명 로드 완료`);
            setLoading(false);
            return;
          } else if (data && data.length === 0) {
            // Supabase가 비어있으면 localStorage로 폴백
            console.warn('⚠️ Supabase 비어있음 (0명), localStorage로 대체');
          } else if (error) {
            console.warn('⚠️ Supabase 로드 실패, localStorage로 대체:', error.message);
          }
        }
      } catch (err) {
        console.warn('⚠️ Supabase 연결 실패, localStorage로 대체:', err);
      }

      // ── 2차: localStorage에서 불러오기 (오프라인 백업) ──
      const saved = localStorage.getItem('novel_characters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setCharacters(parsed);
          console.log(`✅ localStorage에서 ${parsed.length}명 로드 완료`);
        } catch (error) {
          console.error('localStorage 로드 실패:', error);
          setCharacters(sampleCharacters);
        }
      } else {
        // ── 3차: 샘플 데이터 사용 (최초 접속 시) ──
        setCharacters(sampleCharacters);
        console.log('ℹ️ 샘플 데이터 70명 로드');
      }
      setLoading(false);
    };

    loadCharacters();
  }, []);

  // 🎬 400명 자동 생성 함수 (기존 70명 보호)
  const handleGenerate400Characters = async () => {
    if (characters.length >= 400) {
      alert('이미 400명 이상입니다!');
      return;
    }

    if (!confirm(`현재 ${characters.length}명 → 400명으로 확장하시겠습니까?\n\n300화 로드맵을 분석하여 필요한 캐릭터를 자동 생성합니다.`)) {
      return;
    }

    try {
      setLoading(true);
      console.log('🎬 400명 자동 생성 시작...');
      console.log(`📋 기존 캐릭터: ${characters.length}명 (보호됨)`);

      // Step 3 데이터 불러오기 (300화 로드맵)
      const step3Data = localStorage.getItem('novel_episodes_skeletons');
      if (!step3Data) {
        alert('❌ Step 3 데이터가 없습니다!\n\n먼저 Step 3에서 300화 로드맵을 생성해주세요.');
        setLoading(false);
        return;
      }

      const episodes = JSON.parse(step3Data);
      console.log(`📖 ${episodes.length}화 로드맵 로드 완료`);

      // API 호출 (화수별 출연진 자동 생성)
      const response = await fetch('/api/generate-cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodes,
          existingCharacters: characters, // 기존 70명 전달
          targetTotal: 400, // 목표 400명
        }),
      });

      if (!response.ok) {
        throw new Error('API 호출 실패');
      }

      const result = await response.json();
      console.log('✅ 생성 결과:', result);

      // 새로 생성된 캐릭터 추가
      const allCharacters = [...characters, ...result.newCharacters];
      
      // 400명 제한
      const final = allCharacters.slice(0, 400);
      
      // ID 재정렬
      final.forEach((char, index) => {
        char.id = String(index + 1);
      });

      // 저장
      localStorage.setItem('novel_characters', JSON.stringify(final));
      localStorage.setItem('novel_episode_casts', JSON.stringify(result.episodeCasts));
      
      setCharacters(final);
      setLoading(false);

      alert(`✅ 생성 완료!\n\n${characters.length}명 → ${final.length}명\n\n새로 생성: ${result.newCharacters.length}명\n재사용: ${result.reusedCount || 0}명`);
    } catch (error) {
      console.error('❌ 생성 실패:', error);
      alert('생성 중 오류가 발생했습니다.\n\n콘솔을 확인해주세요.');
      setLoading(false);
    }
  };

  // 🧹 중복 제거 함수 (백업용)
  const handleCleanupCharacters = () => {
    if (!confirm('중복된 캐릭터를 제거하시겠습니까?')) {
      return;
    }

    // 1. 이름 중복 제거 (먼저 나온 것만 유지)
    const nameMap = new Map<string, Character>();
    characters.forEach((char) => {
      if (!nameMap.has(char.name)) {
        nameMap.set(char.name, char);
      }
    });

    let cleaned = Array.from(nameMap.values());
    console.log(`1단계: 중복 제거 ${characters.length}명 → ${cleaned.length}명`);

    // 2. 중요도 순 정렬
    const roleOrder: { [key: string]: number } = {
      '주인공': 1,
      '주요 조연': 2,
      '조연': 3,
      '단역': 4,
    };

    cleaned.sort((a, b) => {
      const aOrder = roleOrder[a.role] || 999;
      const bOrder = roleOrder[b.role] || 999;
      return aOrder - bOrder;
    });

    // 3. ID 재정렬
    cleaned.forEach((char, index) => {
      char.id = String(index + 1);
    });

    // 4. 저장
    localStorage.setItem('novel_characters', JSON.stringify(cleaned));
    setCharacters(cleaned);

    alert(`✅ 정리 완료!\n\n${characters.length}명 → ${cleaned.length}명`);
  };

  // 📤 Supabase 업로드 함수 (NEW!)
  const handleUploadToSupabase = async () => {
    if (characters.length === 0) {
      alert('❌ 업로드할 캐릭터가 없습니다!');
      return;
    }

    if (!confirm(`${characters.length}명을 Supabase에 업로드하시겠습니까?\n\n기존 DB 데이터는 모두 삭제됩니다.`)) {
      return;
    }

    try {
      setLoading(true);
      console.log(`📤 ${characters.length}명 Supabase 업로드 시작...`);

      const response = await fetch('/api/upload-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters }),
      });

      if (!response.ok) {
        throw new Error('업로드 실패');
      }

      const result = await response.json();
      console.log('✅ 업로드 결과:', result);

      setLoading(false);
      alert(`✅ Supabase 업로드 완료!\n\n총: ${result.total}명\n성공: ${result.uploaded}명\n실패: ${result.failed}명`);
    } catch (error) {
      console.error('❌ 업로드 오류:', error);
      setLoading(false);
      alert(`❌ 오류: ${error instanceof Error ? error.message : '업로드 실패'}`);
    }
  };

  // 🚀 1000명 자동 생성 (723명 추가)
  const handleGenerate1000Characters = async () => {
    const currentCount = characters.length;
    const toGenerate = 1000 - currentCount;

    if (currentCount >= 1000) {
      alert('이미 1000명 이상입니다!');
      return;
    }

    if (!confirm(`🚀 1000명 프로젝트 시작!\n\n현재: ${currentCount}명\n추가 생성: ${toGenerate}명\n최종: 1000명\n\n⏱️ 예상 시간: 5분\n\n시작하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      console.log(`🚀 ${toGenerate}명 생성 시작...`);

      const response = await fetch('/api/generate-1000-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingCount: currentCount }),
      });

      if (!response.ok) {
        throw new Error('생성 실패');
      }

      const result = await response.json();
      console.log('✅ 생성 결과:', result);

      // ✅ 새 API는 Supabase에 직접 저장됨! localStorage 불필요
      // Supabase에서 최신 데이터 다시 불러오기
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: freshData } = await supabase
        .from('characters')
        .select('*')
        .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .order('id');
      
      if (freshData) {
        setCharacters(freshData);
        localStorage.setItem('novel_characters', JSON.stringify(freshData));
      }

      setLoading(false);
      alert(`✅ ${result.generated}명 생성 완료! (30가지 특징 포함)\n\n기존 ${result.existing}명 + 신규 ${result.generated}명 = 총 ${result.total}명\n\n🔥 Supabase에 직접 저장 완료!`);
    } catch (error) {
      console.error('❌ 생성 오류:', error);
      alert('생성 중 오류가 발생했습니다.\n\n콘솔을 확인해주세요.');
      setLoading(false);
    }
  };

  // 🔥 1000명 상세 정보 자동 채우기
  const handleEnrichCharacters = async () => {
    if (!confirm('🔥 Supabase의 모든 캐릭터에게 상세 정보를 채우시겠습니까?\n\n⏱️ 예상 시간: 8~10분')) {
      return;
    }

    try {
      setLoading(true);
      console.log('🔥 전체 캐릭터 상세 정보 채우기 시작...');

      const response = await fetch('/api/enrich-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('처리 실패');
      }

      const result = await response.json();
      console.log('✅ 완료:', result);

      setLoading(false);
      alert(`✅ ${result.updated}명 상세 정보 완성!\n\n총: ${result.total}명\n성공: ${result.updated}명\n실패: ${result.failed}명\n\n이제 Supabase에서 확인해보세요! 🎉`);
    } catch (error) {
      console.error('❌ 오류:', error);
      alert('업로드 중 오류가 발생했습니다.\n\n콘솔을 확인해주세요.');
      setLoading(false);
    }
  };

  // 역할 필터
  const roles = ['전체', '주인공', '주요 조연', '조연', '단역'];

  // 문파 필터 (자동 추출)
  const factions = ['전체', ...Array.from(new Set(characters.map((c) => c.faction))).sort()];

  // 단체외호 필터 (자동 추출)
  const groupTitles = ['전체', ...Array.from(new Set(characters.filter(c => c.group_title).map((c) => c.group_title!))).sort()];

  // 샘플 데이터 (개발용) - 총 70명 (9대문파 포함)
  const sampleCharacters: Character[] = [
    // 주요 인물 5명
    {
      id: '1',
      name: '위소운',
      title: '천마검제',
      role: '주인공',
      faction: '천상문',
      age: '20~23세',
      martial_rank: '천인급',
      appearance: '준수함, 날카로운 눈매, 180cm',
      created_at: '2026-02-05',
    },
    {
      id: '2',
      name: '조칠',
      role: '주요 조연',
      faction: '천상문',
      age: '25~28세',
      martial_rank: '종사급',
      appearance: '투박함, 각진 턱, 185cm',
      created_at: '2026-02-05',
    },
    {
      id: '3',
      name: '왕팔',
      role: '주요 조연',
      faction: '천상문',
      age: '23~26세',
      martial_rank: '삼류말',
      appearance: '동글동글, 165cm, 통통함',
      created_at: '2026-02-05',
    },
    {
      id: '4',
      name: '설화',
      role: '주요 조연',
      faction: '독사곡 → 천상문',
      age: '20~23세',
      martial_rank: '준천인급',
      appearance: '절세미인, 보라빛 눈동자, 170cm',
      created_at: '2026-02-05',
    },
    {
      id: '5',
      name: '황용',
      role: '주요 조연',
      faction: '화산파',
      age: '45~48세',
      martial_rank: '천인급',
      appearance: '금색 눈동자, 190cm, 금발',
      created_at: '2026-02-05',
    },
    // 조연급 15명 추가
    {
      id: '6',
      name: '청풍',
      role: '조연',
      faction: '청풍검각',
      age: '18~21세',
      martial_rank: '화경급',
      appearance: '절세미인, 긴 흑발, 168cm',
      created_at: '2026-02-05',
    },
    {
      id: '7',
      name: '혈마교주',
      role: '조연',
      faction: '혈마교',
      age: '60세',
      martial_rank: '현경급',
      appearance: '붉은 눈동자, 창백한 피부, 190cm',
      created_at: '2026-02-05',
    },
    {
      id: '8',
      name: '혜공',
      role: '조연',
      faction: '소림사',
      age: '80세',
      martial_rank: '준천인급',
      appearance: '민머리, 백색 장삼, 온화한 미소',
      created_at: '2026-02-05',
    },
    {
      id: '9',
      name: '청허자',
      role: '조연',
      faction: '무당파',
      age: '75세',
      martial_rank: '준천인급',
      appearance: '도계, 청색 도관, 긴 백색 수염',
      created_at: '2026-02-05',
    },
    {
      id: '10',
      name: '진만금',
      role: '조연',
      faction: '천보상단',
      age: '50~53세',
      martial_rank: '없음 (상인)',
      appearance: '부유한 상인, 배 나옴',
      created_at: '2026-02-05',
    },
    {
      id: '11',
      name: '장삼',
      role: '조연',
      faction: '흑천상단',
      age: '30~33세',
      martial_rank: '이류급',
      appearance: '책사 스타일, 안경',
      created_at: '2026-02-05',
    },
    {
      id: '12',
      name: '이사',
      role: '조연',
      faction: '흑천상단',
      age: '28~31세',
      martial_rank: '일류급',
      appearance: '근육질, 무력 담당',
      created_at: '2026-02-05',
    },
    {
      id: '13',
      name: '오대',
      role: '조연',
      faction: '흑천상단',
      age: '32~35세',
      martial_rank: '이류급',
      appearance: '정보 수집 전문가',
      created_at: '2026-02-05',
    },
    {
      id: '14',
      name: '육소',
      role: '조연',
      faction: '흑천상단',
      age: '26~29세',
      martial_rank: '삼류급',
      appearance: '물류 관리 전문가',
      created_at: '2026-02-05',
    },
    {
      id: '15',
      name: '독고광',
      role: '조연',
      faction: '흑풍채',
      age: '45세',
      martial_rank: '화경급',
      appearance: '흉악한 얼굴, 큰 칼',
      created_at: '2026-02-05',
    },
    // 단역 5명 샘플
    {
      id: '16',
      name: '왕사',
      role: '단역',
      faction: '취월루 (객잔)',
      age: '45세',
      martial_rank: '없음',
      appearance: '배 나온 중년 장사꾼',
      created_at: '2026-02-05',
    },
    {
      id: '17',
      name: '흑호',
      role: '단역',
      faction: '흑호단',
      age: '38세',
      martial_rank: '삼류급',
      appearance: '흉악한 얼굴, 칼 흉터',
      created_at: '2026-02-05',
    },
    {
      id: '18',
      name: '이삼',
      role: '단역',
      faction: '흑천상단',
      age: '25세',
      martial_rank: '없음',
      appearance: '평범한 점원',
      created_at: '2026-02-05',
    },
    {
      id: '19',
      name: '청풍검각 제자 A',
      role: '단역',
      faction: '청풍검각',
      age: '20세',
      martial_rank: '이류급',
      appearance: '청색 도복, 검',
      created_at: '2026-02-05',
    },
    {
      id: '20',
      name: '소림 승려 A',
      role: '단역',
      faction: '소림사',
      age: '30세',
      martial_rank: '일류급',
      appearance: '민머리, 황색 장삼',
      created_at: '2026-02-05',
    },
    // 소림사 사대금강 (4명)
    {
      id: '21',
      name: '혜정',
      title: '불도금강',
      role: '조연',
      faction: '소림사',
      group_title: '사대금강',
      group_position: 1,
      age: '65세',
      martial_rank: '종사급',
      appearance: '민머리, 근육질, 190cm',
      created_at: '2026-02-05',
    },
    {
      id: '22',
      name: '혜진',
      title: '나한금강',
      role: '조연',
      faction: '소림사',
      group_title: '사대금강',
      group_position: 2,
      age: '63세',
      martial_rank: '종사급',
      appearance: '민머리, 건장함, 185cm',
      created_at: '2026-02-05',
    },
    {
      id: '23',
      name: '혜성',
      title: '역근금강',
      role: '조연',
      faction: '소림사',
      group_title: '사대금강',
      group_position: 3,
      age: '61세',
      martial_rank: '화경급',
      appearance: '민머리, 180cm',
      created_at: '2026-02-05',
    },
    {
      id: '24',
      name: '혜명',
      title: '반야금강',
      role: '조연',
      faction: '소림사',
      group_title: '사대금강',
      group_position: 4,
      age: '60세',
      martial_rank: '화경급',
      appearance: '민머리, 175cm',
      created_at: '2026-02-05',
    },
    // 무당파 무당칠검 (7명)
    {
      id: '25',
      name: '송원교',
      title: '태극검수',
      role: '조연',
      faction: '무당파',
      group_title: '무당칠검',
      group_position: 1,
      age: '70세',
      martial_rank: '종사급',
      appearance: '도계, 청색 도포, 긴 수염',
      created_at: '2026-02-05',
    },
    {
      id: '26',
      name: '송이교',
      title: '현무검존',
      role: '조연',
      faction: '무당파',
      group_title: '무당칠검',
      group_position: 2,
      age: '68세',
      martial_rank: '종사급',
      appearance: '도계, 청색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '27',
      name: '송삼교',
      title: '음양검선',
      role: '조연',
      faction: '무당파',
      group_title: '무당칠검',
      group_position: 3,
      age: '66세',
      martial_rank: '화경급',
      appearance: '도계, 청색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '28',
      name: '송사교',
      title: '청운검성',
      role: '조연',
      faction: '무당파',
      group_title: '무당칠검',
      group_position: 4,
      age: '64세',
      martial_rank: '화경급',
      appearance: '도계, 청색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '29',
      name: '송오교',
      title: '백운검왕',
      role: '조연',
      faction: '무당파',
      group_title: '무당칠검',
      group_position: 5,
      age: '62세',
      martial_rank: '화경급',
      appearance: '도계, 청색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '30',
      name: '송육교',
      title: '삼청검제',
      role: '조연',
      faction: '무당파',
      group_title: '무당칠검',
      group_position: 6,
      age: '60세',
      martial_rank: '일류급',
      appearance: '도계, 청색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '31',
      name: '송칠교',
      title: '자미검군',
      role: '조연',
      faction: '무당파',
      group_title: '무당칠검',
      group_position: 7,
      age: '58세',
      martial_rank: '일류급',
      appearance: '도계, 청색 도포',
      created_at: '2026-02-05',
    },
    // 화산파 화산오선 (5명)
    {
      id: '32',
      name: '정현',
      title: '매화검선',
      role: '조연',
      faction: '화산파',
      group_title: '화산오선',
      group_position: 1,
      age: '72세',
      martial_rank: '종사급',
      appearance: '도계, 백색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '33',
      name: '정무',
      title: '청송검왕',
      role: '조연',
      faction: '화산파',
      group_title: '화산오선',
      group_position: 2,
      age: '70세',
      martial_rank: '종사급',
      appearance: '도계, 백색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '34',
      name: '정진',
      title: '백운검성',
      role: '조연',
      faction: '화산파',
      group_title: '화산오선',
      group_position: 3,
      age: '68세',
      martial_rank: '화경급',
      appearance: '도계, 백색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '35',
      name: '정청',
      title: '창송검제',
      role: '조연',
      faction: '화산파',
      group_title: '화산오선',
      group_position: 4,
      age: '66세',
      martial_rank: '화경급',
      appearance: '도계, 백색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '36',
      name: '정풍',
      title: '옥봉검군',
      role: '조연',
      faction: '화산파',
      group_title: '화산오선',
      group_position: 5,
      age: '64세',
      martial_rank: '화경급',
      appearance: '도계, 백색 도포',
      created_at: '2026-02-05',
    },
    // 아미파 아미삼수 (3명, 여성)
    {
      id: '37',
      name: '정혜',
      title: '청운검선',
      role: '조연',
      faction: '아미파',
      group_title: '아미삼수',
      group_position: 1,
      age: '50세',
      martial_rank: '화경급',
      appearance: '여성, 도복, 단정한 머리',
      created_at: '2026-02-05',
    },
    {
      id: '38',
      name: '정신',
      title: '백매검왕',
      role: '조연',
      faction: '아미파',
      group_title: '아미삼수',
      group_position: 2,
      age: '48세',
      martial_rank: '화경급',
      appearance: '여성, 도복',
      created_at: '2026-02-05',
    },
    {
      id: '39',
      name: '정화',
      title: '자죽검제',
      role: '조연',
      faction: '아미파',
      group_title: '아미삼수',
      group_position: 3,
      age: '46세',
      martial_rank: '일류급',
      appearance: '여성, 도복',
      created_at: '2026-02-05',
    },
    // 곤륜파 곤륜삼성 (3명)
    {
      id: '40',
      name: '현천',
      title: '빙설검선',
      role: '조연',
      faction: '곤륜파',
      group_title: '곤륜삼성',
      group_position: 1,
      age: '75세',
      martial_rank: '종사급',
      appearance: '백발, 백색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '41',
      name: '현지',
      title: '한강검왕',
      role: '조연',
      faction: '곤륜파',
      group_title: '곤륜삼성',
      group_position: 2,
      age: '73세',
      martial_rank: '화경급',
      appearance: '백발, 백색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '42',
      name: '현인',
      title: '설산검군',
      role: '조연',
      faction: '곤륜파',
      group_title: '곤륜삼성',
      group_position: 3,
      age: '71세',
      martial_rank: '화경급',
      appearance: '백발, 백색 도포',
      created_at: '2026-02-05',
    },
    // 천산파 천산육로 (6명)
    {
      id: '43',
      name: '설천',
      title: '빙혼검선',
      role: '조연',
      faction: '천산파',
      group_title: '천산육로',
      group_position: 1,
      age: '68세',
      martial_rank: '화경급',
      appearance: '백발, 백색 도복',
      created_at: '2026-02-05',
    },
    {
      id: '44',
      name: '설지',
      title: '한광검왕',
      role: '조연',
      faction: '천산파',
      group_title: '천산육로',
      group_position: 2,
      age: '66세',
      martial_rank: '화경급',
      appearance: '백발, 백색 도복',
      created_at: '2026-02-05',
    },
    {
      id: '45',
      name: '설인',
      title: '빙정검제',
      role: '조연',
      faction: '천산파',
      group_title: '천산육로',
      group_position: 3,
      age: '64세',
      martial_rank: '일류급',
      appearance: '백발, 백색 도복',
      created_at: '2026-02-05',
    },
    {
      id: '46',
      name: '설의',
      title: '설봉검군',
      role: '조연',
      faction: '천산파',
      group_title: '천산육로',
      group_position: 4,
      age: '62세',
      martial_rank: '일류급',
      appearance: '백발, 백색 도복',
      created_at: '2026-02-05',
    },
    {
      id: '47',
      name: '설예',
      title: '백설검사',
      role: '조연',
      faction: '천산파',
      group_title: '천산육로',
      group_position: 5,
      age: '60세',
      martial_rank: '일류급',
      appearance: '백발, 백색 도복',
      created_at: '2026-02-05',
    },
    {
      id: '48',
      name: '설륙',
      title: '한빙검랑',
      role: '조연',
      faction: '천산파',
      group_title: '천산육로',
      group_position: 6,
      age: '58세',
      martial_rank: '일류급',
      appearance: '백발, 백색 도복',
      created_at: '2026-02-05',
    },
    // 개방 개방팔대장로 (8명)
    {
      id: '49',
      name: '홍칠공',
      title: '신룡견',
      role: '조연',
      faction: '개방',
      group_title: '개방팔대장로',
      group_position: 1,
      age: '80세',
      martial_rank: '준천인급',
      appearance: '거지 복장, 허름함',
      created_at: '2026-02-05',
    },
    {
      id: '50',
      name: '구장로',
      title: '타구봉',
      role: '조연',
      faction: '개방',
      group_title: '개방팔대장로',
      group_position: 2,
      age: '75세',
      martial_rank: '종사급',
      appearance: '거지 복장',
      created_at: '2026-02-05',
    },
    {
      id: '51',
      name: '팔대장로',
      title: '철장',
      role: '조연',
      faction: '개방',
      group_title: '개방팔대장로',
      group_position: 3,
      age: '73세',
      martial_rank: '화경급',
      appearance: '거지 복장',
      created_at: '2026-02-05',
    },
    {
      id: '52',
      name: '칠대장로',
      title: '천음자',
      role: '조연',
      faction: '개방',
      group_title: '개방팔대장로',
      group_position: 4,
      age: '71세',
      martial_rank: '화경급',
      appearance: '거지 복장',
      created_at: '2026-02-05',
    },
    {
      id: '53',
      name: '육대장로',
      title: '흑풍도',
      role: '조연',
      faction: '개방',
      group_title: '개방팔대장로',
      group_position: 5,
      age: '69세',
      martial_rank: '화경급',
      appearance: '거지 복장',
      created_at: '2026-02-05',
    },
    {
      id: '54',
      name: '오대장로',
      title: '천절봉',
      role: '조연',
      faction: '개방',
      group_title: '개방팔대장로',
      group_position: 6,
      age: '67세',
      martial_rank: '일류급',
      appearance: '거지 복장',
      created_at: '2026-02-05',
    },
    {
      id: '55',
      name: '사대장로',
      title: '독룡장',
      role: '조연',
      faction: '개방',
      group_title: '개방팔대장로',
      group_position: 7,
      age: '65세',
      martial_rank: '일류급',
      appearance: '거지 복장',
      created_at: '2026-02-05',
    },
    {
      id: '56',
      name: '삼대장로',
      title: '철퇴',
      role: '조연',
      faction: '개방',
      group_title: '개방팔대장로',
      group_position: 8,
      age: '63세',
      martial_rank: '일류급',
      appearance: '거지 복장',
      created_at: '2026-02-05',
    },
    // 남궁세가 남궁오검 (5명)
    {
      id: '57',
      name: '남궁진',
      title: '제왕검성',
      role: '조연',
      faction: '남궁세가',
      group_title: '남궁오검',
      group_position: 1,
      age: '55세',
      martial_rank: '종사급',
      appearance: '청색 도포, 귀족풍',
      created_at: '2026-02-05',
    },
    {
      id: '58',
      name: '남궁무',
      title: '천뢰검왕',
      role: '조연',
      faction: '남궁세가',
      group_title: '남궁오검',
      group_position: 2,
      age: '53세',
      martial_rank: '화경급',
      appearance: '청색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '59',
      name: '남궁현',
      title: '벽력검제',
      role: '조연',
      faction: '남궁세가',
      group_title: '남궁오검',
      group_position: 3,
      age: '51세',
      martial_rank: '화경급',
      appearance: '청색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '60',
      name: '남궁청',
      title: '청운검군',
      role: '조연',
      faction: '남궁세가',
      group_title: '남궁오검',
      group_position: 4,
      age: '49세',
      martial_rank: '화경급',
      appearance: '청색 도포',
      created_at: '2026-02-05',
    },
    {
      id: '61',
      name: '남궁혁',
      title: '천마검랑',
      role: '조연',
      faction: '남궁세가',
      group_title: '남궁오검',
      group_position: 5,
      age: '47세',
      martial_rank: '일류급',
      appearance: '청색 도포',
      created_at: '2026-02-05',
    },
    // 점창파 점창십팔기 중 상위 5명
    {
      id: '62',
      name: '적천후',
      title: '천창신',
      role: '조연',
      faction: '점창파',
      group_title: '점창십팔기',
      group_position: 1,
      age: '60세',
      martial_rank: '화경급',
      appearance: '붉은 도포, 창 휴대',
      created_at: '2026-02-05',
    },
    {
      id: '63',
      name: '적천웅',
      title: '혈창왕',
      role: '조연',
      faction: '점창파',
      group_title: '점창십팔기',
      group_position: 2,
      age: '58세',
      martial_rank: '화경급',
      appearance: '붉은 도복',
      created_at: '2026-02-05',
    },
    {
      id: '64',
      name: '적천용',
      title: '적룡창',
      role: '조연',
      faction: '점창파',
      group_title: '점창십팔기',
      group_position: 3,
      age: '56세',
      martial_rank: '일류급',
      appearance: '붉은 도복',
      created_at: '2026-02-05',
    },
    {
      id: '65',
      name: '적천호',
      title: '맹호창',
      role: '조연',
      faction: '점창파',
      group_title: '점창십팔기',
      group_position: 4,
      age: '54세',
      martial_rank: '일류급',
      appearance: '붉은 도복',
      created_at: '2026-02-05',
    },
    {
      id: '66',
      name: '적천표',
      title: '표범창',
      role: '조연',
      faction: '점창파',
      group_title: '점창십팔기',
      group_position: 5,
      age: '52세',
      martial_rank: '일류급',
      appearance: '붉은 도복',
      created_at: '2026-02-05',
    },
    // 당가 당가오독 (5명)
    {
      id: '67',
      name: '당영',
      title: '독왕',
      role: '조연',
      faction: '당가',
      group_title: '당가오독',
      group_position: 1,
      age: '50세',
      martial_rank: '화경급',
      appearance: '녹색 도포, 독기 서림',
      created_at: '2026-02-05',
    },
    {
      id: '68',
      name: '당호',
      title: '천독수',
      role: '조연',
      faction: '당가',
      group_title: '당가오독',
      group_position: 2,
      age: '48세',
      martial_rank: '화경급',
      appearance: '녹색 도복',
      created_at: '2026-02-05',
    },
    {
      id: '69',
      name: '당풍',
      title: '혈독마',
      role: '조연',
      faction: '당가',
      group_title: '당가오독',
      group_position: 3,
      age: '46세',
      martial_rank: '일류급',
      appearance: '녹색 도복',
      created_at: '2026-02-05',
    },
    {
      id: '70',
      name: '당운',
      title: '암독귀',
      role: '조연',
      faction: '당가',
      group_title: '당가오독',
      group_position: 4,
      age: '44세',
      martial_rank: '일류급',
      appearance: '녹색 도복',
      created_at: '2026-02-05',
    },
  ];

  // Supabase에서 캐릭터 로드 (사용 안 함 - 비활성)
  // TODO: 향후 Supabase 캐릭터 로드 기능 활성화 시 복원
  // const loadCharacters_disabled = async () => { ... };

  // 필터링된 캐릭터 목록
  const filteredCharacters = characters.filter((char) => {
    const matchRole = selectedRole === '전체' || char.role === selectedRole;
    const matchFaction = selectedFaction === '전체' || char.faction === selectedFaction;
    const matchGroupTitle = selectedGroupTitle === '전체' || char.group_title === selectedGroupTitle;
    const matchSearch = char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      char.faction.toLowerCase().includes(searchTerm.toLowerCase());
    return matchRole && matchFaction && matchGroupTitle && matchSearch;
  });

  // 300명으로 정리
  const handleCleanup = () => {
    if (!confirm(`현재 ${characters.length}명을 300명으로 정리하시겠습니까?\n\n중요도 순으로 선별됩니다.`)) {
      return;
    }

    try {
      // 중복 제거
      const uniqueMap = new Map();
      characters.forEach(char => {
        if (!uniqueMap.has(char.name)) {
          uniqueMap.set(char.name, char);
        }
      });

      const unique = Array.from(uniqueMap.values());

      // 중요도 정렬
      const roleWeight: Record<string, number> = {
        '주인공': 1000,
        '주요 조연': 100,
        '조연': 10,
        '단역': 1
      };

      unique.sort((a, b) => {
        const weightA = roleWeight[a.role] || 1;
        const weightB = roleWeight[b.role] || 1;
        if (weightA !== weightB) return weightB - weightA;

        const appearA = a.appearances?.length || 1;
        const appearB = b.appearances?.length || 1;
        if (appearA !== appearB) return appearB - appearA;

        const firstA = a.first_appearance || 999;
        const firstB = b.first_appearance || 999;
        return firstA - firstB;
      });

      // 300명 선별
      const final300 = unique.slice(0, 300).map((char, index) => ({
        ...char,
        id: `char_${index + 1}`
      }));

      // 저장
      setCharacters(final300);
      localStorage.setItem('novel_characters', JSON.stringify(final300));

      alert(`✅ 정리 완료!\n\n${characters.length}명 → ${final300.length}명`);
    } catch (error) {
      console.error('정리 실패:', error);
      alert('정리 중 오류가 발생했습니다.');
    }
  };

  // 캐릭터 추가 (서버 API 경유 → service role key로 RLS 우회)
  const handleAddCharacter = async () => {
    try {
      setLoading(true);

      const insertData = {
        series_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: formData.name,
        title: formData.title || null,
        role: formData.role,
        faction: formData.faction || null,
        group_title: formData.group_title || null,
        group_position: formData.group_position || null,
        age: formData.age || null,
        martial_rank: formData.martial_rank || null,
        appearance: formData.appearance || null,
      };

      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: insertData }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '추가 실패');

      // 로컬 상태에도 추가 (Supabase가 생성한 id 사용)
      if (result.data) {
        setCharacters([result.data, ...characters]);
      }

      setShowAddModal(false);
      setFormData({
        name: '',
        title: '',
        role: '조연',
        faction: '',
        group_title: '',
        group_position: undefined,
        age: '',
        martial_rank: '',
        appearance: '',
      });
      setLoading(false);
      alert('✅ 캐릭터가 Supabase에 저장되었습니다!');
    } catch (error) {
      console.error('❌ 캐릭터 추가 오류:', error);
      setLoading(false);
      alert('캐릭터 추가 중 오류가 발생했습니다.\n\n' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 🐯 흑호단/흑천상단 캐릭터 일괄 등록
  const handleSeedBlackTiger = async () => {
    // 인명록 기반 흑호단/흑천상단 핵심 멤버 8명
    const blackTigerMembers = [
      {
        name: '마흑호', title: '허세 끝판왕', role: '조연', faction: '흑호단',
        faction_type: '사파', age: '35세', martial_rank: '삼류급',
        appearance: '큰 키에 흉터 가득, 겉은 흉악하지만 눈동자가 흔들림',
        personality: '겉 흉악, 속 소심. 강한 자 앞에서 비굴',
        catchphrase: '내가 이 우강진의 왕이다! 으하하하!',
        speech_style: '허세 섞인 거친 말투, 위기 시 비굴',
        first_appearance: 2, rank_in_faction: '두목',
        habits: ['강한 자 앞에서 비굴한 웃음 (히히히)', '뒤에서 큰소리', '도망 준비'],
      },
      {
        name: '조칠', title: '죽어도 회장님', role: '주요 조연', faction: '흑호단',
        faction_type: '사파', age: '25세', martial_rank: '삼류급',
        appearance: '투박함, 각진 턱, 185cm 건장함, 왼쪽 눈썹 칼 흉터',
        personality: '무뚝뚝, 과묵, 극도의 충성심',
        catchphrase: '회장님!',
        speech_style: '짧고 단호한 문장, 존대와 반말 혼용',
        first_appearance: 1, rank_in_faction: '말단',
        habits: ['가슴을 주먹으로 치며 예!', '표정 변화 없이 한마디'],
      },
      {
        name: '왕팔', title: '1문도 안 틀리는 주판귀신', role: '주요 조연', faction: '흑호단',
        faction_type: '사파', age: '23세', martial_rank: '없음',
        appearance: '동글동글, 165cm 통통함, 초승달 눈',
        personality: '밝고 수다스러움, 숫자 앞에서 진지',
        catchphrase: '3,752냥 37문 5푼입니다!',
        speech_style: '빠르고 수다스러운 말투, 숫자 말할 때만 또박또박',
        first_appearance: 1, rank_in_faction: '잡일꾼',
        habits: ['주판 소리 딸깍딸깍', '숫자 들으면 자동 암산'],
      },
      {
        name: '강무혁', title: '주먹이 입보다 빠른 남자', role: '조연', faction: '흑호단',
        faction_type: '사파', age: '30세', martial_rank: '삼류급',
        appearance: '떡 벌어진 어깨, 주먹에 굳은살, 눈 작고 입 큼',
        personality: '단순, 직진, 충성. 생각 전에 주먹이 나감',
        catchphrase: '일단 때리고 생각하자!',
        speech_style: '짧고 단순한 문장, 감탄사 많음',
        first_appearance: 8, rank_in_faction: '행동대장',
        habits: ['양주먹 부딪치기 (뚝뚝)', '싸움 전 목 돌리기'],
      },
      {
        name: '장삼', title: '말이 너무 긴 천재 참모', role: '조연', faction: '흑천상단',
        faction_type: '상단', age: '30~33세', martial_rank: '이류급',
        appearance: '책사 스타일, 두꺼운 보고서 들고 다님',
        personality: '꼼꼼하고 분석적, 말이 너무 길어서 주변에서 한숨',
        catchphrase: '자, 첫째로... 둘째로... 셋째로...',
        speech_style: '장황한 설명체, 번호 매겨가며 나열',
        first_appearance: 30, rank_in_faction: '참모',
        habits: ['손가락 세며 설명', '두꺼운 보고서 들고 다님'],
      },
      {
        name: '이사', title: '만년 2등의 한', role: '조연', faction: '흑천상단',
        faction_type: '상단', age: '28~31세', martial_rank: '일류급',
        appearance: '조칠과 비슷한 체격이지만 살짝 작음',
        personality: '실력파이지만 조칠 콤플렉스, 2인자의 한',
        catchphrase: '조칠 형이 없었으면 내가 1등인데...',
        speech_style: '조칠과 비교할 때 억울한 투, 평소엔 차분',
        first_appearance: 30, rank_in_faction: '무력 담당',
        habits: ['조칠과 비교당할 때 이빨 악물기', '몰래 추가 수련'],
      },
      {
        name: '오대', title: '소문의 왕', role: '조연', faction: '흑천상단',
        faction_type: '상단', age: '32~35세', martial_rank: '이류급',
        appearance: '평범한 얼굴, 귀가 유난히 큼, 존재감 제로',
        personality: '조용한 관찰자, 소문 중독, 남의 비밀이 취미',
        catchphrase: '회장님, 어젯밤 서문 객잔에서 이런 말이 돌았습니다.',
        speech_style: '속삭이는 톤, 항상 주변을 살피며 말함',
        first_appearance: 40, rank_in_faction: '정보통',
        habits: ['귀를 기울이는 자세', '쪽지 전달', '동시에 3가지 대화 엿듣기'],
      },
      {
        name: '육소', title: '길치 물류왕', role: '조연', faction: '흑천상단',
        faction_type: '상단', age: '26~29세', martial_rank: '삼류급',
        appearance: '보따리꾼 스타일, 어깨 넓고 다리 긴 체형',
        personality: '물류 시스템 천재인데 자기가 배달하면 항상 미아',
        catchphrase: '서쪽으로 가면... 어? 이게 왜 동쪽이지?',
        speech_style: '당당하게 말하다가 길 잃으면 당황, 숫자 말할 때 정확',
        first_appearance: 45, rank_in_faction: '물류 담당',
        habits: ['지도를 거꾸로 봄 (본인은 모름)', '짐 개수만은 정확'],
      },
    ];

    if (!confirm(`🐯 흑호단/흑천상단 핵심 멤버 ${blackTigerMembers.length}명을 Supabase에 등록합니다.\n\n` +
      blackTigerMembers.map(m => `- ${m.name} (${m.faction}, ${m.role})`).join('\n') +
      '\n\n진행하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 중복 체크: 이미 등록된 이름 확인
      const names = blackTigerMembers.map(m => m.name);
      const { data: existing } = await supabase
        .from('characters')
        .select('name')
        .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .in('name', names);

      const existingNames = new Set(existing?.map(e => e.name) || []);
      const newMembers = blackTigerMembers.filter(m => !existingNames.has(m.name));

      if (newMembers.length === 0) {
        setLoading(false);
        alert('이미 모든 흑호단/흑천상단 멤버가 등록되어 있습니다!');
        return;
      }

      // Supabase에 삽입
      const insertData = newMembers.map(m => ({
        ...m,
        series_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        martial_rank_numeric: m.martial_rank === '일류급' ? 3 : m.martial_rank === '이류급' ? 2 : m.martial_rank === '삼류급' ? 1 : 0,
        is_recurring: true,
      }));

      const { data, error } = await supabase
        .from('characters')
        .insert(insertData)
        .select();

      if (error) throw error;

      // 로컬 상태에도 추가
      if (data) {
        setCharacters([...data, ...characters]);
      }

      setLoading(false);
      const skipped = blackTigerMembers.length - newMembers.length;
      alert(`✅ 흑호단/흑천상단 등록 완료!\n\n신규: ${newMembers.length}명\n중복 스킵: ${skipped}명`);
    } catch (error) {
      console.error('❌ 흑호단 등록 오류:', error);
      setLoading(false);
      // 에러 메시지를 상세히 표시 (Supabase 에러 포함)
      const errMsg = error instanceof Error 
        ? error.message 
        : (typeof error === 'object' && error !== null) 
          ? JSON.stringify(error, null, 2) 
          : String(error);
      alert('등록 중 오류가 발생했습니다.\n\n' + errMsg);
    }
  };

  // 캐릭터 수정 (서버 API 경유 → service role key로 RLS 우회)
  const handleEditCharacter = async () => {
    if (!editingChar) return;
    try {
      setLoading(true);
      const { id, created_at, updated_at, ...updateData } = editingChar;

      const res = await fetch('/api/characters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updateData }),
      });

      const result = await res.json();
      if (!res.ok) {
        console.error('Supabase 업데이트 오류:', result.error);
        alert(`❌ 저장 실패: ${result.error}`);
        setLoading(false);
        return;
      }

      // 로컬 상태도 동기화
      const updatedList = characters.map((char) =>
        char.id === editingChar.id ? { ...char, ...editingChar } as Character : char
      );
      setCharacters(updatedList);
      localStorage.setItem('novel_characters', JSON.stringify(updatedList));
      setShowEditModal(false);
      setSelectedCharacter(null);
      setEditingChar(null);
      setLoading(false);
      alert('✅ 30가지 특징이 Supabase에 저장되었습니다!');
    } catch (error) {
      console.error('수정 오류:', error);
      alert('❌ 수정 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 캐릭터 삭제
  const handleDeleteCharacter = (char: Character) => {
    if (!confirm(`"${char.name}"을(를) 삭제하시겠습니까?`)) return;
    setCharacters(characters.filter((c) => c.id !== char.id));
    alert('✅ 캐릭터가 삭제되었습니다!');
  };

  // 수정 모달 열기 (30가지 특징 전체 로드)
  const openEditModal = (char: Character) => {
    setSelectedCharacter(char);
    setEditingChar({ ...char }); // 전체 필드 복사
    setEditTab(0); // 첫 번째 탭으로 초기화
    setFormData({
      name: char.name,
      title: char.title || '',
      role: char.role,
      faction: char.faction,
      group_title: char.group_title || '',
      group_position: char.group_position,
      age: char.age,
      martial_rank: char.martial_rank,
      appearance: char.appearance,
    });
    setShowEditModal(true);
  };

  // 역할별 색상
  const roleColor: Record<string, string> = {
    '주인공': 'text-yellow-300 bg-yellow-400/15',
    '주요 조연': 'text-amber-300 bg-amber-400/15',
    '조연': 'text-blue-300 bg-blue-400/10',
    '단역': 'text-gray-400 bg-gray-500/10',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* ── 상단 헤더 ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-murim-border bg-murim-darker/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* 왼쪽: 제목 + 통계 요약 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Users className="w-7 h-7 text-murim-gold" />
              <div>
                <h1 className="text-xl font-bold text-foreground">캐릭터 인명록</h1>
                <p className="text-xs text-gray-500">총 {characters.length}명</p>
              </div>
            </div>
            {/* 인라인 통계 */}
            <div className="hidden md:flex items-center gap-3 text-xs">
              <span className="text-yellow-300">주인공 {characters.filter(c => c.role === '주인공').length}</span>
              <span className="text-gray-600">|</span>
              <span className="text-amber-300">주요조연 {characters.filter(c => c.role === '주요 조연').length}</span>
              <span className="text-gray-600">|</span>
              <span className="text-blue-300">조연 {characters.filter(c => c.role === '조연').length}</span>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400">단역 {characters.filter(c => c.role === '단역').length}</span>
            </div>
          </div>

          {/* 오른쪽: 새 캐릭터 + 관리 도구 드롭다운 */}
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-murim-gold hover:bg-yellow-600 text-murim-darker rounded-lg font-medium transition-colors"
              onClick={() => {
                setFormData({ name: '', title: '', role: '조연', faction: '', group_title: '', group_position: undefined, age: '', martial_rank: '', appearance: '' });
                setShowAddModal(true);
              }}
            >
              <Plus className="w-4 h-4" />
              새 캐릭터
            </button>

            {/* 관리 도구 드롭다운 */}
            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => setShowTools(!showTools)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-murim-darker border border-murim-border hover:border-gray-500 text-gray-300 rounded-lg font-medium transition-colors"
              >
                <Settings className="w-4 h-4" />
                관리 도구
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTools ? 'rotate-180' : ''}`} />
              </button>
              {showTools && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-murim-darker border border-murim-border rounded-lg shadow-xl z-30 py-1">
                  {characters.length < 1000 && (
                    <button onClick={() => { handleGenerate1000Characters(); setShowTools(false); }} disabled={loading}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40">
                      🚀 1000명 자동 생성 (현재 {characters.length}명)
                    </button>
                  )}
                  <button onClick={() => { handleUploadToSupabase(); setShowTools(false); }} disabled={loading || characters.length === 0}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40">
                    📤 Supabase 업로드 ({characters.length}명)
                  </button>
                  <button onClick={() => { handleEnrichCharacters(); setShowTools(false); }} disabled={loading}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40">
                    🔥 상세 정보 자동 채우기
                  </button>
                  <button onClick={() => { handleSeedBlackTiger(); setShowTools(false); }} disabled={loading}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40">
                    🐯 흑호단/흑천상단 등록
                  </button>
                  <div className="border-t border-murim-border my-1" />
                  <button onClick={() => { handleCleanupCharacters(); setShowTools(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">
                    🧹 중복 제거
                  </button>
                  <button onClick={() => { handleCleanup(); setShowTools(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">
                    📋 300명으로 정리
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 검색 + 필터 (한 줄) */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {/* 검색 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="이름 · 소속 검색..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-accent placeholder:text-gray-600"
            />
          </div>
          {/* 역할 드롭다운 */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 text-sm bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
          >
            {roles.map(r => <option key={r} value={r}>{r === '전체' ? '역할: 전체' : r}</option>)}
          </select>
          {/* 문파 드롭다운 */}
          <select
            value={selectedFaction}
            onChange={(e) => setSelectedFaction(e.target.value)}
            className="px-3 py-2 text-sm bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-accent max-w-[180px]"
          >
            {factions.map(f => <option key={f} value={f}>{f === '전체' ? '문파: 전체' : f}</option>)}
          </select>
          {/* 단체외호 드롭다운 */}
          {groupTitles.length > 1 && (
            <select
              value={selectedGroupTitle}
              onChange={(e) => setSelectedGroupTitle(e.target.value)}
              className="px-3 py-2 text-sm bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-purple-500 max-w-[180px]"
            >
              {groupTitles.map(g => <option key={g} value={g}>{g === '전체' ? '단체: 전체' : g}</option>)}
            </select>
          )}
          {/* 결과 수 */}
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {filteredCharacters.length}명 표시
          </span>
        </div>
      </div>

      {/* ── 메인: 테이블 목록 ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500">
            캐릭터 불러오는 중...
          </div>
        ) : filteredCharacters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
            <Users className="w-10 h-10 opacity-30" />
            <span className="text-sm">검색 결과가 없습니다</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-murim-darker border-b border-murim-border">
              <tr className="text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium w-[180px]">이름</th>
                <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">소속</th>
                <th className="text-center px-3 py-3 font-medium w-[90px]">역할</th>
                <th className="text-center px-3 py-3 font-medium w-[80px] hidden md:table-cell">나이</th>
                <th className="text-center px-3 py-3 font-medium w-[90px] hidden md:table-cell">무공</th>
                <th className="text-left px-3 py-3 font-medium hidden xl:table-cell">외모</th>
                <th className="text-center px-3 py-3 font-medium w-[80px]">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-murim-border/50">
              {filteredCharacters.map((char) => (
                <tr
                  key={char.id}
                  className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                  onClick={() => openEditModal(char)}
                >
                  {/* 이름 + 호 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{char.name}</span>
                      {char.title && (
                        <span className="text-murim-gold text-xs hidden sm:inline">({char.title})</span>
                      )}
                    </div>
                    {char.group_title && (
                      <span className="text-[11px] text-purple-400">
                        {char.group_title}{char.group_position ? ` ${char.group_position}번` : ''}
                      </span>
                    )}
                  </td>
                  {/* 소속 */}
                  <td className="px-3 py-3 text-gray-400 hidden lg:table-cell">{char.faction}</td>
                  {/* 역할 */}
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${roleColor[char.role] || 'text-gray-400 bg-gray-500/10'}`}>
                      {char.role}
                    </span>
                  </td>
                  {/* 나이 */}
                  <td className="px-3 py-3 text-center text-gray-400 hidden md:table-cell">{char.age}</td>
                  {/* 무공 */}
                  <td className="px-3 py-3 text-center text-gray-300 hidden md:table-cell">{char.martial_rank}</td>
                  {/* 외모 */}
                  <td className="px-3 py-3 text-gray-500 text-xs truncate max-w-[200px] hidden xl:table-cell">{char.appearance}</td>
                  {/* 관리 버튼 */}
                  <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEditModal(char)}
                        className="p-1.5 hover:bg-murim-gold/20 rounded transition-colors"
                        title="수정"
                      >
                        <Edit className="w-3.5 h-3.5 text-murim-gold" />
                      </button>
                      <button
                        onClick={() => handleDeleteCharacter(char)}
                        className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 추가 모달 */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-murim-darker border border-murim-gold rounded-lg max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-foreground mb-6">새 캐릭터 추가</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">이름 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                    placeholder="예: 위소운"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">개인 호 (號)</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                    placeholder="예: 천마검제"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">역할 *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                  >
                    <option value="주인공">주인공</option>
                    <option value="주요 조연">주요 조연</option>
                    <option value="조연">조연</option>
                    <option value="단역">단역</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">소속 문파 *</label>
                  <input
                    type="text"
                    value={formData.faction}
                    onChange={(e) => setFormData({ ...formData, faction: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                    placeholder="예: 천상문"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">단체 외호</label>
                  <input
                    type="text"
                    value={formData.group_title}
                    onChange={(e) => setFormData({ ...formData, group_title: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                    placeholder="예: 사대금강"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">순위</label>
                  <input
                    type="number"
                    value={formData.group_position || ''}
                    onChange={(e) => setFormData({ ...formData, group_position: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                    placeholder="예: 1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 opacity-50">예시</label>
                  <p className="text-xs text-gray-500 mt-2">사대금강 1번</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">나이</label>
                  <input
                    type="text"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                    placeholder="예: 20~23세"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">무공 등급</label>
                  <input
                    type="text"
                    value={formData.martial_rank}
                    onChange={(e) => setFormData({ ...formData, martial_rank: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                    placeholder="예: 일류급"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">외모</label>
                <textarea
                  value={formData.appearance}
                  onChange={(e) => setFormData({ ...formData, appearance: e.target.value })}
                  className="w-full px-4 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-gold"
                  placeholder="예: 준수함, 날카로운 눈매, 180cm"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddCharacter}
                disabled={!formData.name || !formData.faction}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
                  formData.name && formData.faction
                    ? 'bg-murim-gold hover:bg-yellow-600 text-murim-darker'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                추가
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-6 py-3 bg-murim-darker border border-murim-border hover:border-murim-gold text-foreground rounded-lg font-semibold transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {/* ═══ 30가지 특징 상세 편집 모달 (7개 탭) ═══ */}
      {showEditModal && editingChar && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 md:p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-murim-darker border border-murim-accent rounded-lg w-full max-w-5xl max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── 헤더: 캐릭터 이름 + 문파 ── */}
            <div className="flex items-center justify-between p-4 border-b border-murim-border shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {editingChar.name}
                  {editingChar.title && <span className="text-murim-gold ml-2">({editingChar.title})</span>}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {editingChar.faction} · {editingChar.role} · 30가지 특징 편집
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-white text-2xl px-2"
              >
                ✕
              </button>
            </div>

            {/* ── 탭 네비게이션 ── */}
            <div className="flex gap-1 p-2 border-b border-murim-border overflow-x-auto shrink-0">
              {[
                { icon: '👤', label: '기본 정보' },
                { icon: '⚔️', label: '무공/전투' },
                { icon: '👁️', label: '외모/체격' },
                { icon: '💭', label: '성격/말투' },
                { icon: '🏠', label: '출신/배경' },
                { icon: '🍜', label: '음식/생활' },
                { icon: '🤝', label: '인간관계' },
              ].map((tab, idx) => (
                <button
                  key={idx}
                  onClick={() => setEditTab(idx)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    editTab === idx
                      ? 'bg-murim-accent text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* ── 탭 콘텐츠 (스크롤 가능) ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* ───── 탭 0: 기본 정보 ───── */}
              {editTab === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-murim-gold border-b border-murim-border pb-2">기본 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">이름 *</label>
                      <input type="text" value={editingChar.name || ''} onChange={(e) => updateEditField('name', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">개인 호 (號)</label>
                      <input type="text" value={editingChar.title || ''} onChange={(e) => updateEditField('title', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 천마검제" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">역할 *</label>
                      <select value={editingChar.role || '조연'} onChange={(e) => updateEditField('role', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent">
                        <option value="주인공">주인공</option>
                        <option value="주요 조연">주요 조연</option>
                        <option value="조연">조연</option>
                        <option value="단역">단역</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">소속 문파 *</label>
                      <input type="text" value={editingChar.faction || ''} onChange={(e) => updateEditField('faction', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">문파 유형</label>
                      <select value={editingChar.faction_type || ''} onChange={(e) => updateEditField('faction_type', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent">
                        <option value="">선택</option>
                        <option value="정파">정파</option>
                        <option value="사파">사파</option>
                        <option value="세가">세가</option>
                        <option value="상단">상단</option>
                        <option value="관아">관아</option>
                        <option value="무관">무관</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">문파 내 지위</label>
                      <input type="text" value={editingChar.rank_in_faction || ''} onChange={(e) => updateEditField('rank_in_faction', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="장문인, 장로, 제자 등" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">단체 외호</label>
                      <input type="text" value={editingChar.group_title || ''} onChange={(e) => updateEditField('group_title', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 소림사대금강" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">단체 내 순위</label>
                      <input type="number" value={editingChar.group_position ?? ''} onChange={(e) => updateEditField('group_position', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 1" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">중요도 (0~100)</label>
                      <input type="number" value={editingChar.importance_score ?? ''} onChange={(e) => updateEditField('importance_score', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" min={0} max={100} />
                    </div>
                  </div>
                </div>
              )}

              {/* ───── 탭 1: 무공/전투 ───── */}
              {editTab === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-400 border-b border-murim-border pb-2">무공 & 전투</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">무공 등급</label>
                      <select value={editingChar.martial_rank || ''} onChange={(e) => updateEditField('martial_rank', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent">
                        <option value="">선택</option>
                        <option value="삼류급">삼류급</option>
                        <option value="이류급">이류급</option>
                        <option value="일류급">일류급</option>
                        <option value="초일류급">초일류급</option>
                        <option value="화경급">화경급</option>
                        <option value="현경급">현경급</option>
                        <option value="준천인급">준천인급</option>
                        <option value="천인급">천인급</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">내공 연수</label>
                      <input type="number" value={editingChar.internal_energy_years ?? ''} onChange={(e) => updateEditField('internal_energy_years', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 30" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">기 운용 능력</label>
                      <select value={editingChar.qi_control_level || ''} onChange={(e) => updateEditField('qi_control_level', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent">
                        <option value="">선택</option>
                        <option value="초급">초급</option>
                        <option value="중급">중급</option>
                        <option value="고급">고급</option>
                        <option value="대가">대가</option>
                        <option value="절정">절정</option>
                      </select>
                    </div>
                  </div>
                  {/* 전투력 수치 (5개) */}
                  <div className="p-3 bg-black/20 rounded-lg">
                    <p className="text-xs text-gray-500 mb-3">전투력 수치 (0~100)</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { field: 'combat_power', label: '종합', color: 'text-yellow-400' },
                        { field: 'attack_power', label: '공격', color: 'text-red-400' },
                        { field: 'defense_power', label: '방어', color: 'text-blue-400' },
                        { field: 'speed_power', label: '속도', color: 'text-green-400' },
                        { field: 'technique_power', label: '기술', color: 'text-purple-400' },
                      ].map(({ field, label, color }) => (
                        <div key={field} className="text-center">
                          <label className={`block text-xs ${color} mb-1`}>{label}</label>
                          <input type="number" value={editingChar[field] ?? ''} onChange={(e) => updateEditField(field, e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-2 py-1 bg-black/40 border border-murim-border rounded text-foreground text-sm text-center focus:outline-none focus:border-murim-accent" min={0} max={100} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">주 무기</label>
                      <input type="text" value={editingChar.weapon || ''} onChange={(e) => updateEditField('weapon', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 철검" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">보조 무기</label>
                      <input type="text" value={editingChar.weapon_secondary || ''} onChange={(e) => updateEditField('weapon_secondary', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 암기, 독침" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">전투 스타일</label>
                      <input type="text" value={editingChar.fighting_style || ''} onChange={(e) => updateEditField('fighting_style', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 공격형, 기습형" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">무공 목록 (쉼표로 구분)</label>
                    <input type="text" value={getArrayAsString(editingChar.skills)} onChange={(e) => updateEditField('skills', parseArrayFromString(e.target.value))}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 태극검법, 양의검법, 무극검법" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">특수 능력 (쉼표로 구분)</label>
                    <input type="text" value={getArrayAsString(editingChar.special_abilities)} onChange={(e) => updateEditField('special_abilities', parseArrayFromString(e.target.value))}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 독 면역, 야간 시력" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">내공 깊이 설명</label>
                    <input type="text" value={editingChar.internal_energy_level || ''} onChange={(e) => updateEditField('internal_energy_level', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 30년 심후한 내공" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">실전 경험</label>
                    <textarea value={editingChar.combat_experience || ''} onChange={(e) => updateEditField('combat_experience', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={2} placeholder="예: 강호 10년, 실전 50회 이상" />
                  </div>
                </div>
              )}

              {/* ───── 탭 2: 외모/체격 ───── */}
              {editTab === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-cyan-400 border-b border-murim-border pb-2">외모 & 체격</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">나이</label>
                      <input type="text" value={editingChar.age || ''} onChange={(e) => updateEditField('age', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 25세" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">키</label>
                      <input type="text" value={editingChar.height || ''} onChange={(e) => updateEditField('height', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 185cm" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">몸무게</label>
                      <input type="text" value={editingChar.weight || ''} onChange={(e) => updateEditField('weight', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 80kg" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">체형</label>
                      <select value={editingChar.build || ''} onChange={(e) => updateEditField('build', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent">
                        <option value="">선택</option>
                        <option value="마른">마른</option>
                        <option value="호리호리한">호리호리한</option>
                        <option value="보통">보통</option>
                        <option value="단단한">단단한</option>
                        <option value="근육질">근육질</option>
                        <option value="거구">거구</option>
                        <option value="통통한">통통한</option>
                        <option value="왜소한">왜소한</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">외모 상세</label>
                    <textarea value={editingChar.appearance || ''} onChange={(e) => updateEditField('appearance', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={3} placeholder="삭발, 인자한 얼굴, 깊은 눈매..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">특징 (흉터, 문신 등)</label>
                      <textarea value={editingChar.distinctive_features || ''} onChange={(e) => updateEditField('distinctive_features', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={2} placeholder="왼쪽 눈 밑 검은 점, 오른팔 칼자국..." />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">목소리</label>
                      <input type="text" value={editingChar.voice_tone || ''} onChange={(e) => updateEditField('voice_tone', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 굵고 낮은 목소리" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-cyan-400 border-b border-murim-border pb-2 mt-4">의복 & 장신구</h3>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">의복 스타일</label>
                    <textarea value={editingChar.clothing_style || ''} onChange={(e) => updateEditField('clothing_style', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={2} placeholder="회색 승복에 108 염주, 짚신 차림..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">선호 색상 (쉼표로 구분)</label>
                      <input type="text" value={getArrayAsString(editingChar.clothing_colors)} onChange={(e) => updateEditField('clothing_colors', parseArrayFromString(e.target.value))}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 회색, 갈색" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">장신구 (쉼표로 구분)</label>
                      <input type="text" value={getArrayAsString(editingChar.accessories)} onChange={(e) => updateEditField('accessories', parseArrayFromString(e.target.value))}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 108 염주, 철팔찌" />
                    </div>
                  </div>
                </div>
              )}

              {/* ───── 탭 3: 성격/말투 ───── */}
              {editTab === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-green-400 border-b border-murim-border pb-2">성격 & 말투</h3>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">성격 상세</label>
                    <textarea value={editingChar.personality || ''} onChange={(e) => updateEditField('personality', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={3} placeholder="강직하고 의리 있으나, 융통성이 부족한 편..." />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">성격 키워드 (쉼표로 구분)</label>
                    <input type="text" value={getArrayAsString(editingChar.personality_keywords)} onChange={(e) => updateEditField('personality_keywords', parseArrayFromString(e.target.value))}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 우직, 충성, 유머" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">말투</label>
                      <input type="text" value={editingChar.speech_style || ''} onChange={(e) => updateEditField('speech_style', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 존댓말, 하오체, 반말" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">입버릇</label>
                      <input type="text" value={editingChar.catchphrase || ''} onChange={(e) => updateEditField('catchphrase', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder='예: "아미타불..."' />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">대사 예시 (쉼표로 구분)</label>
                    <textarea value={getArrayAsString(editingChar.speech_examples)} onChange={(e) => updateEditField('speech_examples', parseArrayFromString(e.target.value))}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={3} placeholder='"불법을 어기는 자에게 자비란 없느니라.", "시주, 선업을 쌓으시오."' />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">버릇/습관 (쉼표로 구분)</label>
                    <input type="text" value={getArrayAsString(editingChar.habits)} onChange={(e) => updateEditField('habits', parseArrayFromString(e.target.value))}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 염주 돌리기, 눈 감고 명상" />
                  </div>
                </div>
              )}

              {/* ───── 탭 4: 출신/배경 ───── */}
              {editTab === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-amber-400 border-b border-murim-border pb-2">출신 & 배경</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">태생 (출생지)</label>
                      <input type="text" value={editingChar.birthplace || ''} onChange={(e) => updateEditField('birthplace', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 하남 소림" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">고향</label>
                      <input type="text" value={editingChar.hometown || ''} onChange={(e) => updateEditField('hometown', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 하남성 등봉현" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">현 거주지</label>
                      <input type="text" value={editingChar.current_residence || ''} onChange={(e) => updateEditField('current_residence', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 소림사 대웅보전" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">계급/신분</label>
                      <select value={editingChar.social_class || ''} onChange={(e) => updateEditField('social_class', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent">
                        <option value="">선택</option>
                        <option value="귀족">귀족</option>
                        <option value="몰락귀족">몰락귀족</option>
                        <option value="상인">상인</option>
                        <option value="무인">무인</option>
                        <option value="승려">승려</option>
                        <option value="도사">도사</option>
                        <option value="평민">평민</option>
                        <option value="걸인">걸인</option>
                        <option value="노비">노비</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">첫 등장 화</label>
                      <input type="number" value={editingChar.first_appearance ?? ''} onChange={(e) => updateEditField('first_appearance', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 1" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">가문 배경</label>
                    <textarea value={editingChar.family_background || ''} onChange={(e) => updateEditField('family_background', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={3} placeholder="예: 3대째 소림에 입문한 불교 가문..." />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">과거 이야기 (백스토리)</label>
                    <textarea value={editingChar.backstory || ''} onChange={(e) => updateEditField('backstory', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={4} placeholder="어린 시절의 경험, 입문 계기, 과거 사건..." />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">캐릭터 아크 (성장 스토리)</label>
                    <textarea value={editingChar.character_arc || ''} onChange={(e) => updateEditField('character_arc', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={2} placeholder="예: 평범한 제자 → 금강역사 각성 → 소림 수호자" />
                  </div>
                </div>
              )}

              {/* ───── 탭 5: 음식/생활 ───── */}
              {editTab === 5 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-orange-400 border-b border-murim-border pb-2">음식 & 식습관</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">좋아하는 음식 (쉼표로 구분)</label>
                      <input type="text" value={getArrayAsString(editingChar.favorite_foods)} onChange={(e) => updateEditField('favorite_foods', parseArrayFromString(e.target.value))}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 사천 마파두부, 홍소육" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">싫어하는 음식 (쉼표로 구분)</label>
                      <input type="text" value={getArrayAsString(editingChar.disliked_foods)} onChange={(e) => updateEditField('disliked_foods', parseArrayFromString(e.target.value))}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 생선회" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">선호 음료</label>
                      <input type="text" value={editingChar.favorite_drink || ''} onChange={(e) => updateEditField('favorite_drink', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 죽엽청주" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">주량</label>
                      <select value={editingChar.alcohol_tolerance || ''} onChange={(e) => updateEditField('alcohol_tolerance', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent">
                        <option value="">선택</option>
                        <option value="금주">금주</option>
                        <option value="못함">못함</option>
                        <option value="보통">보통</option>
                        <option value="강함">강함</option>
                        <option value="매우 강함">매우 강함</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">식사 습관</label>
                      <input type="text" value={editingChar.eating_habits || ''} onChange={(e) => updateEditField('eating_habits', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 소식, 빨리 먹음" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">금기 음식 (쉼표로 구분)</label>
                    <input type="text" value={getArrayAsString(editingChar.dietary_restrictions)} onChange={(e) => updateEditField('dietary_restrictions', parseArrayFromString(e.target.value))}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 오신채 금지, 육식 금지" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">음식 선호 이유</label>
                    <input type="text" value={editingChar.food_preference_reason || ''} onChange={(e) => updateEditField('food_preference_reason', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 소림 율법에 따라 채식 위주" />
                  </div>

                  <h3 className="text-lg font-semibold text-orange-400 border-b border-murim-border pb-2 mt-4">생활 패턴</h3>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">하루 일과</label>
                    <textarea value={editingChar.daily_routine || ''} onChange={(e) => updateEditField('daily_routine', e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={3} placeholder="새벽 4시 기상 → 아침 예불 → 무공 수련 → ..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">기상 시간</label>
                      <input type="text" value={editingChar.wake_up_time || ''} onChange={(e) => updateEditField('wake_up_time', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 새벽 4시" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">취침 시간</label>
                      <input type="text" value={editingChar.sleep_time || ''} onChange={(e) => updateEditField('sleep_time', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 밤 10시" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">취미 (쉼표로 구분)</label>
                      <input type="text" value={getArrayAsString(editingChar.hobbies)} onChange={(e) => updateEditField('hobbies', parseArrayFromString(e.target.value))}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 바둑, 서예" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">스트레스 해소법</label>
                      <input type="text" value={editingChar.stress_relief_method || ''} onChange={(e) => updateEditField('stress_relief_method', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 목봉 수련, 산책" />
                    </div>
                  </div>
                </div>
              )}

              {/* ───── 탭 6: 인간관계 ───── */}
              {editTab === 6 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-pink-400 border-b border-murim-border pb-2">인간관계</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">스승</label>
                      <input type="text" value={editingChar.mentor || ''} onChange={(e) => updateEditField('mentor', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 현허대사" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">제자들 (쉼표로 구분)</label>
                      <input type="text" value={getArrayAsString(editingChar.disciples)} onChange={(e) => updateEditField('disciples', parseArrayFromString(e.target.value))}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 혜진, 혜원" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">동료들 (쉼표로 구분)</label>
                      <input type="text" value={getArrayAsString(editingChar.allies)} onChange={(e) => updateEditField('allies', parseArrayFromString(e.target.value))}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 법정, 덕덕" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">적들 (쉼표로 구분)</label>
                      <input type="text" value={getArrayAsString(editingChar.enemies)} onChange={(e) => updateEditField('enemies', parseArrayFromString(e.target.value))}
                        className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" placeholder="예: 혈마, 천독교주" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">인간관계 맵 (이름: 관계, 쉼표로 구분)</label>
                    <textarea value={getJsonAsString(editingChar.relationships)} onChange={(e) => updateEditField('relationships', parseJsonFromString(e.target.value))}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={3} placeholder="예: 법정: 사형제, 덕덕: 사제, 현허: 스승" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">가족 (관계: 상태, 쉼표로 구분)</label>
                    <textarea value={getJsonAsString(editingChar.family_members)} onChange={(e) => updateEditField('family_members', parseJsonFromString(e.target.value))}
                      className="w-full px-3 py-2 bg-black/30 border border-murim-border rounded-lg text-foreground text-sm focus:outline-none focus:border-murim-accent" rows={3} placeholder="예: 부: 사망, 모: 생존, 동생: 실종" />
                  </div>
                </div>
              )}
            </div>

            {/* ── 하단 버튼 (항상 보이도록 고정) ── */}
            <div className="flex items-center gap-3 p-4 border-t border-murim-border shrink-0">
              {/* 이전/다음 탭 네비게이션 */}
              <button
                onClick={() => setEditTab(Math.max(0, editTab - 1))}
                disabled={editTab === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  editTab === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-500 text-white'
                }`}
              >
                ← 이전
              </button>
              <button
                onClick={() => setEditTab(Math.min(6, editTab + 1))}
                disabled={editTab === 6}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  editTab === 6 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-500 text-white'
                }`}
              >
                다음 →
              </button>
              <div className="flex-1" />
              <span className="text-xs text-gray-500">{editTab + 1} / 7</span>
              <button
                onClick={handleEditCharacter}
                disabled={loading}
                className="px-8 py-2 bg-murim-accent hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? '저장 중...' : '💾 Supabase에 저장'}
              </button>
              <button
                onClick={() => { setShowEditModal(false); setEditingChar(null); }}
                className="px-6 py-2 bg-murim-darker border border-murim-border hover:border-murim-accent text-foreground rounded-lg font-medium transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
