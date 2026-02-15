import { createClient } from '@supabase/supabase-js';

/**
 * [Supabase 클라이언트 설정]
 * .cursorrules의 Development Rule #3 준수
 * - 리스크 관리: 환경 변수 검증을 최우선으로 처리
 * - 데이터 중심 설계: 싱글톤 패턴으로 재사용
 */

// 환경 변수 검증 (유연한 체크 - 개발 초기에는 경고만)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Supabase 설정 여부 확인
 */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

/**
 * Supabase 클라이언트 인스턴스
 * 
 * [사용 예시]
 * import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
 * 
 * if (isSupabaseConfigured) {
 *   const { data, error } = await supabase.from('projects').select('*');
 * } else {
 *   // Supabase 미설정 시 대체 로직
 * }
 */
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // 개발 모드: null 허용

/**
 * Supabase 환경 변수 설정 가이드
 * 
 * .env.local 파일에 다음 값을 추가하세요:
 * NEXT_PUBLIC_SUPABASE_URL=your-project-url
 * NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 */

/**
 * [타입 안전성을 위한 Database 타입 정의]
 * 추후 Supabase CLI로 자동 생성 가능
 */
export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          title: string;
          genre: string;
          current_chapter: number;
          total_chapters: number;
          risk_level: 'low' | 'medium' | 'high';
          ai_token_usage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
    };
  };
};
