import './BrandLogo.css'

type BrandLogoProps = {
    tone?: 'default' | 'inverse'
}

export default function BrandLogo({ tone = 'default' }: BrandLogoProps) {
    return (
        <span className={`brand-logo brand-logo--${tone}`} aria-label="일픽">
            <img className="brand-logo-image" src="/ilpick-logo.png" alt="" />
        </span>
    )
}
