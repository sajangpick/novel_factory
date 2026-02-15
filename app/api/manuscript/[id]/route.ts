import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [원고 파일 관리 API] (legacy_ref/episodes/[id] 이전)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * GET  : 원고 파일 읽기 (output/text → output/archive 순서)
 * POST : 원고 파일 저장 (output/text)
 * DELETE: 원고 파일 삭제 (output/text)
 * 
 * [보안] 경로 조작(../) 방지, .md 확장자만 허용
 */

// ── 경로 상수 ──
const OUTPUT_TEXT_DIR = path.join(process.cwd(), 'output', 'text');
const OUTPUT_ARCHIVE_DIR = path.join(process.cwd(), 'output', 'archive');

// ── 보안 검증: 파일명만 허용 (경로 구분자, 트래버설 차단) ──
function validateFilename(filename: string): boolean {
  if (!filename) return false;
  const hasPathSep = filename.includes('/') || filename.includes('\\');
  const hasTraversal = filename.includes('..');
  const isMd = filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.txt');
  return !hasPathSep && !hasTraversal && isMd;
}

// ── GET: 원고 읽기 ──
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: episodeNum } = await params;
    const searchParams = request.nextUrl.searchParams;
    const requestedFilename = searchParams.get('filename') 
      ? decodeURIComponent(searchParams.get('filename')!) 
      : null;

    // 파일명 목록 결정
    let possibleFilenames: string[] = [];

    if (requestedFilename) {
      if (!validateFilename(requestedFilename)) {
        return NextResponse.json({ error: '잘못된 filename 파라미터입니다.' }, { status: 400 });
      }
      possibleFilenames = [requestedFilename];
    } else {
      // 기본 파일명 패턴 (현재 작품명 기준)
      possibleFilenames = [
        `제${episodeNum}화.md`,
        `제${episodeNum}화.txt`,
        `위소운_제${episodeNum}화.md`,
      ];
    }

    // text → archive 순서로 탐색
    let filePath = '';
    let filename = '';
    const candidateDirs = [OUTPUT_TEXT_DIR, OUTPUT_ARCHIVE_DIR];

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) continue;
      for (const fn of possibleFilenames) {
        const fp = path.join(dir, fn);
        if (fs.existsSync(fp)) {
          filePath = fp;
          filename = fn;
          break;
        }
      }
      if (filePath) break;
    }

    // 파일명으로 찾지 못하면, 폴더 내 해당 화 파일 검색
    if (!filePath && fs.existsSync(OUTPUT_TEXT_DIR)) {
      const files = fs.readdirSync(OUTPUT_TEXT_DIR);
      const match = files.find(f => f.includes(`${episodeNum}화`) && (f.endsWith('.md') || f.endsWith('.txt')));
      if (match) {
        filePath = path.join(OUTPUT_TEXT_DIR, match);
        filename = match;
      }
    }

    if (!filePath) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    return NextResponse.json({
      episode: episodeNum,
      filename,
      content,
      length: content.length,
      charCount: content.replace(/\s+/g, '').length,
    });
  } catch (error: any) {
    console.error('원고 읽기 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: 원고 저장 ──
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: episodeNum } = await params;
    const body = await request.json();
    const contentRaw = body?.content;
    const filenameRaw = body?.filename;

    if (typeof contentRaw !== 'string' || !contentRaw.trim()) {
      return NextResponse.json({ error: 'content가 비어 있습니다.' }, { status: 400 });
    }

    // 폴더 생성
    if (!fs.existsSync(OUTPUT_TEXT_DIR)) {
      fs.mkdirSync(OUTPUT_TEXT_DIR, { recursive: true });
    }

    // 파일명 결정
    const defaultFilename = `제${episodeNum}화.md`;
    const requestedFilename = typeof filenameRaw === 'string' && filenameRaw.trim() 
      ? filenameRaw.trim() 
      : defaultFilename;

    if (!validateFilename(requestedFilename)) {
      return NextResponse.json({ error: '잘못된 filename 입니다.' }, { status: 400 });
    }

    const filePath = path.join(OUTPUT_TEXT_DIR, requestedFilename);

    // 저장 (덮어쓰기)
    fs.writeFileSync(filePath, contentRaw, 'utf-8');

    return NextResponse.json({
      ok: true,
      episode: episodeNum,
      filename: requestedFilename,
      saved_to: 'output/text',
      length: contentRaw.length,
      charCount: contentRaw.replace(/\s+/g, '').length,
    });
  } catch (error: any) {
    console.error('원고 저장 오류:', error);
    return NextResponse.json({ error: error.message || '저장 중 오류' }, { status: 500 });
  }
}

// ── DELETE: 원고 삭제 ──
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: episodeNum } = await params;
    const searchParams = request.nextUrl.searchParams;
    const requestedFilename = searchParams.get('filename')
      ? decodeURIComponent(searchParams.get('filename')!)
      : null;

    if (!requestedFilename) {
      return NextResponse.json({
        ok: false,
        error: '삭제할 filename을 지정해주세요.'
      }, { status: 400 });
    }

    if (!validateFilename(requestedFilename)) {
      return NextResponse.json({ ok: false, error: '잘못된 filename 입니다.' }, { status: 400 });
    }

    // 회차 일치 검사
    const m = requestedFilename.match(/(\d+)화/);
    if (m && m[1] && String(parseInt(m[1], 10)) !== String(parseInt(episodeNum, 10))) {
      return NextResponse.json({
        ok: false,
        error: `filename의 회차(${m[1]}화)와 요청 회차(${episodeNum}화)가 다릅니다.`
      }, { status: 400 });
    }

    const filePath = path.join(OUTPUT_TEXT_DIR, requestedFilename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ ok: false, error: '삭제할 파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    fs.unlinkSync(filePath);

    return NextResponse.json({
      ok: true,
      episode: episodeNum,
      filename: requestedFilename,
      deleted_from: 'output/text',
    });
  } catch (error: any) {
    console.error('원고 삭제 오류:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
