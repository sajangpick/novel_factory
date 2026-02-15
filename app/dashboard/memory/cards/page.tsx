'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Brain, RefreshCw, BookOpen, Clock, MapPin, Users, 
  Target, Zap, MessageSquare, ArrowRight,
  Coins, Sword, Heart, AlertTriangle
} from 'lucide-react';

/**
 * [Memory System - 화별 기억 카드]
 * memory_cards 테이블의 데이터를 조회/관리하는 페이지
 * 
 * 각 화의 핵심 정보를 압축 저장하여, 다음 화 집필 시 맥락을 유지
 * - 6하원칙 요약 (When, Where, Who, What, Why, How)
 * - 상태 변화 (체력, 무공, 자산, 관계)
 * - 복선, 3인격 역학, 핵심 대사, 다음 화 연결
 */

// ── 타입 정의 (DB memory_cards 테이블과 1:1 매칭) ──
interface MemoryCard {
  id: number;
  series_id: string;
  episode_number: number;
  episode_title: string;
  // 6하원칙
  when_summary: string;
  where_summary: string;
  who_summary: string;
  what_summary: string;
  why_summary: string;
  how_summary: string;
  // 상태 변화 (6개 개별 필드)
  asset_change: string;          // 💰 자산 변동
  martial_change: string;        // ⚔️ 무공 변화
  org_change: string;            // 👥 조직 변동
  relationship_change: string;   // 💕 관계 변화
  location_change: string;       // 🗺️ 위치 변동
  health_change: string;         // 🩸 부상/건강
  // 떡밥 (3개 개별 필드)
  foreshadow_planted: string;    // 🎣 새로 깐 복선
  foreshadow_hinted: string;     // 💡 기존 떡밥에 힌트
  foreshadow_resolved: string;   // ✅ 회수된 떡밥
  // 3인격 동향 (3개 개별 필드)
  dominant_personality: string;  // 주도 인격
  personality_conflict: string;  // 의견 충돌
  personality_growth: string;    // 관계 변화/성장
  // 핵심 대사
  key_dialogue: string;          // 가장 중요한 대사 1~2줄
  // 다음 화 연결 (3개 개별 필드)
  cliffhanger: string;           // 절단신공 포인트
  next_preview: string;          // 다음 화 필수 이어짐
  next_caution: string;          // 다음 화 주의사항
  // 타임스탬프
  created_at: string;
  updated_at: string;
}

export default function MemoryCardsPage() {
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  // ── 데이터 로드 ──
  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/memory-card');
      const data = await res.json();
      if (data.success) {
        setCards(data.cards || []);
        // 가장 최신 화를 기본 선택
        if (data.cards?.length > 0) {
          setSelectedCard(data.cards[data.cards.length - 1].episode_number);
        }
      } else {
        setError(data.message || '기억 카드를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      setError('네트워크 오류: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // 현재 선택된 카드 데이터
  const currentCard = cards.find(c => c.episode_number === selectedCard);

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-murim-accent animate-spin mx-auto mb-4" />
          <p className="text-gray-400">기억 카드 로딩 중...</p>
        </div>
      </div>
    );
  }

  // ── 에러 ──
  if (error) {
    return (
      <div className="p-8">
        <div className="widget-card border-murim-danger">
          <p className="text-murim-danger mb-4">{error}</p>
          <button onClick={loadCards} className="px-4 py-2 bg-murim-accent rounded-lg text-white">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* ━━━ 헤더 ━━━ */}
      <div className="border-b border-murim-border pb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Brain className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-foreground">화별 기억 카드</h1>
          </div>
          <p className="text-gray-500">
            각 화의 핵심 정보를 압축 저장 — AI 집필 시 맥락 유지용
          </p>
        </div>
        <button
          onClick={loadCards}
          className="px-4 py-2 bg-murim-dark hover:bg-gray-700 text-gray-300 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>새로고침</span>
        </button>
      </div>

      {/* ━━━ 에피소드 없음 ━━━ */}
      {cards.length === 0 ? (
        <div className="widget-card text-center py-12">
          <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">아직 기억 카드가 없습니다.</p>
          <p className="text-gray-500 text-sm mt-2">
            에피소드 집필 완료 후 자동으로 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ━━━ 좌측: 에피소드 목록 ━━━ */}
          <div className="lg:col-span-1">
            <div className="widget-card">
              <h3 className="text-sm font-bold text-foreground mb-3">
                전체 {cards.length}화 기록
              </h3>
              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {cards.map((card) => (
                  <button
                    key={card.episode_number}
                    onClick={() => setSelectedCard(card.episode_number)}
                    className={`
                      w-full text-left px-3 py-2.5 rounded-lg transition-colors
                      ${selectedCard === card.episode_number
                        ? 'bg-murim-accent text-white'
                        : 'bg-murim-darker text-gray-400 hover:bg-murim-dark hover:text-foreground'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">제{card.episode_number}화</span>
                      <span className="text-xs opacity-70">
                        {card.updated_at ? new Date(card.updated_at).toLocaleDateString('ko-KR') : ''}
                      </span>
                    </div>
                    {card.episode_title && (
                      <p className="text-xs mt-1 opacity-70 line-clamp-1">{card.episode_title}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ━━━ 우측: 선택된 카드 상세 ━━━ */}
          <div className="lg:col-span-3 space-y-4">
            {currentCard ? (
              <>
                {/* 카드 헤더 */}
                <div className="widget-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        제{currentCard.episode_number}화 기억 카드
                      </h2>
                      {currentCard.episode_title && (
                        <p className="text-gray-400 mt-1">{currentCard.episode_title}</p>
                      )}
                    </div>
                    <span className="px-3 py-1 bg-murim-success/20 text-murim-success rounded-full text-xs font-bold">
                      기록 완료
                    </span>
                  </div>
                </div>

                {/* 6하원칙 */}
                <div className="widget-card">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-murim-accent" />
                    <span>6하원칙 요약</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <SummaryCard icon={<Clock className="w-4 h-4 text-yellow-400" />} label="언제" value={currentCard.when_summary} />
                    <SummaryCard icon={<MapPin className="w-4 h-4 text-green-400" />} label="어디서" value={currentCard.where_summary} />
                    <SummaryCard icon={<Users className="w-4 h-4 text-blue-400" />} label="누가" value={currentCard.who_summary} />
                    <SummaryCard icon={<Target className="w-4 h-4 text-red-400" />} label="무엇을" value={currentCard.what_summary} />
                    <SummaryCard icon={<Zap className="w-4 h-4 text-purple-400" />} label="왜" value={currentCard.why_summary} />
                    <SummaryCard icon={<ArrowRight className="w-4 h-4 text-orange-400" />} label="어떻게" value={currentCard.how_summary} />
                  </div>
                </div>

                {/* 상태 변화 — 6개 개별 필드 */}
                <div className="widget-card">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <span>상태 변화</span>
                    <span className="text-xs text-gray-500 font-normal">(이전 화 대비 변동분)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <SummaryCard icon={<Coins className="w-4 h-4 text-yellow-400" />} label="💰 자산" value={currentCard.asset_change} />
                    <SummaryCard icon={<Sword className="w-4 h-4 text-blue-400" />} label="⚔️ 무공" value={currentCard.martial_change} />
                    <SummaryCard icon={<Users className="w-4 h-4 text-cyan-400" />} label="👥 조직" value={currentCard.org_change} />
                    <SummaryCard icon={<Heart className="w-4 h-4 text-pink-400" />} label="💕 관계" value={currentCard.relationship_change} />
                    <SummaryCard icon={<MapPin className="w-4 h-4 text-green-400" />} label="🗺️ 위치" value={currentCard.location_change} />
                    <SummaryCard icon={<AlertTriangle className="w-4 h-4 text-red-400" />} label="🩸 부상/건강" value={currentCard.health_change} />
                  </div>
                </div>

                {/* 복선 (떡밥) — 3개 개별 필드: 투하 / 힌트 / 회수 */}
                <div className="widget-card">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center space-x-2">
                    <Target className="w-5 h-5 text-orange-400" />
                    <span>복선 (떡밥)</span>
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="p-3 bg-murim-darker rounded-lg border border-orange-900/30">
                      <h4 className="text-xs font-bold text-orange-400 mb-2">🎣 투하 (새로 깐 복선)</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.foreshadow_planted || '없음'}
                      </p>
                    </div>
                    <div className="p-3 bg-murim-darker rounded-lg border border-yellow-900/30">
                      <h4 className="text-xs font-bold text-yellow-400 mb-2">💡 힌트 (기존 떡밥에 실마리)</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.foreshadow_hinted || '없음'}
                      </p>
                    </div>
                    <div className="p-3 bg-murim-darker rounded-lg border border-green-900/30">
                      <h4 className="text-xs font-bold text-green-400 mb-2">✅ 회수 (해결된 복선)</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.foreshadow_resolved || '없음'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3인격 동향 — 3개 개별 필드: 주도 / 갈등 / 성장 */}
                <div className="widget-card">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center space-x-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <span>3인격 동향</span>
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="p-3 bg-murim-darker rounded-lg border border-blue-900/30">
                      <h4 className="text-xs font-bold text-blue-400 mb-2">🎯 주도 인격</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.dominant_personality || '-'}
                      </p>
                    </div>
                    <div className="p-3 bg-murim-darker rounded-lg border border-red-900/30">
                      <h4 className="text-xs font-bold text-red-400 mb-2">⚡ 의견 충돌</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.personality_conflict || '없음'}
                      </p>
                    </div>
                    <div className="p-3 bg-murim-darker rounded-lg border border-green-900/30">
                      <h4 className="text-xs font-bold text-green-400 mb-2">🌱 관계 성장</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.personality_growth || '없음'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 핵심 대사 */}
                <div className="widget-card">
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                    <span>핵심 대사</span>
                  </h3>
                  <div className="p-4 bg-murim-darker rounded-lg border border-blue-900/30">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap italic">
                      {currentCard.key_dialogue || '기록된 대사 없음'}
                    </p>
                  </div>
                </div>

                {/* 다음 화 연결 — 3개 개별 필드: 절단 / 예고 / 주의 */}
                <div className="widget-card border-murim-accent/30">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center space-x-2">
                    <ArrowRight className="w-5 h-5 text-murim-accent" />
                    <span>다음 화 연결 고리</span>
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="p-3 bg-murim-darker rounded-lg border border-murim-accent/20">
                      <h4 className="text-xs font-bold text-murim-accent mb-2">✂️ 절단신공 포인트</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.cliffhanger || '없음'}
                      </p>
                    </div>
                    <div className="p-3 bg-murim-darker rounded-lg border border-cyan-900/30">
                      <h4 className="text-xs font-bold text-cyan-400 mb-2">📢 다음 화 예고</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.next_preview || '없음'}
                      </p>
                    </div>
                    <div className="p-3 bg-murim-darker rounded-lg border border-red-900/30">
                      <h4 className="text-xs font-bold text-red-400 mb-2">⚠️ 주의사항</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">
                        {currentCard.next_caution || '없음'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="widget-card text-center py-12">
                <p className="text-gray-400">왼쪽에서 에피소드를 선택해 주세요.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━ 하위 컴포넌트: 6하원칙 요약 카드 ━━━
interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function SummaryCard({ icon, label, value }: SummaryCardProps) {
  return (
    <div className="p-3 bg-murim-darker rounded-lg border border-murim-border">
      <div className="flex items-center space-x-2 mb-1">
        {icon}
        <span className="text-xs font-bold text-gray-500">{label}</span>
      </div>
      <p className="text-sm text-gray-300 whitespace-pre-wrap">{value || '-'}</p>
    </div>
  );
}

