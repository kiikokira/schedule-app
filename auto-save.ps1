$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$changed = git status --porcelain

if (-not $changed) {
    exit 0
}

git add -A
git commit -m "auto-save $stamp"