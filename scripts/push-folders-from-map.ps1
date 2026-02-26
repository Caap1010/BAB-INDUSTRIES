param(
    [Parameter(Mandatory = $true)]
    [string]$MapFile,

    [switch]$ForcePush
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $MapFile)) {
    throw "Map file not found: $MapFile"
}

$rows = Import-Csv -Path $MapFile
if (-not $rows -or $rows.Count -eq 0) {
    throw "Map file has no rows."
}

$scriptPath = Join-Path $PSScriptRoot "push-folder-to-repo.ps1"
if (-not (Test-Path $scriptPath)) {
    throw "Missing script: $scriptPath"
}

foreach ($row in $rows) {
    if (-not $row.Folder -or -not $row.RepoUrl) {
        Write-Warning "Skipping row with missing Folder/RepoUrl"
        continue
    }

    $branch = if ($row.Branch) { $row.Branch } else { "main" }
    Write-Host "---"
    Write-Host "Pushing folder: $($row.Folder)"

    if ($ForcePush) {
        & $scriptPath -Folder $row.Folder -RepoUrl $row.RepoUrl -Branch $branch -ForcePush
    }
    else {
        & $scriptPath -Folder $row.Folder -RepoUrl $row.RepoUrl -Branch $branch
    }
}

Write-Host "All done."
