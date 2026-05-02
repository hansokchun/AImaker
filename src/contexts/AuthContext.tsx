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
        if (!supabase) {
            setLoading(false);
            return;
        }

        /** 프로필 존재 여부를 확인하고 없으면 온보딩으로 리다이렉트 */
        const checkProfileAndRedirect = async (currentUser: User | null) => {
            if (!currentUser) return;

            // 온보딩/로그인 페이지에 이미 있으면 무한 루프 방지
            const path = window.location.pathname;
            if (path === '/onboarding' || path === '/login') return;

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, name')
                    .eq('id', currentUser.id)
                    .single();

                // 프로필이 없거나 이름이 비어있으면 → 온보딩으로 이동
                if (error || !data || !data.name) {
                    window.location.href = '/onboarding';
                }
            } catch (err) {
                console.error('프로필 체크 에러:', err);
            }
        };

        // 초기 세션 가져오기
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setUser(session?.user ?? null);
                checkProfileAndRedirect(session?.user ?? null);
            })
            .catch((error) => {
                console.error('세션 로딩 실패:', error);
            })
            .finally(() => {
                setLoading(false);
            });

        // 인증 상태 변경 리스너
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            checkProfileAndRedirect(session?.user ?? null);
        });

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
