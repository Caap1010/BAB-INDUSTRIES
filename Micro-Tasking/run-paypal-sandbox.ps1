$env:MICRO_TASKING_PAYPAL_ENVIRONMENT = "sandbox"

if (-not $env:MICRO_TASKING_PAYPAL_CLIENT_ID) {
    Write-Host "Set MICRO_TASKING_PAYPAL_CLIENT_ID before running this script." -ForegroundColor Yellow
}

if (-not $env:MICRO_TASKING_PAYPAL_CLIENT_SECRET) {
    Write-Host "Set MICRO_TASKING_PAYPAL_CLIENT_SECRET before running this script." -ForegroundColor Yellow
}

& "C:/Users/TshotwSF/AppData/Local/anaconda3/Scripts/conda.exe" run -p "C:\Users\TshotwSF\AppData\Local\anaconda3" --no-capture-output python "c:\Users\TshotwSF\Desktop\BAB-INDUSTRIES\Micro-Tasking\app\app.py"