import './BrandLogo.css'

type BrandLogoProps = {
    tone?: 'default' | 'inverse'
}

export default function BrandLogo({ tone = 'default' }: BrandLogoProps) {
    return (
        <span className={`brand-logo brand-logo--${tone}`} aria-label="일픽">
            <span className="brand-logo-word" aria-hidden="true">
                ilpic
                <span className="brand-logo-k">
                    k
                    <img className="brand-logo-check" src="/ilpick-check.svg" alt="" />
                </span>
            </span>
        </span>
    )
}
