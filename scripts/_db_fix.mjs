// series_id 일괄 업데이트 스크립트
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const SERIES_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// 1) series_id가 null인 모든 캐릭터 조회
const res1 = await fetch(`${URL}/rest/v1/characters?select=id,name&series_id=is.null&limit=100`, {
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
});
const nullChars = await res1.json();
console.log(`series_id=null인 캐릭터: ${nullChars.length}명`);

if (nullChars.length === 0) {
  console.log('업데이트할 캐릭터가 없습니다.');
  process.exit(0);
}

// 2) 일괄 업데이트 (series_id가 null인 모든 행)
const res2 = await fetch(`${URL}/rest/v1/characters?series_id=is.null`, {
  method: 'PATCH',
  headers: {
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ series_id: SERIES_ID })
});

if (res2.ok) {
  const updated = await res2.json();
  console.log(`✅ ${updated.length}명 series_id 업데이트 완료`);
} else {
  console.error(`❌ 업데이트 실패: ${res2.status} ${await res2.text()}`);
}

// 3) 확인
const res3 = await fetch(`${URL}/rest/v1/characters?select=name,faction,series_id&series_id=eq.${SERIES_ID}&order=faction,importance_score.desc`, {
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
});
const all = await res3.json();
const factions = {};
all.forEach(c => { factions[c.faction] = (factions[c.faction] || 0) + 1; });

console.log(`\nDB 총 ${all.length}명 (series_id=${SERIES_ID})\n`);
console.log('📂 문파별 인원:');
Object.entries(factions).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => {
  console.log(`  ${f}: ${n}명`);
});
