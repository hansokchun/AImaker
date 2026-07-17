import { describe, expect, it } from 'vitest';
import { isAdminEmail } from './adminStorage';

describe('admin access allowlist', () => {
    it('allows the configured owner account', () => {
        expect(isAdminEmail('benet9827@gmail.com')).toBe(true);
    });

    it('denies the expert account that is not an administrator', () => {
        expect(isAdminEmail('benet9818@gmail.com')).toBe(false);
    });
});
