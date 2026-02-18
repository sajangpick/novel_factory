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
  // ── 핵심 작업 문서 ──
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
    path: 'novels/murim_mna/집필_규칙_핵심.md',
    label: '집필 규칙 핵심',
    description: 'EP 규칙 15개, 말투, 코미디 쿼터, 위소운 약점, 소설체 규칙',
    editable: true,
  },
  'ref-index': {
    path: 'novels/murim_mna/_파일_색인.md',
    label: '파일 색인',
    description: '35개 참조 파일 전체 지도 + 가나다 찾아보기',
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
  // ── 🧭 전략/방향 ──
  'theme': {
    path: 'novels/murim_mna/테마_주제의식.md',
    label: '테마·주제의식',
    description: '핵심 테마, 5대 서브 테마, 화수별 배치, 체크리스트',
    editable: true,
  },
  'competitive': {
    path: 'novels/murim_mna/경쟁작_차별화.md',
    label: '경쟁작 차별화',
    description: '화산귀환 등 Top 5 분석, 차별화 포인트, 금지 클리셰',
    editable: true,
  },
  'reader': {
    path: 'novels/murim_mna/독자_타겟분석.md',
    label: '독자 타겟 분석',
    description: '핵심 독자 프로필, 감정 니즈, 이탈 포인트, 여정 맵',
    editable: true,
  },
  'style-guide': {
    path: 'novels/murim_mna/문체_가이드.md',
    label: '문체 가이드',
    description: '문장 길이, 속도 조절, 비유법 15가지, 호칭, 금지 표현',
    editable: true,
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
