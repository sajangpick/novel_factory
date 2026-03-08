/**
 * 36~45화 skeleton DB 입력 스크립트
 * - 1~35화, 46~75화 절대 수정 금지
 */
import https from 'https';

const SUPABASE_URL = 'yzhpqnpkhhxvptogybam.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6aHBxbnBraGh4dnB0b2d5YmFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxOTg1MCwiZXhwIjoyMDg1MTk1ODUwfQ.vGJ-xFigScjS75OnbD4-mbL0DMKfJOG7dMZW3JNvrLg';

const SKELETONS = {
  36: `소씨상단의 배후
武: 천마가 소연화의 움직임을 주시. "저 여자, 단순한 상단 딸이 아니다."
商: 이준혁이 소씨상단 재무 구조 분석. 배후에 낙양 세력 확인.
仁: 위소운이 소연화에게 직접 접근. 적인지 동료인지 파악 시도.
끝 장면: 소연화 "왜 저를 믿으려 하세요?" 위소운 "모르겠어요. 그냥 믿고 싶어서요."`,

  37: `당찬의 과거
武: 당찬이 과거 강호에서 쫓기던 이유 일부 공개. 천마 "쓸 만하군."
商: 당찬이 천화루 개봉점 물류 총괄로 정식 편입.
仁: 위소운이 당찬의 상처를 보고 묻지 않음. 그냥 밥 한 그릇 내밀음.
끝 장면: 당찬 "(속으로) 이 사람 옆에 있으면 살 것 같다."`,

  38: `강남 첩보
武: 강남 지역 무림 세력 지도 완성. 천마 "항주가 관문이다."
商: 이준혁이 강남 진출 로드맵 확정. 소주→항주→호북 순서.
仁: 강남 빈민 실태 보고서 입수. 위소운 "가야겠다."
끝 장면: 이준혁 "또 예정에 없는 일을 벌이려고요?" 위소운 "네."`,

  39: `소주 2호점
武: 소주 진출 전 천마가 지역 기류 전면 스캔.
商: 소주 2호점 오픈. 개봉과 다른 강남식 메뉴 추가.
仁: 소주 개점 당일 고아 아이들 초대해 무료 식사.
끝 장면: 주덕삼 "이 집도 금방 소문 납니다." 이준혁 "그게 목표니까."`,

  40: `기(起) 전반 결산
武: 천마가 위소운에게 첫 번째 실전 대련 제안. 위소운 버텨냄.
商: 개봉+소주 2개 거점 결산. 목표 대비 130% 달성.
仁: 첫 결산 자리에서 위소운 "수익의 일부를 구호에 쓰겠다" 공식 선언.
끝 장면: 이준혁 "(혼자) 이게 손해인지 투자인지 모르겠다."`,

  41: `항주 입성
武: 항주 입성 전 천마 "여기는 물의 도시. 기류가 복잡하다."
商: 항주 부자 상인들과 첫 미팅. 천화선분 납품 계약 논의.
仁: 항주 운하 옆 빈민가 발견. 위소운 "여기도 똑같구나."
끝 장면: 이준혁 "항주만 잡으면 강남은 끝이다."`,

  42: `냉각 음료의 탄생
武: 천마가 무공으로 물을 냉각하는 원리를 상업 응용 가능성 제시.
商: 이준혁이 빙수 응용 냉각 음료 개발. 항주 귀족층 공략.
仁: 무더위 속 노동자들에게 냉각 음료 무료 제공.
끝 장면: 위소운 "맛있다." 이준혁 "그게 다예요?" 위소운 "네. 맛있어요."`,

  43: `주루 연합의 압박
武: 항주 기존 주루들이 연합해 천화루 방해 공작.
商: 공급망 압박에 이준혁이 직접 납품처 확보.
仁: 연합에 참여한 주루 주인 한 명이 사실 빚에 쫓기는 것 발견. 위소운 도움.
끝 장면: 그 주루 주인 "왜 도와주는 거요?" 위소운 "모르는 사람도 도와야 하거든요."`,

  44: `위소운의 한계
武: 연속된 전투+협상+구호로 위소운 체력 한계. 천마 "쓰러지기 전에 멈춰라."
商: 이준혁이 처음으로 위소운을 쉬게 함. 혼자 협상 처리.
仁: 쓰러진 위소운이 꿈속에서 어린 시절 굶던 기억.
끝 장면: 깨어난 위소운 "얼마나 잤어요?" 이준혁 "사흘이요."`,

  45: `항주 3호점 오픈
武: 3호점 오픈 전날 밤 자객 출현. 천마 단독 제압.
商: 항주 3호점 성공적 오픈. 강남 천화루 거점 확보.
仁: 오픈 행사에 빈민가 아이들 초대. 항주 귀족들 눈살 찌푸림.
끝 장면: 위소운 "이게 천화루입니다." 귀족들 침묵.`,
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

  // 2. 기존 데이터 스냅샷 (변경 금지 구간)
  const snap = ep => ({ id: ep.id, skelLen: (ep.skeleton || '').length });
  const before1_35 = episodes.slice(0, 35).map(snap);
  const before46_75 = episodes.slice(45, 75).map(snap);

  // 3. 36~45화 skeleton 업데이트
  let updateCount = 0;
  for (const ep of episodes) {
    if (ep.id >= 36 && ep.id <= 45 && SKELETONS[ep.id]) {
      ep.skeleton = SKELETONS[ep.id];
      updateCount++;
    }
  }
  console.log(`✏️  ${updateCount}개 에피소드 skeleton 업데이트 예정`);

  // 4. 보호 구간 변경 없음 확인
  const after1_35 = episodes.slice(0, 35).map(snap);
  const after46_75 = episodes.slice(45, 75).map(snap);
  for (let i = 0; i < 35; i++) {
    if (before1_35[i].skelLen !== after1_35[i].skelLen)
      throw new Error(`❌ 1~35화 변경 감지! id=${before1_35[i].id}`);
  }
  for (let i = 0; i < 30; i++) {
    if (before46_75[i].skelLen !== after46_75[i].skelLen)
      throw new Error(`❌ 46~75화 변경 감지! id=${before46_75[i].id}`);
  }
  console.log('✅ 1~35화, 46~75화 데이터 변경 없음 확인');

  // 5. PATCH
  console.log('📤 Supabase PATCH 중...');
  const patchRes = await request('PATCH', `/rest/v1/novel_plans?id=eq.${rowId}`, { data: episodes });
  if (patchRes.status !== 204) throw new Error(`PATCH 실패: ${patchRes.status} ${patchRes.body}`);
  console.log('✅ PATCH 성공 (204)');

  // 6. 검증: 36~45화
  console.log('\n📊 검증 — 36~45화 skeleton 길이:');
  for (const ep of episodes) {
    if (ep.id >= 36 && ep.id <= 45) {
      const len = (ep.skeleton || '').length;
      const preview = (ep.skeleton || '').slice(0, 25);
      console.log(`  제${ep.id}화: ${len}자 | ${preview}...`);
    }
  }

  // 7. 검증: 1~35화 + 46~75화 skeleton 길이 표시
  console.log('\n📊 검증 — 1~35화 skeleton 있는 화:');
  const has1_35 = episodes.slice(0, 35).filter(ep => ep.skeleton?.trim());
  console.log(`  ${has1_35.map(e => e.id).join(', ')} (${has1_35.length}개)`);

  console.log('\n📊 검증 — 46~75화 skeleton 있는 화:');
  const has46_75 = episodes.slice(45, 75).filter(ep => ep.skeleton?.trim());
  console.log(`  ${has46_75.map(e => e.id).join(', ')} (${has46_75.length}개)`);

  console.log('\n🎉 완료!');
}

main().catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
