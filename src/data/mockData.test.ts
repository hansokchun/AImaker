import { describe, expect, it } from 'vitest'
import { AI_CATEGORIES } from '../constants/categories'
import { mockExpertProducts } from './mockData'

describe('mockExpertProducts', () => {
  it('covers all initial AI categories', () => {
    const categoryIds = new Set(mockExpertProducts.map((product) => product.category))

    expect(categoryIds).toEqual(new Set(AI_CATEGORIES.map((category) => category.id)))
  })

  it('gives every product a required standard package', () => {
    expect(mockExpertProducts.length).toBeGreaterThan(0)

    for (const product of mockExpertProducts) {
      expect(product.packages.standard).toBeTruthy()
      expect(product.packages.standard.price).toBeGreaterThan(0)
      expect(product.packages.standard.included.length).toBeGreaterThan(0)
    }
  })
})
