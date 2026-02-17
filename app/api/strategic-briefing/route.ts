import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [전략 브리핑 API] - 다음 화 전략 브리핑 자동 생성
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 소설_진행_마스터.md + master_story_bible.md를 읽어서
 * 다음 화에 필요한 정보를 구조화된 브리핑으로 제공합니다.
 * 
 * GET: 자동 생성 브리핑 + 저장된 선택사항 로드
 * POST: 방향 선택/클리프행어 등 브리핑 선택사항 저장
 * PATCH: §2 주의사항 / 바이블 계획 편집 (type: 'section2' | 'bible')
 * DELETE: 떡밥 보류 처리 (§3 → §8 아카이브)
 */

const NOVEL_DIR = join(process.cwd(), 'novels', 'murim_mna');
const BRIEFING_DIR = join(NOVEL_DIR, 'briefings');
const OUTPUT_DIR = join(NOVEL_DIR, 'output');

// ── 복선/떡밥 구조 ──
interface PlotThread {
  id: string;
  grade: string;
  episodeStarted: string;
  content: string;
  targetEpisode: string;
  statusIcon: string;
  statusText: string;
  urgency: 'urgent' | 'active' | 'deferred' | 'completed';
}

// ── 현재 상태 ──
interface CurrentState {
  latestEpisode: number;
  inWorldDate: string;
  location: string;
  health: string;
  martialLevel: string;
  personality3Status: string;
}

// ── GET: 브리핑 자동 생성 ──
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedEpisode = searchParams.get('episode');

    // 마스터 파일 읽기
    const masterPath = join(NOVEL_DIR, '소설_진행_마스터.md');
    const biblePath = join(NOVEL_DIR, 'master_story_bible.md');
    
    const masterContent = existsSync(masterPath) 
      ? readFileSync(masterPath, 'utf-8') : '';
    const bibleContent = existsSync(biblePath) 
      ? readFileSync(biblePath, 'utf-8') : '';

    if (!masterContent) {
      return NextResponse.json({
        success: false,
        message: '소설_진행_마스터.md 파일을 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // §1에서 현재 상태 파싱
    const currentState = parseCurrentState(masterContent);
    const nextEpisode = requestedEpisode 
      ? parseInt(requestedEpisode) 
      : currentState.latestEpisode + 1;

    // §2에서 다음 화 주의사항 추출
    const nextEpisodeNotes = extractSection(masterContent, '§2');

    // §3에서 활성 떡밥 파싱
    const plotThreads = parsePlotThreads(masterContent, nextEpisode);

    // §4에서 관계 매트릭스 추출
    const relationships = extractSection(masterContent, '§4');

    // §5에서 텐션 설계 추출
    const tensionDesign = extractSection(masterContent, '§5');

    // §7에서 최근 기억카드 추출
    const memoryCards = extractSection(masterContent, '§7');

    // 마지막 화 엔딩 (최근 30줄)
    const lastEpisodeEnding = getLastEpisodeEnding(nextEpisode - 1);

    // master_story_bible에서 다음 화 계획 추출
    const plannedContent = getPlannedEpisodeFromBible(bibleContent, nextEpisode);

    // 저장된 브리핑 선택사항 로드 (있으면)
    const savedChoices = loadSavedBriefing(nextEpisode);

    // ★ 에피소드 파일 존재 여부 확인
    const episodeFilePath = join(OUTPUT_DIR, `제${nextEpisode}화.md`);
    const episodeExists = existsSync(episodeFilePath);

    // 긴급/진행/보류 분류
    const urgentThreads = plotThreads.filter((t: any) => t.urgency === 'urgent');
    const activeThreads = plotThreads.filter((t: any) => t.urgency === 'active');
    const deferredThreads = plotThreads.filter((t: any) => t.urgency === 'deferred');

    return NextResponse.json({
      success: true,
      briefing: {
        nextEpisode,
        currentState,
        episodeExists,
        // 구조화된 데이터
        plotThreads: {
          urgent: urgentThreads,
          active: activeThreads,
          deferred: deferredThreads,
          total: plotThreads.length,
        },
        // 원문 섹션 (마크다운)
        sections: {
          nextEpisodeNotes,
          relationships,
          tensionDesign,
          memoryCards,
        },
        // 이전 화 엔딩
        lastEpisodeEnding,
        // 스토리 바이블 계획
        plannedContent,
        // 저장된 선택사항
        savedChoices,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '브리핑 생성 실패',
      error: error.message,
    }, { status: 500 });
  }
}

// ── POST: 브리핑 선택사항 저장 ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { episodeNumber, directionChoice, cliffhangerChoice, notes, approved } = body;

    if (!episodeNumber) {
      return NextResponse.json({
        success: false,
        message: '화수(episodeNumber)가 필요합니다.',
      }, { status: 400 });
    }

    // briefings 디렉토리 생성
    if (!existsSync(BRIEFING_DIR)) {
      mkdirSync(BRIEFING_DIR, { recursive: true });
    }

    const briefingPath = join(BRIEFING_DIR, `제${episodeNumber}화_브리핑.json`);
    
    // 기존 데이터 로드 (병합용)
    let existing: any = {};
    if (existsSync(briefingPath)) {
      try {
        existing = JSON.parse(readFileSync(briefingPath, 'utf-8'));
      } catch {}
    }

    // 저장
    const data = {
      ...existing,
      episodeNumber,
      directionChoice: directionChoice ?? existing.directionChoice,
      cliffhangerChoice: cliffhangerChoice ?? existing.cliffhangerChoice,
      notes: notes ?? existing.notes,
      approved: approved ?? existing.approved,
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(briefingPath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: `✅ 제${episodeNumber}화 브리핑 저장 완료`,
      data,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '브리핑 저장 실패',
      error: error.message,
    }, { status: 500 });
  }
}


// ── PUT: AI 자동 제안 생성 (방향 A/B + 클리프행어 3개) ──
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedEpisode = searchParams.get('episode');

    // 마스터 파일 읽기 (GET과 동일)
    const masterPath = join(NOVEL_DIR, '소설_진행_마스터.md');
    const biblePath = join(NOVEL_DIR, 'master_story_bible.md');

    const masterContent = existsSync(masterPath)
      ? readFileSync(masterPath, 'utf-8') : '';
    const bibleContent = existsSync(biblePath)
      ? readFileSync(biblePath, 'utf-8') : '';

    if (!masterContent) {
      return NextResponse.json({
        success: false,
        message: '소설_진행_마스터.md 파일이 필요합니다.',
      }, { status: 404 });
    }

    const currentState = parseCurrentState(masterContent);
    const nextEpisode = requestedEpisode
      ? parseInt(requestedEpisode)
      : currentState.latestEpisode + 1;

    // 활성 복선 파싱
    const plotThreads = parsePlotThreads(masterContent, nextEpisode);
    const urgentThreads = plotThreads.filter((t: any) => t.urgency === 'urgent');
    const activeThreads = plotThreads.filter((t: any) => t.urgency === 'active');

    // 스토리 바이블 계획
    const plannedContent = getPlannedEpisodeFromBible(bibleContent, nextEpisode);

    // 직전 1화 엔딩만 읽기 (14화 기획에 11화·12화 엔딩은 불필요 — §1 현재 상태에 이미 반영됨)
    let recentContext = '';
    const prevEpPath = join(OUTPUT_DIR, `제${nextEpisode - 1}화.md`);
    if (existsSync(prevEpPath)) {
      const content = readFileSync(prevEpPath, 'utf-8');
      // 영상화 메모/다음화 예고 앞까지만 본문 취급
      let body = content;
      for (const marker of ['## [🎬 영상화 메모]', '## [영상화 메모]', '> **[다음 화 예고]**', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━']) {
        const idx = body.indexOf(marker);
        if (idx > 0) body = body.substring(0, idx).trim();
      }
      // 마지막 2000자만 (엔딩 장면 + 분위기)
      const trimmed = body.length > 2000
        ? '...(앞부분 생략)...\n' + body.slice(-2000)
        : body;
      recentContext = `\n=== 제${nextEpisode - 1}화 (마지막 부분) ===\n${trimmed}\n`;
    }

    // AI 프롬프트 구성 — 4방향 + 연출 변수 포함
    const aiPrompt = `당신은 한국 무협 웹소설 "서구진 귀환편"의 전략 기획자입니다.
주인공 위소운은 1인 3인격(위소운/이준혁/천마)을 가진 청년입니다.
아래 정보를 분석하고, 제${nextEpisode}화의 방향 4가지, 클리프행어 3가지, 연출 변수를 제안하세요.

## 현재 상태
- 최신 완료 화: 제${currentState.latestEpisode}화
- 작중 시간: ${currentState.inWorldDate || '미정'}
- 위치: ${currentState.location || '미정'}
- 건강: ${currentState.health || '미정'}
- 무공: ${currentState.martialLevel || '미정'}
- 3인격: ${currentState.personality3Status || '미정'}

## 긴급 복선 (이번 화에서 처리 필요)
${urgentThreads.length > 0 ? urgentThreads.map((t: any) => `- [${t.grade}등급] ${t.content} (목표: ${t.targetEpisode})`).join('\n') : '없음'}

## 진행 중 복선
${activeThreads.length > 0 ? activeThreads.map((t: any) => `- [${t.grade}등급] ${t.content}`).join('\n') : '없음'}

## 스토리 바이블 계획
${plannedContent || '해당 화의 구체적 바이블 계획이 테이블에 없습니다. 위의 활성 복선 범위 안에서만 자연스럽게 이어가세요. ★ 새로운 사건·캐릭터·세력을 임의로 도입하지 마세요.'}

## 최근 에피소드 (이어서 쓸 내용의 직전 맥락)
${recentContext || '(에피소드 없음)'}

━━━━━━━━━━━━━━━━━━━━━
## 출력 형식 — 반드시 아래 형식으로만 출력. 다른 설명은 쓰지 마세요.

DIRECTION_A|방향 제목|상세 설명 (3문장 이상)|핵심 장면 3개 (/ 구분)|캐릭터 비중 (예: 위소운 40%, 남궁현 25%)|추천 이유 (2문장)
DIRECTION_B|방향 제목|상세 설명 (3문장 이상)|핵심 장면 3개|캐릭터 비중|추천 이유 (2문장)
DIRECTION_C|방향 제목|상세 설명 (3문장 이상)|핵심 장면 3개|캐릭터 비중|추천 이유 (2문장)
DIRECTION_D|방향 제목|상세 설명 (3문장 이상)|핵심 장면 3개|캐릭터 비중|추천 이유 (2문장)
RECOMMEND|A,B,C,D 중 1개|상세 추천 이유 (2문장, 독자 반응 예측 포함)
CLIFF_1|클리프행어 제목|장면 상세 묘사 (3문장: 상황+인물반응+마지막 문장 예시)|예상 독자 반응
CLIFF_2|클리프행어 제목|장면 상세 묘사|예상 독자 반응
CLIFF_3|클리프행어 제목|장면 상세 묘사|예상 독자 반응
CASTING|이름:역할,이름:역할,... (역할은 주연/조연/카메오 중 택1. 예: 위소운:주연,천마(내면):조연,남궁현:주연,당찬:카메오)
SETTING|배경 장소, 시간대, 분위기를 한 문단으로 묘사 (구체적으로: 장소명, 시각, 날씨, 소리, 냄새 등)
PERSONALITY|위소운:비율,천마:비율,이준혁:비율 (예: 위소운:40,천마:35,이준혁:25 — 이 화에서 각 인격의 등장 비중%)
EMOTION_START|시작 감정 (평온/기대/설렘/코미디/긴장/충격/슬픔/분노/감동/공포/전투열기/여운/결의/비장 중 택1)
EMOTION_PEAK|절정 감정 (위 선택지 중 택1)
EMOTION_END|마무리 감정 (위 선택지 중 택1)
SCENE_1|장면명|감정 목표|장면 설명 (2문장, 구체적으로)
SCENE_2|장면명|감정 목표|장면 설명
SCENE_3|장면명|감정 목표|장면 설명
SCENE_4|장면명|감정 목표|장면 설명
SCENE_5|장면명|감정 목표|장면 설명
EMOTION|감정 흐름 5막 (예: 따뜻한 아침 → 혼란의 스카우트 → 비장한 결심 → 긴장의 만남 → 전율의 엔딩)
HEART_LINE|이번 화의 "심장라인" — 독자가 스크린샷 찍을 대사 또는 나레이션 1문장 (캐릭터 말투 반영)
THREAD_USE|이번 화에서 다룰 복선과 처리법 (예: V3-01 힌트 투하 / F02 부분 회수 / 새 복선 깔기)

## 규칙
- A안: 사건/전투/반전 중심의 강렬한 방향
- B안: 캐릭터 관계+일상+복선을 균형 있게 다루는 방향
- C안: 특정 캐릭터(주인공 외) 중심의 서브플롯 또는 과거/회상 방향
- D안: 실험적/반전적 방향 — 독자가 예상 못 할 전개
- 네 방향은 확실히 다른 톤과 구조여야 합니다
- 각 방향의 상세 설명은 "이렇게 쓰면 되겠다"는 수준으로 구체적으로
- 클리프행어는 마지막 문장 예시까지 포함할 정도로 생생하게
- CASTING: 이번 화에 등장시킬 인물과 비중을 제안
- SETTING: 구체적 장소·시간·분위기를 한 문단으로 (소설 쓸 때 바로 참고 가능하게)
- PERSONALITY: 3인격 비중 — 이 화에서 위소운/천마/이준혁의 활약도 비율
- 감정 설계(EMOTION_START/PEAK/END): 이 화의 감정 곡선 시작점, 절정, 마무리
- 심장라인은 캐릭터 말투 반영 (위소운=평어, 천마=반말, 이준혁=존댓말)
- 이전 화 엔딩에서 자연스럽게 이어져야 합니다
- 활성 복선을 회수하거나 진전시키는 방향을 우선 고려

## ★ 절대 규칙 (가드레일) — 이 규칙을 어기면 0점 처리
- 스토리 바이블 계획에 없는 새로운 사건·캐릭터·세력을 임의로 도입하지 마세요
- 4가지 방향(A/B/C/D) 모두 바이블 계획 범위 안에서 제안하세요
- "긴급 복선"과 "진행 중 복선" 목록에 있는 것만 다루세요. 목록에 없는 떡밥을 새로 만들지 마세요
- 이번 화에 등장하지 않는 캐릭터(위 복선에 언급되지 않은 인물)를 CASTING에 넣지 마세요
- D안(실험적)도 바이블 범위 안에서만 실험하세요. 바이블에 없는 사건은 금지입니다`;

    // Claude Sonnet API 호출 — 전략 브리핑 AI 제안
    const claudeKey = process.env.CLAUDE_API_KEY;
    if (!claudeKey) {
      return NextResponse.json({
        success: false,
        message: 'CLAUDE_API_KEY가 설정되지 않았습니다.',
      }, { status: 500 });
    }

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        temperature: 0.7,
        messages: [{ role: 'user', content: aiPrompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`Claude 호출 실패 (${aiRes.status}): ${errText.slice(0, 300)}`);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.content?.[0]?.text || '';

    if (!raw) {
      throw new Error('AI가 응답을 생성하지 못했습니다.');
    }

    // 응답 파싱
    const suggestions = parseAISuggestions(raw);

    console.log(`🎬 AI 자동 제안 완료: 제${nextEpisode}화 (추천: ${suggestions.recommended}안, 클리프행어 ${suggestions.cliffhangers.length}개)`);

    return NextResponse.json({
      success: true,
      suggestions,
      nextEpisode,
    });
  } catch (error: any) {
    console.error('❌ AI 제안 생성 오류:', error);
    return NextResponse.json({
      success: false,
      message: 'AI 제안 생성 실패: ' + error.message,
    }, { status: 500 });
  }
}

/** AI 제안 응답 파싱 — 4방향 + 연출 변수 포함 */
function parseAISuggestions(raw: string) {
  const lines = raw.split('\n').filter((l: string) => l.trim());

  // 방향 A/B/C/D (제목, 설명, 핵심장면, 캐릭터비중, 이유)
  const dirs: Record<string, { title: string; description: string; scenes: string; characters: string; reason: string }> = {
    A: { title: '', description: '', scenes: '', characters: '', reason: '' },
    B: { title: '', description: '', scenes: '', characters: '', reason: '' },
    C: { title: '', description: '', scenes: '', characters: '', reason: '' },
    D: { title: '', description: '', scenes: '', characters: '', reason: '' },
  };
  let recommended: 'A' | 'B' | 'C' | 'D' = 'B';
  let recommendReason = '';

  // 클리프행어 (제목 + 장면묘사 + 독자반응)
  const cliffhangers: { title: string; description: string; reaction: string }[] = [];

  // 핵심 장면 5개
  const scenes: { name: string; emotion: string; description: string }[] = [];

  // 감정 곡선, 심장라인, 복선 처리
  let emotionArc = '';
  let heartLine = '';
  let threadUse = '';

  // 연출 변수
  let castingRaw = '';
  let settingText = '';
  let personalityRaw = '';
  let emotionStart = '';
  let emotionPeak = '';
  let emotionEnd = '';

  for (const line of lines) {
    const t = line.trim();

    // 방향 A/B/C/D 파싱
    const dirMatch = t.match(/^DIRECTION_(A|B|C|D)\|/);
    if (dirMatch) {
      const key = dirMatch[1];
      const p = t.substring(`DIRECTION_${key}|`.length).split('|');
      dirs[key].title = p[0]?.trim() || '';
      dirs[key].description = p[1]?.trim() || '';
      dirs[key].scenes = p[2]?.trim() || '';
      dirs[key].characters = p[3]?.trim() || '';
      dirs[key].reason = p[4]?.trim() || '';
    } else if (t.startsWith('RECOMMEND|')) {
      const p = t.substring('RECOMMEND|'.length).split('|');
      const rec = p[0]?.trim().toUpperCase();
      recommended = (['A','B','C','D'].includes(rec) ? rec : 'B') as 'A'|'B'|'C'|'D';
      recommendReason = p[1]?.trim() || '';
    } else if (t.match(/^CLIFF_\d+\|/)) {
      const p = t.split('|').slice(1);
      cliffhangers.push({
        title: p[0]?.trim() || '',
        description: p[1]?.trim() || '',
        reaction: p[2]?.trim() || '',
      });
    } else if (t.match(/^SCENE_\d+\|/)) {
      const p = t.split('|').slice(1);
      scenes.push({
        name: p[0]?.trim() || '',
        emotion: p[1]?.trim() || '',
        description: p[2]?.trim() || '',
      });
    } else if (t.startsWith('CASTING|')) {
      castingRaw = t.substring('CASTING|'.length).trim();
    } else if (t.startsWith('SETTING|')) {
      settingText = t.substring('SETTING|'.length).trim();
    } else if (t.startsWith('PERSONALITY|')) {
      personalityRaw = t.substring('PERSONALITY|'.length).trim();
    } else if (t.startsWith('EMOTION_START|')) {
      emotionStart = t.substring('EMOTION_START|'.length).trim();
    } else if (t.startsWith('EMOTION_PEAK|')) {
      emotionPeak = t.substring('EMOTION_PEAK|'.length).trim();
    } else if (t.startsWith('EMOTION_END|')) {
      emotionEnd = t.substring('EMOTION_END|'.length).trim();
    } else if (t.startsWith('EMOTION|')) {
      emotionArc = t.substring('EMOTION|'.length).trim();
    } else if (t.startsWith('HEART_LINE|')) {
      heartLine = t.substring('HEART_LINE|'.length).trim();
    } else if (t.startsWith('THREAD_USE|')) {
      threadUse = t.substring('THREAD_USE|'.length).trim();
    }
  }

  // 캐스팅 파싱: "위소운:주연,천마(내면):조연,남궁현:주연" → [{name, role}]
  let casting: {name: string; role: string}[] | null = null;
  if (castingRaw) {
    casting = castingRaw.split(',').map(item => {
      const [name, role] = item.trim().split(':');
      return { name: name?.trim() || '', role: role?.trim() || '조연' };
    }).filter((c: any) => c.name);
  }

  // 3인격 비중 파싱: "위소운:40,천마:35,이준혁:25" → {wisoun, chunma, junhyuk}
  let personalityBalance: {wisoun: number; chunma: number; junhyuk: number} | null = null;
  if (personalityRaw) {
    const pMap: Record<string, string> = { '위소운': 'wisoun', '천마': 'chunma', '이준혁': 'junhyuk' };
    const parsed: any = {};
    personalityRaw.split(',').forEach(item => {
      const [name, val] = item.trim().split(':');
      const key = pMap[name?.trim()] || '';
      if (key && val) parsed[key] = parseInt(val) || 30;
    });
    if (parsed.wisoun || parsed.chunma || parsed.junhyuk) {
      personalityBalance = {
        wisoun: parsed.wisoun || 30,
        chunma: parsed.chunma || 30,
        junhyuk: parsed.junhyuk || 30,
      };
    }
  }

  // 감정 설계 파싱
  let emotionDesign: {start: string; peak: string; end: string} | null = null;
  if (emotionStart || emotionPeak || emotionEnd) {
    emotionDesign = {
      start: emotionStart || '평온',
      peak: emotionPeak || '긴장',
      end: emotionEnd || '여운',
    };
  }

  // 방향 데이터 조립 (없으면 기본값)
  const makeDir = (key: string, fallback: string) => ({
    title: dirs[key].title || `${fallback}안`,
    description: dirs[key].description || `${fallback}안 — AI가 생성하지 못함. 직접 입력해주세요.`,
    scenes: dirs[key].scenes,
    characters: dirs[key].characters,
    reason: dirs[key].reason,
  });

  return {
    directionA: makeDir('A', 'A'),
    directionB: makeDir('B', 'B'),
    directionC: makeDir('C', 'C'),
    directionD: makeDir('D', 'D'),
    recommended,
    recommendReason,
    cliffhangers: cliffhangers.length > 0
      ? cliffhangers
      : [{ title: '생성 실패', description: '수동으로 입력해주세요.', reaction: '' }],
    scenes,
    emotionArc,
    heartLine,
    threadUse,
    // 연출 변수
    casting,
    setting: settingText || null,
    personalityBalance,
    emotionDesign,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 파싱 유틸 함수들
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** §1 현재 상태 테이블 파싱 */
function parseCurrentState(content: string): CurrentState {
  const section = extractSection(content, '§1');
  
  const getField = (label: string): string => {
    const regex = new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|`);
    const match = section.match(regex);
    return match ? match[1].replace(/\*\*/g, '').trim() : '';
  };

  const latestStr = getField('최신 집필 화수');
  const latestEpisode = parseInt(latestStr) || 13;

  return {
    latestEpisode,
    inWorldDate: getField('작중 날짜'),
    location: getField('현재 위치'),
    health: getField('건강'),
    martialLevel: getField('무공 등급'),
    personality3Status: getField('3인격 관계'),
  };
}

/** 마크다운에서 특정 §섹션 추출 */
function extractSection(content: string, sectionId: string): string {
  // §N 패턴으로 시작하는 블록을 찾음
  const sectionNum = sectionId.replace('§', '');
  
  // "# §N." 으로 시작하는 줄을 찾고, 다음 "# §" 또는 "# 📌" 이전까지 추출
  const lines = content.split('\n');
  let capturing = false;
  let headerPassed = false;
  const result: string[] = [];
  
  for (const line of lines) {
    // 섹션 시작 감지
    if (line.includes(`§${sectionNum}.`) && line.startsWith('#')) {
      capturing = true;
      headerPassed = false;
      continue;
    }
    
    // 구분선(═══) 건너뛰기
    if (capturing && !headerPassed && line.includes('═══')) {
      continue;
    }
    
    if (capturing && !headerPassed && !line.includes('═══') && !line.startsWith('#')) {
      headerPassed = true;
    }
    
    // 다음 섹션 감지 → 중단
    if (capturing && headerPassed && /^#\s*(§\d+\.|═══|📌)/.test(line)) {
      break;
    }
    
    if (capturing && headerPassed) {
      result.push(line);
    }
  }
  
  // 앞뒤 빈줄과 --- 제거
  let text = result.join('\n').trim();
  if (text.endsWith('---')) {
    text = text.slice(0, -3).trim();
  }
  return text;
}

/** §3 활성 떡밥 테이블 파싱 */
function parsePlotThreads(content: string, nextEpisode: number): PlotThread[] {
  const section = extractSection(content, '§3');
  const lines = section.split('\n');
  const threads: PlotThread[] = [];

  for (const line of lines) {
    // 테이블 행 매칭: | ID | 등급 | 깐 화 | 내용 | 목표 회수 | 상태 |
    const match = line.match(
      /\|\s*(V3-\d+|F\d+)\s*\|\s*([SABC])\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/
    );
    
    if (match) {
      const id = match[1].trim();
      const grade = match[2].trim();
      const episodeStarted = match[3].trim();
      const contentText = match[4].trim().replace(/\*\*/g, '');
      const targetEpisode = match[5].trim();
      const statusFull = match[6].trim();
      
      // 상태 아이콘 추출
      let statusIcon = '⚪';
      if (statusFull.includes('🔴')) statusIcon = '🔴';
      else if (statusFull.includes('🟡')) statusIcon = '🟡';
      else if (statusFull.includes('✅')) statusIcon = '✅';
      
      const statusText = statusFull.replace(/[🔴🟡✅]/g, '').trim();
      
      // 긴급도 판단
      let urgency: PlotThread['urgency'] = 'deferred';
      
      if (statusIcon === '✅') {
        urgency = 'completed';
      } else if (statusIcon === '🔴') {
        // 목표 화수에 다음 화가 포함되는지 확인
        if (isTargetNear(targetEpisode, nextEpisode)) {
          urgency = 'urgent';
        } else {
          urgency = 'active';
        }
      } else if (statusIcon === '🟡') {
        if (isTargetNear(targetEpisode, nextEpisode)) {
          urgency = 'active';
        } else {
          urgency = 'deferred';
        }
      }
      
      threads.push({
        id, grade, episodeStarted, content: contentText,
        targetEpisode, statusIcon, statusText, urgency,
      });
    }
  }

  return threads;
}

/** 목표 화수 범위에 다음 화가 가까운지 판단 */
function isTargetNear(targetStr: string, nextEpisode: number): boolean {
  // "14~20화" 또는 "13~300화" 같은 형식 파싱
  const match = targetStr.match(/(\d+)~(\d+)/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    // 다음 화가 목표 범위 시작점 근처(+3)이면 긴급
    return nextEpisode >= start && nextEpisode <= end && nextEpisode <= start + 5;
  }
  // "13화" 같은 단일 화수
  const singleMatch = targetStr.match(/(\d+)화/);
  if (singleMatch) {
    return Math.abs(parseInt(singleMatch[1]) - nextEpisode) <= 2;
  }
  return false;
}

/** 마지막 화 엔딩 (최근 50줄) */
function getLastEpisodeEnding(episodeNum: number): string {
  const filePath = join(OUTPUT_DIR, `제${episodeNum}화.md`);
  if (!existsSync(filePath)) return '';
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const lastLines = lines.slice(-50);
    return lastLines.join('\n').trim();
  } catch {
    return '';
  }
}

/** master_story_bible에서 해당 화 계획 추출
 * ★ 개선: 해당 화 테이블 행 + 소속 아크 설명까지 포함 (맥락 강화)
 * ⚠️ 다른 화(15화, 16화 등)의 테이블 행은 절대 포함하지 않음
 */
function getPlannedEpisodeFromBible(bibleContent: string, episodeNum: number): string {
  if (!bibleContent) return '';
  
  const lines = bibleContent.split('\n');
  const results: string[] = [];
  
  // 1단계: 해당 화가 속한 아크 제목+설명 추출 (전체 맥락 파악용)
  // 예: "### 기(起) 시작: 꿈의 실행 (14~25화)" → 아크의 방향을 알려줌
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('###') && lines[i].includes('화)')) {
      const rangeMatch = lines[i].match(/(\d+)~(\d+)화/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        if (episodeNum >= start && episodeNum <= end) {
          results.push(`**[아크]** ${lines[i].replace(/^#+\s*/, '')}`);
          // > 로 시작하는 아크 설명줄도 포함
          for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
            if (lines[j].startsWith('>')) {
              results.push(lines[j]);
            } else if (lines[j].trim() === '') {
              continue;
            } else {
              break;
            }
          }
          break;
        }
      }
    }
  }
  
  // 2단계: 해당 화 테이블 행만 정확히 추출 (예: "| **14화** |")
  // ⚠️ 다른 화(15화 등)는 절대 포함하지 않음
  for (const line of lines) {
    if (line.startsWith('|') && line.includes(`**${episodeNum}화**`)) {
      results.push(line);
    }
  }
  
  return results.length > 0 ? results.join('\n') : '';
}

/** 저장된 브리핑 로드 */
function loadSavedBriefing(episodeNum: number): any {
  const briefingPath = join(BRIEFING_DIR, `제${episodeNum}화_브리핑.json`);
  if (!existsSync(briefingPath)) return null;
  
  try {
    return JSON.parse(readFileSync(briefingPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ── DELETE: 떡밥 보류 처리 (§3에서 제거 → §8 아카이브로 이동, 나중에 자동 복원) ──
// ★ 영구 삭제가 아닌 "보류 이동" — 목표 화수가 되면 update-master가 자동으로 §3에 복원
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { threadId } = body; // 예: "V3-04"

    if (!threadId) {
      return NextResponse.json({
        success: false,
        message: '삭제할 떡밥 ID가 필요합니다.',
      }, { status: 400 });
    }

    // 소설_진행_마스터.md 읽기
    const masterPath = join(NOVEL_DIR, '소설_진행_마스터.md');
    if (!existsSync(masterPath)) {
      return NextResponse.json({
        success: false,
        message: '소설_진행_마스터.md 파일을 찾을 수 없습니다.',
      }, { status: 404 });
    }

    const content = readFileSync(masterPath, 'utf-8');
    const lines = content.split('\n');

    // §3에서 해당 행 찾기 + 제거
    let removedLine = '';
    const newLines = lines.filter(line => {
      if (line.match(new RegExp(`\\|\\s*${threadId}\\s*\\|`))) {
        removedLine = line.trim();
        return false; // §3에서 제거
      }
      return true;
    });

    if (!removedLine) {
      return NextResponse.json({
        success: false,
        message: `떡밥 ${threadId}을(를) 찾을 수 없습니다.`,
      }, { status: 404 });
    }

    // ★ §8 아카이브에 "⏸️ 보류" 태그로 추가 (나중에 자동 복원 대상)
    // §8 "[보류 떡밥 아카이브]" 섹션을 찾거나 생성
    const archiveHeader = '### [보류 떡밥 아카이브]';
    const archiveIdx = newLines.findIndex((l: string) => l.includes(archiveHeader));

    // 보류 행 생성: 원래 테이블 행에서 상태를 ⏸️ 보류로 변경
    const pausedLine = removedLine.replace(/🔴|🟡|✅/g, '⏸️');

    if (archiveIdx >= 0) {
      // 이미 보류 섹션이 있으면 그 아래에 추가
      newLines.splice(archiveIdx + 1, 0, pausedLine);
    } else {
      // 보류 섹션이 없으면 §8 끝에 생성
      // "## 업데이트 규칙" 줄 바로 위에 삽입
      const updateRuleIdx = newLines.findIndex((l: string) => l.startsWith('## 업데이트 규칙'));
      if (updateRuleIdx >= 0) {
        newLines.splice(updateRuleIdx, 0,
          archiveHeader,
          '',
          '> ⏸️ = 현재 화에서 불필요하여 보류. 목표 화수가 되면 자동 복원됨.',
          '',
          '| ID | 등급 | 깐 화 | 내용 | 목표 회수 | 상태 |',
          '|----|------|-------|------|----------|------|',
          pausedLine,
          '',
          '---',
          '',
        );
      } else {
        // 폴백: 파일 끝에 추가
        newLines.push('', archiveHeader, '', pausedLine);
      }
    }

    writeFileSync(masterPath, newLines.join('\n'), 'utf-8');

    return NextResponse.json({
      success: true,
      message: `✅ 떡밥 ${threadId} → §8 보류 이동 완료 (목표 화수가 되면 자동 복원됩니다)`,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '떡밥 보류 처리 실패',
      error: error.message,
    }, { status: 500 });
  }
}

// ── PATCH: §2 주의사항 또는 바이블 계획 직접 편집 ──
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, content, episodeNumber } = body;

    if (!type || content === undefined || !episodeNumber) {
      return NextResponse.json({ success: false, message: 'type, content, episodeNumber 필수' }, { status: 400 });
    }

    // ─── type: 'section2' → 소설_진행_마스터.md의 §2 본문만 교체 ───
    if (type === 'section2') {
      const masterPath = join(NOVEL_DIR, '소설_진행_마스터.md');
      if (!existsSync(masterPath)) {
        return NextResponse.json({ success: false, message: '소설_진행_마스터.md 파일 없음' }, { status: 404 });
      }

      const masterText = readFileSync(masterPath, 'utf-8');
      const lines = masterText.split('\n');

      // §2 시작 줄 찾기 (# §2.)
      const s2Start = lines.findIndex((l: string) => l.startsWith('# §2'));
      if (s2Start < 0) {
        return NextResponse.json({ success: false, message: '§2 섹션을 찾을 수 없습니다' }, { status: 404 });
      }

      // §2 끝 = 다음 ═══ 구분선(§3 위) 직전까지
      let s2ContentEnd = lines.length;
      for (let i = s2Start + 2; i < lines.length; i++) {
        if (lines[i].startsWith('# ═') && i > s2Start + 2) {
          // --- 와 빈줄까지 역추적
          s2ContentEnd = i;
          while (s2ContentEnd > s2Start + 2 && (lines[s2ContentEnd - 1].trim() === '' || lines[s2ContentEnd - 1].trim() === '---')) {
            s2ContentEnd--;
          }
          break;
        }
      }

      // §2 헤더 2줄(제목+═══)은 유지, 본문만 교체
      const headerPart = lines.slice(0, s2Start + 2); // §2 헤더까지
      const afterPart = lines.slice(s2ContentEnd);     // §3 ═══ 줄부터 끝까지

      const newFile = [
        ...headerPart,
        '',
        content.trim(),
        '',
        '---',
        '',
        ...afterPart,
      ];

      writeFileSync(masterPath, newFile.join('\n'), 'utf-8');
      console.log(`✏️ §2 주의사항 편집 완료 (${episodeNumber}화)`);
      return NextResponse.json({ success: true, message: '§2 주의사항 저장 완료' });
    }

    // ─── type: 'bible' → master_story_bible.md에서 해당 화 테이블 행 + 아크 설명 교체 ───
    if (type === 'bible') {
      const biblePath = join(NOVEL_DIR, 'master_story_bible.md');
      if (!existsSync(biblePath)) {
        return NextResponse.json({ success: false, message: 'master_story_bible.md 파일 없음' }, { status: 404 });
      }

      const bibleText = readFileSync(biblePath, 'utf-8');
      const bibleLines = bibleText.split('\n');

      // 편집 내용을 줄 단위 분리
      const editedLines = content.trim().split('\n');

      // 편집 내용에서 카테고리 분리: 아크 설명(> 줄)과 테이블 행(| 줄)
      const editedArcDescs: string[] = [];
      const editedTableRow: string[] = [];

      for (const el of editedLines) {
        if (el.startsWith('>')) {
          editedArcDescs.push(el);
        } else if (el.startsWith('|') && el.includes(`**${episodeNumber}화**`)) {
          editedTableRow.push(el);
        }
        // **[아크]** 줄은 읽기 전용 정보이므로 원본 수정 대상 아님
      }

      const newBibleLines = [...bibleLines];

      // (1) 테이블 행 교체: | **N화** | 패턴을 찾아 교체
      if (editedTableRow.length > 0) {
        for (let i = 0; i < newBibleLines.length; i++) {
          if (newBibleLines[i].startsWith('|') && newBibleLines[i].includes(`**${episodeNumber}화**`)) {
            newBibleLines[i] = editedTableRow[0];
            break;
          }
        }
      }

      // (2) 아크 설명(>) 줄 교체 — 해당 화가 속한 아크 범위 내에서만
      if (editedArcDescs.length > 0) {
        for (let i = 0; i < newBibleLines.length; i++) {
          if (newBibleLines[i].startsWith('###') && newBibleLines[i].includes('화)')) {
            const rangeMatch = newBibleLines[i].match(/(\d+)~(\d+)화/);
            if (rangeMatch) {
              const arcStart = parseInt(rangeMatch[1]);
              const arcEnd = parseInt(rangeMatch[2]);
              if (episodeNumber >= arcStart && episodeNumber <= arcEnd) {
                // 아크 헤더 바로 아래 > 줄들 범위 파악
                let descStart = i + 1;
                // 빈줄 건너뛰기
                while (descStart < newBibleLines.length && newBibleLines[descStart].trim() === '') descStart++;
                let descEnd = descStart;
                while (descEnd < newBibleLines.length && newBibleLines[descEnd].startsWith('>')) descEnd++;

                // 기존 > 줄들을 편집된 > 줄들로 교체
                newBibleLines.splice(descStart, descEnd - descStart, ...editedArcDescs);
                break;
              }
            }
          }
        }
      }

      writeFileSync(biblePath, newBibleLines.join('\n'), 'utf-8');
      console.log(`✏️ 바이블 계획 편집 완료 (${episodeNumber}화)`);
      return NextResponse.json({ success: true, message: '바이블 계획 저장 완료' });
    }

    return NextResponse.json({ success: false, message: `알 수 없는 type: ${type}` }, { status: 400 });

  } catch (error: any) {
    console.error('PATCH 에러:', error);
    return NextResponse.json({
      success: false,
      message: '편집 저장 실패',
      error: error.message,
    }, { status: 500 });
  }
}
