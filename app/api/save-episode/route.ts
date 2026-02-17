import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [에피소드 통합 저장 API] - 파일 + 데이터베이스 동시 저장
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 저장 버튼 한 번으로:
 * 1. 파일 저장: novels/murim_mna/output/제N화.md (원본, AI 참조용)
 * 2. DB 저장: Supabase episodes 테이블 (메타데이터 + 백업)
 * 3. localStorage는 프론트에서 별도 처리 (캐시)
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { episodeNumber, episodeTitle, content } = body;

    if (!episodeNumber || !content) {
      return NextResponse.json({
        success: false,
        message: '화 번호와 본문이 필요합니다.',
      }, { status: 400 });
    }

    const results = { file: false, db: false, fileError: '', dbError: '' };
    const wordCount = content.replace(/\s+/g, '').length;

    // ═══════════════════════════════════════════════════
    // 1. 파일 저장 (원본)
    // ═══════════════════════════════════════════════════
    try {
      const outputDir = join(process.cwd(), 'novels', 'murim_mna', 'output');
      // 폴더 없으면 생성
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const filePath = join(outputDir, `제${episodeNumber}화.md`);

      // 마크다운 헤더 추가
      const fileContent = `# 제${episodeNumber}화${episodeTitle ? ` — ${episodeTitle}` : ''}

---

${content}
`;

      writeFileSync(filePath, fileContent, 'utf-8');
      results.file = true;
      console.log(`📁 제${episodeNumber}화 파일 저장 완료: ${filePath} (${wordCount.toLocaleString()}자)`);
    } catch (e: any) {
      results.fileError = e.message;
      console.error(`❌ 파일 저장 실패:`, e.message);
    }

    // ═══════════════════════════════════════════════════
    // 2. DB 저장 (메타데이터 + 백업)
    // ═══════════════════════════════════════════════════
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const seriesId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        const now = new Date().toISOString();

        // 기존 에피소드 확인
        const { data: existing } = await supabase
          .from('episodes')
          .select('id')
          .eq('series_id', seriesId)
          .eq('episode_number', episodeNumber)
          .single();

        if (existing) {
          // 업데이트
          await supabase.from('episodes').update({
            title: episodeTitle || `제${episodeNumber}화`,
            manuscript: content,
            word_count: wordCount,
            status: 'completed',
            updated_at: now,
          }).eq('id', existing.id);
        } else {
          // 신규 삽입
          await supabase.from('episodes').insert({
            series_id: seriesId,
            episode_number: episodeNumber,
            title: episodeTitle || `제${episodeNumber}화`,
            manuscript: content,
            word_count: wordCount,
            status: 'completed',
            created_at: now,
            updated_at: now,
          });
        }
        results.db = true;
        console.log(`🗄️ 제${episodeNumber}화 DB 저장 완료 (Supabase)`);
      } else {
        results.dbError = 'Supabase 환경변수 미설정 (무시)';
      }
    } catch (e: any) {
      results.dbError = e.message;
      console.error(`❌ DB 저장 실패 (무시):`, e.message);
    }

    // ═══════════════════════════════════════════════════
    // 응답
    // ═══════════════════════════════════════════════════
    const message = [
      results.file ? '📁 파일 저장 ✅' : `📁 파일 저장 ❌ (${results.fileError})`,
      results.db ? '🗄️ DB 저장 ✅' : `🗄️ DB 저장 ⚠️ (${results.dbError || '건너뜀'})`,
    ].join(' · ');

    return NextResponse.json({
      success: results.file, // 파일 저장이 핵심
      message,
      results,
      wordCount,
    });

  } catch (error: any) {
    console.error('❌ 에피소드 저장 오류:', error);
    return NextResponse.json({
      success: false,
      message: `저장 실패: ${error.message}`,
    }, { status: 500 });
  }
}
