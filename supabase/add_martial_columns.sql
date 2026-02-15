-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 무력 및 내공 컬럼 추가 (기존 데이터 보존)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 🔥 전투력 수치
ALTER TABLE characters ADD COLUMN IF NOT EXISTS combat_power INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS attack_power INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS defense_power INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS speed_power INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS technique_power INTEGER;

-- 🔥 내공 및 기력
ALTER TABLE characters ADD COLUMN IF NOT EXISTS internal_energy_years INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS internal_energy_level VARCHAR(100);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS qi_control_level VARCHAR(50);

-- 🔥 무공 숙련도
ALTER TABLE characters ADD COLUMN IF NOT EXISTS skill_proficiency JSONB;

-- 🔥 실전 경험
ALTER TABLE characters ADD COLUMN IF NOT EXISTS combat_experience TEXT;

-- 성공 메시지
SELECT '✅ 무력/내공 컬럼 추가 완료!' as result;
