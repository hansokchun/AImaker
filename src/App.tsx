import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ROUTES } from './constants/routes';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { PageLoading } from './components/PageLoading';

const Home = lazy(() => import('./pages/Home'));
const Category = lazy(() => import('./pages/Category'));
const ExpertDetail = lazy(() => import('./pages/ExpertDetail'));
const ServiceRequest = lazy(() => import('./pages/ServiceRequest'));
const Proposal = lazy(() => import('./pages/Proposal'));
const TossPaymentFail = lazy(() => import('./pages/TossPaymentFail'));
const TossPaymentSuccess = lazy(() => import('./pages/TossPaymentSuccess'));
const ProposalCreate = lazy(() => import('./pages/ProposalCreate'));
const Workroom = lazy(() => import('./pages/Workroom'));
const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const MyPage = lazy(() => import('./pages/MyPage'));
const WorkDashboard = lazy(() => import('./pages/WorkDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const ProductRegister = lazy(() => import('./pages/ProductRegister'));
const Report = lazy(() => import('./pages/Report'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Admin = lazy(() => import('./pages/Admin'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Navbar />
                <Suspense fallback={<PageLoading title="페이지를 불러오는 중" description="필요한 화면만 빠르게 준비하고 있습니다." />}>
                    <Routes>
                        <Route path={ROUTES.HOME} element={<Home />} />
                        <Route path={ROUTES.CATEGORY} element={<Category />} />
                        <Route path={ROUTES.EXPERT_DETAIL} element={<ExpertDetail />} />
                        <Route path={ROUTES.PRODUCT_NEW} element={<ProductRegister />} />
                        <Route path={ROUTES.PRODUCT_EDIT} element={<ProductRegister />} />
                        <Route path={ROUTES.SERVICE_REQUEST_PRODUCT} element={<ServiceRequest />} />
                        <Route path={ROUTES.PROPOSAL_NEW} element={<ProposalCreate />} />
                        <Route path={ROUTES.PROPOSAL} element={<Proposal />} />
                        <Route path={ROUTES.TOSS_PAYMENT_SUCCESS} element={<TossPaymentSuccess />} />
                        <Route path={ROUTES.TOSS_PAYMENT_FAIL} element={<TossPaymentFail />} />
                        <Route path={ROUTES.WORKROOM} element={<Workroom />} />
                        <Route path={ROUTES.LOGIN} element={<Login />} />
                        <Route path={ROUTES.ONBOARDING} element={<Onboarding />} />
                        <Route path={ROUTES.MY_PAGE} element={<MyPage mode="profile" />} />
                        <Route path={ROUTES.WORK_DASHBOARD} element={<WorkDashboard />} />
                        <Route path={ROUTES.PROFILE} element={<Profile />} />
                        <Route path={ROUTES.REPORT} element={<Report />} />
                        <Route path={ROUTES.ADMIN} element={<Admin />} />
                        <Route path={ROUTES.TERMS} element={<LegalPage variant="terms" />} />
                        <Route path={ROUTES.PRIVACY} element={<LegalPage variant="privacy" />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
                <Footer />
            </Router>
        </ErrorBoundary>
    );
}

export default App;
