import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [기획 데이터 API] - novel_plans 테이블 CRUD
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * plan_key 목록:
 *   'spec'       → 기본 설정 (제목, 장르, 총화수, 줄거리)
 *   'sections'   → 기승전결 (4개 섹션)
 *   'episodes'   → 전체 화 뼈대 (300화)
 *   'designs'    → 상세 설계 (화별 5단계)
 *   'pins'       → 참조 핀 목록
 *
 * GET  ?key=spec            → 단일 키 조회
 * GET  ?keys=spec,sections  → 복수 키 조회
 * POST { key, data }       → 저장 (upsert)
 */

const SERIES_ID = process.env.SERIES_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ── GET: 기획 데이터 조회 ──
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: false, error: 'Supabase 미설정' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const singleKey = searchParams.get('key');
    const multiKeys = searchParams.get('keys');

    if (singleKey) {
      const { data, error } = await supabase
        .from('novel_plans')
        .select('plan_key, data, updated_at')
        .eq('series_id', SERIES_ID)
        .eq('plan_key', singleKey)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return NextResponse.json({
        success: true,
        plan: data ? { key: data.plan_key, data: data.data, updated_at: data.updated_at } : null,
      });
    }

    if (multiKeys) {
      const keys = multiKeys.split(',').map(k => k.trim());
      const { data, error } = await supabase
        .from('novel_plans')
        .select('plan_key, data, updated_at')
        .eq('series_id', SERIES_ID)
        .in('plan_key', keys);

      if (error) throw error;

      const result: Record<string, any> = {};
      (data || []).forEach((row: any) => {
        result[row.plan_key] = { data: row.data, updated_at: row.updated_at };
      });

      return NextResponse.json({ success: true, plans: result });
    }

    // 키 미지정 → 전체 조회
    const { data, error } = await supabase
      .from('novel_plans')
      .select('plan_key, data, updated_at')
      .eq('series_id', SERIES_ID);

    if (error) throw error;

    const result: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      result[row.plan_key] = { data: row.data, updated_at: row.updated_at };
    });

    return NextResponse.json({ success: true, plans: result });
  } catch (error: any) {
    console.error('novel-plans GET 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── POST: 기획 데이터 저장 (upsert) ──
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: false, error: 'Supabase 미설정' }, { status: 500 });
    }

    const body = await request.json();
    const { key, data } = body;

    if (!key || data === undefined) {
      return NextResponse.json(
        { success: false, error: 'key와 data가 필요합니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('novel_plans')
      .upsert(
        {
          series_id: SERIES_ID,
          plan_key: key,
          data: data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'series_id,plan_key' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, key, message: `${key} 저장 완료` });
  } catch (error: any) {
    console.error('novel-plans POST 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
