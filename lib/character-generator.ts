/**
 * [캐릭터 자동 생성 엔진]
 * 
 * 핵심 기능:
 * 1. 중복 방지: 이름/역할 중복 체크
 * 2. 일관성 유지: 한 번 등장한 캐릭터는 재사용
 * 3. 논리적 검증: 사망한 캐릭터 재등장 방지
 * 4. 지역/세력별 작명 규칙 적용
 */

export interface Character {
  id: string;
  name: string;
  title?: string; // 개인 호 (예: 천마검제)
  role: string;
  faction: string;
  group_title?: string; // 단체 외호 (예: 사대금강)
  group_position?: number; // 단체 내 순위 (예: 1)
  age: string;
  martial_rank: string;
  appearance: string;
  created_at: string;
  // 추가 메타데이터
  first_appearance?: number; // 최초 등장 화
  last_appearance?: number; // 마지막 등장 화
  death_episode?: number; // 사망 화
  is_recurring?: boolean; // 재등장 가능 여부
  appearances?: number[]; // 등장한 모든 화 번호
}

export interface EpisodeCastRequirement {
  episode: number;
  location: string;
  event_type: string;
  required_roles: {
    protagonist: string[]; // 주인공 (고정)
    major_supporting: string[]; // 주요 조연
    supporting: number; // 조연 필요 인원수
    extras: number; // 단역 필요 인원수
  };
  faction_context?: string; // 등장 세력/문파
}

/**
 * [캐릭터 레지스트리 - 중복 방지의 핵심]
 */
export class CharacterRegistry {
  private characters: Map<string, Character> = new Map();
  private nameIndex: Set<string> = new Set(); // 이름 중복 체크용
  private episodeCasts: Map<number, string[]> = new Map(); // 화수별 출연진

  constructor(existingCharacters: Character[] = []) {
    // 기존 캐릭터 등록
    existingCharacters.forEach((char) => {
      this.registerCharacter(char);
    });
  }

  /**
   * 캐릭터 등록
   */
  registerCharacter(character: Character) {
    this.characters.set(character.id, character);
    this.nameIndex.add(character.name);

    // 등장 화 기록
    if (character.appearances) {
      character.appearances.forEach((ep) => {
        if (!this.episodeCasts.has(ep)) {
          this.episodeCasts.set(ep, []);
        }
        this.episodeCasts.get(ep)!.push(character.id);
      });
    }
  }

  /**
   * 이름 중복 체크
   */
  isNameTaken(name: string): boolean {
    return this.nameIndex.has(name);
  }

  /**
   * 캐릭터 검색 (ID로)
   */
  getCharacter(id: string): Character | undefined {
    return this.characters.get(id);
  }

  /**
   * 캐릭터 검색 (이름으로)
   */
  findByName(name: string): Character | undefined {
    return Array.from(this.characters.values()).find((c) => c.name === name);
  }

  /**
   * 특정 화에 이미 등장한 캐릭터 목록
   */
  getEpisodeCast(episode: number): Character[] {
    const ids = this.episodeCasts.get(episode) || [];
    return ids.map((id) => this.characters.get(id)!).filter(Boolean);
  }

  /**
   * 특정 세력/지역의 캐릭터 검색
   */
  findByFaction(faction: string, role?: string): Character[] {
    return Array.from(this.characters.values()).filter(
      (c) => c.faction === faction && (!role || c.role === role)
    );
  }

  /**
   * 재등장 가능한 캐릭터 찾기
   */
  findRecurringCharacters(
    faction: string,
    role: string,
    currentEpisode: number
  ): Character[] {
    return Array.from(this.characters.values()).filter((c) => {
      // 사망했으면 제외
      if (c.death_episode && c.death_episode < currentEpisode) {
        return false;
      }
      // 세력/역할 일치
      if (c.faction === faction && c.role === role) {
        // 재등장 가능 여부
        return c.is_recurring !== false;
      }
      return false;
    });
  }

  /**
   * 모든 캐릭터 반환
   */
  getAllCharacters(): Character[] {
    return Array.from(this.characters.values());
  }

  /**
   * 캐릭터 수
   */
  size(): number {
    return this.characters.size;
  }
}

/**
 * [캐릭터 이름 생성기]
 * 세력/지역별 작명 규칙 적용
 */
export class NameGenerator {
  // 성씨 풀
  private surnames = {
    common: ['이', '김', '박', '최', '정', '강', '조', '윤', '장', '임'],
    noble: ['남궁', '독고', '제갈', '사마', '모용', '황보', '선우'],
    monk: ['혜', '각', '진', '명', '원', '법', '도', '성'],
    taoist: ['청', '백', '적', '황', '현', '자', '상'],
  };

  // 이름 풀 (의미 있는 한자)
  private givenNames = {
    martial: ['무', '검', '도', '창', '권', '장', '공', '룡', '호', '표'],
    virtue: ['인', '의', '예', '지', '신', '충', '효', '렬'],
    nature: ['풍', '운', '산', '강', '화', '목', '수', '금', '토'],
    numbers: ['일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십'],
  };

  /**
   * 세력별 이름 생성
   */
  generateName(faction: string, role: string, registry: CharacterRegistry): string {
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      let name = '';

      // 소림사: 혜자 돌림
      if (faction.includes('소림')) {
        const dharmaName = this.getRandomItem(this.surnames.monk);
        const givenName = this.getRandomItem([
          ...this.givenNames.virtue,
          ...this.givenNames.martial,
        ]);
        name = dharmaName + givenName;
      }
      // 무당파: 청자 계열
      else if (faction.includes('무당')) {
        const taoistName = this.getRandomItem(this.surnames.taoist);
        const givenName = this.getRandomItem(this.givenNames.nature);
        name = taoistName + givenName + '자';
      }
      // 일반 무인
      else {
        const surname = this.getRandomItem(this.surnames.common);
        const given1 = this.getRandomItem(this.givenNames.martial);
        const given2 = this.getRandomItem(this.givenNames.nature);
        name = surname + given1 + given2;
      }

      // 중복 체크
      if (!registry.isNameTaken(name)) {
        return name;
      }

      attempts++;
    }

    // 최악의 경우 숫자 추가
    const baseName = this.getRandomItem(this.surnames.common) + '인';
    let counter = 1;
    while (registry.isNameTaken(baseName + counter)) {
      counter++;
    }
    return baseName + counter;
  }

  /**
   * 호(號) 생성
   */
  generateTitle(name: string, martialRank: string, faction: string): string {
    const titles = {
      천인급: ['천마', '검제', '마존', '검성', '도황', '창신'],
      종사급: ['검왕', '도왕', '장왕', '금강', '나한', '검선'],
      화경급: ['검제', '도제', '장군', '검사', '도사'],
      일류급: ['검수', '도인', '장인'],
    };

    const rankTitles = titles[martialRank as keyof typeof titles] || ['검사'];
    const titleWord = this.getRandomItem(rankTitles);

    // 성격에 따라 접두어 추가
    const prefixes = ['천하', '절대', '무상', '신', '귀', '혈', '암', '백', '흑'];
    const prefix = this.getRandomItem(prefixes);

    return prefix + titleWord;
  }

  private getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}

/**
 * [캐릭터 자동 생성기 메인]
 */
export class CharacterGenerator {
  private registry: CharacterRegistry;
  private nameGenerator: NameGenerator;

  constructor(existingCharacters: Character[] = []) {
    this.registry = new CharacterRegistry(existingCharacters);
    this.nameGenerator = new NameGenerator();
  }

  /**
   * 화수별 필요 캐릭터 생성
   */
  generateForEpisode(
    requirement: EpisodeCastRequirement,
    existingCast: Character[]
  ): Character[] {
    const newCharacters: Character[] = [];

    // 주인공은 고정 (위소운)
    // 주요 조연도 기존 캐릭터 재사용

    // 조연 필요 시
    const supportingNeeded = requirement.required_roles.supporting;
    const existingSupporting = existingCast.filter((c) => c.role === '조연');

    // 부족한 만큼 생성
    const supportingToCreate = Math.max(
      0,
      supportingNeeded - existingSupporting.length
    );

    for (let i = 0; i < supportingToCreate; i++) {
      const char = this.createCharacter({
        role: '조연',
        faction: requirement.faction_context || '무명',
        episode: requirement.episode,
        location: requirement.location,
      });
      newCharacters.push(char);
    }

    // 단역 생성
    for (let i = 0; i < requirement.required_roles.extras; i++) {
      const char = this.createCharacter({
        role: '단역',
        faction: requirement.faction_context || '무명',
        episode: requirement.episode,
        location: requirement.location,
      });
      newCharacters.push(char);
    }

    // 레지스트리에 등록
    newCharacters.forEach((char) => {
      this.registry.registerCharacter(char);
    });

    return newCharacters;
  }

  /**
   * 단일 캐릭터 생성
   */
  private createCharacter(params: {
    role: string;
    faction: string;
    episode: number;
    location: string;
  }): Character {
    const { role, faction, episode, location } = params;

    // 이름 생성 (중복 체크 포함)
    const name = this.nameGenerator.generateName(faction, role, this.registry);

    // 무공 등급
    const martialRank = this.generateMartialRank(role);

    // 호 생성 (주요 인물만)
    const title =
      role === '주요 조연' || role === '주인공'
        ? this.nameGenerator.generateTitle(name, martialRank, faction)
        : undefined;

    // 외모
    const appearance = this.generateAppearance(role, faction);

    // 나이
    const age = this.generateAge(role);

    const character: Character = {
      id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      title,
      role,
      faction,
      age,
      martial_rank: martialRank,
      appearance,
      created_at: new Date().toISOString().split('T')[0],
      first_appearance: episode,
      last_appearance: episode,
      is_recurring: role === '주요 조연' || role === '조연',
      appearances: [episode],
    };

    return character;
  }

  /**
   * 무공 등급 생성
   */
  private generateMartialRank(role: string): string {
    const ranks = {
      주인공: ['천인급', '종사급', '화경급'],
      '주요 조연': ['종사급', '화경급', '일류급'],
      조연: ['화경급', '일류급', '이류급'],
      단역: ['삼류급', '이류급', '없음'],
    };

    const roleRanks = ranks[role as keyof typeof ranks] || ['없음'];
    return roleRanks[Math.floor(Math.random() * roleRanks.length)];
  }

  /**
   * 외모 생성
   */
  private generateAppearance(role: string, faction: string): string {
    const features = [
      '준수한 외모',
      '강인한 인상',
      '온화한 미소',
      '날카로운 눈빛',
      '근육질 체형',
    ];
    const heights = ['165cm', '170cm', '175cm', '180cm', '185cm'];

    const feature = features[Math.floor(Math.random() * features.length)];
    const height = heights[Math.floor(Math.random() * heights.length)];

    return `${feature}, ${height}`;
  }

  /**
   * 나이 생성
   */
  private generateAge(role: string): string {
    const ages = {
      주인공: '20~25세',
      '주요 조연': '25~40세',
      조연: '30~50세',
      단역: '20~60세',
    };

    return ages[role as keyof typeof ages] || '30~40세';
  }

  /**
   * 레지스트리 반환
   */
  getRegistry(): CharacterRegistry {
    return this.registry;
  }

  /**
   * 전체 캐릭터 반환
   */
  getAllCharacters(): Character[] {
    return this.registry.getAllCharacters();
  }
}
