import './PageLoading.css'

type PageLoadingProps = {
    readonly title: string | readonly string[]
    readonly description?: string | readonly string[]
    readonly className?: string
}

function renderLines(value: string | readonly string[]) {
    if (typeof value === 'string') return value

    return value.map((line) => (
        <span className="page-loading-text-line" key={line}>
            {line}
        </span>
    ))
}

export function PageLoading({ title, description, className = '' }: PageLoadingProps) {
    return (
        <div className={`page-loading ${className}`.trim()} role="status" aria-live="polite">
            <div className="page-loading-card">
                <div className="page-loading-mark" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <h1>{renderLines(title)}</h1>
                {description && <p>{renderLines(description)}</p>}
                <div className="page-loading-lines" aria-hidden="true">
                    <span />
                    <span />
                </div>
            </div>
        </div>
    )
}
