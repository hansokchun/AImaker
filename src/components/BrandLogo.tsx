import './BrandLogo.css'

type BrandLogoProps = {
    tone?: 'default' | 'inverse'
}

export default function BrandLogo({ tone = 'default' }: BrandLogoProps) {
    return (
        <span className={`brand-logo brand-logo--${tone}`} aria-label="일픽">
            <span className="brand-logo-mark" aria-hidden="true">
                <img src="/ilpick-mark.svg" alt="" />
            </span>
            <span className="brand-logo-word" aria-hidden="true">ilpick</span>
        </span>
    )
}
