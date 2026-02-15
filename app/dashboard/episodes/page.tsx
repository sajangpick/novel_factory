'use client';

import { useState, useEffect } from 'react';
import { Film, Users, Sparkles, AlertCircle, Check, Loader } from 'lucide-react';

/**
 * [화수별 출연진 관리 페이지]
 * 
 * 기능:
 * 1. 300화 로드맵 표시
 * 2. 각 화마다 출연진 자동 생성
 * 3. 캐릭터 중복 방지
 * 4. 캐릭터 인명록 자동 확장
 */

interface Episode {
  id: number;
  title: string;
  skeleton: string;
  section: '기' | '승' | '전' | '결';
}

interface Character {
  id: string;
  name: string;
  title?: string;
  role: string;
  faction: string;
  age: string;
  martial_rank: string;
  appearance: string;
  first_appearance?: number;
}

interface EpisodeCast {
  episode: number;
  title: string;
  cast: string[];
  new_characters: Character[];
}

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [episodeCasts, setEpisodeCasts] = useState<EpisodeCast[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    existing: 0,
  });

  // Step 3에서 300화 데이터 불러오기
  useEffect(() => {
    const savedEpisodes = localStorage.getItem('novel_episodes_skeletons');
    if (savedEpisodes) {
      const parsed = JSON.parse(savedEpisodes);
      setEpisodes(parsed);
      console.log(`📚 ${parsed.length}화 로드 완료`);
    }
  }, []);

  /**
   * [캐릭터 자동 생성 시작]
   */
  const handleGenerateAllCast = async () => {
    if (episodes.length === 0) {
      alert('⚠️ 먼저 Step 3에서 300화 로드맵을 생성해주세요!');
      return;
    }

    if (
      !confirm(
        `🎬 ${episodes.length}화 출연진을 자동 생성합니다.\n\n` +
          `- 기존 캐릭터 재사용 우선\n` +
          `- 중복 방지 자동 처리\n` +
          `- 약 200-300명 생성 예상\n\n` +
          `시작하시겠습니까?`
      )
    ) {
      return;
    }

    setIsGenerating(true);

    try {
      // 기존 캐릭터 불러오기 (캐릭터 인명록에서)
      const savedCharacters = localStorage.getItem('novel_characters');
      const existingCharacters: Character[] = savedCharacters
        ? JSON.parse(savedCharacters)
        : [];

      console.log(`🎭 기존 캐릭터: ${existingCharacters.length}명`);

      // API 호출
      const response = await fetch('/api/generate-cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodes,
          existingCharacters,
        }),
      });

      if (!response.ok) {
        throw new Error('캐릭터 생성 실패');
      }

      const data = await response.json();

      console.log('✅ 생성 완료:', data);

      // 결과 저장
      setAllCharacters(data.all_characters);
      setEpisodeCasts(data.episode_casts);
      setStats({
        total: data.total_characters,
        new: data.new_characters_count,
        existing: existingCharacters.length,
      });

      // 캐릭터 인명록에 저장 (로컬스토리지)
      localStorage.setItem(
        'novel_characters',
        JSON.stringify(data.all_characters)
      );

      // 화수별 출연진 매핑 저장
      localStorage.setItem(
        'episode_casts',
        JSON.stringify(data.episode_casts)
      );

      setGenerated(true);

      alert(
        `🎉 캐릭터 생성 완료!\n\n` +
          `총 캐릭터: ${data.total_characters}명\n` +
          `기존: ${existingCharacters.length}명\n` +
          `신규: ${data.new_characters_count}명\n\n` +
          `캐릭터 인명록 페이지에서 확인하세요!`
      );
    } catch (error) {
      console.error('❌ 오류:', error);
      alert('캐릭터 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * [특정 화의 출연진 보기]
   */
  const getEpisodeCast = (episodeNumber: number): Character[] => {
    const cast = episodeCasts.find((ec) => ec.episode === episodeNumber);
    if (!cast) return [];

    return cast.cast
      .map((id) => allCharacters.find((c) => c.id === id))
      .filter(Boolean) as Character[];
  };

  return (
    <div className="p-8 space-y-6">
      {/* 헤더 */}
      <div className="border-b border-murim-border pb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Film className="w-8 h-8 text-murim-gold" />
          화수별 출연진 관리
        </h1>
        <p className="text-gray-500 mt-2">
          {episodes.length}화 로드맵 기반 캐릭터 자동 생성
        </p>
      </div>

      {/* 상태 카드 */}
      {generated && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-murim-darker border border-murim-border rounded-lg p-6">
            <p className="text-gray-500 text-sm mb-2">총 캐릭터</p>
            <p className="text-3xl font-bold text-murim-gold">{stats.total}명</p>
          </div>
          <div className="bg-murim-darker border border-murim-border rounded-lg p-6">
            <p className="text-gray-500 text-sm mb-2">기존 캐릭터</p>
            <p className="text-3xl font-bold text-murim-accent">{stats.existing}명</p>
          </div>
          <div className="bg-murim-darker border border-murim-border rounded-lg p-6">
            <p className="text-gray-500 text-sm mb-2">신규 생성</p>
            <p className="text-3xl font-bold text-green-500">{stats.new}명</p>
          </div>
        </div>
      )}

      {/* 자동 생성 버튼 */}
      {!generated && (
        <div className="bg-murim-darker border border-murim-gold rounded-lg p-8">
          <div className="flex items-start gap-4">
            <Sparkles className="w-8 h-8 text-murim-gold mt-1" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">
                🎬 300화 출연진 자동 생성
              </h3>
              <p className="text-gray-400 mb-4">
                각 화마다 필요한 캐릭터를 자동으로 생성합니다.
                <br />• <strong>중복 방지:</strong> 같은 이름/역할 자동 체크
                <br />• <strong>재등장 관리:</strong> 기존 캐릭터 우선 재사용
                <br />• <strong>세력별 작명:</strong> 소림사(혜자 돌림), 무당파(청자
                계열) 등<br />• <strong>일관성 유지:</strong> 사망한 캐릭터는 재등장
                불가
              </p>

              <button
                onClick={handleGenerateAllCast}
                disabled={isGenerating || episodes.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-murim-gold hover:bg-yellow-600 text-murim-darker rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    생성 중... (잠시만 기다려주세요)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    캐릭터 자동 생성 시작
                  </>
                )}
              </button>

              {episodes.length === 0 && (
                <p className="text-murim-danger text-sm mt-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  먼저 Step 3에서 300화 로드맵을 생성해주세요!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 생성 완료 후 화수별 출연진 표시 */}
      {generated && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Users className="w-6 h-6 text-murim-accent" />
            화수별 출연진 (총 {episodeCasts.length}화)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {episodeCasts.slice(0, 20).map((ec) => {
              const cast = getEpisodeCast(ec.episode);
              return (
                <div
                  key={ec.episode}
                  className="bg-murim-darker border border-murim-border rounded-lg p-4 hover:border-murim-gold transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-foreground">
                      제{ec.episode}화
                    </h3>
                    {ec.new_characters.length > 0 && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">
                        신규 {ec.new_characters.length}명
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{ec.title}</p>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">
                      출연: {cast.length}명
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {cast.slice(0, 5).map((char) => (
                        <span
                          key={char.id}
                          className="px-2 py-1 bg-murim-gold/20 text-murim-gold text-xs rounded"
                        >
                          {char.name}
                        </span>
                      ))}
                      {cast.length > 5 && (
                        <span className="px-2 py-1 text-gray-500 text-xs">
                          +{cast.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {episodeCasts.length > 20 && (
            <p className="text-center text-gray-500 text-sm">
              ... 외 {episodeCasts.length - 20}화 (전체 데이터는 로컬스토리지에 저장됨)
            </p>
          )}
        </div>
      )}

      {/* 안내 메시지 */}
      {!generated && !isGenerating && (
        <div className="bg-murim-darker/50 border border-murim-border rounded-lg p-6">
          <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-murim-gold" />
            자동 생성 시스템의 장점
          </h3>
          <ul className="space-y-2 text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-murim-gold">•</span>
              <span>
                <strong>완벽한 중복 방지:</strong> 같은 이름의 캐릭터가 절대
                생성되지 않습니다
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-murim-gold">•</span>
              <span>
                <strong>스토리 일관성:</strong> 한 번 등장한 캐릭터는 정보가 유지됩니다
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-murim-gold">•</span>
              <span>
                <strong>세력별 작명 규칙:</strong> 소림사는 혜(慧)자, 무당파는
                청(淸)자 등
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-murim-gold">•</span>
              <span>
                <strong>재등장 관리:</strong> 조연급 캐릭터는 여러 화에 재등장
                가능
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
