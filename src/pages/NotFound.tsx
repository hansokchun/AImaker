/**
 * 404 Not Found 페이지
 * - 존재하지 않는 경로로 접근했을 때 보여주는 안내 페이지
 * - 왜 필요: 기존에는 잘못된 URL 접근 시 빈 화면이 표시되어 UX가 좋지 않았음
 */
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

export default function NotFound() {
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
                style={{ fontSize: '5rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}
            >
                explore_off
            </span>
            <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--primary)' }}>
                404
            </h1>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                페이지를 찾을 수 없습니다
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px' }}>
                요청하신 페이지가 존재하지 않거나 이동되었습니다. 주소를 다시 확인해 주세요.
            </p>
            <Link to={ROUTES.HOME} className="btn-primary">
                홈으로 돌아가기
            </Link>
        </div>
    );
}
