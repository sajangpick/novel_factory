import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [World DB 동기화 API - v2]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * novels/murim_mna/world_db/ 폴더의 MD 파일 → Supabase world_db_documents 테이블
 * 
 * - GET: 현재 동기화 상태 조회 (DB에 몇 개 파일이 있는지)
 * - POST: 전체 MD 파일 동기화 실행
 *   - body 없이 호출하면 전체 38개 파일 자동 스캔
 *   - body에 { files: [...] } 전달하면 해당 파일만 동기화
 */

// ── MD 파일 카테고리 자동 분류 ──
const CATEGORY_MAP: Record<string, string> = {
  '캐릭터_인명록': '캐릭터',
  '캐릭터_성장표': '캐릭터',
  '300화_출연자_배치표': '캐릭터',
  '지리_상세': '지리',
  '이동_동선_DB': '지리',
  '주인공_루트맵': '지리',
  '지역별_객잔_DB': '지리',
  '무공_시스템': '무공',
  '전투_안무가이드': '무공',
  '무기_병기_DB': '무공',
  '세력도': '세력',
  '조직도_완전판': '세력',
  '관계_변화_추적': '세력',
  '300화_로드맵': '스토리',
  '명장면_설계서': '스토리',
  '초반3화_훅설계서': '스토리',
  '절단신공_포인트맵': '스토리',
  '떡밥_관리표': '스토리',
  '감정곡선_텐션그래프': '스토리',
  '테마_주제의식': '스토리',
  '독자_타겟분석': '스토리',
  '경쟁작_차별화': '스토리',
  '6하원칙_설계_템플릿': '스토리',
  'Step3_스켈레톤_형식': '스토리',
  '에피소드_추적_시스템': '시스템',
  '화별_기억카드': '시스템',
  '현재_상태_대시보드': '시스템',
  '문체_가이드': '문체',
  '무협_용어집': '용어',
  '경영_용어집': '용어',
  '팩트_체크_DB': '고증',
  'Ancient_China_Spec': '고증',
  '음식_건축_DB': '생활',
  '의복_복식_DB': '생활',
  '날씨_계절_타임라인': '생활',
  '경제_시스템_심화': '경제',
  '이준혁_현대지식_DB': '경제',
};

// ── 카테고리 추론 (매핑에 없는 경우) ──
function getCategory(filename: string): string {
  // 매핑에서 찾기
  if (CATEGORY_MAP[filename]) return CATEGORY_MAP[filename];
  
  // 키워드 기반 추론
  if (filename.includes('캐릭터') || filename.includes('인명')) return '캐릭터';
  if (filename.includes('지리') || filename.includes('객잔') || filename.includes('동선')) return '지리';
  if (filename.includes('무공') || filename.includes('전투') || filename.includes('무기')) return '무공';
  if (filename.includes('세력') || filename.includes('조직')) return '세력';
  if (filename.includes('로드맵') || filename.includes('설계') || filename.includes('떡밥')) return '스토리';
  if (filename.includes('용어')) return '용어';
  
  return '기타';
}

// ── GET: 동기화 상태 조회 ──
export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      // Supabase 미설정 시 로컬 파일 목록 반환
      const worldDbDir = path.join(process.cwd(), 'novels', 'murim_mna', 'world_db');
      const files = await fs.readdir(worldDbDir);
      const mdFiles = files.filter((f: string) => f.endsWith('.md'));
      return NextResponse.json({ 
        count: mdFiles.length, 
        source: 'local',
        files: mdFiles.map((f: string) => f.replace('.md', ''))
      });
    }

    // DB에서 문서 수 조회
    const { data, error } = await supabase
      .from('world_db_documents')
      .select('id, filename, category, char_count, last_synced_at')
      .eq('series_id', process.env.SERIES_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      .order('category');

    if (error) throw error;

    return NextResponse.json({
      count: data?.length || 0,
      source: 'supabase',
      files: data || [],
    });
  } catch (error: any) {
    return NextResponse.json({ 
      count: 0, 
      source: 'error', 
      error: error.message 
    });
  }
}

// ── POST: MD 파일 동기화 실행 ──
export async function POST(request: Request) {
  try {
    // [1] Supabase 설정 확인
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: 'Supabase가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const seriesId = process.env.SERIES_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const worldDbDir = path.join(process.cwd(), 'novels', 'murim_mna', 'world_db');

    // [2] body 확인 — 특정 파일만 / 전체 스캔
    let targetFiles: string[] = [];
    
    try {
      const body = await request.json();
      if (body.files && Array.isArray(body.files)) {
        targetFiles = body.files;
      }
    } catch {
      // body 없으면 전체 스캔
    }

    // [3] 전체 스캔: novels/murim_mna/world_db/*.md 파일 목록
    if (targetFiles.length === 0) {
      const allFiles = await fs.readdir(worldDbDir);
      targetFiles = allFiles.filter((f: string) => f.endsWith('.md'));
    }

    console.log(`📂 동기화 대상: ${targetFiles.length}개 파일`);

    // [4] 각 MD 파일 읽어서 DB에 upsert
    const results = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const file of targetFiles) {
      try {
        // 파일명 정리
        const mdFilename = file.endsWith('.md') ? file : `${file}.md`;
        const filename = mdFilename.replace('.md', '');
        const filepath = `novels/murim_mna/world_db/${mdFilename}`;
        const fullPath = path.join(worldDbDir, mdFilename);

        // 파일 읽기
        const content = await fs.readFile(fullPath, 'utf-8');
        const charCount = content.replace(/\s/g, '').length;
        
        // 체크섬 계산 (내용 변경 감지)
        const checksum = crypto.createHash('md5').update(content).digest('hex');
        
        // 카테고리 분류
        const category = getCategory(filename);

        // DB에 upsert (같은 series_id + filename이면 업데이트)
        const { error } = await supabase
          .from('world_db_documents')
          .upsert({
            series_id: seriesId,
            filename,
            filepath,
            category,
            content,
            char_count: charCount,
            checksum,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'series_id,filename'
          });

        if (error) {
          console.error(`❌ ${filename}: ${error.message}`);
          results.push({ file: filename, status: 'error', error: error.message });
          errorCount++;
        } else {
          console.log(`✅ ${filename} (${category}, ${charCount}자)`);
          results.push({ file: filename, status: 'success', category, charCount });
          successCount++;
        }
      } catch (fileError: any) {
        const fname = file.replace('.md', '');
        console.error(`❌ ${fname}: ${fileError.message}`);
        results.push({ file: fname, status: 'error', error: fileError.message });
        errorCount++;
      }
    }

    // [5] 결과 반환
    console.log(`\n📊 동기화 완료: 성공 ${successCount} / 스킵 ${skipCount} / 실패 ${errorCount}`);

    return NextResponse.json({
      success: true,
      total: targetFiles.length,
      synced: successCount,
      skipped: skipCount,
      errors: errorCount,
      details: results,
    });

  } catch (error: any) {
    console.error('[API 오류] sync-worlddb:', error);
    return NextResponse.json(
      { error: '동기화 실패', message: error.message },
      { status: 500 }
    );
  }
}
