import { NextRequest, NextResponse } from 'next/server';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 7: 품질 검수 AI API]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 소설 본문(Step 6)을 AI가 6가지 기준으로 검수합니다:
 * 1. 경영 고증 - 경영학 메타포가 자연스럽고 정확한가
 * 2. 개연성   - 스토리 논리에 구멍이 없는가
 * 3. 설정 충돌 - 세계관/설정과 모순은 없는가
 * 4. 캐릭터   - 페르소나(말투/성격)가 일관되는가
 * 5. 문체     - 화산귀환 스타일을 유지하는가
 * 6. 절단신공 - 다음 화가 궁금한 엔딩인가
 * 
 * 각 항목에 점수(1~10)와 구체적 피드백을 반환합니다.
 */

interface QualityCheckRequest {
  episodeNumber: number;
  episodeTitle: string;
  content: string;        // Step 6에서 생성된 본문
  blueprint?: string;     // Step 4의 5000자 설계도 (비교 검증용)
  characters?: any[];     // 등장 캐릭터 정보
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [legacy_ref 이전] 자동 텍스트 분석 품질 게이트 (30개 기준)
// Python quality_gate.py → TypeScript 포팅
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface AutoCheckResult {
  category: string;       // style | consistency | dramatic
  name: string;
  passed: boolean;
  details: string;
  weight: number;
}

function runAutoQualityGate(text: string, episodeNumber: number): {
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  results: AutoCheckResult[];
  warnings: string[];
  forbiddenHits: string[];
} {
  const results: AutoCheckResult[] = [];
  const warnings: string[] = [];

  // ── 금지 문구 체크 ──
  const mustAvoidPhrases = [
    '띠링', '조건이 충족되었습니다', '상태창',
    '아메리카노', '오케이', '팩트 체크',
    'M&A', 'CEO', 'ROI', 'KPI', 'MBA', 'MOU', 'IPO', 'B2B', 'B2C',
    '파트너십', '인프라', '프레젠테이션',
  ];
  const forbiddenHits = mustAvoidPhrases.filter(p => text.includes(p));

  // ── 스타일 카테고리 (10개) ──
  // 1. 의성어 사용
  const onomatopoeia = ['콰', '쾅', '쿵', '펑', '쩌', '탁', '찰', '휘', '파', '드르'];
  const onomatopoeiaCount = onomatopoeia.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'style', name: '의성어 사용', passed: onomatopoeiaCount >= 3, details: `${onomatopoeiaCount}회 (필요: 3회)`, weight: 1 });

  // 2. 짧고 강렬한 대사
  const impactPhrases = ['시끄럽', '지루', '가증', '흥', '꺼져', '닥쳐', '어림없'];
  const impactCount = impactPhrases.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'style', name: '임팩트 대사', passed: impactCount >= 1, details: `${impactCount}회 (필요: 1회)`, weight: 2 });

  // 3. 글자 수
  const charCount = text.replace(/\s+/g, '').length;
  results.push({ category: 'style', name: '글자 수', passed: charCount >= 4000, details: `${charCount}자 (필요: 4000자)`, weight: 2 });

  // 4. 문단 수 (호흡)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  results.push({ category: 'style', name: '문단 구성', passed: paragraphs.length >= 20, details: `${paragraphs.length}개 (필요: 20개)`, weight: 1 });

  // 5. 한자/무협 용어
  const martialTerms = ['내공', '검기', '장풍', '기혈', '경맥', '단전', '초식', '무공', '진기', '살기', '혈도', '공력'];
  const martialCount = martialTerms.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'style', name: '무협 용어', passed: martialCount >= 3, details: `${martialCount}회 (필요: 3회)`, weight: 1 });

  // 6. 비유 표현
  const figurative = ['마치', '처럼', '듯', '같았다', '같은'];
  const figCount = figurative.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'style', name: '비유 표현', passed: figCount >= 3, details: `${figCount}회 (필요: 3회)`, weight: 1 });

  // 7. 대사 비율 (20~40%)
  const dialogueMatch = text.match(/"[^"]*"/g) || [];
  const dialogueChars = dialogueMatch.reduce((c, m) => c + m.length, 0);
  const dialogueRatio = text.length > 0 ? dialogueChars / text.length : 0;
  results.push({ category: 'style', name: '대사 비율', passed: dialogueRatio >= 0.1 && dialogueRatio <= 0.5, details: `${(dialogueRatio * 100).toFixed(1)}% (적정: 10~50%)`, weight: 1 });

  // 8. 액션 묘사
  const actionWords = ['제압', '날렸다', '부딪', '날아갔', '으스러', '부서', '터졌', '가격', '베었', '찔렀'];
  const actionCount = actionWords.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'style', name: '액션 묘사', passed: actionCount >= 3, details: `${actionCount}회 (필요: 3회)`, weight: 1 });

  // 9. 감정 묘사
  const emotionWords = ['공포', '경악', '분노', '냉정', '차가운', '얼어붙', '떨렸', '식은땀', '긴장'];
  const emotionCount = emotionWords.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'style', name: '감정 묘사', passed: emotionCount >= 3, details: `${emotionCount}회 (필요: 3회)`, weight: 1 });

  // 10. 금지 문구 없음
  results.push({ category: 'style', name: '금지 문구 없음', passed: forbiddenHits.length === 0, details: forbiddenHits.length === 0 ? '이상 없음' : `발견: ${forbiddenHits.join(', ')}`, weight: 3 });

  // ── 극적 구성 카테고리 (5개) ──
  // 11. 갈등 요소
  const conflictWords = ['적', '장로', '반대', '저항', '도전', '대립', '충돌', '거부'];
  const conflictCount = conflictWords.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'dramatic', name: '갈등 요소', passed: conflictCount >= 3, details: `${conflictCount}회 (필요: 3회)`, weight: 2 });

  // 12. 긴장감
  const tensionWords = ['긴장', '공포', '압박', '위기', '떨', '식은땀', '심장', '숨을'];
  const tensionCount = tensionWords.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'dramatic', name: '긴장감', passed: tensionCount >= 2, details: `${tensionCount}회 (필요: 2회)`, weight: 2 });

  // 13. 사이다 전개
  const catharsis = ['일격', '단번', '순식간', '압도', '무력', '통쾌', '한 수'];
  const catharsisCount = catharsis.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'dramatic', name: '사이다 전개', passed: catharsisCount >= 1, details: `${catharsisCount}회 (필요: 1회)`, weight: 2 });

  // 14. 클리프행어
  const lastLines = text.trim().split('\n').slice(-5).join('\n');
  const cliffKeywords = ['시작', '순간', '이제', '그때', '하지만', '그러나', '과연', '?', '…', '...'];
  const hasCliff = cliffKeywords.some(k => lastLines.includes(k));
  results.push({ category: 'dramatic', name: '클리프행어', passed: hasCliff, details: hasCliff ? '존재' : '약함 - 마지막 문장 강화 필요', weight: 3 });

  // 15. 분위기 묘사
  const moodWords = ['분위기', '공기', '기운', '살기', '압박감', '적막', '어둠', '바람'];
  const moodCount = moodWords.reduce((c, w) => c + (text.split(w).length - 1), 0);
  results.push({ category: 'dramatic', name: '분위기 묘사', passed: moodCount >= 2, details: `${moodCount}회 (필요: 2회)`, weight: 1 });

  // ── 점수 합산 ──
  let score = 0;
  let maxScore = 0;
  for (const r of results) {
    maxScore += r.weight;
    if (r.passed) score += r.weight;
    if (!r.passed) warnings.push(`${r.name}: ${r.details}`);
  }

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const grade = percentage >= 90 ? 'S' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : 'D';

  return { score, maxScore, percentage, grade, results, warnings, forbiddenHits };
}

export async function POST(req: NextRequest) {
  try {
    const body: QualityCheckRequest = await req.json();

    // ── 유효성 검사 ──
    if (!body.content || body.content.length < 100) {
      return NextResponse.json({
        success: false,
        message: '검수할 본문이 없거나 너무 짧습니다. (최소 100자)',
      }, { status: 400 });
    }

    // ── [1단계] 자동 텍스트 분석 (legacy 품질 게이트) ──
    const autoGate = runAutoQualityGate(body.content, body.episodeNumber);
    console.log(`📊 제${body.episodeNumber}화 자동 분석: ${autoGate.score}/${autoGate.maxScore} (${autoGate.grade})`);

    // ── AI API Key 확인 ──
    const openaiKey = process.env.OPENAI_API_KEY;
    const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!openaiKey && !claudeKey && !geminiKey) {
      // AI 없어도 자동 분석 결과만 반환
      return NextResponse.json({
        success: true,
        report: {
          items: defaultItems(),
          totalScore: 0,
          overallComment: 'AI API Key가 없어 자동 텍스트 분석만 수행했습니다.',
          bestPart: '',
          worstPart: '',
        },
        autoGate,
      });
    }

    // ── [2단계] AI 검수 ──
    const prompt = buildQualityCheckPrompt(body);
    console.log(`🔍 제${body.episodeNumber}화 AI 검수 시작`);

    let rawResult = '';
    const maxTokens = 3000;

    if (openaiKey) {
      rawResult = await callOpenAI(openaiKey, prompt, maxTokens);
    } else if (claudeKey) {
      rawResult = await callClaude(claudeKey, prompt, maxTokens);
    } else if (geminiKey) {
      rawResult = await callGemini(geminiKey, prompt, maxTokens);
    }

    if (!rawResult) {
      throw new Error('AI가 검수 결과를 생성하지 못했습니다.');
    }

    // ── 결과 파싱 ──
    const report = parseQualityReport(rawResult);
    console.log(`✅ 제${body.episodeNumber}화 검수 완료 (AI: ${report.totalScore}/60, 자동: ${autoGate.grade})`);

    return NextResponse.json({
      success: true,
      report,
      autoGate,   // 자동 텍스트 분석 결과도 함께 반환
      raw: rawResult,
    });

  } catch (error: any) {
    console.error('❌ 품질 검수 오류:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '품질 검수 실패',
    }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 프롬프트 빌더
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildQualityCheckPrompt(body: QualityCheckRequest): string {
  const charCount = body.content.replace(/\s+/g, '').length;

  let characterInfo = '';
  if (body.characters && body.characters.length > 0) {
    characterInfo = body.characters.map((c: any) => {
      if (typeof c === 'string') return `- ${c}`;
      return `- ${c.name}${c.speech_style ? ` (말투: ${c.speech_style})` : ''}${c.personality ? ` (성격: ${c.personality})` : ''}`;
    }).join('\n');
  }

  return `당신은 웹소설 품질 검수 전문가입니다. 아래 소설 본문을 6가지 기준으로 엄격하게 검수하세요.

## 검수 대상
- 화수: 제${body.episodeNumber}화 "${body.episodeTitle || '무제'}"
- 분량: ${charCount}자

## 소설 본문
${body.content.slice(0, 8000)}

${body.blueprint ? `## 원본 설계도 (비교 기준)
${body.blueprint.slice(0, 3000)}
` : ''}
${characterInfo ? `## 등장 캐릭터 설정
${characterInfo}
` : ''}

## 검수 기준 (각 항목 1~10점)

### 1. 경영 고증 (Business Accuracy)
- 경영학 메타포가 자연스럽게 녹아있는가
- M&A, ROI, 리스크 등 비유가 정확한가
- 현대 용어가 직접 노출되지 않고 내면 독백에서 적절히 사용되는가

### 2. 개연성 (Plausibility)
- 인과관계가 자연스러운가
- 급전개나 데우스 엑스 마키나가 없는가
- 인물의 행동이 동기에 부합하는가

### 3. 설정 충돌 (World Consistency)
- 무림 세계관에 맞는 용어/문화를 사용하는가
- 이전 설정과 모순되는 내용은 없는가
- 시대에 맞지 않는 현대적 요소가 없는가

### 4. 캐릭터 일관성 (Character Consistency)
- 각 캐릭터의 고유 말투가 유지되는가
- 성격과 행동이 일관되는가
- 이준혁(냉철/존댓말)/천마(오만/하오체) 페르소나가 명확한가

### 5. 문체 품질 (Writing Style)
- 화산귀환 스타일의 간결하고 비장한 문체인가
- "~했다" 반복, 설명 과잉 등의 문제가 없는가
- 장면 전환, 호흡 조절이 적절한가
- 분량이 적정한가 (목표: 6,000~8,000자)

### 6. 절단신공 (Cliffhanger)
- 마지막이 다음 화를 읽고 싶게 만드는가
- 긴장감 유지 또는 궁금증 유발이 효과적인가

## 출력 형식 (반드시 이 JSON 형식을 따르세요)
\`\`\`json
{
  "items": [
    {
      "category": "경영 고증",
      "score": 8,
      "grade": "A",
      "issues": ["문제점1", "문제점2"],
      "suggestions": ["개선 제안1", "개선 제안2"]
    },
    {
      "category": "개연성",
      "score": 7,
      "grade": "B",
      "issues": [],
      "suggestions": []
    },
    {
      "category": "설정 충돌",
      "score": 9,
      "grade": "A+",
      "issues": [],
      "suggestions": []
    },
    {
      "category": "캐릭터 일관성",
      "score": 8,
      "grade": "A",
      "issues": [],
      "suggestions": []
    },
    {
      "category": "문체 품질",
      "score": 7,
      "grade": "B",
      "issues": [],
      "suggestions": []
    },
    {
      "category": "절단신공",
      "score": 6,
      "grade": "C",
      "issues": [],
      "suggestions": []
    }
  ],
  "overallComment": "전반적 평가 2~3문장",
  "bestPart": "가장 잘된 부분 1문장",
  "worstPart": "가장 개선이 필요한 부분 1문장"
}
\`\`\`

점수 기준: 9~10=A+, 8=A, 7=B, 5~6=C, 1~4=D
반드시 위 JSON 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 결과 파서
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface QualityItem {
  category: string;
  score: number;
  grade: string;
  issues: string[];
  suggestions: string[];
}

interface QualityReport {
  items: QualityItem[];
  totalScore: number;
  overallComment: string;
  bestPart: string;
  worstPart: string;
}

function parseQualityReport(raw: string): QualityReport {
  // JSON 블록 추출
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // 파싱 실패 시 기본 리포트 반환
    return {
      items: defaultItems(),
      totalScore: 0,
      overallComment: raw.slice(0, 200),
      bestPart: '',
      worstPart: '',
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const items: QualityItem[] = (parsed.items || []).map((item: any) => ({
      category: String(item.category || ''),
      score: Math.min(10, Math.max(0, Number(item.score) || 0)),
      grade: String(item.grade || ''),
      issues: Array.isArray(item.issues) ? item.issues.map(String) : [],
      suggestions: Array.isArray(item.suggestions) ? item.suggestions.map(String) : [],
    }));

    const totalScore = items.reduce((sum, i) => sum + i.score, 0);

    return {
      items: items.length > 0 ? items : defaultItems(),
      totalScore,
      overallComment: String(parsed.overallComment || ''),
      bestPart: String(parsed.bestPart || ''),
      worstPart: String(parsed.worstPart || ''),
    };
  } catch {
    return {
      items: defaultItems(),
      totalScore: 0,
      overallComment: 'JSON 파싱 실패. AI 원문을 확인하세요.',
      bestPart: '',
      worstPart: '',
    };
  }
}

function defaultItems(): QualityItem[] {
  return [
    { category: '경영 고증', score: 0, grade: '-', issues: [], suggestions: [] },
    { category: '개연성', score: 0, grade: '-', issues: [], suggestions: [] },
    { category: '설정 충돌', score: 0, grade: '-', issues: [], suggestions: [] },
    { category: '캐릭터 일관성', score: 0, grade: '-', issues: [], suggestions: [] },
    { category: '문체 품질', score: 0, grade: '-', issues: [], suggestions: [] },
    { category: '절단신공', score: 0, grade: '-', issues: [], suggestions: [] },
  ];
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
      temperature: 0.3, // 검수는 정확성이 중요하므로 낮은 온도
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: '당신은 웹소설 품질 검수 전문가입니다. 반드시 JSON 형식으로만 응답하세요.' },
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
      temperature: 0.3,
      system: '당신은 웹소설 품질 검수 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
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
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini 호출 실패 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => String(p?.text || '')).join('') : '';
}
