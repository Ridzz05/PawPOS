$ErrorActionPreference = 'Stop'

Write-Host 'Memulai server pengembangan PawPOS (API dan Web)...' -ForegroundColor Cyan

if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        Write-Host 'Menjalankan container PostgreSQL...' -ForegroundColor Gray
        docker compose up -d postgres
    } catch {
        Write-Host 'Peringatan: Gagal menjalankan PostgreSQL via Docker. Backend akan otomatis beralih ke in-memory mode.' -ForegroundColor Yellow
    }
} else {
    Write-Host 'Info: Docker tidak ditemukan di PATH. Backend akan berjalan secara otomatis dengan fallback in-memory database.' -ForegroundColor Yellow
}

Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'go run ./cmd/server' -WorkingDirectory "$PSScriptRoot\..\apps\api"
Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'npm run dev' -WorkingDirectory "$PSScriptRoot\..\apps\web"

Write-Host 'API: http://localhost:8080' -ForegroundColor Green
Write-Host 'Web: http://localhost:5173' -ForegroundColor Green

