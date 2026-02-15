'use client';

import { useState, useEffect } from 'react';
import { Database, Search, Upload, FileText, RefreshCw } from 'lucide-react';

/**
 * [World DB 관리 페이지]
 * - 11개 MD 파일 관리
 * - Supabase 동기화
 * - 검색/조회 기능
 */

interface WorldDBFile {
  id: string;
  name: string;
  path: string;
  category: string;
  size: number; // 글자 수
  lastModified: string;
}

// World DB 파일 목록 (공장-제품 분리 구조: novels/murim_mna/)
const WORLDDB_FILES: WorldDBFile[] = [
  {
    id: '1',
    name: '지리_상세',
    path: 'novels/murim_mna/world_db/지리_상세.md',
    category: '지리',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '2',
    name: '세력도',
    path: 'novels/murim_mna/world_db/세력도.md',
    category: '세력',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '3',
    name: '무공_시스템',
    path: 'novels/murim_mna/world_db/무공_시스템.md',
    category: '무공',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '4',
    name: '마스터_스토리_바이블',
    path: 'novels/murim_mna/master_story_bible.md',
    category: '스토리',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '5',
    name: '무협_용어집',
    path: 'novels/murim_mna/world_db/무협_용어집.md',
    category: '용어',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '6',
    name: '경영_용어집',
    path: 'novels/murim_mna/world_db/경영_용어집.md',
    category: '용어',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '7',
    name: '음식_건축_DB',
    path: 'novels/murim_mna/world_db/음식_건축_DB.md',
    category: '생활',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '8',
    name: '의복_복식_DB',
    path: 'novels/murim_mna/world_db/의복_복식_DB.md',
    category: '생활',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '9',
    name: '무기_병기_DB',
    path: 'novels/murim_mna/world_db/무기_병기_DB.md',
    category: '무기',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '10',
    name: '캐릭터_인명록',
    path: 'novels/murim_mna/캐릭터_인명록.md',
    category: '캐릭터',
    size: 0,
    lastModified: '2026-02-14',
  },
  {
    id: '11',
    name: '이동_동선_DB',
    path: 'novels/murim_mna/world_db/이동_동선_DB.md',
    category: '지리',
    size: 0,
    lastModified: '2026-02-14',
  },
];

export default function WorldDBPage() {
  const [files, setFiles] = useState<WorldDBFile[]>(WORLDDB_FILES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [uploading, setUploading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'none' | 'syncing' | 'synced' | 'error'>('none');
  const [selectedFile, setSelectedFile] = useState<WorldDBFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  // 카테고리 목록
  const categories = ['전체', ...Array.from(new Set(WORLDDB_FILES.map((f) => f.category)))];

  // 필터링된 파일 목록
  const filteredFiles = files.filter((file) => {
    const matchCategory = selectedCategory === '전체' || file.category === selectedCategory;
    const matchSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  // 파일 내용 보기
  const handleViewFile = async (file: WorldDBFile) => {
    try {
      setSelectedFile(file);
      setFileContent('불러오는 중...');

      const response = await fetch(`/api/read-file?path=${encodeURIComponent(file.path)}`);
      if (!response.ok) {
        throw new Error('파일 읽기 실패');
      }

      const data = await response.json();
      setFileContent(data.content);
    } catch (error) {
      console.error('파일 읽기 오류:', error);
      setFileContent('❌ 파일을 읽을 수 없습니다.');
    }
  };

  // Supabase 동기화
  const handleSyncToSupabase = async () => {
    try {
      setUploading(true);
      setSyncStatus('syncing');

      const response = await fetch('/api/sync-worlddb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: WORLDDB_FILES }),
      });

      if (!response.ok) {
        throw new Error('동기화 실패');
      }

      const result = await response.json();
      setSyncStatus('synced');
      alert(`✅ 동기화 완료!\n${result.count}개 파일이 Supabase에 업로드되었습니다.`);
    } catch (error) {
      console.error('동기화 오류:', error);
      setSyncStatus('error');
      alert('❌ 동기화 실패. 터미널을 확인하세요.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-murim-border pb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Database className="w-8 h-8 text-murim-accent" />
            World DB 관리
          </h1>
          <p className="text-gray-500 mt-2">
            무림 M&A 세계관 데이터베이스 - 11개 파일 관리
          </p>
        </div>

        {/* 동기화 버튼 */}
        <button
          onClick={handleSyncToSupabase}
          disabled={uploading}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors
            ${
              uploading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-murim-accent hover:bg-blue-600 text-white'
            }
          `}
        >
          {uploading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              동기화 중...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Supabase 동기화
            </>
          )}
        </button>
      </div>

      {/* 상태 표시 */}
      {syncStatus === 'synced' && (
        <div className="bg-murim-success/10 border border-murim-success rounded-lg p-4">
          <p className="text-murim-success font-semibold">
            ✅ Supabase와 동기화 완료!
          </p>
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="bg-murim-danger/10 border border-murim-danger rounded-lg p-4">
          <p className="text-murim-danger font-semibold">
            ❌ 동기화 실패. API 확인이 필요합니다.
          </p>
        </div>
      )}

      {/* 검색 및 필터 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="파일명 검색..."
            className="w-full pl-10 pr-4 py-3 bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-accent"
          />
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`
                px-4 py-2 rounded-lg font-semibold transition-colors
                ${
                  selectedCategory === cat
                    ? 'bg-murim-accent text-white'
                    : 'bg-murim-darker border border-murim-border text-gray-400 hover:border-murim-accent'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 파일 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles.map((file) => (
          <div
            key={file.id}
            onClick={() => handleViewFile(file)}
            className="bg-murim-darker border border-murim-border rounded-lg p-6 hover:border-murim-accent transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-murim-accent flex-shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground truncate">
                  {file.name}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 bg-murim-accent/20 text-murim-accent text-xs rounded">
                    {file.category}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {file.lastModified}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-2 truncate">
                  {file.path}
                </p>
                <p className="text-murim-accent text-sm mt-2 font-semibold">
                  클릭하여 내용 보기 →
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 파일 내용 모달 */}
      {selectedFile && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedFile(null)}
        >
          <div
            className="bg-murim-darker border border-murim-accent rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-murim-border">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedFile.name}</h2>
                <p className="text-gray-500 text-sm mt-1">{selectedFile.path}</p>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-gray-500 hover:text-foreground transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono bg-black/30 p-4 rounded-lg">
                {fileContent}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {filteredFiles.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">검색 결과가 없습니다.</p>
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6 border-t border-murim-border">
        <div className="bg-murim-darker border border-murim-border rounded-lg p-4">
          <p className="text-gray-500 text-sm">전체 파일</p>
          <p className="text-3xl font-bold text-foreground mt-2">{WORLDDB_FILES.length}</p>
        </div>
        <div className="bg-murim-darker border border-murim-border rounded-lg p-4">
          <p className="text-gray-500 text-sm">지리/세력</p>
          <p className="text-3xl font-bold text-murim-accent mt-2">
            {WORLDDB_FILES.filter((f) => ['지리', '세력'].includes(f.category)).length}
          </p>
        </div>
        <div className="bg-murim-darker border border-murim-border rounded-lg p-4">
          <p className="text-gray-500 text-sm">용어집</p>
          <p className="text-3xl font-bold text-murim-gold mt-2">
            {WORLDDB_FILES.filter((f) => f.category === '용어').length}
          </p>
        </div>
        <div className="bg-murim-darker border border-murim-border rounded-lg p-4">
          <p className="text-gray-500 text-sm">캐릭터</p>
          <p className="text-3xl font-bold text-murim-success mt-2">
            {WORLDDB_FILES.filter((f) => f.category === '캐릭터').length}
          </p>
        </div>
      </div>
    </div>
  );
}
