import './LegalPage.css'

type LegalPageProps = {
    readonly variant: 'terms' | 'privacy'
}

const termsSections = [
    {
        title: '사업자 및 고객센터',
        body: '상호는 원코리아이며 대표자는 태영호, 사업자등록번호는 107-39-44459입니다. 사업장 주소는 서울특별시 영등포구 영중로 61, 7층 2호(영등포동6가, 극동빌딩)입니다. 고객센터는 gigon.help@gmail.com, 010-9818-9827이며 평일 10:00~17:00에 운영합니다(주말·공휴일 제외). 통신판매업 신고번호는 신고 전이며 신고 완료 후 고지합니다.',
    },
    {
        title: '서비스 이용',
        body: '기그온은 의뢰자와 전문가가 AI 작업을 의뢰, 제안, 결제, 작업 진행, 결과물 승인까지 관리하는 중개형 마켓플레이스입니다. 사용자는 정확한 계정 정보와 거래 정보를 제공해야 하며, 외부 연락처 유도나 플랫폼 밖 결제 요청은 제한됩니다.',
    },
    {
        title: '결제와 작업 진행',
        body: '의뢰자가 제안서를 승인하고 토스페이먼츠 결제를 완료하면 작업방이 생성됩니다. 결제 금액은 작업 완료 전까지 정산 대기 상태로 관리되며, 결과물 승인 또는 자동 구매확정 이후 전문가 정산 가능 상태로 전환됩니다.',
    },
    {
        title: '취소, 환불, 분쟁',
        body: '합의한 작업 범위, 납기, 결과물 형식과 다른 경우에는 수정 요청 또는 분쟁을 신청할 수 있습니다. 단순 취향 차이는 상품에 포함된 수정 횟수 안에서 우선 조정합니다. 분쟁이 접수되면 정산과 자동 구매확정이 보류되며, 의뢰서·제안서·작업방 기록·납품물을 기준으로 재수정, 부분 환불, 전액 환불 또는 정산 여부를 결정합니다. 실제 환불은 결제 승인 내역과 Toss 결제 취소 처리 결과를 함께 확인합니다.',
    },
    {
        title: '자동 구매확정',
        body: '전문가가 결과물을 제출한 뒤 7일 동안 의뢰자 응답이 없으면 8일째 자동 구매확정될 수 있습니다. 자동 확정 이후에는 정산 가능 상태가 되며, 분쟁 또는 취소 요청이 진행 중인 거래는 자동 확정 대상에서 제외됩니다.',
    },
]

const privacySections = [
    {
        title: '수집하는 정보',
        body: '계정 이메일, 프로필 정보, 상품과 제안서 내용, 결제 주문 정보, 작업방 메시지, 정산 계좌 정보, 알림 수신 전화번호를 서비스 제공에 필요한 범위에서 처리합니다.',
    },
    {
        title: '결제와 정산 정보',
        body: '카드번호 등 결제수단의 민감 정보는 Toss Payments가 처리하며 기그온은 결제 승인 키, 주문번호, 금액, 거래 상태를 저장합니다. 전문가 정산 계좌 정보는 정산 확인과 송금 처리 목적으로 사용됩니다.',
    },
    {
        title: '알림 발송',
        body: '사용자가 동의한 경우 카카오 알림톡 또는 SMS 발송을 위해 전화번호, 알림 제목, 알림 본문, 관련 거래 식별자가 발송 대행 시스템으로 전달될 수 있습니다.',
    },
    {
        title: '보관과 탈퇴',
        body: '회원 탈퇴 요청 시 공개 상품은 숨김 처리되고 프로필은 거래 기록 식별에 필요한 최소 정보만 남긴 제한 상태로 전환됩니다. 결제·정산과 공급 기록은 5년, 상담·작업방·분쟁처리 기록은 관련 법령과 분쟁 대응에 필요한 기간 동안 제한적으로 보관합니다.',
    },
    {
        title: '개인정보 보호책임자',
        body: '개인정보 보호책임자는 서비스 운영 담당자 한석준이며, 개인정보 관련 문의는 gigon.help@gmail.com 또는 010-9818-9827로 접수할 수 있습니다. 고객센터 운영시간은 평일 10:00~17:00이며 주말과 공휴일은 제외합니다.',
    },
]

export default function LegalPage({ variant }: LegalPageProps) {
    const isPrivacy = variant === 'privacy'
    const title = isPrivacy ? '개인정보 처리방침' : '이용약관'
    const description = isPrivacy
        ? '기그온이 서비스 제공을 위해 처리하는 개인정보와 보관 기준입니다.'
        : '기그온의 의뢰, 결제, 작업 진행, 정산 기준입니다.'
    const sections = isPrivacy ? privacySections : termsSections

    return (
        <main className="legal-page" aria-labelledby="legal-page-title">
            <section className="legal-hero">
                <div className="container legal-hero-inner">
                    <p className="legal-eyebrow">기그온 정책</p>
                    <h1 id="legal-page-title">{title}</h1>
                    <p>{description}</p>
                    <span>시행일: 2026년 7월 12일</span>
                </div>
            </section>

            <section className="container legal-content" aria-label={`${title} 본문`}>
                <p className="legal-notice">
                    본 문서는 서비스 운영 기준을 사용자에게 안내하기 위한 초안입니다. 정식 오픈 전 사업자 정보, 고객센터, 법무 검토 결과를 반영해 최종 고지해야 합니다.
                </p>
                {sections.map((section) => (
                    <article className="legal-section" key={section.title}>
                        <h2>{section.title}</h2>
                        <p>{section.body}</p>
                    </article>
                ))}
            </section>
        </main>
    )
}
