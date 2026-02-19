import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [장르 공통 DB API] - 다른 무협소설에도 재사용 가능한 참조 자료
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 작품 전용 자료는 /dashboard/worlddb (작품 자료)에서 관리.
 * 이 API는 장르 공통 자료만 다룹니다.
 * 
 * GET: 파일 목록 또는 특정 파일 내용 읽기
 * PUT: 특정 파일 내용 수정
 */

// ── 장르 공통 파일 목록 (보안: 이 목록 외 파일 접근 차단) ──
const STRATEGY_FILES: Record<string, { path: string; label: string; description: string; editable: boolean }> = {
  // ── 📝 집필 규칙/문체 ──
  'rules': {
    path: 'novels/murim_mna/집필_규칙_핵심.md',
    label: '집필 규칙 핵심',
    description: 'EP 규칙 15개, 말투, 코미디 쿼터, 소설체 규칙',
    editable: true,
  },
  'style-guide': {
    path: 'novels/murim_mna/문체_가이드.md',
    label: '문체 가이드',
    description: '문장 길이, 속도 조절, 비유법 15가지, 호칭, 금지 표현',
    editable: true,
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
  // ── 🗡️ 무공/전투 ──
  'martial-sys': {
    path: 'novels/murim_mna/world_db/무공_시스템.md',
    label: '무공 시스템',
    description: '무공 체계, 내공/외공, 경지 분류, 심법 원리',
    editable: true,
  },
  'martial-dic': {
    path: 'novels/murim_mna/world_db/무공_기법_대전.md',
    label: '무공 기법 대전',
    description: '무공 기법 사전, 초식 목록, 검법/권법/장법 분류',
    editable: true,
  },
  'combat-guide': {
    path: 'novels/murim_mna/world_db/전투_안무가이드.md',
    label: '전투 안무 가이드',
    description: '전투 장면 작성법, 타격감, 속도 묘사, 긴장감 연출',
    editable: true,
  },
  // ── 🌏 세계관 DB ──
  'geo': {
    path: 'novels/murim_mna/world_db/지리_이동_DB.md',
    label: '지리·이동 DB',
    description: '중국 지리, 도시간 이동 시간, 주요 거점',
    editable: true,
  },
  'food': {
    path: 'novels/murim_mna/world_db/음식_DB.md',
    label: '음식 DB',
    description: '시대별 음식, 조리법, 식재료, 객잔 메뉴',
    editable: true,
  },
  'arch': {
    path: 'novels/murim_mna/world_db/건축_객실_DB.md',
    label: '건축·객실 DB',
    description: '객잔 구조, 방 배치, 건물 양식, 가구',
    editable: true,
  },
  'weapons': {
    path: 'novels/murim_mna/world_db/무기_병기_DB.md',
    label: '무기·병기 DB',
    description: '무기 종류, 특성, 무게, 사용법',
    editable: true,
  },
  'clothing': {
    path: 'novels/murim_mna/world_db/의복_복식_DB.md',
    label: '의복·복식 DB',
    description: '시대별 의복, 계급별 복장, 색상 의미',
    editable: true,
  },
  'inns': {
    path: 'novels/murim_mna/world_db/지역별_객잔_DB.md',
    label: '지역별 객잔 DB',
    description: '지역별 유명 객잔, 분위기, 특색 요리',
    editable: true,
  },
  'wuxia-terms': {
    path: 'novels/murim_mna/world_db/무협_용어집.md',
    label: '무협 용어집',
    description: '무협 전문 용어, 호칭, 존칭, 강호 표현',
    editable: true,
  },
  'biz-terms': {
    path: 'novels/murim_mna/world_db/경영_용어집.md',
    label: '경영 용어집',
    description: '경영 용어 → 무협 세계 매핑, 사업 표현',
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
