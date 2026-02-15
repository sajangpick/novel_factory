'use client';

import { BookOpen, CheckCircle, Circle, AlertCircle } from 'lucide-react';

/**
 * [로드맵 진척률 위젯]
 * .cursorrules의 7단계 스노우볼링 프로세스 진행 상황 시각화
 * - 현재 집필 중인 화(Chapter) 표시
 * - 각 단계별 완료 상태 추적
 * - 전체 프로젝트 진척률 계산
 */

interface Chapter {
  number: number;
  title: string;
  status: 'completed' | 'in_progress' | 'pending';
  currentStep?: number; // 1~7 (스노우볼링 7단계)
}

interface RoadmapWidgetProps {
  projectTitle?: string;
  totalChapters?: number;
  chapters?: Chapter[];
}

export default function RoadmapWidget({ 
  projectTitle = "독고소준의 무림재기",
  totalChapters = 100,
  chapters 
}: RoadmapWidgetProps) {
  // [샘플 데이터]
  const defaultChapters: Chapter[] = [
    { number: 1, title: '몰락의 시작', status: 'completed' },
    { number: 2, title: '파산의 순간', status: 'completed' },
    { number: 3, title: '재기의 결심', status: 'in_progress', currentStep: 3 },
    { number: 4, title: '첫 번째 거래', status: 'pending' },
    { number: 5, title: '은밀한 동맹', status: 'pending' },
  ];

  const displayChapters = chapters || defaultChapters;
  const completedCount = displayChapters.filter(c => c.status === 'completed').length;
  const progressPercentage = Math.round((completedCount / totalChapters) * 100);

  return (
    <div className="widget-card">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">{projectTitle}</h3>
          <p className="text-sm text-gray-500 mt-1">
            전체 {totalChapters}화 중 {completedCount}화 완료
          </p>
        </div>
        <BookOpen className="w-6 h-6 text-murim-accent" />
      </div>

      {/* 진척률 바 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-400">전체 진척률</span>
          <span className="text-sm font-bold text-murim-accent">{progressPercentage}%</span>
        </div>
        <div className="w-full h-3 bg-murim-darker rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-murim-accent to-blue-500 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* 최근 화 목록 */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-500 mb-3">최근 작업</h4>
        {displayChapters.map((chapter) => (
          <ChapterItem key={chapter.number} chapter={chapter} />
        ))}
      </div>

      {/* 
        [7단계 프로세스 진행 상황]
        현재 집필 중인 화가 있을 때 표시
      */}
      {displayChapters.find(c => c.status === 'in_progress') && (
        <div className="mt-6 p-4 bg-murim-darker rounded-lg border border-murim-accent">
          <p className="text-sm font-medium text-foreground mb-3">
            현재 진행 중: 제3화 "재기의 결심"
          </p>
          <div className="flex items-center space-x-2">
            <StepIndicator step={1} completed />
            <StepIndicator step={2} completed />
            <StepIndicator step={3} active />
            <StepIndicator step={4} />
            <StepIndicator step={5} />
            <StepIndicator step={6} />
            <StepIndicator step={7} />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Step 3: 상세 청사진 작성 중...
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * [화(Chapter) 아이템 컴포넌트]
 */
interface ChapterItemProps {
  chapter: Chapter;
}

function ChapterItem({ chapter }: ChapterItemProps) {
  const getStatusIcon = () => {
    switch (chapter.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-murim-success" />;
      case 'in_progress':
        return <AlertCircle className="w-5 h-5 text-murim-gold animate-pulse" />;
      case 'pending':
        return <Circle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (chapter.status) {
      case 'completed':
        return '완료';
      case 'in_progress':
        return `진행중 (Step ${chapter.currentStep}/7)`;
      case 'pending':
        return '대기중';
    }
  };

  return (
    <div className={`
      p-3 rounded-lg border transition-colors
      ${chapter.status === 'in_progress' 
        ? 'bg-murim-accent/10 border-murim-accent' 
        : 'bg-murim-darker border-murim-border hover:border-gray-600'
      }
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <p className="text-sm font-medium text-foreground">
              제{chapter.number}화: {chapter.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{getStatusText()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * [7단계 진행 표시기]
 */
interface StepIndicatorProps {
  step: number;
  completed?: boolean;
  active?: boolean;
}

function StepIndicator({ step, completed, active }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center flex-1">
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
        ${completed ? 'bg-murim-success text-white' : ''}
        ${active ? 'bg-murim-accent text-white animate-pulse' : ''}
        ${!completed && !active ? 'bg-murim-border text-gray-600' : ''}
      `}>
        {step}
      </div>
    </div>
  );
}
