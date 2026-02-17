import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [소설_진행_마스터.md 자동 업데이트 API]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 에피소드 집필 완료 후 호출.
 * Gemini Flash로 본문을 분석하여 마스터 파일을 자동 업데이트.
 * 
 * 비용: ~$0.01~0.02 (Gemini Flash)
 * 
 * 업데이트 대상 (소설_진행_마스터.md 하단 규칙 준수):
 *   §1 현재 상태 → 위치, 시간, 상태 갱신
 *   §2 다음 화 주의 → N+1화 내용으로 교체
 *   §3 활성 떡밥 → 새 떡밥 추가, 상태 변경
 *   §5 감정 목표 → 완료 화수 기록
 *   §7 최근 기억카드 → 새 카드 추가 (5화 유지)
 */

export async function POST(req: NextRequest) {
  try {
    const { episodeNumber, episodeTitle, episodeContent } = await req.json();

    if (!episodeNumber || !episodeContent) {
      return NextResponse.json({
        success: false,
        message: '화 번호(episodeNumber)와 본문(episodeContent)이 필요합니다.',
      }, { status: 400 });
    }

    const claudeKey = process.env.CLAUDE_API_KEY;
    if (!claudeKey) {
      return NextResponse.json({
        success: false,
        message: 'CLAUDE_API_KEY가 설정되지 않았습니다.',
      }, { status: 500 });
    }

    // ── 1. 현재 마스터 파일 읽기 ──
    const projectRoot = process.cwd();
    const masterPath = join(projectRoot, 'novels', 'murim_mna', '소설_진행_마스터.md');

    if (!existsSync(masterPath)) {
      return NextResponse.json({
        success: false,
        message: '소설_진행_마스터.md 파일을 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // ── 2. 백업 처리 + 기준 마스터 결정 ──
    // ★ 핵심 로직: 재업데이트(수정 후 재동기화)를 안전하게 처리
    const backupPath = join(projectRoot, 'novels', 'murim_mna', `소설_진행_마스터_backup_${episodeNumber}화전.md`);
    const backupExists = existsSync(backupPath);
    let baseMaster: string; // AI에게 전달할 기준 마스터 (업데이트 전 상태)

    if (backupExists) {
      // ★ 재업데이트: 백업이 이미 존재 = 이전에 이 화수로 업데이트한 적 있음
      // → 백업을 덮어쓰지 않고, 백업(N화 쓰기 전 깨끗한 상태)을 기준으로 사용
      baseMaster = readFileSync(backupPath, 'utf-8');
      console.log(`🔄 재업데이트 감지: 백업(${episodeNumber}화전)에서 기준 마스터 로드 (백업 보호)`);
    } else {
      // ★ 최초 업데이트: 현재 마스터를 백업으로 저장
      const currentMaster = readFileSync(masterPath, 'utf-8');
      copyFileSync(masterPath, backupPath);
      baseMaster = currentMaster;
      console.log(`💾 최초 백업 생성: ${backupPath}`);
    }

    // ── 3. Claude Sonnet에게 업데이트 요청 ──
    // baseMaster = N화 반영 전 깨끗한 상태 (최초든 재업데이트든 동일)
    const prompt = buildUpdatePrompt(baseMaster, episodeNumber, episodeTitle, episodeContent);
    console.log(`📝 제${episodeNumber}화 마스터 업데이트 시작 (Claude Sonnet)`);

    const updatedMaster = await callClaude(claudeKey, prompt, 8000);

    if (!updatedMaster || updatedMaster.length < 500) {
      throw new Error('Claude가 유효한 업데이트를 생성하지 못했습니다.');
    }

    // ── 4. 마크다운 코드 펜스 제거 (AI가 ```markdown 으로 감쌀 수 있음) ──
    let cleanedMaster = updatedMaster
      .replace(/^```(?:markdown|md)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    // ── 5. 기본 검증 ──
    const hasSection1 = cleanedMaster.includes('§1');
    const hasSection2 = cleanedMaster.includes('§2');
    const hasSection7 = cleanedMaster.includes('§7');
    const hasEpNumber = cleanedMaster.includes(`${episodeNumber}화`);

    if (!hasSection1 || !hasSection2 || !hasSection7) {
      console.warn('⚠️ 업데이트에 누락된 섹션이 있습니다. 백업에서 복원 가능.');
    }

    // ── 6. 버전 정보 업데이트 ──
    const today = new Date().toISOString().split('T')[0];
    cleanedMaster = cleanedMaster.replace(
      /\[VERSION:.*?\].*?\[최신화:.*?\].*?\[날짜:.*?\]/,
      `[VERSION: v3] [최신화: ${episodeNumber}화] [날짜: ${today}]`
    );

    // ── 7. 파일 저장 ──
    writeFileSync(masterPath, cleanedMaster, 'utf-8');
    console.log(`✅ 소설_진행_마스터.md 업데이트 완료 (${cleanedMaster.length}자)`);

    // ── 8. 비용 계산 ──
    const estInputTokens = Math.ceil(prompt.length / 3);
    const estOutputTokens = Math.ceil(cleanedMaster.length / 3);
    const estCost = ((estInputTokens * 0.10) + (estOutputTokens * 0.40)) / 1_000_000;

    return NextResponse.json({
      success: true,
      message: `제${episodeNumber}화 기준으로 소설_진행_마스터.md 업데이트 완료`,
      details: {
        updatedSections: ['§1', '§2', '§3', '§5', '§7'],
        charCount: cleanedMaster.length,
        backupFile: `소설_진행_마스터_backup_${episodeNumber}화전.md`,
        validation: { hasSection1, hasSection2, hasSection7, hasEpNumber },
      },
      costInfo: {
        model: 'claude-sonnet-4-5-20250929',
        estimatedCostUSD: Math.round(estCost * 10000) / 10000,
      },
    });

  } catch (error: any) {
    console.error('❌ 마스터 업데이트 오류:', error);
    return NextResponse.json({
      success: false,
      message: '마스터 업데이트 실패: ' + error.message,
    }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 프롬프트 구성
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildUpdatePrompt(
  currentMaster: string,
  episodeNumber: number,
  episodeTitle: string,
  episodeContent: string,
): string {
  // 본문이 너무 길면 핵심만 추출 (비용 절감)
  const trimmedContent = episodeContent.length > 6000
    ? episodeContent.slice(0, 2000) + '\n\n[...중략...]\n\n' + episodeContent.slice(-2000)
    : episodeContent;

  return `당신은 무협 웹소설 "독고천마: 패왕의 재림"의 연재 관리 시스템입니다.
제${episodeNumber}화 "${episodeTitle || ''}" 집필이 완료되었습니다.

아래 규칙에 따라 "소설_진행_마스터.md"를 업데이트하세요.

## 업데이트 규칙

§1 현재 상태 → 최신 집필 화수를 ${episodeNumber}화로, 위치/시간/건강/무공/소지금 등을 본문 기반으로 갱신
§2 다음 화 주의 → 제${episodeNumber + 1}화 내용으로 교체. 스토리 연결, 캐릭터 주의, 시스템 규칙 작성
§3 활성 떡밥 → 새 떡밥 추가(있으면), 기존 떡밥 상태 변경(힌트 진행/회수 완료 등). 회수 완료(✅)된 것은 표에서 삭제하고 §8 아카이브 안내 코멘트만 남김
§8 보류 떡밥 자동 복원 → §8에 "⏸️ 보류" 상태 떡밥이 있으면, 목표 회수 범위에 제${episodeNumber + 1}화가 포함되는 항목을 §3 활성 떡밥으로 복원하세요 (상태를 🟡로 변경). 복원한 항목은 §8 보류 목록에서 제거하세요
§4 관계 매트릭스 → 변한 관계만 수치 갱신 (변화 없으면 유지)
§5 감정 목표 → 제${episodeNumber}화 행 기록 (텐션, 감정 키워드, 핵심 장면). 이준혁 감정 단계도 갱신
§6 확정 팩트 → 새로 확정된 팩트 추가 (있으면)
§7 최근 기억카드 → 제${episodeNumber}화 카드 추가. 6하원칙+핵심+떡밥+핵심대사 형식. 총 5화 유지(가장 오래된 것은 §8로 이동 안내)

## 중요
- 파일 전체를 빠짐없이 출력하세요 (§1~§8 + 업데이트 규칙 전부)
- 기존 내용 중 변경 불필요한 부분은 그대로 유지
- §6 확정 팩트는 함부로 수정하지 말 것 (추가만 가능)
- 마크다운 형식 유지

## 현재 소설_진행_마스터.md
${currentMaster}

## 제${episodeNumber}화 본문
${trimmedContent}

위 규칙에 따라 업데이트된 소설_진행_마스터.md 전체를 출력하세요. 마크다운 코드 펜스 없이 순수 마크다운만 출력하세요.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Claude Sonnet 호출 (마스터 업데이트용)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function callClaude(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      temperature: 0.3, // 낮은 온도 = 정확한 업데이트
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Claude 호출 실패 (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data?.content?.[0]?.text || '';
}
