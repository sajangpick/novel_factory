# -*- coding: utf-8 -*-
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[노벨 팩토리] 반자동 소설 집필 도구
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Anthropic API 프롬프트 캐싱으로 비용을 절감하면서
사람의 승인 단계를 유지하는 반자동 파이프라인.

사용법:
  pip install anthropic python-dotenv
  python backend/novel_writer.py

[자동화되는 것]
  ✅ 참조 자료 로딩 + 캐싱  (비용 90% 절감)
  ✅ EP 규칙 자동 검수       (말투, 몸소유권, 독백 표기)
  ✅ 영상화 메모 자동 생성
  ✅ 파일 저장

[사람이 하는 것]
  ✋ 설계안 승인  ("좋다 / 수정해")
  ✋ 완성본 퇴고  ("이 장면 좋다 / 빼자")
  ✋ 최종 저장 결정

비용 절감 원리:
  변하지 않는 자료 (무공DB, 캐릭터, 규칙) → 캐시에 고정 (90% 할인)
  매 화마다 바뀌는 자료 (이전 화, 진행 마스터) → 캐시 밖 (전액)
  직접 API 호출 → Cursor 마크업 없음
"""

import os
import io
import re
import sys
import time
from pathlib import Path
from datetime import datetime

# ── Windows 콘솔 UTF-8 강제 ──
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

# ── 패키지 확인 ──
try:
    from anthropic import Anthropic
except ImportError:
    print("❌ anthropic 패키지가 없습니다.")
    print("   설치: pip install anthropic")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("❌ python-dotenv 패키지가 없습니다.")
    print("   설치: pip install python-dotenv")
    sys.exit(1)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 설정값
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 프로젝트 경로
ROOT = Path(__file__).parent.parent
NOVEL_DIR = ROOT / "novels" / "murim_mna"
OUTPUT_DIR = NOVEL_DIR / "output"
SYSTEM_DIR = ROOT / "system"

# 모델 설정 — 비용 대비 품질 최적
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 16000  # 섹션당 최대 출력 토큰

# 비용 단가 (USD per token) — Claude Sonnet 기준
PRICE = {
    "input":       3.00 / 1_000_000,   # $3/MTok
    "cache_write": 3.75 / 1_000_000,   # $3.75/MTok (캐시 생성)
    "cache_read":  0.30 / 1_000_000,   # $0.30/MTok (캐시 히트 = 90% 할인!)
    "output":     15.00 / 1_000_000,   # $15/MTok
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. 환경 설정
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def setup():
    """API 키를 .env.local에서 불러와 클라이언트를 만듭니다."""
    env_path = ROOT / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)

    # CLAUDE_API_KEY 또는 ANTHROPIC_API_KEY 둘 다 지원
    api_key = os.environ.get("CLAUDE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ API 키를 찾을 수 없습니다.")
        print("   .env.local 파일에 CLAUDE_API_KEY=sk-ant-... 가 있어야 합니다.")
        sys.exit(1)

    client = Anthropic(api_key=api_key)
    print(f"  ✅ API 연결 완료 (모델: {MODEL})")
    return client


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. 파일 로딩 유틸리티
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def read_file(path, max_lines=None):
    """파일을 UTF-8로 읽습니다. 없으면 빈 문자열."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            if max_lines:
                return "".join(f.readline() for _ in range(max_lines))
            return f.read()
    except FileNotFoundError:
        print(f"  ⚠️ 파일 없음 (건너뜀): {Path(path).name}")
        return ""


def load_static_context():
    """
    [캐시 대상] 변하지 않는 참조 자료를 모아 하나의 시스템 프롬프트로 구성.
    → 첫 API 호출에서 캐시 생성, 이후 호출에서 90% 할인.

    포함 자료:
    1. .cursorrules (절대 불변 규칙)
    2. 집필_규칙.md (3인격, 말투, 코미디 등)
    3. master_story_bible.md (전체 줄거리)
    4. 무공_기법_대전.md (무공 DB + 전투 철학)
    5. .cursor/rules/novel-writing.mdc (소설체 규칙)
    6. .cursor/rules/combat.mdc (전투 규칙)
    7. .cursor/rules/youtube.mdc (영상화 메모 규칙)
    """
    print("  📚 정적 참조 자료 로딩 중...")

    # 각 파일을 [태그]와 함께 하나로 묶음
    file_map = {
        "[절대 불변 규칙 — .cursorrules]":
            ROOT / ".cursorrules",
        "[무림 M&A 집필 규칙 — 3인격, 말투, EP규칙]":
            NOVEL_DIR / "집필_규칙.md",
        "[마스터 스토리 바이블 — 전체 줄거리]":
            NOVEL_DIR / "master_story_bible.md",
        "[무공 기법 대전 — 무공DB, 6대 스승 전투 철학]":
            SYSTEM_DIR / "무공_기법_대전.md",
        "[소설체 핵심 규칙]":
            ROOT / ".cursor" / "rules" / "novel-writing.mdc",
        "[전투 장면 규칙]":
            ROOT / ".cursor" / "rules" / "combat.mdc",
        "[영상화 메모 규칙]":
            ROOT / ".cursor" / "rules" / "youtube.mdc",
    }

    blocks = []
    total_chars = 0

    for tag, path in file_map.items():
        content = read_file(path)
        if content:
            blocks.append(f"\n{'='*60}\n{tag}\n{'='*60}\n{content}")
            total_chars += len(content)

    # 한국어 대략 3자 = 1토큰
    est_tokens = total_chars // 3
    print(f"  ✅ 정적 자료: {total_chars:,}자 (~{est_tokens:,} 토큰) → 캐시 적용 예정")

    return "\n".join(blocks)


def load_dynamic_context(episode_num):
    """
    [캐시 비대상] 매 화마다 바뀌는 동적 자료.
    → 매 API 호출마다 전액 과금.

    포함 자료:
    1. 소설_진행_마스터.md (현재 상태, 떡밥, 기억카드)
    2. 이전 화 마지막 200줄 (연속성 확보)
    """
    print("  📋 동적 참조 자료 로딩 중...")
    parts = []

    # (1) 진행 마스터 (전체)
    master = read_file(NOVEL_DIR / "소설_진행_마스터.md")
    if master:
        parts.append(f"[소설 진행 마스터 — 현재 상태]\n{master}")

    # (2) 이전 화 끝부분 (연속성)
    prev_ep = episode_num - 1
    if prev_ep >= 1:
        prev_path = OUTPUT_DIR / f"제{prev_ep}화.md"
        prev_text = read_file(prev_path)
        if prev_text:
            lines = prev_text.split("\n")
            tail = "\n".join(lines[-200:])
            parts.append(f"[제{prev_ep}화 마지막 부분 — 연속성 참조]\n{tail}")

    print(f"  ✅ 동적 자료 로딩 완료")
    return "\n\n".join(parts)


def extract_characters(plan_text):
    """
    설계안에서 언급된 캐릭터의 시트만 뽑아옵니다.
    캐릭터_인명록.md가 3,955줄이라 전부 보내면 비용 폭탄.
    → 필요한 인물만 추출해서 비용 절감.
    """
    char_file = NOVEL_DIR / "캐릭터_인명록.md"
    full_text = read_file(char_file)
    if not full_text:
        return ""

    # 알려진 캐릭터 이름 (설계안에서 검색할 키워드)
    known = [
        "위소운", "이준혁", "천마", "소연화", "당찬", "남궁현",
        "야율흑", "안세진", "무영", "사월", "오독산", "소걸",
        "막사향", "한설영", "용담사태", "철기단주", "서무결",
        "남궁효", "하유정", "공손찬",
    ]

    # 설계안에서 언급된 인물
    mentioned = [n for n in known if n in plan_text]
    # 3인격은 항상 포함
    for must in ["위소운", "이준혁", "천마"]:
        if must not in mentioned:
            mentioned.append(must)

    # 캐릭터_인명록을 ## 헤더 기준으로 분리
    sections = re.split(r'\n(?=##\s)', full_text)
    relevant = []
    for section in sections:
        header = section[:150]  # 첫 150자 안에 이름 있는지
        for name in mentioned:
            if name in header:
                relevant.append(section.strip())
                break

    if relevant:
        result = "\n\n---\n\n".join(relevant)
        print(f"  👤 캐릭터 추출: {', '.join(mentioned)} ({len(relevant)}개 섹션)")
        return f"[등장 캐릭터 시트]\n{result}"

    return ""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. API 호출 + 캐싱 + 비용 추적
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class CostTracker:
    """API 비용을 실시간 추적합니다."""

    def __init__(self):
        self.total_input = 0
        self.total_output = 0
        self.total_cache_write = 0
        self.total_cache_read = 0
        self.calls = 0

    def add(self, usage):
        """API 응답의 usage 정보를 누적합니다."""
        self.calls += 1
        self.total_input += getattr(usage, 'input_tokens', 0)
        self.total_output += getattr(usage, 'output_tokens', 0)
        self.total_cache_write += getattr(usage, 'cache_creation_input_tokens', 0)
        self.total_cache_read += getattr(usage, 'cache_read_input_tokens', 0)

    def cost(self):
        """현재까지 총 비용 (USD)"""
        return (
            self.total_input * PRICE["input"]
            + self.total_output * PRICE["output"]
            + self.total_cache_write * PRICE["cache_write"]
            + self.total_cache_read * PRICE["cache_read"]
        )

    def savings(self):
        """캐싱으로 절약한 금액 (USD)"""
        # 캐시 히트가 없었다면 전부 일반 입력 요금이었을 것
        would_pay = self.total_cache_read * PRICE["input"]
        actual = self.total_cache_read * PRICE["cache_read"]
        return would_pay - actual

    def summary(self):
        """비용 요약 출력"""
        c = self.cost()
        s = self.savings()
        print(f"\n  {'━'*50}")
        print(f"  💰 비용 요약")
        print(f"  {'─'*50}")
        print(f"  API 호출 횟수     : {self.calls}회")
        print(f"  입력 토큰 (일반)  : {self.total_input:,}")
        print(f"  입력 토큰 (캐시↑) : {self.total_cache_write:,}")
        print(f"  입력 토큰 (캐시↓) : {self.total_cache_read:,}  ← 90% 할인 적용!")
        print(f"  출력 토큰         : {self.total_output:,}")
        print(f"  {'─'*50}")
        print(f"  이번 화 비용      : ${c:.4f}")
        if s > 0:
            print(f"  캐싱 절감액       : ${s:.4f} 💚")
            pct = (s / (c + s)) * 100 if (c + s) > 0 else 0
            print(f"  절감률            : {pct:.0f}%")
        print(f"  {'━'*50}\n")


def call_api(client, cached_system, user_content, tracker, max_tokens=MAX_TOKENS):
    """
    Anthropic API 호출 (프롬프트 캐싱 적용).

    cached_system  : 정적 참조 → cache_control: ephemeral 로 캐시
    user_content   : 동적 지시 → 캐시 없음 (매번 전송)
    tracker        : 비용 추적기
    """
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=[
                {
                    "type": "text",
                    "text": cached_system,
                    # ↓ 이 한 줄이 비용 90% 절감의 핵심!
                    "cache_control": {"type": "ephemeral"}
                }
            ],
            messages=[
                {"role": "user", "content": user_content}
            ]
        )

        tracker.add(response.usage)

        # 응답 텍스트 추출
        text = ""
        for block in response.content:
            if hasattr(block, 'text'):
                text += block.text
        return text

    except Exception as e:
        print(f"\n  ❌ API 오류: {e}")
        print(f"     해결 방법:")
        print(f"     1. .env.local의 CLAUDE_API_KEY가 유효한지 확인")
        print(f"     2. Anthropic 계정 잔액 확인 (console.anthropic.com)")
        print(f"     3. 모델명 확인: 현재 '{MODEL}'")
        return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. 파이프라인 단계들
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def step_plan(client, cached_sys, dynamic_ctx, ep_num, tracker):
    """
    ┌─────────────────────────────────────┐
    │ STEP 1: 설계안 생성  (자동 + 사람)  │
    │ 자동 → AI가 설계안 작성             │
    │ 사람 → 승인 / 수정 / 재생성         │
    └─────────────────────────────────────┘
    """
    print(f"\n{'━'*60}")
    print(f"  📋 STEP 1/5 — 제{ep_num}화 설계안 생성")
    print(f"{'━'*60}")

    prompt = f"""{dynamic_ctx}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[지시] 제{ep_num}화 설계안을 작성하세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

다음 형식으로 작성:

## 제{ep_num}화 설계안

### 제목 (부제)

### 시간/장소
- 작중 날짜: Day ??
- 장소: ??

### 등장인물 (역할과 함께)

### 기(起) — 도입
- (무슨 일이 일어나는지, 3~4줄)

### 승(承) — 전개
- (어떻게 확대되는지, 3~4줄)

### 전(轉) — 전환점
- (어떤 반전/긴장이 오는지, 3~4줄)

### 결(結) — 마무리
- (어떻게 끝나는지, 다음 화 떡밥, 3~4줄)

### 감정 흐름
- 기: (감정 키워드)
- 승: (감정 키워드)
- 전: (감정 키워드)
- 결: (감정 키워드)

### 3인격 포인트
- 위소운: (이 화에서의 핵심 행동/감정)
- 이준혁: (이 화에서의 핵심 대사/분석)
- 천마: (이 화에서의 핵심 코멘트/행동)

### 핵심 장면 (2~3개)
1. (장면 설명)
2. (장면 설명)

### 코미디 요소
- (이 화의 웃긴 포인트)

반드시 참조:
- master_story_bible에서 제{ep_num}화 해당 블록
- 소설_진행_마스터 §2의 다음 화 주의사항
- 이전 화 마지막 장면과 자연스럽게 연결
"""

    plan = call_api(client, cached_sys, prompt, tracker, max_tokens=4096)
    if not plan:
        return None

    # 설계안 표시
    print(f"\n{'─'*60}")
    print(plan)
    print(f"{'─'*60}")

    # 사용자 승인 루프
    while True:
        print("\n  선택지:")
        print("    y = 승인")
        print("    r = 재생성 (다시 만들어줘)")
        print("    e = 수정 요청 (이런 부분 바꿔줘)")
        print("    q = 종료")
        choice = input("\n  → ").strip().lower()

        if choice == 'y':
            print("  ✅ 설계안 승인 완료!")
            return plan

        elif choice == 'r':
            print("  🔄 재생성 중...")
            plan = call_api(client, cached_sys, prompt, tracker, max_tokens=4096)
            if plan:
                print(f"\n{'─'*60}")
                print(plan)
                print(f"{'─'*60}")

        elif choice == 'e':
            print("  ✏️ 수정할 내용을 입력하세요 (빈 줄로 완료):")
            edits = []
            while True:
                line = input("  > ").strip()
                if not line:
                    break
                edits.append(line)
            if edits:
                edit_req = "\n".join(edits)
                revised_prompt = (
                    f"[이전 설계안]\n{plan}\n\n"
                    f"[사용자 수정 요청]\n{edit_req}\n\n"
                    f"위 수정 사항을 반영하여 설계안 전체를 다시 작성하세요. "
                    f"형식은 동일하게 유지하세요."
                )
                plan = call_api(client, cached_sys, revised_prompt, tracker, max_tokens=4096)
                if plan:
                    print(f"\n{'─'*60}")
                    print(plan)
                    print(f"{'─'*60}")

        elif choice == 'q':
            return None


def step_write(client, cached_sys, dynamic_ctx, plan, char_sheets, ep_num, tracker):
    """
    ┌─────────────────────────────────────┐
    │ STEP 2: 본문 집필  (자동)           │
    │ 기→승→전→결 순서로 작성             │
    │ 이전 섹션 내용을 다음 섹션에 전달    │
    └─────────────────────────────────────┘
    """
    print(f"\n{'━'*60}")
    print(f"  📝 STEP 2/5 — 제{ep_num}화 본문 집필")
    print(f"{'━'*60}")

    sections = [
        ("기(起) — 도입", "기"),
        ("승(承) — 전개", "승"),
        ("전(轉) — 전환점", "전"),
        ("결(結) — 마무리", "결"),
    ]

    full_text = f"# 제{ep_num}화\n\n"

    for idx, (sec_name, sec_label) in enumerate(sections):
        print(f"  [{idx+1}/4] {sec_name} 작성 중...", end="", flush=True)
        t0 = time.time()

        # 이전 섹션들을 컨텍스트로 (연속성)
        prev_content = full_text if idx > 0 else "(첫 섹션입니다.)"

        prompt = f"""{dynamic_ctx}

{char_sheets}

[승인된 설계안]
{plan}

[지금까지 작성된 본문]
{prev_content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[지시] 제{ep_num}화의 '{sec_name}' 섹션을 작성하세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

필수 규칙:
1. 소설체 (지시문/대본/시나리오 형식 금지)
2. 한 장면 최소 3~5문단 (풍경→감정→대사→행동→반응)
3. 대사 전후에 행동/표정/몸짓 묘사 필수
4. 독백 = 소괄호 (), 간판/이름 = 작은따옴표 ''
5. 말투 엄수:
   - 위소운 = 무인의 과묵함, 행동으로 말함
   - 이준혁 = 존댓말 ("~습니다", "~이죠")
   - 천마 = 반말 (건방지고 짧다. "시" 존경 접미사 절대 금지)
6. 몸은 100% 위소운. 천마·이준혁은 머릿속 목소리.
7. 감정은 증거로: ❌"슬펐다" → ✅"찻잔 쥔 손가락이 하얘졌다"
8. 오감 최소 3개 겹치기 (시각+청각+촉각 등)
9. 문단은 호흡: 짧은 문단=긴장, 긴 문단=몰입, 리듬 섞기

분량: 150~200줄.
앞 섹션과 자연스럽게 이어지도록 작성하세요.
설계안의 '{sec_label}' 파트에 충실하되, 소설적 상상력을 발휘하세요.
"""

        section_text = call_api(client, cached_sys, prompt, tracker)
        elapsed = time.time() - t0

        if not section_text:
            print(f" ❌")
            return None

        full_text += f"\n---\n\n{section_text}\n"
        print(f" ✅ ({len(section_text):,}자, {elapsed:.0f}초)")

    return full_text


def step_video_memo(client, cached_sys, episode_text, ep_num, tracker):
    """
    ┌─────────────────────────────────────┐
    │ STEP 3: 영상화 메모 + 다음화 예고   │
    │ 전부 자동                           │
    └─────────────────────────────────────┘
    """
    print(f"\n  🎬 STEP 3/5 — 영상화 메모 생성 중...", end="", flush=True)

    prompt = f"""[완성된 본문 — 마지막 3000자]
{episode_text[-3000:]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[지시] 다음 두 가지를 작성하세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## [다음 화 예고]
(독자 흥미를 끌어당기는 예고 3줄)

## [🎬 영상화 메모]
유튜브 숏폼/웹소설 영상화를 위한 핵심 장면표.

| 타임 | 장면 | 연출 포인트 |
|------|------|------------|
| 00:00 | (장면) | (카메라, BGM, 효과) |

핵심 장면 3~5개만 선정.
"""

    memo = call_api(client, cached_sys, prompt, tracker, max_tokens=4096)
    if memo:
        print(f" ✅")
    else:
        print(f" ❌")
        memo = "[영상화 메모 생성 실패 — Cursor에서 수동 작성]"

    return memo


def step_validate(episode_text):
    """
    ┌─────────────────────────────────────┐
    │ STEP 4: EP 규칙 자동 검수  (자동)   │
    │ API 호출 없음 = 비용 $0             │
    └─────────────────────────────────────┘
    """
    print(f"\n  🔍 STEP 4/5 — EP 규칙 자동 검수")

    warnings = []

    # EP-001: 몸 소유권 (이준혁/천마가 직접 몸을 움직이면 안 됨)
    ep001 = r"(?:이준혁|천마)(?:이|가|은|는)?\s*(?:만졌다|손을 뻗|걸었다|일어섰다|앉았다|뛰었다|잡았다|들었다|내려놓)"
    for m in re.finditer(ep001, episode_text):
        ln = episode_text[:m.start()].count("\n") + 1
        warnings.append(f"  ⚠️ EP-001 (몸소유권) L{ln}: '{m.group()[:30]}'")

    # EP-002: 천마 존칭 금지 ("~시오", "~시겠" 등)
    lines = episode_text.split("\n")
    for i, line in enumerate(lines):
        if "천마" in line or "낮은 목소리" in line:
            window = "\n".join(lines[max(0, i-1):min(len(lines), i+4)])
            for pat in [r"하시오", r"하시겠", r"보시오", r"드시오", r"가시오"]:
                if re.search(pat, window):
                    warnings.append(f"  ⚠️ EP-002 (천마존칭) L{i+1}: '{pat}' 감지")

    # EP-002: "시끄러" 횟수 (3화당 최대 1회)
    count = len(re.findall(r"시끄러", episode_text))
    if count > 1:
        warnings.append(f"  ⚠️ EP-002 '시끄러' {count}회 (3화당 1회 제한)")

    # EP-003: 서기연도 금지
    for m in re.finditer(r"\d{3,4}\s*년", episode_text):
        ln = episode_text[:m.start()].count("\n") + 1
        warnings.append(f"  ⚠️ EP-003 (서기연도) L{ln}: '{m.group()}'")

    # 독백 표기 확인 (긴 작은따옴표 → 독백이면 소괄호로 바꿔야 함)
    for m in re.finditer(r"'[^']{15,}'", episode_text):
        ln = episode_text[:m.start()].count("\n") + 1
        warnings.append(f"  💡 확인필요 L{ln}: 긴 작은따옴표 → 독백이면 ()로 변경")

    # 결과 출력
    if warnings:
        print(f"  ⚠️ {len(warnings)}건 감지:")
        for w in warnings:
            print(f"    {w}")
    else:
        print(f"  ✅ EP 규칙 검수 통과! 이상 없음.")

    return warnings


def step_save(ep_num, episode_text, video_memo):
    """
    ┌─────────────────────────────────────┐
    │ STEP 5: 저장  (자동 + 사람)         │
    │ 사람 → 최종 저장 결정               │
    │ 자동 → 파일 쓰기                    │
    └─────────────────────────────────────┘
    """
    print(f"\n{'━'*60}")
    print(f"  💾 STEP 5/5 — 저장")
    print(f"{'━'*60}")

    # 최종 텍스트 합치기
    final = f"{episode_text}\n\n---\n\n{video_memo}\n"
    total_lines = len(final.split("\n"))
    total_chars = len(final)

    # 미리보기
    preview = final.split("\n")[:15]
    print(f"\n  [미리보기 — 처음 15줄]")
    for line in preview:
        print(f"  │ {line}")
    print(f"  │ ...")
    print(f"  │ (총 {total_lines}줄, {total_chars:,}자)")

    # 저장 확인
    choice = input(f"\n  제{ep_num}화를 저장하시겠습니까? (y/n): ").strip().lower()
    if choice != 'y':
        # 저장 안 해도 텍스트는 표시 (복사해서 쓸 수 있게)
        show = input("  저장 안 함. 전체 텍스트를 화면에 출력할까요? (y/n): ").strip().lower()
        if show == 'y':
            print(f"\n{'─'*60}")
            print(final)
            print(f"{'─'*60}")
        return False

    # 디렉토리 확인/생성
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"제{ep_num}화.md"

    # 파일 쓰기
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final)

    print(f"  ✅ 저장 완료: {output_path}")

    # 마스터 업데이트 안내
    print(f"\n  📌 다음 작업 안내:")
    print(f"     Cursor에서 '소설_진행_마스터.md 업데이트해줘'라고 요청하세요.")
    print(f"     (또는 이 도구의 다음 버전에서 자동 업데이트 예정)")

    return True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. 메인 CLI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_latest_episode():
    """output/ 폴더에서 가장 최근 화수를 찾습니다."""
    if not OUTPUT_DIR.exists():
        return 0
    nums = []
    for ep in OUTPUT_DIR.glob("제*화.md"):
        match = re.search(r"제(\d+)화", ep.name)
        if match:
            nums.append(int(match.group(1)))
    return max(nums) if nums else 0


def main():
    """
    메인 실행 — 터미널에서 대화형으로 진행.

    실행: python backend/novel_writer.py
    """
    print()
    print("━" * 60)
    print("  🏭 노벨 팩토리 — 반자동 소설 집필 도구")
    print("━" * 60)
    print()
    print("  자동: 참조로딩, EP검수, 영상메모, 저장")
    print("  사람: 설계안 승인, 완성본 퇴고, 최종 결정")
    print("  비용: API 캐싱으로 입력 비용 최대 90% 절감")
    print()
    print("━" * 60)

    # ── 1. 환경 설정 ──
    client = setup()
    tracker = CostTracker()

    # ── 2. 화수 결정 ──
    latest = get_latest_episode()
    next_ep = latest + 1
    print(f"\n  📋 현재 최신화: {latest}화")
    print(f"  📝 다음 화: {next_ep}화")

    ep_input = input(f"\n  몇 화를 쓸까요? (Enter = {next_ep}화): ").strip()
    ep_num = int(ep_input) if ep_input.isdigit() else next_ep

    # 기존 파일 체크
    if (OUTPUT_DIR / f"제{ep_num}화.md").exists():
        ow = input(f"  ⚠️ 제{ep_num}화가 이미 있습니다. 덮어쓸까요? (y/n): ").strip().lower()
        if ow != 'y':
            print("  종료합니다.")
            return

    print(f"\n  🚀 제{ep_num}화 집필 시작!")
    print(f"{'━'*60}")

    # ── 3. 참조 자료 로딩 ──
    print(f"\n  ⏳ 참조 자료 로딩 중...")
    t0 = time.time()
    static_ctx = load_static_context()
    dynamic_ctx = load_dynamic_context(ep_num)
    print(f"  ⏱️ 로딩 완료 ({time.time()-t0:.1f}초)")

    # ── 4. STEP 1: 설계안 ──
    plan = step_plan(client, static_ctx, dynamic_ctx, ep_num, tracker)
    if not plan:
        print("\n  종료합니다.")
        tracker.summary()
        return

    # ── 5. 캐릭터 시트 추출 ──
    char_sheets = extract_characters(plan)

    # ── 6. STEP 2: 본문 집필 ──
    episode_text = step_write(
        client, static_ctx, dynamic_ctx, plan, char_sheets, ep_num, tracker
    )
    if not episode_text:
        print("\n  집필 실패.")
        tracker.summary()
        return

    # 본문 확인
    print(f"\n  📄 본문 완성: {len(episode_text):,}자")
    show = input("  전체 본문을 표시할까요? (y/n): ").strip().lower()
    if show == 'y':
        print(f"\n{'─'*60}")
        print(episode_text)
        print(f"{'─'*60}")

    # ── 7. STEP 3: 영상화 메모 ──
    video_memo = step_video_memo(
        client, static_ctx, episode_text, ep_num, tracker
    )

    # ── 8. STEP 4: EP 검수 ──
    warnings = step_validate(episode_text)
    if warnings:
        proceed = input(f"\n  {len(warnings)}건 경고. 계속 저장할까요? (y/n): ").strip().lower()
        if proceed != 'y':
            print("  수정 후 다시 실행해주세요.")
            tracker.summary()
            return

    # ── 9. STEP 5: 저장 ──
    saved = step_save(ep_num, episode_text, video_memo)

    # ── 10. 비용 요약 ──
    tracker.summary()

    if saved:
        print("━" * 60)
        print(f"  🎉 제{ep_num}화 집필 완료!")
        print("━" * 60)
    print()


if __name__ == "__main__":
    main()
