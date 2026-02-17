import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [전략 문서 API] - 핵심 .md 파일 읽기/쓰기
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 대시보드에서 전략 회의 결과 문서를 직접 조회하고 수정할 수 있도록 합니다.
 * 
 * GET: 파일 목록 또는 특정 파일 내용 읽기
 * PUT: 특정 파일 내용 수정
 */

// ── 허용된 전략 문서 목록 (보안: 이 목록 외 파일 접근 차단) ──
const STRATEGY_FILES: Record<string, { path: string; label: string; description: string; editable: boolean }> = {
  'master': {
    path: 'novels/murim_mna/소설_진행_마스터.md',
    label: '소설 진행 마스터',
    description: '현재 상태, 다음 화 주의사항, 활성 복선, 관계도, 감정 목표',
    editable: true,
  },
  'story-bible': {
    path: 'novels/murim_mna/master_story_bible.md',
    label: '스토리 바이블',
    description: '전체 로드맵, 장기 복선, 캐릭터 아크 계획 (14~25화+)',
    editable: true,
  },
  'rules': {
    path: 'novels/murim_mna/집필_규칙.md',
    label: '집필 규칙',
    description: 'EP 규칙 15개, 3인격 엔진, 말투 규칙, 금지어 목록',
    editable: true,
  },
  'characters': {
    path: 'novels/murim_mna/캐릭터_인명록.md',
    label: '캐릭터 인명록',
    description: '핵심 30명 + 단역 시스템 + 3인격 엔진 상세',
    editable: true,
  },
  'ref-index': {
    path: 'system/참조자료_색인.md',
    label: '참조자료 색인',
    description: '작업별 필수 파일 안내 가이드',
    editable: false,
  },
  'novel-writing-rules': {
    path: '.cursor/rules/novel-writing.mdc',
    label: '소설체 스타일 규칙',
    description: '소설체 7대 규칙, 독백 표기, 대사/서술 비율, 묘사 등급',
    editable: false,
  },
  'combat-rules': {
    path: '.cursor/rules/combat.mdc',
    label: '전투 장면 규칙',
    description: '용대운 원칙, 전투 절대 규칙, 전투 EP 규칙',
    editable: false,
  },
};

// ── GET: 파일 목록 또는 특정 파일 읽기 ──
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileKey = searchParams.get('file');

    // 파일 키 없으면 → 전체 목록 반환
    if (!fileKey) {
      const files = Object.entries(STRATEGY_FILES).map(([key, info]) => {
        const fullPath = join(process.cwd(), info.path);
        const exists = existsSync(fullPath);
        let lineCount = 0;
        let charCount = 0;
        if (exists) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            lineCount = content.split('\n').length;
            charCount = content.length;
          } catch {}
        }
        return {
          key,
          label: info.label,
          description: info.description,
          editable: info.editable,
          exists,
          lineCount,
          charCount,
        };
      });

      return NextResponse.json({ success: true, files });
    }

    // 특정 파일 읽기
    const fileInfo = STRATEGY_FILES[fileKey];
    if (!fileInfo) {
      return NextResponse.json({
        success: false,
        message: `허용되지 않은 파일입니다: ${fileKey}`,
      }, { status: 400 });
    }

    const fullPath = join(process.cwd(), fileInfo.path);
    if (!existsSync(fullPath)) {
      return NextResponse.json({
        success: false,
        message: `파일이 존재하지 않습니다: ${fileInfo.path}`,
      }, { status: 404 });
    }

    const content = readFileSync(fullPath, 'utf-8');
    return NextResponse.json({
      success: true,
      file: {
        key: fileKey,
        label: fileInfo.label,
        description: fileInfo.description,
        editable: fileInfo.editable,
        path: fileInfo.path,
        content,
        lineCount: content.split('\n').length,
        charCount: content.length,
      },
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '파일 읽기 실패',
      error: error.message,
    }, { status: 500 });
  }
}

// ── PUT: 파일 수정 ──
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileKey, content } = body;

    if (!fileKey || content === undefined) {
      return NextResponse.json({
        success: false,
        message: 'fileKey와 content가 필요합니다.',
      }, { status: 400 });
    }

    const fileInfo = STRATEGY_FILES[fileKey];
    if (!fileInfo) {
      return NextResponse.json({
        success: false,
        message: `허용되지 않은 파일입니다: ${fileKey}`,
      }, { status: 400 });
    }

    if (!fileInfo.editable) {
      return NextResponse.json({
        success: false,
        message: `이 파일은 읽기 전용입니다: ${fileInfo.label}`,
      }, { status: 403 });
    }

    const fullPath = join(process.cwd(), fileInfo.path);

    // 백업 (기존 내용 보존)
    if (existsSync(fullPath)) {
      const backup = readFileSync(fullPath, 'utf-8');
      const backupPath = fullPath + '.backup';
      writeFileSync(backupPath, backup, 'utf-8');
    }

    // 저장
    writeFileSync(fullPath, content, 'utf-8');

    return NextResponse.json({
      success: true,
      message: `✅ ${fileInfo.label} 저장 완료`,
      charCount: content.length,
      lineCount: content.split('\n').length,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '파일 저장 실패',
      error: error.message,
    }, { status: 500 });
  }
}
