$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$script:lastChangeAt = Get-Date -Date 0

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $PSScriptRoot
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::DirectoryName -bor [System.IO.NotifyFilters]::Size

Register-ObjectEvent -InputObject $watcher -EventName Changed -Action {
    if ($event.SourceEventArgs.FullPath -like '*\.git*') { return }
    $script:lastChangeAt = Get-Date
} | Out-Null

Register-ObjectEvent -InputObject $watcher -EventName Created -Action {
    if ($event.SourceEventArgs.FullPath -like '*\.git*') { return }
    $script:lastChangeAt = Get-Date
} | Out-Null

Register-ObjectEvent -InputObject $watcher -EventName Deleted -Action {
    if ($event.SourceEventArgs.FullPath -like '*\.git*') { return }
    $script:lastChangeAt = Get-Date
} | Out-Null

Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action {
    if ($event.SourceEventArgs.FullPath -like '*\.git*') { return }
    $script:lastChangeAt = Get-Date
} | Out-Null

$watcher.EnableRaisingEvents = $true

while ($true) {
    Start-Sleep -Seconds 5
    $idleSeconds = ((Get-Date) - $script:lastChangeAt).TotalSeconds
    if ($idleSeconds -lt 30) { continue }

    $pending = git status --porcelain
    if ($pending) {
        & "$PSScriptRoot\auto-save.ps1"
        $script:lastChangeAt = Get-Date
    }
}