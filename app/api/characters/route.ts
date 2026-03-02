import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * [캐릭터 CRUD API]
 * 
 * RLS 정책이 authenticated만 허용하므로,
 * 서버 사이드에서 service_role_key를 사용하여 INSERT/UPDATE/DELETE 처리
 */

// Supabase 서버 클라이언트 (service role key 사용 → RLS 우회)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }

  return createClient(url, key);
}

// ━━━ POST: 캐릭터 추가 (단건 또는 배열) ━━━
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { character, characters: charArray } = body;

    const supabase = getSupabase();

    // 배열 일괄 등록 (흑호단 등)
    if (charArray && Array.isArray(charArray) && charArray.length > 0) {
      const { data, error } = await supabase
        .from('characters')
        .insert(charArray)
        .select();

      if (error) {
        console.error('❌ 캐릭터 일괄 추가 실패:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data, count: data?.length || 0 });
    }

    // 단건 등록
    if (!character || !character.name) {
      return NextResponse.json(
        { error: '캐릭터 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('characters')
      .insert(character)
      .select()
      .single();

    if (error) {
      console.error('❌ 캐릭터 추가 실패:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('❌ 캐릭터 추가 API 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// ━━━ PUT: 캐릭터 수정 ━━━
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: '캐릭터 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('characters')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('❌ 캐릭터 수정 실패:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ 캐릭터 수정 API 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// ━━━ DELETE: 캐릭터 삭제 ━━━
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '캐릭터 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('❌ 캐릭터 삭제 실패:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ 캐릭터 삭제 API 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
