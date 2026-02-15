'use client';

import { useState, useEffect } from 'react';
import { FileText, Sparkles, Save, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * [Step 1: 스펙 정의 - 전체 그림 그리기]
 * 300화 신작의 전체 그림을 작성합니다.
 * - 작품 제목
 * - 장르
 * - 총 화수
 * - 전체 줄거리
 */

interface NovelSpec {
  title: string;
  genre: string;
  totalEpisodes: number;
  synopsis: string; // 전체 줄거리 (1,000자 내외)
}

export default function Step1Page() {
  const router = useRouter();
  const [spec, setSpec] = useState<NovelSpec>({
    title: '',
    genre: '무협',
    totalEpisodes: 300,
    synopsis: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 로컬스토리지에서 복원
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novel_step1_spec');
      if (saved) {
        try {
          setSpec(JSON.parse(saved));
        } catch (e) {
          console.error('저장된 데이터 복원 실패:', e);
        }
      }
    }
  }, []);

  // 자동 저장
  const autoSave = (newSpec: NovelSpec) => {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        localStorage.setItem('novel_step1_spec', JSON.stringify(newSpec));
      }, 1000);
    }
  };

  // 필드 업데이트
  const updateField = (field: keyof NovelSpec, value: string | number) => {
    const newSpec = { ...spec, [field]: value };
    setSpec(newSpec);
    autoSave(newSpec);
  };

  // AI 자동 생성 (실제 AI API 호출)
  const handleGenerate = async () => {
    if (!spec.title) {
      alert('작품 제목을 먼저 입력해주세요.');
      return;
    }

    setIsGenerating(true);

    try {
      // 타임아웃 30초
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'synopsis',
          title: spec.title,
          genre: spec.genre,
          totalEpisodes: spec.totalEpisodes,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API 오류 (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.synopsis) {
        const newSpec = { ...spec, synopsis: data.synopsis };
        setSpec(newSpec);
        autoSave(newSpec);
      } else {
        throw new Error(data.message || 'AI 생성 실패');
      }
    } catch (error: any) {
      console.error('AI 생성 오류:', error);
      if (error.name === 'AbortError') {
        alert('⏱️ 시간 초과 (30초). 네트워크를 확인하고 다시 시도해주세요.');
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
      localStorage.setItem('novel_step1_spec', JSON.stringify(spec));
      setTimeout(() => {
        setIsSaving(false);
        alert('✅ 저장되었습니다!');
      }, 500);
    }
  };

  // Step 2로 이동
  const handleNext = () => {
    if (!spec.title || !spec.synopsis) {
      alert('작품 제목과 전체 줄거리를 모두 입력해주세요.');
      return;
    }
    
    // 저장 후 이동
    if (typeof window !== 'undefined') {
      localStorage.setItem('novel_step1_spec', JSON.stringify(spec));
    }
    router.push('/dashboard/step2');
  };

  return (
    <div className="p-8 space-y-8">
      {/* 헤더 */}
      <div className="border-b border-murim-border pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <FileText className="w-8 h-8 text-murim-accent" />
          <h1 className="text-3xl font-bold text-foreground">Step 1: 스펙 정의</h1>
        </div>
        <p className="text-gray-500">
          300화 신작의 전체 그림을 그려보세요
        </p>
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="widget-card">
          <label className="block text-sm font-semibold text-foreground mb-2">
            작품 제목 *
          </label>
          <input
            type="text"
            value={spec.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="예: 천마, 경영으로 무림을 좌지우지하다"
            className="w-full px-4 py-3 bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-accent"
          />
        </div>

        <div className="widget-card">
          <label className="block text-sm font-semibold text-foreground mb-2">
            장르 *
          </label>
          <select
            value={spec.genre}
            onChange={(e) => updateField('genre', e.target.value)}
            className="w-full px-4 py-3 bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-accent"
          >
            <option value="무협">무협</option>
            <option value="판타지">판타지</option>
            <option value="현대 판타지">현대 판타지</option>
            <option value="로맨스">로맨스</option>
            <option value="로맨스 판타지">로맨스 판타지</option>
          </select>
        </div>

        <div className="widget-card">
          <label className="block text-sm font-semibold text-foreground mb-2">
            총 화수 *
          </label>
          <input
            type="number"
            value={spec.totalEpisodes}
            onChange={(e) => updateField('totalEpisodes', parseInt(e.target.value) || 0)}
            min="1"
            max="1000"
            className="w-full px-4 py-3 bg-murim-darker border border-murim-border rounded-lg text-foreground focus:outline-none focus:border-murim-accent"
          />
        </div>
      </div>

      {/* 전체 줄거리 */}
      <div className="widget-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">전체 줄거리 *</h3>
            <p className="text-sm text-gray-500 mt-1">
              1,000자 내외로 작품의 전체 흐름을 작성하세요
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {spec.synopsis.replace(/\s+/g, '').length}자
            </span>
          </div>
        </div>

        <textarea
          value={spec.synopsis}
          onChange={(e) => updateField('synopsis', e.target.value)}
          placeholder="전체 줄거리를 입력하세요...\n\n✨ AI 생성 버튼을 클릭하면 자동으로 생성됩니다.\n\n포함 내용:\n- 주인공 소개\n- 핵심 갈등\n- 주요 사건\n- 작품의 방향성\n- 핵심 테마"
          className="w-full h-96 bg-murim-darker border border-murim-border rounded-lg p-4 text-foreground resize-none focus:outline-none focus:border-murim-accent font-mono text-sm leading-relaxed"
          spellCheck={false}
        />

        {/* 버튼 */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !spec.title}
            className={`
              px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2
              ${isGenerating || !spec.title
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-murim-accent hover:bg-blue-600 text-white'
              }
            `}
          >
            <Sparkles className="w-5 h-5" />
            <span>{isGenerating ? 'AI 생성 중...' : '✨ AI 자동 생성'}</span>
          </button>

          <div className="flex items-center space-x-3">
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
              disabled={!spec.title || !spec.synopsis}
              className={`
                px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2
                ${!spec.title || !spec.synopsis
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-murim-success hover:bg-green-600 text-white'
                }
              `}
            >
              <span>다음 단계 (기승전결)</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-400">다음 단계 안내</p>
            <p className="text-sm text-gray-400 mt-1">
              작품 제목과 전체 줄거리를 입력하면 <strong>Step 2 (기승전결 분리)</strong>로 이동할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
