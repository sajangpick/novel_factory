import { NextRequest, NextResponse } from 'next/server';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 1~3 범용 AI 생성 API]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * type별로 다른 프롬프트를 사용:
 * - synopsis : Step 1 전체 줄거리 (~1,000자)
 * - structure: Step 2 기승전결 분리 (~300자 × 4)
 * - skeletons: Step 3 화별 100자 뼈대 (배치 단위)
 * 
 * OpenAI / Claude / Gemini 자동 전환
 */

interface OutlineRequest {
  type: 'synopsis' | 'structure' | 'skeletons';
  // ── Step 1 용 ──
  title?: string;
  genre?: string;
  totalEpisodes?: number;
  // ── Step 2 용 ──
  synopsis?: string;
  sections?: { name: string; episodes: number }[];
  // ── Step 3 용 (배치) ──
  sectionSynopsis?: string;   // 해당 기승전결 파트의 줄거리
  sectionName?: string;       // '기' | '승' | '전' | '결'
  startEpisode?: number;      // 배치 시작 화 번호
  endEpisode?: number;        // 배치 끝 화 번호
}

export async function POST(req: NextRequest) {
  try {
    const body: OutlineRequest = await req.json();

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

    // ── 타입별 프롬프트 생성 ──
    let prompt = '';
    let maxTokens = 2000;

    switch (body.type) {
      case 'synopsis':
        prompt = buildSynopsisPrompt(body);
        maxTokens = 2000;
        break;
      case 'structure':
        prompt = buildStructurePrompt(body);
        maxTokens = 3000;
        break;
      case 'skeletons':
        prompt = buildSkeletonsPrompt(body);
        maxTokens = 4000;
        break;
      default:
        return NextResponse.json({ success: false, message: '유효하지 않은 type입니다.' }, { status: 400 });
    }

    console.log(`📝 [generate-outline] type=${body.type} 생성 시작`);

    // ── AI 호출 ──
    let generatedText = '';

    if (openaiKey) {
      generatedText = await callOpenAI(openaiKey, prompt, maxTokens);
    } else if (claudeKey) {
      generatedText = await callClaude(claudeKey, prompt, maxTokens);
    } else if (geminiKey) {
      generatedText = await callGemini(geminiKey, prompt, maxTokens);
    }

    if (!generatedText) {
      throw new Error('AI가 텍스트를 생성하지 못했습니다.');
    }

    console.log(`✅ [generate-outline] type=${body.type} 완료 (${generatedText.length}자)`);

    // ── 타입별 후처리 ──
    let result: any = { success: true, raw: generatedText };

    if (body.type === 'synopsis') {
      result.synopsis = generatedText;
    } else if (body.type === 'structure') {
      result.sections = parseStructure(generatedText);
      result.raw = generatedText;
    } else if (body.type === 'skeletons') {
      result.episodes = parseSkeletons(generatedText, body.startEpisode || 1);
      result.raw = generatedText;
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ [generate-outline] 오류:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'AI 생성 실패',
    }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 프롬프트 빌더
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Step 1: 전체 줄거리 생성 프롬프트 */
function buildSynopsisPrompt(body: OutlineRequest): string {
  return `당신은 20년 경력의 무협 웹소설 작가이자 MBA 경영 컨설턴트입니다.
아래 작품의 전체 줄거리를 1,000자 내외로 작성하세요.

## 작품 정보
- 제목: ${body.title || '무제'}
- 장르: ${body.genre || '무협'}
- 총 화수: ${body.totalEpisodes || 300}화

## 필수 포함 요소
1. 주인공 소개 (이름, 배경, 핵심 능력)
2. 핵심 갈등 (무엇과 싸우는가)
3. 주요 사건 3~5개 (기승전결 흐름)
4. 작품의 독특한 차별점
5. 핵심 테마 (예: 무협 x 경영학)

## 문체 지침
- 화산귀환, 나노마신 수준의 S급 웹소설을 목표로
- 무협적 상황을 경영학적 관점으로 해석하는 독특한 시각
- 독자가 "이거 읽어야겠다"고 느끼도록 매력적으로

## 출력 형식
순수 텍스트로 출력하세요. 마크다운 헤더(#)나 태그 없이 깔끔하게.
줄거리 본문만 출력하세요.`;
}

/** Step 2: 기승전결 구조 생성 프롬프트 */
function buildStructurePrompt(body: OutlineRequest): string {
  const sectionsInfo = body.sections
    ? body.sections.map(s => `- ${s.name}: ${s.episodes}화`).join('\n')
    : '- 기: 75화\n- 승: 75화\n- 전: 75화\n- 결: 75화';

  return `당신은 20년 경력의 무협 웹소설 작가이자 스토리 구조 전문가입니다.
아래 전체 줄거리를 기승전결(4단 구조)로 분리하세요.

## 전체 줄거리
${body.synopsis || '(줄거리 없음)'}

## 화수 배분
${sectionsInfo}

## 각 파트별 작성 지침

### 기(起) - 시작
- 주인공 소개와 세계관 설정
- 초기 갈등의 씨앗
- 독자를 끌어당기는 후킹 포인트

### 승(承) - 전개  
- 갈등 확대와 세력 확장
- 주요 조연 등장
- 경영학적 전략이 빛나는 구간

### 전(轉) - 절정
- 최대 위기와 반전
- 적대 세력과의 전면 충돌
- 주인공의 내면 갈등 폭발

### 결(結) - 결말
- 최종 결전과 해결
- 떡밥 회수
- 감동적 마무리

## 출력 형식 (반드시 이 형식을 따르세요)
[기]
(기 파트 줄거리 300자 내외)

[승]
(승 파트 줄거리 300자 내외)

[전]
(전 파트 줄거리 300자 내외)

[결]
(결 파트 줄거리 300자 내외)`;
}

/** Step 3: 화별 뼈대 생성 프롬프트 (배치) */
function buildSkeletonsPrompt(body: OutlineRequest): string {
  const start = body.startEpisode || 1;
  const end = body.endEpisode || 30;
  const count = end - start + 1;

  return `당신은 20년 경력의 무협 웹소설 작가입니다.
아래 정보를 바탕으로 제${start}화~제${end}화의 뼈대(각 100자 내외)를 작성하세요.

## 현재 파트: ${body.sectionName || '기'} (총 ${count}화분)

## 이 파트의 줄거리
${body.sectionSynopsis || '(줄거리 없음)'}

## 각 화의 뼈대 작성 지침
- 각 화마다 100자 내외로 핵심만 압축
- 포함 요소: 출연자, 장소, 핵심 사건, 감정 변화
- 화 간에 자연스러운 연결 (끊김 없이)
- 3~5화마다 사이다 포인트 배치
- 각 화의 마지막은 절단신공 (다음 화 유도)
- 무협 x 경영 관점을 자연스럽게 녹여내세요

## 출력 형식 (반드시 이 형식을 따르세요)
각 화를 [제N화] 태그로 시작하고, 바로 뒤에 뼈대를 작성하세요:

[제${start}화] (뼈대 100자)
[제${start + 1}화] (뼈대 100자)
...
[제${end}화] (뼈대 100자)

숫자 태그와 뼈대만 출력하세요. 다른 설명은 불필요합니다.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 파서 (AI 출력물 → 구조화된 데이터)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Step 2: AI 출력에서 기승전결 추출 */
function parseStructure(text: string): { name: string; synopsis: string }[] {
  const result: { name: string; synopsis: string }[] = [];
  const sections = ['기', '승', '전', '결'];

  for (const section of sections) {
    // [기], [승], [전], [결] 패턴 매칭
    const regex = new RegExp(`\\[${section}\\]\\s*([\\s\\S]*?)(?=\\[(?:기|승|전|결)\\]|$)`, 'i');
    const match = text.match(regex);
    result.push({
      name: section,
      synopsis: match ? match[1].trim() : '',
    });
  }

  // 파싱 실패 시 전체 텍스트를 4등분
  if (result.every(r => !r.synopsis)) {
    const quarter = Math.ceil(text.length / 4);
    for (let i = 0; i < 4; i++) {
      result[i].synopsis = text.slice(i * quarter, (i + 1) * quarter).trim();
    }
  }

  return result;
}

/** Step 3: AI 출력에서 화별 뼈대 추출 */
function parseSkeletons(text: string, startEpisode: number): { id: number; skeleton: string }[] {
  const episodes: { id: number; skeleton: string }[] = [];

  // [제N화] 패턴으로 분리
  const regex = /\[제(\d+)화\]\s*([\s\S]*?)(?=\[제\d+화\]|$)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const id = parseInt(match[1]);
    const skeleton = match[2].trim().slice(0, 200); // 200자 제한 (안전)
    if (id && skeleton) {
      episodes.push({ id, skeleton });
    }
  }

  // 파싱 실패 시 줄 단위로 분리 시도
  if (episodes.length === 0) {
    const lines = text.split('\n').filter(l => l.trim());
    lines.forEach((line, idx) => {
      episodes.push({
        id: startEpisode + idx,
        skeleton: line.replace(/^\[?제?\d+화?\]?\s*/, '').trim().slice(0, 200),
      });
    });
  }

  return episodes;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI 호출 함수들
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function callOpenAI(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: '당신은 무협 웹소설 전문 작가이자 MBA 경영 컨설턴트입니다. 한국어로 작성합니다.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI 호출 실패 (${res.status}): ${await res.text()}`);
  const data: any = await res.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function callClaude(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      temperature: 0.7,
      system: '당신은 무협 웹소설 전문 작가이자 MBA 경영 컨설턴트입니다. 한국어로 작성합니다.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude 호출 실패 (${res.status}): ${await res.text()}`);
  const data: any = await res.json();
  return Array.isArray(data?.content) ? data.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('') : '';
}

async function callGemini(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini 호출 실패 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => String(p?.text || '')).join('') : '';
}
