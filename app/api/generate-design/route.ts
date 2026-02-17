import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * [AI 설계 생성 API]
 * .cursorrules의 Step 3 스노우볼링 5단계 설계 생성
 * - 1차: 뼈대 (100자)
 * - 2차: 서사 (500자)
 * - 3차: 고증 (1,500자)
 * - 4차: 감각 (3,000자)
 * - 5차: 최종 (5,000자)
 */

interface GenerateRequest {
  stage: number; // 1~5
  previousDesigns: Record<number, string>; // 이전 단계 설계들
  episodeNumber?: number;
  region?: string;
  mood?: string;
  tier?: string;
}

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json();
    const { stage, previousDesigns, episodeNumber = 3, region = '낙양', mood = 'tension', tier = '중' } = body;

    // 환경 변수 확인 (OpenAI 우선)
    const openaiKey = process.env.OPENAI_API_KEY;
    const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    if (!openaiKey && !claudeKey && !geminiKey) {
      return NextResponse.json({
        success: false,
        message: 'AI API Key가 설정되지 않았습니다.'
      }, { status: 500 });
    }

    // 1. World DB에서 데이터 가져오기 (Supabase가 설정된 경우)
    let worldData: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('recommend_story_assets', {
          p_series_id: process.env.SERIES_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          p_region: region,
          p_mood_slug: mood,
          p_tier: tier,
          p_season: 'autumn',
          p_episode: episodeNumber
        });

        if (!error && data) {
          worldData = data;
        }
      } catch (e) {
        console.warn('World DB 조회 실패 (샘플 데이터 사용):', e);
      }
    }

    // 2. AI 프롬프트 구성
    const prompt = buildPrompt(stage, previousDesigns, worldData);

    // 3. ChatGPT(OpenAI) API 호출 (Legacy에서 작동하는 코드)
    let generatedText = '';
    
    if (openaiKey) {
      // ChatGPT 사용 (우선) - Legacy와 동일
      const modelId = 'gpt-4o-mini';
      const maxTokens = stage === 5 ? 8000 : stage === 4 ? 5000 : stage === 3 ? 2500 : stage === 2 ? 1000 : 500;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0.7,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`ChatGPT 호출 실패 (${res.status}) [model=${modelId}]: ${errorText}`);
      }

      const data: any = await res.json();
      generatedText = String(data?.choices?.[0]?.message?.content || '').trim();
      
    } else if (claudeKey) {
      // Claude 폴백
      const maxTokens = stage === 5 ? 8000 : stage === 4 ? 5000 : stage === 3 ? 2500 : stage === 2 ? 1000 : 500;
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: maxTokens,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Claude 호출 실패 (${res.status}): ${errorText}`);
      }

      const data: any = await res.json();
      generatedText = Array.isArray(data?.content)
        ? data.content
            .filter((c: any) => c?.type === 'text' && typeof c?.text === 'string')
            .map((c: any) => c.text)
            .join('')
        : '';
        
    } else if (geminiKey) {
      // Gemini 폴백
      const modelId = 'gemini-pro-latest';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(geminiKey)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: stage === 5 ? 8000 : stage === 4 ? 5000 : stage === 3 ? 2500 : stage === 2 ? 1000 : 500,
          },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini 호출 실패 (${res.status}): ${errorText}`);
      }

      const aiData = await res.json();
      const parts = aiData?.candidates?.[0]?.content?.parts;
      generatedText = Array.isArray(parts)
        ? parts.map((p: any) => String(p?.text || '')).join('')
        : '';
    }

    // 4. 응답 반환
    return NextResponse.json({
      success: true,
      design: generatedText,
      stage,
      worldData: worldData ? '사용됨' : '미사용',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[AI 생성 오류]', error);
    return NextResponse.json({
      success: false,
      message: 'AI 생성 실패',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * [프롬프트 구성 함수]
 * 각 단계별로 적절한 프롬프트 생성
 */
function buildPrompt(stage: number, previousDesigns: Record<number, string>, worldData: any): string {
  const stageConfigs = {
    1: {
      name: '1차 설계: 핵심 뼈대',
      length: '100자',
      lengthExact: 100,
      goal: '장면의 DNA 정의',
      required: ['출연자', '장소', '시간대', '핵심 사건(Trigger)'],
      aiHints: ['갈등 유형 (예: M&A형 대결)', '날씨/분위기']
    },
    2: {
      name: '2차 설계: 서사 및 인과관계',
      length: '500자',
      lengthExact: 500,
      goal: '뼈대에 개연성과 동기 부여',
      required: ['인물 간의 대립 원인', '이동 동선', '사건의 전조 증상'],
      aiHints: ['비즈니스 로직', '세력 관계']
    },
    3: {
      name: '3차 설계: 고증 및 설정 주입',
      length: '1,500자',
      lengthExact: 1500,
      goal: 'World DB를 활용하여 물리적 실체 부여',
      required: ['건축물의 구조', '메뉴(요리/주류)', '화폐 가치', '의복 묘사'],
      aiHints: ['로컬리티 (지역 특산물)', '소품 (기물, 병기)']
    },
    4: {
      name: '4차 설계: 감각 및 심리 묘사',
      length: '3,000자',
      lengthExact: 3000,
      goal: '독자가 현장에 있는 듯한 몰입감 조성',
      required: ['오감 (조명, 소리, 냄새)', '내면 심리', '캐릭터별 특화 대사'],
      aiHints: ['페르소나 (이준혁: 경영학적, 천마: 오만)', '효과음 (파공음, 의성어)']
    },
    5: {
      name: '5차 설계: 최종 설계도',
      length: '5,000자',
      lengthExact: 5000,
      goal: '본문 집필 직전의 완벽한 가이드',
      required: ['액션의 정밀한 합', '대사 뉘앙스 교정', '절단신공 포인트'],
      aiHints: ['사이다 포인트 배치', '유료 결제 유도 지점']
    }
  };

  const config = stageConfigs[stage as keyof typeof stageConfigs];

  let prompt = `당신은 20년 경력의 무협소설 작가이자 MBA 출신 경영 컨설턴트입니다.

## 작업 요청
${config.name} (${config.length})를 작성하세요.

## 목표
${config.goal}

## 필수 포함 요소
${config.required.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## AI 추천 사항
${config.aiHints.map((h, i) => `- ${h}`).join('\n')}

`;

  // 이전 단계 설계 계승 (적층식 데이터 보존)
  if (stage > 1) {
    prompt += `\n## 이전 단계 설계 (반드시 계승하세요)\n`;
    for (let i = 1; i < stage; i++) {
      if (previousDesigns[i]) {
        prompt += `\n### ${i}차 설계\n${previousDesigns[i]}\n`;
      }
    }
  }

  // World DB 데이터 추가 (3차부터)
  if (stage >= 3 && worldData) {
    prompt += `\n## World DB 데이터 (고증 자료)\n`;
    
    if (worldData.foods && worldData.foods.length > 0) {
      prompt += `\n### 음식\n`;
      worldData.foods.slice(0, 3).forEach((food: any) => {
        prompt += `- ${food.name}: ${food.tier}급, ${food.region || '일반'} 지역, ${food.taste_notes || ''}\n`;
      });
    }

    if (worldData.locations && worldData.locations.length > 0) {
      prompt += `\n### 장소\n`;
      worldData.locations.slice(0, 2).forEach((loc: any) => {
        prompt += `- ${loc.name}: ${loc.description || ''}\n`;
      });
    }

    if (worldData.prices && worldData.prices.length > 0) {
      prompt += `\n### 가격표\n`;
      worldData.prices.slice(0, 3).forEach((price: any) => {
        prompt += `- ${price.item_name}: ${price.price_note || ''}\n`;
      });
    }
  }

  prompt += `\n## 출력 형식
반드시 다음 형식으로 작성하세요:

[${config.name} - ${config.length}]

(여기에 설계 내용을 작성)

## 주의사항 (필수)
- 한국어로 작성
- 무협 소설 문체 사용
- 경영학적 관점 포함
- **중요**: 본문 내용은 공백(띄어쓰기)을 제외하고 정확히 ${config.lengthExact}자로 맞추세요
  * 제목 [...]은 글자수에 포함하지 않음
  * 줄바꿈(\\n)은 글자수에 포함하지 않음
  * 띄어쓰기/공백은 글자수에 포함하지 않음
  * 순수 한글, 숫자, 기호만 ${config.lengthExact}자
  * 목표: 정확히 ${config.lengthExact}자 (오차 ±5자 이내)
`;

  return prompt;
}
