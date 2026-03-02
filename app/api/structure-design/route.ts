import { NextRequest, NextResponse } from 'next/server';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [구조 설계 API - AI 작가 파이프라인 Step B]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 설계도(blueprint)를 받아서 Claude Sonnet으로 구조를 생성:
 *   1. 6하원칙 (누가/언제/어디서/무엇을/왜/어떻게)
 *   2. 5막 구조 (도입~마무리 + 감정 리듬 + 비중)
 *   3. 핵심 장면 3개 (상황 + 대사 샘플)
 * 
 * 모델: Claude Sonnet (정확도 95%) → 폴백: Gemini Flash
 * 비용: ~$0.05 (Claude Sonnet) 또는 ~$0.01 (Gemini Flash 폴백)
 * 
 * 사용법: POST /api/structure-design
 * Body: { episodeNumber, episodeTitle, blueprint }
 */

export async function POST(req: NextRequest) {
  try {
    const { episodeNumber, episodeTitle, blueprint } = await req.json();

    // ── 유효성 검사 ──
    if (!blueprint || blueprint.length < 50) {
      return NextResponse.json({
        success: false,
        message: '설계도가 필요합니다. 최소 50자 이상이어야 합니다.',
      }, { status: 400 });
    }

    const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!claudeKey && !geminiKey) {
      return NextResponse.json({
        success: false,
        message: 'CLAUDE_API_KEY 또는 GEMINI_API_KEY가 필요합니다.',
      }, { status: 500 });
    }

    // ── 구조 설계 프롬프트 구성 ──
    const prompt = buildStructurePrompt(episodeNumber, episodeTitle, blueprint);

    // ── ★ Claude Sonnet 우선 → Gemini Flash 폴백 ──
    let structureText = '';
    let usedModel = '';
    let priceInput = 0;
    let priceOutput = 0;

    // ★ 1순위: Claude Sonnet → 실패 시 자동으로 Gemini Flash 폴백
    if (claudeKey) {
      try {
        console.log(`🏗️ 제${episodeNumber}화 구조 설계 시작 (Claude Sonnet)`);
        structureText = await callClaude(claudeKey, prompt, 4000);
        usedModel = 'claude-sonnet-4-6';
        priceInput = 3.00;
        priceOutput = 15.00;
      } catch (claudeErr: any) {
        console.warn(`⚠️ Claude 실패 (${claudeErr.message}) → Gemini Flash로 폴백`);
        // Claude 실패 시 Gemini로 자동 폴백
        if (geminiKey) {
          structureText = await callGemini(geminiKey, prompt, 4000);
          usedModel = 'gemini-3-pro-preview (Claude 폴백)';
          priceInput = 2.00;
          priceOutput = 12.00;
        } else {
          throw claudeErr;  // Gemini도 없으면 원래 에러 전달
        }
      }
    } else if (geminiKey) {
      console.log(`🏗️ 제${episodeNumber}화 구조 설계 시작 (Gemini 3 Pro)`);
      structureText = await callGemini(geminiKey, prompt, 4000);
      usedModel = 'gemini-3-pro-preview';
      priceInput = 2.00;
      priceOutput = 12.00;
    }

    if (!structureText || structureText.length < 200) {
      throw new Error('AI가 유효한 구조를 생성하지 못했습니다.');
    }

    // ── 마크다운 코드 펜스 제거 ──
    const cleaned = structureText
      .replace(/^```(?:markdown|md)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    // ── 비용 계산 ──
    const estInputTokens = Math.ceil(prompt.length / 3);
    const estOutputTokens = Math.ceil(cleaned.length / 3);
    const estCost = ((estInputTokens * priceInput) + (estOutputTokens * priceOutput)) / 1_000_000;

    console.log(`✅ 제${episodeNumber}화 구조 설계 완료 (${usedModel}, ${cleaned.length}자, ~$${estCost.toFixed(4)})`);

    return NextResponse.json({
      success: true,
      structure: cleaned,
      charCount: cleaned.length,
      costInfo: {
        model: usedModel,
        estimatedInputTokens: estInputTokens,
        estimatedOutputTokens: estOutputTokens,
        estimatedCostUSD: Math.round(estCost * 10000) / 10000,
      },
    });

  } catch (error: any) {
    console.error('❌ 구조 설계 오류:', error);
    return NextResponse.json({
      success: false,
      message: '구조 설계 실패: ' + error.message,
    }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 구조 설계 프롬프트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildStructurePrompt(
  episodeNumber: number,
  episodeTitle: string,
  blueprint: string,
): string {
  return `당신은 무협 웹소설 "내 머리속에 천마와 장사꾼이 산다"의 구조 설계 전문가입니다.
제${episodeNumber}화의 구조를 설계합니다.

## ★★★ 최우선 규칙: 설계도를 반드시 따르세요 ★★★

아래 [설계도]에는 이 화의 **스토리 로드맵, 현재 상태, 주의사항, 이전 화 엔딩**이 포함되어 있습니다.

🚫 절대 금지:
- 설계도에 없는 사건을 지어내지 마세요
- 설계도에 없는 캐릭터를 등장시키지 마세요
- 설계도의 시간/장소/상황을 바꾸지 마세요
- 이전 에피소드(1~${episodeNumber - 1}화)의 사건을 반복하지 마세요
- 신용카드, 스마트폰 등 현대 물건을 등장시키지 마세요

✅ 반드시:
- 설계도의 "스토리 로드맵" 테이블에 적힌 사건을 중심으로 구성하세요
- 설계도의 "현재 상태"를 정확히 반영하세요 (위치, 시간, 인물 상태)
- 설계도의 "주의사항"과 "활성 떡밥"을 반영하세요
- 설계도의 "이전 화 엔딩"에서 자연스럽게 이어지게 하세요

## 소설 기본 설정
- 3인격 시스템: 위소운(몸 주인, 평어), 이준혁(머릿속 CEO, 존댓말 "~습니다"), 천마(머릿속 마교교주, 반말 "~해/~하라", "시" 존경접미사 절대 금지)
- 몸은 100% 위소운의 것. 이준혁/천마는 머릿속 목소리일 뿐
- 독백은 소괄호 () 표기. 간판/이름은 작은따옴표 '' 표기
- 현대어/경영 비유는 이준혁 내면 독백에서만
- 전투 중 3인격 대화는 긴급 지시 1~2줄만 허용

## 설계도 (★ 이것이 이번 화의 모든 정보입니다)
${blueprint}

## 출력 형식 (반드시 이 형식, 이 순서로)

### 1. 6하원칙
- **누가**: (설계도에 나오는 인물만! + 각자 역할)
- **언제**: (설계도의 시간 정보 기반 - Day X, 아침/오후/밤)
- **어디서**: (설계도의 장소 정보 기반)
- **무엇을**: (설계도의 로드맵에 적힌 핵심 사건)
- **왜**: (이 사건이 왜 이 시점에 일어나는지)
- **어떻게**: (사건의 전개 방식)

### 2. 5막 구조

| 막 | 비중 | 내용 | 감정 | 텐션 |
|---|---|---|---|---|
| 1막: 도입 | 15% | (구체적 장면 — 이전 화 엔딩에서 자연스럽게 이어지는) | (감정) | (1~10) |
| 2막: 전개 | 25% | (구체적 장면) | (감정) | (1~10) |
| 3막: 위기 | 25% | (구체적 장면) | (감정) | (1~10) |
| 4막: 절정 | 20% | (이번 화의 하이라이트 장면) | (감정) | (1~10) |
| 5막: 마무리 | 15% | (절단신공 — 다음 화가 궁금한 엔딩) | (감정) | (1~10) |

### 3. 핵심 장면 (3개)
가장 중요한 장면 3개를 골라, 각각:
- **상황**: 어떤 맥락에서 이 장면이 나오는지
- **대사 샘플 2~3줄**: 캐릭터별 말투를 정확히 살린 실제 대사
  - 위소운: 평어 (따뜻하고 단단)
  - 이준혁: 존댓말 (~습니다, ~이죠) — 소괄호 독백
  - 천마: 반말 (건방지고 짧다, "시" 금지) — 소괄호 독백
- **코미디 비트**: 이 장면의 웃기는 포인트 (있다면)
- **감정 포인트**: 독자가 느낄 감정

### 4. 코미디 비트 계획 (최소 7개)
- 3인격 갈등: (2개 — 의견 충돌, 동시 반응)
- 문화 충돌: (1개 — 현대 vs 고대, 이준혁 용어 vs 천마)
- 캐릭터 갭: (2개 — 위소운 사교 서투름, 천마 자존심)
- 조연 리액션: (1개)
- 러닝개그: (1개)

### 5. 절단신공 설계
- **마지막 장면**: (구체적 상황)
- **마지막 문장**: (독자가 다음 화를 클릭하게 만드는 한 문장)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
제${episodeNumber}화 "${episodeTitle || ''}"의 구조를 설계하세요.
설계도에 있는 정보만 사용하세요. 지어내지 마세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ★ Claude Sonnet 호출 (1순위 — 정확도 높음)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function callClaude(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      temperature: 0.6,  // 구조 설계: 창의성과 정확성 균형
      system: '당신은 무협 웹소설의 구조 설계 전문가입니다. 주어진 설계도의 정보만 사용하여 구조를 만드세요. 설계도에 없는 사건이나 캐릭터를 절대 지어내지 마세요.',
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
// Gemini 3 Pro 호출 (메인 / 폴백용)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function callGemini(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const model = 'gemini-3-pro-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
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
