import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [화별 기억 카드 API]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * GET: 기억카드 조회 (전체 / 특정 화)
 *   - ?episode=1  → 1화 기억카드
 *   - ?recent=5   → 최근 5화 기억카드
 *   - (없음)      → 전체 기억카드 목록
 * 
 * POST: 기억카드 생성/수정 (집필 완료 후 자동 호출)
 */

const SERIES_ID = process.env.SERIES_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ── GET: 기억카드 조회 ──
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase 미설정' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const episode = searchParams.get('episode');
    const recent = searchParams.get('recent');

    let query = supabase
      .from('memory_cards')
      .select('*')
      .eq('series_id', SERIES_ID)
      .order('episode_number', { ascending: true });

    // 특정 화 조회
    if (episode) {
      query = query.eq('episode_number', parseInt(episode));
    }
    // 최근 N화 조회
    else if (recent) {
      query = query.order('episode_number', { ascending: false }).limit(parseInt(recent));
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      cards: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ── POST: 기억카드 생성/수정 ──
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase 미설정' }, { status: 500 });
    }

    const body = await request.json();

    // 필수 필드 검증
    if (!body.episode_number) {
      return NextResponse.json(
        { error: '화 번호(episode_number)가 필요합니다.' },
        { status: 400 }
      );
    }

    // DB에 upsert
    const { data, error } = await supabase
      .from('memory_cards')
      .upsert({
        series_id: SERIES_ID,
        episode_number: body.episode_number,
        episode_title: body.episode_title || '',
        // 6하원칙
        when_summary: body.when_summary || '',
        where_summary: body.where_summary || '',
        who_summary: body.who_summary || '',
        what_summary: body.what_summary || '',
        why_summary: body.why_summary || '',
        how_summary: body.how_summary || '',
        // 상태 변화
        asset_change: body.asset_change || '',
        martial_change: body.martial_change || '',
        org_change: body.org_change || '',
        relationship_change: body.relationship_change || '',
        location_change: body.location_change || '',
        health_change: body.health_change || '',
        // 떡밥
        foreshadow_planted: body.foreshadow_planted || '',
        foreshadow_hinted: body.foreshadow_hinted || '',
        foreshadow_resolved: body.foreshadow_resolved || '',
        // 3인격
        dominant_personality: body.dominant_personality || '',
        personality_conflict: body.personality_conflict || '',
        personality_growth: body.personality_growth || '',
        // 핵심 대사
        key_dialogue: body.key_dialogue || '',
        // 다음 화 연결
        cliffhanger: body.cliffhanger || '',
        next_preview: body.next_preview || '',
        next_caution: body.next_caution || '',
      }, {
        onConflict: 'series_id,episode_number'
      });

    if (error) throw error;

    console.log(`✅ ${body.episode_number}화 기억카드 저장 완료`);

    return NextResponse.json({
      success: true,
      episode: body.episode_number,
      message: `${body.episode_number}화 기억카드가 저장되었습니다.`,
    });
  } catch (error: any) {
    console.error('❌ 기억카드 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
