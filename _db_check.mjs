import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const SID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const res = await fetch(`${URL}/rest/v1/characters?select=name,faction,series_id&series_id=eq.${SID}&order=faction,importance_score.desc&limit=100`, {
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
});
const all = await res.json();
const factions = {};
all.forEach(c => { factions[c.faction] = (factions[c.faction] || 0) + 1; });

console.log(`DB: ${all.length}명 (series_id OK)\n`);
Object.entries(factions).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => {
  console.log(`  ${f}: ${n}명`);
});
