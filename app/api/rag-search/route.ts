import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [RAG 검색 API] - 무림 세계관 데이터베이스 검색
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 2가지 모드로 동작:
 * 1. Python RAG 서버 연결 시 → Python 서버에 프록시
 * 2. Python 서버 미실행 시 → 직접 .md 파일을 읽어서 키워드 검색 (폴백)
 *
 * 요청 형식:
 *   POST { query: "화산파 위치", top_k: 5, category?: "지리/지역" }
 *   POST { tag: "요리" }  ← @태그 검색
 *
 * 응답 형식:
 *   { results: [...], count: N, source: "python" | "local" }
 */

interface RAGSearchRequest {
  query?: string;      // 일반 검색어
  tag?: string;        // @태그 검색
  top_k?: number;      // 최대 결과 수 (기본 5)
  category?: string;   // 카테고리 필터
}

// ── 태그 → 검색 매핑 ──
const TAG_MAP: Record<string, { query: string; fileHint: string[] }> = {
  '요리':   { query: '요리 음식 메뉴 가격',   fileHint: ['음식', '건축'] },
  '음식':   { query: '요리 음식 메뉴 가격',   fileHint: ['음식', '건축'] },
  '건축':   { query: '건축 객잔 구조 기둥',   fileHint: ['음식', '건축'] },
  '객잔':   { query: '객잔 주막 여관',        fileHint: ['객잔'] },
  '무공':   { query: '무공 심법 초식 내공',    fileHint: ['무공_시스템'] },
  '무기':   { query: '무기 병기 검 도 창',    fileHint: ['무기', '병기'] },
  '병기':   { query: '무기 병기 검 도 창',    fileHint: ['무기', '병기'] },
  '의복':   { query: '의복 복식 의상 옷',     fileHint: ['의복', '복식'] },
  '지리':   { query: '지역 도시 산 강',       fileHint: ['지리'] },
  '이동':   { query: '이동 경로 거리 리',     fileHint: ['이동', '동선'] },
  '세력':   { query: '세력 문파 조직 파',     fileHint: ['세력도', '조직도'] },
  '조직':   { query: '세력 문파 조직',        fileHint: ['조직도'] },
  '인물':   { query: '캐릭터 인물 이름',      fileHint: ['캐릭터', '인명록'] },
  '캐릭터': { query: '캐릭터 인물',           fileHint: ['캐릭터', '인명록'] },
  '경영':   { query: '경영 M&A 재무 ROI',    fileHint: ['경영'] },
  '무협':   { query: '무협 용어 강호',        fileHint: ['무협_용어'] },
  '로드맵': { query: '로드맵 300화 일정',     fileHint: ['로드맵'] },
};

export async function POST(req: NextRequest) {
  try {
    const body: RAGSearchRequest = await req.json();
    const topK = body.top_k || 5;

    // @태그 검색인 경우 query로 변환
    let query = body.query || '';
    let fileHints: string[] = [];

    if (body.tag) {
      const tagKey = body.tag.replace('@', '').trim();
      const mapped = TAG_MAP[tagKey];
      if (mapped) {
        query = mapped.query;
        fileHints = mapped.fileHint;
      } else {
        query = tagKey;
      }
    }

    if (!query.trim()) {
      return NextResponse.json({ results: [], count: 0, source: 'none', message: '검색어가 비어있습니다.' });
    }

    // ── 1단계: Python RAG 서버 호출 시도 ──
    try {
      const ragUrl = process.env.RAG_SERVER_URL || 'http://localhost:8000';
      const endpoint = body.tag ? '/api/tag-search' : '/api/search';
      const payload = body.tag
        ? { tag: body.tag.replace('@', '') }
        : { query, top_k: topK, category: body.category };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃

      const response = await fetch(`${ragUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          results: data.results || [],
          count: data.count || 0,
          source: 'python',
        });
      }
    } catch {
      // Python 서버 미실행 → 폴백으로 이동
      console.log('ℹ️ Python RAG 서버 미실행, 로컬 검색으로 전환');
    }

    // ── 2단계: 로컬 파일 직접 검색 (폴백) ──
    const results = await localSearch(query, topK, body.category, fileHints);

    return NextResponse.json({
      results,
      count: results.length,
      source: 'local',
    });

  } catch (error: any) {
    console.error('❌ RAG 검색 오류:', error);
    return NextResponse.json({
      results: [],
      count: 0,
      source: 'error',
      message: error.message || 'RAG 검색 실패',
    }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 로컬 파일 직접 검색 (Python 서버 없이 동작)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SearchResult {
  doc_name: string;
  category: string;
  heading: string;
  text: string;
  score: number;
}

async function localSearch(
  query: string,
  topK: number,
  category?: string,
  fileHints?: string[],
): Promise<SearchResult[]> {
  // novels/murim_mna/world_db 경로 (공장-제품 분리 구조)
  const worldDbPath = path.join(process.cwd(), 'novels', 'murim_mna', 'world_db');

  if (!fs.existsSync(worldDbPath)) {
    console.warn('⚠️ novels/murim_mna/world_db 폴더가 없습니다');
    return [];
  }

  // .md 파일 목록
  let mdFiles = fs.readdirSync(worldDbPath).filter((f: string) => f.endsWith('.md'));

  // fileHints가 있으면 관련 파일 우선 정렬
  if (fileHints && fileHints.length > 0) {
    mdFiles.sort((a, b) => {
      const aMatch = fileHints.some((h: string) => a.includes(h)) ? 0 : 1;
      const bMatch = fileHints.some((h: string) => b.includes(h)) ? 0 : 1;
      return aMatch - bMatch;
    });
  }

  // 검색어 분해
  const queryWords = query.toLowerCase().split(/[\s,]+/).filter((w: string) => w.length > 0);
  const results: SearchResult[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(worldDbPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const docName = file.replace('.md', '');
    const docCategory = guessCategory(docName);

    // 카테고리 필터
    if (category && !docCategory.includes(category)) {
      continue;
    }

    // 섹션별 분리 (## 기준)
    const sections = content.split(/\n(?=##\s)/);

    for (const section of sections) {
      if (section.trim().length < 10) continue;

      // 헤딩 추출
      const headingMatch = section.match(/^#{1,4}\s+(.+)/);
      const heading = headingMatch ? headingMatch[1].trim() : '본문';
      const textLower = section.toLowerCase();

      // 점수 계산
      let score = 0;
      for (const word of queryWords) {
        // 본문 매칭
        const count = (textLower.match(new RegExp(escapeRegex(word), 'gi')) || []).length;
        if (count > 0) score += Math.min(count, 5);

        // 헤딩 매칭 (3배 가중치)
        if (heading.toLowerCase().includes(word)) score += 3;

        // 파일명 매칭 (2배 가중치)
        if (docName.toLowerCase().includes(word)) score += 2;
      }

      // 전체 구문 매칭 보너스
      if (textLower.includes(query.toLowerCase())) score += 5;

      // fileHint 보너스
      if (fileHints && fileHints.some((h: string) => docName.includes(h))) score += 3;

      if (score > 0) {
        results.push({
          doc_name: docName,
          category: docCategory,
          heading,
          text: section.slice(0, 800),
          score: Math.round(score * 100) / 100,
        });
      }
    }
  }

  // 점수 내림차순 정렬
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// ── 카테고리 추론 ──
function guessCategory(filename: string): string {
  const map: Record<string, string> = {
    '지리': '지리/지역', '객잔': '지리/객잔', '이동': '지리/이동',
    '음식': '생활/음식·건축', '건축': '생활/음식·건축',
    '의복': '생활/의복', '복식': '생활/의복',
    '무공': '무공/전투', '무기': '무공/병기', '병기': '무공/병기',
    '캐릭터': '인물', '인명록': '인물', '성장표': '인물/성장',
    '세력도': '세력/조직', '조직도': '세력/조직',
    '경영': '경영/용어', '무협': '무협/용어',
    '로드맵': '스토리/로드맵', '출연자': '스토리/출연자', '루트맵': '스토리/루트맵',
    '6하원칙': '템플릿/설계', '스켈레톤': '템플릿/뼈대',
  };
  for (const [key, val] of Object.entries(map)) {
    if (filename.includes(key)) return val;
  }
  return '기타';
}

// ── 정규표현식 이스케이프 ──
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET: 문서 목록 조회
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET() {
  try {
    const worldDbPath = path.join(process.cwd(), 'docs', 'world_db');

    if (!fs.existsSync(worldDbPath)) {
      return NextResponse.json({ documents: [], count: 0 });
    }

    const mdFiles = fs.readdirSync(worldDbPath).filter((f: string) => f.endsWith('.md'));
    const documents = mdFiles.map(file => {
      const filePath = path.join(worldDbPath, file);
      const stat = fs.statSync(filePath);
      const docName = file.replace('.md', '');
      return {
        name: docName,
        category: guessCategory(docName),
        size: stat.size,
        file: file,
      };
    });

    return NextResponse.json({ documents, count: documents.length });

  } catch (error: any) {
    return NextResponse.json({ documents: [], count: 0, error: error.message }, { status: 500 });
  }
}
