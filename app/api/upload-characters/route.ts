import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * [캐릭터 데이터 Supabase 업로드 API]
 * 
 * localStorage → Supabase 마이그레이션
 */

export async function POST(req: NextRequest) {
  try {
    const { characters } = await req.json();

    if (!characters || !Array.isArray(characters)) {
      return NextResponse.json(
        { error: '캐릭터 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`📤 ${characters.length}명 업로드 시작...`);

    // Supabase 클라이언트 (service role key → RLS 우회)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 기존 데이터 삭제 (깨끗하게 시작) — RLS 우회를 위해 모든 행을 ID 범위로 삭제
    console.log('🗑️ 기존 캐릭터 데이터 삭제 중...');
    
    // 먼저 모든 ID를 가져와서 배치 삭제 (RLS가 delete를 허용하지 않을 수 있으므로)
    const { data: existingIds, error: fetchError } = await supabase
      .from('characters')
      .select('id')
      .limit(5000);
    
    if (existingIds && existingIds.length > 0) {
      // 100개씩 배치 삭제
      const ids = existingIds.map((r: any) => r.id);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error: delErr } = await supabase
          .from('characters')
          .delete()
          .in('id', batch);
        
        if (delErr) {
          console.warn(`배치 삭제 실패 (${i}~${i+batch.length}):`, delErr.message);
        } else {
          console.log(`✅ ${i + batch.length}/${ids.length} 삭제 완료`);
        }
      }
    }
    
    // 삭제 확인
    const { count: remainingCount } = await supabase
      .from('characters')
      .select('id', { count: 'exact', head: true });
    console.log(`삭제 후 남은 캐릭터: ${remainingCount}명`);

    // 캐릭터 데이터 변환 (확장 필드 매핑 — 2026-02-09 삼국지 방식 업데이트)
    const transformedCharacters = characters.map((char: any) => ({
      // 기본 정보
      name: char.name,
      title: char.title || null,
      role: char.role,
      
      // 소속
      faction: char.faction || null,
      faction_type: char.faction_type || null,
      group_title: char.group_title || null,
      group_position: char.group_position || null,
      
      // 외모 및 체격
      age: char.age || null,
      appearance: char.appearance || null,
      
      // 무공
      martial_rank: char.martial_rank || null,
      martial_rank_numeric: char.martial_rank_numeric ?? getMartialRankNumeric(char.martial_rank),
      weapon: char.weapon || null,
      
      // 성격 & 말투
      personality: char.personality || null,
      speech_style: char.speech_style || null,
      catchphrase: char.catchphrase || null,
      
      // 배경 스토리
      backstory: char.backstory || null,
      
      // 스토리 메타
      first_appearance: char.first_appearance || null,
      last_appearance: char.last_appearance || null,
      death_episode: char.death_episode || null,
      is_recurring: char.is_recurring ?? true,
      importance_score: char.importance_score ?? 0,
      
      // 시리즈 ID
      series_id: null,
    }));

    // Supabase에 업로드 (배치 처리)
    let successCount = 0;
    let errorCount = 0;

    // 50명씩 배치 업로드
    const batchSize = 50;
    for (let i = 0; i < transformedCharacters.length; i += batchSize) {
      const batch = transformedCharacters.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('characters')
        .insert(batch)
        .select();

      if (error) {
        console.error(`배치 ${i}-${i + batch.length} 실패:`, error);
        errorCount += batch.length;
      } else {
        successCount += data?.length || 0;
        console.log(`✅ ${i + batch.length}/${transformedCharacters.length}명 완료`);
      }
    }

    console.log(`🎉 업로드 완료: 성공 ${successCount}명, 실패 ${errorCount}명`);

    return NextResponse.json({
      success: true,
      total: characters.length,
      uploaded: successCount,
      failed: errorCount,
      message: `✅ ${successCount}명 Supabase 업로드 완료!`,
    });
  } catch (error) {
    console.error('❌ 업로드 오류:', error);
    return NextResponse.json(
      {
        error: '업로드 중 오류 발생',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 무공 등급 → 숫자 변환
 */
function getMartialRankNumeric(rank: string | undefined): number {
  if (!rank) return 0;
  
  const rankMap: { [key: string]: number } = {
    '삼류급': 1,
    '이류급': 2,
    '일류급': 3,
    '준화경급': 4,
    '화경급': 5,
    '준현경급': 6,
    '현경급': 7,
    '준천인급': 8,
    '천인급': 9,
    '절대고수': 10,
  };
  
  return rankMap[rank] || 0;
}
