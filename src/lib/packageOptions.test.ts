import { describe, expect, it } from 'vitest'
import { attachOptionValuesToPackage, getPackageOptionRows, parsePackageOptionFeature } from './packageOptions'
import type { ExpertProduct } from '../types'

describe('packageOptions', () => {
    it('groups package features that only differ by numeric quantity', () => {
        const packages: ExpertProduct['packages'] = {
            standard: {
                name: 'Standard',
                price: 45000,
                deliveryDays: 3,
                revisionCount: 1,
                included: ['광고 콘셉트 1안', '15초 대본 1개', '대표 장면 이미지 시안 1개'],
            },
            deluxe: {
                name: 'Deluxe',
                price: 90000,
                deliveryDays: 5,
                revisionCount: 2,
                included: ['광고 콘셉트 2안', '15초 대본 2개', '장면 구성표', '짧은 영상 샘플 1개'],
            },
            premium: {
                name: 'Premium',
                price: 150000,
                deliveryDays: 7,
                revisionCount: 3,
                included: ['광고 콘셉트 3안', '영상 샘플 2개', '썸네일 시안', '업로드용 문구 제안'],
            },
        }

        expect(getPackageOptionRows(packages)).toEqual([
            {
                label: '광고 콘셉트',
                values: { standard: '1안', deluxe: '2안', premium: '3안' },
                available: { standard: true, deluxe: true, premium: true },
            },
            {
                label: '15초 대본',
                values: { standard: '1개', deluxe: '2개', premium: '미포함' },
                available: { standard: true, deluxe: true, premium: false },
            },
            {
                label: '대표 장면 이미지 시안',
                values: { standard: '1개', deluxe: '미포함', premium: '미포함' },
                available: { standard: true, deluxe: false, premium: false },
            },
            {
                label: '장면 구성표',
                values: { standard: '미포함', deluxe: '포함', premium: '미포함' },
                available: { standard: false, deluxe: true, premium: false },
            },
            {
                label: '짧은 영상 샘플',
                values: { standard: '미포함', deluxe: '1개', premium: '미포함' },
                available: { standard: false, deluxe: true, premium: false },
            },
            {
                label: '영상 샘플',
                values: { standard: '미포함', deluxe: '미포함', premium: '2개' },
                available: { standard: false, deluxe: false, premium: true },
            },
            {
                label: '썸네일 시안',
                values: { standard: '미포함', deluxe: '미포함', premium: '포함' },
                available: { standard: false, deluxe: false, premium: true },
            },
            {
                label: '업로드용 문구 제안',
                values: { standard: '미포함', deluxe: '미포함', premium: '포함' },
                available: { standard: false, deluxe: false, premium: true },
            },
        ])
    })

    it('keeps explicit option values so registration can store comparison-style package data', () => {
        expect(parsePackageOptionFeature('광고 콘셉트: 2안')).toEqual({
            label: '광고 콘셉트',
            value: '2안',
        })

        expect(attachOptionValuesToPackage({
            name: 'Deluxe',
            price: 90000,
            deliveryDays: 5,
            revisionCount: 2,
            included: ['광고 콘셉트: 2안', '장면 구성표'],
        })).toEqual({
            name: 'Deluxe',
            price: 90000,
            deliveryDays: 5,
            revisionCount: 2,
            included: ['광고 콘셉트: 2안', '장면 구성표'],
            optionValues: {
                '광고 콘셉트': '2안',
                '장면 구성표': '포함',
            },
        })
    })
})
