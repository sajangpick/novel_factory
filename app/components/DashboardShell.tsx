'use client';

import { useState } from 'react';
import ReferenceDrawer from './ReferenceDrawer';

/**
 * [대시보드 셸] - 메인 컨텐츠 + 참조 서랍 래퍼
 * 모든 대시보드 페이지에서 오른쪽 참조 서랍을 사용할 수 있게 해줌
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* 오른쪽 참조 서랍 (모든 페이지 공용) */}
      <ReferenceDrawer
        isOpen={drawerOpen}
        onToggle={() => setDrawerOpen(!drawerOpen)}
      />
    </div>
  );
}
