-- ============================================================================
-- 안티그라비티 노벨 스튜디오 v2.0 - 영상 제작 최적화 버전
-- 작성일: 2026-01-29
-- 작성자: 오대준 대표 + AI 전문가
-- ============================================================================

-- [기존 테이블은 그대로 유지]
-- novel_series, novel_episodes, program_users

-- ============================================================================
-- 1. 세계관 관리 시스템 (World Bible)
-- ============================================================================

-- 1-1. 캐릭터 프로필 (일관성 유지의 핵심)
CREATE TABLE IF NOT EXISTS character_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                    -- 캐릭터 이름 (예: 독고준)
    role TEXT,                              -- 역할 (주인공/조연/악역)
    appearance TEXT,                        -- 외형 (검은 도포, 긴 흑발, 냉혹한 눈빛)
    personality TEXT,                       -- 성격 (냉정하지만 충신에게는 따뜻함)
    signature_move TEXT,                    -- 필살기 (천마혈인검)
    voice_tone TEXT,                        -- 목소리 톤 (낮고 차가운 음성)
    image_prompt TEXT,                      -- AI 이미지 생성용 프롬프트
    reference_image_url TEXT,               -- 참고 이미지 URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- 한 작품 내에서 같은 이름의 캐릭터 중복 방지
    CONSTRAINT unique_character_per_series UNIQUE (series_id, name)
);

-- 1-2. 장소 설정 (배경 일관성)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                     -- 장소명 (독고가 본가)
    description TEXT,                       -- 설명 (거대한 흑색 석조 건물)
    atmosphere TEXT,                        -- 분위기 (엄숙하고 살벌한)
    time_period TEXT,                       -- 시간대 (한밤중/새벽/정오)
    weather TEXT,                           -- 날씨 (맑음/비/눈)
    image_prompt TEXT,                      -- AI 이미지 생성용 프롬프트
    reference_image_url TEXT,               -- 참고 이미지 URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    CONSTRAINT unique_location_per_series UNIQUE (series_id, name)
);

-- 1-3. 용어집 (무공/조직명 등)
CREATE TABLE IF NOT EXISTS terminology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,
    term TEXT NOT NULL,                     -- 용어 (천마혈인검)
    category TEXT,                          -- 분류 (무공/조직/아이템)
    meaning TEXT,                           -- 의미/설명
    first_appearance INTEGER,               -- 처음 등장한 회차
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    CONSTRAINT unique_term_per_series UNIQUE (series_id, term)
);

-- ============================================================================
-- 2. 씬(Scene) 기반 시스템 (영상 제작의 핵심)
-- ============================================================================

-- 2-1. 씬 데이터 (1화 = 10~15개 씬)
CREATE TABLE IF NOT EXISTS episode_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID REFERENCES novel_episodes(id) ON DELETE CASCADE,
    scene_number INTEGER NOT NULL,          -- 씬 번호 (1, 2, 3...)
    scene_title TEXT,                       -- 씬 제목 (오프닝/각성/재회)
    
    -- 타임코드 (영상 편집용)
    start_time INTEGER,                     -- 시작 시간 (초 단위, 예: 0)
    duration INTEGER,                       -- 지속 시간 (초 단위, 예: 15)
    
    -- 스크립트 (핵심 내용)
    narration TEXT,                         -- 내레이션 (방백/설명)
    dialogue TEXT,                          -- 대사 (JSON 형식: [{"character": "독고준", "line": "살아있다"}])
    action_description TEXT,                -- 액션 설명 (독고진이 무릎을 꿇으며...)
    
    -- 영상 제작 정보
    location_id UUID REFERENCES locations(id),  -- 장소
    characters TEXT,                        -- 등장 캐릭터 (JSON 배열: ["독고준", "독고진"])
    
    -- AI 이미지 생성용
    image_prompt TEXT,                      -- Midjourney/DALL-E 프롬프트
    image_url TEXT,                         -- 생성된 이미지 URL
    
    -- 연출 정보
    camera_direction TEXT,                  -- 카메라 연출 (클로즈업/풀샷/팬)
    screen_effect TEXT,                     -- 화면 효과 (페이드/번쩍임/진동)
    
    -- 오디오 정보
    bgm_genre TEXT,                         -- BGM 장르 (전통악기/긴장감/슬픔)
    bgm_intensity TEXT,                     -- BGM 강도 (low/medium/high)
    sfx TEXT,                               -- 효과음 (JSON 배열: ["heartbeat", "explosion"])
    
    -- TTS 설정
    voice_character TEXT,                   -- 음성 캐릭터 (male_deep/female_soft)
    voice_speed FLOAT DEFAULT 1.0,          -- 음성 속도 (0.8 ~ 1.2)
    voice_emotion TEXT,                     -- 감정 (serious/angry/sad/happy)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- 한 에피소드 내에서 같은 씬 번호 중복 방지
    CONSTRAINT unique_scene_per_episode UNIQUE (episode_id, scene_number)
);

-- 2-2. 씬 생성 로그 (품질 관리용)
CREATE TABLE IF NOT EXISTS scene_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES episode_scenes(id) ON DELETE CASCADE,
    generation_attempt INTEGER DEFAULT 1,   -- 몇 번째 생성 시도인가
    ai_model TEXT,                          -- 사용한 AI 모델 (gemini-1.5-pro)
    prompt_used TEXT,                       -- 사용한 프롬프트
    quality_score INTEGER,                  -- 품질 점수 (0~100)
    feedback TEXT,                          -- 피드백 (왜 재생성했는가)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. 영상 메타데이터 (유튜브 업로드용)
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID REFERENCES novel_episodes(id) ON DELETE CASCADE,
    
    -- 유튜브 정보
    youtube_title TEXT,                     -- 영상 제목
    youtube_description TEXT,               -- 영상 설명
    youtube_tags TEXT,                      -- 태그 (JSON 배열)
    thumbnail_url TEXT,                     -- 썸네일 URL
    
    -- 제작 정보
    total_duration INTEGER,                 -- 총 러닝타임 (초)
    scene_count INTEGER,                    -- 씬 개수
    video_file_path TEXT,                   -- 생성된 영상 파일 경로
    
    -- 상태 관리
    status TEXT DEFAULT 'draft',            -- draft/rendering/completed/uploaded
    youtube_video_id TEXT,                  -- 업로드 후 YouTube ID
    upload_date TIMESTAMP WITH TIME ZONE,   -- 업로드 날짜
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3-2. 스토리 감각 DB (음식/객잔/여정) - 오감/분위기 자동 추천용
-- ============================================================================
-- 목적:
-- - AI가 스토리 작성 시 "지역/무드/계절/등급"에 맞춰
--   음식/객잔/이동 경로를 자동으로 고를 수 있게 만드는 데이터 구조
-- - 대표님이 100권 이상 장편을 쓰더라도, 자료가 문서에 흩어져서
--   반복 작업(복붙/검색)을 하지 않도록 "검색 가능한 재료 창고"를 만든다.

-- (A) 무드 태그 (긴장/의리/고독/권력/로맨스 등)
CREATE TABLE IF NOT EXISTS mood_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,                      -- 예: tension, brotherhood, solitude, power, romance
    name TEXT NOT NULL,                      -- 예: 긴장, 의리, 고독, 권력, 썸
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_mood_tag_per_series UNIQUE (series_id, slug)
);

-- (B) 음식/요리 데이터
CREATE TABLE IF NOT EXISTS foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                      -- 예: 양춘면, 장육, 만두, 건량
    tier TEXT,                               -- 하/중/상/특 (또는 서민/중급/상급)
    region TEXT,                             -- 예: 중원, 사천, 강남, 북방 (자유 텍스트)
    category TEXT,                           -- 예: 면/만두/탕/고기/휴대식/디저트

    -- 디테일(오감)
    ingredients TEXT,                        -- 재료/향신료 요약(예: 오향, 산초, 돼지기름)
    taste_notes TEXT,                        -- 맛(예: 얼얼, 짭짤, 고소)
    sensory_notes TEXT,                      -- 냄새/식감/연출 포인트(예: 팔각 향이 비계에 밴다)
    cooking_notes TEXT,                      -- 조리법/시간(스토리용)

    -- 장소 연결(선택)
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_food_per_series UNIQUE (series_id, name)
);

-- 음식 ↔ 무드 태그 (N:M)
CREATE TABLE IF NOT EXISTS food_mood_tags (
    food_id UUID REFERENCES foods(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (food_id, mood_tag_id)
);

-- (C) 객잔/숙소 데이터
CREATE TABLE IF NOT EXISTS inns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                      -- 예: 동래객잔, 천하제일루, 촉도객잔
    tier TEXT,                               -- 특/상/중/하
    region TEXT,                             -- 예: 낙양권/장안권/사천/강남/북방

    -- 숙박 디테일(오감)
    atmosphere TEXT,                         -- 예: 방음벽, 밀담, 살기, 시끌벅적
    bed_quality TEXT,                        -- 예: 비단/짚/삐걱거림/벼룩
    hygiene TEXT,                            -- 예: 곰팡이 냄새/깨끗함/온천
    price_note TEXT,                         -- 예: 1박 금자 10냥 (스토리용)
    typical_customers TEXT,                  -- 예: 표사/낭인/장로/황족

    -- 장소 연결(선택)
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_inn_per_series UNIQUE (series_id, name)
);

-- 객잔 ↔ 무드 태그 (N:M)
CREATE TABLE IF NOT EXISTS inn_mood_tags (
    inn_id UUID REFERENCES inns(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (inn_id, mood_tag_id)
);

-- (D) 이동/여정 경로 템플릿
CREATE TABLE IF NOT EXISTS travel_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                      -- 예: 성도→낙양(관문/객잔 포함)
    start_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    end_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

    -- 경유지/관문/숙영 포인트(스토리용)
    route_steps JSONB,                       -- 예: [{"type":"inn","name":"촉도객잔"},{"type":"pass","name":"함곡관"}]
    typical_days_min INTEGER,                -- 최소 소요(감각)
    typical_days_max INTEGER,                -- 최대 소요(감각)
    season_notes TEXT,                       -- 예: 장마/폭설이면 +N일
    hazards TEXT,                            -- 예: 산길/검문/수적 소문

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_route_per_series UNIQUE (series_id, name)
);

-- 여정 ↔ 무드 태그 (N:M)
CREATE TABLE IF NOT EXISTS travel_route_mood_tags (
    travel_route_id UUID REFERENCES travel_routes(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (travel_route_id, mood_tag_id)
);

-- ============================================================================
-- 4. 인덱스 생성 (성능 최적화)
-- ============================================================================

-- 에피소드별 씬 조회 최적화
CREATE INDEX IF NOT EXISTS idx_scenes_episode ON episode_scenes(episode_id, scene_number);

-- 시리즈별 캐릭터 조회 최적화
CREATE INDEX IF NOT EXISTS idx_characters_series ON character_profiles(series_id);

-- 시리즈별 장소 조회 최적화
CREATE INDEX IF NOT EXISTS idx_locations_series ON locations(series_id);

-- 스토리 감각 DB 조회 최적화
CREATE INDEX IF NOT EXISTS idx_mood_tags_series ON mood_tags(series_id);
CREATE INDEX IF NOT EXISTS idx_foods_series ON foods(series_id);
CREATE INDEX IF NOT EXISTS idx_inns_series ON inns(series_id);
CREATE INDEX IF NOT EXISTS idx_travel_routes_series ON travel_routes(series_id);

-- ============================================================================
-- 4-1. 스토리 생존 DB (약물/독/영약) - 생존/의학/기연 자동 추천용
-- ============================================================================
-- 목적:
-- - AI가 “오늘 먹는 약/독/해독/기연”을 장면(지역/무드/등급)에 맞춰 자동 선택
-- - ‘맛/향/식감/부작용/가격’까지 함께 꺼내서 100배 디테일 묘사 가능

-- (A) 약재/단약/자가제약(레시피 포함)
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                      -- 예: 백년삼, 소환단, 백염탕
    hanja TEXT,                              -- 예: 百年蔘, 小還丹
    tier TEXT,                               -- 하/중/상/특 (또는 S급 등)
    category TEXT,                           -- 예: 일상약재/문파단약/자가레시피/해독제
    faction TEXT,                            -- 예: 소림/화산/무당/제갈/당가/마교/상단
    region TEXT,                             -- 예: 중원/사천/강남/북방/전 지역

    -- 오감/연출
    taste_scent_texture TEXT,                -- 맛/향/식감 묘사 포인트
    visual_reaction TEXT,                    -- 복용 시 반응(비주얼)

    -- 효과/대가
    effects TEXT,                            -- 효능
    side_effects TEXT,                       -- 부작용/리스크
    dosage_notes TEXT,                       -- 복용량/주의

    -- 가격/희귀도(스토리 경제)
    price_note TEXT,                         -- 예: 은자 50냥, 금자 5냥, 부르는 게 값
    rarity TEXT,                             -- common/rare/legendary

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_medicine_per_series UNIQUE (series_id, name)
);

-- 약물 ↔ 무드 태그 (N:M)
CREATE TABLE IF NOT EXISTS medicine_mood_tags (
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (medicine_id, mood_tag_id)
);

-- (B) 독/해독
CREATE TABLE IF NOT EXISTS poisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                      -- 예: 칠보단장산, 미혼향
    hanja TEXT,                              -- 예: 七步斷腸散, 迷魂香
    category TEXT,                           -- 예: 즉사/전략/가스/가루/액체/생물/산공독
    faction TEXT,                            -- 예: 당가/황실/살수/사파
    region TEXT,

    symptoms TEXT,                           -- 증상/발현 속도
    detection TEXT,                          -- 은침/냄새/감각 등
    antidote TEXT,                           -- 해독법(없으면 없음)
    severity TEXT,                           -- low/medium/high/instant

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_poison_per_series UNIQUE (series_id, name)
);

-- 독 ↔ 무드 태그 (N:M)
CREATE TABLE IF NOT EXISTS poison_mood_tags (
    poison_id UUID REFERENCES poisons(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (poison_id, mood_tag_id)
);

-- (C) 전설 영약(기연/플롯 장치)
CREATE TABLE IF NOT EXISTS elixirs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                      -- 예: 공청석유, 만년설삼
    hanja TEXT,
    tier TEXT,                               -- 전설/국보급 등
    region TEXT,
    obtain_conditions TEXT,                  -- 생성/획득 조건
    effects TEXT,                            -- 효과
    overload_risk TEXT,                      -- 과부하/폭주 위험(독고준 체질과 연결)
    story_use TEXT,                          -- 어떤 구간에서 쓰는지(플롯용)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_elixir_per_series UNIQUE (series_id, name)
);

-- 영약 ↔ 무드 태그 (N:M)
CREATE TABLE IF NOT EXISTS elixir_mood_tags (
    elixir_id UUID REFERENCES elixirs(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (elixir_id, mood_tag_id)
);

-- ============================================================================
-- 4-2. 스토리 전투 DB (무공/초식) - 전투/이펙트 자동 추천용
-- ============================================================================
-- 목적:
-- - AI가 “상황/무드/파워레벨”에 맞춰 초식/이펙트를 선택
-- - 초식명(한자) + 시각 묘사 + 대가(코피/탈진)까지 묶어서 관리

-- (A) 무공 계열(가문/문파/속성)
CREATE TABLE IF NOT EXISTS martial_art_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                      -- 예: 구천백염공, 독고패검
    hanja TEXT,                              -- 예: 九天白炎功
    faction TEXT,                            -- 예: 독고세가/화산/남궁/당가/마교
    element TEXT,                            -- 예: steam/heat/lightning/poison/heavy_sword
    description TEXT,                        -- 한 줄 컨셉
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_style_per_series UNIQUE (series_id, name)
);

-- (B) 초식/절기
CREATE TABLE IF NOT EXISTS martial_art_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,
    style_id UUID REFERENCES martial_art_styles(id) ON DELETE SET NULL,

    name TEXT NOT NULL,                      -- 예: 백무, 분사, 매화만개
    hanja TEXT,                              -- 예: 白霧, 噴射
    stage TEXT,                              -- 예: 1초/2초/오의/절기/기초
    power_rank TEXT,                         -- 예: 이류/일류/절정/초절정(사용자 기준)

    visual TEXT,                             -- 시각 묘사(증기/검강/번개)
    effect TEXT,                             -- 효과(교란/제압/가속/광역)
    cost TEXT,                               -- 대가(코피/탈진/상처/열폭주)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_move_per_series UNIQUE (series_id, name)
);

-- 초식 ↔ 무드 태그 (N:M)
CREATE TABLE IF NOT EXISTS martial_art_move_mood_tags (
    move_id UUID REFERENCES martial_art_moves(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (move_id, mood_tag_id)
);

-- 인덱스(조회 최적화)
CREATE INDEX IF NOT EXISTS idx_medicines_series ON medicines(series_id);
CREATE INDEX IF NOT EXISTS idx_poisons_series ON poisons(series_id);
CREATE INDEX IF NOT EXISTS idx_elixirs_series ON elixirs(series_id);
CREATE INDEX IF NOT EXISTS idx_martial_styles_series ON martial_art_styles(series_id);
CREATE INDEX IF NOT EXISTS idx_martial_moves_series ON martial_art_moves(series_id);

-- ============================================================================
-- 4-3. 스토리 현실감 DB (경제/호칭/병기/절기/은어/생활도구)
-- ============================================================================
-- 목적:
-- - “조연 포함” 모든 인물이 매 씬에서 현실감 있는 소비/말투/소품을 쓰게 만든다.
-- - 데이터 03~10(경제/호칭/병기/절기/은어/이동/생활도구)을 DB에 담아
--   AI가 상황(지역/무드/등급/계절)에 맞춰 자동으로 선택하도록 한다.

-- (A) 경제 규칙(환율/기준)
CREATE TABLE IF NOT EXISTS economy_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    rule_name TEXT NOT NULL,                 -- 예: 기본 환율, 작품 고정 환산
    rule_text TEXT NOT NULL,                 -- 예: 1냥=1000문, 1냥=50만원 체감 등
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_economy_rule_per_series UNIQUE (series_id, rule_name)
);

-- (B) 가격표(카탈로그) - 음식/숙박/무기/말/정보/약값까지 전부 여기에 들어간다
CREATE TABLE IF NOT EXISTS price_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    category TEXT NOT NULL,                  -- food/lodging/weapon/logistics/info/medicine/etc
    item_name TEXT NOT NULL,                 -- 예: 왕만두 1개, 마차(고급), 명검
    region TEXT,                             -- 예: 중원/사천/강남/북방/전 지역
    tier TEXT,                               -- 하/중/상/특/전설 등(선택)

    -- 가격은 “문(文)” 기준으로 숫자를 두면 계산이 가능해진다(표기 텍스트도 같이 저장)
    price_min_mun BIGINT,
    price_max_mun BIGINT,
    price_note TEXT,                         -- 예: 은 0.1냥, 금자 10냥~ (스토리 표기용)

    rarity TEXT,                             -- common/rare/legendary
    where_to_get TEXT,                       -- 예: 객잔/약재상/경매/문파/개방/관아
    story_use TEXT,                          -- 예: 갈등/뇌물/접대/정보매수/장부연출

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_price_item_per_series UNIQUE (series_id, category, item_name)
);

-- 가격표 ↔ 무드 태그 (N:M) (권력/긴장/고독 등 “돈이 분위기”를 만든다)
CREATE TABLE IF NOT EXISTS price_mood_tags (
    price_id UUID REFERENCES price_catalog(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (price_id, mood_tag_id)
);

-- (C) 가문/조직 재정(갈등 엔진)
CREATE TABLE IF NOT EXISTS household_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    org_name TEXT NOT NULL,                  -- 예: 독고세가
    monthly_income_mun BIGINT,               -- 월 수익(문)
    monthly_fixed_cost_mun BIGINT,           -- 월 고정 지출(문)
    monthly_net_mun BIGINT,                  -- 월 순수익(문)
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_budget_org_per_series UNIQUE (series_id, org_name)
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    org_name TEXT NOT NULL,                  -- 예: 독고세가
    expense_name TEXT NOT NULL,              -- 예: 독고준 한달 약값, 무사 월급
    monthly_cost_mun BIGINT,
    story_use TEXT,                          -- 예: 후처 장부 던지기 대사

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_recurring_expense_per_series UNIQUE (series_id, org_name, expense_name)
);

-- (D) 호칭/화법(관계의 선) - 기존 terminology로도 가능하지만, “대사 엔진”용으로 분리
CREATE TABLE IF NOT EXISTS honorific_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    scope TEXT NOT NULL,                     -- family/murim/official/self/idiom
    target TEXT,                             -- 예: 아버지/새어머니/장문인/관군
    formal_form TEXT,                        -- 공석 호칭(예: 가주님)
    informal_form TEXT,                      -- 사석 호칭(예: 아버님)
    nuance TEXT,                             -- 뉘앙스/숨은 뜻
    example_lines TEXT,                      -- 예시 대사(짧게)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_honorific_rule_per_series UNIQUE (series_id, scope, target, formal_form, informal_form)
);

-- (E) 강호 은어/관용구(대사 맛) - slang/idiom/시간거리 표현 등
CREATE TABLE IF NOT EXISTS slang_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    category TEXT NOT NULL,                  -- insult/idiom/time_distance/status_effect/etc
    term TEXT NOT NULL,                      -- 예: 찰나, 일각, 쥐새끼, 강호의 도리
    hanja TEXT,
    meaning TEXT,
    example_lines TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_slang_term_per_series UNIQUE (series_id, category, term)
);

-- (F) 병기/명검/암기(아이템 엔진)
CREATE TABLE IF NOT EXISTS weapons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                      -- 예: 자소검, 천광검, 백우선
    hanja TEXT,
    weapon_type TEXT,                        -- sword/sabre/spear/fan/needle/hidden_weapon
    tier TEXT,                               -- 고철/양품/명품/영물/신물 등
    material TEXT,                           -- 예: 백련강/한철/현철
    faction_owner TEXT,                      -- 예: 화산/남궁/당가/마교/황실
    region TEXT,

    abilities TEXT,                          -- 능력/속성(뇌전/환영/흡혈 등)
    visual TEXT,                             -- 비주얼 묘사 포인트
    backstory TEXT,                          -- 숨은 사연/쟁탈전 떡밥
    price_note TEXT,                         -- 스토리 표기용

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_weapon_per_series UNIQUE (series_id, name)
);

CREATE TABLE IF NOT EXISTS weapon_mood_tags (
    weapon_id UUID REFERENCES weapons(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (weapon_id, mood_tag_id)
);

-- (G) 절기/명절/계절 이벤트(시간이 “쌓이게” 만드는 장치)
CREATE TABLE IF NOT EXISTS seasonal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    season TEXT,                             -- spring/summer/autumn/winter
    name TEXT NOT NULL,                      -- 예: 춘절, 청명, 단오, 중추절, 동지
    hanja TEXT,
    lunar_date TEXT,                         -- 예: 1/1, 4월 초(자유 표기)

    weather_mood TEXT,                       -- 예: 청명=비, 대설=폭설, 삼복=찜통
    foods TEXT,                              -- 예: 교자, 월병, 팥죽
    customs TEXT,                            -- 예: 등미, 용선경주, 성묘
    scene_hooks TEXT,                        -- 사건 포인트(스토리 훅)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_seasonal_event_per_series UNIQUE (series_id, name)
);

CREATE TABLE IF NOT EXISTS seasonal_event_mood_tags (
    seasonal_event_id UUID REFERENCES seasonal_events(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (seasonal_event_id, mood_tag_id)
);

-- (H) 생활도구/잡화(리얼리티 소품) - 병자/문방/조명/위생/여행템
CREATE TABLE IF NOT EXISTS props (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    category TEXT NOT NULL,                  -- medical/stationery/light/hygiene/travel/etc
    name TEXT NOT NULL,                      -- 예: 수로, 약탕기, 은침, 야명주
    description TEXT,                        -- 용도/작동 원리
    sensory_notes TEXT,                      -- 냄새/소리/질감
    price_note TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_prop_per_series UNIQUE (series_id, category, name)
);

CREATE TABLE IF NOT EXISTS prop_mood_tags (
    prop_id UUID REFERENCES props(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (prop_id, mood_tag_id)
);

-- (J) 여정/객잔/골목 “조우 훅(양념)” 데이터
-- 목적:
-- - 대표님 요청: 여행/객잔에서 사파(하오문/녹림/수로채 등)와
--   마교(옛 부하/첩자)가 “오징어 땅콩 같은 감초”로 자연스럽게 등장하도록
--   장면 훅을 DB에서 추천받아 AI가 꺼내 쓰게 만든다.
-- - ⚠️ 초반(10살/병약)에는 술/주점이 금지이므로, 훅 자체에도 안전장치를 둔다.
CREATE TABLE IF NOT EXISTS story_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES novel_series(id) ON DELETE CASCADE,

    -- 어디서/언제 마주치는가
    trigger TEXT NOT NULL,                   -- 예: inn(객잔), alley(골목), checkpoint(관문), river(나루터/배), market(장터)
    region TEXT,                             -- 예: 중원/사천/강남/북방/전 지역 (자유 텍스트)
    season TEXT,                             -- 예: 봄/여름/가을/겨울 (선택)
    tier TEXT,                               -- 예: 하/중/상 또는 서민/중/상 (선택)

    -- 누구와 마주치는가
    faction TEXT NOT NULL,                   -- 예: 하오문, 녹림, 장강수로채, 살막, 마교(첩자), 혈교 등
    org_name TEXT,                           -- 예: 하오문 분타, 녹림칠십이채, 장강수로채

    -- 장면을 바로 꺼내 쓰기 위한 “훅”
    hook_title TEXT NOT NULL,                -- 예: "점소이의 손신호", "고개 통행세", "강 위의 밀수 거래"
    scene_hook TEXT NOT NULL,                -- 2~6문장 분량의 장면 템플릿(대사/행동 포함 가능)
    negotiation_angle TEXT,                  -- 예: 정보값/통행세/물류 계약/협박 포인트
    sensory_food TEXT,                       -- 예: 따뜻한 차, 죽, 호박씨, 전병(초반 안전)
    sensory_drink TEXT,                      -- 예: 차/맹물/후반에는 소흥주 가능(초반은 금지)

    -- 안전/밸런스
    danger_level INTEGER DEFAULT 1,          -- 1(가벼움)~5(살벌함)
    early_safe BOOLEAN DEFAULT TRUE,         -- 초반(1~30화)에도 무리 없는 훅인가?
    allow_alcohol BOOLEAN DEFAULT FALSE,     -- 술/주점 연출을 포함해도 되는가?
    min_episode INTEGER,                     -- 선택: 이 회차 이후에만 추천(예: 31)
    max_episode INTEGER,                     -- 선택: 이 회차까지 추천(예: 100)

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_story_encounter_per_series UNIQUE (series_id, faction, trigger, hook_title)
);

CREATE TABLE IF NOT EXISTS story_encounter_mood_tags (
    story_encounter_id UUID REFERENCES story_encounters(id) ON DELETE CASCADE,
    mood_tag_id UUID REFERENCES mood_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (story_encounter_id, mood_tag_id)
);

-- (I) 인덱스(조회 최적화)
CREATE INDEX IF NOT EXISTS idx_economy_rules_series ON economy_rules(series_id);
CREATE INDEX IF NOT EXISTS idx_price_catalog_series ON price_catalog(series_id);
CREATE INDEX IF NOT EXISTS idx_household_budgets_series ON household_budgets(series_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_series ON recurring_expenses(series_id);
CREATE INDEX IF NOT EXISTS idx_honorific_rules_series ON honorific_rules(series_id);
CREATE INDEX IF NOT EXISTS idx_slang_terms_series ON slang_terms(series_id);
CREATE INDEX IF NOT EXISTS idx_weapons_series ON weapons(series_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_events_series ON seasonal_events(series_id);
CREATE INDEX IF NOT EXISTS idx_props_series ON props(series_id);
CREATE INDEX IF NOT EXISTS idx_story_encounters_series ON story_encounters(series_id);

-- ============================================================================
-- 4-9. 스토리 소품 “자동 추천” 함수 (DB → 프롬프트 꾸러미)
-- ============================================================================
-- 목적:
-- - 한 장면(지역/무드/등급/계절)에 맞는 “음식/객잔/여정/약/독/무공/돈/호칭/병기/절기/은어/생활도구”를
--   묶음으로 추천한다.
-- - AI 작가가 “재료를 반드시 쓰게” 만들기 위한 입력(JSON)으로 사용한다.
--
-- 주의:
-- - 이 함수는 “추천”만 한다. (RLS/권한은 실제 앱 연결 방식 확정 후 정책으로 강화)
-- - 무작위(random())는 스토리 다양성을 위해 사용한다.

create or replace function recommend_story_assets(
  p_series_id uuid,
  p_region text,
  p_mood_slug text,
  p_tier text default null,
  p_season text default null,
  p_episode integer default null
) returns jsonb
language sql
stable
as $$
select jsonb_build_object(
  'mood', p_mood_slug,
  'region', p_region,
  'tier', p_tier,
  'season', p_season,
  'episode', p_episode,

  -- 음식(3)
  'foods', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select f.name, f.tier, f.region, f.category, f.ingredients, f.taste_notes, f.sensory_notes, f.cooking_notes
      from foods f
      join food_mood_tags fmt on fmt.food_id = f.id
      join mood_tags mt on mt.id = fmt.mood_tag_id
      where f.series_id = p_series_id
        and mt.slug = p_mood_slug
        and (p_region is null or f.region ilike '%'||p_region||'%')
        and (p_tier is null or f.tier = p_tier)
      order by random()
      limit 3
    ) x
  ),

  -- 객잔(2)
  'inns', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select i.name, i.tier, i.region, i.atmosphere, i.bed_quality, i.hygiene, i.price_note, i.typical_customers
      from inns i
      join inn_mood_tags imt on imt.inn_id = i.id
      join mood_tags mt on mt.id = imt.mood_tag_id
      where i.series_id = p_series_id
        and mt.slug = p_mood_slug
        and (p_region is null or i.region ilike '%'||p_region||'%')
        and (p_tier is null or i.tier = p_tier)
      order by random()
      limit 2
    ) x
  ),

  -- 여정(2)
  'routes', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select r.name, r.route_steps, r.typical_days_min, r.typical_days_max, r.season_notes, r.hazards
      from travel_routes r
      join travel_route_mood_tags rmt on rmt.travel_route_id = r.id
      join mood_tags mt on mt.id = rmt.mood_tag_id
      where r.series_id = p_series_id
        and mt.slug = p_mood_slug
      order by random()
      limit 2
    ) x
  ),

  -- 약(2)
  'medicines', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select m.name, m.hanja, m.tier, m.category, m.faction, m.region, m.taste_scent_texture, m.visual_reaction, m.effects, m.side_effects, m.dosage_notes, m.price_note, m.rarity
      from medicines m
      left join medicine_mood_tags mmt on mmt.medicine_id = m.id
      left join mood_tags mt on mt.id = mmt.mood_tag_id
      where m.series_id = p_series_id
        and (p_region is null or m.region ilike '%'||p_region||'%' or m.region ilike '%전 지역%')
        and (p_tier is null or m.tier = p_tier)
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
      order by random()
      limit 2
    ) x
  ),

  -- 독(1)
  'poisons', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select p.name, p.hanja, p.category, p.faction, p.region, p.symptoms, p.detection, p.antidote, p.severity
      from poisons p
      left join poison_mood_tags pmt on pmt.poison_id = p.id
      left join mood_tags mt on mt.id = pmt.mood_tag_id
      where p.series_id = p_series_id
        and (p_region is null or p.region ilike '%'||p_region||'%' or p.region is null)
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
      order by random()
      limit 1
    ) x
  ),

  -- 영약(1)
  'elixirs', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select e.name, e.hanja, e.tier, e.region, e.obtain_conditions, e.effects, e.overload_risk, e.story_use
      from elixirs e
      left join elixir_mood_tags emt on emt.elixir_id = e.id
      left join mood_tags mt on mt.id = emt.mood_tag_id
      where e.series_id = p_series_id
        and (p_region is null or e.region ilike '%'||p_region||'%')
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
      order by random()
      limit 1
    ) x
  ),

  -- 무공/초식(2)
  'moves', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select s.name as style_name, s.hanja as style_hanja, s.faction, s.element,
             mv.name as move_name, mv.hanja as move_hanja, mv.stage, mv.power_rank, mv.visual, mv.effect, mv.cost
      from martial_art_moves mv
      left join martial_art_styles s on s.id = mv.style_id
      left join martial_art_move_mood_tags mvt on mvt.move_id = mv.id
      left join mood_tags mt on mt.id = mvt.mood_tag_id
      where mv.series_id = p_series_id
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
      order by random()
      limit 2
    ) x
  ),

  -- 돈/가격(3)
  'prices', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select pc.category, pc.item_name, pc.region, pc.tier, pc.price_min_mun, pc.price_max_mun, pc.price_note, pc.rarity, pc.where_to_get, pc.story_use
      from price_catalog pc
      left join price_mood_tags pmt on pmt.price_id = pc.id
      left join mood_tags mt on mt.id = pmt.mood_tag_id
      where pc.series_id = p_series_id
        and (p_region is null or pc.region ilike '%'||p_region||'%' or pc.region is null)
        and (p_tier is null or pc.tier = p_tier or pc.tier is null)
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
      order by random()
      limit 3
    ) x
  ),

  -- 호칭(3)
  'honorifics', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select hr.scope, hr.target, hr.formal_form, hr.informal_form, hr.nuance, hr.example_lines
      from honorific_rules hr
      where hr.series_id = p_series_id
      order by random()
      limit 3
    ) x
  ),

  -- 은어/관용구(5)
  'slang', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select st.category, st.term, st.hanja, st.meaning, st.example_lines
      from slang_terms st
      where st.series_id = p_series_id
      order by random()
      limit 5
    ) x
  ),

  -- 병기/명검(2)
  'weapons', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select w.name, w.hanja, w.weapon_type, w.tier, w.material, w.faction_owner, w.region, w.abilities, w.visual, w.backstory, w.price_note
      from weapons w
      left join weapon_mood_tags wmt on wmt.weapon_id = w.id
      left join mood_tags mt on mt.id = wmt.mood_tag_id
      where w.series_id = p_series_id
        and (p_region is null or w.region ilike '%'||p_region||'%' or w.region is null)
        and (p_tier is null or w.tier = p_tier or w.tier is null)
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
      order by random()
      limit 2
    ) x
  ),

  -- 절기/명절(1) - season 파라미터가 있으면 우선 반영
  'seasonal_events', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select se.season, se.name, se.hanja, se.lunar_date, se.weather_mood, se.foods, se.customs, se.scene_hooks
      from seasonal_events se
      left join seasonal_event_mood_tags semt on semt.seasonal_event_id = se.id
      left join mood_tags mt on mt.id = semt.mood_tag_id
      where se.series_id = p_series_id
        and (p_season is null or se.season = p_season)
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
      order by random()
      limit 1
    ) x
  ),

  -- 여정/객잔/골목 조우 훅(2)
  'encounters', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select
        se.trigger,
        se.region,
        se.season,
        se.tier,
        se.faction,
        se.org_name,
        se.hook_title,
        se.scene_hook,
        se.negotiation_angle,
        se.sensory_food,
        se.sensory_drink,
        se.danger_level,
        se.early_safe,
        se.allow_alcohol
      from story_encounters se
      left join story_encounter_mood_tags semt on semt.story_encounter_id = se.id
      left join mood_tags mt on mt.id = semt.mood_tag_id
      where se.series_id = p_series_id
        and (p_region is null or se.region ilike '%'||p_region||'%' or se.region ilike '%전 지역%' or se.region is null)
        and (p_season is null or se.season = p_season or se.season is null)
        and (p_tier is null or se.tier = p_tier or se.tier is null)
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
        -- 회차 기반 안전장치(앱이 p_episode를 넘기면 더 정확해짐; 안 넘겨도 동작)
        and (p_episode is null or se.min_episode is null or p_episode >= se.min_episode)
        and (p_episode is null or se.max_episode is null or p_episode <= se.max_episode)
        -- 초반(1~30)은 ‘early_safe=true’만 추천(술/주점 포함 훅은 제외)
        and (p_episode is null or p_episode > 30 or se.early_safe = true)
      order by random()
      limit 2
    ) x
  ),

  -- 생활도구(3)
  'props', (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select pr.category, pr.name, pr.description, pr.sensory_notes, pr.price_note
      from props pr
      left join prop_mood_tags pmt on pmt.prop_id = pr.id
      left join mood_tags mt on mt.id = pmt.mood_tag_id
      where pr.series_id = p_series_id
        and (p_mood_slug is null or mt.slug = p_mood_slug or mt.slug is null)
      order by random()
      limit 3
    ) x
  )
);
$$;

-- ============================================================================
-- 4-10. 시드 데이터(대표님 “대작 엔진” 최소 세트)
-- ============================================================================
-- 목표:
-- - 대표님이 모아주신 “돈/호칭/은어/금지룰/절단패턴”을 DB에 꽂아
--   AI가 장면마다 자동으로 꺼내 쓰게 만든다.
-- - 이 구간은 “샘플”이 아니라, 실제 운영(정본)으로 써도 되게 UPSERT로 구성한다.
--
-- 사용법(대표님 Supabase SQL Editor):
-- - 테이블 생성(4-3) + 함수(4-9)까지 실행한 다음, 이 구간(4-10)만 실행하면 됨.
-- - 여러 번 실행해도 중복 에러가 나지 않도록 ON CONFLICT 처리됨.

do $$
declare
  v_series uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
begin
  -- --------------------------------------------------------------------------
  -- (A) 경제 규칙/가격표 (데이터 03 핵심)
  -- --------------------------------------------------------------------------
  insert into economy_rules (series_id, rule_name, rule_text, notes)
  values
    (v_series, '기본 환율', '1냥 = 1,000문, 1금 = 은 20냥 내외(=20,000문)', 'DB 계산은 “문(文)” 기준으로 통일(표기용 텍스트는 price_note에 저장)'),
    (v_series, '체감 환산(원화)', '1냥 ≈ 50만원 체감(고정)', '원화는 독자 체감용. 스토리 내부 일관성은 문/냥/금으로 유지')
  on conflict (series_id, rule_name) do update set
    rule_text = excluded.rule_text,
    notes = excluded.notes;

  -- 가격표: 문(文) 기준으로 숫자화
  insert into price_catalog (series_id, category, item_name, region, tier, price_min_mun, price_max_mun, price_note, rarity, where_to_get, story_use)
  values
    -- 식비
    (v_series,'food','왕만두 1개',null,'서민',2,2,'2문','common','객잔/노점','서민 한 끼/가난 체감'),
    (v_series,'food','객잔 국수(고기X)',null,'서민',5,8,'5~8문','common','객잔','여행 중 기본식'),
    (v_series,'food','객잔 국수(고기O)',null,'서민~중',15,20,'15~20문','common','객잔','든든한 한 끼/동행 결속'),
    (v_series,'food','소흥주 1병(일반술)',null,'서민~중',30,50,'30~50문','common','객잔/주점','정보/실언/분위기'),
    (v_series,'food','소고기 장육(안주)',null,'중',100,100,'100문(은 0.1냥)','uncommon','객잔/주점','접대/허세/긴장'),
    (v_series,'food','고급 요리상(4인)',null,'상',3000,5000,'은자 3~5냥','rare','상급 객잔/연회','정치/접대'),
    (v_series,'food','만한전석(황실)',null,'전설',2000000,2000000,'금자 100(=은 2,000냥)','legendary','황실','권력 과시/격차 연출'),

    -- 숙박
    (v_series,'lodging','마구간/헛간 1박',null,'하',5,10,'5~10문','common','마구간/헛간','최저 생활/비참함'),
    (v_series,'lodging','객잔 다인실(도미토리) 1박',null,'하',30,30,'30문','common','객잔','벼룩/소문/사건'),
    (v_series,'lodging','객잔 일반실(천자호) 1박',null,'중',100,500,'100문~은 0.5냥(=500문)','uncommon','객잔','표준 숙박'),
    (v_series,'lodging','객잔 특실(독채) 1박',null,'상',2000,5000,'은자 2~5냥','rare','상급 객잔','접대/신분 과시'),

    -- 무기/장비
    (v_series,'weapon','싸구려 철검',null,'하',1000,2000,'은자 1~2냥','common','동네 대장간','잡졸/초반 빈곤'),
    (v_series,'weapon','백련강검(쓸만한 검)',null,'상',20000,50000,'은자 20~50냥','rare','장인 대장간/경매','일류 장비/평생 무기'),
    (v_series,'weapon','명검(이름 있는 검)',null,'전설',1000000,null,'금자 50 이상(=1,000,000문+)', 'legendary','경매/가보','쟁탈전(에피소드 엔진)'),
    (v_series,'weapon','비수(단검)',null,'중',5000,5000,'은자 5냥','uncommon','대장간/암시장','암살/호신'),
    (v_series,'weapon','무복(도복/전투복)',null,'중',1000,2000,'은자 1~2냥','common','상단/재단','현실 장비/소모품'),

    -- 이동/수단
    (v_series,'logistics','노새/당나귀 1필',null,'중',5000,5000,'은자 5냥','uncommon','마시장/역참','짐 운반/절약'),
    (v_series,'logistics','일반 말(전마) 1필',null,'상',20000,30000,'은자 20~30냥','rare','마시장/역참','기동력/전투 준비'),
    (v_series,'logistics','명마(적토마급) 1필',null,'전설',2000000,null,'금자 100 이상(=2,000,000문+)', 'legendary','가문 가보/경매','신분/격'),
    (v_series,'logistics','마차(고급)',null,'상',100000,100000,'은자 100냥','rare','마차 공방/상단','원정/이동 본거지'),

    -- 정보/용역
    (v_series,'info','개방 정보(소문)',null,'중',1000,5000,'은자 1~5냥','uncommon','개방/주점','동선 파악/복선'),
    (v_series,'info','개방 정보(비밀)',null,'상',200000,null,'금자 10 이상(=200,000문+)', 'rare','개방/암거래','약점/보물지도/정치'),
    (v_series,'info','살수 의뢰(삼류)',null,'중',10000,50000,'은자 10~50냥','uncommon','암시장/사파','동네 처리/갈등'),
    (v_series,'info','살수 의뢰(일류)',null,'전설',1000000,null,'금자 50 이상(=1,000,000문+)', 'legendary','암시장/조직','대형 사건'),
    (v_series,'info','표국 의뢰(호위)',null,'중',null,null,'물품가의 10%','uncommon','표국','원정/이동 이벤트')
  on conflict (series_id, category, item_name) do update set
    region = excluded.region,
    tier = excluded.tier,
    price_min_mun = excluded.price_min_mun,
    price_max_mun = excluded.price_max_mun,
    price_note = excluded.price_note,
    rarity = excluded.rarity,
    where_to_get = excluded.where_to_get,
    story_use = excluded.story_use;

  -- 독고세가 재정(갈등 엔진): 금자100=은2000=2,000,000문 / 금자80=1,600,000문 / 금자20=400,000문
  insert into household_budgets (series_id, org_name, monthly_income_mun, monthly_fixed_cost_mun, monthly_net_mun, notes)
  values
    (v_series,'독고세가',2000000,1600000,400000,'월 순수익의 75%가 독고준 약값으로 소모되는 구조(갈등 엔진)')
  on conflict (series_id, org_name) do update set
    monthly_income_mun = excluded.monthly_income_mun,
    monthly_fixed_cost_mun = excluded.monthly_fixed_cost_mun,
    monthly_net_mun = excluded.monthly_net_mun,
    notes = excluded.notes;

  -- 독고준 한 달 약값: 은자 300냥 = 300,000문
  insert into recurring_expenses (series_id, org_name, expense_name, monthly_cost_mun, story_use)
  values
    (v_series,'독고세가','독고준 한 달 약값',300000,'후처 “장부 던지기” 대사의 숫자 근거 + 형제들의 증오를 현실로 만든다')
  on conflict (series_id, org_name, expense_name) do update set
    monthly_cost_mun = excluded.monthly_cost_mun,
    story_use = excluded.story_use;

  -- --------------------------------------------------------------------------
  -- (B) 호칭/말투(데이터 04 핵심) - 대표님이 주신 샘플을 DB에 고정
  -- --------------------------------------------------------------------------
  insert into honorific_rules (series_id, scope, target, formal_form, informal_form, nuance, example_lines)
  values
    (v_series,'family','아버지','가주님','아버님','공석=권력/사석=부정(父情)','"가주님, 소자가 실수를 했습니다." / "아버님… 죄송합니다."'),
    (v_series,'family','새어머니(모용혜)','안주인 마님/부인','어머니','독고준은 억지로 “어머니”라 부르나, 상대는 혐오/지배','"소가주께서는 들어가 계세요."'),
    (v_series,'family','독고준(자칭)','소자','저/제가','피해자/겸손 연기(겉말) 장치','"송구합니다, 소자… 몸이 약하여…"'),
    (v_series,'family','독고준(타칭)','소가주','도련님/준아','직함은 압박/비꼼에도 쓰인다','"소가주께서는 빠지세요."'),
    (v_series,'murim','상대(존중)','대협','대협','무난한 극존칭','"대협, 구앙하오이다."'),
    (v_series,'murim','젊은 무인(존중)','소협','소협','젊은 영웅 호칭','"소협의 검이 고명하다 들었소."'),
    (v_series,'murim','장문인','장문인','장문인','문파 대표(CEO)급 호칭','"화산 장문인께 문안을 올립니다."'),
    (v_series,'official','관아 관리','대인/나으리','나으리','건드리면 큰일 나는 “공권력”의 무게','"대인, 억울합니다."')
  on conflict (series_id, scope, target, formal_form, informal_form) do update set
    nuance = excluded.nuance,
    example_lines = excluded.example_lines;

  -- --------------------------------------------------------------------------
  -- (C) 은어/관용구/금지룰 (데이터 08 + “하차 방지”)
  -- --------------------------------------------------------------------------
  insert into slang_terms (series_id, category, term, hanja, meaning, example_lines)
  values
    -- 시간/거리(몰입 유지)
    (v_series,'time_distance','찰나','刹那','눈 깜빡할 새(아주 짧은 시간)','"생과 사가 찰나에 갈렸다."'),
    (v_series,'time_distance','일각','一刻','약 15분','"일각 안에 끝내주마."'),
    (v_series,'time_distance','식경','食頃','밥 한 끼 먹을 시간(30분~1시간)','"식경이면 충분하다."'),
    (v_series,'time_distance','시친','時辰','2시간 단위','"한 시친만 더 쉬고 출발한다."'),
    (v_series,'time_distance','장','丈','약 3m','"기세가 십 장 밖까지 뻗쳤다."'),
    (v_series,'time_distance','리','里','약 400m','"천 리 길도 한 걸음부터."'),

    -- 도발/욕설(강호 맛)
    (v_series,'insult','애송이',null,'경험 없는 꼬맹이','"애송이 주제에."'),
    (v_series,'insult','젖비린내',null,'어린 티가 나는 초짜','"젖비린내가 진동하는군."'),
    (v_series,'insult','서배','鼠輩','쥐새끼 같은 비겁한 무리','"서배 같은 놈들."'),
    (v_series,'insult','필부','匹夫','무식한 놈/평범한 놈','"필부 따위가 감히."'),

    -- 명분(싸움의 이유)
    (v_series,'justification','강호의 도리','江湖道義','쪽수/폭력을 정당화하는 무림식 명분','"강호의 도리가 땅에 떨어졌구나!"'),
    (v_series,'justification','비무','比武','죽이려는 게 아니라 실력 겨루기(명분)','"비무를 청하오."'),
    (v_series,'justification','생사결','生死決','둘 중 하나가 죽어야 끝나는 결투','"생사결로 끝내자."'),

    -- 파워업 납득(“증거” 대사)
    (v_series,'powerup_logic','경험','經驗','천마의 “횟수/경험”이 승리 근거가 된다','"1만 번 베어본 자는 검을 보지 않는다."'),
    (v_series,'powerup_logic','관찰','觀察','상대 패턴/호흡의 빈틈을 읽는다','"3초식과 4초식 사이, 호흡이 끊긴다."'),
    (v_series,'powerup_logic','효율','效率','힘이 약하면 낭비를 없애 급소만 친다','"1의 힘으로 급소만 찌른다."'),

    -- 장부/정치(대표님 차별화 엔진)
    (v_series,'business_dialogue','재고 불일치',null,'장부와 창고 입고량 불일치로 횡령을 찌른다','"장부상 30근인데, 창고엔 20근입니다."'),
    (v_series,'business_dialogue','시세 후려치기',null,'시장 시세 대비 과다 지출을 찌른다','"시세가 1냥인데, 왜 3냥에 샀습니까?"'),
    (v_series,'business_dialogue','먹칠 흔적',null,'장부 조작(최근 작성) 증거를 잡는다','"먹물이 너무 새것이군요."'),

    -- 금지 룰(하차 방지)
    (v_series,'red_line','현대어(대사) 금지',null,'입 밖 대사에 OK/팩트체크/아메리카노 등 현대어 금지(독백은 최소 허용)','"입 밖 대사: 현대어 금지 / 속생각: 제한적 허용"'),
    (v_series,'red_line','경제 관념 붕괴 금지',null,'돈 단위/팁/여비가 설정과 충돌하면 즉시 하차 포인트','"은자 1냥=50만원 체감. 팁으로 1냥? 금지."'),
    (v_series,'red_line','설정 점프 금지',null,'병약/무공 단계/이동 시간이 갑자기 뛰면 신뢰 붕괴','"3화 걷지도 못했는데 5화 벽타기? 금지."'),
    (v_series,'red_line','패턴 반복 금지',null,'무시→참교육 반복은 변주 없으면 하차','"정치/경영/미스터리/여정으로 변주"')
  on conflict (series_id, category, term) do update set
    hanja = excluded.hanja,
    meaning = excluded.meaning,
    example_lines = excluded.example_lines;

  -- --------------------------------------------------------------------------
  -- (D) 사파/마교 “조우 훅(양념)” (대표님 데이터 14~16 기반, 초반 안전 버전 포함)
  -- --------------------------------------------------------------------------
  insert into story_encounters (
    series_id, trigger, region, season, tier, faction, org_name, hook_title,
    scene_hook, negotiation_angle, sensory_food, sensory_drink,
    danger_level, early_safe, allow_alcohol, min_episode, max_episode, notes
  )
  values
    -- 초반(1~30)도 안전: 하오문(정보) - 술 없이 “차/죽/호박씨”로 분위기만
    (v_series,'inn','중원',null,'중','하오문','하오문 분타','점소이의 손신호',
     '객잔 점소이가 찻주전자 뚜껑을 한 번, 두 번 두드렸다. 아무도 못 알아차렸지만, 그 소리는 “거래 가능”이란 암호였다. 독고준 일행은 따뜻한 차와 볶은 호박씨를 앞에 두고, 값비싼 말 대신 값싼 한 마디로 정보를 샀다.',
     '정보값(동전/은자) + “입 다물기” 거래',
     '따뜻한 차, 볶은 호박씨, 미음/죽','차',
     2,true,false,1,100,'초반 감초용(술/주점 금지 준수)'),

    -- 초반 안전: 마교(첩자) - “옛 회사의 냄새”만 살짝
    (v_series,'inn','전 지역',null,'중','마교(첩자)','천마신교 잔당','젓가락의 각도',
     '점소이는 젓가락을 탁자에 비스듬히 놓았다. 그 각도 하나에 “본산”의 규율이 숨어 있었다. 독고준은 대답 대신, 약탕에서 올라오는 하얀 김을 손끝으로 한 번 흩트렸다. 점소이의 눈이 흔들렸다.',
     '수신호/암호로 “내 편인지” 확인',
     '약탕 냄새, 따뜻한 물수건','맹물/차',
     2,true,false,1,200,'초반엔 정체를 드러내지 않는 방식'),

    -- 여정 감초: 녹림(통행세) - 협상/경영 포인트
    (v_series,'checkpoint','중원',null,'서민~중','녹림','녹림칠십이채','고개 통행세',
     '산길 고개에서 사내들이 길을 막았다. 칼보다 먼저 나온 건 “통행세 장부”였다. 독고준 쪽은 돈을 내기보다, 오늘 지나갈 상단의 물량과 날짜를 짚어 “여기서 뜯으면 내일 더 못 번다”는 계산으로 협상을 걸었다.',
     '통행세를 “계약”으로 바꾸기(경영/협상)',
     '전병, 만두, 말린 육포(초반은 연출만)','차/맹물',
     3,true,false,10,200,'돈/물류/통행세 갈등 엔진'),

    -- 후반 감초(술 가능): 녹림 회식(31화 이후)
    (v_series,'inn','중원',null,'중','녹림','녹림채','술 대신 약속',
     '거친 사내들이 고기 냄새 나는 방에 둘러앉았다. 술잔이 오가지만, 진짜 거래는 잔이 아니라 “호위 계약서”에 찍히는 인장이었다. 독고준은 마시지 않고도 분위기를 장악했다.',
     '용역/호위 계약(하청 업체화)',
     '양다리 구이, 뜨거운 국물','소흥주(성인 구간)',
     3,false,true,31,999,'31화 이후 사용(술/주점 톤 허용 구간)'),

    -- 수로채(물류/밀수) - 물류 에피소드
    (v_series,'river','강남',null,'중','장강수로채','장강수로채','나루터의 물류 계약',
     '나루터에서 배가 떠나기 전, 수적들은 칼을 뽑지 않았다. 대신 운송료와 일정표를 내밀었다. 독고준 쪽은 “배 한 척”이 아니라 “노선”을 샀고, 그 순간부터 강 위의 소문이 방향을 바꿨다.',
     '운송료/노선/밀수 라인 협상(물류)',
     '생선면, 따뜻한 죽','차/맹물',
     3,true,false,20,200,'초반도 가능(술 없이 물류로 풀기)'),

    -- 살막/암살(초반엔 과격하므로 early_safe=false)
    (v_series,'alley','전 지역',null,'중','살막','흑도/살막','그림자 의뢰서',
     '골목의 어둠 속에서 종이 한 장이 미끄러져 나왔다. “선금, 그리고 이름.” 누가 누구를 노리는지, 그 종이엔 숫자만 적혀 있었다. 독고준은 칼보다 먼저 “돈의 흐름”을 보았다.',
     '의뢰/선금/정보로 역추적',
     '차가운 차, 식은 만두','없음',
     4,false,false,31,999,'초반(10살)엔 과격하므로 31화 이후 추천');
  -- mood_tags가 아직 비어 있어도 추천은 동작한다(LEFT JOIN + NULL 허용). 필요하면 추후 태깅.
end $$;

-- ============================================================================
-- 5. 샘플 데이터 (독고천마 세계관)
-- ============================================================================

-- 캐릭터 샘플 데이터
INSERT INTO character_profiles (series_id, name, role, appearance, personality, signature_move, voice_tone, image_prompt)
VALUES 
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  -- 독고천마 시리즈 ID
    '독고준',
    '주인공',
    '30대 중반, 검은 도포, 허리까지 내려오는 흑발, 냉혹한 붉은 눈동자, 날카로운 인상',
    '냉정하고 잔혹하지만 충신에게는 따뜻함. 배신자에게는 절대 용서 없음. 복수를 위해 모든 것을 버릴 각오',
    '천마혈인검(天魔血刃劍) - 붉은 검기가 하늘을 가르는 절대 무공',
    '낮고 차갑지만 카리스마 있는 음성',
    'Korean martial arts master, 30s male, black traditional robe, long black hair, red eyes, cold expression, demonic aura, manhwa style, high quality, dramatic lighting'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '독고진',
    '조연',
    '20대 후반, 회색 무복, 짧은 흑발, 충직한 눈빛, 강인한 체격',
    '절대적인 충성심, 정직하고 강직함, 주인을 위해 목숨도 기꺼이 바침',
    '철갑마공(鐵甲魔功) - 강철 같은 방어 무공',
    '중후하고 안정적인 음성',
    'Korean martial arts warrior, loyal guard, 20s male, gray uniform, short black hair, strong build, determined eyes, manhwa style'
)
ON CONFLICT (series_id, name) DO NOTHING;
-- [중요] 이미 같은 캐릭터가 DB에 있으면(=운영 중이면) 중복 에러가 날 수 있습니다.
-- 이 스키마 파일을 재실행해도 안전하도록 "있으면 건너뛰기" 처리(덮어쓰지 않음).
-- 참고: 실제 운영 데이터(정본)는 대시보드/별도 seed로 관리하세요.
-- (Supabase SQL Editor에서는 INSERT 구문을 아래처럼 바꿔 실행하면 됩니다.)
-- ON CONFLICT (series_id, name) DO NOTHING;

-- 장소 샘플 데이터
INSERT INTO locations (series_id, name, description, atmosphere, image_prompt)
VALUES 
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '독고가 본가',
    '거대한 흑색 석조 건물. 높은 담장과 붉은 기와. 정문에는 천마상(天魔像)이 서 있음',
    '엄숙하고 살벌한 분위기. 하인들조차 숨죽이며 걷는 곳',
    'Ancient Korean martial arts manor, black stone architecture, red tile roof, demon statue at gate, ominous atmosphere, traditional architecture, dramatic sky, manhwa background'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '혈마동굴',
    '독고준이 30년간 주화입마 상태로 갇혀있던 비밀 수련장. 어둡고 습하며 벽면에 검흔이 무수히 새겨져 있음',
    '고요하지만 압도적인 살기가 서려있음. 촛불 하나만이 희미하게 타오름',
    'Dark cave interior, martial arts training ground, sword marks on walls, single candle light, mysterious atmosphere, Korean traditional cave, manhwa background'
)
ON CONFLICT (series_id, name) DO NOTHING;
-- ON CONFLICT (series_id, name) DO NOTHING;

-- 용어 샘플 데이터
INSERT INTO terminology (series_id, term, category, meaning, first_appearance)
VALUES 
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '천마혈인검',
    '무공',
    '독고가의 최고 절학. 붉은 검기가 하늘을 가르며 적의 혈맥을 꿰뚫는 마도 검법',
    1
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '주화입마',
    '상태',
    '내공 수련 중 잘못되어 정신이 혼미해지고 폭주하는 상태. 심하면 죽음에 이름',
    1
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '독고가',
    '조직',
    '무림 최강의 마도 가문. 천마의 후예들이 대대로 이끌어온 세력',
    1
)
ON CONFLICT (series_id, term) DO NOTHING;
-- ON CONFLICT (series_id, term) DO NOTHING;

-- ============================================================================
-- 완료!
-- 이 SQL을 Supabase SQL Editor에 붙여넣기하여 실행하세요.
-- ============================================================================
