/**
 * 참조 문서 → Supabase 동기화 스크립트
 * 실행: node scripts/sync-ref-docs.js
 */
const fs = require('fs');
const path = require('path');

// .env.local 읽기
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#][^=]*)=(.*)/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = path.join(__dirname, '..', 'novels', 'murim_mna');

const DOC_CONFIGS = [
  // ── 🗺️ 마스터 색인 (항상 최우선 로딩) ──
  { key: 'file_index',         file: '_파일_색인.md',                   defaultPriority: 1 },

  // ── A. 지휘부 (슬림화된 핵심) ──
  { key: 'bible',              file: 'master_story_bible.md',          defaultPriority: 1 },
  { key: 'rules_core',         file: '집필_규칙_핵심.md',              defaultPriority: 1 },
  { key: 'master',             file: '소설_진행_마스터.md',             defaultPriority: 1 },

  // ── B. 집필 엔진 ──
  { key: 'engine_3persona',    file: '3인격_엔진.md',                  defaultPriority: 1 },
  { key: 'engine_emotion',     file: '이준혁_감정_엔진.md',             defaultPriority: 1 },
  { key: 'engine_giryu',       file: '기류감응_가이드.md',              defaultPriority: 1 },
  { key: 'style_guide',        file: '문체_가이드.md',                  defaultPriority: 1 },

  // ── C. 스토리 설계도 ──
  { key: 'story_arc',          file: '스토리_아크_상세.md',             defaultPriority: 2 },
  { key: 'tournament_setting', file: '무림대회_설정.md',                defaultPriority: 2 },

  // ── D. 인물 ──
  { key: 'char_main',          file: '캐릭터_주인공.md',               defaultPriority: 1 },
  { key: 'char_support',       file: '캐릭터_조연_세력.md',             defaultPriority: 2 },
  { key: 'char_tournament',    file: '캐릭터_무림대회.md',              defaultPriority: 2 },
  { key: 'char_system',        file: '캐릭터_시스템.md',               defaultPriority: 2 },

  // ── E. 무공/전투 (world_db) ──
  { key: 'martial_system',     file: 'world_db/무공_시스템.md',         defaultPriority: 1 },
  { key: 'martial_protagonist',file: 'world_db/무공_주인공_상세.md',     defaultPriority: 1 },
  { key: 'combat_guide',       file: 'world_db/전투_안무가이드.md',      defaultPriority: 1 },
  { key: 'martial_dictionary', file: 'world_db/무공_기법_대전.md',      defaultPriority: 2 },

  // ── F. 조직/세력 (world_db) ──
  { key: 'org_chunhwa',        file: 'world_db/천화련_조직_사업.md',     defaultPriority: 2 },
  { key: 'org_ansi',           file: 'world_db/안씨표국_안가.md',        defaultPriority: 2 },
  { key: 'power_map',          file: 'world_db/세력도.md',              defaultPriority: 2 },

  // ── G. 경제 (world_db) ──
  { key: 'economy',            file: 'world_db/경제_시스템_심화.md',     defaultPriority: 2 },
  { key: 'business_terms',     file: 'world_db/경영_용어집.md',         defaultPriority: 2 },

  // ── H. 세계관 백과사전 (world_db) ──
  { key: 'geo_travel',         file: 'world_db/지리_이동_DB.md',        defaultPriority: 2 },
  { key: 'food_db',            file: 'world_db/음식_DB.md',             defaultPriority: 2 },
  { key: 'food_biz',           file: 'world_db/사업_음식기술.md',        defaultPriority: 2 },
  { key: 'architecture',       file: 'world_db/건축_객실_DB.md',        defaultPriority: 2 },
  { key: 'weapons',            file: 'world_db/무기_병기_DB.md',        defaultPriority: 2 },
  { key: 'clothing',           file: 'world_db/의복_복식_DB.md',        defaultPriority: 2 },
  { key: 'inns',               file: 'world_db/지역별_객잔_DB.md',      defaultPriority: 2 },
  { key: 'modern_knowledge',   file: 'world_db/이준혁_현대지식_DB.md',   defaultPriority: 2 },
  { key: 'wuxia_terms',        file: 'world_db/무협_용어집.md',         defaultPriority: 2 },

  // ── I. 전략/방향 ──
  { key: 'theme',              file: '테마_주제의식.md',                defaultPriority: 2 },
  { key: 'competitive',        file: '경쟁작_차별화.md',               defaultPriority: 2 },
  { key: 'reader_target',      file: '독자_타겟분석.md',               defaultPriority: 2 },
];

// ── 키워드 추출 ──
function extractKeywords(title, content) {
  const keywords = new Set();

  // 제목 한글 단어
  (title.match(/[가-힣]{2,}/g) || []).forEach(w => keywords.add(w));

  // **굵은글씨** 용어
  (content.match(/\*\*([^*]+)\*\*/g) || []).forEach(match => {
    const term = match.replace(/\*\*/g, '').trim();
    (term.match(/[가-힣]{2,}/g) || []).forEach(w => keywords.add(w));
    if (/[A-Za-z]/.test(term) && term.length <= 20) keywords.add(term);
  });

  // 한자 포함 무공명
  (content.match(/[가-힣]+\([一-龥a-zA-Z]+\)/g) || []).forEach(match => {
    const k = match.match(/^[가-힣]+/);
    if (k) keywords.add(k[0]);
  });

  // 무공/심법명 패턴
  (content.match(/[가-힣]{2,}(?:법|공|식|진|결|경|장)\b/g) || []).forEach(w => keywords.add(w));

  // 불필요 단어 제거
  ['이것','그것','때문','하지만','그리고','또한','아래','다음','기본','설정','내용','항목','참조','참고']
    .forEach(w => keywords.delete(w));

  return Array.from(keywords).slice(0, 30);
}

// ── 우선순위 결정 ──
function determinePriority(docKey, title, content, defaultPriority) {
  const criticalPatterns = [
    /전수.*정책|전수.*범위|전수.*한계/,
    /위소운.*독점|독점.*영역/,
    /3인격|삼인격/,
    /말투.*절대|말투.*불변/,
    /금지어|금지.*문구/,
    /심법|검법|무공|전수|수련/,
  ];
  for (const p of criticalPatterns) {
    if (p.test(title) || p.test(content.slice(0, 300))) return 1;
  }
  if (docKey === 'master') return 1;
  return defaultPriority;
}

// ── 마크다운 섹션 분할 ──
function parseMarkdown(content, docKey, defaultPriority) {
  const lines = content.split('\n');
  const rawSections = [];
  let curTitle = '(서두)';
  let curLines = [];

  for (const line of lines) {
    const hdr = line.match(/^(#{1,4})\s+(.+)/);
    if (hdr) {
      if (curLines.length > 0) {
        const txt = curLines.join('\n').trim();
        if (txt.length > 10) rawSections.push({ title: curTitle, content: txt });
      }
      curTitle = hdr[2].trim();
      curLines = [line];
    } else {
      curLines.push(line);
    }
  }
  if (curLines.length > 0) {
    const txt = curLines.join('\n').trim();
    if (txt.length > 10) rawSections.push({ title: curTitle, content: txt });
  }

  // 큰 섹션은 하위 헤더로 재분할
  const sections = [];
  for (const sec of rawSections) {
    const lineCount = sec.content.split('\n').length;
    if (lineCount > 250) {
      const subLines = sec.content.split('\n');
      let subTitle = sec.title;
      let subBuf = [];
      for (const sl of subLines) {
        const sub = sl.match(/^(#{2,5})\s+(.+)/);
        if (sub && subBuf.length > 5) {
          const txt = subBuf.join('\n').trim();
          if (txt.length > 10) {
            sections.push({
              doc_key: docKey,
              section_title: subTitle,
              content: txt,
              keywords: extractKeywords(subTitle, txt),
              priority: determinePriority(docKey, subTitle, txt, defaultPriority),
            });
          }
          subTitle = sub[2].trim();
          subBuf = [sl];
        } else {
          subBuf.push(sl);
        }
      }
      if (subBuf.length > 0) {
        const txt = subBuf.join('\n').trim();
        if (txt.length > 10) {
          sections.push({
            doc_key: docKey,
            section_title: subTitle,
            content: txt,
            keywords: extractKeywords(subTitle, txt),
            priority: determinePriority(docKey, subTitle, txt, defaultPriority),
          });
        }
      }
    } else {
      sections.push({
        doc_key: docKey,
        section_title: sec.title,
        content: sec.content,
        keywords: extractKeywords(sec.title, sec.content),
        priority: determinePriority(docKey, sec.title, sec.content, defaultPriority),
      });
    }
  }
  return sections;
}

// ── Supabase REST API 호출 ──
async function supabaseRequest(method, endpoint, body) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'DELETE' ? '' : 'return=minimal',
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${method} ${endpoint}: ${res.status} - ${txt}`);
  }
  return res;
}

// ── 메인 실행 ──
async function main() {
  console.log('━━ 참조 문서 → Supabase 동기화 시작 ━━\n');
  let totalSections = 0;

  for (const config of DOC_CONFIGS) {
    const filePath = path.join(BASE, config.file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ❌ ${config.key}: 파일 없음 (${config.file})`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const sections = parseMarkdown(content, config.key, config.defaultPriority);

    // 기존 데이터 삭제
    await supabaseRequest('DELETE', `reference_doc_sections?doc_key=eq.${config.key}`);

    // 50개씩 배치 삽입
    for (let i = 0; i < sections.length; i += 50) {
      const batch = sections.slice(i, i + 50).map(s => ({
        doc_key: s.doc_key,
        section_title: s.section_title,
        content: s.content,
        keywords: s.keywords,
        priority: s.priority,
        updated_at: new Date().toISOString(),
      }));
      await supabaseRequest('POST', 'reference_doc_sections', batch);
    }

    // 통계
    const p1 = sections.filter(s => s.priority === 1).length;
    const p2 = sections.filter(s => s.priority === 2).length;
    console.log(`  ✅ ${config.key}: ${sections.length}개 섹션 (핵심 ${p1}, 일반 ${p2})`);
    sections.forEach(s => {
      console.log(`     ${s.priority === 1 ? '★' : '·'} [${s.section_title.slice(0,40)}] kw: ${s.keywords.slice(0,5).join(', ')}`);
    });
    totalSections += sections.length;
  }

  console.log(`\n━━ 완료: 총 ${totalSections}개 섹션 업로드됨 ━━`);
}

main().catch(e => { console.error('오류:', e.message); process.exit(1); });
