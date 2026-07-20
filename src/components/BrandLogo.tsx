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
                    <span className="brand-logo-check" />
                </span>
            </span>
        </span>
    )
}
