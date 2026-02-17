import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [자동 설계도 API]
 * 소설_진행_마스터.md + 이전 화 파일에서 설계도를 자동 생성
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 사용법: GET /api/auto-blueprint?episode=14
 * 
 * 동작:
 * 1. 소설_진행_마스터.md에서 §1(현재 상태), §2(다음 화 주의사항) 추출
 * 2. 이전 화 파일의 마지막 부분(엔딩 장면) 추출
 * 3. 활성 떡밥(§3) 중 해당 화에 관련된 것 추출
 * 4. 모두 합쳐서 설계도로 반환
 * 
 * 비용: $0 (파일 읽기만, AI 호출 없음)
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const episodeNumber = parseInt(searchParams.get('episode') || '0');

    if (!episodeNumber || episodeNumber < 1) {
      return NextResponse.json({
        success: false,
        message: '유효한 화 번호가 필요합니다. (?episode=14)',
      }, { status: 400 });
    }

    // ── 프로젝트 루트 경로 계산 ──
    const projectRoot = process.cwd();
    const novelDir = join(projectRoot, 'novels', 'murim_mna');

    // ── 1. 소설_진행_마스터.md 읽기 ──
    const masterPath = join(novelDir, '소설_진행_마스터.md');
    let masterContent = '';
    if (existsSync(masterPath)) {
      masterContent = readFileSync(masterPath, 'utf-8');
    }

    if (!masterContent) {
      return NextResponse.json({
        success: false,
        message: '소설_진행_마스터.md 파일을 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // ── 2. ★★★ 전략 브리핑 데이터 로드 (최우선!) ──
    // 전략 회의에서 승인된 방향(A/B)과 클리프행어를 설계도 최상단에 배치
    const sections: string[] = [];
    const briefingPath = join(novelDir, 'briefings', `제${episodeNumber}화_브리핑.json`);
    if (existsSync(briefingPath)) {
      try {
        const briefingData = JSON.parse(readFileSync(briefingPath, 'utf-8'));
        const briefingLines: string[] = [];
        briefingLines.push(`# 🎯 제${episodeNumber}화 전략 브리핑 (승인됨: ${briefingData.approved ? '✅' : '⏳'})`);
        briefingLines.push('> ⚠️ **이 브리핑이 이번 화의 최우선 지침입니다. 반드시 따르세요.**\n');

        // 선택된 방향
        if (briefingData.directionChoice) {
          const dc = briefingData.directionChoice;
          const selected = dc.selected; // 'A' 또는 'B'
          if (selected === 'A' && dc.a) {
            briefingLines.push('## 📌 선택된 방향: A안');
            briefingLines.push(dc.a);
          } else if (selected === 'B' && dc.b) {
            briefingLines.push('## 📌 선택된 방향: B안');
            briefingLines.push(dc.b);
          }
          briefingLines.push('');
        }

        // 선택된 클리프행어
        if (briefingData.cliffhangerChoice) {
          const cc = briefingData.cliffhangerChoice;
          if (cc.selected >= 0 && cc.options && cc.options[cc.selected]) {
            briefingLines.push('## 🔚 이 화의 클리프행어 (마지막 장면)');
            briefingLines.push('> **반드시 이 클리프행어로 화를 끝내세요:**');
            briefingLines.push(cc.options[cc.selected]);
            briefingLines.push('');
          }
        }

        // 추가 메모 — ★ AI 추천 텍스트는 필터링, 사용자 메모만 포함
        // AI 추천 마커: 🎬, 💎, 📈, 🧩 로 시작하는 줄은 AI가 생성한 것
        if (briefingData.notes) {
          const userNotes = briefingData.notes
            .split('\n')
            .filter((line: string) => {
              const trimmed = line.trim();
              // AI 추천 마커가 있는 줄은 제외 (설계도에 불필요한 AI 추천이 섞이는 것 방지)
              if (trimmed.startsWith('🎬 AI 추천')) return false;
              if (trimmed.startsWith('💎 심장라인')) return false;
              if (trimmed.startsWith('📈 감정 곡선')) return false;
              if (trimmed.startsWith('🧩 복선 처리')) return false;
              return true;
            })
            .join('\n')
            .trim();
          
          if (userNotes) {
            briefingLines.push('## 📝 추가 주의사항 (사용자 메모)');
            briefingLines.push(userNotes);
            briefingLines.push('');
          }
        }

        sections.push(briefingLines.join('\n'));
        console.log(`✅ 제${episodeNumber}화 전략 브리핑 로드 (${briefingData.approved ? '승인됨' : '미승인'})`);
      } catch (e) {
        console.warn('⚠️ 브리핑 파일 읽기 실패 (무시):', e);
      }
    }

    // ── 3. master_story_bible.md에서 미래 로드맵 추출 ──
    const biblePath = join(novelDir, 'master_story_bible.md');
    if (existsSync(biblePath)) {
      const bibleContent = readFileSync(biblePath, 'utf-8');
      const bibleLines = bibleContent.split('\n');

      // 해당 화수가 포함된 테이블 행 찾기 (예: "| **14화** |")
      const epPattern = new RegExp(`\\|\\s*\\*{0,2}${episodeNumber}화\\*{0,2}\\s*\\|`);
      const matchingLines: string[] = [];
      let tableHeader = '';

      for (let i = 0; i < bibleLines.length; i++) {
        const line = bibleLines[i];
        // 테이블 헤더 저장 (| 화 | 시점 | 내용 | 핵심 장면 |)
        if (line.includes('| 화 |') || line.includes('| 화수 |')) {
          tableHeader = line + '\n' + (bibleLines[i + 1] || '');
        }
        // 해당 화 행 매칭
        if (epPattern.test(line)) {
          matchingLines.push(line);
        }
        // ⚠️ 이전 화(13화)·다음 화(15화) 행은 포함하지 않음
        // 13화는 직전 화 엔딩(800자)으로 충분, 15화는 혼입 위험
      }

      // 해당 화가 속한 블록(아크) 제목 찾기
      let blockTitle = '';
      for (let i = 0; i < bibleLines.length; i++) {
        if (bibleLines[i].startsWith('###') && bibleLines[i].includes('화)')) {
          // "### 기(起) 시작: 꿈의 실행 (14~25화)" 같은 패턴
          const rangeMatch = bibleLines[i].match(/(\d+)~(\d+)화/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            if (episodeNumber >= start && episodeNumber <= end) {
              blockTitle = bibleLines[i].replace(/^#+\s*/, '');
              // 블록 설명도 가져오기 (> 로 시작하는 다음 줄들)
              for (let j = i + 1; j < Math.min(i + 5, bibleLines.length); j++) {
                if (bibleLines[j].startsWith('>')) {
                  blockTitle += '\n' + bibleLines[j];
                } else if (bibleLines[j].trim() === '') {
                  continue;
                } else {
                  break;
                }
              }
              break;
            }
          }
        }
      }

      if (matchingLines.length > 0 || blockTitle) {
        let roadmapSection = '## 🗺️ 제' + episodeNumber + '화 스토리 로드맵 (master_story_bible)\n';
        if (blockTitle) {
          roadmapSection += '**아크**: ' + blockTitle + '\n\n';
        }
        if (tableHeader && matchingLines.length > 0) {
          // 중복 제거 후 정렬
          const uniqueLines = [...new Set(matchingLines)];
          roadmapSection += tableHeader + '\n' + uniqueLines.join('\n');
        }
        sections.push(roadmapSection);
      }
    }

    // ── 3. 소설_진행_마스터.md에서 현재 상태 추출 ──

    // §1 현재 상태 추출
    const s1Match = masterContent.match(/# §1\. 현재 상태[^\n]*\n([\s\S]*?)(?=\n# ═)/);
    if (s1Match) {
      sections.push('## 📍 현재 상태 (소설_진행_마스터 §1)\n' + s1Match[1].trim());
    }

    // §2 다음 화 주의사항 추출
    const s2Match = masterContent.match(/# §2\. 다음 화 주의사항[^\n]*\n([\s\S]*?)(?=\n# ═)/);
    if (s2Match) {
      sections.push('## ⚠️ 제' + episodeNumber + '화 주의사항 (소설_진행_마스터 §2)\n' + s2Match[1].trim());
    }

    // §3 활성 떡밥 중 해당 화 범위에 해당하는 것 추출
    const s3Match = masterContent.match(/# §3\. 활성 떡밥[^\n]*\n([\s\S]*?)(?=\n# ═)/);
    if (s3Match) {
      const allLines = s3Match[1].split('\n');
      // 테이블 행 중 해당 화수가 목표 범위에 포함된 것만 필터링
      const relevantLines = allLines.filter(line => {
        // 🔴 또는 🟡 상태인 떡밥만
        if (!line.includes('🔴') && !line.includes('🟡')) return false;
        // 목표 범위 체크: "14~20화" 같은 패턴에서 현재 화가 범위 내인지
        const rangeMatch = line.match(/(\d+)~(\d+)화/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          return episodeNumber >= start && episodeNumber <= end;
        }
        // 단일 화수 체크: "14화"
        return line.includes(`${episodeNumber}화`);
      });

      if (relevantLines.length > 0) {
        // 테이블 헤더 추가
        const headerLines = allLines.filter(line => line.startsWith('| ID') || line.startsWith('|----'));
        sections.push('## 🎣 제' + episodeNumber + '화 관련 활성 떡밥\n' + [...headerLines, ...relevantLines].join('\n'));
      }
    }

    // ── 3. 이전 화 파일의 마지막 부분 (엔딩 장면) ──
    const prevEpNum = episodeNumber - 1;
    if (prevEpNum >= 1) {
      const prevEpPath = join(novelDir, 'output', `제${prevEpNum}화.md`);
      if (existsSync(prevEpPath)) {
        const prevContent = readFileSync(prevEpPath, 'utf-8');
        // 마지막 800자 추출 (엔딩 장면)
        const lastPart = prevContent.slice(-800).trim();
        sections.push('## 📖 제' + prevEpNum + '화 엔딩 장면 (연결용)\n```\n' + lastPart + '\n```');
      }
    }

    // ── 4. 캐릭터 정보 ──
    // §4 관계 매트릭스, §6 확정 팩트는 설계도에 불필요 — §2(다음 화 주의사항)에 이미 핵심이 포함됨
    // ⚠️ 인명록 무차별 추출 비활성화 — "14화"가 포함된 모든 줄을 가져오면
    // 14화에 등장하지 않는 캐릭터(장위, 마현, 곽대용 등)까지 AI에게 전달되어
    // 불필요한 캐릭터를 등장시키는 원인이 됨.
    // 캐릭터 정보는 브리핑의 "등장인물 캐스팅"에서 사용자가 직접 선택함.

    // ── 5. 최종 설계도 조합 ──
    if (sections.length === 0) {
      return NextResponse.json({
        success: false,
        message: `제${episodeNumber}화에 대한 참조 데이터를 찾을 수 없습니다. 직접 설계도를 입력해주세요.`,
      });
    }

    const blueprint = [
      `# 제${episodeNumber}화 설계도 (자동 생성)`,
      `> master_story_bible.md(미래 로드맵) + 소설_진행_마스터.md(현재 상태) + 제${prevEpNum}화 엔딩`,
      `> ⚡ 이 설계도를 확인/수정한 후 "전체 생성" 버튼을 누르세요`,
      '',
      ...sections,
    ].join('\n\n');

    console.log(`✅ 제${episodeNumber}화 자동 설계도 생성 완료 (${blueprint.length}자)`);

    return NextResponse.json({
      success: true,
      blueprint,
      charCount: blueprint.length,
      sources: ['master_story_bible.md', '소설_진행_마스터.md', `제${prevEpNum}화.md`],
    });

  } catch (error: any) {
    console.error('❌ 자동 설계도 오류:', error);
    return NextResponse.json({
      success: false,
      message: '설계도 자동 생성 실패: ' + error.message,
    }, { status: 500 });
  }
}
