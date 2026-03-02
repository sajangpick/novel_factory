import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 6: 본문 집필 AI 엔진]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 5000자 최종 설계도(Step 4)를 기반으로 실제 소설 본문을 생성
 * 
 * - 화산귀환 스타일: 비장하고 간결한 '토파즈 4K'급 묘사
 * - 페르소나 필터: 이준혁(냉철한 데이터), 천마(압도적 오만)
 * - 기승전결 5막 구조: 도입 → 전개 → 위기 → 절정 → 마무리
 * - 목표 분량: 약 5,000자 (최대 5,500자, 5,500자 초과 절대 금지)
 * - 절단신공: 다음 화가 궁금한 엔딩
 */

// ── 요청 인터페이스 ──
interface GenerateEpisodeRequest {
  episodeNumber: number;         // 화 번호
  episodeTitle: string;          // 화 제목
  blueprint: string;             // Step 4의 5000자 최종 설계도
  structureDesign?: string;      // ★ [파이프라인] 구조 설계 결과 (6하원칉+5막+핵심장면)
  premiumMode?: boolean;         // ★ [A/B 테스트] B모드: 이전화 전문 + 2-pass 생성
  chunkMode?: boolean;           // ★ 장면별 분할 생성: 3단계로 나눠서 생성 (품질↑, 비용 약 1.3배)
  directorMode?: boolean;        // ★ 감독판 모드: 8~12비트 초정밀 생성 (품질↑↑, 비용 약 1.5배)
  section: 'full' | 'intro' | 'development' | 'crisis' | 'climax' | 'ending';
  aiLevel?: 1 | 2 | 3;          // 1=초안(Gemini Flash), 2=다듬기(Claude Sonnet), 3=최종(Claude Opus)
  // ── 참고 데이터 (선택) ──
  characters?: any[];            // 등장 캐릭터 목록
  previousEpisodeSummary?: string; // 이전 화 요약
  worldContext?: string;         // 세계관 참고 자료
  memoryContext?: {              // 현재 상태 대시보드 (Memory System)
    storyDate?: string;
    season?: string;
    currentLocation?: string;
    mcHealth?: string;
    mcMartialRank?: string;
    mcMoney?: string;
    mcEmotion?: string;
    mcInjury?: string;
    mcCurrentGoal?: string;
    personalityMain?: string;
    personalityLee?: string;
    personalityChunma?: string;
    activeForeshadows?: string;
    cautions?: string;
  };
}

// ── 5막 구조 정의 ──
const SECTIONS = {
  intro:       { name: '제1막: 도입', ratio: 0.15, description: '분위기 조성, 상황 설정, 전회 연결' },
  development: { name: '제2막: 전개', ratio: 0.25, description: '갈등 심화, 인물 간 충돌 시작' },
  crisis:      { name: '제3막: 위기', ratio: 0.25, description: '결정적 위기, 선택의 기로' },
  climax:      { name: '제4막: 절정', ratio: 0.20, description: '최대 긴장, 액션/반전' },
  ending:      { name: '제5막: 마무리', ratio: 0.15, description: '여운, 절단신공 (다음 화 유도)' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ★ [품질 엔진] 안티패턴 30가지 — 무협 클리셰 차단
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ★ [품질 엔진 v2] 안티패턴 — 진짜 해로운 것만 10개 (가이드 톤)
// 이전 v1은 30개 금지로 AI를 위축시킴 → v2는 핵심만 남기고 자유롭게 쓰게 함
const ANTI_PATTERNS = `## 📝 더 좋은 문장을 위한 가이드 (참고용 — 자연스러운 글이 최우선)
아래는 자주 보이는 약한 표현입니다. **가능하면** 더 구체적인 묘사로 바꿔보세요.
단, 문맥상 자연스럽다면 그대로 써도 됩니다. 자연스러운 흐름이 가장 중요합니다.

1. "~하는 것이 아닌가!" → 감탄 어미 과용 주의. 담담하게 서술하면 더 강렬합니다
2. "순간, 시간이 멈춘 듯했다" → 찰나의 감각을 구체적으로 쓰면 더 좋습니다
3. "이런 반응은 예상하지 못했다" → 행동으로 보여주면 더 효과적입니다
4. "그것은 바로~" → 내레이터가 직접 설명하기보다 장면으로 드러내기
5. "~라고 할 수 있을까" → 수사 의문보다 단정이 더 힘 있습니다
6. "불안감이 엄습했다" → 신체 반응(손 떨림, 입 마름)으로 보여주면 생생합니다
7. "아니, 그보다~" → 자문자답 반복 주의
8. "정체가 밝혀지는 순간이었다" → 독자가 직접 깨닫게 장면으로
9. "심상치 않은 기운" → 어떤 기운인지 구체적으로 (차갑다, 묵직하다, 날카롭다)
10. "~할 수밖에 없었다" → 능동태가 더 힘이 있습니다

★ 핵심: 감각(시각·청각·촉각·후각) + 행동 + 신체 반응으로 쓰면 독자 몰입도가 올라갑니다.
★ 하지만 "피식 웃었다", "쓴웃음", "그때였다" 같은 자연스러운 표현은 얼마든지 사용하세요.`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ★ [품질 엔진] 스타일 레퍼런스 자동 추출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function extractStyleReference(outputDir: string, latestEpisode: number): string {
  const sensoryWords = ['차가운', '뜨거운', '바람', '향기', '냄새', '소리', '어둠', '빛', '피', '칼', '검', '숨', '침묵', '그림자', '달빛', '새벽', '쇳소리', '파공음', '먼지', '땀', '핏기', '서늘', '묵직'];
  const samples: string[] = [];

  const startEp = Math.max(1, latestEpisode - 4);
  for (let i = startEp; i <= latestEpisode; i++) {
    const epPath = join(outputDir, `제${i}화.md`);
    if (!existsSync(epPath)) continue;
    const content = readFileSync(epPath, 'utf-8');
    let body = content;
    const cutIdx = body.indexOf('## [🎬 영상화 메모]');
    if (cutIdx > 0) body = body.substring(0, cutIdx);

    const lines = body.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('>') || line.startsWith('|')) continue;
      // 짧고 감각적인 문장 (15~50자)
      if (line.length >= 15 && line.length <= 50 && sensoryWords.some((w: string) => line.includes(w))) {
        samples.push(line);
      }
      // 매우 짧고 임팩트 있는 문장 (5~15자)
      if (line.length >= 5 && line.length <= 15 && line.endsWith('.')) {
        samples.push(line);
      }
    }
  }

  if (samples.length === 0) return '';
  const unique = [...new Set(samples)];
  const selected = unique.sort(() => Math.random() - 0.5).slice(0, 15);

  return `## 🎯 스타일 레퍼런스 — 이 소설의 기존 명문장 (이 수준이 최소 기준)
${selected.map((s, i) => `${i + 1}. ${s}`).join('\n')}
★ 공통점: 짧다, 감각적이다, 행동이 보인다. 이것이 기준입니다. 이보다 더 좋게 쓰세요.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ★ [품질 엔진] 캐릭터 보이스 앵커링 — 실제 대사 자동 추출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function extractCharacterVoices(outputDir: string, latestEpisode: number): string {
  const voices: Record<string, string[]> = { '위소운': [], '천마': [], '이준혁': [] };

  const startEp = Math.max(1, latestEpisode - 2);
  for (let i = startEp; i <= latestEpisode; i++) {
    const epPath = join(outputDir, `제${i}화.md`);
    if (!existsSync(epPath)) continue;
    const content = readFileSync(epPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // () 안의 독백 추출
      const innerMatches = trimmed.match(/\(([^)]{3,60})\)/g);
      if (innerMatches) {
        for (const match of innerMatches) {
          const inner = match.slice(1, -1);
          // 천마: 반말 (짧고, ~다./~어./~지./~군.)
          if (inner.match(/(다\.|어\.|지\.|군\.|냐\?|닥쳐|시끄러|흥|쯧)/) && !inner.match(/(습니다|세요|이죠)/)) {
            if (voices['천마'].length < 5) voices['천마'].push(match);
          }
          // 이준혁: 존댓말
          else if (inner.match(/(습니다|입니다|이죠|세요|합니다|겠습니다)/)) {
            if (voices['이준혁'].length < 5) voices['이준혁'].push(match);
          }
        }
      }
      // 일반 대사 — 위소운
      const dlgMatch = trimmed.match(/"([^"]{5,80})"/);
      if (dlgMatch && !trimmed.includes('(') && dlgMatch[1].match(/(다\.|가\.|지\.|군\.|네\.|야\.)/)) {
        if (voices['위소운'].length < 5) voices['위소운'].push(`"${dlgMatch[1]}"`);
      }
    }
  }

  const sections: string[] = [];
  if (voices['위소운'].length > 0)
    sections.push(`### 위소운 (평어 — 따뜻하고 단단함)\n실제 대사: ${voices['위소운'].slice(0, 3).join(' / ')}`);
  if (voices['천마'].length > 0)
    sections.push(`### 천마 (반말 — 건방지고 짧게, "시" 존경 접미사 절대 금지)\n실제 독백: ${voices['천마'].slice(0, 3).join(' / ')}`);
  if (voices['이준혁'].length > 0)
    sections.push(`### 이준혁 (존댓말 — 냉철한 분석가)\n실제 독백: ${voices['이준혁'].slice(0, 3).join(' / ')}`);

  if (sections.length === 0) return '';
  return `## 🎭 캐릭터 보이스 샘플 — 최근 화의 실제 대사 (이 말투를 100% 유지)
${sections.join('\n\n')}
★ 독백 = 소괄호 (). 간판/이름 = 작은따옴표 ''. 변형 금지.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ★ [설정 자동 주입] 인명록·바이블에서 캐릭터/장소 설정 자동 추출
//    설계도에 "안세진" 등장 → 인명록에서 안세진 카드 자동 추출 → 프롬프트에 포함
//    설계도에 "안씨표국" 등장 → 바이블에서 해당 섹션 자동 추출 → 프롬프트에 포함
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function extractLoreReferences(blueprint: string, structureDesign: string, episodeNumber: number): string {
  const novelDir = join(process.cwd(), 'novels', 'murim_mna');
  const charFilePath = join(novelDir, '캐릭터_인명록.md');
  const bibleFilePath = join(novelDir, 'master_story_bible.md');

  // 설계도+구조설계 전체 텍스트에서 이름/키워드 검색
  const searchText = `${blueprint}\n${structureDesign}`;
  const sections: string[] = [];

  // ── 1. 캐릭터 인명록에서 등장 캐릭터 카드 추출 ──
  if (existsSync(charFilePath)) {
    const charContent = readFileSync(charFilePath, 'utf-8');
    const charCards = parseCharacterCards(charContent);

    // 3인격(위소운/천마/이준혁)은 이미 프롬프트에 말투 규칙이 있으므로 스킵
    const skipNames = new Set(['위소운', '천마', '이준혁']);
    let charCount = 0;

    for (const [name, card] of charCards) {
      if (skipNames.has(name)) continue;
      if (charCount >= 8) break; // 토큰 절약: 최대 8명
      if (name.length >= 2 && searchText.includes(name)) {
        // 카드가 너무 길면 1500자로 자름 (토큰 절약)
        const trimmed = card.length > 1500
          ? card.substring(0, 1500) + '\n...(핵심 정보는 위에 있음)'
          : card;
        sections.push(`### 📋 캐릭터: ${name}\n${trimmed}`);
        charCount++;
      }
    }

    if (charCount > 0) {
      console.log(`📋 인명록에서 ${charCount}명 캐릭터 카드 자동 추출`);
    }
  }

  // ── 2. 마스터 바이블에서 장소/세력 설정 추출 ──
  if (existsSync(bibleFilePath)) {
    const bibleContent = readFileSync(bibleFilePath, 'utf-8');

    // 키워드 → 바이블 섹션 제목 매핑 (키워드가 blueprint에 있으면 해당 섹션 추출)
    const locationMap: [string[], string][] = [
      [['안씨표국', '천화표국', '안세진', '안효림', '귀원검법'], '안씨표국(安氏鏢局)'],
      [['천화련'], '천화련(天火聯)'],
      [['개봉상회', '진무관', '만리표국'], '개봉(開封) 기존 세력'],
      [['무림대회', '비무대'], '무림대회 설정'],
      [['소연화', '당찬', '천풍검문'], '위소운-소연화 관계 발전'],
      [['청원심법'], '청원심법(淸源心法)'],
    ];

    const addedBibleSections = new Set<string>();
    for (const [keywords, sectionTitle] of locationMap) {
      if (addedBibleSections.has(sectionTitle)) continue;
      if (keywords.some(kw => searchText.includes(kw))) {
        const section = extractBibleSection(bibleContent, sectionTitle);
        if (section) {
          // 섹션이 너무 길면 2000자로 자름 (토큰 절약)
          const trimmed = section.length > 2000
            ? section.substring(0, 2000) + '\n...(이하 생략)'
            : section;
          sections.push(`### 📍 세계관: ${sectionTitle}\n${trimmed}`);
          addedBibleSections.add(sectionTitle);
        }
      }
    }

    // ── 3. 바이블 화수 설계 중복 제거 ──
    // ⚠️ 이 정보는 이미 auto-blueprint 설계도에 포함되어 있음
    // 중복 주입하면 AI가 과도하게 강조된 방향으로 치우칠 수 있으므로 비활성화
    // (설계도의 "스토리 로드맵" 섹션이 이미 바이블 화수 정보를 포함)

    if (addedBibleSections.size > 0) {
      console.log(`📍 바이블에서 ${addedBibleSections.size}개 세계관 설정 자동 추출`);
    }
  }

  if (sections.length === 0) return '';

  return `## ⚠️ 설정 카드 — 이 내용을 100% 준수하세요 (임의 창작 절대 금지)

> 아래는 캐릭터 인명록과 마스터 바이블에서 자동 추출한 **공식 설정**입니다.
> **이 설정에 없는 내용을 AI가 임의로 만들면 안 됩니다.**
> - 캐릭터의 성격·말투·외모·무공·관계 → 아래 카드 100% 준수
> - 장소의 상태·규모·분위기 → 아래 설정 그대로 묘사
> - 설정에 없는 캐릭터 행동·대사·장소 묘사 = EP(Error Point) 위반

${sections.join('\n\n---\n\n')}

★ 핵심: 위 설정 카드에 기록된 대로만 쓰세요. 설정에 없는 건 "상상"하지 마세요.
★ 캐릭터 대사는 위 카드의 말투·대표 대사 스타일을 반드시 따르세요.`;
}

// ── 인명록 파싱: 캐릭터 이름 → 카드 내용 매핑 ──
function parseCharacterCards(content: string): Map<string, string> {
  const cards = new Map<string, string>();
  const lines = content.split('\n');

  // 헤더 위치 목록: (줄번호, 캐릭터 이름, 헤더 레벨)
  type Header = { lineIdx: number; name: string; level: number };
  const headers: Header[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 패턴 1: "#### 이름(한자)" 또는 "#### 번호. 이름(한자)"
    let m = line.match(/^(#{3,4})\s+(?:\d+\.\s*)?([가-힣]{2,4})\s*[\(（]/);
    if (m) {
      headers.push({ lineIdx: i, name: m[2], level: m[1].length });
      continue;
    }

    // 패턴 2: "### 번호. 이름 (한자) 설명" (상세 30가지 카드)
    m = line.match(/^(#{3,4})\s+\d+\.\s*([가-힣]{2,4})\s/);
    if (m) {
      headers.push({ lineIdx: i, name: m[2], level: m[1].length });
      continue;
    }

    // ## 헤더: 섹션 경계 역할 (캐릭터 카드 영역 종료)
    if (line.match(/^#{1,2}\s/)) {
      const lvl = (line.match(/^(#+)/) || ['', '##'])[1].length;
      headers.push({ lineIdx: i, name: '', level: lvl });
    }
  }

  // 각 캐릭터 헤더 → 다음 같은/상위 레벨 헤더까지 추출
  for (let h = 0; h < headers.length; h++) {
    const { lineIdx, name, level } = headers[h];
    if (!name) continue; // 경계 헤더(## 등)는 스킵

    // 다음 같은/상위 레벨 헤더 위치 = 섹션 끝
    let endLine = lines.length;
    for (let n = h + 1; n < headers.length; n++) {
      if (headers[n].level <= level) {
        endLine = headers[n].lineIdx;
        break;
      }
    }

    const section = lines.slice(lineIdx, endLine).join('\n').trim();
    if (section && !cards.has(name)) {
      cards.set(name, section);
    }
  }

  return cards;
}

// ── 바이블 파싱: 키워드로 섹션 추출 ──
function extractBibleSection(content: string, keyword: string): string {
  const lines = content.split('\n');
  let inSection = false;
  let sectionLevel = 0;
  const sectionLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{2,4})\s+(.*)/);

    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];

      // 이미 섹션 안에 있는데 같거나 상위 레벨 헤더 → 섹션 종료
      if (inSection && level <= sectionLevel) {
        break;
      }

      // 키워드가 포함된 헤더 발견 → 섹션 시작
      if (!inSection && title.includes(keyword)) {
        inSection = true;
        sectionLevel = level;
        sectionLines.push(line);
        continue;
      }
    }

    if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n').trim();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ★ [품질 엔진] 다이나믹 온도 — 장면 감정별 temperature 자동 조절
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getSceneTemperature(emotion: string): number {
  const lower = emotion.toLowerCase();
  // 전투/액션: 높은 창의성 → 예상 못 할 묘사
  if (/전투|액션|전투열기|무공|검|칼/.test(lower)) return 0.95;
  // 코미디/유머: 높은 창의성
  if (/코미디|유머|따뜻/.test(lower)) return 0.9;
  // 긴장/충격/공포: 중간 — 제어된 서스펜스
  if (/긴장|충격|공포|비장|위기/.test(lower)) return 0.85;
  // 감동/슬픔: 중간 — 감정의 정밀 제어
  if (/감동|슬픔|여운|결의/.test(lower)) return 0.85;
  // 평온/대화/설렘: 낮은 — 캐릭터 목소리 일관성 우선
  if (/평온|대화|일상|설렘|기대/.test(lower)) return 0.8;
  return 0.85;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ★ [품질 엔진] AI 에디터 — 문단별 평가 + 약한 부분 재생성
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function aiEditor(
  generatedText: string,
  geminiKey: string,
  callAIFn: (prompt: string, tokens: number) => Promise<string>
): Promise<{ text: string; improved: number; totalParagraphs: number }> {
  const paragraphs = generatedText.split(/\n\n+/).filter((p: string) => p.trim().length > 20);
  if (paragraphs.length < 3) {
    return { text: generatedText, improved: 0, totalParagraphs: paragraphs.length };
  }

  // Phase 1: Flash 모델로 문단별 점수 매기기 (저렴)
  // ★ v2: 기준 완화 — 3점(보통)은 OK. 2점 이하(진짜 문제)만 교정
  const scorePrompt = `당신은 한국 무협 웹소설 편집장입니다. 각 문단을 5점 만점으로 평가하세요.

[평가 기준]
- 5점: 명문. 감각적, 장면이 눈앞에 그려짐
- 4점: 좋음. 읽는 데 문제 없음
- 3점: 보통. 기능적이지만 괜찮음 (교정 불필요)
- 2점: 약함. 현대어 혼입, 말투 오류, 또는 분위기 파괴
- 1점: 나쁨. 심각한 오류 (세계관 파괴, EP 위반)

[텍스트]
${paragraphs.map((p, i) => `[P${i + 1}]\n${p}`).join('\n\n')}

[출력 형식] — 반드시 이 형식으로만
P1|점수|한줄 피드백 (뭐가 문제이고 어떻게 고칠지)
P2|점수|한줄 피드백
...`;

  const flashUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const scoreRes = await fetch(flashUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: scorePrompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
    }),
  });

  if (!scoreRes.ok) {
    console.warn('⚠️ AI 에디터 점수 매기기 실패 — 원본 유지');
    return { text: generatedText, improved: 0, totalParagraphs: paragraphs.length };
  }

  const scoreData = await scoreRes.json();
  const scoreRaw = Array.isArray(scoreData?.candidates?.[0]?.content?.parts)
    ? scoreData.candidates[0].content.parts.map((p: any) => String(p?.text || '')).join('')
    : '';

  // ★ v2: 2점 이하만 교정 (3점은 "보통"이므로 OK — 흐름 보존 우선)
  const weakParagraphs: { index: number; score: number; feedback: string }[] = [];
  for (const sl of scoreRaw.split('\n').filter((l: string) => l.trim().match(/^P\d+\|/))) {
    const parts = sl.split('|');
    const pNum = parseInt(parts[0]?.replace('P', '')) - 1;
    const score = parseInt(parts[1]?.trim());
    const feedback = parts.slice(2).join('|').trim();
    if (!isNaN(pNum) && !isNaN(score) && score <= 2 && pNum < paragraphs.length) {
      weakParagraphs.push({ index: pNum, score, feedback });
    }
  }

  if (weakParagraphs.length === 0) {
    console.log('✅ AI 에디터: 모든 문단 4점 이상 — 수정 불필요');
    return { text: generatedText, improved: 0, totalParagraphs: paragraphs.length };
  }

  // ★ v2: 최대 5개만 교정 (흐름 보존 우선, 진짜 문제만 고침)
  const MAX_IMPROVE = 5;
  weakParagraphs.sort((a, b) => a.score - b.score); // 낮은 점수 우선
  const toImprove = weakParagraphs.slice(0, MAX_IMPROVE);
  console.log(`🔧 AI 에디터: ${toImprove.length}/${paragraphs.length}개 문단 개선 시작 (전체 약한 문단: ${weakParagraphs.length}개, 최대 ${MAX_IMPROVE}개 제한)`);

  // Phase 2: 약한 문단만 재생성 (원래 AI 모델 사용)
  let improved = 0;
  for (const weak of toImprove) {
    const prev = weak.index > 0 ? paragraphs[weak.index - 1] : '';
    const next = weak.index < paragraphs.length - 1 ? paragraphs[weak.index + 1] : '';

    const rewritePrompt = `당신은 무협 웹소설 전문 작가입니다. 아래 문단을 개선하세요.

[문제점] ${weak.feedback}
[점수] ${weak.score}/5점 → 최소 4점 이상으로
${prev ? `\n[직전 문단]\n${prev}\n` : ''}
[개선 대상]
${paragraphs[weak.index]}
${next ? `\n[다음 문단]\n${next}\n` : ''}
[지시]
- 원래 내용·스토리·분량 100% 유지
- 문제점 해결: ${weak.feedback}
- 더 감각적·구체적·캐릭터 목소리 살리기
- 개선된 문단만 출력 (설명 없이)`;

    const rewritten = await callAIFn(rewritePrompt, 1500);
    if (rewritten && rewritten.length > paragraphs[weak.index].length * 0.5) {
      paragraphs[weak.index] = rewritten;
      improved++;
      console.log(`  ✅ P${weak.index + 1} 개선 (${weak.score}점→재생성, ${weak.feedback.slice(0, 30)}...)`);
    }
  }

  return { text: paragraphs.join('\n\n'), improved, totalParagraphs: paragraphs.length };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3-Level AI 모델 설정 (비용 관리의 핵심)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Level 1: 초안 = Gemini 3 Pro (1화당 ~$0.25, 규칙 준수율 높음)
// Level 2: 다듬기 = Claude Sonnet (가성비, 1화당 ~$0.80)
// Level 3: 최종 퇴고 = Claude Opus (최고 필력, 1화당 ~$2.00)
const AI_LEVELS: Record<number, {
  name: string;
  provider: 'gemini' | 'claude' | 'openai';
  model: string;
  priceInput: number;   // USD per 백만 토큰
  priceOutput: number;  // USD per 백만 토큰
}> = {
  1: { name: 'Lv.1 초안 (Gemini 3 Pro)',    provider: 'gemini', model: 'gemini-3-pro-preview',               priceInput: 2.00,  priceOutput: 12.00 },
  2: { name: 'Lv.2 다듬기 (Claude Sonnet 4.6)', provider: 'claude', model: 'claude-sonnet-4-6', priceInput: 3.00,  priceOutput: 15.00 },
  3: { name: 'Lv.3 최종 (Claude Opus)',     provider: 'claude', model: 'claude-3-opus-20240229',     priceInput: 15.00, priceOutput: 75.00 },
};

export async function POST(req: NextRequest) {
  try {
    const body: GenerateEpisodeRequest = await req.json();
    const {
      episodeNumber,
      episodeTitle,
      blueprint,
      structureDesign = '',     // ★ [파이프라인] 구조 설계 결과
      premiumMode = false,      // ★ [A/B 테스트] B모드 활성화 여부
      chunkMode = false,        // ★ 장면별 분할 생성 모드
      directorMode = false,     // ★ 감독판 모드
      section = 'full',
      aiLevel = 1,              // ★ 기본값: Level 1 (가장 저렴한 Gemini Flash)
      characters = [],
      previousEpisodeSummary = '',
      worldContext = '',
      memoryContext,
    } = body;

    // ── 유효성 검사 ──
    if (!blueprint || blueprint.length < 100) {
      return NextResponse.json({
        success: false,
        message: 'Step 4의 최종 설계도(blueprint)가 필요합니다. 최소 100자 이상이어야 합니다.',
      }, { status: 400 });
    }

    // ── AI API Key 확인 ──
    const openaiKey = process.env.OPENAI_API_KEY;
    const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!openaiKey && !claudeKey && !geminiKey) {
      return NextResponse.json({
        success: false,
        message: 'AI API Key가 설정되지 않았습니다. (.env.local에 OPENAI_API_KEY, CLAUDE_API_KEY, 또는 GEMINI_API_KEY를 추가하세요)',
      }, { status: 500 });
    }

    // ── Supabase에서 캐릭터 정보 보강 ──
    let enrichedCharacters = characters;
    if (isSupabaseConfigured && characters.length > 0) {
      try {
        const charNames = characters.map((c: any) => c.name || c).filter(Boolean);
        const { data } = await supabase
          .from('characters')
          .select('name, title, faction, speech_style, speech_examples, catchphrase, personality, martial_rank, weapon, fighting_style')
          .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .in('name', charNames)
          .limit(20);

        if (data && data.length > 0) {
          enrichedCharacters = data;
          console.log(`✅ Supabase에서 ${data.length}명 캐릭터 정보 로드`);
        }
      } catch (e) {
        console.warn('⚠️ 캐릭터 정보 보강 실패 (무시):', e);
      }
    }

    // ═══════════════════════════════════════════════════
    // ★ [v2] 맥락 로딩: "전편 원문" → "마스터 요약 + 직전 1화만"
    // ─────────────────────────────────────────────────
    // 이전: 1~13화 전문(수만 자)을 AI에게 전달 → 관련 없는 과거 디테일을 끌어옴
    // 변경: 소설_진행_마스터.md(정리된 요약) + 직전 1화 전문(문체 연속성)만 전달
    // ═══════════════════════════════════════════════════
    let allPreviousEpisodes = '';
    let previousEpisodeEnding = '';
    let masterContext = '';  // ★ 마스터 파일 = 정리된 맥락 요약

    // 1단계: 소설_진행_마스터.md 전체를 맥락으로 로딩 (§1~§8)
    try {
      const masterFilePath = join(process.cwd(), 'novels', 'murim_mna', '소설_진행_마스터.md');
      if (existsSync(masterFilePath)) {
        masterContext = readFileSync(masterFilePath, 'utf-8');
        console.log(`📋 소설_진행_마스터.md 로딩 완료 (${masterContext.length.toLocaleString()}자) — 전편 요약 맥락`);
      }
    } catch (e) {
      console.warn('⚠️ 소설_진행_마스터.md 로딩 실패 (무시):', e);
    }

    // ★ [v3] 기억 카드 전체 로딩 — 1화부터 직전 화까지의 압축된 스토리 기억
    // 확정된 화가 늘어날수록 자동으로 범위 확장 (하드코딩 없음)
    let memoryCardsContext = '';
    if (isSupabaseConfigured && episodeNumber > 1) {
      try {
        const { data: allCards } = await supabase
          .from('memory_cards')
          .select('episode_number, episode_title, when_summary, where_summary, who_summary, what_summary, why_summary, how_summary, asset_change, martial_change, org_change, relationship_change, location_change, health_change, foreshadow_planted, foreshadow_resolved, dominant_personality, personality_conflict, key_dialogue, cliffhanger, next_caution')
          .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .lt('episode_number', episodeNumber)
          .order('episode_number', { ascending: true });

        if (allCards && allCards.length > 0) {
          const cardLines = allCards.map((c: any) => {
            const parts = [`### 제${c.episode_number}화: ${c.episode_title || ''}`];
            if (c.what_summary) parts.push(`- 핵심사건: ${c.what_summary}`);
            if (c.where_summary) parts.push(`- 장소: ${c.where_summary}`);
            if (c.who_summary) parts.push(`- 등장인물: ${c.who_summary}`);
            if (c.why_summary) parts.push(`- 원인/동기: ${c.why_summary}`);
            if (c.how_summary) parts.push(`- 전개: ${c.how_summary}`);
            if (c.relationship_change) parts.push(`- 관계변화: ${c.relationship_change}`);
            if (c.asset_change) parts.push(`- 자산변동: ${c.asset_change}`);
            if (c.martial_change) parts.push(`- 무공변동: ${c.martial_change}`);
            if (c.foreshadow_planted) parts.push(`- 복선투하: ${c.foreshadow_planted}`);
            if (c.foreshadow_resolved) parts.push(`- 복선회수: ${c.foreshadow_resolved}`);
            if (c.dominant_personality) parts.push(`- 주도인격: ${c.dominant_personality}`);
            if (c.key_dialogue) parts.push(`- 핵심대사: "${c.key_dialogue}"`);
            if (c.cliffhanger) parts.push(`- 절단신공: ${c.cliffhanger}`);
            return parts.join('\n');
          });
          memoryCardsContext = cardLines.join('\n\n');
          console.log(`🧠 기억 카드 ${allCards.length}화분 로딩 완료 (${memoryCardsContext.length.toLocaleString()}자) — 1~${allCards[allCards.length - 1].episode_number}화`);
        }
      } catch (e) {
        console.warn('⚠️ 기억 카드 로딩 실패 (무시):', e);
      }
    }

    // 2단계: 직전 1화만 전문 로딩 (문체 연속성 + 장면 이어쓰기)
    if (episodeNumber > 1) {
      try {
        const outputDir = join(process.cwd(), 'novels', 'murim_mna', 'output');
        const prevEpPath = join(outputDir, `제${episodeNumber - 1}화.md`);
        if (existsSync(prevEpPath)) {
          const prevContent = readFileSync(prevEpPath, 'utf-8');
          allPreviousEpisodes = `\n=== 제${episodeNumber - 1}화 (직전 화 전문 — 문체 참조용) ===\n${prevContent}`;
          console.log(`📖 직전 화 전문 로딩: 제${episodeNumber - 1}화 (${prevContent.length.toLocaleString()}자)`);

          // 직전 화 엔딩 장면 추출
          previousEpisodeEnding = extractEpisodeEnding(prevContent, episodeNumber - 1);
          if (previousEpisodeEnding) {
            console.log(`📎 제${episodeNumber - 1}화 엔딩 추출 완료 (${previousEpisodeEnding.length}자)`);
          }
        }
      } catch (e) {
        console.warn('⚠️ 직전 화 로딩 실패 (무시):', e);
      }
    }

    // ═══════════════════════════════════════════════════
    // ★ [품질 엔진] 스타일 레퍼런스 + 캐릭터 보이스 추출
    // ═══════════════════════════════════════════════════
    const qualityOutputDir = join(process.cwd(), 'novels', 'murim_mna', 'output');
    const styleReference = extractStyleReference(qualityOutputDir, episodeNumber - 1);
    const characterVoices = extractCharacterVoices(qualityOutputDir, episodeNumber - 1);
    if (styleReference) console.log(`🎯 스타일 레퍼런스 로딩 완료 (최근 5화에서 명문장 추출)`);
    if (characterVoices) console.log(`🎭 캐릭터 보이스 앵커링 완료 (최근 3화에서 대사 추출)`);

    // ═══════════════════════════════════════════════════
    // ★ [설정 자동 주입] 인명록·바이블에서 캐릭터/장소 설정 자동 추출
    // ═══════════════════════════════════════════════════
    let loreReferences = '';
    try {
      loreReferences = extractLoreReferences(blueprint, structureDesign, episodeNumber);
      if (loreReferences) {
        console.log(`📚 설정 자동 주입 완료 (${loreReferences.length}자)`);
      }
    } catch (e: any) {
      console.warn('⚠️ 설정 자동 주입 실패 (무시):', e.message);
    }

    // ── 프롬프트 구성 (6단계 아키텍처) ──
    const prompt = buildEpisodePrompt({
      episodeNumber,
      episodeTitle,
      blueprint,
      structureDesign,            // ★ [파이프라인] 구조 설계 전달
      previousEpisodeEnding,      // ★ 이전 화 엔딩 자동 주입
      section,
      characters: enrichedCharacters,
      previousEpisodeSummary: allPreviousEpisodes || previousEpisodeSummary,
      worldContext,
      memoryContext,
      masterContext,              // ★ [v2] 소설_진행_마스터.md 전체 = 정리된 맥락 요약
      memoryCardsContext,         // ★ [v3] 전체 기억 카드 = 1화부터의 압축 스토리
      styleReference,             // ★ [품질 엔진] 명문장 레퍼런스
      characterVoices,            // ★ [품질 엔진] 캐릭터 대사 앵커링
      loreReferences,             // ★ [설정 자동 주입] 인명록·바이블 자동 추출 설정
    });

    // ── AI Level 결정 (★ 비용 관리의 핵심) ──
    const level = Math.min(3, Math.max(1, aiLevel)) as 1 | 2 | 3;
    const levelConfig = AI_LEVELS[level];
    const modeLabel = directorMode ? 'D-감독판' : chunkMode ? 'C-분할생성' : premiumMode ? 'B-프리미엄' : 'A-표준';
    console.log(`📝 제${episodeNumber}화 "${episodeTitle}" 생성 시작 (${section}, ${levelConfig.name}, ${modeLabel})`);

    // ── AI 호출 헬퍼 함수 (★ 다이나믹 온도 지원) ──
    async function callAI(aiPrompt: string, tokens: number, temp: number = 0.85): Promise<string> {
      if (levelConfig.provider === 'gemini' && geminiKey) {
        return await callGemini(geminiKey!, aiPrompt, tokens, levelConfig.model, temp);
      } else if (levelConfig.provider === 'claude' && claudeKey) {
        return await callClaude(claudeKey!, aiPrompt, tokens, levelConfig.model, temp);
      } else if (levelConfig.provider === 'openai' && openaiKey) {
        return await callOpenAI(openaiKey!, aiPrompt, tokens);
      } else if (geminiKey) {
        return await callGemini(geminiKey!, aiPrompt, tokens, AI_LEVELS[1].model, temp);
      } else if (claudeKey) {
        return await callClaude(claudeKey!, aiPrompt, tokens);
      } else if (openaiKey) {
        return await callOpenAI(openaiKey!, aiPrompt, tokens);
      }
      return '';
    }

    let generatedText = '';
    let usedModel = levelConfig.model;
    const maxTokens = section === 'full' ? 12000 : 3000;

    // ═══════════════════════════════════════════════════
    // ★ [D-감독판] 비트 단위 초정밀 생성 (directorMode)
    // ═══════════════════════════════════════════════════
    if (directorMode && section === 'full') {
      console.log(`🎬 감독판 모드: 비트 단위 초정밀 생성`);

      // Phase 1: 비트 설계 — AI가 설계도를 8~12비트로 분할
      let beatDesignContext = `[설계도]\n${blueprint}`;
      if (structureDesign) {
        beatDesignContext += `\n\n[구조 설계]\n${structureDesign}`;
      }

      const beatDesignPrompt = `당신은 소설 연출 감독입니다. 아래 에피소드 설계도를 8~12개의 '비트(장면 단위)'로 분할하세요.

${beatDesignContext}

[비트 분할 규칙]
- 각 비트 = 하나의 장면 또는 하나의 감정 단위
- 장면 전환(***) 단위로 자연스럽게 분할
- 각 비트는 400~600자 분량
- 전체 합계: 4500~5500자 (최대 5500자 절대 초과 금지)
- 마지막 비트는 절단신공(다음 화 궁금증 유발)으로 끝낼 것

[출력 형식] — 반드시 아래 형식으로만 출력
BEAT|번호|장면명|목표글자수|감정목표|핵심이벤트|마지막문장방향

예시:
BEAT|1|아침 기상|600|유머, 따뜻함|위소운 근육통, 3인격 투닥거림|노크 소리로 전환
BEAT|2|소연화 전복죽|500|설렘, 감사|죽을 만들어 가져옴, 따뜻한 대화|밖이 시끄럽다는 말로 호기심

비트 목록만 출력하세요. 다른 설명은 쓰지 마세요.`;

      const beatPlanRaw = await callAI(beatDesignPrompt, 2000);

      // 비트 파싱
      const beats: { num: number; scene: string; targetChars: number; emotion: string; events: string; ending: string }[] = [];
      const beatLines = beatPlanRaw.split('\n').filter((l: string) => l.trim().startsWith('BEAT|'));
      for (const bLine of beatLines) {
        const parts = bLine.split('|').map((s: string) => s.trim());
        if (parts.length >= 7) {
          beats.push({
            num: parseInt(parts[1]) || beats.length + 1,
            scene: parts[2],
            targetChars: parseInt(parts[3]) || 600,
            emotion: parts[4],
            events: parts[5],
            ending: parts[6],
          });
        }
      }

      if (beats.length >= 3) {
        console.log(`📋 비트 설계 완료: ${beats.length}개 비트`);
        beats.forEach((b: { num: number; scene: string; targetChars: number; emotion: string }) => console.log(`  ${b.num}. ${b.scene} (${b.targetChars}자, ${b.emotion})`));

        // Phase 2: 비트별 생성 — 각 비트에 '연출 지시'를 넣어 초정밀 생성
        let accumulated = '';
        let lastBeatText = '';

        for (let bi = 0; bi < beats.length; bi++) {
          const beat = beats[bi];
          console.log(`  🎬 비트 ${beat.num}/${beats.length}: ${beat.scene} 생성 중...`);

          // 각 비트 프롬프트: 기본 규칙 + 비트별 연출 지시 + 직전 비트 연결
          const beatPrompt = `${prompt}

═══════════════════════════════════════
## ★ 감독판 — 비트 ${beat.num}/${beats.length}: ${beat.scene}
═══════════════════════════════════════
전체 에피소드를 ${beats.length}개 비트로 나누어 생성 중입니다.
지금은 **비트 ${beat.num}**만 작성하세요.

### 연출 지시
- **장면**: ${beat.scene}
- **목표 분량**: 약 ${beat.targetChars}자 (${beat.targetChars - 100}~${beat.targetChars + 100}자)
- **감정 목표**: ${beat.emotion}
- **핵심 이벤트**: ${beat.events}
- **마지막 문장 방향**: ${beat.ending}
${lastBeatText ? `
### 직전 비트 (이어서 작성 — 반복 금지)
---
${lastBeatText.slice(-800)}
---
위 내용 직후부터 자연스럽게 이어서 작성하세요.` : '에피소드의 처음부터 시작하세요.'}

⚠️ 중요:
- 이 비트(${beat.scene})에 해당하는 내용만 출력하세요
- 목표 분량(약 ${beat.targetChars}자)에 맞추세요
- 직전 비트 내용을 반복하지 마세요
- 감정(${beat.emotion})에 집중하세요`;

          // 비트당 토큰: 글자수÷2 + 여유분 500, 최대 2000
          const beatTokens = Math.min(Math.ceil(beat.targetChars / 2) + 500, 2000);
          // ★ 다이나믹 온도: 비트 감정에 따라 AI 창의성 자동 조절
          const beatTemp = getSceneTemperature(beat.emotion);
          const beatText = await callAI(beatPrompt, beatTokens, beatTemp);

          if (beatText) {
            accumulated += (accumulated ? '\n\n' : '') + beatText;
            lastBeatText = beatText;
            console.log(`  ✅ 비트 ${beat.num} 완료 (${beatText.length}자)`);
          } else {
            console.warn(`  ⚠️ 비트 ${beat.num} 생성 실패`);
          }
        }

        generatedText = accumulated;
        usedModel += ` (감독판 ${beats.length}비트)`;
        console.log(`✅ 감독판 생성 완료 — 총 ${generatedText.length}자 (${beats.length}비트)`);
      } else {
        console.warn(`⚠️ 비트 파싱 부족 (${beats.length}개) → 분할 생성으로 폴백`);
      }
    }

    // ═══════════════════════════════════════════════════
    // ★ [C-분할생성] 3단계 장면별 분할 생성 (chunkMode 또는 감독판 폴백)
    // ═══════════════════════════════════════════════════
    if (!generatedText && (chunkMode || directorMode) && section === 'full') {
      console.log(`🔀 분할 생성 모드: 3단계로 나눠서 생성`);
      const chunks: { name: string; acts: string; ratio: string }[] = [
        { name: '1단계: 도입+전개', acts: '제1막(도입) + 제2막(전개)', ratio: '전체의 40%, 약 1800~2200자' },
        { name: '2단계: 위기+절정', acts: '제3막(위기) + 제4막(절정)', ratio: '전체의 45%, 약 2000~2500자' },
        { name: '3단계: 마무리',    acts: '제5막(마무리+절단신공)',     ratio: '전체의 15%, 약 700~800자' },
      ];

      let accumulated = '';
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        console.log(`  📝 ${chunk.name} 생성 중...`);

        // 각 단계별 프롬프트: 원본 설계도 + 이전 단계 결과 + 이번 단계 지시
        const chunkPrompt = `${prompt}

═══════════════════════════════════════
## ★ 분할 생성 지시 — ${chunk.name}
═══════════════════════════════════════
이 요청은 전체 에피소드를 3단계로 나누어 생성하는 과정입니다.

**이번 단계**: ${chunk.acts}만 작성하세요.
**분량**: ${chunk.ratio}
${accumulated ? `
**이전 단계에서 작성된 내용** (이어서 작성하세요, 아래 내용을 반복하지 마세요):
---
${accumulated}
---
위 내용 직후부터 이어서 ${chunk.acts}를 작성하세요.` : '에피소드의 처음부터 시작하세요.'}

⚠️ 중요:
- ${chunk.acts}에 해당하는 부분만 출력
- 이전 단계 내용을 반복하지 마세요
- 자연스럽게 이어지도록 문맥을 유지하세요`;

        const chunkTokens = ci === 2 ? 3000 : 5000;  // 마무리는 짧으니 토큰 절약
        const chunkText = await callAI(chunkPrompt, chunkTokens);

        if (chunkText) {
          accumulated += (accumulated ? '\n\n' : '') + chunkText;
          console.log(`  ✅ ${chunk.name} 완료 (${chunkText.length}자)`);
        } else {
          console.warn(`  ⚠️ ${chunk.name} 생성 실패`);
        }
      }

      generatedText = accumulated;
      usedModel += ' (3단계 분할)';
      console.log(`✅ 분할 생성 완료 — 총 ${generatedText.length}자`);

    }

    // ═══════════════════════════════════════════════════
    // 기본 모드: 한번에 생성 (또는 상위 모드 폴백)
    // ═══════════════════════════════════════════════════
    if (!generatedText) {
      generatedText = await callAI(prompt, maxTokens);

      if (!usedModel.includes('폴백') && !generatedText && geminiKey) {
        generatedText = await callGemini(geminiKey, prompt, maxTokens, AI_LEVELS[1].model);
        usedModel = AI_LEVELS[1].model + ' (폴백)';
      }
    }

    if (!generatedText) {
      throw new Error('AI가 텍스트를 생성하지 못했습니다.');
    }

    // ═══════════════════════════════════════════════════
    // ★ [A/B 테스트] B모드: 2-pass 퇴고 (Sonnet으로 다듬기)
    // ═══════════════════════════════════════════════════
    let pass2Applied = false;
    if (premiumMode && generatedText && claudeKey) {
      try {
        console.log(`✍️ [B모드] 2-pass 퇴고 시작 (Claude Sonnet)...`);
        const refinePrompt = `당신은 한국 무협 소설 전문 퇴고 편집자입니다.
아래 초안을 다음 기준으로 퇴고하세요:

[퇴고 기준]
1. 3인격 말투 일관성:
   - 이준혁: 존댓말 ("~습니다", "~이죠")
   - 천마: 반말, 건방지고 짧게. "시" 존경 접미사 절대 금지
   - 위소운: 평어, 따뜻하고 단단함
2. 독백은 반드시 소괄호 () 사용: (시끄러.) (마진이 안 맞습니다.)
3. 간판/이름은 작은따옴표 '' 사용: '무림객잔' '위소검'
4. 현대어 제거: 오케이, 팩트체크, 아메리카노 등
5. 몸 소유권: 몸은 위소운의 것, 천마·이준혁은 머릿속 목소리
6. 문장 리듬: "~했다" 3연속 금지, 문장 길이 변화
7. 무협 분위기: 과도한 설명 대신 행동과 감각 묘사 강화
8. 분량 유지: 원문과 동일한 분량 유지 (줄이지 마세요)

[초안]
${generatedText}

[지시]
위 기준으로 퇴고한 완성본을 출력하세요. 원문의 스토리와 구성은 100% 유지하고, 문장과 표현만 다듬으세요.`;

        const refinedText = await callClaude(claudeKey, refinePrompt, maxTokens, 'claude-sonnet-4-6');
        if (refinedText && refinedText.length > generatedText.length * 0.7) {
          generatedText = refinedText;
          usedModel += ' → claude-sonnet-4.6(퇴고)';
          pass2Applied = true;
          console.log(`✅ [B모드] 2-pass 퇴고 완료 (${refinedText.length}자)`);
        }
      } catch (e: any) {
        console.warn(`⚠️ [B모드] 2-pass 퇴고 실패 (1-pass 결과 사용):`, e.message);
      }
    }

    // ── [legacy 이전] 품질 게이트: 금지 문구 검사 + 초반 안전장치 ──
    const mustAvoidPhrases = [
      '띠링', '조건이 충족되었습니다', '상태창',  // 상태창/시스템 UI
      '아메리카노', '오케이', '팩트 체크',        // 현대어
    ];
    const isEarlyEpisode = episodeNumber <= 30;
    if (isEarlyEpisode) {
      // ★ v2: "술"은 "술법/술수/기술"까지 잡으므로 음주 맥락만 정밀 필터링
      mustAvoidPhrases.push('술을 ', '술잔', '술상', '음주', '만취', '주점', '소흥주', '백주', '해장국');
    }

    const forbiddenHits = mustAvoidPhrases.filter((p: string) => generatedText.includes(p));
    // ★ v3: 최소 분량 기준 — 목표 5,000자 기준 절반 이하면 재생성
    const tooShort = generatedText.replace(/\s+/g, '').length < 3000 && section === 'full';

    // 금지 문구 발견 또는 너무 짧으면 1회 재생성
    let qualityGateRetried = false; // ★ 재생성 여부 추적 (AI 에디터 스킵 판단용)
    if (forbiddenHits.length > 0 || tooShort) {
      console.log(`⚠️ 품질 게이트 미통과 (금지: [${forbiddenHits.join(',')}], 짧음: ${tooShort}) → 재생성`);

      const retryPrompt = `${prompt}\n\n[재작성 지시]\n${forbiddenHits.length > 0 ? `아래 금지 문구가 포함되었습니다. 절대 쓰지 마세요:\n${forbiddenHits.map((s: string) => `- ${s}`).join('\n')}` : ''}\n${tooShort ? '분량이 심각하게 부족합니다. 최소 4,500자 이상 작성하세요. 목표는 5,000자입니다.' : ''}`;

      let retryText = '';
      // 재생성도 같은 Level 모델 사용 (비용 예측 가능)
      if (levelConfig.provider === 'gemini' && geminiKey) retryText = await callGemini(geminiKey, retryPrompt, maxTokens, levelConfig.model);
      else if (levelConfig.provider === 'claude' && claudeKey) retryText = await callClaude(claudeKey, retryPrompt, maxTokens, levelConfig.model);
      else if (geminiKey) retryText = await callGemini(geminiKey, retryPrompt, maxTokens, AI_LEVELS[1].model);
      else if (claudeKey) retryText = await callClaude(claudeKey, retryPrompt, maxTokens);
      else if (openaiKey) retryText = await callOpenAI(openaiKey, retryPrompt, maxTokens);

      if (retryText && retryText.length > generatedText.length * 0.5) {
        generatedText = retryText;
        qualityGateRetried = true; // ★ 재생성 완료 표시
        console.log(`✅ 재생성 완료 (${retryText.length}자)`);
      }
    }

    // ── [규칙 자동 교정] 코드 기반 후처리 (비용 0원) ──
    const postResult = postProcessText(generatedText, episodeNumber);
    generatedText = postResult.text;
    if (postResult.corrections.length > 0) {
      console.log(`🔧 자동 교정 ${postResult.corrections.length}건: ${postResult.corrections.join(', ')}`);
    }

    // ═══════════════════════════════════════════════════
    // ★ [품질 엔진] AI 에디터 — 약한 문단 자동 개선
    // ★ 품질 게이트에서 이미 재생성한 경우 스킵 (시간 절약)
    // ═══════════════════════════════════════════════════
    let editorStats = { improved: 0, totalParagraphs: 0 };
    if (qualityGateRetried) {
      console.log('⏭️ AI 에디터 스킵 — 품질 게이트 재생성으로 이미 깨끗한 텍스트');
    } else if (geminiKey && generatedText.length > 1000) {
      try {
        console.log('🔍 AI 에디터: 문단별 품질 평가 시작...');
        const editorResult = await aiEditor(generatedText, geminiKey, callAI);
        editorStats = { improved: editorResult.improved, totalParagraphs: editorResult.totalParagraphs };
        if (editorResult.improved > 0) {
          generatedText = editorResult.text;
          console.log(`✅ AI 에디터 완료: ${editorResult.improved}/${editorResult.totalParagraphs}개 문단 개선`);
        }
      } catch (e: any) {
        console.warn('⚠️ AI 에디터 실패 (원본 유지):', e.message);
      }
    }

    const finalForbidden = mustAvoidPhrases.filter((p: string) => generatedText.includes(p));
    console.log(`✅ 제${episodeNumber}화 생성 완료 (${generatedText.length}자, 금지문구: ${finalForbidden.length}건, 자동교정: ${postResult.corrections.length}건)`);

    // ── 비용 계산 (한국어 ~3자 = 1토큰 기준 추정) ──
    const estInputTokens = Math.ceil(prompt.length / 3);
    const estOutputTokens = Math.ceil(generatedText.length / 3);
    const estCostUSD = (
      (estInputTokens * levelConfig.priceInput) +
      (estOutputTokens * levelConfig.priceOutput)
    ) / 1_000_000;
    console.log(`💰 비용: ~$${estCostUSD.toFixed(4)} (${levelConfig.name}, 입력:${estInputTokens}tok 출력:${estOutputTokens}tok)`);

    // ── 응답 ──
    return NextResponse.json({
      success: true,
      episode: {
        number: episodeNumber,
        title: episodeTitle,
        section,
        content: generatedText,
        charCount: generatedText.replace(/\s/g, '').length,
        timestamp: new Date().toISOString(),
      },
      qualityGate: {
        forbiddenHits: finalForbidden,
        isEarlyEpisode,
        autoCorrections: postResult.corrections,  // 자동 교정 목록
      },
      // ── ★ 비용 정보 (대시보드에 표시) ──
      costInfo: {
        level,
        levelName: levelConfig.name,
        model: usedModel,
        estimatedInputTokens: estInputTokens,
        estimatedOutputTokens: estOutputTokens,
        estimatedCostUSD: Math.round(estCostUSD * 10000) / 10000,
        premiumMode,               // ★ A/B 모드 표시
        chunkMode,                 // ★ 분할 생성 모드 표시
        directorMode,              // ★ 감독판 모드 표시
        pass2Applied,              // ★ 2-pass 퇴고 적용 여부
        aiEditor: editorStats,     // ★ AI 에디터 결과 (개선 문단 수)
        priceGuide: {
          'A-표준 (Gemini Flash)': '~$0.37/화',
          'B-프리미엄 (2-pass)': '~$0.82/화',
        },
      },
    });

  } catch (error: any) {
    console.error('❌ 본문 생성 오류:', error);
    return NextResponse.json({
      success: false,
      message: '본문 생성 실패',
      error: error.message,
    }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 프롬프트 구성 함수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildEpisodePrompt(params: {
  episodeNumber: number;
  episodeTitle: string;
  blueprint: string;
  structureDesign?: string;
  previousEpisodeEnding?: string;
  section: string;
  characters: any[];
  previousEpisodeSummary: string;
  worldContext: string;
  memoryContext?: any;
  masterContext?: string;        // ★ [v2] 소설_진행_마스터.md 전체 = 정리된 맥락 요약
  memoryCardsContext?: string;   // ★ [v3] 전체 기억 카드 = 1화부터의 압축 스토리 기억
  styleReference?: string;       // ★ [품질 엔진] 명문장 레퍼런스
  characterVoices?: string;      // ★ [품질 엔진] 캐릭터 대사 앵커링
  loreReferences?: string;       // ★ [설정 자동 주입] 인명록·바이블 자동 추출 설정
}): string {
  const { episodeNumber, episodeTitle, blueprint, structureDesign, previousEpisodeEnding, section, characters, previousEpisodeSummary, worldContext, memoryContext, masterContext, memoryCardsContext, styleReference, characterVoices, loreReferences } = params;

  // ── 캐릭터 페르소나 정보 구성 ──
  let characterGuide = '';
  if (characters.length > 0) {
    characterGuide = characters.map((c: any) => {
      if (typeof c === 'string') return `- ${c}`;
      const lines = [`- **${c.name}**${c.title ? ` (${c.title})` : ''}`];
      if (c.faction) lines.push(`  소속: ${c.faction}`);
      if (c.martial_rank) lines.push(`  무공: ${c.martial_rank}`);
      if (c.weapon) lines.push(`  무기: ${c.weapon}`);
      if (c.speech_style) lines.push(`  말투: ${c.speech_style}`);
      if (c.speech_examples && c.speech_examples.length > 0) {
        lines.push(`  대사 예시: "${c.speech_examples[0]}"`);
      }
      if (c.catchphrase) lines.push(`  입버릇: "${c.catchphrase}"`);
      if (c.personality) lines.push(`  성격: ${c.personality}`);
      if (c.fighting_style) lines.push(`  전투 스타일: ${c.fighting_style}`);
      return lines.join('\n');
    }).join('\n\n');
  }

  // ── 막별 지시 ──
  let sectionDirective = '';
  if (section === 'full') {
    sectionDirective = `5막 전체를 하나의 완결된 이야기로 작성하세요.

### 5막 구조 (반드시 따르세요)
${Object.entries(SECTIONS).map(([key, val]) => `**${val.name}** (전체의 ${Math.round(val.ratio * 100)}%): ${val.description}`).join('\n')}

### 분량 (★ 엄수 — 초과 시 감점)
- 목표: 약 5,000자 (공백 제외 순수 글자수)
- 최대 5,500자. **5,500자를 초과하면 절대 안 됩니다.**
- 4,500~5,000자 사이가 이상적입니다
- 핵심만 간결하게. 군더더기 설명을 빼고, 행동과 대사로 보여주세요`;
  } else {
    const sec = SECTIONS[section as keyof typeof SECTIONS];
    if (sec) {
      sectionDirective = `**${sec.name}**만 작성하세요.
- 설명: ${sec.description}
- 전체 분량의 약 ${Math.round(sec.ratio * 100)}% (1,000~2,000자)`;
    }
  }

  // ── 메인 프롬프트 ──
  return `당신은 <화산귀환> 수준의 무협 웹소설을 집필하는 20년 경력의 전문 작가입니다.
모든 무협적 상황을 경영학적 지표(자산 가치, ROI, 감가상각)로 해석하는 독특한 시각을 가지고 있습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 제${episodeNumber}화: ${episodeTitle}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 작업 지시
아래 [최종 설계도]를 바탕으로 **실제 소설 본문**을 집필하세요.
${sectionDirective}

## 문체 규칙 (화산귀환 스타일)
1. **비장하고 간결한 문체**: 불필요한 수식어를 배제하고, 한 문장이 칼날처럼 날카롭게
2. **짧은 문장 위주**: 한 문장 30자 이내를 기본으로. 긴 문장은 강조 시에만
3. **행간의 미학**: 문단 사이에 여백을 두어 호흡을 조절
4. **화자 시점**: 3인칭 제한 시점 (주인공 중심)
5. **대사의 힘**: 대사는 짧고 강렬하게. 캐릭터의 성격이 한 마디에 드러나야 함
6. **액션 묘사**: 초식 이름, 궤적, 파공음, 충격파를 구체적으로. 슬로모션 기법 활용
7. **경영 메타포**: 전투를 M&A, 세력 확장을 시장 점유율, 무공 성장을 자산 증식으로 비유
8. **절단신공**: 마지막 문장에서 독자가 "다음 화"를 클릭하게 만드는 극적 끊김

## 금지 사항
- "~했다" 반복 금지 → 다양한 종결어미 사용
- 설명 과잉 금지 → Show, don't tell
- 현대 용어 직접 사용 금지 (경영 비유는 내면 독백에서만)
- 느낌표(!) 남발 금지 → 정말 충격적인 순간에만 사용
- 캐릭터 말투 혼용 금지 → 각 캐릭터의 고유 화법을 철저히 유지

${ANTI_PATTERNS}

## 출력 형식
- 제목: 제${episodeNumber}화. ${episodeTitle}
- 본문만 출력 (메타 설명, 주석, 태그 없이 순수 소설 텍스트만)
- 장면 전환: *** (별 세 개)
- 문단 구분: 빈 줄 한 칸
- ★ 본문 마지막에 반드시 아래 형식으로 [다음 화 예고]를 추가하세요:

---

> **[다음 화 예고]**
> *다음 화 핵심 장면 티저 1줄*
> *긴장감 있는 대사 또는 상황 1~2줄*
> *독자가 다음 화를 클릭하게 만드는 임팩트 있는 마무리 1줄*

---

## ★★★ 최종 설계도 — 이것이 이번 화의 최우선 지침입니다 ★★★
> 아래 설계도에 없는 내용을 AI가 임의로 추가하면 안 됩니다.
> 설계도에 명시된 캐릭터·사건·장소만 등장시키세요.

${blueprint}

${structureDesign ? `## ★ 구조 설계 (6하원칙 + 5막 + 핵심 장면 — 이 구조를 정확히 따르세요)
${structureDesign}

` : ''}${masterContext ? `## 📋 스토리 맥락 (소설_진행_마스터.md — 전체 스토리 상태 요약)
> 아래는 1화부터 현재까지의 스토리 상태를 정리한 공식 문서입니다.
> 현재 상태, 활성 떡밥, 관계, 확정 팩트 등 모든 맥락이 여기에 있습니다.
> ★ 이 문서에 없는 과거 사건을 AI가 임의로 끌어오지 마세요.

${masterContext}

` : ''}${memoryCardsContext ? `## 🧠 전체 스토리 기억 (확정된 모든 화의 핵심 요약)
> 아래는 1화부터 확정된 모든 화의 핵심 사건·복선·관계 변화 요약입니다.
> ★ 이 기억을 토대로 인물 관계, 미회수 복선, 감정 흐름을 이번 화에 자연스럽게 연결하세요.

${memoryCardsContext}

` : ''}${previousEpisodeEnding ? `## ★ 이전 화 마지막 장면 (이 장면 직후부터 이어서 작성)
> 아래는 제${episodeNumber - 1}화의 마지막 부분입니다. 이 분위기와 상황을 자연스럽게 이어받아 제${episodeNumber}화를 시작하세요.

${previousEpisodeEnding}

` : ''}${previousEpisodeSummary ? `## 직전 화 전문 (문체 참조용 — 이 문체와 호흡을 유지하세요)
${previousEpisodeSummary}

` : ''}${memoryContext ? `## 현재 상태 (Memory System - 반드시 반영)
- 작중 시간: ${memoryContext.storyDate || '미정'}
- 계절: ${memoryContext.season || '미정'}
- 현재 위치: ${memoryContext.currentLocation || '미정'}
- 주인공 체력: ${memoryContext.mcHealth || '미정'}
- 무공 등급: ${memoryContext.mcMartialRank || '미정'}
- 자산: ${memoryContext.mcMoney || '미정'}
- 감정 상태: ${memoryContext.mcEmotion || '미정'}
${memoryContext.mcInjury ? `- 부상: ${memoryContext.mcInjury}` : ''}
- 현재 목표: ${memoryContext.mcCurrentGoal || '미정'}
${memoryContext.personalityMain ? `- 위소운(주인격): ${memoryContext.personalityMain}` : ''}
${memoryContext.personalityLee ? `- 이준혁(분석가): ${memoryContext.personalityLee}` : ''}
${memoryContext.personalityChunma ? `- 천마(무력): ${memoryContext.personalityChunma}` : ''}
${memoryContext.activeForeshadows ? `- 활성 복선: ${memoryContext.activeForeshadows}` : ''}
${memoryContext.cautions ? `\n### ⚠️ 주의사항 (필수 준수)\n${memoryContext.cautions}` : ''}

` : ''}${characterGuide ? `## 등장 캐릭터 (말투/성격 반드시 반영)
${characterGuide}

` : ''}${worldContext ? `## 세계관 참고 자료
${worldContext}

` : ''}${styleReference ? `${styleReference}

` : ''}${characterVoices ? `${characterVoices}

` : ''}${loreReferences ? `${loreReferences}

` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
지금부터 제${episodeNumber}화 본문을 집필하세요.
제목부터 시작하고, 순수 소설 텍스트만 출력하세요.
★ 설계도에 명시된 내용만 작성하세요. 설계도에 없는 캐릭터·사건·떡밥을 추가하지 마세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI 호출 함수들 (OpenAI / Claude / Gemini)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function callOpenAI(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.8,       // 창의성 약간 높임 (소설 집필용)
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: '당신은 <화산귀환> 수준의 무협 웹소설 전문 작가입니다. 비장하고 간결한 문체로 몰입감 높은 소설을 집필합니다. 순수 소설 본문만 출력합니다.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI 호출 실패 (${res.status}): ${errorText}`);
  }

  const data: any = await res.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function callClaude(apiKey: string, prompt: string, maxTokens: number, model: string = 'claude-sonnet-4-6', temperature: number = 0.85): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: '당신은 <화산귀환> 수준의 무협 웹소설 전문 작가입니다. 비장하고 간결한 문체로 몰입감 높은 소설을 집필합니다. 순수 소설 본문만 출력합니다.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Claude 호출 실패 (${res.status}): ${errorText}`);
  }

  const data: any = await res.json();
  return Array.isArray(data?.content)
    ? data.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('')
    : '';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 이전 화 엔딩 추출 (마지막 장면 자동 추출)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function extractEpisodeEnding(content: string, episodeNum: number): string {
  // 영상화 메모, 다음화 예고 앞부분까지만 본문으로 취급
  const cutMarkers = ['## [🎬 영상화 메모]', '## [영상화 메모]', '> **[다음 화 예고]**'];
  let bodyText = content;
  for (const marker of cutMarkers) {
    const idx = bodyText.indexOf(marker);
    if (idx > 0) {
      bodyText = bodyText.substring(0, idx).trim();
    }
  }

  // 마지막 구분선(---) 이후의 텍스트 = 마지막 장면
  const sections = bodyText.split(/\n---\n/);
  if (sections.length >= 2) {
    // 마지막 2개 섹션 (마지막 장면 + 직전 장면 일부)
    const lastSections = sections.slice(-2).join('\n---\n');
    // 최대 1500자로 제한 (너무 길면 토큰 낭비)
    if (lastSections.length > 1500) {
      return '...' + lastSections.slice(-1500);
    }
    return lastSections;
  }

  // 구분선이 없으면 마지막 40줄
  const lines = bodyText.split('\n');
  const lastLines = lines.slice(-40).join('\n');
  if (lastLines.length > 1500) {
    return '...' + lastLines.slice(-1500);
  }
  return lastLines;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 규칙 자동 교정 (코드 기반 후처리, 비용 0원)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function postProcessText(text: string, episodeNumber: number): { text: string; corrections: string[] } {
  const corrections: string[] = [];
  let result = text;

  // ── 1. 구버전 용어 → 신버전 통일 ──
  const termReplacements: [RegExp, string, string][] = [
    [/심상전장/g, '삼혼귀일경', '심상전장→삼혼귀일경'],
    [/내면\s*공간/g, '삼혼귀일경', '내면공간→삼혼귀일경'],
  ];
  for (const [pattern, replacement, label] of termReplacements) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      corrections.push(label);
    }
  }

  // ── 2. 금지 키워드 제거 (구버전 오염 방지) ──
  const versionGateKeywords = ['빙의 직후', '태극자하신공', '우강진'];
  for (const kw of versionGateKeywords) {
    if (result.includes(kw)) {
      // 해당 키워드가 포함된 문장 전체를 제거
      const sentencePattern = new RegExp(`[^.!?\\n]*${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.!?\\n]*[.!?]?`, 'g');
      result = result.replace(sentencePattern, '');
      corrections.push(`금지키워드 "${kw}" 포함 문장 제거`);
    }
  }

  // ── 3. 천마 말투 교정 — 독백에서 존댓말 제거 ──
  // 천마의 내면 독백 패턴: (시끄럽습니다.) → (시끄러.) 등
  // 천마 독백은 () 안에서 반말이어야 함
  // 일반적인 패턴: "~하십시오", "~하세요", "~합니다", "~입니다" 가 천마 독백에 있으면 문제
  // 하지만 자동으로 천마 독백을 식별하기 어려우므로, 자주 나오는 오류 패턴만 처리
  const chunmaFixes: [RegExp, string][] = [
    [/\(시끄럽습니다\.?\)/g, '(시끄러.)'],
    [/\(시끄러워요\.?\)/g, '(시끄러.)'],
    [/\(닥치세요\.?\)/g, '(닥쳐.)'],
    [/\(닥치십시오\.?\)/g, '(닥쳐.)'],
    [/\(됐습니다\.?\)/g, '(됐다.)'],
    [/\(알겠습니다\.?\)/g, '(알았어.)'],
    [/\(그만하세요\.?\)/g, '(그만해.)'],
  ];
  for (const [pattern, replacement] of chunmaFixes) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      corrections.push('천마 존댓말→반말');
    }
  }

  // ── 4. 반복 표현 제한 ──
  // "시끄러" 계열이 3번 이상 나오면 2번째부터 대체어로 변경
  const repeatWords: { word: string; alts: string[] }[] = [
    { word: '시끄러', alts: ['됐다. 닥쳐', '잔소리 그만', '그만해'] },
    { word: '콧바람을 불었다', alts: ['코끝으로 웃었다', '입꼬리가 비틀렸다', '침묵이 대답이었다'] },
    { word: '눈을 가늘게', alts: ['눈이 좁아졌다', '눈빛이 날카로워졌다', '시선이 예리해졌다'] },
  ];
  for (const { word, alts } of repeatWords) {
    let count = 0;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), (match) => {
      count++;
      if (count > 2) {
        const alt = alts[(count - 3) % alts.length];
        corrections.push(`"${word}" ${count}번째→대체`);
        return alt;
      }
      return match;
    });
  }

  // ── 5. "~했다" 3연속 방지 ──
  // "~했다." 로 끝나는 문장이 3개 연속이면 3번째를 "~했다" → "~하고 있었다" 로 변형
  const lines = result.split('\n');
  let consecutiveHaetda = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.endsWith('했다.') || trimmed.endsWith('였다.') || trimmed.endsWith('있었다.')) {
      consecutiveHaetda++;
      if (consecutiveHaetda >= 3) {
        // 3번째 "~했다." 문장의 어미를 변형
        lines[i] = lines[i].replace(/했다\.$/, '하고 있었다.');
        if (lines[i] === result.split('\n')[i]) {
          lines[i] = lines[i].replace(/였다\.$/, '이었다.');
        }
        corrections.push('"~했다" 3연속 변형');
        consecutiveHaetda = 0;
      }
    } else if (trimmed.length > 0) {
      consecutiveHaetda = 0;
    }
  }
  result = lines.join('\n');

  // ── 6. 삼혼귀일경 발동 패턴 검증 ──
  // "천마가 눈을 감았다" + 삼혼귀일경 → "위소운이 눈을 감았다"로 교정
  result = result.replace(/천마가\s*눈을\s*감았다\.\s*\n*\s*현심조화/g, '위소운이 눈을 감았다.\n\n현심조화');
  if (result !== text && !corrections.includes('삼혼귀일경 발동자→위소운')) {
    // 변경이 있었는지 체크 (위의 replace로 인한)
    if (text.includes('천마가 눈을 감았다') && text.includes('현심조화')) {
      corrections.push('삼혼귀일경 발동자→위소운');
    }
  }

  // "천마만이 열 수 있는" → "위소운이 여는"
  if (result.includes('천마만이 열 수 있는')) {
    result = result.replace(/천마만이 열 수 있는/g, '천마에게 배운 술법으로 여는');
    corrections.push('삼혼귀일경 소유권→위소운');
  }

  return { text: result, corrections };
}

async function callGemini(apiKey: string, prompt: string, maxTokens: number, model: string = 'gemini-3-pro-preview', temperature: number = 0.85): Promise<string> {
  const modelId = model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini 호출 실패 (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => String(p?.text || '')).join('') : '';
}
