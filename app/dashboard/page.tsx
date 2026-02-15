'use client';

import { useState, useEffect } from 'react';
import RiskWidget from '@/app/components/RiskWidget';
import {
  BookOpen, TrendingUp, Users, Database, FileText, Layers,
  Book, Sparkles, CheckSquare, PenTool, ChevronRight, Zap
} from 'lucide-react';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [대시보드 메인 페이지 - 실시간 진행 현황]
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * localStorage에서 실제 데이터를 읽어 전체 현황을 표시합니다:
 * - 작품 정보 (Step 1)
 * - 8단계 스노우볼링 진행률
 * - 집필 현황 (몇 화 완성했는지)
 * - 캐릭터/세계관 DB 현황
 */

// ── 8단계 프로세스 정의 ──
const STEPS = [
  { num: 1, label: '스펙 정의',   icon: FileText,    key: 'novel_step1_spec',           href: '/dashboard/step1' },
  { num: 2, label: '4단 구조',    icon: Layers,      key: 'novel_step2_sections',       href: '/dashboard/step2' },
  { num: 3, label: '전체 화 뼈대', icon: Book,        key: 'novel_episodes_skeletons',   href: '/dashboard/step3' },
  { num: 4, label: '상세 청사진',  icon: Sparkles,    key: 'novel_step4_designs',        href: '/dashboard/step4' },
  { num: 5, label: 'DB 연동',     icon: Database,    key: 'novel_step5_pinned',         href: '/dashboard/step5' },
  { num: 6, label: '본문 집필',    icon: PenTool,     key: 'novel_step6_episodes',       href: '/dashboard/step6' },
  { num: 7, label: '품질 검수',    icon: CheckSquare, key: 'novel_step7_reports',        href: '/dashboard/step7' },
  { num: 8, label: 'DB 업데이트',  icon: Database,    key: 'novel_step8_extractions',    href: '/dashboard/step8' },
];

export default function DashboardPage() {
  // ── 실시간 데이터 상태 ──
  const [projectTitle, setProjectTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [stepStatus, setStepStatus] = useState<Record<number, 'done' | 'partial' | 'empty'>>({});
  const [writtenCount, setWrittenCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [extractedCount, setExtractedCount] = useState(0);
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [totalSkeletons, setTotalSkeletons] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [worldDbCount, setWorldDbCount] = useState(0);
  const [totalCharWritten, setTotalCharWritten] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── 데이터 로드 (localStorage + Supabase) ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      // ── Step 1: 작품 정보 ──
      const step1 = localStorage.getItem('novel_step1_spec');
      if (step1) {
        const parsed = JSON.parse(step1);
        setProjectTitle(parsed.title || '');
        setGenre(parsed.genre || '');
        setTotalEpisodes(parsed.totalEpisodes || 0);
      }

      // ── Step별 상태 확인 ──
      const status: Record<number, 'done' | 'partial' | 'empty'> = {};
      for (const step of STEPS) {
        const data = localStorage.getItem(step.key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (typeof parsed === 'string' && parsed.length > 0) {
              status[step.num] = 'done';
            } else if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
              status[step.num] = Array.isArray(parsed) && parsed.length > 0 ? 'done' : 'partial';
              if (!Array.isArray(parsed) && Object.keys(parsed).length > 0) status[step.num] = 'done';
            } else {
              status[step.num] = 'empty';
            }
          } catch { status[step.num] = 'empty'; }
        } else {
          status[step.num] = 'empty';
        }
      }
      setStepStatus(status);

      // ── Step 3: 뼈대 완성률 ──
      const step3 = localStorage.getItem('novel_episodes_skeletons');
      if (step3) {
        const episodes = JSON.parse(step3);
        setTotalSkeletons(episodes.length);
        setSkeletonCount(episodes.filter((e: any) => e.skeleton && e.skeleton.length > 0).length);
      }

      // ── Step 6: 작성된 화 수 + 총 글자수 ──
      const step6 = localStorage.getItem('novel_step6_episodes');
      if (step6) {
        const episodes = JSON.parse(step6);
        const keys = Object.keys(episodes);
        setWrittenCount(keys.length);
        let totalChars = 0;
        for (const key of keys) {
          totalChars += (episodes[key] || '').replace(/\s+/g, '').length;
        }
        setTotalCharWritten(totalChars);
      }

      // ── Step 7: 검수된 화 수 ──
      const step7 = localStorage.getItem('novel_step7_reports');
      if (step7) {
        setReviewedCount(Object.keys(JSON.parse(step7)).length);
      }

      // ── Step 8: 추출된 화 수 ──
      const step8 = localStorage.getItem('novel_step8_extractions');
      if (step8) {
        setExtractedCount(Object.keys(JSON.parse(step8)).length);
      }

      // ── 캐릭터 수 (Supabase → localStorage) ──
      const chars = localStorage.getItem('novel_characters');
      if (chars) {
        setCharacterCount(JSON.parse(chars).length);
      }

      // ── 세계관 DB 문서 수 ──
      try {
        const res = await fetch('/api/rag-search');
        if (res.ok) {
          const data = await res.json();
          setWorldDbCount(data.count || 0);
        }
      } catch { setWorldDbCount(18); } // 폴백

    } catch (e) {
      console.error('대시보드 데이터 로드 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── 완성된 단계 수 ──
  const completedSteps = Object.values(stepStatus).filter(s => s === 'done').length;

  // ── 전체 진척률 ──
  const progressPercent = totalEpisodes > 0 ? Math.round((writtenCount / totalEpisodes) * 100) : 0;

  return (
    <div className="p-8 space-y-8">
      {/* ━━━ 헤더 ━━━ */}
      <div className="border-b border-murim-border pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {projectTitle || 'Novel Alchemist'}
            </h1>
            <p className="text-gray-500 mt-2">
              {projectTitle
                ? `${genre} · ${totalEpisodes}화 · 무림 경영 시스템`
                : '소설 제작 현황 및 리스크 관리'
              }
            </p>
          </div>
          {projectTitle && (
            <div className="text-right">
              <div className="text-4xl font-black text-murim-accent">{progressPercent}%</div>
              <div className="text-xs text-gray-500">전체 진척률</div>
            </div>
          )}
        </div>
      </div>

      {/* ━━━ 핵심 통계 4개 ━━━ */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="widget-card animate-pulse">
              <div className="h-20 bg-murim-border rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={PenTool}
            label="집필 완료"
            value={`${writtenCount}/${totalEpisodes || '?'}화`}
            sub={totalCharWritten > 0 ? `총 ${(totalCharWritten / 10000).toFixed(1)}만자` : ''}
            color="text-murim-gold"
          />
          <StatCard
            icon={CheckSquare}
            label="검수 완료"
            value={`${reviewedCount}화`}
            sub={writtenCount > 0 ? `${Math.round((reviewedCount / writtenCount) * 100)}% 검수율` : ''}
            color="text-green-400"
          />
          <StatCard
            icon={Users}
            label="등록 캐릭터"
            value={`${characterCount}명`}
            sub=""
            color="text-blue-400"
          />
          <StatCard
            icon={Database}
            label="세계관 DB"
            value={`${worldDbCount}건`}
            sub="novels/murim_mna/world_db"
            color="text-purple-400"
          />
        </div>
      )}

      {/* ━━━ 8단계 스노우볼링 프로세스 ━━━ */}
      <div className="widget-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground">스노우볼링 8단계</h3>
            <p className="text-sm text-gray-500 mt-1">
              {completedSteps}/8 단계 완료
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-murim-darker rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-murim-accent to-murim-gold transition-all duration-700"
                style={{ width: `${(completedSteps / 8) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{Math.round((completedSteps / 8) * 100)}%</span>
          </div>
        </div>

        {/* 8단계 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const st = stepStatus[step.num] || 'empty';
            return (
              <a
                key={step.num}
                href={step.href}
                className={`
                  relative p-3 rounded-lg border text-center transition-all hover:scale-105
                  ${st === 'done'
                    ? 'bg-murim-success/10 border-murim-success/40 hover:border-murim-success'
                    : st === 'partial'
                    ? 'bg-murim-gold/10 border-murim-gold/40 hover:border-murim-gold'
                    : 'bg-murim-darker border-murim-border hover:border-murim-accent'
                  }
                `}
              >
                {/* 상태 점 */}
                <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                  st === 'done' ? 'bg-murim-success' :
                  st === 'partial' ? 'bg-murim-gold animate-pulse' :
                  'bg-gray-700'
                }`} />

                <Icon className={`w-6 h-6 mx-auto mb-1 ${
                  st === 'done' ? 'text-murim-success' :
                  st === 'partial' ? 'text-murim-gold' :
                  'text-gray-600'
                }`} />
                <div className="text-xs font-bold text-foreground">Step {step.num}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-tight">{step.label}</div>
              </a>
            );
          })}
        </div>
      </div>

      {/* ━━━ 집필 현황 + 리스크 위젯 ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌측: 집필 현황 */}
        <div className="widget-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">집필 현황</h3>
              <p className="text-sm text-gray-500 mt-1">에피소드별 진행 상태</p>
            </div>
            <BookOpen className="w-6 h-6 text-murim-accent" />
          </div>

          {/* 진척률 바 (전체) */}
          {totalEpisodes > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">
                  전체 {totalEpisodes}화
                </span>
                <span className="text-sm font-bold text-murim-accent">
                  {writtenCount}화 완료 ({progressPercent}%)
                </span>
              </div>
              <div className="w-full h-4 bg-murim-darker rounded-full overflow-hidden flex">
                {/* 추출 완료(초록) */}
                {extractedCount > 0 && (
                  <div
                    className="h-full bg-green-600"
                    style={{ width: `${(extractedCount / totalEpisodes) * 100}%` }}
                    title={`DB 업데이트: ${extractedCount}화`}
                  />
                )}
                {/* 검수 완료(파랑) - 추출 제외 */}
                {reviewedCount > extractedCount && (
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${((reviewedCount - extractedCount) / totalEpisodes) * 100}%` }}
                    title={`검수 완료: ${reviewedCount - extractedCount}화`}
                  />
                )}
                {/* 집필 완료(노랑) - 검수 제외 */}
                {writtenCount > reviewedCount && (
                  <div
                    className="h-full bg-yellow-500"
                    style={{ width: `${((writtenCount - reviewedCount) / totalEpisodes) * 100}%` }}
                    title={`집필만 완료: ${writtenCount - reviewedCount}화`}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm bg-green-600" /> DB완료
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> 검수완료
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> 집필완료
                </span>
              </div>
            </div>
          )}

          {/* 뼈대 진척률 */}
          {totalSkeletons > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">뼈대 작성 (Step 3)</span>
                <span className="text-xs text-gray-400">{skeletonCount}/{totalSkeletons}</span>
              </div>
              <div className="w-full h-2 bg-murim-darker rounded-full overflow-hidden">
                <div
                  className="h-full bg-murim-accent rounded-full transition-all"
                  style={{ width: `${(skeletonCount / totalSkeletons) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 글자수 통계 */}
          {totalCharWritten > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="p-3 bg-murim-darker rounded-lg text-center">
                <p className="text-xl font-bold text-foreground">{(totalCharWritten / 10000).toFixed(1)}</p>
                <p className="text-xs text-gray-500">총 만자</p>
              </div>
              <div className="p-3 bg-murim-darker rounded-lg text-center">
                <p className="text-xl font-bold text-foreground">
                  {writtenCount > 0 ? Math.round(totalCharWritten / writtenCount).toLocaleString() : 0}
                </p>
                <p className="text-xs text-gray-500">화당 평균 글자</p>
              </div>
              <div className="p-3 bg-murim-darker rounded-lg text-center">
                <p className="text-xl font-bold text-foreground">
                  {totalEpisodes > 0 ? Math.round(((totalEpisodes - writtenCount) * (writtenCount > 0 ? totalCharWritten / writtenCount : 7000)) / 10000).toLocaleString() : '?'}
                </p>
                <p className="text-xs text-gray-500">남은 만자 (추정)</p>
              </div>
            </div>
          )}

          {/* 아직 시작 안 한 경우 */}
          {!projectTitle && (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-murim-gold mx-auto mb-3 opacity-50" />
              <p className="text-gray-500">아직 프로젝트를 시작하지 않았습니다</p>
              <a
                href="/dashboard/step1"
                className="inline-block mt-3 px-6 py-2 bg-murim-accent hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Step 1에서 시작하기
              </a>
            </div>
          )}
        </div>

        {/* 우측: 리스크 위젯 (기존 유지) */}
        <RiskWidget />
      </div>

      {/* ━━━ 빠른 작업 ━━━ */}
      <div className="widget-card">
        <h3 className="text-lg font-bold text-foreground mb-4">빠른 작업</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionButton
            icon={PenTool}
            label="소설 집필"
            description="Step 1~8 프로세스"
            href="/dashboard/step1"
            color="murim-accent"
            primary
          />
          <QuickActionButton
            icon={Database}
            label="세계관 검색"
            description="@태그로 자료 찾기"
            href="/dashboard/step5"
            color="purple-500"
          />
          <QuickActionButton
            icon={Users}
            label="인명록 관리"
            description={`${characterCount}명 등록됨`}
            href="/dashboard/characters"
            color="blue-500"
          />
          <QuickActionButton
            icon={Zap}
            label="본문 집필"
            description="바로 AI 생성 시작"
            href="/dashboard/step6"
            color="murim-gold"
          />
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 하위 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 통계 카드 */
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="widget-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
        </div>
        <Icon className={`w-8 h-8 ${color} opacity-70`} />
      </div>
    </div>
  );
}

/** 빠른 작업 버튼 */
function QuickActionButton({ icon: Icon, label, description, href, color, primary }: {
  icon: React.ElementType; label: string; description: string; href: string; color: string; primary?: boolean;
}) {
  return (
    <a
      href={href}
      className={`
        flex items-center gap-4 p-4 rounded-lg border transition-all hover:scale-[1.02]
        ${primary
          ? 'bg-murim-accent/10 border-murim-accent hover:bg-murim-accent/20'
          : 'bg-murim-darker border-murim-border hover:border-murim-accent'
        }
      `}
    >
      <Icon className={`w-8 h-8 text-${color} shrink-0`} />
      <div>
        <p className="font-semibold text-foreground text-sm">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto shrink-0" />
    </a>
  );
}
