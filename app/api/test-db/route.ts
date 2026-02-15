import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * [Supabase 연결 테스트 API]
 * 데이터베이스 테이블과 데이터 확인
 */
export async function GET() {
  try {
    // 환경 변수 확인
    if (!isSupabaseConfigured) {
      return NextResponse.json({
        success: false,
        message: 'Supabase 환경 변수가 설정되지 않았습니다.'
      }, { status: 500 });
    }

    const result: any = {
      success: true,
      connected: true,
      tables: {},
      timestamp: new Date().toISOString()
    };

    // ── 테이블 점검 목록 (실제 존재하는 테이블 기준) ──
    const tableChecks = [
      { name: 'characters', select: 'id, name, role', label: '캐릭터' },
      { name: 'world_db_documents', select: 'id, filename, category, char_count', label: '세계관 문서' },
      { name: 'memory_cards', select: 'id, episode_number, episode_title', label: '기억 카드' },
      { name: 'novel_dashboard', select: 'id, latest_episode, story_date, current_location', label: '상태 대시보드' },
      { name: 'episodes', select: 'id, episode_number, title, status', label: '에피소드' },
    ];

    for (const table of tableChecks) {
      try {
        const { data, error, count } = await supabase
          .from(table.name)
          .select(table.select, { count: 'exact' })
          .limit(3);

        result.tables[table.name] = {
          label: table.label,
          exists: !error,
          count: count || data?.length || 0,
          sample: data || [],
          error: error?.message
        };
      } catch (e: any) {
        result.tables[table.name] = { label: table.label, exists: false, error: e.message };
      }
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '데이터베이스 연결 실패',
      error: error.message
    }, { status: 500 });
  }
}
