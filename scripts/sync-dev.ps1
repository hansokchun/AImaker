param(
    [string]$Message = "",
    [switch]$SkipTests,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Run-Step {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

function Has-Changes {
    $status = git status --porcelain
    return -not [string]::IsNullOrWhiteSpace($status)
}

Run-Step "Checking repository" {
    git rev-parse --is-inside-work-tree | Out-Null
}

$branch = (git branch --show-current).Trim()
if ($branch -ne "dev") {
    throw "Current branch is '$branch'. Switch to 'dev' before syncing."
}

Run-Step "Fetching origin/dev" {
    git fetch origin dev
}

if (-not (Has-Changes)) {
    Write-Host "No local changes to commit. Pulling latest origin/dev only." -ForegroundColor Yellow
    Run-Step "Pulling latest origin/dev" {
        git pull --rebase origin dev
    }
    Write-Host "Done. dev is up to date." -ForegroundColor Green
    exit 0
}

if (-not $SkipTests) {
    Run-Step "Running tests" {
        npm.cmd test
    }
}

if (-not $SkipBuild) {
    Run-Step "Running build" {
        npm.cmd run build
    }
}

Run-Step "Staging changes" {
    git add -A
}

$staged = git diff --cached --name-only
if ([string]::IsNullOrWhiteSpace($staged)) {
    Write-Host "No staged changes after git add." -ForegroundColor Yellow
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Message = "chore: sync dev changes $timestamp"
}

Run-Step "Committing changes" {
    git commit -m $Message
}

Run-Step "Rebasing on origin/dev" {
    git pull --rebase origin dev
}

Run-Step "Pushing to origin/dev" {
    git push origin dev
}

Write-Host ""
Write-Host "Synced dev successfully." -ForegroundColor Green
