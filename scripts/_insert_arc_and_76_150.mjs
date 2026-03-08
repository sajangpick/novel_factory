/**
 * arc/arc_block 필드 추가 + 76~150화 title 입력
 * - 1~75화 skeleton 절대 변경 금지
 * - arc/arc_block은 JSON 배열 내 필드로 추가 (SQL 스키마 변경 없음)
 */
import https from 'https';

const SUPABASE_URL = 'yzhpqnpkhhxvptogybam.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6aHBxbnBraGh4dnB0b2d5YmFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxOTg1MCwiZXhwIjoyMDg1MTk1ODUwfQ.vGJ-xFigScjS75OnbD4-mbL0DMKfJOG7dMZW3JNvrLg';

// ── arc 매핑 ──
function getArc(id) {
  if (id <= 13)  return { arc: '프롤로그', arc_block: '' };
  if (id <= 25)  return { arc: '기',       arc_block: '블록1 (준비)' };
  if (id <= 35)  return { arc: '기',       arc_block: '블록2 (개봉 장악)' };
  if (id <= 45)  return { arc: '기',       arc_block: '블록3 (강남 진출)' };
  if (id <= 55)  return { arc: '기',       arc_block: '블록4 (무림맹)' };
  if (id <= 65)  return { arc: '기',       arc_block: '블록5 (첫 위기)' };
  if (id <= 75)  return { arc: '기',       arc_block: '블록6 (반격)' };
  if (id <= 90)  return { arc: '승',       arc_block: '블록7 (낙양 입성)' };
  if (id <= 105) return { arc: '승',       arc_block: '블록8 (진짜 전쟁)' };
  if (id <= 120) return { arc: '승',       arc_block: '블록9 (동맹과 배신)' };
  if (id <= 135) return { arc: '승',       arc_block: '블록10 (반전과 도약)' };
  if (id <= 150) return { arc: '승',       arc_block: '블록11 (승 마무리)' };
  if (id <= 225) return { arc: '전',       arc_block: '' };
  return              { arc: '결',       arc_block: '' };
}

// ── 76~150화 제목 ──
const TITLES_76_150 = {
  76: '낙양을 향해',
  77: '낙양 첫인상',
  78: '규모의 압도',
  79: '낙양 상권 지도',
  80: '혈마상회의 그림자',
  81: '6호점 부지 전쟁',
  82: '사마천의 방해',
  83: '옥패 3단계 반응',
  84: '천마의 기억 단편',
  85: '낙양 6호점 오픈',
  86: '사마천 "본게임이다"',
  87: '낙양 적응',
  88: '새 동료들',
  89: '낙양 정착',
  90: '블록7 결산',
  91: '전면 공세 시작',
  92: '거래처 70% 차단',
  93: '천화련 흔들림',
  94: '이준혁 납치 시도',
  95: '천마의 전력 투입',
  96: '자금 고갈 직전',
  97: '위소운의 결단',
  98: '전 재산 투입',
  99: '벼랑 끝',
  100: '100호점 달성 — 그러나 최대 위기',
  101: '사마천과의 첫 직접 충돌',
  102: '화경으로도 밀린다',
  103: '한계의 한계',
  104: '천마 "내가 나설 때"',
  105: '삼혼귀일경 일부 해방',
  106: '무림맹 맹주 공개 지지',
  107: '예상 밖 조력자들',
  108: '전세 역전 시작',
  109: '내부 배신자 감지',
  110: '첩자 추적',
  111: '배신자 발각',
  112: '냉혹한 결정',
  113: '위소운의 변화',
  114: '조직 재편',
  115: '소연화의 정체 일부 공개',
  116: '소씨상단의 진실',
  117: '소연화의 갈등',
  118: '소연화의 선택',
  119: '소씨상단 내부 분열',
  120: '블록9 결산',
  121: '역M&A 작전 시작',
  122: '혈마상회 자금줄 추적',
  123: '자금줄 차단 완성',
  124: '낙양 거점 붕괴',
  125: '사마천 퇴각',
  126: '혈마상회 해체',
  127: '사마천 도주 (죽지 않는다)',
  128: '승리의 여운',
  129: '어음 물류 시스템 완성',
  130: '전국 유통망 확보',
  131: '고아원 전국 확장',
  132: '3호 착공',
  133: '4호 착공',
  134: '5호 완성',
  135: '위소운의 소원 절반',
  136: '평화기',
  137: '세 사람의 관계',
  138: '각자의 꿈',
  139: '의문의 사나이 3차 등장',
  140: '옥패 진실 조각',
  141: '소무진의 흔적',
  142: '북방의 그림자',
  143: '황실 세력 복선',
  144: '새로운 위협 감지',
  145: '천마의 고백 — 소무진 이야기',
  146: '옥패 진실 50% 공개',
  147: '위소운의 충격',
  148: '재정비',
  149: '북방을 향해',
  150: '승(承) 마무리 — 전(轉) 예고',
};

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path,
      method,
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. 현재 episodes 가져오기
  console.log('📥 현재 episodes 불러오는 중...');
  const getRes = await request('GET', `/rest/v1/novel_plans?select=id,data&plan_key=eq.episodes&limit=1`);
  if (getRes.status !== 200) throw new Error(`GET 실패: ${getRes.status} ${getRes.body}`);

  const rows = JSON.parse(getRes.body);
  if (!rows.length) throw new Error('episodes 행 없음');

  const rowId = rows[0].id;
  const episodes = rows[0].data;
  console.log(`✅ ${episodes.length}개 에피소드 로드됨 (row id: ${rowId})`);

  // 2. 기존 skeleton 스냅샷 (1~75화 보호)
  const skelSnap = {};
  for (const ep of episodes) {
    if (ep.id <= 75) skelSnap[ep.id] = ep.skeleton || '';
  }

  // 3. 전체 arc/arc_block 추가 + 76~150화 title 업데이트
  let arcAdded = 0;
  let titleAdded = 0;
  for (const ep of episodes) {
    const { arc, arc_block } = getArc(ep.id);
    ep.arc = arc;
    ep.arc_block = arc_block;
    arcAdded++;

    if (ep.id >= 76 && ep.id <= 150 && TITLES_76_150[ep.id]) {
      ep.title = `제${ep.id}화 ${TITLES_76_150[ep.id]}`;
      titleAdded++;
    }
  }
  console.log(`✏️  arc/arc_block: ${arcAdded}개 추가`);
  console.log(`✏️  76~150화 title: ${titleAdded}개 업데이트`);

  // 4. 1~75화 skeleton 변경 없음 검증
  for (const ep of episodes) {
    if (ep.id <= 75) {
      if ((ep.skeleton || '') !== skelSnap[ep.id]) {
        throw new Error(`❌ 제${ep.id}화 skeleton 변경 감지!`);
      }
    }
  }
  console.log('✅ 1~75화 skeleton 변경 없음 확인');

  // 5. PATCH
  console.log('📤 Supabase PATCH 중...');
  const patchRes = await request('PATCH', `/rest/v1/novel_plans?id=eq.${rowId}`, { data: episodes });
  if (patchRes.status !== 204) throw new Error(`PATCH 실패: ${patchRes.status} ${patchRes.body}`);
  console.log('✅ PATCH 성공 (204)');

  // 6. 검증: arc 분포
  const arcCount = {};
  for (const ep of episodes) {
    arcCount[ep.arc] = (arcCount[ep.arc] || 0) + 1;
  }
  console.log('\n📊 arc 분포:');
  for (const [arc, cnt] of Object.entries(arcCount)) {
    console.log(`  ${arc}: ${cnt}개`);
  }

  // 7. 검증: 블록별 샘플
  console.log('\n📊 블록별 샘플 (첫 화):');
  const blockSamples = [76, 91, 106, 121, 136];
  for (const id of blockSamples) {
    const ep = episodes.find(e => e.id === id);
    console.log(`  제${ep.id}화 | arc=${ep.arc} | block=${ep.arc_block} | title=${ep.title}`);
  }

  // 8. 검증: 76~150화 title 확인 (처음 5개 + 마지막 5개)
  console.log('\n📊 76~150화 title (76~80화):');
  for (const ep of episodes.slice(75, 80)) {
    console.log(`  제${ep.id}화: ${ep.title}`);
  }
  console.log('\n📊 76~150화 title (146~150화):');
  for (const ep of episodes.slice(145, 150)) {
    console.log(`  제${ep.id}화: ${ep.title}`);
  }

  // 9. 검증: 1~75화 skeleton 있는 화
  const hasSkel = episodes.slice(0, 75).filter(ep => ep.skeleton?.trim()).map(e => e.id);
  console.log(`\n✅ 1~75화 skeleton 보존: ${hasSkel.join(', ')} (${hasSkel.length}개)`);

  console.log('\n🎉 완료!');
}

main().catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
