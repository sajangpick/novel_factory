import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [현재 상태 대시보드 API]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * GET: 현재 대시보드 상태 조회
 * POST: 대시보드 업데이트 (집필 완료 후 자동 호출)
 * 
 * 이 API는 "지금 소설 세계가 어떤 상태인지"를 한 번에 보여줍니다.
 * CEO가 대시보드 하나로 회사 상황을 파악하듯,
 * AI가 이 데이터 하나로 "지금 어디까지 진행됐는지" 즉시 파악합니다.
 */

const SERIES_ID = process.env.SERIES_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ── GET: 대시보드 조회 ──
export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase 미설정' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('novel_dashboard')
      .select('*')
      .eq('series_id', SERIES_ID)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      dashboard: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ── POST: 대시보드 업데이트 ──
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase 미설정' }, { status: 500 });
    }

    const body = await request.json();

    // 업데이트할 필드만 추출 (undefined 제거)
    const updateData: Record<string, any> = { series_id: SERIES_ID };

    // 현재 시점
    if (body.latest_episode !== undefined) updateData.latest_episode = body.latest_episode;
    if (body.story_date !== undefined) updateData.story_date = body.story_date;
    if (body.season !== undefined) updateData.season = body.season;
    if (body.weather !== undefined) updateData.weather = body.weather;
    if (body.current_location !== undefined) updateData.current_location = body.current_location;
    if (body.next_episode_title !== undefined) updateData.next_episode_title = body.next_episode_title;

    // 위소운 상태
    if (body.mc_age !== undefined) updateData.mc_age = body.mc_age;
    if (body.mc_health !== undefined) updateData.mc_health = body.mc_health;
    if (body.mc_martial_rank !== undefined) updateData.mc_martial_rank = body.mc_martial_rank;
    if (body.mc_internal_energy !== undefined) updateData.mc_internal_energy = body.mc_internal_energy;
    if (body.mc_available_skills !== undefined) updateData.mc_available_skills = body.mc_available_skills;
    if (body.mc_money !== undefined) updateData.mc_money = body.mc_money;
    if (body.mc_injury !== undefined) updateData.mc_injury = body.mc_injury;
    if (body.mc_emotion !== undefined) updateData.mc_emotion = body.mc_emotion;
    if (body.mc_current_goal !== undefined) updateData.mc_current_goal = body.mc_current_goal;

    // 3인격 상태
    if (body.three_personality !== undefined) updateData.three_personality = body.three_personality;
    if (body.personality_conflict !== undefined) updateData.personality_conflict = body.personality_conflict;
    if (body.personality_agreement !== undefined) updateData.personality_agreement = body.personality_agreement;
    if (body.personality_growth !== undefined) updateData.personality_growth = body.personality_growth;

    // 조직 상태
    if (body.org_name !== undefined) updateData.org_name = body.org_name;
    if (body.org_members !== undefined) updateData.org_members = body.org_members;
    if (body.org_base !== undefined) updateData.org_base = body.org_base;
    if (body.org_monthly_income !== undefined) updateData.org_monthly_income = body.org_monthly_income;
    if (body.org_monthly_expense !== undefined) updateData.org_monthly_expense = body.org_monthly_expense;
    if (body.org_businesses !== undefined) updateData.org_businesses = body.org_businesses;

    // 경제/전투
    if (body.total_assets !== undefined) updateData.total_assets = body.total_assets;
    if (body.combat_experience !== undefined) updateData.combat_experience = body.combat_experience;
    if (body.latest_combat !== undefined) updateData.latest_combat = body.latest_combat;
    if (body.combat_injury !== undefined) updateData.combat_injury = body.combat_injury;

    // 떡밥/타임라인
    if (body.active_foreshadows !== undefined) updateData.active_foreshadows = body.active_foreshadows;
    if (body.next_cautions !== undefined) updateData.next_cautions = body.next_cautions;
    if (body.recent_timeline !== undefined) updateData.recent_timeline = body.recent_timeline;

    // DB에 upsert
    const { error } = await supabase
      .from('novel_dashboard')
      .upsert(updateData, { onConflict: 'series_id' });

    if (error) throw error;

    console.log(`✅ 대시보드 업데이트 완료 (${Object.keys(updateData).length - 1}개 필드)`);

    return NextResponse.json({
      success: true,
      message: '대시보드가 업데이트되었습니다.',
      updatedFields: Object.keys(updateData).filter(k => k !== 'series_id'),
    });
  } catch (error: any) {
    console.error('❌ 대시보드 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
