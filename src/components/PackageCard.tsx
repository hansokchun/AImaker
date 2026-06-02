import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ExpertProduct, PackageTier, ProductPackage } from '../types'

type ProductPackages = ExpertProduct['packages']

interface PackageCardProps {
    packages: ProductPackages
    productId: string
    onOpenChat?: () => void
    chatButtonDisabled?: boolean
}

const packageLabels: Record<PackageTier, string> = {
    standard: 'Standard',
    deluxe: 'Deluxe',
    premium: 'Premium',
}

const currency = new Intl.NumberFormat('ko-KR')

function getPackageTabs(packages: ProductPackages) {
    return (Object.keys(packageLabels) as PackageTier[]).filter((tab) => Boolean(packages?.[tab]))
}

export default function PackageCard({ packages, productId, onOpenChat, chatButtonDisabled = false }: PackageCardProps) {
    const fallbackPackage: ProductPackage = {
        name: 'Standard',
        price: 0,
        deliveryDays: 1,
        revisionCount: 1,
        included: ['상담 후 작업 범위를 확정합니다.'],
    }
    const safePackages = packages?.standard
        ? packages
        : { standard: fallbackPackage, deluxe: null, premium: null }
    const tabs = useMemo(() => getPackageTabs(safePackages), [safePackages])
    const [activeTab, setActiveTab] = useState<PackageTier>('standard')
    const currentPackage = safePackages[activeTab] ?? safePackages.standard

    const renderPackage = currentPackage as ProductPackage

    return (
        <div className="package-card">
            <div className="package-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        className={`package-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {packageLabels[tab]}
                    </button>
                ))}
            </div>

            <div className="package-content">
                <div className="package-price">{currency.format(renderPackage.price)}원</div>
                <p className="package-description">{renderPackage.name} 패키지로 시작합니다.</p>

                <div className="package-features">
                    <span>작업 {renderPackage.deliveryDays}일</span>
                    <span>수정 {renderPackage.revisionCount}회</span>
                </div>

                <ul className="package-list">
                    {renderPackage.included.map((feature) => (
                        <li key={feature}>{feature}</li>
                    ))}
                </ul>

                <p className="package-request-note">
                    결제 전 요구사항을 먼저 작성하고 전문가 제안을 받습니다.
                </p>
                <Link className="btn-primary package-primary-cta" to={`/request/${productId}`}>
                    패키지로 의뢰하기
                </Link>

                {onOpenChat && (
                    <button
                        type="button"
                        onClick={onOpenChat}
                        className="btn-text package-secondary-cta"
                        disabled={chatButtonDisabled}
                    >
                        {chatButtonDisabled ? '상담 생성 중' : '전문가에게 문의하기'}
                    </button>
                )}
            </div>
        </div>
    )
}
