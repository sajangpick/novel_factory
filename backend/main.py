"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Novel Alchemist] RAG Backend Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

무림 세계관 검색 엔진 (FastAPI)

실행 방법:
  pip install fastapi uvicorn
  cd backend
  python main.py

또는:
  uvicorn main:app --reload --port 8000

엔드포인트:
  GET  /                     → 서버 상태
  GET  /api/stats             → 엔진 통계
  GET  /api/categories        → 카테고리 목록
  GET  /api/documents         → 전체 문서 목록
  GET  /api/document/{name}   → 특정 문서 조회
  POST /api/search            → 키워드 검색
  POST /api/tag-search        → @태그 검색
"""

import os
import sys
from pathlib import Path

# ── FastAPI 설치 확인 ──
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
except ImportError:
    print("❌ FastAPI가 설치되지 않았습니다.")
    print("   설치 명령어: pip install fastapi uvicorn")
    sys.exit(1)

from rag_engine import RAGEngine

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FastAPI 앱 설정
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app = FastAPI(
    title="Novel Alchemist RAG API",
    description="무림 세계관 검색 엔진 - novels/murim_mna/world_db 기반 RAG",
    version="1.0.0",
)

# ── CORS 설정 (Next.js 프론트엔드 허용) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── RAG 엔진 초기화 ──
# novels/murim_mna/world_db 경로 (공장-제품 분리 구조)
DOCS_PATH = Path(__file__).parent.parent / "novels" / "murim_mna" / "world_db"
engine = RAGEngine(str(DOCS_PATH))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 요청/응답 모델 (Pydantic)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class SearchRequest(BaseModel):
    """검색 요청"""
    query: str                          # 검색어
    top_k: int = 5                      # 최대 결과 수 (기본 5개)
    category: str | None = None         # 카테고리 필터 (선택)
    doc_name: str | None = None         # 문서명 필터 (선택)


class TagSearchRequest(BaseModel):
    """@태그 검색 요청"""
    tag: str                            # 태그 (예: "요리", "무공", "객잔")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 엔드포인트
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.on_event("startup")
async def startup():
    """서버 시작 시 세계관 문서 로드"""
    print("🚀 Novel Alchemist RAG Server 시작")
    chunk_count = engine.load()
    print(f"✅ 준비 완료! ({chunk_count}개 청크 인덱싱)")


@app.get("/")
async def root():
    """서버 상태 확인"""
    stats = engine.get_stats()
    return {
        "status": "running",
        "service": "Novel Alchemist RAG API",
        "version": "1.0.0",
        "engine": stats,
    }


@app.get("/api/stats")
async def get_stats():
    """엔진 통계"""
    return engine.get_stats()


@app.get("/api/categories")
async def get_categories():
    """사용 가능한 카테고리 목록"""
    return engine.get_categories()


@app.get("/api/documents")
async def get_documents():
    """전체 문서 목록 (내용 미포함)"""
    return engine.get_all_documents()


@app.get("/api/document/{name}")
async def get_document(name: str):
    """특정 문서 전체 조회"""
    doc = engine.get_document(name)
    if not doc:
        raise HTTPException(status_code=404, detail=f"문서 '{name}'을 찾을 수 없습니다.")
    return doc


@app.post("/api/search")
async def search(req: SearchRequest):
    """
    키워드 검색

    사용 예시:
      {"query": "화산파 위치", "top_k": 5}
      {"query": "낙양 객잔", "category": "지리/객잔"}
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="검색어가 비어있습니다.")

    results = engine.search(
        query=req.query,
        top_k=req.top_k,
        category=req.category,
        doc_name=req.doc_name,
    )

    return {
        "query": req.query,
        "count": len(results),
        "results": results,
    }


@app.post("/api/tag-search")
async def tag_search(req: TagSearchRequest):
    """
    @태그 검색 (소설 작성 중 @요리, @무공 등 입력 시 사용)

    사용 예시:
      {"tag": "요리"}  → 음식 관련 데이터
      {"tag": "무공"}  → 무공 시스템 데이터
      {"tag": "객잔"}  → 객잔/주막 데이터
    """
    if not req.tag.strip():
        raise HTTPException(status_code=400, detail="태그가 비어있습니다.")

    results = engine.search_by_tag(req.tag)

    return {
        "tag": req.tag,
        "count": len(results),
        "results": results,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 메인 실행
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    try:
        import uvicorn
    except ImportError:
        print("❌ uvicorn이 설치되지 않았습니다.")
        print("   설치 명령어: pip install uvicorn")
        sys.exit(1)

    port = int(os.environ.get("RAG_PORT", 8000))
    print(f"🌐 RAG 서버를 포트 {port}에서 시작합니다...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
