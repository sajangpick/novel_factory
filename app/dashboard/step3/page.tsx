'use client';

import { useState, useEffect } from 'react';
import { Book, ChevronRight, Sparkles, Search, AlertCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * [Step 3: 전체 화 뼈대 목록]
 * 300화 전체를 한눈에 보면서 각 화마다 100자 뼈대 관리
 * Step 1-2 결과를 기반으로 자동 구성
 * 
 * 기능:
 * - Step 1-2 결과 표시
 * - 전체 화 목록 표시
 * - 각 화의 100자 뼈대 입력/수정
 * - AI 자동 생성
 * - 화 클릭 → Step 4(5단계 심화)로 이동
 */

interface NovelSpec {
  title: string;
  genre: string;
  totalEpisodes: number;
  synopsis: string;
}

interface Section {
  name: '기' | '승' | '전' | '결';
  label: string;
  episodes: number;
  synopsis: string;
  color: string;
}

interface Episode {
  id: number;
  title: string;
  skeleton: string; // 100자 뼈대
  section: '기' | '승' | '전' | '결';
}

export default function Step3Page() {
  const router = useRouter();
  const [spec, setSpec] = useState<NovelSpec | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<'전체' | '기' | '승' | '전' | '결'>('전체');
  const [isGenerating, setIsGenerating] = useState(false);

  // Step 1-2 데이터 및 에피소드 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Step 1 데이터
      const savedSpec = localStorage.getItem('novel_step1_spec');
      if (savedSpec) {
        setSpec(JSON.parse(savedSpec));
      }

      // Step 2 데이터
      const savedSections = localStorage.getItem('novel_step2_sections');
      if (savedSections) {
        setSections(JSON.parse(savedSections));
      }

      // Step 3 에피소드 데이터
      const savedEpisodes = localStorage.getItem('novel_episodes_skeletons');
      if (savedEpisodes) {
        try {
          setEpisodes(JSON.parse(savedEpisodes));
        } catch (e) {
          console.error('저장된 데이터 복원 실패:', e);
          initializeEpisodes();
        }
      } else {
        initializeEpisodes();
      }
    }
  }, []);

  // 초기 에피소드 생성 (Step 2 기반)
  const initializeEpisodes = () => {
    if (typeof window !== 'undefined') {
      const savedSections = localStorage.getItem('novel_step2_sections');
      if (savedSections) {
        const parsedSections: Section[] = JSON.parse(savedSections);
        const initial: Episode[] = [];
        let episodeNum = 1;

        parsedSections.forEach(section => {
          for (let i = 0; i < section.episodes; i++) {
            initial.push({
              id: episodeNum,
              title: `제${episodeNum}화`,
              skeleton: '',
              section: section.name
            });
            episodeNum++;
          }
        });

        setEpisodes(initial);
        localStorage.setItem('novel_episodes_skeletons', JSON.stringify(initial));
      }
    }
  };

  // 화 번호로 기승전결 구분
  const getSectionByEpisode = (episodeNum: number, total: number): '기' | '승' | '전' | '결' => {
    const quarter = total / 4;
    if (episodeNum <= quarter) return '기';
    if (episodeNum <= quarter * 2) return '승';
    if (episodeNum <= quarter * 3) return '전';
    return '결';
  };

  // 뼈대 업데이트
  const updateSkeleton = (id: number, skeleton: string) => {
    const updated = episodes.map(ep => 
      ep.id === id ? { ...ep, skeleton } : ep
    );
    setEpisodes(updated);
    
    // 자동 저장 (디바운스)
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        localStorage.setItem('novel_episodes_skeletons', JSON.stringify(updated));
      }, 1000);
    }
  };

  // ── 배치 생성 진행 상태 ──
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // AI 전체 생성 (30화씩 배치 처리)
  const handleGenerateAll = async () => {
    if (!spec || sections.length === 0) {
      alert('Step 1~2를 먼저 완료해주세요.');
      return;
    }

    const totalCount = episodes.length || spec.totalEpisodes;
    if (!confirm(`전체 ${totalCount}화의 뼈대를 AI로 생성하시겠습니까?\n\n30화씩 나누어 처리하므로 약 ${Math.ceil(totalCount / 30) * 15}초 소요됩니다.`)) {
      return;
    }

    setIsGenerating(true);

    try {
      // ── 1단계: 기승전결별 화 번호 범위 계산 ──
      const batches: { name: string; synopsis: string; start: number; end: number }[] = [];
      let currentStart = 1;

      for (const section of sections) {
        if (section.episodes <= 0) continue;
        const sectionEnd = currentStart + section.episodes - 1;

        // 30화씩 나누어 배치 생성
        for (let bStart = currentStart; bStart <= sectionEnd; bStart += 30) {
          const bEnd = Math.min(bStart + 29, sectionEnd);
          batches.push({
            name: section.name,
            synopsis: section.synopsis,
            start: bStart,
            end: bEnd,
          });
        }

        currentStart = sectionEnd + 1;
      }

      setBatchProgress({ current: 0, total: batches.length });

      // ── 2단계: 배치별 순차 호출 ──
      const allResults: { id: number; skeleton: string }[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setBatchProgress({ current: i + 1, total: batches.length });

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 배치당 60초

          const response = await fetch('/api/generate-outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'skeletons',
              sectionName: batch.name,
              sectionSynopsis: batch.synopsis,
              startEpisode: batch.start,
              endEpisode: batch.end,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.episodes) {
              allResults.push(...data.episodes);
            }
          } else {
            console.warn(`⚠️ 배치 ${i + 1} 실패 (${batch.start}~${batch.end}화)`);
          }
        } catch (batchErr: any) {
          console.warn(`⚠️ 배치 ${i + 1} 오류:`, batchErr.message);
          // 실패해도 계속 진행 (다른 배치는 정상 처리)
        }

        // API 과부하 방지: 배치 사이 1초 대기
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // ── 3단계: 결과 반영 ──
      if (allResults.length > 0) {
        const skeletonMap = new Map(allResults.map(r => [r.id, r.skeleton]));

        const updatedEpisodes = episodes.map(ep => ({
          ...ep,
          skeleton: skeletonMap.get(ep.id) || ep.skeleton, // 기존 것 유지 (실패 시)
        }));

        setEpisodes(updatedEpisodes);
        if (typeof window !== 'undefined') {
          localStorage.setItem('novel_episodes_skeletons', JSON.stringify(updatedEpisodes));
        }

        alert(`✅ AI 생성 완료!\n\n성공: ${allResults.length}화 / 전체: ${totalCount}화`);
      } else {
        alert('❌ AI 생성에 실패했습니다. AI API Key를 확인해주세요.');
      }
    } catch (error: any) {
      console.error('AI 전체 생성 오류:', error);
      alert(`❌ 오류 발생: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  // Step 1-2 미완성 체크 (조기 return은 변수 정의 전에!)
  if (!spec || sections.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-lg font-semibold text-yellow-400">Step 1-2를 먼저 완료해주세요</p>
              <p className="text-sm text-gray-400 mt-2">
                전체 화 뼈대를 작성하려면 먼저 <strong>Step 1 (스펙 정의)</strong>와 <strong>Step 2 (기승전결)</strong>를 완료해야 합니다.
              </p>
              <div className="flex items-center space-x-3 mt-4">
                <button
                  onClick={() => router.push('/dashboard/step1')}
                  className="px-4 py-2 bg-murim-accent hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  Step 1로 이동
                </button>
                <button
                  onClick={() => router.push('/dashboard/step2')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Step 2로 이동
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 필터링된 에피소드
  const filteredEpisodes = episodes.filter(ep => {
    const matchesSearch = ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ep.skeleton.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSection = selectedSection === '전체' || ep.section === selectedSection;
    return matchesSearch && matchesSection;
  });

  // 통계
  const stats = {
    total: episodes.length,
    completed: episodes.filter(ep => ep.skeleton.length > 0).length,
    기: episodes.filter(ep => ep.section === '기').length,
    승: episodes.filter(ep => ep.section === '승').length,
    전: episodes.filter(ep => ep.section === '전').length,
    결: episodes.filter(ep => ep.section === '결').length,
  };

  return (
    <div className="p-8 space-y-8">
      {/* 헤더 */}
      <div className="border-b border-murim-border pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Book className="w-8 h-8 text-murim-accent" />
              <h1 className="text-3xl font-bold text-foreground">Step 3: 전체 화 뼈대</h1>
            </div>
            <p className="text-gray-500">
              {spec.title} - {spec.totalEpisodes}화 전체의 100자 뼈대를 관리하세요
            </p>
          </div>
          
          <button
            onClick={handleGenerateAll}
            disabled={isGenerating}
            className={`
              px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2
              ${isGenerating
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-murim-accent hover:bg-blue-600 text-white'
              }
            `}
          >
            <Sparkles className="w-5 h-5" />
            <span>{isGenerating
              ? (batchProgress.total > 0
                  ? `생성 중... (${batchProgress.current}/${batchProgress.total})`
                  : '준비 중...')
              : '✨ AI 전체 생성'
            }</span>
          </button>
        </div>
      </div>

      {/* Step 1-2 결과 표시 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1 결과 */}
        <div className="widget-card">
          <div className="flex items-center space-x-2 mb-3">
            <FileText className="w-5 h-5 text-murim-accent" />
            <h3 className="text-sm font-semibold text-gray-500">Step 1: 전체 그림</h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">작품 제목</p>
              <p className="text-sm font-semibold text-foreground">{spec.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">장르</p>
                <p className="text-sm font-semibold text-foreground">{spec.genre}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">총 화수</p>
                <p className="text-sm font-semibold text-foreground">{spec.totalEpisodes}화</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 결과 */}
        <div className="widget-card">
          <div className="flex items-center space-x-2 mb-3">
            <FileText className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-semibold text-gray-500">Step 2: 기승전결 구성</h3>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {sections.map((section) => (
              <div key={section.name}>
                <p className={`text-xs text-${section.color}-400`}>{section.name}</p>
                <p className="text-sm font-semibold text-foreground">{section.episodes}화</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="widget-card">
          <p className="text-sm text-gray-500">전체</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}화</p>
        </div>
        <div className="widget-card">
          <p className="text-sm text-gray-500">완성</p>
          <p className="text-2xl font-bold text-murim-success">{stats.completed}화</p>
        </div>
        <div className="widget-card">
          <p className="text-sm text-gray-500">기(起)</p>
          <p className="text-2xl font-bold text-blue-400">{stats.기}화</p>
        </div>
        <div className="widget-card">
          <p className="text-sm text-gray-500">승(承)</p>
          <p className="text-2xl font-bold text-green-400">{stats.승}화</p>
        </div>
        <div className="widget-card">
          <p className="text-sm text-gray-500">전(轉)</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.전}화</p>
        </div>
        <div className="widget-card">
          <p className="text-sm text-gray-500">결(結)</p>
          <p className="text-2xl font-bold text-red-400">{stats.결}화</p>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="화 제목 또는 내용 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-accent"
          />
        </div>
        
        <div className="flex space-x-2">
          {['전체', '기', '승', '전', '결'].map((section) => (
            <button
              key={section}
              onClick={() => setSelectedSection(section as any)}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${selectedSection === section
                  ? 'bg-murim-accent text-white'
                  : 'bg-murim-darker text-gray-400 hover:bg-gray-700'
                }
              `}
            >
              {section}
            </button>
          ))}
        </div>
      </div>

      {/* 에피소드 목록 */}
      <div className="widget-card">
        <h3 className="text-lg font-bold text-foreground mb-4">
          화 목록 ({filteredEpisodes.length}/{stats.total})
        </h3>
        
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredEpisodes.map((episode) => (
            <div
              key={episode.id}
              className="p-4 bg-murim-darker rounded-lg border border-murim-border hover:border-murim-accent transition-colors"
            >
              <div className="flex items-start space-x-4">
                {/* 화 번호 및 구분 */}
                <div className="flex-shrink-0">
                  <div className={`
                    w-16 h-16 rounded-lg flex flex-col items-center justify-center
                    ${episode.section === '기' ? 'bg-blue-500/20 text-blue-400' : ''}
                    ${episode.section === '승' ? 'bg-green-500/20 text-green-400' : ''}
                    ${episode.section === '전' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                    ${episode.section === '결' ? 'bg-red-500/20 text-red-400' : ''}
                  `}>
                    <span className="text-xs font-semibold">{episode.section}</span>
                    <span className="text-lg font-bold">{episode.id}</span>
                  </div>
                </div>

                {/* 뼈대 입력 */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-foreground">{episode.title}</h4>
                    <span className="text-xs text-gray-500">
                      {episode.skeleton.replace(/\s+/g, '').length}/100자
                    </span>
                  </div>
                  <textarea
                    value={episode.skeleton}
                    onChange={(e) => updateSkeleton(episode.id, e.target.value)}
                    placeholder="100자 뼈대를 입력하세요... (출연자, 장소, 시간대, 핵심 사건)"
                    className="w-full h-20 bg-murim-dark border border-murim-border rounded p-3 text-sm text-foreground resize-none focus:outline-none focus:border-murim-accent"
                    spellCheck={false}
                  />
                </div>

                {/* 상세 설계 버튼 */}
                <div className="flex-shrink-0">
                  <Link
                    href={`/dashboard/step4?episode=${episode.id}`}
                    className="flex items-center space-x-2 px-4 py-2 bg-murim-accent hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <span>상세 설계</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
