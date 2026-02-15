'use client';

import { useState, useEffect } from 'react';
import { Layers, Sparkles, Save, ChevronRight, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * [Step 2: 4단 구조 - 기승전결 분리]
 * Step 1의 전체 그림을 기승전결로 분리합니다.
 * - 기(起): 시작, 인물 소개, 세계관 설정
 * - 승(承): 전개, 갈등 심화
 * - 전(轉): 절정, 위기, 반전
 * - 결(結): 해결, 결말
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
  synopsis: string; // 각 단계의 줄거리 (300자 내외)
  color: string;
}

export default function Step2Page() {
  const router = useRouter();
  const [spec, setSpec] = useState<NovelSpec | null>(null);
  const [sections, setSections] = useState<Section[]>([
    { name: '기', label: '기(起) - 시작', episodes: 0, synopsis: '', color: 'blue' },
    { name: '승', label: '승(承) - 전개', episodes: 0, synopsis: '', color: 'green' },
    { name: '전', label: '전(轉) - 절정', episodes: 0, synopsis: '', color: 'yellow' },
    { name: '결', label: '결(結) - 결말', episodes: 0, synopsis: '', color: 'red' },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1 데이터 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSpec = localStorage.getItem('novel_step1_spec');
      if (savedSpec) {
        try {
          const parsedSpec = JSON.parse(savedSpec);
          setSpec(parsedSpec);
          
          // 기본 화수 분배 (4등분)
          const quarter = Math.floor(parsedSpec.totalEpisodes / 4);
          const remainder = parsedSpec.totalEpisodes % 4;
          
          const defaultSections = [
            { name: '기' as const, label: '기(起) - 시작', episodes: quarter + (remainder > 0 ? 1 : 0), synopsis: '', color: 'blue' },
            { name: '승' as const, label: '승(承) - 전개', episodes: quarter + (remainder > 1 ? 1 : 0), synopsis: '', color: 'green' },
            { name: '전' as const, label: '전(轉) - 절정', episodes: quarter + (remainder > 2 ? 1 : 0), synopsis: '', color: 'yellow' },
            { name: '결' as const, label: '결(結) - 결말', episodes: quarter, synopsis: '', color: 'red' },
          ];
          
          // 저장된 데이터가 있으면 복원
          const savedSections = localStorage.getItem('novel_step2_sections');
          if (savedSections) {
            setSections(JSON.parse(savedSections));
          } else {
            setSections(defaultSections);
          }
        } catch (e) {
          console.error('데이터 복원 실패:', e);
        }
      }
    }
  }, []);

  // 자동 저장
  const autoSave = (newSections: Section[]) => {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        localStorage.setItem('novel_step2_sections', JSON.stringify(newSections));
      }, 1000);
    }
  };

  // 화수 업데이트
  const updateEpisodes = (index: number, episodes: number) => {
    const newSections = [...sections];
    newSections[index].episodes = episodes;
    setSections(newSections);
    autoSave(newSections);
  };

  // 줄거리 업데이트
  const updateSynopsis = (index: number, synopsis: string) => {
    const newSections = [...sections];
    newSections[index].synopsis = synopsis;
    setSections(newSections);
    autoSave(newSections);
  };

  // AI 자동 생성 (실제 AI API 호출)
  const handleGenerate = async () => {
    if (!spec) {
      alert('Step 1을 먼저 완료해주세요.');
      return;
    }

    setIsGenerating(true);

    try {
      // 타임아웃 45초
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'structure',
          title: spec.title,
          genre: spec.genre,
          totalEpisodes: spec.totalEpisodes,
          synopsis: spec.synopsis,
          sections: sections.map(s => ({ name: s.name, episodes: s.episodes })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API 오류 (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.sections) {
        // AI가 파싱한 기승전결 결과를 기존 sections에 매핑
        const sectionMap: Record<string, string> = {};
        data.sections.forEach((s: { name: string; synopsis: string }) => {
          sectionMap[s.name] = s.synopsis;
        });

        const newSections = sections.map((section) => ({
          ...section,
          synopsis: sectionMap[section.name] || section.synopsis,
        }));

        setSections(newSections);
        autoSave(newSections);
      } else {
        throw new Error(data.message || 'AI 생성 실패');
      }
    } catch (error: any) {
      console.error('AI 생성 오류:', error);
      if (error.name === 'AbortError') {
        alert('⏱️ 시간 초과 (45초). 네트워크를 확인하고 다시 시도해주세요.');
      } else {
        alert(`❌ AI 생성 실패: ${error.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 수동 저장
  const handleSave = () => {
    setIsSaving(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('novel_step2_sections', JSON.stringify(sections));
      setTimeout(() => {
        setIsSaving(false);
        alert('✅ 저장되었습니다!');
      }, 500);
    }
  };

  // Step 3으로 이동
  const handleNext = () => {
    const allComplete = sections.every(s => s.synopsis.length > 0);
    if (!allComplete) {
      alert('모든 단계의 줄거리를 입력해주세요.');
      return;
    }
    
    // 저장 후 이동
    if (typeof window !== 'undefined') {
      localStorage.setItem('novel_step2_sections', JSON.stringify(sections));
    }
    router.push('/dashboard/step3');
  };

  // Step 1 미완성 시
  if (!spec) {
    return (
      <div className="p-8">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-lg font-semibold text-yellow-400">Step 1을 먼저 완료해주세요</p>
              <p className="text-sm text-gray-400 mt-2">
                기승전결을 분리하려면 먼저 <strong>Step 1 (스펙 정의)</strong>에서 작품의 전체 그림을 작성해야 합니다.
              </p>
              <button
                onClick={() => router.push('/dashboard/step1')}
                className="mt-4 px-4 py-2 bg-murim-accent hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                Step 1로 이동
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalEpisodes = sections.reduce((sum, s) => sum + s.episodes, 0);

  return (
    <div className="p-8 space-y-8">
      {/* 헤더 */}
      <div className="border-b border-murim-border pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Layers className="w-8 h-8 text-murim-accent" />
              <h1 className="text-3xl font-bold text-foreground">Step 2: 4단 구조</h1>
            </div>
            <p className="text-gray-500">
              {spec.title}을(를) 기승전결로 분리하세요
            </p>
          </div>

          <button
            onClick={handleGenerate}
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
            <span>{isGenerating ? 'AI 생성 중...' : '✨ AI 전체 생성'}</span>
          </button>
        </div>
      </div>

      {/* Step 1 정보 표시 */}
      <div className="widget-card bg-murim-darker/50">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">Step 1 결과</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">작품 제목</p>
            <p className="text-sm font-semibold text-foreground">{spec.title}</p>
          </div>
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

      {/* 화수 통계 */}
      <div className="grid grid-cols-5 gap-4">
        {sections.map((section) => (
          <div key={section.name} className="widget-card">
            <p className={`text-sm font-semibold text-${section.color}-400`}>{section.name}</p>
            <p className="text-2xl font-bold text-foreground">{section.episodes}화</p>
          </div>
        ))}
        <div className="widget-card">
          <p className="text-sm font-semibold text-gray-500">합계</p>
          <p className={`text-2xl font-bold ${totalEpisodes === spec.totalEpisodes ? 'text-murim-success' : 'text-murim-danger'}`}>
            {totalEpisodes}화
          </p>
        </div>
      </div>

      {/* 기승전결 입력 */}
      <div className="space-y-6">
        {sections.map((section, index) => (
          <div key={section.name} className="widget-card">
            <div className="flex items-start space-x-4">
              {/* 아이콘 */}
              <div className={`flex-shrink-0 w-16 h-16 rounded-lg bg-${section.color}-500/20 flex items-center justify-center`}>
                <span className={`text-2xl font-bold text-${section.color}-400`}>{section.name}</span>
              </div>

              {/* 내용 */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">{section.label}</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-500">화수:</label>
                      <input
                        type="number"
                        value={section.episodes}
                        onChange={(e) => updateEpisodes(index, parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-20 px-3 py-1 bg-murim-darker border border-murim-border rounded text-foreground text-center focus:outline-none focus:border-murim-accent"
                      />
                    </div>
                    <span className="text-sm text-gray-500">
                      {section.synopsis.replace(/\s+/g, '').length}자
                    </span>
                  </div>
                </div>

                <textarea
                  value={section.synopsis}
                  onChange={(e) => updateSynopsis(index, e.target.value)}
                  placeholder={`${section.label}의 줄거리를 입력하세요... (300자 내외)\n\n포함 내용:\n- 주요 사건\n- 인물 변화\n- 갈등 전개`}
                  className="w-full h-32 bg-murim-darker border border-murim-border rounded-lg p-3 text-sm text-foreground resize-none focus:outline-none focus:border-murim-accent"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 버튼 */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-murim-dark hover:bg-gray-700 text-gray-300 rounded-lg font-semibold transition-colors flex items-center space-x-2"
        >
          <Save className="w-5 h-5" />
          <span>{isSaving ? '저장 중...' : '💾 수동 저장'}</span>
        </button>

        <button
          onClick={handleNext}
          disabled={!sections.every(s => s.synopsis.length > 0)}
          className={`
            px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2
            ${!sections.every(s => s.synopsis.length > 0)
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-murim-success hover:bg-green-600 text-white'
            }
          `}
        >
          <span>다음 단계 (전체 화 뼈대)</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Layers className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-400">다음 단계 안내</p>
            <p className="text-sm text-gray-400 mt-1">
              기승전결 분리가 완료되면 <strong>Step 3 (전체 화 뼈대)</strong>로 이동하여 각 화의 100자 뼈대를 작성할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
