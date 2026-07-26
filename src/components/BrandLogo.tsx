import './BrandLogo.css'

type BrandLogoProps = {
    tone?: 'default' | 'inverse'
}

export default function BrandLogo({ tone = 'default' }: BrandLogoProps) {
    return (
        <span className={`brand-logo brand-logo--${tone}`} aria-label="일픽">
            <span className="brand-logo-word" aria-hidden="true">
                <span className="brand-logo-primary">ilpi</span>
                <span className="brand-logo-link-letter">c</span>
                <span className="brand-logo-accent">k</span>
            </span>
        </span>
    )
}
