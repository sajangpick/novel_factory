import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * [캐릭터 상세 정보 자동 채우기 API]
 * 
 * 기본 정보만 있는 277명 → 60개 필드 전부 채우기
 * - 출신지, 음식, 무기, 성격, 생활 패턴 등
 */

export async function POST(req: NextRequest) {
  try {
    console.log('🔥 277명 상세 정보 자동 채우기 시작...');

    // Supabase 클라이언트 (service role key → RLS 우회)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 기존 캐릭터 전체 조회
    const { data: characters, error: fetchError } = await supabase
      .from('characters')
      .select('*')
      .order('id');

    if (fetchError) {
      throw new Error(`조회 실패: ${fetchError.message}`);
    }

    console.log(`📋 ${characters.length}명 조회 완료`);

    let successCount = 0;
    let errorCount = 0;

    // 각 캐릭터 상세 정보 생성 및 업데이트
    for (const char of characters) {
      try {
        // 상세 정보 자동 생성
        const enrichedData = generateEnrichedData(char);

        // Supabase 업데이트
        const { error: updateError } = await supabase
          .from('characters')
          .update(enrichedData)
          .eq('id', char.id);

        if (updateError) {
          console.error(`❌ ${char.name} 업데이트 실패:`, updateError);
          errorCount++;
        } else {
          successCount++;
          
          // 진행률 로깅 (10명마다)
          if (successCount % 10 === 0) {
            console.log(`✅ ${successCount}/${characters.length}명 완료`);
          }
        }
      } catch (error) {
        console.error(`❌ ${char.name} 처리 실패:`, error);
        errorCount++;
      }
    }

    console.log(`🎉 완료! 성공: ${successCount}명, 실패: ${errorCount}명`);

    return NextResponse.json({
      success: true,
      total: characters.length,
      updated: successCount,
      failed: errorCount,
      message: `✅ ${successCount}명 상세 정보 완성!`,
    });
  } catch (error) {
    console.error('❌ 전체 오류:', error);
    return NextResponse.json(
      {
        error: '처리 중 오류 발생',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * [캐릭터 상세 정보 자동 생성]
 * 역할, 문파, 이름 기반으로 60개 필드 자동 채우기
 */
function generateEnrichedData(char: any) {
  const { name, role, faction, martial_rank } = char;

  // ═══════════════════════════════════════════════
  // 🔥 0. 무력 및 내공 계산 (등급 기반)
  // ═══════════════════════════════════════════════
  const martialStats = calculateMartialStats(martial_rank, role);
  
  // ═══════════════════════════════════════════════
  // 1. 출신지 결정 (문파/이름 기반)
  // ═══════════════════════════════════════════════
  let birthplace = '중원';
  let hometown = '미상';
  
  if (faction?.includes('흑호단')) {
    birthplace = randomChoice(['북방 하북', '강남 소주', '중원 낙양']);
    hometown = randomChoice(['가난한 농가', '빈민가', '몰락 상인 가문']);
  } else if (faction?.includes('소림')) {
    birthplace = '하남 숭산';
    hometown = '소림사 인근 마을';
  } else if (faction?.includes('무당')) {
    birthplace = '호북 무당산';
    hometown = '무당산 기슭 마을';
  } else if (faction?.includes('화산')) {
    birthplace = '섬서 화산';
    hometown = '화산 인근';
  } else if (faction?.includes('개방')) {
    birthplace = randomChoice(['강남', '중원', '북방']);
    hometown = '거지 출신';
  }

  // ═══════════════════════════════════════════════
  // 2. 무기 결정 (문파/역할 기반)
  // ═══════════════════════════════════════════════
  let weapon = '맨손';
  let weaponDescription = '';
  
  if (faction?.includes('흑호단')) {
    weapon = randomChoice(['철검', '도', '창', '곤봉', '철퇴']);
    weaponDescription = `${weapon} (중급 품질, 실전용)`;
  } else if (faction?.includes('소림')) {
    weapon = randomChoice(['계도', '선장', '맨손']);
    weaponDescription = '소림 불기';
  } else if (faction?.includes('무당') || faction?.includes('화산')) {
    weapon = '검';
    weaponDescription = `장검 (${faction} 제식)`;
  }

  // ═══════════════════════════════════════════════
  // 3. 음식 취향 결정 (출신지/문파 기반)
  // ═══════════════════════════════════════════════
  let favoriteFoods: string[] = [];
  let dislikedFoods: string[] = [];
  let dietaryRestrictions: string[] = [];
  let typicalMeal = '';
  let alcoholTolerance = '보통';
  
  // 불교 문파 (채식)
  if (faction?.includes('소림') || faction?.includes('아미')) {
    favoriteFoods = ['두부', '채소 볶음', '버섯 요리', '죽'];
    dietaryRestrictions = ['육식', '오신채 (마늘, 파, 부추)', '술'];
    typicalMeal = '두부 1모, 나물 2접시, 백미밥, 맑은 차';
    alcoholTolerance = '못함';
  }
  // 도교 문파 (청담)
  else if (faction?.includes('무당') || faction?.includes('화산')) {
    favoriteFoods = ['두부', '생선', '채소', '용정차', '매화주'];
    typicalMeal = '백미밥, 생선찜, 채소, 차 1잔';
    alcoholTolerance = '약함 (1~2잔)';
  }
  // 북방 출신 (고기파)
  else if (birthplace.includes('북방')) {
    favoriteFoods = ['양고기', '우육면', '만두', '소흥주'];
    dislikedFoods = ['생선회 (비린내)', '단 음식'];
    typicalMeal = '우육면 대사이즈 + 고기 2배';
    alcoholTolerance = randomChoice(['강함', '매우 강함']);
  }
  // 강남 출신 (달고 기름진)
  else if (birthplace.includes('강남')) {
    favoriteFoods = ['동파육', '소룡포', '서호초어', '용정차'];
    typicalMeal = '백미밥, 동파육, 소룡포 5개';
    alcoholTolerance = randomChoice(['보통', '강함']);
  }
  // 사천 출신 (매운맛)
  else if (birthplace.includes('사천')) {
    favoriteFoods = ['마파두부', '훠궈', '단단면'];
    typicalMeal = '마파두부 + 백미밥 2공기';
    alcoholTolerance = '매우 강함';
  }
  // 일반 (평범)
  else {
    favoriteFoods = ['백미밥', '포자', '우육면'];
    typicalMeal = '백미밥 + 반찬 2가지';
    alcoholTolerance = '보통';
  }

  // ═══════════════════════════════════════════════
  // 4. 체격 및 체력 (음식과 연결)
  // ═══════════════════════════════════════════════
  let build = '보통';
  let height = '170cm';
  let weight = '65kg';
  let staminaLevel = '보통';
  let staminaReason = '';
  let strengthLevel = '보통';
  let speedLevel = '보통';
  
  // 고기파 → 근육질
  if (favoriteFoods.some(f => f.includes('고기') || f.includes('육'))) {
    build = randomChoice(['근육질', '거구']);
    height = randomChoice(['175cm', '180cm', '185cm', '190cm']);
    weight = randomChoice(['85kg', '90kg', '95kg', '100kg']);
    staminaLevel = randomChoice(['뛰어남', '매우 뛰어남']);
    staminaReason = '고기를 즐겨 먹어 고단백 섭취. 체격이 크고 지구력이 뛰어남.';
    strengthLevel = '뛰어남';
    speedLevel = '보통';
  }
  // 채식파 → 날씬
  else if (dietaryRestrictions.includes('육식')) {
    build = randomChoice(['마른', '호리호리']);
    height = randomChoice(['165cm', '170cm', '175cm']);
    weight = randomChoice(['55kg', '60kg', '65kg']);
    staminaLevel = '보통';
    staminaReason = '채식 위주로 몸이 가볍고 민첩함. 지구력은 보통이나 유연성이 좋음.';
    strengthLevel = '보통';
    speedLevel = '뛰어남';
  }
  // 단맛파 → 통통
  else if (favoriteFoods.some(f => f.includes('동파') || f.includes('소룡포'))) {
    build = '통통';
    height = randomChoice(['160cm', '165cm', '170cm']);
    weight = randomChoice(['70kg', '75kg', '80kg']);
    staminaLevel = '보통';
    staminaReason = '달고 기름진 음식을 즐김. 체구는 작지만 순발력이 좋음.';
    strengthLevel = '보통';
    speedLevel = '뛰어남';
  }
  // 기본
  else {
    height = randomChoice(['165cm', '170cm', '175cm']);
    weight = randomChoice(['60kg', '65kg', '70kg']);
  }

  // ═══════════════════════════════════════════════
  // 5. 성격 및 말투 (문파/역할 기반)
  // ═══════════════════════════════════════════════
  let personality = '';
  let personalityKeywords: string[] = [];
  let speechStyle = '';
  let speechExamples: string[] = [];
  
  if (faction?.includes('흑호단')) {
    personality = randomChoice([
      '우직하고 충성스러움',
      '거칠지만 의리 있음',
      '과묵하고 냉정함',
      '열혈이고 직선적임'
    ]);
    personalityKeywords = ['의리', '충성', '실용주의'];
    speechStyle = randomChoice(['존댓말 (상관에게)', '반말 (동료에게)', '짧고 힘참']);
    speechExamples = [
      '알겠습니다.',
      '명을 받들겠습니다.',
      '끝났습니다.'
    ];
  } else if (faction?.includes('소림')) {
    personality = '자비롭고 인내심이 강함';
    personalityKeywords = ['자비', '인내', '계율'];
    speechStyle = '존댓말, 불교 용어 사용';
    speechExamples = [
      '아미타불.',
      '선하시구려.',
      '계율을 지켜야 합니다.'
    ];
  } else if (faction?.includes('무당') || faction?.includes('화산')) {
    personality = '냉정하고 예의 바름';
    personalityKeywords = ['냉정', '예의', '검의'];
    speechStyle = '존댓말, 검객 어투';
    speechExamples = [
      '실례하겠소.',
      '검을 뽑겠소.',
      '물러가시오.'
    ];
  }

  // ═══════════════════════════════════════════════
  // 6. 생활 패턴 (문파/성격 기반)
  // ═══════════════════════════════════════════════
  let dailyRoutine = '';
  let wakeUpTime = '06:00';
  let sleepTime = '22:00';
  let sleepingPattern = '보통';
  let hobbies: string[] = [];
  
  if (faction?.includes('소림')) {
    dailyRoutine = '새벽 4시 기상 → 예불 1시간 → 무술 단련 2시간 → 아침 공양 → 불경 독송 → 점심 공양 → 무술 수련 → 저녁 공양 → 명상 → 취침 8시';
    wakeUpTime = '04:00';
    sleepTime = '20:00';
    sleepingPattern = '아침형';
    hobbies = ['불경 독송', '명상', '무술 단련'];
  } else if (faction?.includes('흑호단')) {
    dailyRoutine = '새벽 5~6시 기상 → 무술 단련 1~2시간 → 아침 식사 → 순찰/훈련 → 점심 → 임무 수행 → 저녁 식사 → 휴식 → 취침 10시';
    wakeUpTime = randomChoice(['05:00', '06:00']);
    sleepTime = randomChoice(['22:00', '23:00']);
    sleepingPattern = '아침형';
    hobbies = ['무술 단련', '술자리', '무기 손질'];
  }

  // ═══════════════════════════════════════════════
  // 7. 무공 등급 숫자 변환
  // ═══════════════════════════════════════════════
  const martialRankNumeric = getMartialRankNumeric(martial_rank);

  // ═══════════════════════════════════════════════
  // 8. 외모 상세 (기존 appearance 확장)
  // ═══════════════════════════════════════════════
  const distinctiveFeatures = generateDistinctiveFeatures(char);

  // ═══════════════════════════════════════════════
  // 9. 중요도 점수 (역할 기반)
  // ═══════════════════════════════════════════════
  const importanceMap: Record<string, number> = {
    '주인공': 100,
    '주요 조연': 80,
    '조연': 50,
    '단역': 20,
  };
  const importanceScore = importanceMap[role as string] || 10;

  // ═══════════════════════════════════════════════
  // 반환 데이터
  // ═══════════════════════════════════════════════
  return {
    // 출신 및 배경
    birthplace,
    hometown,
    current_residence: faction || '미상',
    social_class: getSocialClass(faction),
    
    // 체격
    height,
    weight,
    build,
    distinctive_features: distinctiveFeatures,
    
    // 무공 및 무력
    martial_rank_numeric: martialRankNumeric,
    combat_power: martialStats.combat_power,
    attack_power: martialStats.attack_power,
    defense_power: martialStats.defense_power,
    speed_power: martialStats.speed_power,
    technique_power: martialStats.technique_power,
    internal_energy_years: martialStats.internal_energy_years,
    internal_energy_level: martialStats.internal_energy_level,
    qi_control_level: martialStats.qi_control_level,
    combat_experience: martialStats.combat_experience,
    weapon,
    weapon_description: weaponDescription,
    skills: getSkills(faction, martial_rank),
    skill_proficiency: generateSkillProficiency(getSkills(faction, martial_rank), martialStats.combat_power),
    fighting_style: getFightingStyle(weapon, build),
    
    // 성격
    personality,
    personality_keywords: personalityKeywords,
    speech_style: speechStyle,
    speech_examples: speechExamples,
    habits: getHabits(),
    
    // 음식
    favorite_foods: favoriteFoods,
    disliked_foods: dislikedFoods,
    dietary_restrictions: dietaryRestrictions,
    food_preference_reason: getFoodReason(birthplace, favoriteFoods),
    typical_breakfast: typicalMeal,
    typical_lunch: typicalMeal,
    typical_dinner: typicalMeal,
    alcohol_tolerance: alcoholTolerance,
    
    // 체력
    stamina_level: staminaLevel,
    stamina_reason: staminaReason,
    strength_level: strengthLevel,
    speed_level: speedLevel,
    
    // 생활
    daily_routine: dailyRoutine,
    wake_up_time: wakeUpTime,
    sleep_time: sleepTime,
    sleeping_pattern: sleepingPattern,
    hobbies: hobbies,
    
    // 환경
    climate_preference: birthplace.includes('북방') ? '추위에 강함' : birthplace.includes('강남') ? '더위에 강함' : '보통',
    
    // 메타
    importance_score: importanceScore,
    is_recurring: role !== '단역',
  };
}

// ═══════════════════════════════════════════════
// 헬퍼 함수들
// ═══════════════════════════════════════════════

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * [무력 및 내공 계산]
 * 등급 기반으로 전투력, 내공, 각 능력치 자동 계산
 */
function calculateMartialStats(rank: string | null, role: string) {
  if (!rank) {
    return {
      combat_power: 15,
      attack_power: 15,
      defense_power: 15,
      speed_power: 15,
      technique_power: 10,
      internal_energy_years: 1,
      internal_energy_level: '1년 미약한 내공',
      qi_control_level: '초급',
      skill_proficiency: {},
      combat_experience: '실전 경험 없음',
    };
  }

  // 기본 능력치 (등급별)
  let baseCombat = 0;
  let internalYears = 0;
  let qiLevel = '초급';
  let experience = '';

  switch (rank) {
    case '삼류급':
      baseCombat = randomRange(20, 30);
      internalYears = randomRange(1, 3);
      qiLevel = '초급';
      experience = '실전 경험 적음 (10회 미만)';
      break;
    case '이류급':
      baseCombat = randomRange(35, 50);
      internalYears = randomRange(5, 10);
      qiLevel = '초급';
      experience = '실전 경험 보통 (10~30회)';
      break;
    case '일류급':
      baseCombat = randomRange(55, 70);
      internalYears = randomRange(15, 25);
      qiLevel = '중급';
      experience = '강호 5년 이상, 실전 50회 이상';
      break;
    case '준화경급':
      baseCombat = randomRange(70, 80);
      internalYears = randomRange(30, 40);
      qiLevel = '중급';
      experience = '강호 10년 이상, 실전 100회 이상';
      break;
    case '화경급':
      baseCombat = randomRange(80, 90);
      internalYears = randomRange(50, 70);
      qiLevel = '고급';
      experience = '강호 20년 이상, 생사 경험 다수';
      break;
    case '준현경급':
      baseCombat = randomRange(85, 92);
      internalYears = randomRange(80, 100);
      qiLevel = '고급';
      experience = '강호 30년 이상, 절정고수와 대적 경험';
      break;
    case '현경급':
      baseCombat = randomRange(90, 95);
      internalYears = randomRange(100, 150);
      qiLevel = '대가';
      experience = '강호 40년 이상, 생사결 무수히 겪음';
      break;
    case '준천인급':
      baseCombat = randomRange(93, 97);
      internalYears = randomRange(150, 200);
      qiLevel = '대가';
      experience = '강호 50년 이상, 절대고수 반열';
      break;
    case '천인급':
      baseCombat = randomRange(95, 99);
      internalYears = randomRange(200, 300);
      qiLevel = '초절정';
      experience = '강호 전설, 생사를 초월';
      break;
    case '절대고수':
      baseCombat = 100;
      internalYears = randomRange(300, 500);
      qiLevel = '초절정';
      experience = '천하제일, 신의 경지';
      break;
    default:
      baseCombat = 20;
      internalYears = 2;
  }

  // 역할별 보너스 (주인공/주요 조연은 +5)
  const roleBonus = (role === '주인공' || role === '주요 조연') ? 5 : 0;
  const finalCombat = Math.min(100, baseCombat + roleBonus);

  // 능력치 분배 (랜덤 변동)
  const attack = Math.min(100, finalCombat + randomRange(-5, 10));
  const defense = Math.min(100, finalCombat + randomRange(-10, 5));
  const speed = Math.min(100, finalCombat + randomRange(-5, 15));
  const technique = Math.min(100, finalCombat + randomRange(-3, 8));

  // 내공 설명
  const energyDesc = `${internalYears}년 ${getEnergyDescription(internalYears)}`;

  return {
    combat_power: finalCombat,
    attack_power: attack,
    defense_power: defense,
    speed_power: speed,
    technique_power: technique,
    internal_energy_years: internalYears,
    internal_energy_level: energyDesc,
    qi_control_level: qiLevel,
    skill_proficiency: {}, // 나중에 무공 목록 기반으로 채움
    combat_experience: experience,
  };
}

/**
 * [내공 깊이 설명]
 */
function getEnergyDescription(years: number): string {
  if (years < 5) return '미약한 내공';
  if (years < 15) return '기초적인 내공';
  if (years < 30) return '중급 내공';
  if (years < 60) return '심후한 내공';
  if (years < 100) return '정순한 심후내공';
  if (years < 150) return '절정의 내공';
  if (years < 250) return '초절정 내공';
  return '신의 경지 내공';
}

/**
 * [랜덤 범위 숫자]
 */
function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * [무공 숙련도 생성]
 * 전투력 기반으로 각 무공의 숙련도 자동 계산
 */
function generateSkillProficiency(skills: string[], combatPower: number): any {
  if (!skills || skills.length === 0) return {};

  const proficiency: any = {};
  
  // 전투력 기반 평균 숙련도
  let baseProf = 0;
  if (combatPower < 30) baseProf = 30; // 삼류급
  else if (combatPower < 50) baseProf = 50; // 이류급
  else if (combatPower < 70) baseProf = 70; // 일류급
  else if (combatPower < 80) baseProf = 80; // 준화경급
  else if (combatPower < 90) baseProf = 85; // 화경급
  else baseProf = 95; // 현경급 이상

  // 각 무공별 숙련도 (랜덤 편차 ±10)
  skills.forEach((skill, index) => {
    // 첫 번째 무공은 주력 무공이므로 +5 보너스
    const bonus = index === 0 ? 5 : 0;
    const prof = Math.min(100, baseProf + bonus + randomRange(-10, 10));
    proficiency[skill] = prof;
  });

  return proficiency;
}

function getMartialRankNumeric(rank: string | null): number {
  if (!rank) return 0;
  const rankMap: { [key: string]: number } = {
    '삼류급': 1,
    '이류급': 2,
    '일류급': 3,
    '준화경급': 4,
    '화경급': 5,
    '준현경급': 6,
    '현경급': 7,
    '준천인급': 8,
    '천인급': 9,
    '절대고수': 10,
  };
  return rankMap[rank] || 0;
}

function getSocialClass(faction: string | null): string {
  if (!faction) return '평민';
  if (faction.includes('세가') || faction.includes('남궁')) return '귀족';
  if (faction.includes('상단')) return '상인';
  if (faction.includes('개방')) return '빈민';
  if (faction.includes('흑호단')) return '평민';
  return '평민';
}

function getSkills(faction: string | null, rank: string | null): string[] {
  if (!faction) return ['기본 무공'];
  
  if (faction.includes('흑호단')) {
    return ['철골공', '흑호도법', '기본 검법'];
  } else if (faction.includes('소림')) {
    return ['나한권', '금종죄', '소림기본공'];
  } else if (faction.includes('무당')) {
    return ['태극검법', '태극권', '순양공'];
  } else if (faction.includes('화산')) {
    return ['매화검법', '자하신공'];
  }
  
  return ['기본 무공'];
}

function getFightingStyle(weapon: string | null, build: string): string {
  if (weapon?.includes('검')) return '균형형 (공수 겸비)';
  if (weapon?.includes('도')) return '공격형 (힘으로 제압)';
  if (weapon?.includes('창')) return '견제형 (거리 유지)';
  if (build === '근육질') return '파워형';
  if (build === '호리호리') return '속도형';
  return '균형형';
}

function getHabits(): string[] {
  return randomChoice([
    ['전투 전 무기 손질', '긴장하면 턱 긁음'],
    ['말 더듬음', '머리 긁음'],
    ['손가락 꺾기', '목 돌리기'],
    ['눈 가늘게 뜸', '입술 깨물기'],
  ]);
}

function getFoodReason(birthplace: string, foods: string[]): string {
  if (birthplace.includes('북방')) {
    return '북방 출신이라 고기와 면 요리를 즐김. 추운 지역에서 자라 고칼로리 음식 선호.';
  } else if (birthplace.includes('강남')) {
    return '강남 출신이라 달고 기름진 음식을 좋아함. 풍요로운 지역에서 자라 미식에 익숙함.';
  } else if (birthplace.includes('사천')) {
    return '사천 출신이라 매운 음식을 즐김. 어릴 때부터 고추를 먹어 매운맛에 내성이 강함.';
  }
  return '평범한 음식을 선호함.';
}

function generateDistinctiveFeatures(char: any): string {
  const features: string[] = [];
  
  // 무작위 특징 추가
  const possibleFeatures = [
    '날카로운 눈빛',
    '각진 턱',
    '흉터 (왼쪽 팔)',
    '흉터 (얼굴)',
    '굵은 목소리',
    '낮은 목소리',
    '근육질 팔',
    '거친 손',
    '말수 적음',
  ];
  
  const numFeatures = char.role === '주인공' || char.role === '주요 조연' ? 3 : 1;
  for (let i = 0; i < numFeatures; i++) {
    const feature = randomChoice(possibleFeatures);
    if (!features.includes(feature)) {
      features.push(feature);
    }
  }
  
  return features.join(', ');
}
