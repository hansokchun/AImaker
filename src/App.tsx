/**
 * App 루트 컴포넌트
 * - 전체 라우팅 구조와 공통 레이아웃(Navbar, Footer)을 정의
 * - ErrorBoundary로 감싸 런타임 에러 시 앱 전체 크래시를 방지
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ROUTES } from './constants/routes';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Category from './pages/Category';
import ExpertDetail from './pages/ExpertDetail';
import ServiceRequest from './pages/ServiceRequest';
import Proposal from './pages/Proposal';
import ProposalCreate from './pages/ProposalCreate';
import Workroom from './pages/Workroom';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import MyPage from './pages/MyPage';
import WorkDashboard from './pages/WorkDashboard';
import Profile from './pages/Profile';
import ProductRegister from './pages/ProductRegister';
import NotFound from './pages/NotFound';

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Navbar />
                <Routes>
                    <Route path={ROUTES.HOME} element={<Home />} />
                    <Route path={ROUTES.CATEGORY} element={<Category />} />
                    <Route path={ROUTES.EXPERT_DETAIL} element={<ExpertDetail />} />
                    <Route path={ROUTES.PRODUCT_NEW} element={<ProductRegister />} />
                    <Route path={ROUTES.PRODUCT_EDIT} element={<ProductRegister />} />
                    <Route path={ROUTES.SERVICE_REQUEST_PRODUCT} element={<ServiceRequest />} />
                    <Route path={ROUTES.PROPOSAL_NEW} element={<ProposalCreate />} />
                    <Route path={ROUTES.PROPOSAL} element={<Proposal />} />
                    <Route path={ROUTES.WORKROOM} element={<Workroom />} />
                    <Route path={ROUTES.LOGIN} element={<Login />} />
                    <Route path={ROUTES.ONBOARDING} element={<Onboarding />} />
                    <Route path={ROUTES.MY_PAGE} element={<MyPage mode="profile" />} />
                    <Route path={ROUTES.WORK_DASHBOARD} element={<WorkDashboard />} />
                    <Route path={ROUTES.PROFILE} element={<Profile />} />
                    {/* 정의되지 않은 경로 → 404 페이지 */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
                <Footer />
            </Router>
        </ErrorBoundary>
    );
}

export default App;
