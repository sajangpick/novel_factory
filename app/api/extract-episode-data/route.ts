import { NextRequest, NextResponse } from 'next/server';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [Step 8: DB 업데이트 - 에피소드 데이터 추출 AI API]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 완성된 소설 본문에서 DB에 기록할 정보를 AI가 자동 추출합니다:
 * - 등장 인물 (이름, 역할, 등장 비중)
 * - 등장 지명 (장소, 지역)
 * - 핵심 사건 (사건명, 요약)
 * - 언급된 무공/병기
 * - 자산/경제 정보 (화폐, 거래 등)
 * - 화 요약 (3줄)
 * 
 * 추출 결과를 Supabase에 저장하거나 localStorage에 캐시합니다.
 */

interface ExtractRequest {
  episodeNumber: number;
  episodeTitle: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ExtractRequest = await req.json();

    if (!body.content || body.content.length < 100) {
      return NextResponse.json({
        success: false,
        message: '추출할 본문이 없거나 너무 짧습니다.',
      }, { status: 400 });
    }

    // ── AI API Key 확인 ──
    const openaiKey = process.env.OPENAI_API_KEY;
    const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!openaiKey && !claudeKey && !geminiKey) {
      return NextResponse.json({
        success: false,
        message: 'AI API Key가 설정되지 않았습니다.',
      }, { status: 500 });
    }

    // ── 프롬프트 구성 ──
    const prompt = buildExtractPrompt(body);
    console.log(`📊 제${body.episodeNumber}화 데이터 추출 시작`);

    // ── AI 호출 ──
    let rawResult = '';
    const maxTokens = 2500;

    if (openaiKey) {
      rawResult = await callOpenAI(openaiKey, prompt, maxTokens);
    } else if (claudeKey) {
      rawResult = await callClaude(claudeKey, prompt, maxTokens);
    } else if (geminiKey) {
      rawResult = await callGemini(geminiKey, prompt, maxTokens);
    }

    if (!rawResult) {
      throw new Error('AI가 데이터를 추출하지 못했습니다.');
    }

    // ── 결과 파싱 ──
    const extracted = parseExtractedData(rawResult);
    console.log(`✅ 제${body.episodeNumber}화 데이터 추출 완료`);

    // ── Supabase 저장 시도 ──
    let savedToSupabase = false;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        // episodes 테이블에 저장 (있으면 업데이트, 없으면 삽입)
        const { error } = await supabase
          .from('episodes')
          .upsert({
            series_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            episode_number: body.episodeNumber,
            title: body.episodeTitle,
            summary: extracted.summary,
            characters_appeared: extracted.characters.map((c: any) => c.name),
            locations: extracted.locations.map((l: any) => l.name),
            key_events: extracted.events.map((e: any) => e.name),
            martial_arts_mentioned: extracted.martialArts,
            assets_mentioned: extracted.assets,
            status: 'reviewed', // 검수 완료 후 DB 저장이므로
            updated_at: new Date().toISOString(),
          }, { onConflict: 'series_id,episode_number' });

        if (!error) {
          savedToSupabase = true;
          console.log(`💾 Supabase episodes 테이블 저장 완료`);
        } else {
          console.warn('⚠️ Supabase 저장 실패:', error.message);
        }
      }
    } catch (e) {
      console.warn('⚠️ Supabase 저장 시도 실패 (무시):', e);
    }

    return NextResponse.json({
      success: true,
      extracted,
      savedToSupabase,
      raw: rawResult,
    });

  } catch (error: any) {
    console.error('❌ 데이터 추출 오류:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '데이터 추출 실패',
    }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 프롬프트 빌더
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildExtractPrompt(body: ExtractRequest): string {
  return `당신은 소설 데이터 분석 전문가입니다.
아래 소설 본문에서 DB에 기록할 정보를 정확하게 추출하세요.

## 분석 대상
- 화수: 제${body.episodeNumber}화 "${body.episodeTitle || '무제'}"

## 소설 본문
${body.content.slice(0, 8000)}

## 추출 항목

### 1. 등장 인물
- 이름, 역할(주인공/조연/적대자/엑스트라), 비중(높음/중간/낮음)

### 2. 등장 장소
- 장소명, 유형(도시/객잔/산/강/기타)

### 3. 핵심 사건
- 사건명(10자 이내), 요약(30자 이내)

### 4. 무공/병기
- 이름만 나열

### 5. 자산/경제 정보
- 화폐, 거래, 재산 관련 언급

### 6. 화 요약
- 3줄 이내 (다음 화 참고용)

## 출력 형식 (반드시 이 JSON 형식으로만)
\`\`\`json
{
  "characters": [
    { "name": "독고소준", "role": "주인공", "weight": "높음" }
  ],
  "locations": [
    { "name": "낙양", "type": "도시" }
  ],
  "events": [
    { "name": "객잔 인수", "summary": "독고소준이 패가 직전의 객잔을 매입" }
  ],
  "martialArts": ["천마신공", "독고검법"],
  "assets": ["은 500냥 거래", "객잔 매입 비용 200냥"],
  "summary": "독고소준이 낙양에 도착하여 첫 번째 거점인 객잔을 인수한다. 하오문의 감시를 피해 은밀하게 자금을 마련하고, 천마의 힘으로 위협을 물리친다."
}
\`\`\`

반드시 JSON만 출력하세요.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 파서
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ExtractedData {
  characters: { name: string; role: string; weight: string }[];
  locations: { name: string; type: string }[];
  events: { name: string; summary: string }[];
  martialArts: string[];
  assets: string[];
  summary: string;
}

function parseExtractedData(raw: string): ExtractedData {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const fallback: ExtractedData = {
    characters: [],
    locations: [],
    events: [],
    martialArts: [],
    assets: [],
    summary: '',
  };

  if (!jsonMatch) return fallback;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      martialArts: Array.isArray(parsed.martialArts) ? parsed.martialArts.map(String) : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets.map(String) : [],
      summary: String(parsed.summary || ''),
    };
  } catch {
    return fallback;
  }
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
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: '당신은 소설 데이터 분석 전문가입니다. 반드시 JSON 형식으로만 응답하세요.' },
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
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      temperature: 0.2,
      system: '당신은 소설 데이터 분석 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
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
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini 호출 실패 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => String(p?.text || '')).join('') : '';
}
