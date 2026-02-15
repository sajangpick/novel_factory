import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 
   * [리스크 관리] 프로덕션 빌드 시 엄격한 타입 체크 활성화
   * .cursorrules의 Development Rule #3 준수
   */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
