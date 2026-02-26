param(
    [Parameter(Mandatory = $true)]
    [string]$PublicUrl,

    [string]$OutputZip = ".\\dist\\BAB-Language-Hub-msix.zip"
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$templatePath = Join-Path $root 'pwabuilder-msix-request.json'
$requestPath = Join-Path $root 'pwabuilder-msix-request.runtime.json'

if (-not (Test-Path $templatePath)) {
    throw "Missing template file: $templatePath"
}

$template = Get-Content $templatePath -Raw | ConvertFrom-Json
$template.url = $PublicUrl

$uri = [System.Uri]$PublicUrl
$hostName = $uri.Host -replace '[^a-zA-Z0-9]', ''
if ([string]::IsNullOrWhiteSpace($hostName)) {
    $hostName = 'BABLanguageHub'
}

$template.packageId = "BABIndustries.$hostName"
$template.applicationId = $template.packageId

$template | ConvertTo-Json -Depth 10 | Out-File -FilePath $requestPath -Encoding utf8

$outputFullPath = Join-Path $root $OutputZip
$outputDir = Split-Path -Parent $outputFullPath
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$body = Get-Content $requestPath -Raw
$endpoint = 'https://pwabuilder-winserver.centralus.cloudapp.azure.com/msix/generatezip'

Write-Host "Generating MSIX package from: $PublicUrl"
Write-Host "Endpoint: $endpoint"

$response = Invoke-WebRequest -Uri $endpoint -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 600

[System.IO.File]::WriteAllBytes($outputFullPath, $response.Content)
Write-Host "Package saved to: $outputFullPath"
Write-Host "Done."
