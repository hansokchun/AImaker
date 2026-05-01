/**
 * PackageCard 컴포넌트
 * - 전문가 상세 페이지 우측의 요금 패키지 카드
 * - Standard / Deluxe / Premium 3단계 요금 체계를 탭으로 전환
 * - 왜 분리: ExpertDetail이 234줄로 비대해져 단일 책임 원칙에 위배되었음
 */
import { useState } from 'react';

/** 패키지 탭 종류 */
type PackageTab = 'standard' | 'deluxe' | 'premium';

/** 각 패키지의 상세 정보 */
import type { PackageInfo } from '../types';

/** 패키지 데이터 — 프로필에서 설정한 데이터를 우선으로 하되, 없으면 기본값 사용 */
const PACKAGES: Record<PackageTab, PackageInfo> = {
    standard: {
        price: '₩50,000',
        description: '간단한 AI 이미지 생성 및 기본 보정. (최대 3장 제공)',
        workDays: '⏲️ 작업일 2일',
        revisions: '🔄 수정 1회',
        features: ['✔️ 고해상도 이미지 (PNG)', '✔️ 개인적 용도 라이선스'],
    },
    deluxe: {
        price: '₩150,000',
        description: '상업적 용도의 고품질 AI 이미지 및 간단한 애니메이션 효과.',
        workDays: '⏲️ 작업일 4일',
        revisions: '🔄 수정 3회',
        features: ['✔️ 초고해상도 업스케일링', '✔️ 상업적 용도 라이선스', '✔️ 원본 파일 제공'],
    },
    premium: {
        price: '₩450,000',
        description: '풀 패키지 AI 영상 제작. 시나리오부터 편집, 배경음악 포함 전문 영상',
        workDays: '⏲️ 작업일 10일',
        revisions: '🔄 수정 5회',
        features: ['✔️ 4K 시네마틱 퀄리티', '✔️ 전문 성우 AI 음성 더빙', '✔️ 독점 상업적 사용권'],
    },
};

interface PackageCardProps {
    /** 전문가가 등록한 패키지 데이터 (선택적) */
    packages?: Record<PackageTab, PackageInfo>;
    /** 채팅 모달을 여는 콜백 — 문의하기 버튼에 연결 */
    onOpenChat: () => void;
}

export default function PackageCard({ packages = PACKAGES, onOpenChat }: PackageCardProps) {
    const [activeTab, setActiveTab] = useState<PackageTab>('standard');
    const currentPackage = packages[activeTab];

    return (
        <div className="package-card">
            {/* 패키지 탭 — 3개 등급 전환 */}
            <div className="package-tabs">
                {(Object.keys(packages) as PackageTab[]).map((tab) => (
                    <div
                        key={tab}
                        className={`package-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </div>
                ))}
            </div>

            {/* 선택된 패키지 상세 정보 */}
            <div className="package-content">
                <div style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem' }}>
                    {currentPackage.price}
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    {currentPackage.description}
                </p>
                <div className="package-features">
                    <span>{currentPackage.workDays}</span>
                    <span>{currentPackage.revisions}</span>
                </div>
                <ul className="package-list">
                    {currentPackage.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                    ))}
                </ul>

                <button
                    className="btn-primary"
                    style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', borderRadius: '12px', marginBottom: '1rem' }}
                >
                    주문하기
                </button>
                <button
                    onClick={onOpenChat}
                    className="btn-text"
                    style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', fontWeight: 700 }}
                >
                    전문가에게 문의하기
                </button>
            </div>
        </div>
    );
}
