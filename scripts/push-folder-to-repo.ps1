param(
    [Parameter(Mandatory = $true)]
    [string]$Folder,

    [Parameter(Mandatory = $true)]
    [string]$RepoUrl,

    [string]$Branch = "main",

    [switch]$ForcePush
)

$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
    throw "Run this script inside a git repository."
}

Set-Location $repoRoot

if (-not (Test-Path $Folder)) {
    throw "Folder not found: $Folder"
}

$folderPath = (Resolve-Path $Folder).Path
if (-not $folderPath.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Folder must be inside repo root."
}

$prefix = $Folder.Replace("\\", "/").Trim("/")
$tmpBranch = "split_" + ($prefix -replace "[^a-zA-Z0-9_-]", "_") + "_" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "Creating subtree split for: $prefix"
$splitSha = (git subtree split --prefix="$prefix" -b $tmpBranch).Trim()

if (-not $splitSha) {
    git branch -D $tmpBranch | Out-Null
    throw "Failed to create split commit for $prefix"
}

Write-Host "Split commit: $splitSha"
Write-Host "Pushing to $RepoUrl ($Branch)"

$pushArgs = @("push", $RepoUrl, "$splitSha:refs/heads/$Branch")
if ($ForcePush) {
    $pushArgs += "--force"
}

git @pushArgs

# cleanup local temp split branch
if (git show-ref --verify --quiet "refs/heads/$tmpBranch") {
    git branch -D $tmpBranch | Out-Null
}

Write-Host "Done: $prefix -> $RepoUrl ($Branch)"
