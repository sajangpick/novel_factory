const fs = require('fs');
const path = require('path');

async function test() {
  const content = fs.readFileSync(
    path.join(__dirname, '..', 'novels', 'murim_mna', 'output', '제15화.md'),
    'utf8'
  );

  console.log('테스트 시작: 15화 청원심법/귀원검법 전수 검토...\n');

  const body = JSON.stringify({
    action: 'instruct',
    instruction: '청원심법 및 귀원검법은 주면 안되는거야. 주면 안되는 이유를 자료로 찾아봐',
    episodeNumber: 15,
    episodeContent: content,
  });

  const res = await fetch('http://localhost:3000/api/ai-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test().catch(e => console.error('오류:', e.message));
