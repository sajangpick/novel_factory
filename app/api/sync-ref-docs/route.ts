import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [참조 문서 동기화 API]
 * 로컬 마크다운 파일 → 섹션 파싱 → Supabase 업로드
 * 
 * GET: 현재 DB 섹션 수 확인
 * POST: 전체 동기화 실행
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ── 동기화 대상 문서 정의 ──
const DOC_CONFIGS = [
  // ── 🗺️ 마스터 색인 (항상 최우선 로딩) ──
  { key: 'file_index',         title: '파일 색인',            path: 'novels/murim_mna/_파일_색인.md',                    defaultPriority: 1 },

  // ── A. 지휘부 (슬림화된 핵심) ──
  { key: 'bible',              title: '스토리 바이블',         path: 'novels/murim_mna/master_story_bible.md',           defaultPriority: 1 },
  { key: 'rules_core',         title: '집필 규칙 핵심',        path: 'novels/murim_mna/집필_규칙_핵심.md',               defaultPriority: 1 },
  { key: 'master',             title: '소설 진행 마스터',       path: 'novels/murim_mna/소설_진행_마스터.md',              defaultPriority: 1 },

  // ── B. 집필 엔진 ──
  { key: 'engine_3persona',    title: '3인격 엔진',            path: 'novels/murim_mna/3인격_엔진.md',                   defaultPriority: 1 },
  { key: 'engine_emotion',     title: '이준혁 감정 엔진',       path: 'novels/murim_mna/이준혁_감정_엔진.md',              defaultPriority: 1 },
  { key: 'engine_giryu',       title: '기류감응 가이드',        path: 'novels/murim_mna/기류감응_가이드.md',               defaultPriority: 1 },
  { key: 'style_guide',        title: '문체 가이드',            path: 'novels/murim_mna/문체_가이드.md',                   defaultPriority: 1 },

  // ── C. 스토리 설계도 ──
  { key: 'story_arc',          title: '스토리 아크 상세',       path: 'novels/murim_mna/스토리_아크_상세.md',              defaultPriority: 2 },
  { key: 'tournament_setting', title: '무림대회 설정',          path: 'novels/murim_mna/무림대회_설정.md',                 defaultPriority: 2 },

  // ── D. 인물 ──
  { key: 'char_main',          title: '캐릭터 주인공',          path: 'novels/murim_mna/캐릭터_주인공.md',                defaultPriority: 1 },
  { key: 'char_support',       title: '캐릭터 조연·세력',       path: 'novels/murim_mna/캐릭터_조연_세력.md',              defaultPriority: 2 },
  { key: 'char_tournament',    title: '캐릭터 무림대회',        path: 'novels/murim_mna/캐릭터_무림대회.md',               defaultPriority: 2 },
  { key: 'char_system',        title: '캐릭터 시스템',          path: 'novels/murim_mna/캐릭터_시스템.md',                defaultPriority: 2 },

  // ── E. 무공/전투 (world_db) ──
  { key: 'martial_system',     title: '무공 시스템',            path: 'novels/murim_mna/world_db/무공_시스템.md',          defaultPriority: 1 },
  { key: 'martial_protagonist',title: '주인공 무공 상세',        path: 'novels/murim_mna/world_db/무공_주인공_상세.md',      defaultPriority: 1 },
  { key: 'combat_guide',       title: '전투 안무 가이드',       path: 'novels/murim_mna/world_db/전투_안무가이드.md',       defaultPriority: 1 },
  { key: 'martial_dictionary', title: '무공 기법 대전',         path: 'novels/murim_mna/world_db/무공_기법_대전.md',       defaultPriority: 2 },

  // ── F. 조직/세력 (world_db) ──
  { key: 'org_chunhwa',        title: '천화련 조직·사업',       path: 'novels/murim_mna/world_db/천화련_조직_사업.md',      defaultPriority: 2 },
  { key: 'org_ansi',           title: '안씨표국·안가',          path: 'novels/murim_mna/world_db/안씨표국_안가.md',         defaultPriority: 2 },
  { key: 'power_map',          title: '세력도',                path: 'novels/murim_mna/world_db/세력도.md',               defaultPriority: 2 },

  // ── G. 경제 (world_db) ──
  { key: 'economy',            title: '경제 시스템',            path: 'novels/murim_mna/world_db/경제_시스템_심화.md',      defaultPriority: 2 },
  { key: 'business_terms',     title: '경영 용어집',            path: 'novels/murim_mna/world_db/경영_용어집.md',          defaultPriority: 2 },

  // ── H. 세계관 백과사전 (world_db) ──
  { key: 'geo_travel',         title: '지리·이동 DB',          path: 'novels/murim_mna/world_db/지리_이동_DB.md',         defaultPriority: 2 },
  { key: 'food_db',            title: '음식 DB',               path: 'novels/murim_mna/world_db/음식_DB.md',              defaultPriority: 2 },
  { key: 'food_biz',           title: '사업 음식기술',           path: 'novels/murim_mna/world_db/사업_음식기술.md',         defaultPriority: 2 },
  { key: 'architecture',       title: '건축·객실 DB',          path: 'novels/murim_mna/world_db/건축_객실_DB.md',         defaultPriority: 2 },
  { key: 'weapons',            title: '무기·병기 DB',          path: 'novels/murim_mna/world_db/무기_병기_DB.md',         defaultPriority: 2 },
  { key: 'clothing',           title: '의복·복식 DB',          path: 'novels/murim_mna/world_db/의복_복식_DB.md',         defaultPriority: 2 },
  { key: 'inns',               title: '지역별 객잔 DB',        path: 'novels/murim_mna/world_db/지역별_객잔_DB.md',       defaultPriority: 2 },
  { key: 'modern_knowledge',   title: '이준혁 현대지식 DB',     path: 'novels/murim_mna/world_db/이준혁_현대지식_DB.md',    defaultPriority: 2 },
  { key: 'wuxia_terms',        title: '무협 용어집',            path: 'novels/murim_mna/world_db/무협_용어집.md',          defaultPriority: 2 },

  // ── I. 전략/방향 ──
  { key: 'theme',              title: '테마·주제의식',          path: 'novels/murim_mna/테마_주제의식.md',                  defaultPriority: 2 },
  { key: 'competitive',        title: '경쟁작 차별화',          path: 'novels/murim_mna/경쟁작_차별화.md',                 defaultPriority: 2 },
  { key: 'reader_target',      title: '독자 타겟 분석',         path: 'novels/murim_mna/독자_타겟분석.md',                 defaultPriority: 2 },
];

// ── 마크다운을 섹션별로 분할 ──
function parseMarkdownSections(
  content: string,
  docKey: string,
  defaultPriority: number
): Array<{
  doc_key: string;
  section_title: string;
  content: string;
  keywords: string[];
  priority: number;
}> {
  const lines = content.split('\n');
  const sections: Array<{
    doc_key: string;
    section_title: string;
    content: string;
    keywords: string[];
    priority: number;
  }> = [];

  let currentTitle = '(서두)';
  let currentLines: string[] = [];
  let currentLevel = 0;

  // ## 또는 ### 헤더를 만나면 이전 섹션을 저장
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,4})\s+(.+)/);

    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // 이전 섹션 저장 (내용이 있을 때만)
      if (currentLines.length > 0) {
        const sectionContent = currentLines.join('\n').trim();
        if (sectionContent.length > 10) {
          sections.push({
            doc_key: docKey,
            section_title: currentTitle,
            content: sectionContent,
            keywords: extractKeywords(currentTitle, sectionContent),
            priority: determinePriority(docKey, currentTitle, sectionContent, defaultPriority),
          });
        }
      }

      currentTitle = title;
      currentLines = [line];
      currentLevel = level;
    } else {
      currentLines.push(line);
    }
  }

  // 마지막 섹션 저장
  if (currentLines.length > 0) {
    const sectionContent = currentLines.join('\n').trim();
    if (sectionContent.length > 10) {
      sections.push({
        doc_key: docKey,
        section_title: currentTitle,
        content: sectionContent,
        keywords: extractKeywords(currentTitle, sectionContent),
        priority: determinePriority(docKey, currentTitle, sectionContent, defaultPriority),
      });
    }
  }

  // 섹션이 너무 크면 (300줄 이상) 하위 헤더로 재분할
  const finalSections: typeof sections = [];
  for (const section of sections) {
    const lineCount = section.content.split('\n').length;
    if (lineCount > 300) {
      const subSections = splitLargeSection(section);
      finalSections.push(...subSections);
    } else {
      finalSections.push(section);
    }
  }

  return finalSections;
}

// ── 큰 섹션을 하위 헤더로 재분할 ──
function splitLargeSection(
  section: { doc_key: string; section_title: string; content: string; keywords: string[]; priority: number }
): (typeof section)[] {
  const lines = section.content.split('\n');
  const subSections: (typeof section)[] = [];

  let currentTitle = section.section_title;
  let currentLines: string[] = [];

  for (const line of lines) {
    const subHeader = line.match(/^(#{2,5})\s+(.+)/);
    if (subHeader && currentLines.length > 5) {
      const content = currentLines.join('\n').trim();
      if (content.length > 10) {
        subSections.push({
          doc_key: section.doc_key,
          section_title: currentTitle,
          content,
          keywords: extractKeywords(currentTitle, content),
          priority: section.priority,
        });
      }
      currentTitle = `${section.section_title} > ${subHeader[2].trim()}`;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content.length > 10) {
      subSections.push({
        doc_key: section.doc_key,
        section_title: currentTitle,
        content,
        keywords: extractKeywords(currentTitle, content),
        priority: section.priority,
      });
    }
  }

  return subSections;
}

// ── 키워드 추출 (검색용) ──
function extractKeywords(title: string, content: string): string[] {
  const keywords = new Set<string>();

  // 제목에서 키워드
  const titleWords = title.match(/[가-힣]{2,}/g) || [];
  titleWords.forEach(w => keywords.add(w));

  // **굵은 글씨**에서 키워드 (보통 중요 용어)
  const boldMatches = content.match(/\*\*([^*]+)\*\*/g) || [];
  for (const match of boldMatches) {
    const term = match.replace(/\*\*/g, '').trim();
    const words = term.match(/[가-힣]{2,}/g) || [];
    words.forEach(w => keywords.add(w));
    // 영문+한글 혼합 용어도 보존 (예: "M&A", "CEO")
    if (/[A-Za-z]/.test(term) && term.length <= 20) keywords.add(term);
  }

  // 한자 포함 용어 (무공명 등)
  const hanjaMatches = content.match(/[가-힣]+\([一-龥a-zA-Z]+\)/g) || [];
  for (const match of hanjaMatches) {
    const koreanPart = match.match(/^[가-힣]+/);
    if (koreanPart) keywords.add(koreanPart[0]);
  }

  // 인물명 패턴: 2~4글자 한글 고유명사 (제목이나 첫 100자에서)
  const nameArea = (title + ' ' + content.slice(0, 500));
  const nameMatches = nameArea.match(/[가-힣]{2,4}(?=\(|은|는|이|가|의|를|을|에게|과|와|도)/g) || [];
  nameMatches.forEach(w => { if (w.length >= 2) keywords.add(w); });

  // 무공/심법명 (X법, X공, X식, X진)
  const martialMatches = content.match(/[가-힣]{2,}(?:법|공|식|진|결|경|장)\b/g) || [];
  martialMatches.forEach(w => keywords.add(w));

  // 불필요한 일반 단어 제거
  const stopWords = new Set(['이것', '그것', '저것', '이런', '그런', '때문', '하지만', '그리고', '또한', '아래', '위에', '다음', '이전', '기본', '핵심', '설정', '내용', '항목', '참조', '참고']);
  for (const word of keywords) {
    if (stopWords.has(word)) keywords.delete(word);
  }

  return Array.from(keywords).slice(0, 30);
}

// ── 섹션 우선순위 결정 ──
function determinePriority(docKey: string, title: string, content: string, defaultPriority: number): number {
  // 항상 포함할 핵심 키워드가 있는 섹션
  const criticalPatterns = [
    /전수.*정책|전수.*범위|전수.*한계/,
    /위소운.*독점|독점.*영역/,
    /3인격|삼인격/,
    /말투.*절대|말투.*불변/,
    /금지어|금지.*문구/,
    /캐릭터.*말투|말투.*패턴/,
  ];

  for (const pattern of criticalPatterns) {
    if (pattern.test(title) || pattern.test(content.slice(0, 300))) {
      return 1;
    }
  }

  // master 파일은 항상 priority 1
  if (docKey === 'master') return 1;

  // 무공/심법 관련 섹션은 중요
  if (/심법|검법|무공|전수|수련/.test(title)) return 1;

  return defaultPriority;
}

// ── Supabase 클라이언트 생성 ──
async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수 미설정');

  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET: 현재 상태 확인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function GET() {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('reference_doc_sections')
      .select('doc_key, section_title, priority', { count: 'exact' });

    if (error) throw error;

    // 문서별 섹션 수 집계
    const summary: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      summary[row.doc_key] = (summary[row.doc_key] || 0) + 1;
    });

    return NextResponse.json({
      totalSections: data?.length || 0,
      byDocument: summary,
      sections: (data || []).map((r: any) => ({
        doc_key: r.doc_key,
        title: r.section_title,
        priority: r.priority,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST: 전체 동기화 실행
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase();
    const results: Array<{ doc: string; sections: number; error?: string }> = [];
    let totalSections = 0;

    for (const config of DOC_CONFIGS) {
      const filePath = join(process.cwd(), config.path);

      if (!existsSync(filePath)) {
        results.push({ doc: config.key, sections: 0, error: '파일 없음' });
        continue;
      }

      const content = readFileSync(filePath, 'utf-8');
      const sections = parseMarkdownSections(content, config.key, config.defaultPriority);

      // 해당 문서의 기존 데이터 삭제
      const { error: deleteError } = await supabase
        .from('reference_doc_sections')
        .delete()
        .eq('doc_key', config.key);

      if (deleteError) {
        results.push({ doc: config.key, sections: 0, error: `삭제 실패: ${deleteError.message}` });
        continue;
      }

      // 새 섹션 데이터 삽입 (50개씩 배치)
      let insertedCount = 0;
      for (let i = 0; i < sections.length; i += 50) {
        const batch = sections.slice(i, i + 50).map(s => ({
          doc_key: s.doc_key,
          section_title: s.section_title,
          content: s.content,
          keywords: s.keywords,
          priority: s.priority,
          updated_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase
          .from('reference_doc_sections')
          .insert(batch);

        if (insertError) {
          results.push({ doc: config.key, sections: insertedCount, error: `삽입 실패: ${insertError.message}` });
          break;
        }
        insertedCount += batch.length;
      }

      if (!results.find(r => r.doc === config.key && r.error)) {
        results.push({ doc: config.key, sections: insertedCount });
      }
      totalSections += insertedCount;
    }

    return NextResponse.json({
      success: true,
      message: `${totalSections}개 섹션 동기화 완료`,
      totalSections,
      details: results,
    });

  } catch (err: any) {
    console.error('[참조문서 동기화 오류]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
