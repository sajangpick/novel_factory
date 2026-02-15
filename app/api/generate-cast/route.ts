import { NextRequest, NextResponse } from 'next/server';
import {
  CharacterGenerator,
  EpisodeCastRequirement,
  Character,
} from '@/lib/character-generator';

/**
 * [화수별 출연진 자동 생성 API]
 * 
 * 입력:
 * - episodes: 300화 로드맵 데이터
 * - existingCharacters: 기존 캐릭터 목록 (70명)
 * 
 * 출력:
 * - 화수별 출연진 매핑
 * - 새로 생성된 캐릭터 목록
 */

interface Episode {
  id: number;
  title: string;
  skeleton: string;
  section: '기' | '승' | '전' | '결';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { episodes, existingCharacters, targetTotal = 400 } = body;

    if (!episodes || !Array.isArray(episodes)) {
      return NextResponse.json(
        { error: '화 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`🎬 ${episodes.length}화 출연진 생성 시작...`);
    console.log(`📋 기존 캐릭터: ${existingCharacters?.length || 0}명 (보호됨)`);
    console.log(`🎯 목표: ${targetTotal}명`);

    // 캐릭터 생성기 초기화
    const generator = new CharacterGenerator(existingCharacters || []);

    // 화수별 출연진 매핑 결과
    const episodeCasts: {
      episode: number;
      title: string;
      cast: string[]; // 캐릭터 ID 목록
      new_characters: Character[];
    }[] = [];

    let reusedCount = 0;

    // 각 화마다 필요한 캐릭터 분석 및 생성
    for (const episode of episodes) {
      const requirement = analyzeEpisodeRequirement(episode);
      
      // 기존 캐릭터 중 재사용 가능한 캐릭터 찾기
      const registry = generator.getRegistry();
      const existingCast = findSuitableCast(registry, requirement);
      reusedCount += existingCast.length;

      // 400명 제한 체크
      const currentTotal = generator.getAllCharacters().length;
      if (currentTotal >= targetTotal) {
        console.log(`⚠️ ${targetTotal}명 도달! ${episode.id}화에서 중단`);
        
        // 남은 화는 기존 캐릭터만 재사용
        episodeCasts.push({
          episode: episode.id,
          title: episode.title,
          cast: existingCast.map((c) => c.id),
          new_characters: [],
        });
        continue;
      }

      // 부족한 캐릭터 생성 (400명 제한 고려)
      const remainingSlots = targetTotal - currentTotal;
      const newCharacters = generator.generateForEpisode(
        requirement,
        existingCast
      );

      // 출연진 기록
      const allCast = [...existingCast, ...newCharacters];
      episodeCasts.push({
        episode: episode.id,
        title: episode.title,
        cast: allCast.map((c) => c.id),
        new_characters: newCharacters,
      });

      // 진행률 로깅 (매 50화마다)
      if (episode.id % 50 === 0) {
        console.log(`✅ ${episode.id}화 완료 (신규: ${newCharacters.length}명, 재사용: ${existingCast.length}명, 총: ${generator.getAllCharacters().length}명)`);
      }
    }

    // 전체 캐릭터 목록
    const allCharacters = generator.getAllCharacters();

    // 400명 제한 (안전 장치)
    const finalCharacters = allCharacters.slice(0, targetTotal);

    console.log(`🎉 완료!`);
    console.log(`📊 기존: ${existingCharacters?.length || 0}명`);
    console.log(`📊 신규: ${finalCharacters.length - (existingCharacters?.length || 0)}명`);
    console.log(`📊 총합: ${finalCharacters.length}명`);
    console.log(`📊 재사용: ${reusedCount}회`);

    // 신규 생성된 캐릭터만 추출
    const newCharacters = finalCharacters.slice(existingCharacters?.length || 0);

    return NextResponse.json({
      success: true,
      totalCharacters: finalCharacters.length,
      existingCount: existingCharacters?.length || 0,
      newCharacters: newCharacters, // 신규만 반환
      newCharactersCount: newCharacters.length,
      reusedCount: reusedCount,
      episodeCasts: episodeCasts,
      message: `✅ ${finalCharacters.length}명 완성! (신규 ${newCharacters.length}명)`,
    });
  } catch (error) {
    console.error('❌ 캐릭터 생성 오류:', error);
    return NextResponse.json(
      {
        error: '캐릭터 생성 중 오류 발생',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * [화 분석: 필요한 캐릭터 역할 추출]
 * 
 * skeleton(100자 뼈대)과 title을 분석하여
 * 어떤 캐릭터가 필요한지 결정
 */
function analyzeEpisodeRequirement(episode: Episode): EpisodeCastRequirement {
  const { id, title, skeleton, section } = episode;

  // 기본 주인공은 항상 등장
  const protagonist = ['위소운'];

  // 주요 조연 (고정)
  const majorSupporting = ['조칠', '왕팔'];

  // 키워드 기반 분석
  let location = '우강진'; // 기본값
  let eventType = '일상';
  let supportingCount = 2; // 조연 기본 인원
  let extrasCount = 3; // 단역 기본 인원
  let factionContext = '흑호단';

  const lowerSkeleton = skeleton.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const combined = lowerSkeleton + lowerTitle;

  // 장소 파악
  if (combined.includes('소주') || combined.includes('蘇州')) {
    location = '소주';
    factionContext = '소주상인';
  } else if (combined.includes('낙양') || combined.includes('洛陽')) {
    location = '낙양';
    factionContext = '낙양상회';
  } else if (combined.includes('개봉') || combined.includes('開封')) {
    location = '개봉';
    factionContext = '개봉무인';
  } else if (combined.includes('소림') || combined.includes('少林')) {
    location = '소림사';
    factionContext = '소림사';
  } else if (combined.includes('무당') || combined.includes('武當')) {
    location = '무당산';
    factionContext = '무당파';
  } else if (combined.includes('화산') || combined.includes('華山')) {
    location = '화산';
    factionContext = '화산파';
  } else if (combined.includes('객잔') || combined.includes('주막')) {
    location = '객잔';
    factionContext = '객잔';
  } else if (combined.includes('상단')) {
    factionContext = '상단';
  }

  // 사건 유형 파악
  if (
    combined.includes('전투') ||
    combined.includes('싸움') ||
    combined.includes('대결') ||
    combined.includes('공격')
  ) {
    eventType = '전투';
    supportingCount = 3;
    extrasCount = 5;
  } else if (
    combined.includes('회의') ||
    combined.includes('협상') ||
    combined.includes('거래')
  ) {
    eventType = '협상';
    supportingCount = 3;
    extrasCount = 2;
  } else if (
    combined.includes('대회') ||
    combined.includes('경연') ||
    combined.includes('비무')
  ) {
    eventType = '대회';
    supportingCount = 5;
    extrasCount = 10;
  } else if (
    combined.includes('문파') ||
    combined.includes('방문') ||
    combined.includes('입문')
  ) {
    eventType = '문파방문';
    supportingCount = 4;
    extrasCount = 6;
  }

  // 구간별 캐릭터 수 조정
  if (section === '기') {
    // 초반부: 적은 인원
    supportingCount = Math.max(2, supportingCount);
    extrasCount = Math.max(2, extrasCount);
  } else if (section === '승') {
    // 중반부: 보통
    supportingCount = Math.max(3, supportingCount);
    extrasCount = Math.max(4, extrasCount);
  } else if (section === '전') {
    // 클라이맥스 전: 많은 인원
    supportingCount = Math.max(4, supportingCount);
    extrasCount = Math.max(6, extrasCount);
  } else if (section === '결') {
    // 대결/마무리: 핵심 인물 중심
    supportingCount = Math.max(3, supportingCount);
    extrasCount = Math.max(3, extrasCount);
  }

  return {
    episode: id,
    location,
    event_type: eventType,
    required_roles: {
      protagonist,
      major_supporting: majorSupporting,
      supporting: supportingCount,
      extras: extrasCount,
    },
    faction_context: factionContext,
  };
}

/**
 * [기존 캐릭터 중 적합한 출연진 찾기]
 * 
 * 재등장 가능한 캐릭터 우선 선택
 */
function findSuitableCast(
  registry: any,
  requirement: EpisodeCastRequirement
): Character[] {
  const cast: Character[] = [];

  // 주인공 추가
  requirement.required_roles.protagonist.forEach((name) => {
    const char = registry.findByName(name);
    if (char) cast.push(char);
  });

  // 주요 조연 추가
  requirement.required_roles.major_supporting.forEach((name) => {
    const char = registry.findByName(name);
    if (char) cast.push(char);
  });

  // 세력별 재등장 캐릭터 찾기 (조연)
  const recurring = registry.findRecurringCharacters(
    requirement.faction_context || '',
    '조연',
    requirement.episode
  );

  // 필요한 만큼만 추가
  const supportingNeeded = requirement.required_roles.supporting;
  const recurringToAdd = recurring.slice(0, supportingNeeded);
  cast.push(...recurringToAdd);

  return cast;
}
