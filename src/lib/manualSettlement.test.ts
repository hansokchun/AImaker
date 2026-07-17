import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();

vi.mock('./supabase', () => ({
    supabase: {
        functions: { invoke },
    },
}));

describe('completeManualSettlement', () => {
    beforeEach(() => {
        invoke.mockReset();
        invoke.mockResolvedValue({ data: {}, error: null });
    });

    it('sends only the work id and trimmed transfer reference to the server boundary', async () => {
        const { completeManualSettlement } = await import('./manualSettlement');

        await completeManualSettlement({ workId: 'work-01', transferReference: ' bank-transfer-01 ' });

        expect(invoke).toHaveBeenCalledWith('trade-workflow', {
            body: {
                type: 'complete_manual_settlement',
                settlement: {
                    workId: 'work-01',
                    transferReference: 'bank-transfer-01',
                },
            },
        });
    });

    it('rejects a blank transfer reference before calling the server boundary', async () => {
        const { completeManualSettlement } = await import('./manualSettlement');

        await expect(completeManualSettlement({ workId: 'work-01', transferReference: '   ' }))
            .rejects.toThrow('이체 확인번호를 입력해 주세요.');

        expect(invoke).not.toHaveBeenCalled();
    });
});
