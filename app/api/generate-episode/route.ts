import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

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
 * - 목표 분량: 6,000~8,000자 (웹소설 1화 기준)
 * - 절단신공: 다음 화가 궁금한 엔딩
 */

// ── 요청 인터페이스 ──
interface GenerateEpisodeRequest {
  episodeNumber: number;         // 화 번호
  episodeTitle: string;          // 화 제목
  blueprint: string;             // Step 4의 5000자 최종 설계도
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
// 3-Level AI 모델 설정 (비용 관리의 핵심)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Level 1: 초안 = Gemini 2.0 Flash (거의 무료, 1화당 ~$0.01)
// Level 2: 다듬기 = Claude Sonnet (가성비, 1화당 ~$0.30)
// Level 3: 최종 퇴고 = Claude Opus (최고 필력, 1화당 ~$2.00)
const AI_LEVELS: Record<number, {
  name: string;
  provider: 'gemini' | 'claude' | 'openai';
  model: string;
  priceInput: number;   // USD per 백만 토큰
  priceOutput: number;  // USD per 백만 토큰
}> = {
  1: { name: 'Lv.1 초안 (Gemini Flash)',    provider: 'gemini', model: 'gemini-2.0-flash',           priceInput: 0.10,  priceOutput: 0.40 },
  2: { name: 'Lv.2 다듬기 (Claude Sonnet)', provider: 'claude', model: 'claude-3-5-sonnet-20241022', priceInput: 3.00,  priceOutput: 15.00 },
  3: { name: 'Lv.3 최종 (Claude Opus)',     provider: 'claude', model: 'claude-3-opus-20240229',     priceInput: 15.00, priceOutput: 75.00 },
};

export async function POST(req: NextRequest) {
  try {
    const body: GenerateEpisodeRequest = await req.json();
    const {
      episodeNumber,
      episodeTitle,
      blueprint,
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

    // ── 프롬프트 구성 ──
    const prompt = buildEpisodePrompt({
      episodeNumber,
      episodeTitle,
      blueprint,
      section,
      characters: enrichedCharacters,
      previousEpisodeSummary,
      worldContext,
      memoryContext,
    });

    // ── AI Level 결정 (★ 비용 관리의 핵심) ──
    const level = Math.min(3, Math.max(1, aiLevel)) as 1 | 2 | 3;
    const levelConfig = AI_LEVELS[level];
    console.log(`📝 제${episodeNumber}화 "${episodeTitle}" 생성 시작 (${section}, ${levelConfig.name})`);

    // ── AI 호출 (Level에 맞는 모델 사용) ──
    let generatedText = '';
    let usedModel = levelConfig.model;
    const maxTokens = section === 'full' ? 12000 : 3000;

    // Level에 맞는 API 키가 있으면 해당 모델, 없으면 가장 저렴한 모델로 폴백
    if (levelConfig.provider === 'gemini' && geminiKey) {
      generatedText = await callGemini(geminiKey, prompt, maxTokens, levelConfig.model);
    } else if (levelConfig.provider === 'claude' && claudeKey) {
      generatedText = await callClaude(claudeKey, prompt, maxTokens, levelConfig.model);
    } else if (levelConfig.provider === 'openai' && openaiKey) {
      generatedText = await callOpenAI(openaiKey, prompt, maxTokens);
    } else if (geminiKey) {
      // ★ 폴백: 항상 Gemini Flash (가장 저렴)
      generatedText = await callGemini(geminiKey, prompt, maxTokens, AI_LEVELS[1].model);
      usedModel = AI_LEVELS[1].model;
      console.log(`⚠️ Level ${level} API 키 없음 → Gemini Flash로 폴백`);
    } else if (claudeKey) {
      generatedText = await callClaude(claudeKey, prompt, maxTokens);
      usedModel = 'claude-3-5-sonnet-20241022';
    } else if (openaiKey) {
      generatedText = await callOpenAI(openaiKey, prompt, maxTokens);
      usedModel = 'gpt-4o-mini';
    }

    if (!generatedText) {
      throw new Error('AI가 텍스트를 생성하지 못했습니다.');
    }

    // ── [legacy 이전] 품질 게이트: 금지 문구 검사 + 초반 안전장치 ──
    const mustAvoidPhrases = [
      '띠링', '조건이 충족되었습니다', '상태창',  // 상태창/시스템 UI
      '아메리카노', '오케이', '팩트 체크',        // 현대어
    ];
    const isEarlyEpisode = episodeNumber <= 30;
    if (isEarlyEpisode) {
      mustAvoidPhrases.push('술', '주점', '소흥주', '백주', '해장국');
    }

    const forbiddenHits = mustAvoidPhrases.filter(p => generatedText.includes(p));
    const tooShort = generatedText.replace(/\s+/g, '').length < 3000 && section === 'full';

    // 금지 문구 발견 또는 너무 짧으면 1회 재생성
    if (forbiddenHits.length > 0 || tooShort) {
      console.log(`⚠️ 품질 게이트 미통과 (금지: [${forbiddenHits.join(',')}], 짧음: ${tooShort}) → 재생성`);

      const retryPrompt = `${prompt}\n\n[재작성 지시]\n아래 금지 문구가 포함되었습니다. 절대 쓰지 마세요:\n${forbiddenHits.map(s => `- ${s}`).join('\n')}\n${tooShort ? '분량이 부족합니다. 최소 6000자 이상 작성하세요.' : ''}`;

      let retryText = '';
      // 재생성도 같은 Level 모델 사용 (비용 예측 가능)
      if (levelConfig.provider === 'gemini' && geminiKey) retryText = await callGemini(geminiKey, retryPrompt, maxTokens, levelConfig.model);
      else if (levelConfig.provider === 'claude' && claudeKey) retryText = await callClaude(claudeKey, retryPrompt, maxTokens, levelConfig.model);
      else if (geminiKey) retryText = await callGemini(geminiKey, retryPrompt, maxTokens, AI_LEVELS[1].model);
      else if (claudeKey) retryText = await callClaude(claudeKey, retryPrompt, maxTokens);
      else if (openaiKey) retryText = await callOpenAI(openaiKey, retryPrompt, maxTokens);

      if (retryText && retryText.length > generatedText.length * 0.5) {
        generatedText = retryText;
        console.log(`✅ 재생성 완료 (${retryText.length}자)`);
      }
    }

    const finalForbidden = mustAvoidPhrases.filter(p => generatedText.includes(p));
    console.log(`✅ 제${episodeNumber}화 생성 완료 (${generatedText.length}자, 금지문구: ${finalForbidden.length}건)`);

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
      },
      // ── ★ 비용 정보 (대시보드에 표시) ──
      costInfo: {
        level,
        levelName: levelConfig.name,
        model: usedModel,
        estimatedInputTokens: estInputTokens,
        estimatedOutputTokens: estOutputTokens,
        estimatedCostUSD: Math.round(estCostUSD * 10000) / 10000,
        priceGuide: {
          'Lv.1 Gemini Flash': '~$0.01/화',
          'Lv.2 Claude Sonnet': '~$0.30/화',
          'Lv.3 Claude Opus': '~$2.00/화',
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
  section: string;
  characters: any[];
  previousEpisodeSummary: string;
  worldContext: string;
  memoryContext?: any;
}): string {
  const { episodeNumber, episodeTitle, blueprint, section, characters, previousEpisodeSummary, worldContext, memoryContext } = params;

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

### 분량
- 목표: 6,000~8,000자 (공백 제외 순수 글자수)
- 웹소설 1화 분량에 맞추세요`;
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

## 출력 형식
- 제목: 제${episodeNumber}화. ${episodeTitle}
- 본문만 출력 (메타 설명, 주석, 태그 없이 순수 소설 텍스트만)
- 장면 전환: *** (별 세 개)
- 문단 구분: 빈 줄 한 칸

${memoryContext ? `## 현재 상태 (Memory System - 반드시 반영)
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

` : ''}${previousEpisodeSummary ? `## 이전 화 요약 (연결 필수)
${previousEpisodeSummary}

` : ''}${characterGuide ? `## 등장 캐릭터 (말투/성격 반드시 반영)
${characterGuide}

` : ''}${worldContext ? `## 세계관 참고 자료
${worldContext}

` : ''}## 최종 설계도 (이것을 소설로 변환하세요)
${blueprint}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
지금부터 제${episodeNumber}화 본문을 집필하세요.
제목부터 시작하고, 순수 소설 텍스트만 출력하세요.
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

async function callClaude(apiKey: string, prompt: string, maxTokens: number, model: string = 'claude-3-5-sonnet-20241022'): Promise<string> {
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
      temperature: 0.8,
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

async function callGemini(apiKey: string, prompt: string, maxTokens: number, model: string = 'gemini-2.0-flash'): Promise<string> {
  const modelId = model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
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
