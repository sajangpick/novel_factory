import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [에피소드 로딩 API] - 파일 우선, DB 폴백
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 읽기 순서:
 * 1. 파일 (novels/murim_mna/output/제N화.md) — 원본
 * 2. DB (Supabase episodes 테이블) — 백업
 * 
 * GET ?episode=14  → 특정 화 로드
 * GET ?list=true   → 존재하는 화 목록 (파일 기준)
 */

const OUTPUT_DIR = join(process.cwd(), 'novels', 'murim_mna', 'output');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const episodeNum = searchParams.get('episode');
    const listMode = searchParams.get('list');

    // ═══════════════════════════════════════════════════
    // 목록 모드: 존재하는 화 번호 + 글자수 반환
    // ═══════════════════════════════════════════════════
    if (listMode) {
      const episodes: { number: number; charCount: number; source: string }[] = [];

      if (existsSync(OUTPUT_DIR)) {
        const files = readdirSync(OUTPUT_DIR)
          .filter((f: string) => f.match(/^제\d+화\.md$/))
          .sort((a: string, b: string) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
          });

        for (const file of files) {
          const num = parseInt(file.match(/\d+/)?.[0] || '0');
          const content = readFileSync(join(OUTPUT_DIR, file), 'utf-8');
          // 마크다운 헤더 제거하고 본문만 카운트
          const body = content.replace(/^#[^\n]*\n+---\n+/, '');
          episodes.push({
            number: num,
            charCount: body.replace(/\s/g, '').length,
            source: 'file',
          });
        }
      }

      return NextResponse.json({
        success: true,
        episodes,
        count: episodes.length,
        maxEpisode: episodes.length > 0 ? Math.max(...episodes.map((e: any) => e.number)) : 0,
      });
    }

    // ═══════════════════════════════════════════════════
    // 특정 화 로딩
    // ═══════════════════════════════════════════════════
    if (!episodeNum) {
      return NextResponse.json({
        success: false,
        message: '?episode=N 또는 ?list=true 파라미터가 필요합니다.',
      }, { status: 400 });
    }

    const num = parseInt(episodeNum);
    let content = '';
    let source = '';
    let fileContent = '';
    let dbContent = '';

    // ── 1단계: 파일에서 읽기 ──
    const filePath = join(OUTPUT_DIR, `제${num}화.md`);
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf-8');
      fileContent = raw.replace(/^#[^\n]*\n+---\n+/, '').trim();
    }

    // ── 2단계: DB에서 읽기 ──
    const wasDeleted = !existsSync(filePath) && existsSync(OUTPUT_DIR) && readdirSync(OUTPUT_DIR).some((f: string) => f.startsWith(`제${num}화_폐기`));
    if (!wasDeleted) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);

          const { data } = await supabase
            .from('episodes')
            .select('manuscript, title, updated_at')
            .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
            .eq('episode_number', num)
            .single();

          if (data?.manuscript) {
            dbContent = data.manuscript;
          }
        }
      } catch (e) {
        console.warn(`⚠️ DB 로드 실패 (무시):`, e);
      }
    } else {
      console.log(`🚫 제${num}화 폐기 파일 감지 — DB 폴백 건너뜀`);
    }

    // ── 3단계: DB 우선 (네트워크에서 수정한 최신 데이터), 없으면 파일 폴백 ──
    if (dbContent) {
      content = dbContent;
      source = 'database';
      console.log(`🗄️ 제${num}화 DB에서 로드 (${content.length}자)`);
    } else if (fileContent) {
      content = fileContent;
      source = 'file';
      console.log(`📖 제${num}화 파일에서 로드 (${content.length}자)`);
    }

    // ── 결과 반환 ──
    if (!content) {
      return NextResponse.json({
        success: true,
        found: false,
        episode: num,
        content: '',
        source: 'none',
      });
    }

    return NextResponse.json({
      success: true,
      found: true,
      episode: num,
      content,
      charCount: content.replace(/\s/g, '').length,
      source,
    });

  } catch (error: any) {
    console.error('❌ 에피소드 로드 오류:', error);
    return NextResponse.json({
      success: false,
      message: error.message,
    }, { status: 500 });
  }
}
