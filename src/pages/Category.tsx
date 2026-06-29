import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CategoryBrowsePanel from './CategoryBrowsePanel'
import ProductCard from '../components/ProductCard'
import { AI_CATEGORIES } from '../constants/categories'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts } from '../lib/storage'
import type { AiCategoryId, ExpertProduct } from '../types'
import './CategoryHero.css'
import './Category.css'

type SortOption = '추천순' | '가격 낮은순' | '가격 높은순' | '빠른 납기순'

const sortOptions: SortOption[] = ['추천순', '가격 낮은순', '가격 높은순', '빠른 납기순']

export default function Category() {
    const [searchParams] = useSearchParams()
    const initialCategory = searchParams.get('category') as AiCategoryId | null
    const initialCategoryIds = AI_CATEGORIES.map((category) => category.id)
    const initialSelectedCategories = initialCategory && initialCategoryIds.includes(initialCategory)
        ? [initialCategory]
        : initialCategoryIds
    const [products, setProducts] = useState<ExpertProduct[]>(mockExpertProducts)
    const [selectedCategories, setSelectedCategories] = useState<AiCategoryId[]>(initialSelectedCategories)
    const [searchKeyword, setSearchKeyword] = useState(searchParams.get('q') || '')
    const [sortBy, setSortBy] = useState<SortOption>('추천순')
    const [maxPrice, setMaxPrice] = useState(1000000)

    useEffect(() => {
        let active = true
        getExpertProducts()
            .then((items) => {
                if (active) setProducts(items.length ? items : mockExpertProducts)
            })
            .catch(() => {
                if (active) setProducts(mockExpertProducts)
            })
        return () => {
            active = false
        }
    }, [])

    const toggleCategory = (categoryId: AiCategoryId) => {
        const allCategoryIds = AI_CATEGORIES.map((category) => category.id)

        if (selectedCategories.length === AI_CATEGORIES.length) {
            setSelectedCategories([categoryId])
            return
        }

        if (selectedCategories.length === 1 && selectedCategories.includes(categoryId)) {
            setSelectedCategories([])
            return
        }

        if (selectedCategories.includes(categoryId)) {
            const nextCategories = selectedCategories.filter((item) => item !== categoryId)
            setSelectedCategories(nextCategories.length > 0 ? nextCategories : allCategoryIds)
        } else {
            setSelectedCategories([...selectedCategories, categoryId])
        }
    }

    const allCategoriesSelected = selectedCategories.length === AI_CATEGORIES.length
    const normalizedKeyword = searchKeyword.trim().toLowerCase()

    const filteredProducts = products.filter((product) => {
        const searchableText = [
            product.title,
            product.summary,
            product.description,
            product.expertName,
        ]
            .join(' ')
            .toLowerCase()
        const matchesCategory =
            allCategoriesSelected ||
            selectedCategories.length === 0 ||
            selectedCategories.includes(product.category)
        const matchesKeyword = !normalizedKeyword || searchableText.includes(normalizedKeyword)
        const matchesPrice = product.startingPrice <= maxPrice

        return matchesCategory && matchesKeyword && matchesPrice
    })

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        switch (sortBy) {
            case '가격 낮은순':
                return a.startingPrice - b.startingPrice
            case '가격 높은순':
                return b.startingPrice - a.startingPrice
            case '빠른 납기순':
                return a.deliveryDays - b.deliveryDays
            case '추천순':
            default:
                return 0
        }
    })

    const maxPriceLabel =
        maxPrice >= 1000000 ? '전체 가격' : `${(maxPrice / 10000).toLocaleString()}만원 이하`
    const selectedCategorySummary = allCategoriesSelected || selectedCategories.length === 0
        ? '전체 카테고리'
        : AI_CATEGORIES.filter((category) => selectedCategories.includes(category.id)).map((category) => category.name).join(', ')

    return (
        <>
            <div className="category-hero">
                <div className="container">
                    <div className="category-hero-copy">
                        <nav className="category-breadcrumb" aria-label="현재 위치">
                            <Link to="/">홈</Link>
                            <span aria-hidden="true">/</span>
                            <span>AI 작업 찾기</span>
                        </nav>
                        <h1>AI 작업 찾기</h1>
                        <p>샘플, 판매자, 가격, 납기를 한 번에 비교하고 마음에 드는 AI 상품을 바로 확인하세요.</p>
                    </div>
                </div>
            </div>

            <main className="container">
                <form
                    className="category-search category-search--top"
                    role="search"
                    aria-label="상품 검색"
                    onSubmit={(event) => event.preventDefault()}
                >
                    <div className="category-search-box">
                        <span className="material-symbols-outlined" aria-hidden="true">search</span>
                        <input
                            id="category-product-search"
                            type="search"
                            aria-label="상품 검색어"
                            value={searchKeyword}
                            onChange={(event) => setSearchKeyword(event.target.value)}
                            placeholder="어떤 AI 작업이 필요하신가요?"
                        />
                    </div>
                </form>

                <CategoryBrowsePanel
                    onSearchTerm={setSearchKeyword}
                />

                <div className="category-page-layout">
                    <aside className="filter-sidebar" aria-label="상품 필터">
                        <div className="filter-sidebar-head">
                            <strong>필터</strong>
                            <span>{selectedCategorySummary}</span>
                        </div>

                        <div className="filter-group">
                            <h4>카테고리</h4>
                            {AI_CATEGORIES.map((category) => (
                                <label key={category.id}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(category.id)}
                                        onChange={() => toggleCategory(category.id)}
                                    />
                                    {category.name}
                                </label>
                            ))}
                        </div>

                        <div className="filter-group">
                            <h4>예산</h4>
                            <label className="range-label" htmlFor="max-price">
                                최대 가격
                            </label>
                            <input
                                id="max-price"
                                className="price-range"
                                type="range"
                                min="0"
                                max="1000000"
                                step="10000"
                                value={maxPrice}
                                onChange={(event) => setMaxPrice(Number(event.target.value))}
                            />
                            <div className="price-current">{maxPriceLabel}</div>
                            <div className="price-range-caption">
                                <span>0원</span>
                                <span>100만원+</span>
                            </div>
                        </div>

                    </aside>

                    <div className="product-list-main">
                        <div className="product-list-header">
                            <div>
                                <strong>총 {sortedProducts.length}개의 AI 작업</strong>
                                <span>{normalizedKeyword ? `"${searchKeyword.trim()}" 검색 결과` : selectedCategorySummary}</span>
                            </div>
                            <select
                                aria-label="상품 정렬"
                                className="sort-select"
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value as SortOption)}
                            >
                                {sortOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>

                        {sortedProducts.length > 0 ? (
                            <div className="product-grid">
                                {sortedProducts.map((product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        ) : (
                            <section className="empty-products">
                                <h2>조건에 맞는 AI 작업이 없습니다.</h2>
                                <p>검색어를 줄이거나 카테고리, 예산 조건을 넓혀 다시 확인해보세요.</p>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </>
    )
}
