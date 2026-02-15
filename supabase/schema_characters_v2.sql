-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Novel Alchemist - Characters Table (완벽 버전)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 🔥 기존 테이블 삭제 (충돌 방지)
DROP TABLE IF EXISTS characters CASCADE;

CREATE TABLE IF NOT EXISTS characters (
  -- ═══════════════════════════════════════════════
  -- 기본 정보
  -- ═══════════════════════════════════════════════
  id SERIAL PRIMARY KEY,
  series_id UUID,  -- series 테이블 참조 제거 (나중에 추가 가능)
  name VARCHAR(100) NOT NULL,
  title VARCHAR(100),                    -- 개인 호 (예: 천마검제, 불도금강)
  
  -- ═══════════════════════════════════════════════
  -- 소속 및 지위
  -- ═══════════════════════════════════════════════
  role VARCHAR(50) NOT NULL,             -- 주인공/주요조연/조연/단역
  faction VARCHAR(100),                  -- 소속 (흑호단, 소림사, 무당파)
  faction_type VARCHAR(50),              -- 문파 유형 (정파/사파/세가/상단/관아)
  group_title VARCHAR(100),              -- 단체 외호 (사대금강, 무당칠검)
  group_position INTEGER,                -- 단체 내 순위
  rank_in_faction VARCHAR(100),          -- 문파 내 지위 (장문인, 장로, 제자)
  
  -- ═══════════════════════════════════════════════
  -- 🔥 출신 및 배경 (디테일의 핵심!)
  -- ═══════════════════════════════════════════════
  birthplace VARCHAR(100),               -- 태생 (강남 소주, 북방 개봉)
  hometown VARCHAR(100),                 -- 고향
  current_residence VARCHAR(100),        -- 현 거주지
  social_class VARCHAR(50),              -- 계급 (평민, 상인, 귀족, 몰락귀족)
  family_background TEXT,                -- 가문 배경
  backstory TEXT,                        -- 과거 이야기
  
  -- ═══════════════════════════════════════════════
  -- 외모 및 체격
  -- ═══════════════════════════════════════════════
  age VARCHAR(50),                       -- 20~23세, 50대
  height VARCHAR(20),                    -- 185cm
  weight VARCHAR(20),                    -- 90kg
  build VARCHAR(50),                     -- 근육질, 마른, 통통, 거구, 호리호리
  appearance TEXT,                       -- 외모 상세 설명
  distinctive_features TEXT,             -- 특징 (흉터, 문신, 눈동자 색)
  voice_tone VARCHAR(50),                -- 목소리 (굵고 낮음, 날카로움)
  
  -- ═══════════════════════════════════════════════
  -- 무공 및 전투
  -- ═══════════════════════════════════════════════
  martial_rank VARCHAR(50),              -- 삼류급, 이류급, 일류급, 화경급, 현경급
  martial_rank_numeric INTEGER,          -- 숫자로 (정렬용: 1~10)
  
  -- 🔥 무력 및 전투력 (NEW!)
  combat_power INTEGER,                  -- 종합 전투력 (0~100)
  attack_power INTEGER,                  -- 공격력 (0~100)
  defense_power INTEGER,                 -- 방어력 (0~100)
  speed_power INTEGER,                   -- 속도 (0~100)
  technique_power INTEGER,               -- 기술력 (0~100)
  
  -- 🔥 내공 및 기력 (NEW!)
  internal_energy_years INTEGER,         -- 내공 연수 (예: 30년)
  internal_energy_level VARCHAR(100),    -- 내공 깊이 설명 (예: "30년 심후한 내공")
  qi_control_level VARCHAR(50),          -- 기 운용 능력 (초급, 중급, 고급, 대가)
  
  weapon VARCHAR(100),                   -- 주 무기 (철검, 창, 도)
  weapon_secondary VARCHAR(100),         -- 보조 무기 (암기, 독침)
  weapon_description TEXT,               -- 무기 상세 (검의 길이, 재질)
  skills TEXT[],                         -- 무공 목록
  skill_proficiency JSONB,               -- 각 무공별 숙련도 (예: {"철골공": 80, "흑호도법": 60})
  special_abilities TEXT[],              -- 특수 능력
  fighting_style VARCHAR(100),           -- 전투 스타일 (공격형, 방어형, 기습형)
  combat_experience TEXT,                -- 실전 경험 (예: "강호 10년, 실전 50회 이상")
  
  -- ═══════════════════════════════════════════════
  -- 성격 및 말투
  -- ═══════════════════════════════════════════════
  personality TEXT,                      -- 성격 상세
  personality_keywords TEXT[],           -- 키워드 (우직, 충성, 유머)
  speech_style TEXT,                     -- 말투 (존댓말, 하오체, 반말)
  speech_examples TEXT[],                -- 대사 예시
  habits TEXT[],                         -- 버릇, 습관
  catchphrase VARCHAR(200),              -- 입버릇
  
  -- ═══════════════════════════════════════════════
  -- 🔥 음식 및 식습관 (리얼리티의 핵심!)
  -- ═══════════════════════════════════════════════
  favorite_foods TEXT[],                 -- 좋아하는 음식
  disliked_foods TEXT[],                 -- 싫어하는 음식
  dietary_restrictions TEXT[],           -- 금기 음식 (채식, 술 금지, 오신채)
  food_preference_reason TEXT,           -- 음식 선호 이유
  typical_breakfast TEXT,                -- 평소 아침 식사
  typical_lunch TEXT,                    -- 평소 점심
  typical_dinner TEXT,                   -- 평소 저녁
  favorite_drink VARCHAR(100),           -- 선호 음료 (차, 술)
  alcohol_tolerance VARCHAR(50),         -- 주량 (못함, 보통, 강함, 매우 강함)
  eating_habits TEXT,                    -- 식사 습관 (빨리 먹음, 천천히)
  
  -- ═══════════════════════════════════════════════
  -- 🔥 체력 및 신체 특성 (음식과 연결!)
  -- ═══════════════════════════════════════════════
  stamina_level VARCHAR(50),             -- 체력 (약함, 보통, 뛰어남, 괴물)
  stamina_reason TEXT,                   -- 체력 이유 (고기 즐김, 단련)
  strength_level VARCHAR(50),            -- 힘
  speed_level VARCHAR(50),               -- 속도
  endurance_level VARCHAR(50),           -- 지구력
  flexibility_level VARCHAR(50),         -- 유연성
  physical_traits TEXT,                  -- 신체 특성 종합
  
  -- ═══════════════════════════════════════════════
  -- 🔥 생활 패턴 및 일과
  -- ═══════════════════════════════════════════════
  daily_routine TEXT,                    -- 하루 일과
  wake_up_time VARCHAR(20),              -- 기상 시간
  sleep_time VARCHAR(20),                -- 취침 시간
  sleeping_pattern VARCHAR(50),          -- 수면 패턴 (아침형, 야행성)
  hobbies TEXT[],                        -- 취미
  favorite_activities TEXT[],            -- 즐기는 활동
  stress_relief_method TEXT,             -- 스트레스 해소법
  
  -- ═══════════════════════════════════════════════
  -- 🔥 환경 적응력 (출신지와 연결!)
  -- ═══════════════════════════════════════════════
  climate_preference VARCHAR(50),        -- 기후 선호 (추위, 더위 강함)
  season_preference VARCHAR(50),         -- 계절 선호
  weather_effects JSONB,                 -- 날씨별 영향 {비: 불리, 눈: 유리}
  terrain_advantage VARCHAR(100),        -- 유리한 지형 (산악, 평지, 물가)
  
  -- ═══════════════════════════════════════════════
  -- 🔥 의복 및 장신구
  -- ═══════════════════════════════════════════════
  clothing_style TEXT,                   -- 의복 스타일
  clothing_colors TEXT[],                -- 선호 색상
  accessories TEXT[],                    -- 장신구 (목걸이, 반지)
  clothing_reason TEXT,                  -- 의복 선택 이유
  
  -- ═══════════════════════════════════════════════
  -- 인간관계
  -- ═══════════════════════════════════════════════
  relationships JSONB,                   -- 인간관계 맵 {조칠: 의형제, 설화: 연인}
  allies TEXT[],                         -- 동료들
  enemies TEXT[],                        -- 적들
  mentor VARCHAR(100),                   -- 스승
  disciples TEXT[],                      -- 제자들
  family_members JSONB,                  -- 가족 {부: 사망, 모: 생존, 동생: 1}
  
  -- ═══════════════════════════════════════════════
  -- 스토리 메타데이터
  -- ═══════════════════════════════════════════════
  first_appearance INTEGER,              -- 첫 등장 화
  last_appearance INTEGER,               -- 마지막 등장 화
  death_episode INTEGER,                 -- 사망 화
  is_recurring BOOLEAN DEFAULT true,     -- 재등장 가능 여부
  importance_score INTEGER DEFAULT 0,    -- 중요도 점수 (0~100)
  character_arc TEXT,                    -- 캐릭터 아크 (성장 스토리)
  growth_milestones JSONB,               -- 성장 이정표 {50화: 일류급, 100화: 화경급}
  memorable_scenes TEXT[],               -- 명장면 목록
  
  -- ═══════════════════════════════════════════════
  -- 타임스탬프
  -- ═══════════════════════════════════════════════
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- ═══════════════════════════════════════════════
  -- 인덱스 및 제약조건
  -- ═══════════════════════════════════════════════
  CONSTRAINT unique_character_name UNIQUE(series_id, name)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 인덱스 생성 (검색 최적화)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 🔥 기존 인덱스 삭제 (충돌 방지)
DROP INDEX IF EXISTS idx_characters_series;
DROP INDEX IF EXISTS idx_characters_name;
DROP INDEX IF EXISTS idx_characters_faction;
DROP INDEX IF EXISTS idx_characters_role;
DROP INDEX IF EXISTS idx_characters_martial_rank;
DROP INDEX IF EXISTS idx_characters_first_appearance;

-- 새 인덱스 생성
CREATE INDEX idx_characters_series ON characters(series_id);
CREATE INDEX idx_characters_name ON characters(name);
CREATE INDEX idx_characters_faction ON characters(faction);
CREATE INDEX idx_characters_role ON characters(role);
CREATE INDEX idx_characters_martial_rank ON characters(martial_rank_numeric);
CREATE INDEX idx_characters_first_appearance ON characters(first_appearance);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 자동 업데이트 트리거
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION update_character_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER character_updated
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_character_timestamp();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RLS (Row Level Security) 설정
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Characters are viewable by everyone"
  ON characters FOR SELECT
  USING (true);

-- 인증된 사용자만 삽입/수정/삭제 가능
CREATE POLICY "Characters are insertable by authenticated users"
  ON characters FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Characters are updatable by authenticated users"
  ON characters FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Characters are deletable by authenticated users"
  ON characters FOR DELETE
  USING (auth.role() = 'authenticated');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 완료!
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE characters IS '소설 캐릭터 완벽 관리 테이블 - 출신, 음식, 생활 패턴 포함';
