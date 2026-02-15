'use client';

/**
 * [에러 바운더리]
 * Next.js App Router 필수 컴포넌트
 * 페이지 렌더링 중 에러를 잡아서 사용자에게 보여줍니다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-murim-darker p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-foreground mb-2">오류가 발생했습니다</h2>
        <p className="text-gray-400 mb-6 text-sm">{error?.message || '페이지를 불러오는 중 문제가 발생했습니다.'}</p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-murim-accent hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
