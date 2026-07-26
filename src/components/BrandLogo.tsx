import './BrandLogo.css'

type BrandLogoProps = {
    tone?: 'default' | 'inverse'
}

export default function BrandLogo({ tone = 'default' }: BrandLogoProps) {
    return (
        <span className={`brand-logo brand-logo--${tone}`} aria-label="기그온">
            <span className="brand-logo-word" aria-hidden="true">
                <span className="brand-logo-primary">Gig</span>
                <span className="brand-logo-link-mark">
                    <span className="brand-logo-link-left" />
                    <span className="brand-logo-link-right" />
                </span>
                <span className="brand-logo-accent">n</span>
            </span>
        </span>
    )
}
