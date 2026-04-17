/**
 * ErrorBoundary 컴포넌트
 * - React 렌더링 중 발생하는 예기치 않은 에러를 잡아 앱 전체 크래시를 방지
 * - 왜 필요: React의 기본 동작은 에러 발생 시 전체 컴포넌트 트리를 언마운트하여
 *   사용자에게 빈 화면을 보여주는데, 이는 심각한 UX 문제
 * - Class 컴포넌트로 작성: React의 componentDidCatch는 아직 함수형에서 미지원
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ROUTES } from '../constants/routes';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    errorMessage: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, errorMessage: error.message };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // 향후 Sentry 등 에러 모니터링 서비스로 전송할 위치
        console.error('ErrorBoundary 에러 캐치:', error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, errorMessage: '' });
        window.location.href = ROUTES.HOME;
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    padding: '2rem',
                    textAlign: 'center',
                }}>
                    <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '4rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}
                    >
                        error_outline
                    </span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem' }}>
                        문제가 발생했습니다
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '500px' }}>
                        예기치 않은 오류가 발생했습니다. 홈으로 돌아가 다시 시도해 주세요.
                    </p>
                    <button className="btn-primary" onClick={this.handleReset}>
                        홈으로 돌아가기
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
