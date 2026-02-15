import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [1000명 캐릭터 생성 + 30가지 특징 + Supabase 직접 저장]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 기존 277명 + 723명 추가 = 1000명
 * 각 캐릭터마다 30가지 특징 자동 생성
 * localStorage 거치지 않고 Supabase 직접 저장
 * 
 * 30가지 특징:
 * [A] 기본 (3): 이름, 나이, 소속+직위
 * [B] 전투 (8): 무공등급, 전투력, 내공, 무기, 무공목록, 전투스타일, 약점, 실전경험
 * [C] 외모 (5): 체격, 외모특징, 의복, 상징소품, 목소리
 * [D] 성격 (6): 성격, 말투+대사, 버릇, 가치관, 비밀/트라우마, 두려움
 * [E] 생활 (5): 출신지+거주지, 음식, 주량, 일과, 취미
 * [F] 관계 (3): 가문/가족, 인간관계, 목표
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 1: 이름 데이터베이스
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 단성 성씨 (50개)
const SURNAMES = [
  '이', '장', '왕', '조', '유', '진', '양', '황', '주', '오',
  '정', '손', '마', '호', '임', '하', '곽', '나', '송', '당',
  '허', '한', '팽', '소', '채', '반', '전', '여', '엽', '단',
  '풍', '석', '노', '맹', '고', '안', '배', '백', '강', '서',
  '문', '우', '설', '방', '범', '목', '연', '담', '온', '추',
];

// 복성 성씨 (13개)
const COMPOUND_SURNAMES = [
  '남궁', '모용', '황보', '사마', '제갈', '독고', '상관',
  '공손', '동방', '영호', '서문', '구양', '태사',
];

// 남성 이름 글자 (100개) - 무협풍
const MALE_NAME_CHARS = [
  '무', '검', '천', '용', '호', '풍', '운', '설', '화', '련',
  '철', '강', '혁', '진', '명', '광', '현', '성', '연', '준',
  '수', '영', '웅', '봉', '학', '매', '산', '해', '월', '태',
  '도', '경', '충', '덕', '인', '효', '원', '선', '상', '비',
  '휘', '룡', '완', '장', '걸', '초', '청', '백', '홍', '금',
  '은', '옥', '환', '기', '래', '신', '의', '한', '위', '달',
  '찬', '정', '윤', '지', '통', '곤', '건', '주', '열', '섭',
  '담', '야', '석', '창', '표', '규', '일', '결', '승', '전',
  '대', '기', '탁', '렬', '호', '세', '겸', '관', '단', '벽',
  '량', '항', '웅', '린', '하', '형', '구', '모', '적', '평',
];

// 여성 이름 글자 (40개)
const FEMALE_NAME_CHARS = [
  '설', '화', '연', '란', '월', '영', '빙', '옥', '매', '홍',
  '채', '운', '하', '지', '현', '린', '나', '비', '청', '혜',
  '아', '수', '소', '은', '정', '미', '선', '유', '진', '원',
  '경', '희', '봉', '향', '단', '여', '초', '해', '령', '환',
];

// 소림사 법명 첫 글자 (세대별)
const SHAOLIN_PREFIXES = ['혜', '원', '공', '정', '명', '심', '각', '법', '운', '도', '지', '통', '광', '덕', '인', '자', '선', '진', '성', '해'];
// 소림사 법명 두번째 글자
const SHAOLIN_SUFFIXES = ['공', '정', '명', '진', '광', '성', '원', '통', '해', '각', '심', '법', '덕', '인', '선', '지', '운', '도', '자', '환'];

// 무당파 도호 첫 글자
const WUDANG_PREFIXES = ['청', '현', '백', '송', '운', '태', '허', '진', '원', '상', '자', '무', '미', '소', '현'];
// 무당파 도호 뒤에 붙는 글자
const WUDANG_SUFFIXES = ['허', '진', '운', '풍', '월', '산', '하', '도', '검', '성', '원', '양', '봉', '학', '천'];

// 화산파 이름 첫 글자 (정 자 돌림)
const HUASHAN_PREFIXES = ['정', '매', '하', '운', '화'];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 2: 단체호 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface GroupTitle {
  name: string;       // 단체호 이름
  count: number;      // 인원수
  rankStart: number;  // 직위 시작 (1번부터)
}

// 문파별 단체호 매핑
const GROUP_TITLES: Record<string, GroupTitle> = {
  '소림사': { name: '소림사대금강', count: 4, rankStart: 1 },
  '무당파': { name: '무당칠검', count: 7, rankStart: 1 },
  '화산파': { name: '매화오검', count: 5, rankStart: 1 },
  '아미파': { name: '아미삼수', count: 3, rankStart: 1 },
  '곤륜파': { name: '곤륜삼성', count: 3, rankStart: 1 },
  '점창파': { name: '점창오절', count: 5, rankStart: 1 },
  '종남파': { name: '종남삼검', count: 3, rankStart: 1 },
  '청성파': { name: '청성사수', count: 4, rankStart: 1 },
  '개방': { name: '개방팔대장로', count: 8, rankStart: 1 },
  '남궁세가': { name: '남궁오검', count: 5, rankStart: 1 },
  '모용세가': { name: '모용삼절', count: 3, rankStart: 1 },
  '황보세가': { name: '황보쌍웅', count: 2, rankStart: 1 },
  '사마세가': { name: '사마삼걸', count: 3, rankStart: 1 },
  '당가': { name: '당가오독', count: 5, rankStart: 1 },
  '혈마단': { name: '혈마십이두', count: 12, rankStart: 1 },
  '마교': { name: '마교사대호법', count: 4, rankStart: 1 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 3: 30가지 특징 데이터베이스
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── [B] 무공 데이터 ──
const FACTION_SKILLS: Record<string, string[]> = {
  '소림사': ['나한권', '금종죄', '달마검법', '일지선', '소림장풍', '역근경', '반야장', '복마곤법'],
  '무당파': ['태극검법', '태극권', '순양공', '양의검법', '무당장풍', '현무공'],
  '화산파': ['매화검법', '자하신공', '독고검법', '파산검법', '화산심법'],
  '아미파': ['아미검법', '아미심법', '금정검법', '멸검식'],
  '점창파': ['점창검법', '점창십팔검', '점창심법', '낙영검법'],
  '곤륜파': ['곤륜검법', '곤륜심법', '천강검법', '파천곤륜장'],
  '종남파': ['종남검법', '종남심법', '자오검법', '만류귀종'],
  '청성파': ['청성검법', '청성심법', '무극검법', '벽해조생공'],
  '개방': ['항룡십팔장', '타구봉법', '개방심법', '질풍연타'],
  '남궁세가': ['남궁세가검법', '천뢰검법', '무영검법', '파천검기'],
  '모용세가': ['이기어인환시피신', '두전성이', '참천검법', '모용심법'],
  '황보세가': ['황보장법', '쌍룡장', '황보심법', '벽력권'],
  '사마세가': ['사마검법', '사마심법', '추혼장', '음양검'],
  '제갈세가': ['제갈진법', '팔진도검법', '팔문금쇄', '제갈심법'],
  '당가': ['만천화우', '당가암기술', '독공', '채혈수', '당가심법'],
  '혈마단': ['혈마공', '혈살장', '혈영도법', '혈기마공', '혈사지'],
  '마교': ['천마공', '천마난무', '흡공대법', '마혈대법', '천마장'],
  '무림맹': ['정파연환검', '맹주검법', '호위무공', '금오위공'],
  '황실 금의위': ['금의위검법', '호위검법', '암살술', '경공', '비도술'],
  default: ['기본 검법', '기본 권법', '기본 경공'],
};

// ── 무기 데이터 (문파별) ──
const FACTION_WEAPONS: Record<string, string[][]> = {
  '소림사': [['계도', '소림 제식 계도, 등 뒤에 맴'], ['선장', '참목 선장, 5척'], ['철퇴', '쌍철퇴, 각 8근'], ['맨손', '나한권 전용']],
  '무당파': [['장검', '무당 제식 장검, 청강철'], ['불진', '태극 불진, 마미 재질']],
  '화산파': [['장검', '화산 제식 장검, 매화문 각인'], ['쌍검', '매화쌍검']],
  '아미파': [['장검', '아미 제식 장검, 가벼움'], ['불진', '금정불진']],
  '점창파': [['장검', '점창 제식 장검'], ['단검', '쌍단검, 속공용']],
  '곤륜파': [['대검', '곤륜 제식 대검, 무거움'], ['장검', '곤륜 장검']],
  '종남파': [['장검', '종남 제식 장검'], ['장창', '자오장창']],
  '청성파': [['장검', '청성 제식 장검'], ['소검', '무극소검']],
  '개방': [['타구봉', '녹색 대나무, 7마디'], ['맨손', '항룡십팔장 전용']],
  '남궁세가': [['장검', '남궁세가 가전 장검, 천뢰검'], ['대도', '파천대도']],
  '모용세가': [['장검', '모용세가 장검'], ['부채', '철선 부채, 암기 내장']],
  '황보세가': [['맨손', '황보장법 전용'], ['권갑', '철권갑, 공격력 강화']],
  '사마세가': [['쌍검', '사마 음양쌍검'], ['장검', '사마 장검']],
  '당가': [['암기', '독침 100발, 허리춤에'], ['독장갑', '독침장갑'], ['비수', '당가 독비수']],
  '혈마단': [['혈도', '핏빛 만도, 3척'], ['혈검', '핏빛 장검'], ['쇄사슬', '혈쇄, 5장 길이']],
  '마교': [['마도', '흑철 대도, 4척'], ['마검', '흑철 장검'], ['마편', '구절편, 독 묻힘']],
  '황실 금의위': [['수리검', '금의위 제식 장검'], ['비도', '암살용 비도 6자루'], ['쇠뇌', '소형 연노']],
  default: [['장검', '일반 장검'], ['도', '일반 만도'], ['창', '일반 장창']],
};

// ── 의복 데이터 ──
const FACTION_CLOTHING: Record<string, string[]> = {
  '소림사': ['회색 승복, 머리에 계파 자국, 목에 염주 108과'],
  '무당파': ['청색 도포, 곤으로 머리 올림, 도관'],
  '화산파': ['백색 도포, 매화 자수, 은색 허리띠'],
  '아미파': ['백색 승복 (여성형), 머리 올림, 은색 비녀'],
  '점창파': ['남색 도포, 점창 문장, 검갈색 허리띠'],
  '곤륜파': ['백색 도포, 곤륜산 문장, 모피 방한'],
  '종남파': ['청회색 도포, 종남산 문장'],
  '청성파': ['옥청색 도포, 대나무 문양'],
  '개방': ['누더기 의복, 9개 이하의 주머니'],
  '남궁세가': ['금수 자수 도포, 남궁 가문 옥패, 화려'],
  '모용세가': ['보라색 도포, 모용 가문 문장, 고급 비단'],
  '황보세가': ['검은색 갑의, 황보 가문 문장, 투박함'],
  '사마세가': ['흑백 도포, 태극 문양, 음양 색 배합'],
  '당가': ['녹색 도포, 허리에 암기대, 넓은 소매'],
  '혈마단': ['핏빛 붉은 도포, 혈마 문양, 흉악함'],
  '마교': ['칠흑 도포, 마교 문장, 금색 장식'],
  '무림맹': ['정파 연합 공복, 맹주기 자수'],
  '황실 금의위': ['금색 갑옷 + 비단 망토, 황실 문장'],
  '황실': ['용포/관복, 화려한 비단, 옥대'],
  default: ['평범한 면포 도포'],
};

// ── 성격 데이터 (문파 성향별) ──
const PERSONALITY_BY_TYPE: Record<string, string[][]> = {
  // [성격 설명, 키워드들]
  불교: [
    ['자비롭고 인내심이 강하며, 살생을 피하나 의를 위해선 무력 사용', '자비,인내,계율'],
    ['과묵하고 사려깊으며, 불법에 대한 신심이 깊음', '과묵,지혜,신심'],
    ['호방하고 직설적이며, 불의를 참지 못하는 열혈 승려', '열혈,정의,직설'],
  ],
  도교: [
    ['냉정하고 예의 바르며, 검의 도를 추구함', '냉정,예의,검의'],
    ['초연하고 세속에 무관심하나, 사형제에 대한 정이 깊음', '초연,정,무욕'],
    ['고지식하고 원칙주의적이나, 속으로는 따뜻함', '원칙,엄격,내면따뜻'],
  ],
  세가: [
    ['자존심이 강하고 가문에 대한 자부심이 대단함', '자부심,귀족,체면'],
    ['야심적이고 정치적 계산에 능함, 겉은 온화', '야심,계산,이중적'],
    ['의협심이 강하고 가문의 명예를 중시함', '명예,의리,책임감'],
  ],
  사파: [
    ['잔인하고 비정하며, 목적을 위해 수단을 가리지 않음', '잔인,비정,야심'],
    ['교활하고 의심이 많으며, 뒤통수치기에 능함', '교활,의심,배신'],
    ['광기에 차있으며, 피를 즐기는 살인마적 기질', '광기,피,잔학'],
    ['냉소적이고 허무주의적, 세상에 대한 증오를 품고 있음', '냉소,허무,증오'],
  ],
  정파무인: [
    ['우직하고 충성스러우며, 의리를 목숨보다 중시함', '우직,충성,의리'],
    ['과묵하고 냉정하며, 할 일만 하는 실용주의자', '과묵,냉정,실용'],
    ['열혈이고 직선적이며, 불의를 보면 참지 못함', '열혈,직선,정의'],
    ['유머 있고 사교적이며, 분위기 메이커 역할', '유머,사교,명랑'],
    ['신중하고 치밀하며, 항상 최악을 대비하는 전략가', '신중,치밀,전략'],
  ],
  상인: [
    ['눈치 빠르고 세상물정에 밝으며, 돈의 가치를 아는 실용주의자', '눈치,실용,재물'],
    ['사교적이고 비위를 잘 맞추나, 속으로는 차가운 계산기', '사교,계산,이면'],
  ],
  황실: [
    ['위엄 있고 정치적이며, 권력에 대한 욕심이 강함', '위엄,정치,권력'],
    ['냉혈하고 의심이 많으며, 충성을 시험하길 좋아함', '냉혈,의심,시험'],
  ],
  백성: [
    ['소박하고 선량하며, 평화로운 삶을 원함', '소박,선량,평화'],
    ['억척스럽고 생활력이 강하며, 가족을 위해 무엇이든 함', '억척,생활력,가족'],
  ],
};

// ── 말투 + 대사 데이터 ──
const SPEECH_BY_TYPE: Record<string, [string, string[]][]> = {
  불교: [
    ['존댓말, 불교 용어 혼용, 차분한 어조', ['아미타불.', '시주, 살생은 불가하오.', '인과의 법칙을 거스를 수 없습니다.']],
    ['존댓말, 간결하고 묵직한 어조', ['부처님의 뜻이오.', '물러서시오.', '이것이 정도입니다.']],
  ],
  도교: [
    ['존댓말, 검객 어투, 절도 있는 말투', ['검을 뽑겠소.', '물러가시오.', '천도에 어긋나는 일이오.']],
    ['하오체, 도교 용어 혼용, 초연한 말투', ['도가 아니면 하지 않겠소.', '하늘의 뜻이오.', '검은 거짓을 모르오.']],
  ],
  세가: [
    ['존댓말, 격식체, 고상한 어투', ['가문의 이름으로 맹세하겠소.', '무례는 용납하지 않겠소.', '우리 가문을 모욕하는 겐가?']],
    ['존댓말이나 은근히 깔보는 톤', ['흥, 그 정도 실력으로?', '세가의 검을 모르는 모양이군.', '이름이나 밝히시오.']],
  ],
  사파: [
    ['반말, 거칠고 위협적인 어투', ['크큭, 죽고 싶나?', '피가 보고 싶군.', '벌레 같은 놈.']],
    ['존댓말이나 음습하고 기분 나쁜 어조', ['후후, 재미있군요.', '죽음이 곁에 있습니다.', '도망칠 수 있을까요?']],
  ],
  정파무인: [
    ['존댓말, 짧고 힘찬 군인 어투', ['알겠습니다!', '명을 받들겠습니다!', '끝났습니다.']],
    ['반말, 형제 같은 거친 어투', ['야, 빨리 움직여!', '내가 막을 테니 가!', '이놈들!']],
    ['존댓말, 느긋하고 유머 섞인 어투', ['뭐, 어떻게든 되겠지.', '하하, 배고픈데 밥부터 먹자.', '긴장하면 지는 거야.']],
  ],
  상인: [
    ['존댓말, 사근사근한 상인 어투', ['어서 오십시오, 귀빈이시네요!', '이 가격이면 밑지는 겁니다.', '좋은 말 할 때 결정하시죠.']],
  ],
  황실: [
    ['하오체~존댓말, 위엄 있는 황실 어투', ['짐의 뜻이니라.', '물러가라.', '충성을 보여라.']],
    ['존댓말, 차갑고 관료적인 어투', ['폐하의 명이시다.', '항명하겠느냐?', '기록하라.']],
  ],
  백성: [
    ['반말~존댓말, 소박한 어투', ['네, 네, 알겠습니다요.', '무인 나리들은 무섭습니다요.', '밥이나 먹고 삽시다.']],
  ],
};

// ── 버릇 데이터 ──
const HABITS_POOL = [
  ['전투 전 무기 손질', '칼자루를 무의식적으로 만짐'],
  ['긴장하면 턱을 긁음', '혀로 입술을 핥음'],
  ['손가락을 꺾음', '목을 좌우로 돌림'],
  ['눈을 가늘게 뜸', '입술을 깨뭄'],
  ['콧노래를 흥얼거림', '한쪽 눈썹만 올림'],
  ['뒷짐을 짐', '팔짱을 끼고 생각함'],
  ['생각할 때 코를 문지름', '검지로 탁자를 두드림'],
  ['불안하면 머리카락을 만짐', '한숨을 자주 쉼'],
  ['전투 전 손바닥을 비빔', '눈을 감고 심호흡'],
  ['상대를 처음 만나면 무기부터 살핌', '말하기 전 눈을 한 번 깜빡임'],
  ['웃을 때 코를 킁킁거림', '분노하면 이를 악뭄'],
  ['밥 먹기 전 음식 냄새를 맡음', '술잔을 돌려가며 마심'],
  ['무의식적으로 검집을 톡톡 침', '상대의 눈을 뚫어지게 봄'],
  ['어깨를 으쓱함', '말끝을 흐림'],
];

// ── 비밀/트라우마 데이터 ──
const TRAUMA_POOL = [
  '어릴 때 도적에게 가족을 잃고 혼자 살아남음. 밤마다 그날의 비명이 들림.',
  '사형제를 자신의 실수로 잃었음. 그 죄책감이 모든 행동의 원동력.',
  '과거 사파에 속했던 적이 있음. 정파로 돌아왔지만 과거가 발각될까 두려움.',
  '스승이 사실은 원수였음을 알게 되었으나, 아직 누구에게도 말하지 못함.',
  '어릴 때 노비 출신이었음. 무공을 익혀 신분을 숨기고 살아감.',
  '첫사랑이 적의 편이었음. 직접 베어야 했던 기억이 트라우마.',
  '과거 멸문당한 가문의 유일한 생존자. 복수를 위해 신분을 숨기고 있음.',
  '한때 천재로 불렸으나 주화입마로 내공 절반을 잃음. 재기를 꿈꿈.',
  '동료의 배신으로 죽을 뻔한 경험이 있음. 이후 누구도 완전히 믿지 못함.',
  '부모가 사파 출신이라는 비밀을 안고 있음. 정파에서 활동 중.',
  '과거 포로로 잡혀 고문당한 경험이 있음. 좁은 공간을 두려워함.',
  '소꿉친구를 구하지 못한 기억이 있음. 약자를 보면 무조건 돕게 됨.',
  '한때 살수(암살자)였음. 지금은 속죄하며 살아가지만, 과거가 쫓아옴.',
  '가문의 비전 무공서를 도둑맞았음. 되찾지 못하면 가문이 멸망함.',
  '마교의 저주에 걸려 있음. 매년 생일마다 내공이 조금씩 줄어듬.',
  '특별한 비밀은 없으나, 평범함 자체가 콤플렉스. 뭔가 대단한 사람이 되고 싶음.',
  '고아 출신으로 이름도 스승이 지어줌. 진짜 부모를 찾고 싶음.',
  '과거 큰 전투에서 공포에 질려 도망친 적이 있음. 비겁자라는 꼬리표.',
];

// ── 두려움 데이터 ──
const FEAR_POOL = [
  '불 - 어릴 때 화재로 가족을 잃음',
  '물 - 어릴 때 빠져 죽을 뻔 함',
  '높은 곳 - 절벽에서 떨어진 경험',
  '뱀 - 독사에 물린 트라우마',
  '어둠 - 감옥에 갇힌 적 있음',
  '좁은 곳 - 포로 시절 독방 경험',
  '고독 - 혼자 남겨지는 것이 두려움',
  '배신 - 과거 배신당한 경험',
  '실패 - 완벽주의로 실패를 극도로 두려워함',
  '늙어가는 것 - 무공이 쇠퇴하는 것이 두려움',
  '사랑하는 사람을 잃는 것 - 이미 한 번 경험함',
  '자신의 내면에 있는 살기 - 전투 중 이성을 잃을까 두려움',
  '없음 (공포를 초월한 고수)',
  '천둥 - 어릴 때 번개에 맞을 뻔 함',
  '피 - 대량의 피를 보면 어지러움',
];

// ── 가치관 & 금기 데이터 ──
const MORAL_CODE_POOL = [
  '여자와 아이는 절대 해치지 않음',
  '약속은 목숨을 걸어서라도 지킴',
  '등 뒤에서 공격하지 않음 (정면 승부)',
  '항복한 적은 죽이지 않음',
  '돈보다 의리를 중시함',
  '강한 자에게 강하고, 약한 자에게 약함',
  '배신자만은 절대 용서하지 않음',
  '도망치지 않음 (비겁한 것을 가장 싫어함)',
  '가문의 명예를 위해서라면 목숨도 바침',
  '공과 사를 철저히 분리함',
  '약한 자를 괴롭히는 자를 보면 참지 못함',
  '스승의 유언을 반드시 실행함',
  '빚진 것은 반드시 갚음 (은혜든 원한이든)',
  '동료를 위해 자신을 희생할 수 있음',
  '먼저 검을 뽑지 않음 (후발제인)',
];

// ── 취미 데이터 ──
const HOBBY_POOL = [
  ['바둑', '서예', '독서'],
  ['피리 연주', '검무', '명상'],
  ['낚시', '산책', '약초 채집'],
  ['술 품평', '요리', '차 우리기'],
  ['무기 수집', '무기 손질', '갑주 연마'],
  ['도박 (주사위)', '투계 관람', '씨름'],
  ['시 짓기', '그림 그리기', '목각'],
  ['별 관측', '풍수 공부', '역학'],
  ['말 타기', '사냥', '활 쏘기'],
  ['노래 부르기', '거문고 연주', '퉁소'],
  ['약초 연구', '독 조합', '의술 공부'],
  ['지도 그리기', '여행', '지리 탐구'],
];

// ── 음식 데이터 (지역별) ──
const FOOD_BY_REGION: Record<string, { favorites: string[]; disliked: string[]; drink: string; tolerance: string; reason: string }> = {
  '하남': { favorites: ['호유병', '양고기탕', '도삭면', '낙양수석'], disliked: ['해산물 (내륙이라 비린내 싫어함)'], drink: '두강주', tolerance: '강함', reason: '하남 중원 출신, 밀가루 음식과 양고기를 즐김' },
  '호북': { favorites: ['무한 열간면', '연근탕', '두부피', '어원자'], disliked: ['지나치게 단 음식'], drink: '황학루주', tolerance: '보통', reason: '호북 출신, 매콤한 면 요리와 연근 음식을 즐김' },
  '섬서': { favorites: ['양육포모', '량피', '육가모', '비빔면'], disliked: ['강남 단맛 음식'], drink: '서봉주', tolerance: '강함', reason: '섬서 출신, 밀가루와 양고기 중심의 푸짐한 식사' },
  '강남': { favorites: ['동파육', '소룡포', '서호초어', '연밥'], disliked: ['양고기 (누린내)'], drink: '소흥주', tolerance: '보통', reason: '강남 출신, 달콤하고 섬세한 맛을 즐김' },
  '사천': { favorites: ['마파두부', '훠궈', '단단면', '궁보계정'], disliked: ['싱거운 음식'], drink: '오량액', tolerance: '매우 강함', reason: '사천 출신, 마라의 매운맛과 얼얼한 맛에 중독' },
  '북방': { favorites: ['양고기 구이', '우육면', '만두', '전병'], disliked: ['해산물', '단 음식'], drink: '이과두주', tolerance: '매우 강함', reason: '북방 출신, 추위를 견디기 위해 고기와 독주를 즐김' },
  '산동': { favorites: ['전병', '해삼', '구이류', '바지락탕'], disliked: ['매운 음식'], drink: '경양강', tolerance: '강함', reason: '산동 출신, 해산물과 밀가루 음식의 조화' },
  '광동': { favorites: ['딤섬', '차슈', '백절계', '완탕면'], disliked: ['매운 음식 (광동은 담백)'], drink: '보이차', tolerance: '약함', reason: '광동 출신, 신선한 재료의 원미를 즐김' },
  '서역': { favorites: ['양고기 꼬치', '난', '말유주', '건과류'], disliked: ['채소 위주 음식'], drink: '말유주', tolerance: '매우 강함', reason: '서역 출신, 유목민의 거친 음식에 익숙' },
  '채식': { favorites: ['두부', '채소 볶음', '버섯 요리', '죽', '나물'], disliked: ['육식 (계율)'], drink: '맑은 차', tolerance: '못함', reason: '불교 계율로 채식만 함. 오신채(마늘, 파)도 금지' },
  '도교식': { favorites: ['두부', '생선찜', '채소', '산나물', '매화주'], disliked: ['기름진 음식'], drink: '매화주', tolerance: '약함 (1~2잔)', reason: '도교 수행자, 청담한 음식을 선호하며 절제함' },
};

// ── 출신지 데이터 (문파별) ──
const BIRTHPLACE_BY_FACTION: Record<string, string> = {
  '소림사': '하남 숭산',
  '무당파': '호북 무당산',
  '화산파': '섬서 화산',
  '아미파': '사천 아미산',
  '점창파': '운남 점창산',
  '곤륜파': '서역 곤륜산',
  '종남파': '섬서 종남산',
  '청성파': '사천 청성산',
  '개방': '강호 각지',
  '남궁세가': '하북 남궁',
  '모용세가': '강남 고소',
  '황보세가': '하남 낙양',
  '사마세가': '산서 태원',
  '제갈세가': '양양',
  '당가': '사천 당문',
  '혈마단': '북방 음산',
  '마교': '서역 광명정',
  '무림맹': '하남 개봉',
  '황실': '개봉 황궁',
  '황실 금의위': '개봉 황궁',
};

// ── 일과 데이터 ──
const ROUTINES_BY_TYPE: Record<string, string[]> = {
  불교: [
    '새벽 4시 기상 → 예불 1시간 → 무술 단련 2시간 → 아침 공양 → 불경 독송 → 점심 공양 → 무술 수련 → 저녁 공양 → 좌선 명상 → 8시 취침',
  ],
  도교: [
    '새벽 5시 기상 → 도인술 30분 → 검술 수련 2시간 → 아침 식사 → 도덕경 독송 → 점심 → 검술/내공 수련 → 저녁 식사 → 명상/좌선 → 9시 취침',
  ],
  세가: [
    '새벽 6시 기상 → 가문 무공 수련 1시간 → 아침 식사 (가족과 함께) → 가문 업무/정치 → 점심 → 검술/무공 수련 → 저녁 연회 → 10시 취침',
  ],
  사파: [
    '시간 불규칙 → 필요할 때 수련 → 임무 수행 → 밤에 활동 → 술자리 → 새벽 취침',
  ],
  정파무인: [
    '새벽 5시 기상 → 무술 단련 2시간 → 아침 식사 → 순찰/임무 → 점심 → 훈련/수련 → 저녁 식사 → 자유 시간 → 10시 취침',
  ],
  상인: [
    '새벽 6시 기상 → 아침 식사 → 장사 준비 → 손님 응대/거래 → 점심 → 거래/이동 → 저녁 접대 → 장부 정리 → 11시 취침',
  ],
  황실: [
    '새벽 5시 기상 → 아침 조회 → 아침 식사 → 정무/무술 → 점심 → 정무/연회 → 저녁 연회 → 밤 정보 수집 → 11시 취침',
  ],
};

// ── 가족 배경 데이터 ──
const FAMILY_BACKGROUNDS: Record<string, string[]> = {
  세가: [
    '대대로 무공을 전수하는 명문 가문. 부모 생존, 형제 2~3명.',
    '한때 융성했으나 쇠락한 가문. 가문 재건이 목표.',
    '가주의 적자이나 서자와의 갈등이 있음.',
  ],
  문파: [
    '어릴 때 문파에 입문. 부모는 평범한 농민이나 상인.',
    '고아 출신, 스승이 거둬 키움. 문파가 곧 가족.',
    '무림 집안 출신, 부모도 같은 문파 출신.',
  ],
  사파: [
    '불우한 환경에서 자람. 부모 사망 또는 행방불명.',
    '범죄 가문 출신. 어릴 때부터 살인과 약탈에 노출.',
    '원래 정파였으나 멸문당한 후 사파에 들어감. 복수가 삶의 전부.',
  ],
  백성: [
    '평범한 농민 가정. 부모와 형제가 시골에 살아있음.',
    '빈곤한 가정 출신. 먹고 살기 위해 이 일을 함.',
    '상인 가정 출신이나 가세가 기울어 낮은 일을 함.',
  ],
};

// ── 목표 데이터 ──
const GOALS_BY_ROLE: Record<string, string[]> = {
  '주인공': ['천하통일 / 강남 제패 → 무림맹주'],
  '주요 조연': [
    '단기: 조직 내 입지 확보 / 장기: 주인공과 함께 천하를 평정',
    '단기: 무공 진급 / 장기: 가문 재건',
  ],
  '조연': [
    '단기: 생존 / 장기: 문파 내 높은 지위',
    '단기: 무공 향상 / 장기: 사부의 원수를 갚음',
    '단기: 가족 부양 / 장기: 평화로운 은퇴',
    '단기: 적에게 빼앗긴 것을 되찾음 / 장기: 정의 실현',
  ],
  '단역': [
    '일상: 자기 일에 충실함 / 꿈: 언젠가 이름을 떨침',
    '일상: 생존 / 꿈: 더 나은 삶',
    '일상: 문파를 지킴 / 꿈: 스승에게 인정받음',
  ],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 4: 이름 생성 함수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 사용된 이름 추적 (중복 방지)
const usedNames = new Set<string>();

/** 일반 무인 이름 생성 (성씨 + 이름 1~2자) */
function generateName(gender: '남' | '여' = '남'): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const surname = pick(SURNAMES);
    const chars = gender === '남' ? MALE_NAME_CHARS : FEMALE_NAME_CHARS;
    // 70% 2글자, 30% 1글자 이름
    const nameLength = Math.random() < 0.7 ? 2 : 1;
    let givenName = '';
    for (let i = 0; i < nameLength; i++) {
      givenName += pick(chars);
    }
    const fullName = surname + givenName;
    if (!usedNames.has(fullName)) {
      usedNames.add(fullName);
      return fullName;
    }
  }
  // 최후 수단: 복성 사용
  const compound = pick(COMPOUND_SURNAMES);
  const char = pick(MALE_NAME_CHARS);
  const name = compound + char;
  usedNames.add(name);
  return name;
}

/** 소림사 법명 생성 */
function generateShaolinName(): string {
  for (let i = 0; i < 200; i++) {
    const name = pick(SHAOLIN_PREFIXES) + pick(SHAOLIN_SUFFIXES);
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  return '원' + pick(SHAOLIN_SUFFIXES) + pick(MALE_NAME_CHARS);
}

/** 무당파 도호 생성 */
function generateWudangName(): string {
  for (let i = 0; i < 200; i++) {
    // 60% 확률로 "X자" 형태, 40% "XX" 형태
    const name = Math.random() < 0.6
      ? pick(WUDANG_PREFIXES) + pick(WUDANG_SUFFIXES) + '자'
      : pick(WUDANG_PREFIXES) + pick(WUDANG_SUFFIXES);
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  return pick(WUDANG_PREFIXES) + pick(MALE_NAME_CHARS);
}

/** 화산파 이름 생성 (정X 돌림) */
function generateHuashanName(): string {
  for (let i = 0; i < 200; i++) {
    const prefix = pick(HUASHAN_PREFIXES);
    const name = prefix + pick(MALE_NAME_CHARS);
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  return '정' + pick(MALE_NAME_CHARS) + pick(MALE_NAME_CHARS);
}

/** 세가 이름 생성 (성씨 고정) */
function generateFamilyName(familySurname: string, gender: '남' | '여' = '남'): string {
  const chars = gender === '남' ? MALE_NAME_CHARS : FEMALE_NAME_CHARS;
  for (let i = 0; i < 200; i++) {
    const name = familySurname + pick(chars) + (Math.random() < 0.5 ? pick(chars) : '');
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  return familySurname + pick(chars) + pick(chars);
}

/** 개방 이름 (별호 + 이름) */
function generateBeggarName(): string {
  const prefixes = ['철', '독', '광', '귀', '혈', '야', '풍', '운', '타', '만', '화', '소', '대'];
  for (let i = 0; i < 200; i++) {
    const name = pick(prefixes) + pick(MALE_NAME_CHARS);
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  return generateName();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 5: 30가지 특징 생성기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 캐릭터의 30가지 특징을 한 번에 생성
 * 문파/역할/등급에 따라 맞춤 생성
 */
function generate30Traits(char: {
  name: string;
  faction: string;
  role: string;
  martial_rank: string;
  age: string;
  rank_in_faction?: string;
  group_title?: string;
  group_position?: number;
  faction_type?: string;
  title?: string;
}) {
  const { name, faction, role, martial_rank, age } = char;

  // 문파 타입 판별
  const factionType = getFactionType(faction);
  // 성별 판별 (아미파, 궁녀 등)
  const gender = isFemaleFaction(faction, name) ? '여' : '남';

  // ── [B] 전투 & 무공 (특징 4~11) ──
  const martialStats = calculateMartialStats(martial_rank, role);
  const factionKey = findFactionKey(faction);
  const skills = pickMultiple(FACTION_SKILLS[factionKey] || FACTION_SKILLS.default, randRange(2, 4));
  const weaponData = pick(FACTION_WEAPONS[factionKey] || FACTION_WEAPONS.default);
  const skillProf = generateSkillProficiency(skills, martialStats.combat_power);

  // ── [C] 외모 (특징 12~16) ──
  const bodyStats = generateBodyStats(factionType, gender, martialStats.combat_power);
  const clothing = pick(FACTION_CLOTHING[factionKey] || FACTION_CLOTHING.default);
  const accessory = generateAccessory(factionType, role);
  const voiceTone = generateVoice(gender, factionType);

  // ── [D] 성격 (특징 17~22) ──
  const personalityType = factionType;
  const [personalityDesc, personalityKw] = pick(PERSONALITY_BY_TYPE[personalityType] || PERSONALITY_BY_TYPE.정파무인);
  const [speechStyle, speechExamples] = pick(SPEECH_BY_TYPE[personalityType] || SPEECH_BY_TYPE.정파무인);
  const habits = pick(HABITS_POOL);
  const moralCode = pick(MORAL_CODE_POOL);
  const trauma = pick(TRAUMA_POOL);
  const fear = pick(FEAR_POOL);

  // ── [E] 생활 (특징 23~27) ──
  const birthplace = BIRTHPLACE_BY_FACTION[factionKey] || pick(['강남 소주', '중원 낙양', '북방 하북', '산동 제남', '사천 성도']);
  const foodRegion = getFoodRegionKey(faction, birthplace);
  const foodData = FOOD_BY_REGION[foodRegion] || FOOD_BY_REGION['강남'];
  const routine = pick(ROUTINES_BY_TYPE[personalityType] || ROUTINES_BY_TYPE.정파무인);
  const hobbies = pick(HOBBY_POOL);

  // ── [F] 관계 & 서사 (특징 28~30) ──
  const familyType = getFamilyType(factionType);
  const familyBg = pick(FAMILY_BACKGROUNDS[familyType] || FAMILY_BACKGROUNDS.문파);
  const goal = pick(GOALS_BY_ROLE[role] || GOALS_BY_ROLE['단역']);

  // ═══════════════════════════════════════════
  // 30가지 특징을 DB 컬럼에 매핑하여 반환
  // ═══════════════════════════════════════════
  return {
    // [A] 기본 정보 (1~3)
    // name, age, faction, rank_in_faction → 이미 char에 포함
    series_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    faction_type: char.faction_type || factionType,
    title: char.title || null,
    group_title: char.group_title || null,
    group_position: char.group_position || null,

    // [B] 전투 & 무공 (4~11)
    martial_rank_numeric: getMartialRankNumeric(martial_rank),
    combat_power: martialStats.combat_power,
    attack_power: martialStats.attack_power,
    defense_power: martialStats.defense_power,
    speed_power: martialStats.speed_power,
    technique_power: martialStats.technique_power,
    internal_energy_years: martialStats.internal_energy_years,
    internal_energy_level: martialStats.internal_energy_level,
    qi_control_level: martialStats.qi_control_level,
    weapon: weaponData[0],
    weapon_description: weaponData[1],
    skills,
    skill_proficiency: skillProf,
    fighting_style: generateFightingStyle(weaponData[0], bodyStats.build, factionType),
    combat_experience: martialStats.combat_experience,
    // 전투 약점 → physical_traits에 저장
    physical_traits: `전투 약점: ${generateCombatWeakness(martialStats.combat_power)}`,

    // [C] 외모 & 비주얼 (12~16)
    height: bodyStats.height,
    weight: bodyStats.weight,
    build: bodyStats.build,
    appearance: bodyStats.appearance,
    distinctive_features: generateDistinctiveFeature(role, gender),
    clothing_style: clothing,
    clothing_colors: extractColors(clothing),
    accessories: [accessory],
    voice_tone: voiceTone,

    // [D] 성격 & 내면 (17~22)
    personality: `${personalityDesc} | 가치관: ${moralCode}`,
    personality_keywords: personalityKw.split(','),
    speech_style: speechStyle,
    speech_examples: speechExamples,
    catchphrase: speechExamples[0] || '',
    habits,
    // 비밀/트라우마 → backstory에 저장
    backstory: trauma,
    // 두려움 → special_abilities에 저장 (역으로 이용)
    special_abilities: [`두려움: ${fear}`],

    // [E] 생활 & 문화 (23~27)
    birthplace,
    hometown: birthplace,
    current_residence: BIRTHPLACE_BY_FACTION[factionKey] || faction,
    social_class: getSocialClass(faction),
    favorite_foods: foodData.favorites,
    disliked_foods: foodData.disliked,
    dietary_restrictions: foodRegion === '채식' ? ['육식', '오신채(마늘,파,부추)', '술'] : [],
    food_preference_reason: foodData.reason,
    typical_breakfast: foodData.favorites.slice(0, 2).join(', ') + ' + 밥 한 공기',
    typical_lunch: foodData.favorites.slice(1, 3).join(', ') + ' + 국',
    typical_dinner: foodData.favorites[0] + ' + 반찬 2~3가지',
    favorite_drink: foodData.drink,
    alcohol_tolerance: foodData.tolerance,
    daily_routine: routine,
    wake_up_time: routine.includes('4시') ? '04:00' : routine.includes('5시') ? '05:00' : '06:00',
    sleep_time: routine.includes('8시') ? '20:00' : routine.includes('9시') ? '21:00' : '22:00',
    sleeping_pattern: routine.includes('4시') || routine.includes('5시') ? '아침형' : routine.includes('불규칙') ? '야행성' : '보통',
    hobbies,
    favorite_activities: hobbies.slice(0, 2),
    stress_relief_method: pick(['무술 수련으로 해소', '술 한 잔으로 해소', '명상으로 해소', '산책으로 해소', '독서로 해소']),

    // [F] 관계 & 서사 (28~30)
    family_background: familyBg,
    family_members: generateFamilyMembers(factionType),
    character_arc: goal,
    importance_score: role === '주인공' ? 100 : role === '주요 조연' ? 80 : role === '조연' ? 50 : 20,
    is_recurring: role !== '단역',

    // 환경
    climate_preference: birthplace.includes('북방') || birthplace.includes('서역') || birthplace.includes('곤륜') ? '추위에 강함' : birthplace.includes('사천') || birthplace.includes('광동') ? '더위에 강함' : '보통',
    terrain_advantage: pick(['산악전', '평지전', '수상전', '야간전', '시가전', '숲속전', '특별 없음']),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 6: 캐릭터 생성 (세력별)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CharacterBase {
  name: string;
  role: string;
  faction: string;
  age: string;
  martial_rank: string;
  rank_in_faction: string;
  faction_type: string;
  group_title?: string;
  group_position?: number;
  title?: string;
}

/** 9대문파 캐릭터 생성 (180명: 각 20명) */
function generateNineFactions(): CharacterBase[] {
  const chars: CharacterBase[] = [];

  const factions = [
    { name: '소림사', type: '정파', nameFn: generateShaolinName, ranks: ['준천인급','화경급','화경급','일류급','일류급','이류급','삼류급'] },
    { name: '무당파', type: '정파', nameFn: generateWudangName, ranks: ['준천인급','화경급','화경급','일류급','일류급','이류급','삼류급'] },
    { name: '화산파', type: '정파', nameFn: generateHuashanName, ranks: ['화경급','화경급','일류급','일류급','이류급','이류급','삼류급'] },
    { name: '아미파', type: '정파', nameFn: () => generateName('여'), ranks: ['화경급','일류급','일류급','이류급','이류급','삼류급'] },
    { name: '점창파', type: '정파', nameFn: generateName, ranks: ['화경급','일류급','일류급','이류급','이류급','삼류급'] },
    { name: '곤륜파', type: '정파', nameFn: generateName, ranks: ['화경급','화경급','일류급','이류급','이류급','삼류급'] },
    { name: '종남파', type: '정파', nameFn: generateName, ranks: ['화경급','일류급','일류급','이류급','삼류급','삼류급'] },
    { name: '청성파', type: '정파', nameFn: generateName, ranks: ['화경급','일류급','이류급','이류급','삼류급','삼류급'] },
    { name: '개방', type: '정파', nameFn: generateBeggarName, ranks: ['준천인급','화경급','일류급','일류급','이류급','이류급','삼류급'] },
  ];

  for (const f of factions) {
    const gt = GROUP_TITLES[f.name];

    // 1. 장문인 1명
    chars.push({
      name: f.nameFn(),
      role: '조연',
      faction: f.name,
      age: `${randRange(55, 70)}세`,
      martial_rank: '준천인급',
      rank_in_faction: '장문인',
      faction_type: f.type,
      title: generatePersonalTitle(f.name, '장문인'),
    });

    // 2. 단체호 멤버
    if (gt) {
      for (let i = 0; i < gt.count && chars.length < 20 * (factions.indexOf(f) + 1); i++) {
        chars.push({
          name: f.nameFn(),
          role: '조연',
          faction: f.name,
          age: `${randRange(25, 45)}세`,
          martial_rank: pick(['화경급', '일류급']),
          rank_in_faction: `${gt.name} ${i + 1}번`,
          faction_type: f.type,
          group_title: gt.name,
          group_position: i + 1,
          title: generatePersonalTitle(f.name, '단체호멤버'),
        });
      }
    }

    // 3. 장로 3명
    for (let i = 0; i < 3; i++) {
      chars.push({
        name: f.nameFn(),
        role: '조연',
        faction: f.name,
        age: `${randRange(50, 65)}세`,
        martial_rank: pick(['화경급', '준화경급']),
        rank_in_faction: `${i + 1}장로`,
        faction_type: f.type,
      });
    }

    // 4. 나머지 제자들 (20명 맞추기)
    const currentCount = chars.filter(c => c.faction === f.name).length;
    const remaining = 20 - currentCount;
    for (let i = 0; i < remaining; i++) {
      chars.push({
        name: f.nameFn(),
        role: i < 2 ? '조연' : '단역',
        faction: f.name,
        age: `${randRange(18, 35)}세`,
        martial_rank: pick(f.ranks.slice(-3)),
        rank_in_faction: i < 2 ? '수제자' : '제자',
        faction_type: f.type,
      });
    }
  }

  return chars;
}

/** 5대세가 캐릭터 생성 (80명: 각 16명) */
function generateFiveFamilies(): CharacterBase[] {
  const chars: CharacterBase[] = [];

  const families = [
    { name: '남궁세가', surname: '남궁', region: '하북' },
    { name: '모용세가', surname: '모용', region: '강남' },
    { name: '황보세가', surname: '황보', region: '하남' },
    { name: '사마세가', surname: '사마', region: '산서' },
    { name: '제갈세가', surname: '제갈', region: '양양' },
  ];

  for (const fam of families) {
    const gt = GROUP_TITLES[fam.name];

    // 1. 가주
    chars.push({
      name: generateFamilyName(fam.surname),
      role: '조연',
      faction: fam.name,
      age: `${randRange(50, 60)}세`,
      martial_rank: '준현경급',
      rank_in_faction: '가주',
      faction_type: '세가',
      title: generatePersonalTitle(fam.name, '가주'),
    });

    // 2. 단체호 멤버
    if (gt) {
      for (let i = 0; i < gt.count; i++) {
        chars.push({
          name: generateFamilyName(fam.surname),
          role: '조연',
          faction: fam.name,
          age: `${randRange(22, 40)}세`,
          martial_rank: pick(['화경급', '일류급']),
          rank_in_faction: `${gt.name} ${i + 1}번`,
          faction_type: '세가',
          group_title: gt.name,
          group_position: i + 1,
          title: generatePersonalTitle(fam.name, '단체호멤버'),
        });
      }
    }

    // 3. 장로 3명
    for (let i = 0; i < 3; i++) {
      chars.push({
        name: generateFamilyName(fam.surname),
        role: '조연',
        faction: fam.name,
        age: `${randRange(45, 60)}세`,
        martial_rank: pick(['화경급', '일류급']),
        rank_in_faction: `${i + 1}장로`,
        faction_type: '세가',
      });
    }

    // 4. 나머지 자제/무인
    const count = chars.filter(c => c.faction === fam.name).length;
    const remaining = 16 - count;
    for (let i = 0; i < remaining; i++) {
      const isFemale = Math.random() < 0.3;
      chars.push({
        name: generateFamilyName(fam.surname, isFemale ? '여' : '남'),
        role: i < 2 ? '조연' : '단역',
        faction: fam.name,
        age: `${randRange(18, 35)}세`,
        martial_rank: pick(['일류급', '이류급', '삼류급']),
        rank_in_faction: i < 2 ? '적자/적녀' : '방계 자제',
        faction_type: '세가',
      });
    }
  }

  return chars;
}

/** 10대세가 캐릭터 생성 (50명: 각 5명, 주요 5개만) */
function generateTenFamilies(): CharacterBase[] {
  const chars: CharacterBase[] = [];

  const families = [
    { name: '당가', surname: '당' },
    { name: '하북팽가', surname: '팽' },
    { name: '낙양왕가', surname: '왕' },
    { name: '태원곽가', surname: '곽' },
    { name: '강남설가', surname: '설' },
  ];

  for (const fam of families) {
    const gt = GROUP_TITLES[fam.name];

    // 가주 1명
    chars.push({
      name: generateFamilyName(fam.surname),
      role: '조연',
      faction: fam.name,
      age: `${randRange(48, 58)}세`,
      martial_rank: '화경급',
      rank_in_faction: '가주',
      faction_type: '세가',
      title: generatePersonalTitle(fam.name, '가주'),
    });

    // 단체호 멤버 (당가오독 등)
    if (gt) {
      for (let i = 0; i < Math.min(gt.count, 3); i++) {
        chars.push({
          name: generateFamilyName(fam.surname),
          role: '조연',
          faction: fam.name,
          age: `${randRange(25, 40)}세`,
          martial_rank: pick(['일류급', '화경급']),
          rank_in_faction: `${gt.name} ${i + 1}번`,
          faction_type: '세가',
          group_title: gt.name,
          group_position: i + 1,
        });
      }
    }

    // 나머지
    const count = chars.filter(c => c.faction === fam.name).length;
    for (let i = 0; i < 5 - count; i++) {
      chars.push({
        name: generateFamilyName(fam.surname),
        role: '단역',
        faction: fam.name,
        age: `${randRange(20, 40)}세`,
        martial_rank: pick(['일류급', '이류급', '삼류급']),
        rank_in_faction: '자제',
        faction_type: '세가',
      });
    }
  }

  return chars;
}

/** 중소문파 캐릭터 생성 (80명: 20개 × 4명) */
function generateMinorFactions(): CharacterBase[] {
  const chars: CharacterBase[] = [];
  const factions = [
    '청운검문', '벽파검각', '창강수각', '태호방', '금릉문',
    '운봉검각', '백학문', '묵검당', '혈검문', '오봉산장',
    '운검파', '청강검문', '화류검각', '태평산장', '낙화검문',
    '강남검각', '운강문', '비운검각', '천강문', '무영문',
  ];

  for (const f of factions) {
    // 문주 1명
    chars.push({
      name: generateName(),
      role: '조연',
      faction: `${f} (소주)`,
      age: `${randRange(40, 55)}세`,
      martial_rank: pick(['일류급', '준화경급']),
      rank_in_faction: '문주',
      faction_type: '정파',
      title: generatePersonalTitle(f, '문주'),
    });

    // 문인 3명
    for (let i = 0; i < 3; i++) {
      chars.push({
        name: generateName(),
        role: '단역',
        faction: `${f} (소주)`,
        age: `${randRange(22, 40)}세`,
        martial_rank: pick(['이류급', '삼류급']),
        rank_in_faction: '문인',
        faction_type: '정파',
      });
    }
  }

  return chars;
}

/** 사파 캐릭터 생성 (100명: 혈마단 50 + 마교 50) */
function generateEvilFactions(): CharacterBase[] {
  const chars: CharacterBase[] = [];

  // ── 혈마단 50명 ──
  // 존자
  chars.push({ name: '혈무극', role: '조연', faction: '혈마단', age: '68세', martial_rank: '현경급', rank_in_faction: '존자', faction_type: '사파', title: '혈마존자' });
  // 부존자
  chars.push({ name: '혈영천', role: '조연', faction: '혈마단', age: '62세', martial_rank: '준현경급', rank_in_faction: '부존자', faction_type: '사파', title: '혈영귀' });
  // 혈마십이두 (12명)
  for (let i = 0; i < 12; i++) {
    chars.push({
      name: generateName(),
      role: '조연',
      faction: '혈마단',
      age: `${randRange(35, 55)}세`,
      martial_rank: pick(['화경급', '일류급']),
      rank_in_faction: `${i + 1}두`,
      faction_type: '사파',
      group_title: '혈마십이두',
      group_position: i + 1,
      title: `혈마${i + 1}두`,
    });
  }
  // 일반 단원 36명
  for (let i = 0; i < 36; i++) {
    chars.push({
      name: generateName(),
      role: '단역',
      faction: '혈마단',
      age: `${randRange(22, 40)}세`,
      martial_rank: pick(['이류급', '삼류급']),
      rank_in_faction: '단원',
      faction_type: '사파',
    });
  }

  // ── 마교 50명 ──
  // 교주
  chars.push({ name: '천마현', role: '조연', faction: '마교', age: '65세', martial_rank: '현경급', rank_in_faction: '교주', faction_type: '사파', title: '천마교주' });
  // 사대호법
  const hoNames = ['홍', '흑', '백', '청'];
  for (let i = 0; i < 4; i++) {
    chars.push({
      name: generateName(),
      role: '조연',
      faction: '마교',
      age: `${randRange(40, 55)}세`,
      martial_rank: pick(['화경급', '준현경급']),
      rank_in_faction: `${hoNames[i]}의호법`,
      faction_type: '사파',
      group_title: '마교사대호법',
      group_position: i + 1,
      title: `${hoNames[i]}의호법`,
    });
  }
  // 장로 8명
  for (let i = 0; i < 8; i++) {
    chars.push({
      name: generateName(),
      role: '조연',
      faction: '마교',
      age: `${randRange(45, 60)}세`,
      martial_rank: pick(['화경급', '일류급']),
      rank_in_faction: `${i + 1}장로`,
      faction_type: '사파',
    });
  }
  // 일반 무인 37명
  for (let i = 0; i < 37; i++) {
    chars.push({
      name: generateName(),
      role: '단역',
      faction: '마교',
      age: `${randRange(22, 40)}세`,
      martial_rank: pick(['이류급', '삼류급']),
      rank_in_faction: '무인',
      faction_type: '사파',
    });
  }

  return chars;
}

/** 무림맹 캐릭터 생성 (50명) */
function generateMurimAlliance(): CharacterBase[] {
  const chars: CharacterBase[] = [];

  chars.push({ name: generateName(), role: '조연', faction: '무림맹', age: '58세', martial_rank: '준천인급', rank_in_faction: '맹주', faction_type: '정파', title: '무림맹주' });
  for (let i = 0; i < 2; i++) {
    chars.push({ name: generateName(), role: '조연', faction: '무림맹', age: `${55 + i}세`, martial_rank: '화경급', rank_in_faction: `부맹주`, faction_type: '정파' });
  }
  for (let i = 0; i < 10; i++) {
    chars.push({ name: generateName(), role: '조연', faction: '무림맹', age: `${randRange(45, 60)}세`, martial_rank: pick(['화경급', '일류급']), rank_in_faction: `${i + 1}장로`, faction_type: '정파' });
  }
  for (let i = 0; i < 37; i++) {
    chars.push({ name: generateName(), role: '단역', faction: '무림맹', age: `${randRange(25, 45)}세`, martial_rank: pick(['일류급', '이류급', '삼류급']), rank_in_faction: '맹원', faction_type: '정파' });
  }

  return chars;
}

/** 황실 캐릭터 생성 (40명) */
function generateImperial(): CharacterBase[] {
  const chars: CharacterBase[] = [];

  chars.push({ name: '진태종', role: '조연', faction: '황실', age: '50세', martial_rank: '일류급', rank_in_faction: '황제', faction_type: '황실', title: '천자' });
  for (let i = 0; i < 3; i++) {
    chars.push({ name: generateFamilyName('진'), role: '조연', faction: '황실', age: `${randRange(20, 35)}세`, martial_rank: pick(['이류급', '일류급']), rank_in_faction: `${i + 1}황자`, faction_type: '황실' });
  }
  // 금의위 사령관
  chars.push({ name: generateName(), role: '조연', faction: '황실 금의위', age: '45세', martial_rank: '화경급', rank_in_faction: '금의위 사령관', faction_type: '황실', title: '금의지휘사' });
  // 금의위 15명
  for (let i = 0; i < 15; i++) {
    chars.push({ name: generateName(), role: '단역', faction: '황실 금의위', age: `${randRange(25, 40)}세`, martial_rank: pick(['일류급', '이류급']), rank_in_faction: '금의위', faction_type: '황실' });
  }
  // 환관 6명
  for (let i = 0; i < 6; i++) {
    chars.push({ name: generateName(), role: '단역', faction: '황실', age: `${randRange(40, 65)}세`, martial_rank: pick(['없음', '삼류급']), rank_in_faction: '환관', faction_type: '황실' });
  }
  // 궁녀 10명
  for (let i = 0; i < 10; i++) {
    chars.push({ name: generateName('여'), role: '단역', faction: '황실', age: `${randRange(18, 30)}세`, martial_rank: '없음', rank_in_faction: '궁녀', faction_type: '황실' });
  }
  // 시위 5명 (나머지)
  for (let i = 0; i < 5; i++) {
    chars.push({ name: generateName(), role: '단역', faction: '황실', age: `${randRange(30, 45)}세`, martial_rank: pick(['이류급', '삼류급']), rank_in_faction: '시위', faction_type: '황실' });
  }

  return chars;
}

/** 객잔/상단 캐릭터 생성 (43명) */
function generateInnsAndMerchants(): CharacterBase[] {
  const chars: CharacterBase[] = [];

  const inns = [
    '춘향루', '천하제일루', '서호루', '촉향루', '태백객잔',
    '북해장', '빙설루', '서역관', '화류각', '취월루',
    '평안객잔', '대도회', '북경회관', '장강루', '만리상회',
    '소주상단', '개봉상단', '낙양상단', '태원회관', '청풍객잔',
    '백학객잔', '묵검객잔', '오봉객잔', '운검객잔', '청강객잔',
    '화류객잔', '태평객잔', '낙화객잔', '강남객잔', '운강객잔',
    '비운객잔', '천강객잔', '무영객잔', '만복객잔', '태화루',
  ];

  for (const inn of inns) {
    chars.push({
      name: generateName(),
      role: '단역',
      faction: inn,
      age: `${randRange(35, 60)}세`,
      martial_rank: pick(['없음', '삼류급', '이류급']),
      rank_in_faction: '주인',
      faction_type: '상인',
    });
  }

  // 대형 상단주 8명
  const merchants = ['만보상단', '통해상단', '금릉상단', '사해상단', '태평상단', '북극상회', '서역상회', '강남교역소'];
  for (const m of merchants) {
    chars.push({
      name: generateName(),
      role: '단역',
      faction: m,
      age: `${randRange(40, 58)}세`,
      martial_rank: pick(['없음', '이류급', '삼류급']),
      rank_in_faction: '상단주',
      faction_type: '상인',
    });
  }

  return chars;
}

/** 엑스트라 캐릭터 생성 (나머지: 목표 - 현재) */
function generateExtras(count: number): CharacterBase[] {
  const chars: CharacterBase[] = [];
  const types = [
    { faction: '관부', rank: '관원', type: '백성', mrank: '없음' },
    { faction: '의원', rank: '의원', type: '백성', mrank: '없음' },
    { faction: '대장간', rank: '대장장이', type: '백성', mrank: pick(['없음', '삼류급']) },
    { faction: '거지방', rank: '거지', type: '백성', mrank: pick(['없음', '삼류급']) },
    { faction: '기방', rank: '기녀', type: '백성', mrank: '없음' },
    { faction: '백성', rank: '백성', type: '백성', mrank: '없음' },
    { faction: '포교', rank: '포교', type: '백성', mrank: pick(['이류급', '삼류급']) },
    { faction: '표국', rank: '표사', type: '정파무인', mrank: pick(['이류급', '삼류급']) },
  ];

  for (let i = 0; i < count; i++) {
    const t = types[i % types.length];
    const isFemale = t.faction === '기방' || (t.faction === '백성' && Math.random() < 0.3);
    chars.push({
      name: generateName(isFemale ? '여' : '남'),
      role: '단역',
      faction: t.faction,
      age: `${randRange(18, 60)}세`,
      martial_rank: t.mrank,
      rank_in_faction: t.rank,
      faction_type: t.type,
    });
  }

  return chars;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 7: 메인 POST 핸들러
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(req: NextRequest) {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 1000명 캐릭터 생성 + 30가지 특징 시작');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Supabase 클라이언트
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. 기존 캐릭터 이름 조회 (중복 방지)
    const { data: existingChars, error: fetchError } = await supabase
      .from('characters')
      .select('name')
      .eq('series_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    if (fetchError) {
      console.error('기존 캐릭터 조회 실패:', fetchError);
    }

    const existingCount = existingChars?.length || 0;
    console.log(`📋 기존 캐릭터: ${existingCount}명`);

    // 기존 이름을 usedNames에 등록 (중복 방지)
    if (existingChars) {
      for (const c of existingChars) {
        usedNames.add(c.name);
      }
    }

    // 2. 723명 생성 (기존 277 유지)
    const TARGET = 1000;
    const toGenerate = TARGET - existingCount;

    if (toGenerate <= 0) {
      return NextResponse.json({
        success: true,
        message: `이미 ${existingCount}명이 있습니다. 추가 생성 불필요.`,
        existing: existingCount,
        generated: 0,
      });
    }

    console.log(`🎯 생성 목표: ${toGenerate}명`);

    // 3. 세력별 캐릭터 생성
    const allNewChars: CharacterBase[] = [];

    const nineFaction = generateNineFactions();
    allNewChars.push(...nineFaction);
    console.log(`✅ 9대문파: ${nineFaction.length}명`);

    const fiveFamilies = generateFiveFamilies();
    allNewChars.push(...fiveFamilies);
    console.log(`✅ 5대세가: ${fiveFamilies.length}명`);

    const tenFamilies = generateTenFamilies();
    allNewChars.push(...tenFamilies);
    console.log(`✅ 10대세가(5개): ${tenFamilies.length}명`);

    const minorFactions = generateMinorFactions();
    allNewChars.push(...minorFactions);
    console.log(`✅ 중소문파: ${minorFactions.length}명`);

    const evilFactions = generateEvilFactions();
    allNewChars.push(...evilFactions);
    console.log(`✅ 사파: ${evilFactions.length}명`);

    const murimAlliance = generateMurimAlliance();
    allNewChars.push(...murimAlliance);
    console.log(`✅ 무림맹: ${murimAlliance.length}명`);

    const imperial = generateImperial();
    allNewChars.push(...imperial);
    console.log(`✅ 황실: ${imperial.length}명`);

    const inns = generateInnsAndMerchants();
    allNewChars.push(...inns);
    console.log(`✅ 객잔/상단: ${inns.length}명`);

    // 나머지 엑스트라로 채움
    const currentTotal = allNewChars.length;
    const extraCount = Math.max(0, toGenerate - currentTotal);
    if (extraCount > 0) {
      const extras = generateExtras(extraCount);
      allNewChars.push(...extras);
      console.log(`✅ 엑스트라: ${extras.length}명`);
    }

    // 최대 toGenerate명만 사용
    const finalChars = allNewChars.slice(0, toGenerate);
    console.log(`📊 총 생성: ${finalChars.length}명`);

    // 4. 30가지 특징 생성 + Supabase 업로드
    let successCount = 0;
    let errorCount = 0;
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(finalChars.length / BATCH_SIZE);

    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, finalChars.length);
      const batchChars = finalChars.slice(start, end);

      // 각 캐릭터에 30가지 특징 생성
      const enrichedBatch = batchChars.map((char) => {
        const traits = generate30Traits(char);
        return {
          name: char.name,
          role: char.role,
          faction: char.faction,
          age: char.age,
          martial_rank: char.martial_rank,
          rank_in_faction: char.rank_in_faction,
          ...traits,
        };
      });

      // Supabase에 배치 업로드 (upsert)
      const { error: insertError } = await supabase
        .from('characters')
        .upsert(enrichedBatch, { onConflict: 'series_id,name' });

      if (insertError) {
        console.error(`❌ 배치 ${batch + 1}/${totalBatches} 실패:`, insertError.message);
        errorCount += batchChars.length;
      } else {
        successCount += batchChars.length;
        console.log(`✅ 배치 ${batch + 1}/${totalBatches} 완료 (${successCount}/${finalChars.length}명)`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 완료! 성공: ${successCount}명, 실패: ${errorCount}명`);
    console.log(`📊 최종: ${existingCount} + ${successCount} = ${existingCount + successCount}명`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      success: true,
      existing: existingCount,
      generated: successCount,
      failed: errorCount,
      total: existingCount + successCount,
      message: `✅ ${successCount}명 생성 완료! (30가지 특징 포함)\n기존 ${existingCount}명 + 신규 ${successCount}명 = 총 ${existingCount + successCount}명`,
      breakdown: {
        '9대문파': nineFaction.length,
        '5대세가': fiveFamilies.length,
        '10대세가': tenFamilies.length,
        '중소문파': minorFactions.length,
        '사파': evilFactions.length,
        '무림맹': murimAlliance.length,
        '황실': imperial.length,
        '객잔상단': inns.length,
        '엑스트라': extraCount,
      },
    });
  } catch (error) {
    console.error('❌ 전체 오류:', error);
    return NextResponse.json(
      {
        error: '생성 중 오류 발생',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 8: 헬퍼 함수들
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function randRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 무공 등급 → 숫자 변환 */
function getMartialRankNumeric(rank: string): number {
  const map: Record<string, number> = {
    '없음': 0, '삼류급': 1, '이류급': 2, '일류급': 3, '준화경급': 4,
    '화경급': 5, '준현경급': 6, '현경급': 7, '준천인급': 8, '천인급': 9, '절대고수': 10,
  };
  return map[rank] || 0;
}

/** 전투력 계산 (등급 기반) */
function calculateMartialStats(rank: string, role: string) {
  const rankStats: Record<string, { combat: [number, number]; years: [number, number]; qi: string; exp: string }> = {
    '없음':       { combat: [5, 15],   years: [0, 0],     qi: '없음',    exp: '무공 없음' },
    '삼류급':     { combat: [20, 30],  years: [1, 3],     qi: '초급',    exp: '실전 10회 미만' },
    '이류급':     { combat: [35, 50],  years: [5, 10],    qi: '초급',    exp: '실전 10~30회' },
    '일류급':     { combat: [55, 70],  years: [15, 25],   qi: '중급',    exp: '강호 5년, 실전 50회+' },
    '준화경급':   { combat: [70, 80],  years: [30, 40],   qi: '중급',    exp: '강호 10년, 실전 100회+' },
    '화경급':     { combat: [80, 90],  years: [50, 70],   qi: '고급',    exp: '강호 20년+, 생사결 다수' },
    '준현경급':   { combat: [85, 92],  years: [80, 100],  qi: '고급',    exp: '강호 30년+, 절정고수 대적' },
    '현경급':     { combat: [90, 95],  years: [100, 150], qi: '대가',    exp: '강호 40년+, 생사초월' },
    '준천인급':   { combat: [93, 97],  years: [150, 200], qi: '대가',    exp: '강호 50년+, 절대고수 반열' },
    '천인급':     { combat: [95, 99],  years: [200, 300], qi: '초절정',  exp: '강호 전설, 생사초월' },
    '절대고수':   { combat: [99, 100], years: [300, 500], qi: '초절정',  exp: '천하제일, 신의 경지' },
  };

  const stats = rankStats[rank] || rankStats['삼류급'];
  const base = randRange(stats.combat[0], stats.combat[1]);
  const bonus = (role === '주인공' || role === '주요 조연') ? 5 : 0;
  const combat = Math.min(100, base + bonus);
  const years = randRange(stats.years[0], stats.years[1]);

  return {
    combat_power: combat,
    attack_power: Math.min(100, combat + randRange(-5, 10)),
    defense_power: Math.min(100, combat + randRange(-10, 5)),
    speed_power: Math.min(100, combat + randRange(-5, 15)),
    technique_power: Math.min(100, combat + randRange(-3, 8)),
    internal_energy_years: years,
    internal_energy_level: `${years}년 ${years < 5 ? '미약한' : years < 15 ? '기초적인' : years < 30 ? '중급' : years < 60 ? '심후한' : years < 100 ? '정순한' : years < 200 ? '절정의' : '초절정'} 내공`,
    qi_control_level: stats.qi,
    combat_experience: stats.exp,
  };
}

/** 무공 숙련도 생성 */
function generateSkillProficiency(skills: string[], combatPower: number): Record<string, number> {
  if (!skills || skills.length === 0) return {};
  const baseProf = combatPower < 30 ? 30 : combatPower < 50 ? 50 : combatPower < 70 ? 70 : combatPower < 80 ? 80 : combatPower < 90 ? 85 : 95;
  const result: Record<string, number> = {};
  skills.forEach((skill, i) => {
    result[skill] = Math.min(100, baseProf + (i === 0 ? 5 : 0) + randRange(-10, 10));
  });
  return result;
}

/** 체격 생성 */
function generateBodyStats(factionType: string, gender: '남' | '여', combat: number) {
  if (gender === '여') {
    return {
      height: `${randRange(155, 172)}cm`,
      weight: `${randRange(42, 58)}kg`,
      build: pick(['날씬', '균형잡힌', '유연한']),
      appearance: pick(['청아한 얼굴', '날카로운 눈매의 미인', '차가운 인상', '부드러운 인상', '강인한 인상의 여인']),
    };
  }
  if (factionType === '불교') {
    return { height: `${randRange(165, 180)}cm`, weight: `${randRange(55, 75)}kg`, build: pick(['호리호리', '균형잡힌', '다부진']), appearance: pick(['삭발, 이마에 계파 자국', '삭발, 인자한 얼굴', '삭발, 험상궂지만 눈은 자비로움']) };
  }
  if (factionType === '사파') {
    return { height: `${randRange(170, 195)}cm`, weight: `${randRange(70, 110)}kg`, build: pick(['근육질', '거구', '험상궂은', '마른 (사악한 기운)']), appearance: pick(['흉터가 가득한 얼굴', '핏빛 눈동자', '음침한 인상', '잔혹한 미소가 특징', '왼쪽 눈에 안대']) };
  }
  if (combat >= 80) {
    return { height: `${randRange(175, 190)}cm`, weight: `${randRange(75, 95)}kg`, build: pick(['다부진', '균형잡힌', '위엄 있는']), appearance: pick(['날카로운 눈매, 위엄 서린 기운', '은발의 노련한 고수', '깊은 눈동자, 내공이 드러남', '준수한 외모, 한눈에 강자임을 알 수 있음']) };
  }
  return {
    height: `${randRange(165, 185)}cm`,
    weight: `${randRange(60, 85)}kg`,
    build: pick(['보통', '마른', '다부진', '근육질', '호리호리']),
    appearance: pick(['평범한 인상', '각진 턱', '날카로운 눈', '온화한 인상', '무뚝뚝한 얼굴', '검게 그을린 피부']),
  };
}

/** 외모 특징 생성 */
function generateDistinctiveFeature(role: string, gender: '남' | '여'): string {
  const maleFeatures = [
    '왼쪽 팔에 긴 검 흉터', '오른쪽 눈썹 위 작은 흉터', '턱에 칼자국',
    '넓은 어깨', '거친 손', '각진 턱선', '날카로운 눈빛', '굵은 눈썹',
    '긴 머리카락을 묶어 올림', '수염이 덥수룩', '깔끔한 구레나룻',
    '코가 매부리코', '귀에 작은 귀걸이', '손등에 화상 흉터',
    '왼손 검지 손톱이 없음', '이마에 작은 점', '목에 오래된 목걸이 흉터',
  ];
  const femaleFeatures = [
    '긴 흑발을 묶어 올림', '맑은 눈동자', '창백한 피부', '살짝 주근깨',
    '귀 뒤에 작은 점', '가느다란 손가락', '날카로운 눈매', '은색 비녀',
    '왼쪽 손목에 가는 팔찌', '이마에 작은 흉터 (일부러 숨김)',
  ];
  const count = role === '주인공' || role === '주요 조연' ? 3 : role === '조연' ? 2 : 1;
  const pool = gender === '여' ? femaleFeatures : maleFeatures;
  return pickMultiple(pool, count).join(', ');
}

/** 상징 소품 생성 */
function generateAccessory(factionType: string, role: string): string {
  const accessories: Record<string, string[]> = {
    불교: ['108과 목재 염주', '금강경 한 권', '깨진 사발 (승려의 상징)', '향낭'],
    도교: ['옥 장식 검 손잡이', '도교 부적 하나', '태극 문양 옥패', '죽림 피리'],
    세가: ['가문 문장이 새겨진 옥패', '금으로 된 반지 (가주의 증표)', '비단 허리띠', '가문 비전서 조각'],
    사파: ['피 묻은 구슬 목걸이', '해골 장식 반지', '붉은 천으로 감은 무기', '독이 묻은 비수 하나'],
    상인: ['산호 장식 부채', '금화 주머니', '상단 문장 옥패', '자물쇠 열쇠 다발'],
    황실: ['황실 문장 금패', '용문양 옥대', '황금 비녀', '어사 직인'],
    default: ['허리에 건 낡은 주머니', '부친의 유품인 짧은 칼', '아무것도 없음 (무소유)', '부적 한 장'],
  };
  const pool = accessories[factionType] || accessories.default;
  if (role === '주인공' || role === '주요 조연') {
    return pick(pool) + ' (중요 소품: 서사에 영향)';
  }
  return pick(pool);
}

/** 목소리 톤 생성 */
function generateVoice(gender: '남' | '여', factionType: string): string {
  if (gender === '여') return pick(['맑고 차가운 목소리', '부드럽고 낮은 목소리', '날카로운 고음', '조용하고 침착한 목소리']);
  if (factionType === '불교') return pick(['굵고 차분한 목소리', '온화하고 낮은 목소리', '묵직한 법음']);
  if (factionType === '사파') return pick(['낮고 음침한 목소리', '갈라진 쉰 목소리', '냉소적인 톤', '광기 서린 높은 음']);
  return pick(['굵고 낮은 목소리', '차분한 중저음', '날카로운 목소리', '호탕한 큰 목소리', '조용하고 나직한 목소리']);
}

/** 전투 스타일 생성 */
function generateFightingStyle(weapon: string, build: string, factionType: string): string {
  if (factionType === '사파') return pick(['잔혹무비형 (고통을 즐기며 싸움)', '독공 특화 (독으로 약화 후 마무리)', '기습형 (암습과 불의타)', '광전사형 (이성을 잃고 난전)']);
  if (weapon.includes('검')) return pick(['균형형 (공수 겸비)', '속공형 (선제 공격)', '후발제인형 (상대 허점 노림)', '연환형 (끊임없는 연속 공격)']);
  if (weapon.includes('도')) return pick(['파워형 (일격필살)', '돌진형 (거리를 좁혀 제압)']);
  if (weapon.includes('창')) return pick(['거리유지형 (중거리 견제)', '찌르기 특화형']);
  if (weapon.includes('암기')) return pick(['원거리 암기형 (독침/비수)', '근접 독공형 (독장갑/독침)']);
  if (build === '근육질' || build === '거구') return '파워형 (힘으로 압도)';
  if (build === '호리호리' || build === '마른') return '속도형 (민첩하게 회피하며 급소 공격)';
  return pick(['균형형', '방어형 (반격 기회 노림)', '실용형 (수단 가리지 않음)']);
}

/** 전투 약점 생성 */
function generateCombatWeakness(combat: number): string {
  if (combat >= 90) return pick(['체력 소모 시 내공 제어 약간 불안정', '과도한 자신감 (방심)', '오래된 부상 (좌측 어깨)']);
  if (combat >= 70) return pick(['좌측 방어가 약함', '장기전에 약함 (내공 부족)', '다수전에서 포위당하기 쉬움', '감정 조절 미숙 (분노 시 판단력 저하)']);
  if (combat >= 50) return pick(['경험 부족 (실전에서 당황)', '내공이 얕음', '체력이 약함 (장기전 불가)', '특정 유형의 무공에 약함']);
  return pick(['기본기 부족', '실전 경험 거의 없음', '체력과 내공 모두 부족', '무기 의존도 높음 (무기 없으면 무력']);
}

/** 문파 타입 판별 */
function getFactionType(faction: string): string {
  if (faction.includes('소림') || faction.includes('아미')) return '불교';
  if (faction.includes('무당') || faction.includes('화산') || faction.includes('종남') || faction.includes('청성') || faction.includes('곤륜') || faction.includes('점창')) return '도교';
  if (faction.includes('세가') || faction.includes('당가') || faction.includes('팽가') || faction.includes('왕가') || faction.includes('곽가') || faction.includes('설가')) return '세가';
  if (faction.includes('혈마') || faction.includes('마교') || faction.includes('독사')) return '사파';
  if (faction.includes('황실') || faction.includes('금의위')) return '황실';
  if (faction.includes('객잔') || faction.includes('상단') || faction.includes('루') || faction.includes('상회') || faction.includes('교역')) return '상인';
  if (faction.includes('개방')) return '정파무인';
  if (faction.includes('무림맹')) return '정파무인';
  if (faction.includes('백성') || faction.includes('관부') || faction.includes('의원') || faction.includes('대장간') || faction.includes('기방') || faction.includes('거지') || faction.includes('포교') || faction.includes('표국')) return '백성';
  return '정파무인';
}

/** faction key 찾기 (FACTION_SKILLS 등의 key와 매칭) */
function findFactionKey(faction: string): string {
  for (const key of Object.keys(FACTION_SKILLS)) {
    if (faction.includes(key.replace(' (소주)', ''))) return key;
  }
  return 'default';
}

/** 음식 지역 키 판별 */
function getFoodRegionKey(faction: string, birthplace: string): string {
  if (faction.includes('소림') || faction.includes('아미')) return '채식';
  if (faction.includes('무당') || faction.includes('화산') || faction.includes('종남') || faction.includes('청성') || faction.includes('곤륜') || faction.includes('점창')) return '도교식';
  if (birthplace.includes('하남')) return '하남';
  if (birthplace.includes('호북')) return '호북';
  if (birthplace.includes('섬서')) return '섬서';
  if (birthplace.includes('강남') || birthplace.includes('소주') || birthplace.includes('고소')) return '강남';
  if (birthplace.includes('사천')) return '사천';
  if (birthplace.includes('북방')) return '북방';
  if (birthplace.includes('산동')) return '산동';
  if (birthplace.includes('광동')) return '광동';
  if (birthplace.includes('서역') || birthplace.includes('곤륜')) return '서역';
  return pick(['하남', '강남', '북방', '사천', '산동']);
}

/** 여성 문파 판별 */
function isFemaleFaction(faction: string, name: string): boolean {
  if (faction.includes('아미')) return true;
  if (faction.includes('궁녀') || faction.includes('기방')) return true;
  if (name.includes('궁녀')) return true;
  return false;
}

/** 사회 계급 판별 */
function getSocialClass(faction: string): string {
  if (faction.includes('세가') || faction.includes('당가') || faction.includes('황실')) return '귀족';
  if (faction.includes('상단') || faction.includes('상회') || faction.includes('교역')) return '상인';
  if (faction.includes('개방') || faction.includes('거지')) return '빈민';
  return '평민';
}

/** 가족 타입 판별 */
function getFamilyType(factionType: string): string {
  if (factionType === '세가' || factionType === '황실') return '세가';
  if (factionType === '사파') return '사파';
  if (factionType === '백성' || factionType === '상인') return '백성';
  return '문파';
}

/** 가족 멤버 생성 */
function generateFamilyMembers(factionType: string): Record<string, string> {
  if (factionType === '세가') return { 부: pick(['생존', '사망']), 모: '생존', 형제: `${randRange(1, 4)}명` };
  if (factionType === '사파') return { 부: pick(['사망', '행방불명']), 모: pick(['사망', '행방불명', '생존']), 형제: pick(['없음', '1명 (생사불명)']) };
  if (factionType === '불교' || factionType === '도교') return { 부모: '속세와 인연 끊음', 사형제: `${randRange(3, 15)}명` };
  return { 부: pick(['생존', '사망']), 모: pick(['생존', '사망']), 형제: pick(['없음', '1명', '2명']) };
}

/** 개인 호(별호) 생성 */
function generatePersonalTitle(faction: string, position: string): string {
  const prefixes = ['철', '금', '은', '흑', '백', '혈', '풍', '화', '빙', '뇌', '천', '지', '무', '검', '도', '영', '야', '광', '맹', '독'];
  const suffixes = ['검', '도', '왕', '신', '성', '마', '귀', '후', '선', '제', '존', '공', '수', '룡', '봉', '학', '호', '웅', '표', '랑'];

  if (position === '장문인' || position === '가주') {
    return pick(prefixes) + pick(suffixes);
  }
  if (position === '단체호멤버' || position === '문주') {
    return pick(prefixes) + pick(suffixes);
  }
  return '';
}

/** 의복 색상 추출 */
function extractColors(clothing: string): string[] {
  const colors = ['회색', '청색', '백색', '남색', '옥청색', '금수', '보라색', '검은색', '흑백', '녹색', '핏빛', '칠흑', '금색', '붉은'];
  return colors.filter(c => clothing.includes(c)).slice(0, 2);
}
