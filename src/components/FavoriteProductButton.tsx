import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { getUserFavoriteProductIds, toggleFavoriteProduct } from '../lib/storage'

interface FavoriteProductButtonProps {
    productId: string
    productTitle: string
    className?: string
}

export default function FavoriteProductButton({ productId, productTitle, className = '' }: FavoriteProductButtonProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const toggledByUserRef = useRef(false)
    const isFavorite = favoriteProductIds.includes(productId)

    useEffect(() => {
        let active = true
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
        setFavoriteProductIds(optimisticIds)
        try {
            const nextIds = await toggleFavoriteProduct(user.id, productId)
            const nextStateMatchesIntent = isFavorite ? !nextIds.includes(productId) : nextIds.includes(productId)
            setFavoriteProductIds(nextStateMatchesIntent ? nextIds : optimisticIds)
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
        </button>
    )
}
