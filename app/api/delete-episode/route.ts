import { NextRequest, NextResponse } from 'next/server';
import { existsSync, renameSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [화 폐기 API] - 생성된 화를 삭제 (파일 + DB)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 잘못 생성된 화를 폐기하고 다시 생성할 수 있도록 합니다.
 * 안전장치: 파일은 삭제 대신 .폐기 로 이름 변경 (복원 가능)
 * 
 * DELETE /api/delete-episode?episode=14
 */

const OUTPUT_DIR = join(process.cwd(), 'novels', 'murim_mna', 'output');

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const episodeNum = parseInt(searchParams.get('episode') || '0');

    if (!episodeNum || episodeNum < 1) {
      return NextResponse.json({
        success: false,
        message: '유효한 화 번호가 필요합니다. (?episode=14)',
      }, { status: 400 });
    }

    // 1~13화는 보호 (원본 스토리)
    if (episodeNum <= 13) {
      return NextResponse.json({
        success: false,
        message: `제${episodeNum}화는 원본 스토리입니다. 보호 대상이므로 폐기할 수 없습니다.`,
      }, { status: 403 });
    }

    const results: string[] = [];

    // ── 1. 파일 폐기 (삭제 대신 이름 변경) ──
    const filePath = join(OUTPUT_DIR, `제${episodeNum}화.md`);
    if (existsSync(filePath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const discardPath = join(OUTPUT_DIR, `제${episodeNum}화_폐기_${timestamp}.md`);
      renameSync(filePath, discardPath);
      results.push(`📁 파일: 제${episodeNum}화.md → 폐기 처리 (복원 가능)`);
    } else {
      results.push(`📁 파일: 제${episodeNum}화.md 없음 (이미 폐기됨)`);
    }

    // ── 2. Supabase에서 삭제 (있으면) ──
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('episodes')
          .delete()
          .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .eq('episode_number', episodeNum);

        if (error) {
          results.push(`🗄️ DB: 삭제 실패 (${error.message})`);
        } else {
          results.push(`🗄️ DB: 제${episodeNum}화 삭제 완료`);
        }
      } catch (e: any) {
        results.push(`🗄️ DB: 접근 실패 (${e.message})`);
      }
    }

    // ── 3. 소설_진행_마스터.md 완전 복원 ──
    // 백업 파일(N화 쓰기 전 상태)이 있으면 완전 복원
    // 백업이 없으면 화수 번호만 되돌리는 폴백 처리
    try {
      const novelDir = join(process.cwd(), 'novels', 'murim_mna');
      const masterPath = join(novelDir, '소설_진행_마스터.md');
      const backupPath = join(novelDir, `소설_진행_마스터_backup_${episodeNum}화전.md`);

      if (existsSync(backupPath)) {
        // ★ 백업에서 완전 복원 — §1~§8 전부 원래대로 돌아감
        const backupContent = readFileSync(backupPath, 'utf-8');
        writeFileSync(masterPath, backupContent, 'utf-8');
        results.push(`📋 마스터: 백업에서 완전 복원 (제${episodeNum}화 쓰기 전 상태로 되돌림)`);
      } else if (existsSync(masterPath)) {
        // 백업이 없으면 화수 번호만 되돌리기 (폴백)
        let masterContent = readFileSync(masterPath, 'utf-8');
        const versionMatch = masterContent.match(/\[최신화:\s*(\d+)화\]/);
        const currentLatest = versionMatch ? parseInt(versionMatch[1]) : 0;

        if (currentLatest === episodeNum) {
          const prevEp = episodeNum - 1;
          masterContent = masterContent.replace(
            /\[최신화:\s*\d+화\]/,
            `[최신화: ${prevEp}화]`
          );
          masterContent = masterContent.replace(
            /\|\s*\*\*최신 집필 화수\*\*\s*\|\s*\*\*\d+화\*\*\s*\|/,
            `| **최신 집필 화수** | **${prevEp}화** |`
          );
          writeFileSync(masterPath, masterContent, 'utf-8');
          results.push(`📋 마스터: ⚠️ 백업 없음 → 화수만 되돌림 (§2, §7 등은 수동 확인 필요)`);
        }
      }
    } catch (e: any) {
      results.push(`📋 마스터: 복원 실패 (${e.message})`);
    }

    console.log(`🗑️ 제${episodeNum}화 폐기 완료:`, results);

    return NextResponse.json({
      success: true,
      message: `✅ 제${episodeNum}화 폐기 완료. 다시 생성할 수 있습니다.`,
      details: results,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '폐기 실패: ' + error.message,
    }, { status: 500 });
  }
}
