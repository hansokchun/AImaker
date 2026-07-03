import type { AdminFilterState, AdminStatusFilter } from '../lib/adminFilters';

interface AdminFiltersProps {
    readonly value: AdminFilterState;
    readonly onChange: (value: AdminFilterState) => void;
}

const STATUS_OPTIONS: readonly { readonly value: AdminStatusFilter; readonly label: string }[] = [
    { value: 'all', label: '전체 상태' },
    { value: 'published', label: '공개/전문가' },
    { value: 'pending', label: '대기' },
    { value: 'accepted', label: '승인됨' },
    { value: 'paid', label: '결제 완료' },
    { value: 'open', label: '상담 중' },
    { value: 'in_progress', label: '작업 중' },
    { value: 'completed', label: '완료' },
    { value: 'cancelled', label: '중단/취소' },
    { value: 'hidden', label: '숨김' },
];

export default function AdminFilters({ value, onChange }: AdminFiltersProps) {
    return (
        <section className="admin-filter-bar" aria-label="관리자 검색과 필터">
            <label className="admin-filter-field">
                <span>관리자 검색</span>
                <input
                    type="search"
                    value={value.query}
                    placeholder="이름, 이메일, 상품명, 거래 ID, 메시지 검색"
                    onChange={(event) => onChange({ ...value, query: event.target.value })}
                />
            </label>
            <label className="admin-filter-field admin-filter-status">
                <span>상태 필터</span>
                <select
                    value={value.status}
                    onChange={(event) => onChange({ ...value, status: event.target.value as AdminStatusFilter })}
                >
                    {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </label>
        </section>
    );
}
