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

    // ── 2. ★★ master_story_bible.md에서 미래 로드맵 추출 (가장 중요!) ──
    const sections: string[] = [];
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
        // 전후 화도 포함 (맥락 파악용)
        const prevPattern = new RegExp(`\\|\\s*\\*{0,2}${episodeNumber - 1}화\\*{0,2}\\s*\\|`);
        const nextPattern = new RegExp(`\\|\\s*\\*{0,2}${episodeNumber + 1}화\\*{0,2}\\s*\\|`);
        if (prevPattern.test(line) || nextPattern.test(line)) {
          matchingLines.push(line);
        }
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

    // ── 4. 캐릭터_인명록에서 해당 화 등장 캐릭터 ──
    const charPath = join(novelDir, '캐릭터_인명록.md');
    if (existsSync(charPath)) {
      const charContent = readFileSync(charPath, 'utf-8');
      // 간단히 "14화" 또는 이전 화에 등장한 캐릭터 관련 정보 추출
      const charLines = charContent.split('\n').filter(line =>
        line.includes(`${episodeNumber}화`) || line.includes(`${prevEpNum}화`)
      );
      if (charLines.length > 0) {
        sections.push('## 👤 관련 캐릭터 언급\n' + charLines.join('\n'));
      }
    }

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
