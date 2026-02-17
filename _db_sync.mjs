// Supabase 캐릭터 DB 동기화 스크립트 (2026-02-16)
// 인명록 기준 45명 / 문파 13개로 정리
import { readFileSync } from 'fs';

// .env.local에서 Supabase 정보 읽기
const env = readFileSync('.env.local', 'utf8');
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
if (!URL || !KEY) { console.error('❌ .env.local에서 URL/KEY를 찾을 수 없습니다'); process.exit(1); }

// 무공 등급 → 숫자 변환
function rankNum(r) {
  const m = {
    '천인': 10, '현경': 9, '화경': 8, '초절정': 7,
    '절정': 6, '일류': 5, '이류': 4, '삼류': 3, '없음': 1
  };
  for (const [k, v] of Object.entries(m)) { if (r && r.includes(k)) return v; }
  return 0;
}

// ========== 45명 캐릭터 데이터 ==========
const characters = [
  // ===== 1. 천화련 (5명) =====
  {
    name: '위소운', role: 'protagonist', faction: '천화련',
    title: '천화련 창주 (3인격 주인)', age: '21세',
    appearance: '180cm, 맑고 깊은 눈, 왼쪽 뺨 가는 흉터, 용모 출중한 미남',
    martial_rank: '초절정(화경 근접)', weapon: '장검(무명검)',
    personality: '따뜻하지만 상처받은 청년, 약자에 대한 공감, 정의감',
    speech_style: '반말~평어, 솔직하고 직설적',
    catchphrase: '돌아간다. 아직 내가 지켜야 할 사람들이 있어.',
    first_appearance: 1, importance_score: 100, is_recurring: true
  },
  {
    name: '이준혁', role: 'protagonist', faction: '천화련',
    title: '내면 인격 (머리/Brain)', age: '33세(전생)',
    appearance: '위소운 몸 공유 — 사업/협상 시 차가운 눈빛, 존댓말',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '천재 맥킨지 컨설턴트+미슐랭 셰프, 데이터 중심, 냉철',
    speech_style: '존댓말, 경영 용어, 데이터 중심',
    catchphrase: '마진율 1400%. 이건 술이 아니라 인쇄기입니다.',
    first_appearance: 1, importance_score: 95, is_recurring: true
  },
  {
    name: '천마', role: 'protagonist', faction: '천화련',
    title: '내면 인격 (주먹/Fist)', age: '48세(300년 전 사망)',
    appearance: '위소운 몸 공유 — 전투 시 검은 눈빛, 살기',
    martial_rank: '현경(역대 최강 마교교주)', weapon: null,
    personality: '압도적 오만함, 30년 무림 경험, 배신에 극도로 민감',
    speech_style: '하오체, 간결하고 건방짐',
    catchphrase: '벌레 같은 놈들이 판을 치는구나.',
    first_appearance: 1, importance_score: 95, is_recurring: true
  },
  {
    name: '안세진', role: 'supporting', faction: '천화련',
    title: '천화표국 개봉지국장 (옛 안씨표국 10대 국주)', age: '45세',
    appearance: '과묵한 중년 무인, 의리 있는 눈빛',
    martial_rank: '절정급(합류 후)', weapon: '귀원검법',
    personality: '과묵하고 의리 있음, 300년 유언을 지켜온 수호자',
    speech_style: '짧고 진중한 말투',
    catchphrase: '...기다렸습니다.',
    first_appearance: 11, importance_score: 55, is_recurring: true
  },
  {
    name: '안효림', role: 'supporting', faction: '천화련',
    title: '안세진 장남, 양조장 총괄', age: '22세',
    appearance: '젊고 자존심 강한 무인',
    martial_rank: '일류 후기', weapon: '귀원검법+창법',
    personality: '자존심 강함, 능력 있으나 불만 → 인정 후 충성',
    speech_style: '격앙되기 쉬운 젊은이 말투',
    catchphrase: '300년입니다! 우리 안가가 300년 동안 지켜왔어요!',
    first_appearance: 15, importance_score: 45, is_recurring: true
  },

  // ===== 2. 천풍검문 (3명) =====
  {
    name: '소연화', role: 'major_supporting', faction: '천풍검문',
    title: '장문인의 딸, 히로인', age: '19세',
    appearance: '165cm, 단정하고 깨끗한 인상, 영리한 맑은 눈, 초승달 미소',
    martial_rank: '이류 중위', weapon: '천풍검법(여성 변형)',
    personality: '영리하고 적극적, 호기심이 행동력으로, 따뜻하고 배려 깊음',
    speech_style: '밝고 영리, 때때로 진지',
    catchphrase: '비밀이 많으시네요.',
    first_appearance: 1, importance_score: 80, is_recurring: true
  },
  {
    name: '당찬', role: 'major_supporting', faction: '천풍검문',
    title: '천풍검문 수석제자', age: '21세',
    appearance: '177cm, 날카로운 눈매, 각진 턱, 잘생겼지만 차가운 인상',
    martial_rank: '이류 상위', weapon: '천풍검법',
    personality: '자존심 덩어리, 감정 표현 서투름, 정의감 있음',
    speech_style: '짧고 날카로움, 감정 숨김',
    catchphrase: '......안 보였어.',
    first_appearance: 1, importance_score: 75, is_recurring: true
  },
  {
    name: '소풍명', role: 'minor', faction: '천풍검문',
    title: '천풍검문 장문인, 소연화 아버지', age: '50대',
    appearance: '위엄 있는 중년 검객',
    martial_rank: '절정급', weapon: '천풍검법',
    personality: '엄격하지만 딸에게 따뜻, 위소운에게 서구진 관리 위탁',
    speech_style: '무게 있는 어른 말투',
    catchphrase: null,
    first_appearance: 25, importance_score: 30, is_recurring: false
  },

  // ===== 3. 화산파 (2명) =====
  {
    name: '곽진', role: 'major_supporting', faction: '화산파',
    title: '화산파 대제자', age: '24세',
    appearance: '높은 상투 매화 비녀, 청백색 도포, 깔끔한 모범생',
    martial_rank: '일류 최상위', weapon: '매화검',
    personality: '겉은 완벽한 수석, 속은 불안과 죄책감, 위소운을 밀어뜨린 장본인',
    speech_style: '예의바르지만 속에 독이 있음',
    catchphrase: null,
    first_appearance: 2, importance_score: 70, is_recurring: true
  },
  {
    name: '소백하', role: 'major_supporting', faction: '화산파',
    title: '화산파 여제자, 중원사미 1위', age: '20세',
    appearance: '청초하고 맑은 미인, 슬픈 눈, 매화선녀',
    martial_rank: '이류 상위', weapon: '매화검법',
    personality: '조용한 그리움, 위소검(위소운) 기억, 과거의 인연',
    speech_style: '조용하고 절제된 말투',
    catchphrase: null,
    first_appearance: 2, importance_score: 65, is_recurring: true
  },

  // ===== 4. 남궁세가 (2명) =====
  {
    name: '남궁현', role: 'major_supporting', faction: '남궁세가',
    title: '남궁세가 적장자, 소검신', age: '25세',
    appearance: '183cm, 백색 비단 도포, 금비녀, 호탕한 귀공자',
    martial_rank: '절정 안정', weapon: '남궁세가 가전검법',
    personality: '호탕하고 시원시원함, 강한 상대를 만나면 눈이 빛남',
    speech_style: '호쾌하고 거침없는 말투',
    catchphrase: '좋아! 한 판 뜨자! 술은 진 쪽이 사!',
    first_appearance: 3, importance_score: 75, is_recurring: true
  },
  {
    name: '남궁서연', role: 'minor', faction: '남궁세가',
    title: '남궁세가 소저, 남궁현 여동생, 중원사미 3위', age: '20세',
    appearance: '170cm, 고귀하면서 따뜻한 인상, 백색 비단 장삼',
    martial_rank: '일류 초입', weapon: '여제검법',
    personality: '온화하고 총명, 오빠바라기, 사업적 안목',
    speech_style: '품위 있고 온화한 말투',
    catchphrase: '오라버니, 이번에도 멋지게 이기실 거죠?',
    first_appearance: 6, importance_score: 40, is_recurring: true
  },

  // ===== 5. 소림사 (2명) =====
  {
    name: '혜공', role: 'minor', faction: '소림사',
    title: '소림 방장 겸 무림맹주', age: '80세',
    appearance: '회색 승복, 108주 염주, 흰 눈썹, 마른 체구 곧은 등',
    martial_rank: '현경 초입', weapon: '72절기+금강불괴공',
    personality: '99% 눈 감고 있음, 한마디가 무겁다, 공정',
    speech_style: '극히 짧고 무거운 말',
    catchphrase: '아미타불.',
    first_appearance: 7, importance_score: 35, is_recurring: false
  },
  {
    name: '혜광', role: 'minor', faction: '소림사',
    title: '소림사 속가제자', age: '26세',
    appearance: '삭발, 185cm 근육질, 둥근 얼굴 온순한 인상',
    martial_rank: '일류 고수', weapon: '금강권+나한장(맨주먹)',
    personality: '단순하고 솔직, 먹성 좋음',
    speech_style: '순진하고 솔직한 말투',
    catchphrase: '아미타불. 때리기 전에 사과드립니다.',
    first_appearance: 3, importance_score: 30, is_recurring: false
  },

  // ===== 6. 벽산파 (2명) =====
  {
    name: '장위', role: 'supporting', faction: '벽산파',
    title: '벽산파 제자', age: '20세',
    appearance: '보통 체구, 녹색 도복, 둥글고 솔직한 눈',
    martial_rank: '삼류 상위', weapon: '벽산검법',
    personality: '솔직하고 순함, 대식가, 만두 매니아',
    speech_style: '솔직하고 놀라기 잘함',
    catchphrase: '저 혼자 저걸 다 먹어?',
    first_appearance: 1, importance_score: 40, is_recurring: true
  },
  {
    name: '마현', role: 'supporting', faction: '벽산파',
    title: '벽산파 제자', age: '20세',
    appearance: '보통 체구, 녹색 도복, 장난기 있는 입꼬리',
    martial_rank: '삼류 상위', weapon: '벽산검법',
    personality: '장위보다 장난기, 킥킥 웃는 버릇, 분위기 파악 빠름',
    speech_style: '장난기 있는 말투',
    catchphrase: '......건달 넷을 젓가락으로?',
    first_appearance: 1, importance_score: 35, is_recurring: true
  },

  // ===== 7. 사천당가 (1명) =====
  {
    name: '당소령', role: 'minor', faction: '사천당가',
    title: '사천당가 소저, 중원사미 2위', age: '20세',
    appearance: '155cm, 고양이 눈, 양갈래 높은 묶음에 방울 장식',
    martial_rank: '일류 고수', weapon: '독+암기',
    personality: '새침하고 도발적, 교활한 전략가',
    speech_style: '도발적이고 장난기 있는 말투',
    catchphrase: '아, 긁혔네? 10초면 마비가 올 텐데.',
    first_appearance: 3, importance_score: 35, is_recurring: false
  },

  // ===== 8. 마교 (1명) =====
  {
    name: '야율흑', role: 'major_supporting', faction: '마교',
    title: '마교 직계, 현 교주 직속 제자', age: '24세',
    appearance: '보통 체격, 검고 깊은 눈, 무표정, 의도적으로 눈에 안 띄는 차림',
    martial_rank: '절정 진입 직전', weapon: '암영검법 변형(위장)',
    personality: '냉정하고 관찰력 극상, 실력 숨김',
    speech_style: '말이 적고 필요한 만큼만 답함',
    catchphrase: '이름은 중요하지 않아. 검이 말해주니까.',
    first_appearance: 8, importance_score: 65, is_recurring: true
  },

  // ===== 9. 사파 (1명) =====
  {
    name: '호령', role: 'supporting', faction: '사파',
    title: '사파 흑도 용병/암살자', age: '27세',
    appearance: '평범한 얼굴에 항상 웃고 있음, 눈이 안 웃음, 얇은 단도',
    martial_rank: '일류 고수', weapon: '자창 단도술',
    personality: '항상 웃지만 눈이 안 웃음, 돈에 솔직',
    speech_style: '가볍고 말 많지만 행동은 정확',
    catchphrase: '아, 미안. 습관이야. 급소를 노리는 건.',
    first_appearance: 8, importance_score: 50, is_recurring: true
  },

  // ===== 10. 정파 문파 (6명) =====
  {
    name: '서영', role: 'minor', faction: '정파 문파',
    title: '무당파 수석제자', age: '28세',
    appearance: '175cm 마른 체형, 맑은 눈, 도사 관에 묶은 머리',
    martial_rank: '일류 고수', weapon: '태극검법',
    personality: '철학적, 승부에 집착 안 함',
    speech_style: '도가적 어투',
    catchphrase: '물처럼 흘러가라.',
    first_appearance: 3, importance_score: 25, is_recurring: false
  },
  {
    name: '하진', role: 'minor', faction: '정파 문파',
    title: '점창파 수석제자', age: '29세',
    appearance: '177cm 평범한 체격, 양손 검 베인 자국, 조용하고 깊은 눈',
    martial_rank: '일류 최상위', weapon: '점창검법',
    personality: '말이 적고 관찰력 좋음, 형 같은 존재',
    speech_style: '차분하고 담백한 말투',
    catchphrase: '29살이야. 이번이 마지막이지.',
    first_appearance: 3, importance_score: 25, is_recurring: false
  },
  {
    name: '당영란', role: 'minor', faction: '정파 문파',
    title: '아미파 수석제자, 중원사미 4위', age: '22세',
    appearance: '168cm, 차갑고 단정한 얼굴, 흰 도복, 냉검미인',
    martial_rank: '일류 초입', weapon: '아미검법',
    personality: '냉정하고 과묵, 오직 검',
    speech_style: '차갑고 짧은 말투',
    catchphrase: '말 걸지 마. 집중하고 있으니까.',
    first_appearance: 6, importance_score: 25, is_recurring: false
  },
  {
    name: '임도현', role: 'minor', faction: '정파 문파',
    title: '종남파 제자', age: '25세',
    appearance: '176cm, 둥글고 큰 입, 항상 웃는 얼굴, 느슨한 상투',
    martial_rank: '일류 초입', weapon: '종남검법',
    personality: '수다쟁이, 정보통, 친화력 극강',
    speech_style: '수다스럽고 친근한 말투',
    catchphrase: '그 소문 들었어? 남궁세가 소검신이 이번에......',
    first_appearance: 7, importance_score: 20, is_recurring: false
  },
  {
    name: '한소검', role: 'minor', faction: '정파 문파',
    title: '해남파 수석제자', age: '26세',
    appearance: '180cm, 짙은 갈색 피부, 밝은 눈, 남방 스타일',
    martial_rank: '일류 초입', weapon: '해남검법',
    personality: '개방적이고 호쾌, 중원 문화에 호기심',
    speech_style: '호쾌하고 자유로운 말투',
    catchphrase: '바다에서 태풍을 이기면 사람 따위는 쉬워!',
    first_appearance: 9, importance_score: 20, is_recurring: false
  },
  {
    name: '유청풍', role: 'minor', faction: '정파 문파',
    title: '개방 장로, 은퇴 고수', age: '60대',
    appearance: '은퇴한 무인, 해설자 풍모',
    martial_rank: '절정급(은퇴)', weapon: null,
    personality: '현명하고 해설을 잘함',
    speech_style: '노련하고 해박한 어투',
    catchphrase: null,
    first_appearance: 12, importance_score: 15, is_recurring: false
  },

  // ===== 11. 상단/표국 (7명) =====
  {
    name: '여상진', role: 'supporting', faction: '상단/표국',
    title: '소주 천보상단 부단주', age: '40대',
    appearance: '상인풍 깔끔한 차림',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '숫자로 말하는 상인, 증류주 파트너',
    speech_style: '상인답게 계산적인 말투',
    catchphrase: null,
    first_appearance: 9, importance_score: 40, is_recurring: true
  },
  {
    name: '곽대용', role: 'supporting', faction: '상단/표국',
    title: '만리표국 총표두', age: '48세',
    appearance: '입지전적 표사 출신, 무인 풍모',
    martial_rank: '절정급', weapon: '만리장도법',
    personality: '의리파+현실주의, 이익이 되면 적도 친구',
    speech_style: '직설적이고 현실적',
    catchphrase: '물류에 끼어들 생각이면 전쟁이다. ...하지만 나누자면, 이야기해보지.',
    first_appearance: 9, importance_score: 40, is_recurring: true
  },
  {
    name: '진만복', role: 'minor', faction: '상단/표국',
    title: '개봉상회 회주', age: '62세',
    appearance: '40년 상인 경력의 노인',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '온화하지만 기득권 보호에 날카로움',
    speech_style: '온화하지만 원칙적인 말투',
    catchphrase: '새 가게? 상회에 먼저 가입하시게. 규칙이 있어야 거래가 있지.',
    first_appearance: 19, importance_score: 25, is_recurring: false
  },
  {
    name: '풍만장', role: 'minor', faction: '상단/표국',
    title: '진무관 관주', age: '52세',
    appearance: '3대째 개봉 토박이, 직선적 무인',
    martial_rank: '절정 중기', weapon: '풍가도법',
    personality: '직선적, 텃세 강함, 실력은 인정하는 기질',
    speech_style: '거침없고 직선적',
    catchphrase: '무림대회 우승? 대단하지. 그런데 개봉은 좀 다르다네.',
    first_appearance: 20, importance_score: 25, is_recurring: false
  },
  {
    name: '주덕삼', role: 'minor', faction: '상단/표국',
    title: '발효주 장인, 천화소주 원주 담당', age: '50대 후반',
    appearance: '과묵한 장인, 완벽주의 양조사',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '과묵, 완벽주의, 술에 대한 자부심이 하늘',
    speech_style: '과묵하지만 술 얘기하면 열정적',
    catchphrase: '내 술에 물 타면 죽여.',
    first_appearance: 17, importance_score: 25, is_recurring: false
  },
  {
    name: '손약령', role: 'minor', faction: '상단/표국',
    title: '재료 전문가, 천화 연구방 재료 총괄', age: '30대 초반',
    appearance: '당당한 여성, 약재상 3대째',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '당당하고 실용적, 재료에 타협 없음',
    speech_style: '당당하고 전문적인 말투',
    catchphrase: '눈으로만 사는 건 바보예요.',
    first_appearance: 18, importance_score: 25, is_recurring: false
  },
  {
    name: '엄표', role: 'minor', faction: '상단/표국',
    title: '태행산 표국 호위무사 → 천화표국 지방 분국장', age: '29세',
    appearance: '온몸 칼자국, 거친 손, 투박한 검',
    martial_rank: '일류 초입', weapon: '실전 검술',
    personality: '솔직하고 담백, 어머니 생각에 눈빛 달라짐',
    speech_style: '솔직하고 담백한 말투',
    catchphrase: '15년 동안 칼 맞으면서 배웠어. 명문이 뭐 다를까.',
    first_appearance: 23, importance_score: 20, is_recurring: false
  },

  // ===== 12. 무소속/민간 (10명) =====
  {
    name: '철무광', role: 'minor', faction: '무소속/민간',
    title: '떠돌이 독학 권사', age: '26세',
    appearance: '떡 벌어진 어깨, 손등 굳은살, 옷 해지고 검 없음, 맨주먹',
    martial_rank: '일류 고수', weapon: '자창 철권(맨주먹)',
    personality: '말이 거의 없음, 전투 본능 극강',
    speech_style: '극도로 과묵',
    catchphrase: '......이름 같은 건 필요 없어. 이기면 되지.',
    first_appearance: 8, importance_score: 30, is_recurring: true
  },
  {
    name: '곽철', role: 'minor', faction: '무소속/민간',
    title: '개봉 뒷골목 권왕, 지하 비무장 출신', age: '29세(대회), 35세(도적)',
    appearance: '왼쪽 귀 반쯤 잘림, 금속 너클, 앞니 하나 빠짐',
    martial_rank: '이류 상위', weapon: '맨주먹+금속 너클',
    personality: '거칠지만 약자는 안 건드리는 선, 쿨함',
    speech_style: '거칠고 직설적',
    catchphrase: '규칙? 나는 규칙 없는 데서 싸워왔는데.',
    first_appearance: 2, importance_score: 20, is_recurring: true
  },
  {
    name: '진풍', role: 'minor', faction: '무소속/민간',
    title: '태행산 소문파 제자, 위소운 예선 1전 상대', age: '28세',
    appearance: '180cm, 사각턱, 콧수염, 갈색 면 도포',
    martial_rank: '이류 중위', weapon: '태행도법',
    personality: '자신만만하지만 1합에 패배',
    speech_style: '허세 섞인 말투',
    catchphrase: '무소속? 좋지. 쉬운 상대부터 잡자!',
    first_appearance: 7, importance_score: 10, is_recurring: false
  },
  {
    name: '유비', role: 'minor', faction: '무소속/민간',
    title: '낙양 유씨검학원 수석, 위소운 예선 2전 상대', age: '23세',
    appearance: '175cm 단정, 백색 도포, 옥비녀, 도시 출신 도련님',
    martial_rank: '이류 상위', weapon: '유씨검법',
    personality: '예의 바르고 자신감, 10합 패배 후 존경',
    speech_style: '예의 바른 정통 말투',
    catchphrase: '10합...... 일부러 맞춰준 겁니까?',
    first_appearance: 7, importance_score: 10, is_recurring: false
  },
  {
    name: '진삼덕', role: 'minor', faction: '무소속/민간',
    title: '포목 상인', age: '50대',
    appearance: '통통한 체구, 단정한 수염, 소매에 포목 천 조각',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '소심하지만 성실, 딸 앞에서 허세, 울보',
    speech_style: '겸손하고 감사를 잘 표현',
    catchphrase: '은인! 은인이십니다!',
    first_appearance: 2, importance_score: 15, is_recurring: false
  },
  {
    name: '진소아', role: 'minor', faction: '무소속/민간',
    title: '진삼덕 딸', age: '14세',
    appearance: '동글동글한 얼굴, 볼살, 초롱초롱한 눈',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '활발하고 수다스러움, 위소운 미남 면역 없음',
    speech_style: '밝고 수다스러운 소녀 말투',
    catchphrase: '아버지! 저 오빠 누구예요?!',
    first_appearance: 2, importance_score: 10, is_recurring: false
  },
  {
    name: '손파', role: 'minor', faction: '무소속/민간',
    title: '관도 객잔 주인', age: '60대',
    appearance: '마른 할머니, 매서운 눈, 거친 입, 따뜻한 손',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '입이 거칠고 빠름, 아이들에게 약함, 정보통',
    speech_style: '거칠고 빠른 할머니 말투',
    catchphrase: '밥값 먼저! 사연은 밥 먹으면서 해!',
    first_appearance: 2, importance_score: 10, is_recurring: false
  },
  {
    name: '점소이', role: 'minor', faction: '무소속/민간',
    title: '천향루 종업원', age: '16~17세',
    appearance: '젊은 남자, 객잔 종업원 복장',
    martial_rank: '없음(비전투)', weapon: null,
    personality: '리액션 머신, 위소운 비범함을 일반인 시점으로 표현',
    speech_style: '공손한 종업원 말투',
    catchphrase: '손님, 혼자 드시는 겁니까?',
    first_appearance: 1, importance_score: 10, is_recurring: true
  },
  {
    name: '서문창', role: 'minor', faction: '무소속/민간',
    title: '무인도 은거기인 (사망)', age: '60대(사망 시)',
    appearance: '직접 등장 안 함 — 유품/유서로 간접 등장',
    martial_rank: '없음(비급 불완전)', weapon: null,
    personality: '딸을 빼앗기고 복수를 위해 섬으로 간 비운의 무관 관주',
    speech_style: null,
    catchphrase: null,
    first_appearance: 0, importance_score: 15, is_recurring: false
  },
  {
    name: '진소산', role: 'minor', faction: '무소속/민간',
    title: '충직한 부하, 조직 체계 구축', age: '27세',
    appearance: '햇볕에 탄 피부, 크고 투박한 손, 농부 같은 체격',
    martial_rank: '이류 최상위', weapon: '도(刀)',
    personality: '소박하고 긴장 잘 함, 비무장에서 눈빛 변함',
    speech_style: '소박하고 진지한 말투',
    catchphrase: '우리 마을 사람들이 응원해줬어.',
    first_appearance: 23, importance_score: 20, is_recurring: false
  },

  // ===== 13. 네트워킹 (3명) =====
  {
    name: '장현풍', role: 'minor', faction: '네트워킹',
    title: '네트워킹 인물', age: null,
    appearance: null,
    martial_rank: null, weapon: null,
    personality: '무림대회 네트워킹 접점',
    speech_style: null,
    catchphrase: null,
    first_appearance: 11, importance_score: 10, is_recurring: false
  },
  {
    name: '진무영', role: 'minor', faction: '네트워킹',
    title: '네트워킹 인물', age: null,
    appearance: null,
    martial_rank: null, weapon: null,
    personality: '무림대회 네트워킹 접점',
    speech_style: null,
    catchphrase: null,
    first_appearance: 10, importance_score: 10, is_recurring: false
  },
  {
    name: '임소하', role: 'minor', faction: '네트워킹',
    title: '네트워킹 인물', age: null,
    appearance: null,
    martial_rank: null, weapon: null,
    personality: '무림대회 네트워킹 접점',
    speech_style: null,
    catchphrase: null,
    first_appearance: 10, importance_score: 10, is_recurring: false
  },
];

console.log(`\n📋 총 ${characters.length}명 / 문파 ${[...new Set(characters.map(c => c.faction))].length}개\n`);

// DB 행 변환
const rows = characters.map(c => ({
  series_id: null,
  name: c.name,
  title: c.title || null,
  role: c.role,
  faction: c.faction,
  faction_type: null,
  age: c.age || null,
  appearance: c.appearance || null,
  martial_rank: c.martial_rank || null,
  martial_rank_numeric: rankNum(c.martial_rank),
  weapon: c.weapon || null,
  personality: c.personality || null,
  speech_style: c.speech_style || null,
  catchphrase: c.catchphrase || null,
  first_appearance: c.first_appearance || null,
  importance_score: c.importance_score ?? 0,
  is_recurring: c.is_recurring ?? false,
}));

// 배치 삽입 (10명씩)
const BATCH = 10;
let ok = 0, fail = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const res = await fetch(`${URL}/rest/v1/characters`, {
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(batch)
  });

  if (res.ok) {
    const data = await res.json();
    ok += data.length;
    console.log(`✅ ${i + 1}~${i + batch.length}번 삽입 성공 (${data.length}명)`);
  } else {
    const err = await res.text();
    fail += batch.length;
    console.error(`❌ ${i + 1}~${i + batch.length}번 실패: ${res.status} ${err}`);
    // 실패 시 개별 삽입 시도
    for (const row of batch) {
      const r2 = await fetch(`${URL}/rest/v1/characters`, {
        method: 'POST',
        headers: {
          'apikey': KEY,
          'Authorization': `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(row)
      });
      if (r2.ok) { ok++; fail--; console.log(`  ✅ ${row.name} 개별 삽입 성공`); }
      else { console.error(`  ❌ ${row.name} 개별 실패: ${await r2.text()}`); }
    }
  }
}

// 결과 확인
const check = await fetch(`${URL}/rest/v1/characters?select=name,faction&order=faction,importance_score.desc`, {
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
});
const all = await check.json();
const factions = {};
all.forEach(c => { factions[c.faction] = (factions[c.faction] || 0) + 1; });

console.log(`\n========== 결과 ==========`);
console.log(`✅ 성공: ${ok}명 / ❌ 실패: ${fail}명 / DB 총: ${all.length}명\n`);
console.log(`📂 문파별 인원:`);
Object.entries(factions).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => {
  console.log(`  ${f}: ${n}명`);
});
console.log();
