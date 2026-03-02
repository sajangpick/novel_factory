import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [에피소드 확정 시스템 API]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * GET  — 전체 에피소드 동기화 상태 조회
 *        (DB episodes ↔ memory_cards 비교)
 * POST — 에피소드 확정/재확정
 *        (AI 분석 → memory_cards upsert + novel_dashboard 업데이트)
 * DELETE — 확정 롤백
 *        (memory_card 삭제 + dashboard 이전 화 복원)
 *
 * 모든 데이터는 Supabase에서 관리 (다른 컴퓨터에서도 사용 가능)
 */

const SERIES_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET: 동기화 상태 조회
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: false, error: 'Supabase 미설정' }, { status: 500 });
    }

    // 동시에 episodes + memory_cards 조회
    // ★ 실제 본문이 있는 에피소드만 (word_count > 100, episode_number > 0)
    const [epRes, mcRes] = await Promise.all([
      supabase
        .from('episodes')
        .select('episode_number, title, status, word_count, updated_at')
        .eq('series_id', SERIES_ID)
        .gt('episode_number', 0)
        .gt('word_count', 100)
        .order('episode_number', { ascending: true }),
      supabase
        .from('memory_cards')
        .select('episode_number, episode_title, created_at')
        .eq('series_id', SERIES_ID)
        .gt('episode_number', 0)
        .order('episode_number', { ascending: true }),
    ]);

    if (epRes.error) throw epRes.error;
    if (mcRes.error) throw mcRes.error;

    const episodes = epRes.data || [];
    const memoryCards = mcRes.data || [];

    // memory_cards를 Map으로 변환 (빠른 조회)
    const cardMap = new Map<number, { title: string; created_at: string }>();
    for (const mc of memoryCards) {
      cardMap.set(mc.episode_number, { title: mc.episode_title, created_at: mc.created_at });
    }

    // 에피소드별 map (삭제 감지용)
    const episodeSet = new Set(episodes.map((ep: any) => ep.episode_number));

    // 동기화 상태 계산
    type SyncStatus = 'confirmed' | 'unconfirmed' | 'modified' | 'deleted';
    interface SyncItem {
      episodeNumber: number;
      title: string;
      status: SyncStatus;
      wordCount: number;
      lastModified: string;
      hasMemoryCard: boolean;
    }

    const syncItems: SyncItem[] = [];

    // 1) episodes 테이블 기준으로 상태 계산
    for (const ep of episodes) {
      const hasCard = cardMap.has(ep.episode_number);
      let syncStatus: SyncStatus;

      if (ep.status === 'confirmed' && hasCard) {
        // 확정 완료
        syncStatus = 'confirmed';
      } else if (ep.status === 'completed' && hasCard) {
        // 확정 후 수정됨 → 재확정 필요
        syncStatus = 'modified';
      } else {
        // 기억 카드 없음 → 미확정
        syncStatus = 'unconfirmed';
      }

      syncItems.push({
        episodeNumber: ep.episode_number,
        title: ep.title || `제${ep.episode_number}화`,
        status: syncStatus,
        wordCount: ep.word_count || 0,
        lastModified: ep.updated_at,
        hasMemoryCard: hasCard,
      });
    }

    // 2) memory_cards에는 있지만 episodes에서 삭제된 경우
    for (const mc of memoryCards) {
      if (!episodeSet.has(mc.episode_number)) {
        syncItems.push({
          episodeNumber: mc.episode_number,
          title: mc.title || `제${mc.episode_number}화`,
          status: 'deleted',
          wordCount: 0,
          lastModified: mc.created_at,
          hasMemoryCard: true,
        });
      }
    }

    // 정렬
    syncItems.sort((a, b) => a.episodeNumber - b.episodeNumber);

    // 요약 통계
    const confirmed = syncItems.filter(i => i.status === 'confirmed').length;
    const unconfirmed = syncItems.filter(i => i.status === 'unconfirmed').length;
    const modified = syncItems.filter(i => i.status === 'modified').length;
    const deleted = syncItems.filter(i => i.status === 'deleted').length;
    const latestConfirmed = syncItems
      .filter(i => i.status === 'confirmed')
      .reduce((max, i) => Math.max(max, i.episodeNumber), 0);
    const needsAttention = syncItems.filter(i => i.status !== 'confirmed');

    return NextResponse.json({
      success: true,
      syncItems,
      summary: { confirmed, unconfirmed, modified, deleted, latestConfirmed, total: syncItems.length },
      needsAttention,
    });
  } catch (error: any) {
    console.error('❌ 동기화 상태 조회 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST: 에피소드 확정 (AI 분석 → DB 저장)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: false, error: 'Supabase 미설정' }, { status: 500 });
    }

    const body = await req.json();
    const { episodeNumber } = body;

    if (!episodeNumber) {
      return NextResponse.json({ success: false, error: '화 번호가 필요합니다.' }, { status: 400 });
    }

    // 1) 에피소드 본문 가져오기 (DB에서)
    const { data: episode, error: epError } = await supabase
      .from('episodes')
      .select('*')
      .eq('series_id', SERIES_ID)
      .eq('episode_number', episodeNumber)
      .single();

    if (epError || !episode) {
      return NextResponse.json({
        success: false,
        error: `제${episodeNumber}화를 DB에서 찾을 수 없습니다.`,
      }, { status: 404 });
    }

    const manuscript = episode.manuscript || '';
    if (manuscript.length < 100) {
      return NextResponse.json({
        success: false,
        error: '본문이 너무 짧습니다 (100자 미만).',
      }, { status: 400 });
    }

    // 2) 이전 화 기억 카드 참조 (연속성 분석용)
    let prevCardContext = '';
    if (episodeNumber > 1) {
      const { data: prevCard } = await supabase
        .from('memory_cards')
        .select('*')
        .eq('series_id', SERIES_ID)
        .eq('episode_number', episodeNumber - 1)
        .single();

      if (prevCard) {
        prevCardContext = `
[이전 화 (제${episodeNumber - 1}화) 기억 카드]
- 위치: ${prevCard.where_summary || '불명'}
- 건강: ${prevCard.health_change || '변동 없음'}
- 무공: ${prevCard.martial_change || '변동 없음'}
- 자산: ${prevCard.asset_change || '변동 없음'}
- 관계: ${prevCard.relationship_change || '변동 없음'}
- 주도 인격: ${prevCard.dominant_personality || '불명'}
- 클리프행어: ${prevCard.cliffhanger || '없음'}
- 다음 화 주의: ${prevCard.next_caution || '없음'}`;
      }
    }

    // 3) AI 분석 호출 (기억 카드 + 대시보드 데이터 동시 추출)
    console.log(`🔍 제${episodeNumber}화 AI 확정 분석 시작...`);
    const prompt = buildConfirmPrompt(episodeNumber, episode.title || '', manuscript, prevCardContext);
    const aiResult = await callAI(prompt);

    if (!aiResult) {
      return NextResponse.json({
        success: false,
        error: 'AI 분석에 실패했습니다. API Key를 확인하세요.',
      }, { status: 500 });
    }

    // 4) AI 결과 파싱
    const parsed = parseConfirmResult(aiResult);
    if (!parsed) {
      return NextResponse.json({
        success: false,
        error: 'AI 결과 파싱에 실패했습니다.',
        raw: aiResult,
      }, { status: 500 });
    }

    // 5) memory_cards upsert
    const { error: mcError } = await supabase
      .from('memory_cards')
      .upsert({
        series_id: SERIES_ID,
        episode_number: episodeNumber,
        episode_title: episode.title || `제${episodeNumber}화`,
        when_summary: parsed.memoryCard.when_summary || '',
        where_summary: parsed.memoryCard.where_summary || '',
        who_summary: parsed.memoryCard.who_summary || '',
        what_summary: parsed.memoryCard.what_summary || '',
        why_summary: parsed.memoryCard.why_summary || '',
        how_summary: parsed.memoryCard.how_summary || '',
        asset_change: parsed.memoryCard.asset_change || '',
        martial_change: parsed.memoryCard.martial_change || '',
        org_change: parsed.memoryCard.org_change || '',
        relationship_change: parsed.memoryCard.relationship_change || '',
        location_change: parsed.memoryCard.location_change || '',
        health_change: parsed.memoryCard.health_change || '',
        foreshadow_planted: parsed.memoryCard.foreshadow_planted || '',
        foreshadow_hinted: parsed.memoryCard.foreshadow_hinted || '',
        foreshadow_resolved: parsed.memoryCard.foreshadow_resolved || '',
        dominant_personality: parsed.memoryCard.dominant_personality || '',
        personality_conflict: parsed.memoryCard.personality_conflict || '',
        personality_growth: parsed.memoryCard.personality_growth || '',
        key_dialogue: parsed.memoryCard.key_dialogue || '',
        cliffhanger: parsed.memoryCard.cliffhanger || '',
        next_preview: parsed.memoryCard.next_preview || '',
        next_caution: parsed.memoryCard.next_caution || '',
      }, { onConflict: 'series_id,episode_number' });

    if (mcError) {
      console.error('❌ memory_cards upsert 실패:', mcError);
      throw mcError;
    }

    // 6) novel_dashboard 업데이트
    // ★ 현재 대시보드의 latest_episode보다 높은 화만 대시보드 데이터를 갱신
    //   (1화 확정 시 기존 13화 데이터를 1화로 덮어쓰는 버그 방지)
    const { data: currentDash } = await supabase
      .from('novel_dashboard')
      .select('latest_episode')
      .eq('series_id', SERIES_ID)
      .single();

    const currentLatest = currentDash?.latest_episode || 0;
    const isLatestEpisode = episodeNumber >= currentLatest;

    const dashboardUpdate: Record<string, any> = { series_id: SERIES_ID };

    // AI가 "불명", "미정" 등 무의미한 값을 반환하면 기존 데이터를 덮어쓰지 않음
    const isMeaningful = (val: any): boolean => {
      if (!val) return false;
      const s = String(val).trim();
      if (s.length === 0) return false;
      const junk = ['불명', '미정', '없음', '알 수 없음', '언급 없음', '정보 없음', '확인 불가', '0', '0냥'];
      return !junk.includes(s);
    };

    // 최신 화일 때만 대시보드 상태 정보를 갱신
    if (isLatestEpisode) {
      dashboardUpdate.latest_episode = episodeNumber;
      if (parsed.dashboard) {
        const d = parsed.dashboard;
        if (isMeaningful(d.story_date)) dashboardUpdate.story_date = d.story_date;
        if (isMeaningful(d.current_location)) dashboardUpdate.current_location = d.current_location;
        if (isMeaningful(d.season)) dashboardUpdate.season = d.season;
        if (isMeaningful(d.weather)) dashboardUpdate.weather = d.weather;
        if (isMeaningful(d.mc_health)) dashboardUpdate.mc_health = d.mc_health;
        if (isMeaningful(d.mc_martial_rank)) dashboardUpdate.mc_martial_rank = d.mc_martial_rank;
        if (isMeaningful(d.mc_internal_energy)) dashboardUpdate.mc_internal_energy = d.mc_internal_energy;
        if (isMeaningful(d.mc_money)) dashboardUpdate.mc_money = d.mc_money;
        if (isMeaningful(d.mc_injury)) dashboardUpdate.mc_injury = d.mc_injury;
        if (isMeaningful(d.mc_emotion)) dashboardUpdate.mc_emotion = d.mc_emotion;
        if (isMeaningful(d.mc_current_goal)) dashboardUpdate.mc_current_goal = d.mc_current_goal;
        if (isMeaningful(d.active_foreshadows)) dashboardUpdate.active_foreshadows = d.active_foreshadows;
        if (isMeaningful(d.next_cautions)) dashboardUpdate.next_cautions = d.next_cautions;
      }
    }

    let dashError = null;
    if (Object.keys(dashboardUpdate).length > 1) {
      const result = await supabase
        .from('novel_dashboard')
        .upsert(dashboardUpdate, { onConflict: 'series_id' });
      dashError = result.error;
    }

    if (dashError) {
      console.warn('⚠️ dashboard 업데이트 실패 (무시):', dashError.message);
    }

    // 7) episodes 상태를 'confirmed'로 변경
    const { error: statusError } = await supabase
      .from('episodes')
      .update({ status: 'confirmed' })
      .eq('series_id', SERIES_ID)
      .eq('episode_number', episodeNumber);

    if (statusError) {
      console.warn('⚠️ episode status 업데이트 실패 (무시):', statusError.message);
    }

    console.log(`✅ 제${episodeNumber}화 확정 완료 (memory_card + dashboard + status)`);

    return NextResponse.json({
      success: true,
      message: `제${episodeNumber}화가 확정되었습니다.`,
      memoryCard: parsed.memoryCard,
      dashboardUpdated: !dashError,
    });

  } catch (error: any) {
    console.error('❌ 에피소드 확정 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE: 확정 롤백
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function DELETE(req: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: false, error: 'Supabase 미설정' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const episodeNumber = parseInt(searchParams.get('episode') || '0');

    if (!episodeNumber) {
      return NextResponse.json({ success: false, error: '화 번호가 필요합니다.' }, { status: 400 });
    }

    // 1) memory_card 삭제
    const { error: mcDeleteError } = await supabase
      .from('memory_cards')
      .delete()
      .eq('series_id', SERIES_ID)
      .eq('episode_number', episodeNumber);

    if (mcDeleteError) throw mcDeleteError;

    // 2) 해당 에피소드가 아직 존재하면 status를 completed로 되돌림
    await supabase
      .from('episodes')
      .update({ status: 'completed' })
      .eq('series_id', SERIES_ID)
      .eq('episode_number', episodeNumber);

    // 3) 대시보드의 latest_episode를 이전 확정 화로 되돌림
    const { data: remainingCards } = await supabase
      .from('memory_cards')
      .select('episode_number')
      .eq('series_id', SERIES_ID)
      .order('episode_number', { ascending: false })
      .limit(1);

    const newLatest = remainingCards?.[0]?.episode_number || 0;

    if (newLatest > 0) {
      // 이전 확정 화의 memory_card에서 대시보드 복원
      const { data: prevCard } = await supabase
        .from('memory_cards')
        .select('*')
        .eq('series_id', SERIES_ID)
        .eq('episode_number', newLatest)
        .single();

      await supabase
        .from('novel_dashboard')
        .upsert({
          series_id: SERIES_ID,
          latest_episode: newLatest,
          current_location: prevCard?.where_summary || '',
        }, { onConflict: 'series_id' });
    } else {
      await supabase
        .from('novel_dashboard')
        .upsert({
          series_id: SERIES_ID,
          latest_episode: 0,
        }, { onConflict: 'series_id' });
    }

    console.log(`🔄 제${episodeNumber}화 롤백 완료 → 최신 확정: ${newLatest}화`);

    return NextResponse.json({
      success: true,
      message: `제${episodeNumber}화 확정이 롤백되었습니다. 최신 확정: 제${newLatest}화`,
      newLatestConfirmed: newLatest,
    });

  } catch (error: any) {
    console.error('❌ 롤백 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI 프롬프트 빌더 (기억 카드 + 대시보드 동시 추출)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildConfirmPrompt(epNum: number, title: string, manuscript: string, prevCardContext: string): string {
  return `당신은 무협소설 연재 관리 전문가입니다.
아래 소설 본문을 분석하여 두 가지 JSON을 생성하세요.

## 분석 대상
- 화수: 제${epNum}화 "${title || '무제'}"
${prevCardContext ? `\n## 이전 화 참조\n${prevCardContext}\n` : ''}
## 소설 본문 (앞 10,000자)
${manuscript.slice(0, 10000)}

## 출력 형식 — 반드시 아래 JSON 형식으로만 응답

\`\`\`json
{
  "memoryCard": {
    "when_summary": "작중 시간 (예: 무림력 87년 초봄, 낙양 도착 2일차)",
    "where_summary": "이 화의 주요 배경 장소",
    "who_summary": "등장인물 목록과 역할",
    "what_summary": "핵심 사건 요약 (3줄 이내)",
    "why_summary": "이 사건이 왜 일어났는지 동기/원인",
    "how_summary": "어떻게 해결/진행되었는지",
    "asset_change": "자산 변동 (예: 은 200냥 획득)",
    "martial_change": "무공 변동 (예: 천마신공 3성 돌입)",
    "org_change": "조직 변동 (예: 소향루 인수)",
    "relationship_change": "관계 변동 (예: 서린과 신뢰 형성)",
    "location_change": "위치 이동 (예: 낙양 → 개봉)",
    "health_change": "건강/부상 변동 (예: 좌측 갈비뼈 금 감)",
    "foreshadow_planted": "이 화에서 새로 투하된 복선",
    "foreshadow_hinted": "기존 복선에 대한 힌트",
    "foreshadow_resolved": "이 화에서 회수된 복선",
    "dominant_personality": "이 화의 주도 인격 (위소운/이준혁/천마 중)",
    "personality_conflict": "인격 간 갈등 (있으면)",
    "personality_growth": "인격 성장/변화 (있으면)",
    "key_dialogue": "이 화의 가장 인상적인 대사 1개",
    "cliffhanger": "이 화의 절단신공/마지막 긴장 요소",
    "next_preview": "다음 화 예상 전개",
    "next_caution": "다음 화 집필 시 주의사항"
  },
  "dashboard": {
    "story_date": "작중 현재 날짜",
    "current_location": "이 화 끝 시점의 주인공 위치",
    "season": "계절",
    "weather": "날씨 (언급 있으면)",
    "mc_health": "주인공 건강 상태 (이 화 끝 기준)",
    "mc_martial_rank": "무공 등급 (이 화 끝 기준)",
    "mc_internal_energy": "내공 상태",
    "mc_money": "현재 보유 자산",
    "mc_injury": "현재 부상 상태",
    "mc_emotion": "감정 상태",
    "mc_current_goal": "현재 목표",
    "active_foreshadows": "현재 활성 복선 목록 (JSON 배열)",
    "next_cautions": "다음 화 주의사항"
  }
}
\`\`\`

중요 규칙:
1. 반드시 위 JSON 형식으로만 응답하세요.
2. 본문에 명시된 내용만 기재하세요. 추측하지 마세요.
3. 해당 항목이 없으면 빈 문자열("")로 두세요.
4. 이전 화 참조를 통해 변동사항을 정확히 파악하세요.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI 결과 파서
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function parseConfirmResult(raw: string): { memoryCard: any; dashboard: any } | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.memoryCard) return null;
    return {
      memoryCard: parsed.memoryCard || {},
      dashboard: parsed.dashboard || {},
    };
  } catch {
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI 호출 (OpenAI / Claude / Gemini 순서로 시도)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function callAI(prompt: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const maxTokens = 4000;
  const systemMsg = '당신은 무협소설 분석 전문가입니다. 반드시 요청된 JSON 형식으로만 응답하세요.';

  if (geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemMsg}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) throw new Error(`Gemini 호출 실패 (${res.status})`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  }

  if (claudeKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        temperature: 0.2,
        system: systemMsg,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Claude 호출 실패 (${res.status})`);
    const data: any = await res.json();
    return data?.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') || '';
  }

  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI 호출 실패 (${res.status})`);
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  }

  return '';
}
