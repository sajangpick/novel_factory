import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * [파일 읽기 API]
 * - MD 파일 내용을 읽어서 반환
 * - 사용자가 대시보드에서 파일 내용을 볼 수 있도록
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: '파일 경로가 필요합니다.' }, { status: 400 });
    }

    // 보안: novels/murim_mna/ 폴더 내부만 허용 (공장-제품 분리 구조)
    if (!filePath.startsWith('novels/murim_mna/')) {
      return NextResponse.json({ error: '허용되지 않은 경로입니다.' }, { status: 403 });
    }

    // 파일 읽기
    const fullPath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    return NextResponse.json({
      success: true,
      content,
      path: filePath,
    });
  } catch (error) {
    console.error('[API 오류] read-file:', error);
    return NextResponse.json(
      {
        error: '파일 읽기 실패',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
