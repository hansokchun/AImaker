import { describe, expect, it } from 'vitest';
import { DEMO_TEST_ACCOUNT_EMAILS, isDemoTestAccountEmail } from './demoAccountData';

describe('demo account email allowlist', () => {
    it('enables the configured test accounts', () => {
        expect(DEMO_TEST_ACCOUNT_EMAILS).toContain('benet9818@gmail.com');
        expect(DEMO_TEST_ACCOUNT_EMAILS).toContain('benet9827@gmail.com');
        expect(isDemoTestAccountEmail('benet9818@gmail.com')).toBe(true);
        expect(isDemoTestAccountEmail('benet9827@gmail.com')).toBe(true);
        expect(isDemoTestAccountEmail('BENET9818@GMAIL.COM')).toBe(true);
    });

    it('keeps unrelated accounts out of the demo fixture path', () => {
        expect(isDemoTestAccountEmail('someone@example.com')).toBe(false);
        expect(isDemoTestAccountEmail('benet9818+client@gmail.com')).toBe(false);
        expect(isDemoTestAccountEmail(undefined)).toBe(false);
    });
});
