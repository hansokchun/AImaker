import './BrandLogo.css'

type BrandLogoProps = {
    tone?: 'default' | 'inverse'
}

export default function BrandLogo({ tone = 'default' }: BrandLogoProps) {
    return (
        <span className={`brand-logo brand-logo--${tone}`} aria-label="기그온">
            <img
                className="brand-logo-image"
                src="/gigon-logo.png"
                alt=""
                aria-hidden="true"
                decoding="async"
            />
        </span>
    )
}
