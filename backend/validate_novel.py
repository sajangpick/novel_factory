# -*- coding: utf-8 -*-
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Novel Alchemist] 소설 물리 검증기 (Scene Validator)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

소설 본문(.md)을 분석하여 물리적 오류를 자동 감지합니다.

사용법:
  python validate_novel.py                    # output/text/ 전체 검증
  python validate_novel.py 제1화.md           # 특정 화 검증
  python validate_novel.py --detail 제1화.md  # 상세 모드

검증 항목:
  1. 지형 충돌 감지 (포구+절벽 등 양립 불가 조합)
  2. 인원/고립 검증 (공공장소에서 혼자인 경우)
  3. 물리 수치 검증 (추락 높이, 이동 거리 등)
  4. 시간 흐름 검증 (전 화와 시간 모순)
  5. 캐릭터 말투 검증 (천마 존칭, 이준혁 반말 등)
  6. EP 실수 방지 검증 (기존 발견된 오류 패턴)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import re
import sys
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. 데이터 클래스
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class Warning:
    """검증 경고 하나를 담는 클래스"""
    level: str          # "⚠️ 경고" 또는 "🔴 오류"
    category: str       # 검증 카테고리 (지형, 인원, 물리, 시간, 말투, EP)
    line_num: int       # 해당 줄 번호 (대략적)
    scene_num: int      # 해당 장면 번호
    message: str        # 경고 메시지
    suggestion: str     # 수정 제안


@dataclass
class Scene:
    """장면(씬) 하나를 담는 클래스"""
    num: int            # 장면 번호
    start_line: int     # 시작 줄 번호
    end_line: int       # 끝 줄 번호
    text: str           # 장면 텍스트
    section: str        # 기/승/전/결


@dataclass
class ValidationResult:
    """전체 검증 결과"""
    filename: str
    total_scenes: int
    warnings: List[Warning] = field(default_factory=list)
    passes: List[str] = field(default_factory=list)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. 검증 규칙 데이터베이스
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# --- 2-1. 지형 충돌 규칙 ---
# (장소 키워드, 양립 불가 지형 키워드, 설명)
TERRAIN_CONFLICTS = [
    # 포구/항구 = 수면 높이 → 절벽 불가
    (["포구", "항구", "선착장", "부두", "나루터"],
     ["절벽", "낭떠러지", "벼랑", "천길"],
     "포구/항구는 수면 높이입니다. 절벽이 있을 수 없습니다."),

    # 평야/들판 = 평지 → 절벽/협곡 불가
    (["평야", "들판", "벌판", "초원"],
     ["절벽", "협곡", "낭떠러지", "천길 낭떠러지"],
     "평야/들판에는 절벽이나 협곡이 없습니다."),

    # 사막 → 호수/강 불가 (오아시스는 예외)
    (["사막", "모래벌판"],
     ["호수", "큰 강", "폭포"],
     "사막에 호수나 큰 강이 있으면 지형 설명이 필요합니다."),

    # 동굴 내부 → 햇빛/바람 (출구 근처 아니면 불가)
    (["동굴 깊숙", "동굴 안쪽", "지하"],
     ["햇빛이 내리", "햇살이 비", "따뜻한 바람"],
     "동굴 깊숙한 곳에서 햇빛이나 따뜻한 바람은 불가합니다. 출구 근처인지 확인하세요."),
]

# --- 2-2. 공공장소 목록 (사람이 있어야 하는 곳) ---
PUBLIC_PLACES = [
    "포구", "항구", "시장", "저자거리", "객잔", "주막", "거리",
    "성문", "관아", "상단", "기루", "도박장", "연무장", "광장",
    "나루터", "부두", "선착장", "주점", "찻집", "약방"
]

# --- 2-3. 고립 키워드 ---
ISOLATION_WORDS = [
    "혼자", "아무도 없", "인적이 없", "텅 빈", "사람 하나 없",
    "적막", "고요한", "쥐 죽은 듯", "홀로"
]

# --- 2-4. 야간 키워드 ---
NIGHT_WORDS = [
    "삼경", "사경", "오경", "야간", "한밤", "밤중", "자정",
    "깊은 밤", "밤 늦", "달빛만", "어둠 속"
]

# --- 2-5. 물리 수치 한계 ---
# (단위, 최대 합리값, 경고 메시지)
PHYSICAL_LIMITS = {
    "추락_생존": {
        "pattern": r"(\d+)\s*장.*(?:높이|추락|떨어|낙하)",
        "max_value": 3,  # 3장(약 9미터) 이상 추락 후 생존은 의심
        "message": "{}장(약 {}미터) 높이에서 추락 후 생존은 비현실적일 수 있습니다.",
        "multiplier": 3  # 1장 ≈ 3미터
    },
    "일일_이동거리": {
        "pattern": r"(\d+)\s*리.*(?:걸|이동|달려|말을 달)",
        "max_value": 200,  # 도보 기준 하루 200리(약 80km) 이상은 의심
        "message": "하루에 {}리(약 {}km) 이동은 비현실적일 수 있습니다.",
        "multiplier": 0.4  # 1리 ≈ 0.4km
    }
}

# --- 2-6. 캐릭터 말투 규칙 ---
SPEECH_RULES = {
    "천마_존칭금지": {
        "speaker_pattern": r"(?:천마|낮은 목소리).*?['\"](.+?)['\"]",
        "forbidden": [r"하시오", r"하시겠", r"보시오", r"드시오", r"가시오", r"오시오"],
        "message": "천마는 존칭(~시오)을 사용하지 않습니다. → '~하오', '~하라'로 수정",
    },
    "이준혁_반말금지": {
        "speaker_pattern": r"(?:이준혁).*?['\"](.+?)['\"]",
        "forbidden": [r"해라$", r"하냐$", r"인가$", r"뭐야$"],
        "message": "이준혁은 존댓말을 사용합니다. 반말 패턴이 감지되었습니다.",
    }
}

# --- 2-7. EP 실수 방지 패턴 ---
EP_PATTERNS = {
    "EP-001_몸소유권": {
        "pattern": r"(?:이준혁|천마)(?:이|가|은|는)?\s*(?:만졌다|손을 뻗|걸었다|일어섰다|앉았다|뛰었다|잡았다|들었다|내려놓)",
        "message": "EP-001: 이준혁/천마가 직접 몸을 움직이는 묘사 (몸은 위소운 것)",
        "suggestion": "감각 동사로 변경: '느꼈다', '보였다', '~하려 했지만 안 됐다'"
    },
    "EP-003_서기연도": {
        "pattern": r"\d{3,4}\s*년",
        "message": "EP-003: 구체적 연도 사용 (이 세계는 가상 세계, 서기 없음)",
        "suggestion": "'아주 오래 전', '먼 미래에서 왔다' 등으로 대체"
    },
    "EP-005_화수언급": {
        "pattern": r"\d+화에서|\d+화 전에|지난 화",
        "message": "EP-005: 본문에서 화수 직접 언급 금지",
        "suggestion": "'며칠 전', '어제', '그때' 등 시간 표현으로 대체"
    },
    "EP-006_이준혁단정": {
        "pattern": r"이준혁.*?['\"].*?(?:이 시대에는?|이 세계에는?).*?(?:있다|없다|한계)['\"]",
        "message": "EP-006: 이준혁이 이 시대 정보를 근거 없이 단정",
        "suggestion": "관찰('시장에서 봤다') 또는 질문('위소운 님, ~있습니까?')으로 변경"
    }
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. 파서 (소설 텍스트 → 장면 분리)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def parse_scenes(text: str) -> List[Scene]:
    """소설 텍스트를 장면(씬) 단위로 분리합니다.
    
    구분 기준:
    - '---' 구분선
    - '## 기(起)', '## 승(承)' 등 섹션 헤더
    """
    lines = text.split("\n")
    scenes = []
    current_scene_lines = []
    current_start = 1
    current_section = "기"
    scene_count = 0

    for i, line in enumerate(lines, 1):
        # 섹션 헤더 감지 (## 기, ## 승, ## 전, ## 결)
        section_match = re.match(r"##\s*(기|승|전|결)", line)
        if section_match:
            current_section = section_match.group(1)

        # 장면 구분선 감지 (---)
        if re.match(r"^-{3,}$", line.strip()):
            if current_scene_lines:
                scene_count += 1
                scene_text = "\n".join(current_scene_lines)
                # 빈 장면은 건너뜀
                if scene_text.strip():
                    scenes.append(Scene(
                        num=scene_count,
                        start_line=current_start,
                        end_line=i - 1,
                        text=scene_text,
                        section=current_section
                    ))
            current_scene_lines = []
            current_start = i + 1
        else:
            current_scene_lines.append(line)

    # 마지막 장면 처리
    if current_scene_lines:
        scene_count += 1
        scene_text = "\n".join(current_scene_lines)
        if scene_text.strip():
            scenes.append(Scene(
                num=scene_count,
                start_line=current_start,
                end_line=len(lines),
                text=scene_text,
                section=current_section
            ))

    return scenes


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. 검증 엔진
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def check_terrain_conflicts(scenes: List[Scene]) -> List[Warning]:
    """지형 충돌 검사: 양립 불가 장소+지형 조합 감지"""
    warnings = []
    for scene in scenes:
        text = scene.text
        for place_words, terrain_words, desc in TERRAIN_CONFLICTS:
            # 장소 키워드 존재 여부
            found_place = None
            for pw in place_words:
                if pw in text:
                    found_place = pw
                    break
            if not found_place:
                continue

            # 양립 불가 지형 키워드 존재 여부
            found_terrain = None
            for tw in terrain_words:
                if tw in text:
                    found_terrain = tw
                    break
            if not found_terrain:
                continue

            # 둘 다 있으면 → 경고
            warnings.append(Warning(
                level="🔴 오류",
                category="지형 충돌",
                line_num=scene.start_line,
                scene_num=scene.num,
                message=f"'{found_place}' + '{found_terrain}' 동시 등장. {desc}",
                suggestion=f"장소를 바꾸거나('{found_place}'가 아닌 곳) 지형을 바꾸세요('{found_terrain}' 제거)."
            ))
    return warnings


def check_isolation(scenes: List[Scene]) -> List[Warning]:
    """인원/고립 검증: 공공장소에서 혼자인 경우 감지"""
    warnings = []
    for scene in scenes:
        text = scene.text

        # 공공장소 키워드 찾기
        found_place = None
        for place in PUBLIC_PLACES:
            if place in text:
                found_place = place
                break
        if not found_place:
            continue

        # 고립 키워드 찾기
        found_isolation = None
        for iso in ISOLATION_WORDS:
            if iso in text:
                found_isolation = iso
                break
        if not found_isolation:
            continue

        # 공공장소 + 고립 = 경고
        # 야간이면 경고 레벨 상승
        is_night = any(nw in text for nw in NIGHT_WORDS)
        level = "🔴 오류" if is_night else "⚠️ 경고"
        time_note = " (야간이라 더 의심됨)" if is_night else ""

        warnings.append(Warning(
            level=level,
            category="인원 불일치",
            line_num=scene.start_line,
            scene_num=scene.num,
            message=f"'{found_place}'(공공장소)에서 '{found_isolation}'{time_note}. 다른 사람이 없는 이유가 필요합니다.",
            suggestion="혼자인 이유를 명시하거나, 장소를 외진 곳으로 변경하세요."
        ))
    return warnings


def check_physical_values(scenes: List[Scene]) -> List[Warning]:
    """물리 수치 검증: 높이, 거리 등 비현실적 수치 감지"""
    warnings = []
    for scene in scenes:
        text = scene.text
        for check_name, check_info in PHYSICAL_LIMITS.items():
            matches = re.finditer(check_info["pattern"], text)
            for match in matches:
                value = int(match.group(1))
                if value > check_info["max_value"]:
                    converted = value * check_info["multiplier"]
                    warnings.append(Warning(
                        level="⚠️ 경고",
                        category="물리 수치",
                        line_num=scene.start_line,
                        scene_num=scene.num,
                        message=check_info["message"].format(value, int(converted)),
                        suggestion=f"수치를 낮추거나, 생존/이동의 특별한 이유를 명시하세요."
                    ))
    return warnings


def check_speech_patterns(text: str, filename: str) -> List[Warning]:
    """캐릭터 말투 검증: 천마 존칭, 이준혁 반말 등 감지"""
    warnings = []
    lines = text.split("\n")

    for i, line in enumerate(lines, 1):
        # 천마 존칭 체크 — 천마 대사에서 '시오' 패턴 찾기
        # 천마 대사는 보통 '...' (천마) 또는 낮은 목소리 뒤에 옴
        if "천마" in line or "낮은 목소리" in line:
            # 같은 줄 또는 다음 몇 줄에서 대사 찾기
            check_range = "\n".join(lines[max(0, i-1):min(len(lines), i+3)])
            for forbidden in SPEECH_RULES["천마_존칭금지"]["forbidden"]:
                if re.search(forbidden, check_range):
                    warnings.append(Warning(
                        level="⚠️ 경고",
                        category="말투 위반",
                        line_num=i,
                        scene_num=0,
                        message=f"천마 대사 근처에서 존칭 패턴 '{forbidden}' 감지",
                        suggestion="'~하오', '~하라'로 수정하세요."
                    ))
    return warnings


def check_ep_patterns(scenes: List[Scene]) -> List[Warning]:
    """EP 실수 방지 패턴 검증: 기존 발견된 오류 패턴 감지"""
    warnings = []
    for scene in scenes:
        text = scene.text
        for ep_name, ep_info in EP_PATTERNS.items():
            matches = re.finditer(ep_info["pattern"], text)
            for match in matches:
                # 발견된 텍스트의 줄 번호 계산
                pos = match.start()
                line_num = scene.start_line + text[:pos].count("\n")
                warnings.append(Warning(
                    level="⚠️ 경고",
                    category=f"EP위반({ep_name[:6]})",
                    line_num=line_num,
                    scene_num=scene.num,
                    message=f"{ep_info['message']} → '{match.group()[:30]}...'",
                    suggestion=ep_info["suggestion"]
                ))
    return warnings


def check_time_consistency(all_episodes: dict) -> List[Warning]:
    """시간 흐름 검증: 에피소드 간 시간 모순 감지
    
    all_episodes: {파일명: 텍스트} 딕셔너리
    """
    warnings = []
    # 시간 키워드 추출 (마지막 장면의 시간대)
    time_keywords = {
        "아침": ["아침", "해가 뜨", "묘시", "진시", "새벽"],
        "낮": ["점심", "한낮", "오시", "미시", "사시"],
        "저녁": ["저녁", "해가 지", "해질", "신시", "유시"],
        "밤": ["밤", "삼경", "사경", "오경", "자시", "축시", "인시", "술시", "해시", "달빛"],
    }

    prev_time = None
    prev_name = None

    # 파일명 정렬 (제1화, 제2화, ...)
    sorted_files = sorted(all_episodes.keys(),
                          key=lambda x: int(re.search(r"(\d+)", x).group(1)) if re.search(r"\d+", x) else 0)

    for filename in sorted_files:
        text = all_episodes[filename]
        # 마지막 500자에서 시간대 추출
        last_part = text[-500:]
        current_time = None
        for period, keywords in time_keywords.items():
            if any(kw in last_part for kw in keywords):
                current_time = period
                break

        if prev_time and current_time:
            # 시간 순서 검증 (밤 → 아침은 OK, 밤 → 낮도 OK, 아침 → 밤은 경고)
            valid_transitions = {
                "아침": ["아침", "낮", "저녁", "밤"],
                "낮": ["낮", "저녁", "밤"],
                "저녁": ["저녁", "밤", "아침"],  # 저녁→아침 = 다음날
                "밤": ["밤", "아침", "낮"],       # 밤→아침 = 다음날
            }
            # 첫 부분의 시간대도 확인
            first_part = text[:500]
            start_time = None
            for period, keywords in time_keywords.items():
                if any(kw in first_part for kw in keywords):
                    start_time = period
                    break

            if start_time and start_time not in valid_transitions.get(prev_time, []):
                warnings.append(Warning(
                    level="⚠️ 경고",
                    category="시간 흐름",
                    line_num=1,
                    scene_num=1,
                    message=f"'{prev_name}' 끝 = {prev_time} → '{filename}' 시작 = {start_time}. 시간 흐름이 맞는지 확인하세요.",
                    suggestion="전 화 끝과 이번 화 시작 사이의 시간 경과를 명시하세요."
                ))

        prev_time = current_time
        prev_name = filename

    return warnings


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. 메인 검증 실행기
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def validate_file(filepath: str) -> ValidationResult:
    """단일 파일 검증"""
    filename = os.path.basename(filepath)

    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    scenes = parse_scenes(text)
    result = ValidationResult(filename=filename, total_scenes=len(scenes))

    # --- 검증 실행 ---
    # 1. 지형 충돌
    terrain_warns = check_terrain_conflicts(scenes)
    result.warnings.extend(terrain_warns)
    if not terrain_warns:
        result.passes.append("✅ 지형 충돌: 이상 없음")

    # 2. 인원/고립
    isolation_warns = check_isolation(scenes)
    result.warnings.extend(isolation_warns)
    if not isolation_warns:
        result.passes.append("✅ 인원 검증: 이상 없음")

    # 3. 물리 수치
    physical_warns = check_physical_values(scenes)
    result.warnings.extend(physical_warns)
    if not physical_warns:
        result.passes.append("✅ 물리 수치: 이상 없음")

    # 4. 말투 검증
    speech_warns = check_speech_patterns(text, filename)
    result.warnings.extend(speech_warns)
    if not speech_warns:
        result.passes.append("✅ 말투 검증: 이상 없음")

    # 5. EP 패턴
    ep_warns = check_ep_patterns(scenes)
    result.warnings.extend(ep_warns)
    if not ep_warns:
        result.passes.append("✅ EP 패턴: 이상 없음")

    return result


def validate_all(directory: str) -> List[ValidationResult]:
    """디렉토리 내 모든 .md 파일 검증 + 에피소드 간 시간 검증"""
    results = []
    all_episodes = {}

    # .md 파일 수집
    md_files = sorted(Path(directory).glob("제*화.md"))

    for md_file in md_files:
        # 개별 파일 검증
        result = validate_file(str(md_file))
        results.append(result)

        # 시간 검증용 텍스트 저장
        with open(md_file, "r", encoding="utf-8") as f:
            all_episodes[md_file.name] = f.read()

    # 에피소드 간 시간 흐름 검증
    if len(all_episodes) > 1:
        time_warns = check_time_consistency(all_episodes)
        if time_warns:
            # 시간 경고는 첫 번째 결과에 추가
            for w in time_warns:
                results[0].warnings.append(w)

    return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. 출력 포맷터
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def print_result(result: ValidationResult, detail: bool = False):
    """검증 결과를 보기 좋게 출력"""
    # 헤더
    error_count = len([w for w in result.warnings if w.level == "🔴 오류"])
    warn_count = len([w for w in result.warnings if w.level == "⚠️ 경고"])
    pass_count = len(result.passes)

    print(f"\n{'='*60}")
    print(f"📄 {result.filename} | 장면 {result.total_scenes}개")
    print(f"{'='*60}")

    # 통과 항목
    for p in result.passes:
        print(f"  {p}")

    # 경고/오류
    if result.warnings:
        print(f"\n  {'─'*50}")
        # 카테고리별 그룹핑
        categories = {}
        for w in result.warnings:
            if w.category not in categories:
                categories[w.category] = []
            categories[w.category].append(w)

        for cat, warns in categories.items():
            print(f"\n  📌 [{cat}] — {len(warns)}건")
            for w in warns:
                print(f"    {w.level} L{w.line_num}: {w.message}")
                if detail:
                    print(f"         💡 {w.suggestion}")

    # 요약
    print(f"\n  {'─'*50}")
    if error_count == 0 and warn_count == 0:
        print(f"  🟢 결과: 모든 검증 통과! ({pass_count}개 항목)")
    elif error_count == 0:
        print(f"  🟡 결과: 경고 {warn_count}건 (오류 없음, 검토 권장)")
    else:
        print(f"  🔴 결과: 오류 {error_count}건 + 경고 {warn_count}건 (수정 필요)")
    print(f"{'='*60}\n")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. CLI 실행
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def main():
    """커맨드라인 실행"""
    import io
    # Windows 콘솔 UTF-8 출력 강제
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    # 프로젝트 루트 경로
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_dir = project_root / "output" / "text"

    # 인자 파싱
    detail = "--detail" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    print("\n" + "━" * 60)
    print("  🔍 소설 물리 검증기 (Novel Scene Validator)")
    print("━" * 60)

    if args:
        # 특정 파일 검증
        for arg in args:
            # 파일 경로 구성
            if os.path.exists(arg):
                filepath = arg
            elif os.path.exists(output_dir / arg):
                filepath = str(output_dir / arg)
            else:
                print(f"\n  ❌ 파일을 찾을 수 없습니다: {arg}")
                continue

            result = validate_file(filepath)
            print_result(result, detail=detail)
    else:
        # 전체 검증
        if not output_dir.exists():
            print(f"\n  ❌ 출력 폴더를 찾을 수 없습니다: {output_dir}")
            return

        results = validate_all(str(output_dir))
        if not results:
            print(f"\n  ❌ 검증할 파일이 없습니다: {output_dir}")
            return

        for result in results:
            print_result(result, detail=detail)

        # 전체 요약
        total_errors = sum(len([w for w in r.warnings if w.level == "🔴 오류"]) for r in results)
        total_warns = sum(len([w for w in r.warnings if w.level == "⚠️ 경고"]) for r in results)

        print("━" * 60)
        print(f"  📊 전체 요약: {len(results)}개 파일 검증 완료")
        print(f"     🔴 오류: {total_errors}건")
        print(f"     ⚠️ 경고: {total_warns}건")
        if total_errors == 0 and total_warns == 0:
            print(f"     🟢 전체 통과!")
        print("━" * 60 + "\n")


if __name__ == "__main__":
    main()
