import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [에피소드 DB 관리 API] (legacy_ref/insert-episode + save-manuscript 통합)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * GET : 에피소드 목록 조회 (seriesId 필수)
 * POST: 에피소드 생성 또는 업데이트 (upsert)
 *       - 원고 저장 기능 포함
 * 
 * Supabase 'episodes' 테이블 사용
 * 환경변수만 사용 (키 하드코딩 금지)
 */

// ── Supabase 클라이언트 생성 (환경변수 기반) ──
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── GET: 에피소드 목록 조회 ──
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Supabase 환경변수 미설정' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');

    if (!seriesId) {
      return NextResponse.json({ success: false, message: 'seriesId가 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('series_id', seriesId)
      .order('episode_number', { ascending: true });

    if (error) {
      console.error('에피소드 조회 오류:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      episodes: data || [],
      count: data?.length || 0,
    });

  } catch (error: any) {
    console.error('에피소드 목록 오류:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ── POST: 에피소드 생성/업데이트 (upsert) + 원고 저장 ──
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Supabase 환경변수 미설정' }, { status: 500 });
    }

    const body = await request.json();
    const {
      seriesId,
      episodeNumber,
      title,
      plotSummary,
      manuscript,
      status = 'completed',
      // save-manuscript 모드: episodeId만 있으면 원고만 업데이트
      episodeId,
    } = body;

    const now = new Date().toISOString();

    // ── 모드 1: episodeId로 원고만 업데이트 (save-manuscript 기능) ──
    if (episodeId && manuscript) {
      const { data, error } = await supabase
        .from('episodes')
        .update({
          manuscript,
          word_count: manuscript.replace(/\s+/g, '').length,
          status: 'writing',
          updated_at: now,
        })
        .eq('id', episodeId)
        .select();

      if (error) {
        console.error('원고 저장 오류:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '원고가 저장되었습니다.',
        episode: data?.[0],
      });
    }

    // ── 모드 2: 에피소드 생성/업데이트 (insert-episode 기능) ──
    if (!seriesId || !episodeNumber || !title) {
      return NextResponse.json({
        success: false,
        message: 'seriesId, episodeNumber, title은 필수입니다.',
      }, { status: 400 });
    }

    const wordCount = manuscript ? manuscript.replace(/\s+/g, '').length : 0;

    // 기존 에피소드 확인
    const { data: existing } = await supabase
      .from('episodes')
      .select('id')
      .eq('series_id', seriesId)
      .eq('episode_number', episodeNumber)
      .single();

    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('episodes')
        .update({
          title,
          plot_summary: plotSummary || null,
          manuscript: manuscript || null,
          word_count: wordCount,
          status,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select();

      if (error) {
        console.error('에피소드 업데이트 오류:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `제${episodeNumber}화가 업데이트되었습니다.`,
        episode: data?.[0],
      });
    } else {
      // 신규 삽입
      const { data, error } = await supabase
        .from('episodes')
        .insert({
          series_id: seriesId,
          episode_number: episodeNumber,
          title,
          plot_summary: plotSummary || null,
          manuscript: manuscript || null,
          word_count: wordCount,
          status,
          created_at: now,
          updated_at: now,
        })
        .select();

      if (error) {
        console.error('에피소드 삽입 오류:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `제${episodeNumber}화가 추가되었습니다.`,
        episode: data?.[0],
      });
    }

  } catch (error: any) {
    console.error('에피소드 처리 오류:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
