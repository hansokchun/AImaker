/**
 * Login 페이지 — 로그인 / 회원가입
 * - 이메일/비밀번호 인증 + OAuth(Google, Kakao) 지원
 * - Supabase Auth를 사용하며, 환경변수 미설정 시 안내 메시지 표시
 * - isSignUp 상태로 로그인/회원가입 폼을 토글
 */
import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../constants/routes';
import type { Provider } from '@supabase/supabase-js';
import './Login.css';

export default function Login() {
    const navigate = useNavigate();
    const [isSignUp, setIsSignUp] = useState<boolean>(false);
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [successMsg, setSuccessMsg] = useState<string>('');

    /** 이메일/비밀번호 폼 제출 핸들러 */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        // Supabase 미설정 환경 방어
        if (!supabase) {
            setError('인증 서비스가 설정되지 않았습니다.');
            setLoading(false);
            return;
        }

        try {
            if (isSignUp) {
                // 이름은 온보딩에서 별도로 받으므로 여기서는 이메일/비밀번호만 전달
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setSuccessMsg('가입 확인 이메일을 발송했습니다. 이메일을 확인해주세요!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                navigate(ROUTES.HOME);
            }
        } catch (err) {
            // Supabase 에러는 Error 인스턴스, 그 외 예외 상황도 방어
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('알 수 없는 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    /** OAuth 로그인 핸들러 */
    const handleOAuthLogin = async (provider: Provider) => {
        if (!supabase) {
            setError('인증 서비스가 설정되지 않았습니다.');
            return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: window.location.origin },
        });
        if (error) setError(error.message);
    };

    /** 로그인 ↔ 회원가입 전환 시 에러/성공 메시지 초기화 */
    const toggleMode = (signUp: boolean) => {
        setIsSignUp(signUp);
        setError('');
        setSuccessMsg('');
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <Link to={ROUTES.HOME} className="logo login-logo">
                        <span className="material-symbols-outlined">handshake</span>
                        AIConnect
                    </Link>
                    <h1>AIConnect 시작하기</h1>
                    <p>
                        {isSignUp
                            ? '가입 후 프로필을 작성하면 의뢰자와 작업자 기능을 모두 이용할 수 있어요.'
                            : 'Google 또는 카카오로 빠르게 로그인하고 거래를 이어가세요.'}
                    </p>
                </div>

                {error && <div className="auth-error"><span className="material-symbols-outlined">error</span>{error}</div>}
                {successMsg && <div className="auth-success"><span className="material-symbols-outlined">check_circle</span>{successMsg}</div>}

                <div className="auth-primary-panel" aria-label="소셜 로그인">
                    <div className="oauth-buttons">
                        <button type="button" className="oauth-btn google" onClick={() => handleOAuthLogin('google')}>
                            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            Google로 계속하기
                        </button>
                        <button type="button" className="oauth-btn kakao" onClick={() => handleOAuthLogin('kakao' as Provider)}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="#3C1E1E"><path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24-.19.7-.69 2.54-.79 2.94-.13.49.18.48.38.35.15-.1 2.44-1.66 3.43-2.33.85.12 1.72.18 2.6.18 5.52 0 10-3.36 10-7.38C22 6.36 17.52 3 12 3z"/></svg>
                            카카오로 계속하기
                        </button>
                    </div>
                    <p className="auth-trust-note">
                        <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
                        소셜 계정으로 시작하면 이메일 소유 확인이 자동으로 연결됩니다.
                    </p>
                </div>

                <div className="divider"><span>또는</span></div>

                <form className="email-auth-panel" onSubmit={handleSubmit}>
                    <div className="email-auth-header">
                        <h2>{isSignUp ? '이메일로 가입하기' : '이메일로 계속하기'}</h2>
                        <p>
                            {isSignUp
                                ? '가입 확인 메일을 통해 이메일 소유를 확인합니다.'
                                : '이메일 인증 후 거래 기능을 이용할 수 있어요.'}
                        </p>
                    </div>
                    {/* 이름 입력은 온보딩(/onboarding)에서 처리됨 */}
                    <div className="form-group">
                        <label>이메일</label>
                        <input
                            type="email"
                            className="form-control"
                            placeholder="email@example.com"
                            value={email}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>비밀번호</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="비밀번호를 입력하세요"
                            value={password}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>
                    <button type="submit" className="btn-primary login-btn" disabled={loading}>
                        {loading ? '처리 중...' : (isSignUp ? '이메일로 회원가입' : '이메일로 로그인')}
                    </button>
                </form>

                <div className="login-footer">
                    {isSignUp ? (
                        <p>이미 계정이 있으신가요? <button className="switch-btn" onClick={() => toggleMode(false)}>로그인</button></p>
                    ) : (
                        <p>계정이 없으신가요? <button className="switch-btn" onClick={() => toggleMode(true)}>회원가입</button></p>
                    )}
                </div>
            </div>
        </div>
    );
}
