import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { getPackageOptionRows } from '../lib/packageOptions'
import type { ExpertProduct, PackageTier, ProductPackage } from '../types'

type ProductPackages = ExpertProduct['packages']

interface PackageCardProps {
    packages: ProductPackages
    productId: string
    onOpenChat?: () => void
    chatButtonDisabled?: boolean
    isOwner?: boolean
    requireLogin?: boolean
}

const packageLabels: Record<PackageTier, string> = {
    standard: 'Standard',
    deluxe: 'Deluxe',
    premium: 'Premium',
}

const packageTiers = ['standard', 'deluxe', 'premium'] as const
const fallbackPackage: ProductPackage = {
    name: 'Standard',
    price: 0,
    deliveryDays: 1,
    revisionCount: 1,
    included: ['상담 후 작업 범위를 확정합니다.'],
}

const currency = new Intl.NumberFormat('ko-KR')

function getPackageTabs(packages: ProductPackages) {
    return packageTiers.filter((tab) => Boolean(packages[tab]))
}

export default function PackageCard({
    packages,
    productId,
    onOpenChat,
    chatButtonDisabled = false,
    isOwner = false,
    requireLogin = false,
}: PackageCardProps) {
    const navigate = useNavigate()
    const location = useLocation()
    const safePackages = useMemo(
        () => packages.standard
            ? packages
            : { standard: fallbackPackage, deluxe: null, premium: null },
        [packages],
    )
    const tabs = useMemo(() => getPackageTabs(safePackages), [safePackages])
    const [activeTab, setActiveTab] = useState<PackageTier>('standard')
    const currentPackage = safePackages[activeTab] ?? safePackages.standard

    const included = Array.isArray(currentPackage.included) && currentPackage.included.length > 0
        ? currentPackage.included
        : fallbackPackage.included
    const optionRows = getPackageOptionRows(safePackages)
    const includedSet = new Set(included)
    const goToLogin = () => {
        window.alert('로그인 후 이용할 수 있습니다.')
        navigate(ROUTES.LOGIN, { state: { from: { pathname: location.pathname, search: location.search } } })
    }
    const handlePackageRequest = () => {
        if (requireLogin) {
            goToLogin()
            return
        }
        navigate(`/request/${productId}`)
    }
    const handleOpenChat = () => {
        if (requireLogin) {
            goToLogin()
            return
        }
        onOpenChat?.()
    }

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
                <div className="package-price">{currency.format(currentPackage.price)}원</div>
                <p className="package-description">{currentPackage.name} 패키지로 시작합니다.</p>

                <div className="package-features">
                    <span>작업 {currentPackage.deliveryDays}일</span>
                    <span>수정 {currentPackage.revisionCount}회</span>
                </div>

                <ul className="package-list package-upgrade-list" data-testid="package-upgrade-feature-list">
                    {(optionRows.length > 0 ? optionRows : included.map((feature) => ({
                        label: feature,
                        values: { standard: '포함', deluxe: '포함', premium: '포함' },
                        available: {
                            standard: includedSet.has(feature),
                            deluxe: includedSet.has(feature),
                            premium: includedSet.has(feature),
                        },
                    }))).map((row) => {
                        const isAvailable = row.available[activeTab]

                        return (
                            <li key={row.label} className={isAvailable ? 'available' : 'unavailable'}>
                                <span className="material-symbols-outlined package-feature-icon" aria-hidden="true">
                                    {isAvailable ? 'check' : 'remove'}
                                </span>
                                <span className={`package-option-label ${isAvailable ? 'available' : 'unavailable'}`}>{row.label}</span>
                                <span className={`package-option-value ${isAvailable ? 'available' : 'unavailable'}`}>{row.values[activeTab]}</span>
                            </li>
                        )
                    })}
                </ul>

                {isOwner ? (
                    <p className="package-request-note">
                        내가 등록한 상품입니다. 상품 수정에서 가격과 패키지 정보를 관리할 수 있습니다.
                    </p>
                ) : (
                    <>
                        <p className="package-request-note">
                            결제 전 요구사항을 먼저 작성하고 전문가 제안을 받습니다.
                        </p>
                        <button type="button" className="btn-primary package-primary-cta" onClick={handlePackageRequest}>
                            상품 구매하기
                        </button>

                        {onOpenChat && (
                            <button
                                type="button"
                                onClick={handleOpenChat}
                                className="btn-text package-secondary-cta"
                                disabled={chatButtonDisabled}
                            >
                                {chatButtonDisabled ? '상담 생성 중' : '전문가에게 문의하기'}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
