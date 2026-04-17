/**
 * AuthContext — 인증 상태 관리
 * - Supabase 세션 정보를 앱 전역에서 공유하는 Context
 * - 왜 Context를 쓰나: 로그인 상태를 Navbar, Login 등 여러 컴포넌트에서
 *   prop drilling 없이 접근하기 위함
 * - Supabase가 미설정된 환경(로컬 개발 등)에서도 앱이 정상 동작하도록 방어 처리
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: false,
    signOut: async () => {},
});

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        // Supabase가 초기화되지 않은 경우 스킵 (환경변수 미설정 시)
        if (!supabase) {
            setLoading(false);
            return;
        }

        // 초기 세션 가져오기 — catch로 네트워크 에러 등 예외 대비
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setUser(session?.user ?? null);
            })
            .catch((error) => {
                console.error('세션 로딩 실패:', error);
            })
            .finally(() => {
                setLoading(false);
            });

        // 인증 상태 변경 리스너 — 로그인/로그아웃/토큰 갱신 시 자동 반영
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // 컴포넌트 언마운트 시 리스너 정리 — 메모리 누수 방지
        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

/** 인증 정보를 가져오는 커스텀 훅 */
export const useAuth = () => useContext(AuthContext);
