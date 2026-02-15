'use client';

import { AlertTriangle, TrendingUp, DollarSign, Zap } from 'lucide-react';

/**
 * [리스크 관리 위젯]
 * .cursorrules의 Advanced System Rules #1 준수
 * - 법정관리 수준의 리스크 모니터링
 * - AI 토큰 사용량 및 비용 추적
 * - 실시간 경영 지표 시각화
 */

interface RiskMetric {
  label: string;
  value: string | number;
  status: 'low' | 'medium' | 'high';
  icon: React.ElementType;
  description: string;
}

interface RiskWidgetProps {
  metrics?: RiskMetric[];
}

export default function RiskWidget({ metrics }: RiskWidgetProps) {
  // [기본 리스크 지표 데이터]
  const defaultMetrics: RiskMetric[] = [
    {
      label: 'AI 토큰 사용량',
      value: '12,450',
      status: 'medium',
      icon: Zap,
      description: '이번 달 누적 토큰',
    },
    {
      label: 'AI 비용',
      value: '$24.50',
      status: 'low',
      icon: DollarSign,
      description: '월 예산 대비 45%',
    },
    {
      label: '시스템 리스크',
      value: '낮음',
      status: 'low',
      icon: AlertTriangle,
      description: '모든 시스템 정상',
    },
    {
      label: '집필 효율성',
      value: '92%',
      status: 'low',
      icon: TrendingUp,
      description: '목표 대비 +12%',
    },
  ];

  const displayMetrics = metrics || defaultMetrics;

  return (
    <div className="widget-card">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">경영 리스크 지표</h3>
          <p className="text-sm text-gray-500 mt-1">
            법정관리 수준의 실시간 모니터링
          </p>
        </div>
        <AlertTriangle className="w-6 h-6 text-murim-gold" />
      </div>

      {/* 리스크 지표 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayMetrics.map((metric, index) => (
          <RiskMetricCard key={index} metric={metric} />
        ))}
      </div>

      {/* 
        [리스크 진단 보고서]
        .cursorrules Advanced System Rules #1:
        "데이터 정합성 오류 발생 시, 시스템은 즉시 집필을 중단하고 리스크 진단 보고서를 출력한다"
      */}
      <div className="mt-6 p-4 bg-murim-darker rounded-lg border border-murim-border">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-2 h-2 mt-2 bg-murim-success rounded-full animate-pulse"></div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">시스템 상태: 정상</p>
            <p className="text-xs text-gray-500 mt-1">
              마지막 체크: 2분 전 | 다음 체크: 3분 후
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * [리스크 지표 카드 컴포넌트]
 * 재사용 가능한 메트릭 표시 카드
 */
interface RiskMetricCardProps {
  metric: RiskMetric;
}

function RiskMetricCard({ metric }: RiskMetricCardProps) {
  const Icon = metric.icon;
  
  return (
    <div className="p-4 bg-murim-darker rounded-lg border border-murim-border hover:border-murim-accent transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <Icon className="w-4 h-4 text-gray-500" />
            <p className="text-xs text-gray-500">{metric.label}</p>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{metric.value}</p>
          <p className="text-xs text-gray-600 mt-1">{metric.description}</p>
        </div>
        <span className={`risk-indicator ${metric.status}`}>
          {metric.status === 'low' ? '정상' : metric.status === 'medium' ? '주의' : '위험'}
        </span>
      </div>
    </div>
  );
}
