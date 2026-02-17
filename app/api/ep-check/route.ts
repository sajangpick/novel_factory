import { NextRequest, NextResponse } from 'next/server';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [EP 규칙 검사 API - AI 작가 파이프라인 Step D]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 생성된 소설 본문을 Gemini Flash로 EP규칙 준수 여부 검사
 * 
 * 검사 항목:
 *   EP-001: 몸 소유권 (이준혁/천마가 물리적 행동)
 *   EP-002: 천마 말투 (반말 위반, "시" 존경접미사)
 *   EP-003: 서기(AD) 연도 사용
 *   EP-005: 본문에서 화수 직접 언급
 *   EP-009: 초절정 고수가 하수에게 긴장
 *   EP-010: 전투 중 3인격 수다
 *   EP-014: 마인/사파가 존댓말
 *   + 금지어 체크 (현대어, 상태창 등)
 *   + "시끄러" 과다 사용
 *   + 독백 표기 체크 (소괄호)
 *   + 코미디 비트 수 체크
 * 
 * 비용: ~$0.01 (Gemini Flash)
 * 
 * 사용법: POST /api/ep-check
 * Body: { episodeNumber, content }
 */

// ── 로컬 검사: AI 없이 코드로 체크 가능한 규칙들 ──
function localCheck(content: string, episodeNumber: number) {
  const results: Array<{
    rule: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    details?: string[];
  }> = [];

  // ── 금지어 검사 ──
  const forbiddenWords = [
    { word: '띠링', category: '상태창/시스템' },
    { word: '조건이 충족되었습니다', category: '상태창/시스템' },
    { word: '상태창', category: '상태창/시스템' },
    { word: '아메리카노', category: '현대어' },
    { word: '오케이', category: '현대어' },
    { word: '팩트 체크', category: '현대어' },
    { word: '스마트폰', category: '현대어' },
    { word: '인터넷', category: '현대어' },
    { word: '컴퓨터', category: '현대어' },
  ];

  // 초반 에피소드 추가 금지어 (30화 이전)
  if (episodeNumber <= 30) {
    forbiddenWords.push(
      { word: '술', category: '초반금지(30화전)' },
      { word: '주점', category: '초반금지(30화전)' },
      { word: '소흥주', category: '초반금지(30화전)' },
      { word: '백주', category: '초반금지(30화전)' },
    );
  }

  const foundForbidden = forbiddenWords.filter(fw => content.includes(fw.word));
  if (foundForbidden.length > 0) {
    results.push({
      rule: '금지어',
      status: 'fail',
      message: `금지어 ${foundForbidden.length}개 발견`,
      details: foundForbidden.map(fw => `"${fw.word}" (${fw.category})`),
    });
  } else {
    results.push({ rule: '금지어', status: 'pass', message: '금지어 없음' });
  }

  // ── "시끄러" 사용 횟수 ──
  const silenceCount = (content.match(/시끄러/g) || []).length;
  if (silenceCount > 1) {
    results.push({
      rule: 'EP-002 "시끄러" 과다',
      status: 'warn',
      message: `"시끄러" ${silenceCount}회 사용 (1회 이하 권장)`,
    });
  } else {
    results.push({ rule: '"시끄러" 사용', status: 'pass', message: `${silenceCount}회 (적정)` });
  }

  // ── "나쁘지 않" 사용 횟수 ──
  const notBadCount = (content.match(/나쁘지 않/g) || []).length;
  if (notBadCount > 1) {
    results.push({
      rule: 'EP-002 "나쁘지 않" 과다',
      status: 'warn',
      message: `"나쁘지 않" ${notBadCount}회 사용 (1회 이하 권장)`,
    });
  } else {
    results.push({ rule: '"나쁘지 않" 사용', status: 'pass', message: `${notBadCount}회 (적정)` });
  }

  // ── EP-003: 서기 연도 체크 ──
  const yearPattern = /\d{3,4}년/g;
  const yearMatches = content.match(yearPattern) || [];
  // "제13화" 같은 화수는 제외
  const realYears = yearMatches.filter(m => !m.startsWith('제'));
  if (realYears.length > 0) {
    results.push({
      rule: 'EP-003 서기 연도',
      status: 'fail',
      message: `서기 연도 표현 발견`,
      details: realYears,
    });
  } else {
    results.push({ rule: 'EP-003 서기 연도', status: 'pass', message: '연도 표현 없음' });
  }

  // ── EP-005: 화수 직접 언급 ──
  const epMentionPattern = /\d+화에서|\d+화 전에|지난 화에서/g;
  const epMentions = content.match(epMentionPattern) || [];
  if (epMentions.length > 0) {
    results.push({
      rule: 'EP-005 화수 언급',
      status: 'fail',
      message: `본문에서 화수 직접 언급`,
      details: epMentions,
    });
  } else {
    results.push({ rule: 'EP-005 화수 언급', status: 'pass', message: '화수 언급 없음' });
  }

  // ── 느낌표(!) 남발 체크 ──
  const exclamationCount = (content.match(/!/g) || []).length;
  if (exclamationCount > 10) {
    results.push({
      rule: '느낌표 남발',
      status: 'warn',
      message: `느낌표 ${exclamationCount}회 (10회 이하 권장)`,
    });
  } else {
    results.push({ rule: '느낌표 사용', status: 'pass', message: `${exclamationCount}회 (적정)` });
  }

  // ── 분량 체크 ──
  const charCount = content.replace(/\s+/g, '').length;
  if (charCount < 5000) {
    results.push({
      rule: '분량',
      status: 'warn',
      message: `${charCount}자 (목표: 6,000~8,000자)`,
    });
  } else if (charCount > 10000) {
    results.push({
      rule: '분량',
      status: 'warn',
      message: `${charCount}자 (너무 긺, 8,000자 이내 권장)`,
    });
  } else {
    results.push({ rule: '분량', status: 'pass', message: `${charCount}자 (적정)` });
  }

  // ── ~했다 반복 체크 ──
  const hedaCount = (content.match(/했다[.\n]/g) || []).length;
  const totalSentences = (content.match(/[.!?]\s/g) || []).length || 1;
  const hedaRatio = hedaCount / totalSentences;
  if (hedaRatio > 0.3) {
    results.push({
      rule: '"~했다" 반복',
      status: 'warn',
      message: `"~했다" 종결 비율 ${Math.round(hedaRatio * 100)}% (30% 이하 권장)`,
    });
  } else {
    results.push({ rule: '"~했다" 반복', status: 'pass', message: `${Math.round(hedaRatio * 100)}% (적정)` });
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const { episodeNumber, content } = await req.json();

    if (!content || content.length < 500) {
      return NextResponse.json({
        success: false,
        message: '검사할 본문이 필요합니다. (최소 500자)',
      }, { status: 400 });
    }

    console.log(`🔍 제${episodeNumber}화 EP 규칙 검사 시작`);

    // ── 1단계: 로컬 검사 (AI 없이, $0) ──
    const localResults = localCheck(content, episodeNumber);

    // ── 2단계: AI 검사 (Gemini Flash, ~$0.01) ──
    const geminiKey = process.env.GEMINI_API_KEY;
    let aiResults: Array<{
      rule: string;
      status: 'pass' | 'warn' | 'fail';
      message: string;
      details?: string[];
    }> = [];
    let aiCost = 0;

    if (geminiKey) {
      try {
        const aiCheckResult = await runAiCheck(geminiKey, content, episodeNumber);
        aiResults = aiCheckResult.results;
        aiCost = aiCheckResult.cost;
      } catch (e: any) {
        console.warn('⚠️ AI 검사 실패 (로컬 검사만 사용):', e.message);
        aiResults = [{
          rule: 'AI 검사',
          status: 'warn',
          message: `AI 검사 실패: ${e.message} (로컬 검사만 적용됨)`,
        }];
      }
    } else {
      aiResults = [{
        rule: 'AI 검사',
        status: 'warn',
        message: 'GEMINI_API_KEY 없음 - 로컬 검사만 적용',
      }];
    }

    // ── 결과 합산 ──
    const allResults = [...localResults, ...aiResults];
    const failCount = allResults.filter(r => r.status === 'fail').length;
    const warnCount = allResults.filter(r => r.status === 'warn').length;
    const passCount = allResults.filter(r => r.status === 'pass').length;

    // 점수 계산 (100점 만점)
    const totalChecks = allResults.length;
    const score = Math.round(((passCount * 1 + warnCount * 0.5) / totalChecks) * 100);

    console.log(`✅ EP 검사 완료: ${score}점 (통과:${passCount} 경고:${warnCount} 실패:${failCount})`);

    return NextResponse.json({
      success: true,
      score,
      summary: {
        total: totalChecks,
        pass: passCount,
        warn: warnCount,
        fail: failCount,
      },
      results: allResults,
      costInfo: {
        model: 'gemini-3-flash-preview',
        estimatedCostUSD: Math.round(aiCost * 10000) / 10000,
      },
    });

  } catch (error: any) {
    console.error('❌ EP 검사 오류:', error);
    return NextResponse.json({
      success: false,
      message: 'EP 검사 실패: ' + error.message,
    }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI 기반 검사 (Gemini Flash)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function runAiCheck(
  apiKey: string,
  content: string,
  episodeNumber: number,
): Promise<{ results: any[]; cost: number }> {
  // 본문이 길면 핵심만 추출 (비용 절감)
  const trimmedContent = content.length > 8000
    ? content.slice(0, 3000) + '\n\n[...중략...]\n\n' + content.slice(-3000)
    : content;

  const prompt = `당신은 무협 웹소설 "내 머리속에 천마와 장사꾼이 산다"의 EP규칙 검수관입니다.
아래 소설 본문을 검사하고, JSON 배열로 결과를 출력하세요.

## 검사 항목 (각각 pass/warn/fail로 판정)

1. **EP-001 몸 소유권**: 이준혁이나 천마가 물리적 행동을 하는 묘사가 있는가?
   - 이준혁/천마는 머릿속 목소리만 가능. "만졌다/걸었다/일어섰다" 등 물리 동사 사용 = fail
   - "느꼈다/감각이 전해졌다" 등 감각 동사는 허용

2. **EP-002 천마 말투**: 천마 대사에 존댓말이나 "시" 존경접미사가 있는가?
   - 천마는 반말만 사용. "~하시오/~하겠소/~할 것이오/~보시오" = fail
   - "~해/~하라/~이다/~하네" = pass

3. **EP-009 초절정 vs 하수**: 위소운(초절정)이 일류 이하 상대에게 "등골 서늘/식은땀/긴장" 하는가?
   - 화경급 이상이나 감정 트리거(곽진)가 아닌 상대에게 긴장 = fail

4. **EP-010 전투 중 수다**: 전투 중 3인격 대화가 3줄 이상인가?
   - 전투 중 1~2줄 긴급 지시만 허용. 분석/설명은 전투 후에

5. **EP-014 마인 존댓말**: 마교/사파 캐릭터가 정파에게 존댓말하는가?
   - 마인이 "~습니다/~군요" = fail

6. **독백 표기**: 이준혁/천마의 내면 독백이 소괄호 ()로 표기되었는가?
   - 독백은 () 사용. 큰따옴표 ""는 대사용.
   - 독백이 ""로 되어있으면 warn

7. **코미디 비트**: 이 본문에 코미디 요소가 충분한가? (최소 5개 이상)
   - 3인격 갈등, 문화 충돌, 캐릭터 갭, 조연 리액션, 러닝개그

## 출력 형식 (JSON 배열만, 다른 텍스트 없이)
[
  {"rule": "EP-001 몸 소유권", "status": "pass|warn|fail", "message": "설명", "details": ["문제 문장1", "문제 문장2"]},
  ...
]

## 소설 본문 (제${episodeNumber}화)
${trimmedContent}

위 7개 항목을 검사하고 JSON 배열만 출력하세요.`;

  const model = 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,  // 검사이므로 낮은 온도 = 정확한 판정
        maxOutputTokens: 3000,
        responseMimeType: 'application/json',  // JSON 모드
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini 호출 실패 (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const rawText = Array.isArray(parts) ? parts.map((p: any) => String(p?.text || '')).join('') : '';

  // JSON 파싱
  let results: any[] = [];
  try {
    // 마크다운 코드 펜스 제거 후 파싱
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    results = JSON.parse(cleaned);
    if (!Array.isArray(results)) results = [results];
  } catch (e) {
    console.warn('⚠️ AI 검사 결과 파싱 실패:', rawText.slice(0, 200));
    results = [{
      rule: 'AI 검사 (파싱 실패)',
      status: 'warn',
      message: 'AI 응답을 파싱할 수 없습니다. 로컬 검사 결과만 참조하세요.',
    }];
  }

  // 비용 계산
  const estInputTokens = Math.ceil(prompt.length / 3);
  const estOutputTokens = Math.ceil(rawText.length / 3);
  const cost = ((estInputTokens * 0.10) + (estOutputTokens * 0.40)) / 1_000_000;

  return { results, cost };
}
