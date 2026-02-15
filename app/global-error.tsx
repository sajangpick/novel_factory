'use client';

/**
 * [전역 에러 바운더리]
 * Next.js App Router 필수 컴포넌트
 * root layout에서 발생하는 에러를 잡아줍니다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko" className="dark">
      <body style={{ backgroundColor: '#0a0a0f', color: '#e5e5e5', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>시스템 오류가 발생했습니다</h2>
          <p style={{ color: '#999', marginBottom: '1.5rem' }}>{error?.message || '알 수 없는 오류'}</p>
          <button
            onClick={() => reset()}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
