# Probabilistic Crime Scene Reconstruction — Start Both Backend & Frontend (Windows PowerShell)
$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

# Resolve Python executable (prefers Anaconda / system Python with pgmpy 1.1.2)
$PythonExe = "python"
if (Test-Path "C:\Users\chidv\anaconda3\python.exe") {
    $PythonExe = "C:\Users\chidv\anaconda3\python.exe"
}

# Resolve Node.js directory if installed via WinGet
$WinGetNode = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty DirectoryName
if ($WinGetNode) {
    $env:PATH = "$WinGetNode;$env:PATH"
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Starting Probabilistic Crime Scene Reconstruction (BN + HMM)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "1. Launching FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Green

$BackendJob = Start-Process -FilePath $PythonExe -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory $BackendDir -PassThru

Write-Host "2. Launching Vite React Frontend on http://localhost:5173 ..." -ForegroundColor Green
try {
    Set-Location $FrontendDir
    npm run dev
} finally {
    if ($BackendJob -and !$BackendJob.HasExited) {
        Write-Host "Stopping FastAPI Backend (PID $($BackendJob.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $BackendJob.Id -Force -ErrorAction SilentlyContinue
    }
}
