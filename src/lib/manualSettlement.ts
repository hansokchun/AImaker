import { supabase } from './supabase';

export interface CompleteManualSettlementInput {
    readonly workId: string;
    readonly transferReference: string;
}

export async function completeManualSettlement(input: CompleteManualSettlementInput): Promise<void> {
    const transferReference = input.transferReference.trim();
    if (!input.workId || !transferReference) {
        throw new Error('이체 확인번호를 입력해 주세요.');
    }
    if (!supabase) {
        throw new Error('정산 완료 기록을 위해 Supabase 연결이 필요합니다.');
    }

    const { error } = await supabase.functions.invoke('trade-workflow', {
        body: {
            type: 'complete_manual_settlement',
            settlement: {
                workId: input.workId,
                transferReference,
            },
        },
    });
    if (error) throw new Error(error.message || '수동 정산 완료를 기록하지 못했습니다.');
}
