import { describe, expect, it } from 'vitest';
import { filterAdminSnapshot } from './adminFilters';
import { adminSnapshot } from '../pages/adminTestFixtures';

describe('adminFilters', () => {
    it('filters products and related records by a search query', () => {
        const result = filterAdminSnapshot(adminSnapshot, { query: 'AI 영상', status: 'all' });

        expect(result.products).toHaveLength(1);
        expect(result.products[0]?.title).toBe('AI 영상 제작');
        expect(result.serviceRequests).toHaveLength(0);
        expect(result.consultations).toHaveLength(0);
    });

    it('keeps a consultation when the search query matches a message body', () => {
        const result = filterAdminSnapshot(adminSnapshot, { query: 'price estimate', status: 'all' });

        expect(result.consultations).toHaveLength(1);
        expect(result.consultationMessages).toHaveLength(1);
        expect(result.products).toHaveLength(0);
    });

    it('filters records by status without changing the original snapshot', () => {
        const result = filterAdminSnapshot(adminSnapshot, { query: '', status: 'in_progress' });

        expect(result.works).toHaveLength(1);
        expect(result.products).toHaveLength(0);
        expect(adminSnapshot.products).toHaveLength(2);
    });
});
