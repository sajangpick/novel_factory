import { NextRequest, NextResponse } from 'next/server';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [AI 빨간펜 API v2] — Supabase 기반 스마트 검색 + 정합성 검토
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * [변경 전] 로컬 파일 → 키워드 ±15줄 조각 → Claude
 * [변경 후] Supabase DB → 키워드 매칭 섹션 통째로 + 핵심 섹션 항상 포함 → Claude
 * 
 * action: 'review'   → 에피소드 전체 스캔
 * action: 'fix'      → 특정 이슈 AI 재작성
 * action: 'instruct' → 사용자 지시 처리 (대화형)
 */

// ── Supabase 클라이언트 ──
async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수 미설정');
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}

// ── 행번호 붙이기 ──
function addLineNumbers(text: string): string {
  return text.split('\n').map((line, i) => `${String(i + 1).padStart(4)}|${line}`).join('\n');
}

// ── Claude API 호출 ──
async function callClaude(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API 오류 (${res.status}): ${errText}`);
  }

  const data: any = await res.json();
  return Array.isArray(data?.content)
    ? data.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('')
    : '';
}

// ── JSON 파싱 헬퍼 (코드블록 제거 + 안전 파싱) ──
function safeParseJson(raw: string): any {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* 파싱 실패 */ }
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 실제 에피소드 현황 조회 (DB 기준 — 마스터 파일보다 정확)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function getEpisodeStatus(): Promise<string> {
  try {
    const supabase = await getSupabase();
    const seriesId = process.env.SERIES_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const { data } = await supabase
      .from('episodes')
      .select('episode_number, word_count, status')
      .eq('series_id', seriesId)
      .order('episode_number', { ascending: true });

    if (!data || data.length === 0) return '';
    const nums = data.map((e: any) => e.episode_number);
    const latest = Math.max(...nums);
    return `⚠️ DB 실제 현황: 제${nums.join(', ')}화가 존재합니다. 최신 화수는 제${latest}화입니다.`;
  } catch { return ''; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 이전 에피소드 가져오기 (episodes 테이블에서 직접 읽기 — 비용 0원)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchPreviousEpisodes(episodeNumber: number, count: number = 1): Promise<string> {
  if (episodeNumber <= 1) return '';
  const supabase = await getSupabase();
  const seriesId = process.env.SERIES_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const startEp = Math.max(1, episodeNumber - count);
  const { data } = await supabase
    .from('episodes')
    .select('episode_number, manuscript')
    .eq('series_id', seriesId)
    .gte('episode_number', startEp)
    .lt('episode_number', episodeNumber)
    .order('episode_number', { ascending: true });

  if (!data || data.length === 0) return '';

  return data.map((ep: any) => {
    const text = ep.manuscript || '';
    // 토큰 절약: 직전 1화는 전문, 그 이전은 앞부분 2000자만
    const isDirectlyPrev = ep.episode_number === episodeNumber - 1;
    const content = isDirectlyPrev ? text : text.slice(0, 2000) + (text.length > 2000 ? '\n...(이하 생략)' : '');
    return `### 제${ep.episode_number}화\n${content}`;
  }).join('\n\n---\n\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supabase 스마트 검색 — 핵심 섹션 항상 포함 + 키워드 매칭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function smartSearch(keywords: string[]): Promise<string> {
  const supabase = await getSupabase();

  // 1단계: priority=1(핵심) 섹션은 무조건 가져오기
  //   바이블, 규칙, 마스터 + 무공시스템, 전투안무 (핵심 world_db)
  const { data: criticalSections } = await supabase
    .from('reference_doc_sections')
    .select('doc_key, section_title, content, priority')
    .eq('priority', 1)
    .in('doc_key', ['file_index', 'bible', 'rules_core', 'master', 'engine_3persona', 'engine_emotion', 'engine_giryu', 'style_guide', 'char_main', 'martial_system', 'martial_protagonist', 'combat_guide']);

  // 2단계: 키워드로 섹션 검색 (content에 키워드 포함)
  //   특히 characters(인명록)에서 관련 캐릭터 찾기
  const keywordSections: any[] = [];
  const validKeywords = keywords.filter(k => k && k.length >= 2);

  if (validKeywords.length > 0) {
    // 각 키워드로 OR 검색 — keywords 배열에 포함되거나 content에 포함
    for (const kw of validKeywords.slice(0, 15)) {
      const { data } = await supabase
        .from('reference_doc_sections')
        .select('doc_key, section_title, content, priority')
        .or(`section_title.ilike.%${kw}%,content.ilike.%${kw}%`)
        .limit(5);

      if (data) {
        for (const row of data) {
          if (!keywordSections.find(s => s.section_title === row.section_title && s.doc_key === row.doc_key)) {
            keywordSections.push(row);
          }
        }
      }
    }
  }

  // 3단계: 핵심 + 키워드 결과 합치기 (중복 제거)
  const allSections = [...(criticalSections || [])];
  for (const ks of keywordSections) {
    if (!allSections.find(s => s.section_title === ks.section_title && s.doc_key === ks.doc_key)) {
      allSections.push(ks);
    }
  }

  // 4단계: 문서별로 그룹화해서 포맷팅
  const grouped: Record<string, string[]> = {};
  const docNames: Record<string, string> = {
    // 마스터 색인
    file_index: '📚 파일 색인 (전체 지도)',
    // A. 지휘부
    bible: '스토리 바이블',
    rules_core: '집필 규칙 핵심',
    master: '소설 진행 마스터',
    // B. 집필 엔진
    engine_3persona: '3인격 엔진',
    engine_emotion: '이준혁 감정 엔진',
    engine_giryu: '기류감응 가이드',
    // C. 스토리 설계도
    story_arc: '스토리 아크 상세',
    tournament_setting: '무림대회 설정',
    // D. 인물
    char_main: '캐릭터 주인공',
    char_support: '캐릭터 조연·세력',
    char_tournament: '캐릭터 무림대회',
    char_system: '캐릭터 시스템',
    // E. 무공/전투
    martial_system: '무공 시스템',
    martial_protagonist: '주인공 무공 상세',
    combat_guide: '전투 안무 가이드',
    // F. 조직/세력
    org_chunhwa: '천화련 조직·사업',
    org_ansi: '안씨표국·안가',
    power_map: '세력도',
    // G. 경제
    economy: '경제 시스템',
    business_terms: '경영 용어집',
    // H. 세계관
    geo_travel: '지리·이동 DB',
    food_db: '음식 DB',
    food_biz: '사업 음식기술',
    architecture: '건축·객실 DB',
    weapons: '무기·병기 DB',
    clothing: '의복·복식 DB',
    inns: '지역별 객잔 DB',
    modern_knowledge: '이준혁 현대지식 DB',
    wuxia_terms: '무협 용어집',
    // B. 집필 엔진 (추가)
    style_guide: '문체 가이드',
    // E. 무공전투 (추가)
    martial_dictionary: '무공 기법 대전',
    // I. 전략/방향
    theme: '테마·주제의식',
    competitive: '경쟁작 차별화',
    reader_target: '독자 타겟 분석',
  };

  for (const sec of allSections) {
    const key = sec.doc_key;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(`### ${sec.section_title}\n${sec.content}`);
  }

  const parts: string[] = [];

  // DB 기준 에피소드 현황 (마스터 파일보다 정확)
  const epStatus = await getEpisodeStatus();
  if (epStatus) parts.push(`## 📊 에피소드 현황 (DB 실측)\n${epStatus}`);

  for (const [key, sections] of Object.entries(grouped)) {
    parts.push(`## 📖 ${docNames[key] || key}\n\n${sections.join('\n\n---\n\n')}`);
  }

  return parts.join('\n\n━━━━━━━━━━━━━━━━━━━━\n\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 키워드 추출 (Claude AI)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function extractKeywords(apiKey: string, episodeContent: string): Promise<string[]> {
  const prompt = `다음 소설 에피소드에서 고유명사와 핵심 설정어를 전부 추출하세요.
인물, 문파/조직, 무공/심법, 장소, 전수/교육, 사업/물품, 핵심 행동(전수, 전달, 판매, 가르치다 등).
**JSON 배열로만 응답. 설명 없이.**
예: ["위소운","안세진","귀원검법","전수","개봉","청원심법"]

본문:
${episodeContent.slice(0, 8000)}`;

  const raw = await callClaude(apiKey, '고유명사+핵심설정어 추출기. JSON 배열로만 응답.', prompt, 1000);
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      return Array.isArray(arr) ? arr.filter((s: any) => typeof s === 'string' && s.length >= 2) : [];
    }
  } catch { /* 파싱 실패 */ }
  return [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI 리뷰 — 빨간펜 검토
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function reviewEpisode(
  apiKey: string,
  episodeNumber: number,
  episodeContent: string,
  referenceContext: string,
): Promise<any> {
  const numberedText = addLineNumbers(episodeContent);

  const prompt = `제${episodeNumber}화를 참고자료와 대조하여 **빨간펜**으로 교정하세요.

━━ 참고자료 (이것이 정답 — 바이블+규칙+인명록+진행상황) ━━
${referenceContext}

━━ 제${episodeNumber}화 본문 (행번호 포함) ━━
${numberedText}

━━ 반드시 잡아야 할 검토 항목 (중요도순) ━━
1. **무공 전수 정책 위반**: 바이블에 정의된 전수 범위(몇 층까지, 몇 초식까지)를 초과하거나, "책/비급"으로 전달하면 error. 위소운이 "직접 가르쳐야" 하는 것을 물건으로 넘기면 error. 전수 정책과 방식을 반드시 대조하라.
2. **설정 불일치**: 인물 정보, 무공명, 무공 단계, 조직 구조, 장소, 금고/보물 설정이 바이블/인명록과 다르면 error.
3. **캐릭터 말투 위반**: 위소운이 비즈니스 용어(파트너십, 인프라, 마케팅 등)를 쓰면 error. 이준혁의 내면 독백에서만 현대어 허용.
4. **캐릭터 말투 패턴**: 이준혁=존댓말, 천마=반말(짧고 건방), 위소운=평어. 규칙 위반 시 error.
5. **영문/현대어**: 본문에 영어 알파벳(M&A, CEO 등)이 있으면 무조건 error. 무협 세계에 영어는 없다.
6. **스토리 로직 위반**: 바이블의 플롯, 감정 아크, 캐릭터 목표와 충돌하면 error. 예: 아직 만나지 않은 인물을 만남, 비밀이 너무 일찍 밝혀짐 등.
7. **이전 화와 모순**: 이전 화 본문이 참고자료에 포함되어 있다면, 이전 화에서 일어난 일과 현재 화가 모순되는지 확인. 인물의 위치, 상태, 관계 변화가 연속적인지 검토.
8. **바이블에 없는 설정**: 바이블에 정의 안 된 새 설정/인물이 나오면 warning.
9. **표현 개선**: 문체·표현이 더 나아질 수 있으면 info.

**반드시 아래 JSON으로만 응답:**
{
  "issues": [
    {
      "id": 1,
      "severity": "error",
      "category": "무공 전수 정책 위반",
      "lineNumber": 448,
      "location": "해당 줄의 문제 부분을 정확히 인용 (20~60자)",
      "problem": "무엇이 잘못되었는지",
      "reference": "참고자료 기준 올바른 내용",
      "suggestion": "수정 제안 텍스트"
    }
  ]
}

severity: "error"=반드시 수정, "warning"=검토 필요, "info"=선택적 개선
lineNumber: 본문에 붙인 행번호를 정확히 사용하세요.`;

  const raw = await callClaude(
    apiKey,
    '무협 웹소설 전문 교정 편집자. 참고자료(바이블/규칙/인명록)를 기준으로 본문의 오류를 빨간펜으로 잡는다. 특히 무공 전수 정책, 설정 일관성, 캐릭터 말투를 중점 검토. JSON으로만 응답.',
    prompt,
    4000
  );

  const parsed = safeParseJson(raw);
  if (parsed) return parsed;
  return { issues: [], rawResponse: raw.slice(0, 500) };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 수정 요청 — 특정 이슈를 AI가 재작성
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fixIssue(
  apiKey: string,
  episodeContent: string,
  issue: { lineNumber: number; location: string; problem: string; reference: string; suggestion: string }
): Promise<{ lineNumber: number; originalLine: string; fixedLine: string }> {
  const lines = episodeContent.split('\n');
  const targetLine = lines[issue.lineNumber - 1] || '';

  const prompt = `소설 본문의 ${issue.lineNumber}행을 수정해야 합니다.

**원문 (${issue.lineNumber}행):**
${targetLine}

**문제:** ${issue.problem}
**참고자료 기준:** ${issue.reference}
**수정 방향:** ${issue.suggestion}

**주변 맥락:**
${lines.slice(Math.max(0, issue.lineNumber - 6), issue.lineNumber + 4).join('\n')}

위 ${issue.lineNumber}행을 자연스럽게 수정한 결과 한 줄만 반환하세요.
따옴표나 설명 없이 수정된 줄만 출력하세요.`;

  const fixedLine = await callClaude(
    apiKey,
    '소설 편집자. 지정된 줄을 자연스럽게 수정한다. 수정된 줄만 출력.',
    prompt,
    500
  );

  return {
    lineNumber: issue.lineNumber,
    originalLine: targetLine,
    fixedLine: fixedLine.trim(),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 사용자 지시 처리 — 대화형 교정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function processInstruction(
  apiKey: string,
  instruction: string,
  episodeNumber: number,
  episodeContent: string,
): Promise<any> {
  const numberedText = addLineNumbers(episodeContent);

  // 지시문에서 키워드 추출 (한글 2글자 이상 + 영문 용어)
  const instrKeywords = [
    ...(instruction.match(/[가-힣]{2,}/g) || []),
    ...(instruction.match(/[A-Za-z&]{2,}/g) || []),
  ];

  // Supabase에서 스마트 검색 + 이전 화 참조
  const [referenceContext, prevEpisodes] = await Promise.all([
    smartSearch(instrKeywords),
    fetchPreviousEpisodes(episodeNumber, 2),
  ]);

  const prompt = `당신은 무협 웹소설 편집자입니다. 사용자가 제${episodeNumber}화에 대해 지시를 내렸습니다.

━━ 사용자 지시 ━━
${instruction}

━━ 참고자료 (바이블+규칙+인명록+진행상황) ━━
${referenceContext}
${prevEpisodes ? `\n\n━━ 이전 화 본문 (연속성 참조용) ━━\n${prevEpisodes}` : ''}

━━ 제${episodeNumber}화 본문 (행번호 포함) ━━
${numberedText}

사용자의 지시에 따라 **참고자료를 기준으로** 분석하세요.
문제가 있으면 이슈 목록으로, 없으면 message만 반환하세요.
참고자료에서 근거를 찾아 reference 필드에 반드시 인용하세요.

**JSON으로만 응답:**
{
  "message": "분석 결과 요약 (1~2문장)",
  "issues": [
    {
      "id": 1,
      "severity": "error",
      "category": "카테고리",
      "lineNumber": 행번호,
      "location": "문제 부분 인용",
      "problem": "문제 설명",
      "reference": "참고자료에서 찾은 근거를 구체적으로 인용",
      "suggestion": "수정 제안"
    }
  ]
}

issues가 없으면 빈 배열 [].`;

  const raw = await callClaude(
    apiKey,
    '무협 웹소설 편집자. 사용자 지시에 따라 참고자료를 근거로 본문을 분석하고 교정한다. JSON으로만 응답.',
    prompt,
    3000
  );

  const parsed = safeParseJson(raw);
  if (parsed) return parsed;
  return { message: raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').slice(0, 500), issues: [] };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST 핸들러
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    if (!claudeKey) {
      return NextResponse.json({ error: 'CLAUDE_API_KEY 미설정' }, { status: 500 });
    }

    // ── 전체 스캔 ──
    if (action === 'review') {
      const { episodeNumber, episodeContent } = body;
      if (!episodeContent) {
        return NextResponse.json({ error: '에피소드 본문이 필요합니다.' }, { status: 400 });
      }

      // 키워드 추출 → Supabase 스마트 검색 + 이전 화 → AI 리뷰
      const keywords = await extractKeywords(claudeKey, episodeContent);
      const [referenceContext, prevEpisodes] = await Promise.all([
        smartSearch(keywords),
        fetchPreviousEpisodes(episodeNumber || 0, 2),
      ]);
      const fullContext = prevEpisodes
        ? referenceContext + `\n\n━━ 이전 화 본문 (연속성 참조용) ━━\n${prevEpisodes}`
        : referenceContext;
      const review = await reviewEpisode(claudeKey, episodeNumber || 0, episodeContent, fullContext);

      return NextResponse.json({ success: true, keywords, review });
    }

    // ── 수정 요청 ──
    if (action === 'fix') {
      const { episodeContent, issue } = body;
      if (!episodeContent || !issue) {
        return NextResponse.json({ error: '본문과 이슈가 필요합니다.' }, { status: 400 });
      }
      const result = await fixIssue(claudeKey, episodeContent, issue);
      return NextResponse.json({ success: true, ...result });
    }

    // ── 사용자 지시 ──
    if (action === 'instruct') {
      const { instruction, episodeNumber, episodeContent } = body;
      if (!instruction || !episodeContent) {
        return NextResponse.json({ error: '지시와 본문이 필요합니다.' }, { status: 400 });
      }
      const result = await processInstruction(claudeKey, instruction, episodeNumber || 0, episodeContent);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });

  } catch (err: any) {
    console.error('[AI 빨간펜 오류]', err);
    return NextResponse.json(
      { error: err?.message || 'AI 빨간펜 오류', details: String(err) },
      { status: 500 }
    );
  }
}
