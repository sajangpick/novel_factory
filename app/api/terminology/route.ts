import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [용어집 API] (legacy_ref/terminology 이전)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * GET: Supabase 'terminology' 테이블에서 용어 목록 조회
 * - seriesId 필수 파라미터
 * - 환경변수만 사용 (키 하드코딩 금지)
 */

export async function GET(request: NextRequest) {
  try {
    // 환경변수에서 Supabase 정보 가져오기
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        message: 'Supabase 환경변수가 설정되지 않았습니다.'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');

    if (!seriesId) {
      return NextResponse.json({
        success: false,
        message: 'seriesId가 필요합니다.'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('terminology')
      .select('*')
      .eq('series_id', seriesId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('용어집 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '용어집 조회 중 오류가 발생했습니다.',
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      terminology: data || []
    });

  } catch (error: any) {
    console.error('용어집 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    }, { status: 500 });
  }
}
