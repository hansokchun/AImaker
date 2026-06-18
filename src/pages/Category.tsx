import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { AI_CATEGORIES } from '../constants/categories'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts } from '../lib/storage'
import type { AiCategoryId, ExpertProduct } from '../types'
import './Category.css'

export default function Category() {
    const [searchParams] = useSearchParams()
    const initialCategory = searchParams.get('category') as AiCategoryId | null
    const initialCategoryIds = AI_CATEGORIES.map((category) => category.id)
    const initialSelectedCategories = initialCategory && initialCategoryIds.includes(initialCategory)
        ? [initialCategory]
        : initialCategoryIds
    const [products, setProducts] = useState<ExpertProduct[]>(mockExpertProducts)
    const [selectedCategories, setSelectedCategories] = useState<AiCategoryId[]>(
        initialSelectedCategories,
    )
    const [selectedTool, setSelectedTool] = useState<string>('')
    const [sortBy, setSortBy] = useState<string>('추천순')
    const [maxPrice, setMaxPrice] = useState<number>(1000000)

    const tools = useMemo(
        () => Array.from(new Set(products.flatMap((product) => product.aiTools))).sort(),
        [products],
    )

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

    const filteredProducts = products.filter((product) => {
        const matchesCategory =
            allCategoriesSelected ||
            selectedCategories.length === 0 ||
            selectedCategories.includes(product.category)
        const matchesPrice = product.startingPrice <= maxPrice
        const matchesTool = !selectedTool || product.aiTools.includes(selectedTool)

        return matchesCategory && matchesPrice && matchesTool
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
        maxPrice >= 1000000 ? '전체' : `${(maxPrice / 10000).toLocaleString()}만원 이하`

    return (
        <>
            <div className="category-hero">
                <div className="container">
                    <h1>AI 작업 찾기</h1>
                    <p>샘플 결과물, 시작 가격, 사용 AI 도구를 보고 원하는 작업을 선택하세요.</p>
                </div>
            </div>

            <main className="container">
                <div className="category-page-layout">
                    <aside className="filter-sidebar">
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
                                onChange={(e) => setMaxPrice(Number(e.target.value))}
                            />
                            <div className="price-current">{maxPriceLabel}</div>
                            <div className="price-range-caption">
                                <span>0원</span>
                                <span>100만원+</span>
                            </div>
                        </div>

                        <div className="filter-group">
                            <h4>AI 도구</h4>
                            <select
                                aria-label="사용 AI 도구"
                                className="tool-select"
                                value={selectedTool}
                                onChange={(event) => setSelectedTool(event.target.value)}
                            >
                                <option value="">전체 도구</option>
                                {tools.map((tool) => (
                                    <option key={tool} value={tool}>
                                        {tool}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </aside>

                    <div className="product-list-main">
                        <div className="product-list-header">
                            <span>총 {sortedProducts.length}개의 AI 작업</span>
                            <select
                                className="sort-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="추천순">추천순</option>
                                <option value="가격 낮은순">가격 낮은순</option>
                                <option value="가격 높은순">가격 높은순</option>
                                <option value="빠른 납기순">빠른 납기순</option>
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
                                <h2>아직 등록된 AI 작업이 없습니다.</h2>
                                <p>조건을 조금 넓히거나 전문가가 새 상품을 등록한 뒤 다시 확인해보세요.</p>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </>
    )
}
