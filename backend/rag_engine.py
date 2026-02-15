"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[RAG Engine] 무림 세계관 검색 엔진
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

novels/murim_mna/world_db/*.md 파일들을 로드하고 검색 기능을 제공합니다.

검색 모드:
1. 키워드 검색 (기본) - 항상 동작, 외부 API 불필요
2. 시맨틱 검색 (선택) - OpenAI Embeddings API 필요

사용 예시:
  engine = RAGEngine("../novels/murim_mna/world_db")
  results = engine.search("화산파 위치", top_k=5)
"""

import os
import re
from pathlib import Path
from typing import Optional


class Document:
    """세계관 문서 하나를 나타내는 클래스"""

    def __init__(self, name: str, category: str, content: str, path: str):
        self.name = name           # 파일명 (확장자 제외)
        self.category = category   # 카테고리 (파일명에서 추론)
        self.content = content     # 전체 텍스트
        self.path = path           # 파일 경로
        self.chunks: list[dict] = []  # 분할된 청크들


class Chunk:
    """문서의 분할된 조각"""

    def __init__(self, doc_name: str, category: str, heading: str, text: str, index: int):
        self.doc_name = doc_name
        self.category = category
        self.heading = heading     # 해당 청크의 제목/헤딩
        self.text = text           # 청크 본문
        self.index = index         # 청크 순서
        self.score: float = 0.0    # 검색 점수


# ── 카테고리 매핑 (파일명 → 카테고리) ──
CATEGORY_MAP = {
    "지리": "지리/지역",
    "객잔": "지리/객잔",
    "이동": "지리/이동",
    "음식": "생활/음식·건축",
    "건축": "생활/음식·건축",
    "의복": "생활/의복",
    "복식": "생활/의복",
    "무공": "무공/전투",
    "무기": "무공/병기",
    "병기": "무공/병기",
    "캐릭터": "인물",
    "인명록": "인물",
    "성장표": "인물/성장",
    "세력도": "세력/조직",
    "조직도": "세력/조직",
    "경영": "경영/용어",
    "무협": "무협/용어",
    "로드맵": "스토리/로드맵",
    "출연자": "스토리/출연자",
    "루트맵": "스토리/루트맵",
    "6하원칙": "템플릿/설계",
    "스켈레톤": "템플릿/뼈대",
}


def _guess_category(filename: str) -> str:
    """파일명에서 카테고리를 추론합니다"""
    for keyword, category in CATEGORY_MAP.items():
        if keyword in filename:
            return category
    return "기타"


class RAGEngine:
    """
    무림 세계관 RAG 검색 엔진

    사용법:
        engine = RAGEngine("../novels/murim_mna/world_db")
        engine.load()
        results = engine.search("화산파", top_k=5)
    """

    def __init__(self, docs_path: str):
        self.docs_path = Path(docs_path)
        self.documents: list[Document] = []
        self.chunks: list[Chunk] = []
        self._loaded = False

    def load(self) -> int:
        """world_db 폴더의 모든 .md 파일을 로드하고 청크로 분할합니다"""
        self.documents = []
        self.chunks = []

        if not self.docs_path.exists():
            print(f"⚠️ 경로가 존재하지 않습니다: {self.docs_path}")
            return 0

        md_files = sorted(self.docs_path.glob("*.md"))
        print(f"📂 {len(md_files)}개의 .md 파일 발견")

        for md_file in md_files:
            try:
                content = md_file.read_text(encoding="utf-8")
                name = md_file.stem  # 확장자 제외 파일명
                category = _guess_category(name)

                doc = Document(
                    name=name,
                    category=category,
                    content=content,
                    path=str(md_file),
                )

                # 청크 분할
                doc_chunks = self._split_into_chunks(doc)
                doc.chunks = doc_chunks
                self.documents.append(doc)
                self.chunks.extend(doc_chunks)

                print(f"  ✅ {name} ({category}) → {len(doc_chunks)}개 청크")

            except Exception as e:
                print(f"  ❌ {md_file.name} 로드 실패: {e}")

        self._loaded = True
        print(f"\n📊 총 {len(self.documents)}개 문서, {len(self.chunks)}개 청크 로드 완료")
        return len(self.chunks)

    def _split_into_chunks(self, doc: Document) -> list[Chunk]:
        """
        마크다운 문서를 헤딩(##, ###) 기준으로 청크 분할합니다.
        테이블, 코드블록도 포함하여 의미 단위로 분리합니다.
        """
        chunks: list[Chunk] = []
        content = doc.content

        # ── ## 또는 ### 기준으로 섹션 분리 ──
        sections = re.split(r'\n(?=##\s)', content)

        for idx, section in enumerate(sections):
            section = section.strip()
            if not section or len(section) < 10:
                continue

            # 헤딩 추출
            heading_match = re.match(r'^(#{1,4})\s+(.+)', section)
            heading = heading_match.group(2).strip() if heading_match else f"섹션 {idx + 1}"

            # 청크가 너무 크면 더 분할 (1500자 초과 시)
            if len(section) > 1500:
                sub_sections = re.split(r'\n(?=###\s)', section)
                for sub_idx, sub in enumerate(sub_sections):
                    sub = sub.strip()
                    if len(sub) < 10:
                        continue
                    sub_heading_match = re.match(r'^(#{1,4})\s+(.+)', sub)
                    sub_heading = sub_heading_match.group(2).strip() if sub_heading_match else heading

                    chunks.append(Chunk(
                        doc_name=doc.name,
                        category=doc.category,
                        heading=sub_heading,
                        text=sub,
                        index=len(chunks),
                    ))
            else:
                chunks.append(Chunk(
                    doc_name=doc.name,
                    category=doc.category,
                    heading=heading,
                    text=section,
                    index=len(chunks),
                ))

        return chunks

    def search(
        self,
        query: str,
        top_k: int = 5,
        category: Optional[str] = None,
        doc_name: Optional[str] = None,
    ) -> list[dict]:
        """
        키워드 기반 검색을 수행합니다.

        Args:
            query: 검색어 (예: "화산파 위치", "요리 메뉴")
            top_k: 반환할 최대 결과 수
            category: 카테고리 필터 (예: "지리/지역")
            doc_name: 특정 문서명 필터 (예: "지리_상세")

        Returns:
            검색 결과 리스트 (점수 내림차순)
        """
        if not self._loaded:
            self.load()

        # 검색어 정규화
        query_lower = query.lower().strip()
        query_words = set(re.findall(r'[\w가-힣]+', query_lower))

        if not query_words:
            return []

        results: list[dict] = []

        for chunk in self.chunks:
            # ── 필터 적용 ──
            if category and category not in chunk.category:
                continue
            if doc_name and doc_name not in chunk.doc_name:
                continue

            # ── 점수 계산 (TF 기반 + 위치 가중치) ──
            text_lower = chunk.text.lower()
            heading_lower = chunk.heading.lower()
            score = 0.0

            for word in query_words:
                # 본문 매칭 (기본 1점)
                word_count = text_lower.count(word)
                if word_count > 0:
                    score += min(word_count, 5)  # 최대 5점 (반복 패널티)

                # 헤딩 매칭 (가중치 3배)
                if word in heading_lower:
                    score += 3.0

                # 문서명 매칭 (가중치 2배)
                if word in chunk.doc_name.lower():
                    score += 2.0

            # ── 전체 구문 매칭 보너스 ──
            if query_lower in text_lower:
                score += 5.0

            if score > 0:
                results.append({
                    "doc_name": chunk.doc_name,
                    "category": chunk.category,
                    "heading": chunk.heading,
                    "text": chunk.text[:800],  # 800자 제한
                    "score": round(score, 2),
                    "full_length": len(chunk.text),
                })

        # ── 점수 내림차순 정렬 ──
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def search_by_tag(self, tag: str) -> list[dict]:
        """
        @태그 검색 (예: @요리, @무공, @객잔)
        태그에 매핑된 카테고리에서 핵심 정보를 반환합니다.
        """
        tag = tag.lstrip("@").strip()

        # 태그 → 검색 매핑
        TAG_MAP = {
            "요리": {"query": "요리 음식 메뉴", "category": "생활/음식·건축"},
            "음식": {"query": "요리 음식 메뉴", "category": "생활/음식·건축"},
            "건축": {"query": "건축 객잔 구조", "category": "생활/음식·건축"},
            "객잔": {"query": "객잔 주막", "category": "지리/객잔"},
            "무공": {"query": "무공 심법 초식", "category": "무공/전투"},
            "무기": {"query": "무기 병기 검", "category": "무공/병기"},
            "병기": {"query": "무기 병기 검", "category": "무공/병기"},
            "의복": {"query": "의복 복식 의상", "category": "생활/의복"},
            "지리": {"query": "지역 도시 산", "category": "지리/지역"},
            "이동": {"query": "이동 경로 거리", "category": "지리/이동"},
            "세력": {"query": "세력 문파 조직", "category": "세력/조직"},
            "조직": {"query": "세력 문파 조직", "category": "세력/조직"},
            "인물": {"query": "캐릭터 인물", "category": "인물"},
            "캐릭터": {"query": "캐릭터 인물", "category": "인물"},
            "경영": {"query": "경영 M&A 재무", "category": "경영/용어"},
            "로드맵": {"query": "로드맵 300화", "category": "스토리/로드맵"},
        }

        if tag in TAG_MAP:
            mapped = TAG_MAP[tag]
            return self.search(mapped["query"], top_k=10, category=mapped["category"])
        else:
            # 매핑 없으면 일반 검색
            return self.search(tag, top_k=10)

    def get_categories(self) -> list[dict]:
        """사용 가능한 카테고리 목록과 문서 수를 반환합니다"""
        cat_map: dict[str, int] = {}
        for doc in self.documents:
            cat_map[doc.category] = cat_map.get(doc.category, 0) + 1

        return [
            {"category": cat, "count": count}
            for cat, count in sorted(cat_map.items())
        ]

    def get_document(self, name: str) -> Optional[dict]:
        """특정 문서의 전체 내용을 반환합니다"""
        for doc in self.documents:
            if doc.name == name or name in doc.name:
                return {
                    "name": doc.name,
                    "category": doc.category,
                    "content": doc.content,
                    "chunk_count": len(doc.chunks),
                    "char_count": len(doc.content),
                }
        return None

    def get_all_documents(self) -> list[dict]:
        """전체 문서 목록을 반환합니다 (내용 미포함)"""
        return [
            {
                "name": doc.name,
                "category": doc.category,
                "chunk_count": len(doc.chunks),
                "char_count": len(doc.content),
            }
            for doc in self.documents
        ]

    def get_stats(self) -> dict:
        """엔진 통계를 반환합니다"""
        total_chars = sum(len(doc.content) for doc in self.documents)
        return {
            "documents": len(self.documents),
            "chunks": len(self.chunks),
            "total_chars": total_chars,
            "categories": len(set(doc.category for doc in self.documents)),
            "loaded": self._loaded,
        }
