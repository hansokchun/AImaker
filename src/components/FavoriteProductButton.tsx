import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { getFavoriteProductCount, getUserFavoriteProductIds, toggleFavoriteProduct } from '../lib/storage'

interface FavoriteProductButtonProps {
    productId: string
    productTitle: string
    className?: string
    showCount?: boolean
}

export default function FavoriteProductButton({ productId, productTitle, className = '', showCount = false }: FavoriteProductButtonProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([])
    const [favoriteCount, setFavoriteCount] = useState(0)
    const [saving, setSaving] = useState(false)
    const toggledByUserRef = useRef(false)
    const isFavorite = favoriteProductIds.includes(productId)

    useEffect(() => {
        let active = true
        getFavoriteProductCount(productId)
            .then((count) => {
                if (active) setFavoriteCount(count)
            })
            .catch(() => {
                if (active) setFavoriteCount(0)
            })

        if (!user) {
            setFavoriteProductIds([])
            toggledByUserRef.current = false
            return
        }
        toggledByUserRef.current = false

        getUserFavoriteProductIds(user.id)
            .then((ids) => {
                if (active && !toggledByUserRef.current) setFavoriteProductIds(ids)
            })
            .catch(() => {
                if (active) setFavoriteProductIds([])
            })

        return () => {
            active = false
        }
    }, [user, productId])

    const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        event.stopPropagation()

        if (!user) {
            navigate(ROUTES.LOGIN, { state: { from: { pathname: location.pathname, search: location.search } } })
            return
        }

        setSaving(true)
        toggledByUserRef.current = true
        const optimisticIds = isFavorite
            ? favoriteProductIds.filter((id) => id !== productId)
            : [productId, ...favoriteProductIds]
        setFavoriteCount((count) => Math.max(0, count + (isFavorite ? -1 : 1)))
        setFavoriteProductIds(optimisticIds)
        try {
            const nextIds = await toggleFavoriteProduct(user.id, productId)
            const nextStateMatchesIntent = isFavorite ? !nextIds.includes(productId) : nextIds.includes(productId)
            setFavoriteProductIds(nextStateMatchesIntent ? nextIds : optimisticIds)
            const nextCount = await getFavoriteProductCount(productId)
            setFavoriteCount(nextCount)
        } finally {
            setSaving(false)
        }
    }

    return (
        <button
            type="button"
            className={`favorite-product-button ${isFavorite ? 'is-active' : ''} ${className}`.trim()}
            aria-label={`${productTitle} ${isFavorite ? '관심 상품 해제' : '관심 상품 추가'}`}
            aria-pressed={isFavorite}
            disabled={saving}
            onClick={handleClick}
        >
            <span className="material-symbols-outlined" aria-hidden="true">
                {isFavorite ? 'favorite' : 'favorite_border'}
            </span>
            <span>{isFavorite ? '관심 상품' : '관심 추가'}</span>
            {showCount && <small>{favoriteCount.toLocaleString('ko-KR')}명 관심</small>}
        </button>
    )
}
