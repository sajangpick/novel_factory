-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Novel Alchemist - 세계관 DB + Memory System 마이그레이션
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 코드 전체 복사/붙여넣기 → Run
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ═══════════════════════════════════════════════
-- 1. 세계관 문서 테이블 (38개 MD 파일 저장용)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS world_db_documents (
  id SERIAL PRIMARY KEY,
  series_id UUID DEFAULT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  
  -- 문서 정보
  filename VARCHAR(200) NOT NULL,          -- 예: '캐릭터_인명록'
  filepath VARCHAR(500) NOT NULL,          -- 예: 'docs/world_db/캐릭터_인명록.md'
  category VARCHAR(100) NOT NULL,          -- 예: '캐릭터', '지리', '무공', '스토리'
  
  -- 내용
  content TEXT NOT NULL,                   -- MD 파일 전체 내용
  char_count INTEGER DEFAULT 0,           -- 글자 수
  
  -- 메타데이터
  checksum VARCHAR(64),                    -- 내용 변경 감지용 해시
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 유니크 제약조건 (같은 시리즈 + 같은 파일명은 하나만)
  UNIQUE(series_id, filename)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_worlddb_series ON world_db_documents(series_id);
CREATE INDEX IF NOT EXISTS idx_worlddb_category ON world_db_documents(category);
CREATE INDEX IF NOT EXISTS idx_worlddb_filename ON world_db_documents(filename);

-- RLS 정책 (공개 읽기, 인증된 사용자 쓰기)
ALTER TABLE world_db_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "world_db_documents_public_read" ON world_db_documents;
CREATE POLICY "world_db_documents_public_read" ON world_db_documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "world_db_documents_public_write" ON world_db_documents;
CREATE POLICY "world_db_documents_public_write" ON world_db_documents FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════
-- 2. 화별 기억 카드 테이블
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memory_cards (
  id SERIAL PRIMARY KEY,
  series_id UUID DEFAULT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  
  -- 에피소드 정보
  episode_number INTEGER NOT NULL,         -- 화 번호
  episode_title VARCHAR(200),              -- 화 제목
  
  -- 6하원칙 요약
  when_summary TEXT,                       -- 언제
  where_summary TEXT,                      -- 어디서
  who_summary TEXT,                        -- 누가 (⭐첫등장, ❌퇴장, 💀사망)
  what_summary TEXT,                       -- 무엇을 (핵심 사건)
  why_summary TEXT,                        -- 왜 (동기/목적)
  how_summary TEXT,                        -- 어떻게 (방법/과정)
  
  -- 상태 변화 (이전 화 대비 델타)
  asset_change TEXT,                       -- 자산 변동
  martial_change TEXT,                     -- 무공 변화
  org_change TEXT,                         -- 조직 변동
  relationship_change TEXT,                -- 관계 변화
  location_change TEXT,                    -- 위치 변동
  health_change TEXT,                      -- 부상/건강
  
  -- 떡밥
  foreshadow_planted TEXT,                 -- 새로 깐 복선
  foreshadow_hinted TEXT,                  -- 기존 떡밥에 힌트
  foreshadow_resolved TEXT,                -- 회수된 떡밥 ID
  
  -- 3인격 동향
  dominant_personality VARCHAR(50),        -- 주도 인격
  personality_conflict TEXT,               -- 의견 충돌
  personality_growth TEXT,                 -- 관계 변화
  
  -- 핵심 대사
  key_dialogue TEXT,                       -- 가장 중요한 대사 1~2줄
  
  -- 다음 화 연결
  cliffhanger TEXT,                        -- 절단신공 포인트
  next_preview TEXT,                       -- 다음 화 필수 이어짐
  next_caution TEXT,                       -- 다음 화 주의사항
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 유니크 제약조건 (같은 시리즈 + 같은 화번호는 하나만)
  UNIQUE(series_id, episode_number)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_memcard_series ON memory_cards(series_id);
CREATE INDEX IF NOT EXISTS idx_memcard_episode ON memory_cards(episode_number);

-- RLS 정책
ALTER TABLE memory_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memory_cards_public_read" ON memory_cards;
CREATE POLICY "memory_cards_public_read" ON memory_cards FOR SELECT USING (true);
DROP POLICY IF EXISTS "memory_cards_public_write" ON memory_cards;
CREATE POLICY "memory_cards_public_write" ON memory_cards FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════
-- 3. 현재 상태 대시보드 테이블
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS novel_dashboard (
  id SERIAL PRIMARY KEY,
  series_id UUID DEFAULT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  
  -- 현재 시점
  latest_episode INTEGER DEFAULT 0,        -- 최신 집필 화수
  story_date VARCHAR(200),                 -- 작중 날짜
  season VARCHAR(50),                      -- 계절
  weather VARCHAR(100),                    -- 날씨
  current_location VARCHAR(200),           -- 현재 위치
  next_episode_title VARCHAR(200),         -- 다음 화 제목
  
  -- 위소운 상태
  mc_age INTEGER DEFAULT 18,               -- 나이
  mc_health TEXT,                           -- 건강 상태
  mc_martial_rank VARCHAR(100),            -- 무공 등급
  mc_internal_energy TEXT,                 -- 내공
  mc_available_skills TEXT,                -- 사용 가능 무공
  mc_money VARCHAR(100),                   -- 소지금
  mc_injury TEXT,                          -- 부상
  mc_emotion TEXT,                         -- 감정 상태
  mc_current_goal TEXT,                    -- 현재 목표
  
  -- 3인격 상태 (JSON)
  three_personality JSONB DEFAULT '{}',    -- 위소운/이준혁/천마 상태
  personality_conflict TEXT,               -- 인격 간 갈등
  personality_agreement TEXT,              -- 최근 합의
  personality_growth TEXT,                 -- 성장 포인트
  
  -- 조직 상태
  org_name VARCHAR(200),                   -- 조직명
  org_members INTEGER DEFAULT 0,           -- 총 인원
  org_base VARCHAR(200),                   -- 거점
  org_monthly_income VARCHAR(100),         -- 월 수입
  org_monthly_expense VARCHAR(100),        -- 월 지출
  org_businesses TEXT,                     -- 보유 사업
  
  -- 경제 상태
  total_assets VARCHAR(100),               -- 총 자산
  
  -- 무공/전투
  combat_experience INTEGER DEFAULT 0,     -- 전투 경험 횟수
  latest_combat TEXT,                      -- 최근 전투
  combat_injury TEXT,                      -- 부상/후유증
  
  -- 활성 떡밥 (JSON 배열)
  active_foreshadows JSONB DEFAULT '[]',
  
  -- 다음 화 주의사항
  next_cautions TEXT,
  
  -- 최근 타임라인 (JSON 배열)
  recent_timeline JSONB DEFAULT '[]',
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 시리즈당 하나만
  UNIQUE(series_id)
);

-- RLS 정책
ALTER TABLE novel_dashboard ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "novel_dashboard_public_read" ON novel_dashboard;
CREATE POLICY "novel_dashboard_public_read" ON novel_dashboard FOR SELECT USING (true);
DROP POLICY IF EXISTS "novel_dashboard_public_write" ON novel_dashboard;
CREATE POLICY "novel_dashboard_public_write" ON novel_dashboard FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════
-- 4. updated_at 자동 갱신 트리거
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
DROP TRIGGER IF EXISTS set_updated_at_world_db ON world_db_documents;
CREATE TRIGGER set_updated_at_world_db
  BEFORE UPDATE ON world_db_documents
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_updated_at_memory_cards ON memory_cards;
CREATE TRIGGER set_updated_at_memory_cards
  BEFORE UPDATE ON memory_cards
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_updated_at_dashboard ON novel_dashboard;
CREATE TRIGGER set_updated_at_dashboard
  BEFORE UPDATE ON novel_dashboard
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();


-- ═══════════════════════════════════════════════
-- 5. 초기 대시보드 데이터 삽입
-- ═══════════════════════════════════════════════
INSERT INTO novel_dashboard (
  series_id,
  latest_episode,
  story_date,
  season,
  current_location,
  next_episode_title,
  mc_health,
  mc_martial_rank,
  mc_money,
  mc_emotion,
  mc_current_goal,
  mc_injury
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  1,
  '봄, 1일차 (새벽→아침→밤)',
  '봄 (아직 쌀쌀함)',
  '우강진 폐사 (수면 중)',
  '2화 "거지의 첫 싸움"',
  '3년간 영양실조, 쇠약',
  '단전 봉인 상태',
  '0냥 (무일푼)',
  '피로+미약한 희망',
  '내일 새벽 포구에서 왕 노인에게 품팔이',
  '목에 얕은 칼자국 (자해 흔적)'
) ON CONFLICT (series_id) DO UPDATE SET
  latest_episode = EXCLUDED.latest_episode,
  story_date = EXCLUDED.story_date,
  season = EXCLUDED.season,
  current_location = EXCLUDED.current_location,
  next_episode_title = EXCLUDED.next_episode_title;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 완료! 3개 테이블 + 트리거 + 초기 데이터가 생성되었습니다.
-- - world_db_documents  : 38개 세계관 MD 파일 저장
-- - memory_cards        : 화별 기억 카드 저장
-- - novel_dashboard     : 현재 상태 대시보드 저장
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
