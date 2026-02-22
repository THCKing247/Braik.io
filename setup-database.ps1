# Quick PostgreSQL Setup Script

Write-Host "=== PostgreSQL Setup for Braik ===" -ForegroundColor Cyan
Write-Host ""

# Check for Docker
$dockerAvailable = $false
try {
    $null = docker --version 2>&1
    $dockerAvailable = $true
    Write-Host "✓ Docker found" -ForegroundColor Green
} catch {
    Write-Host "⚠ Docker not found" -ForegroundColor Yellow
}

if ($dockerAvailable) {
    Write-Host ""
    Write-Host "Setting up PostgreSQL with Docker..." -ForegroundColor Yellow
    
    # Check if container already exists
    $existing = docker ps -a --filter "name=braik-postgres" --format "{{.Names}}" 2>$null
    
    if ($existing -eq "braik-postgres") {
        Write-Host "Container exists. Starting it..." -ForegroundColor Yellow
        docker start braik-postgres
    } else {
        Write-Host "Creating new PostgreSQL container..." -ForegroundColor Yellow
        docker run --name braik-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=braik -p 5432:5432 -d postgres:15
    }
    
    Write-Host ""
    Write-Host "Waiting for PostgreSQL to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    Write-Host "✓ PostgreSQL should be running on port 5432" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run: npm run db:push    (creates database tables)" -ForegroundColor White
    Write-Host "2. Run: npm run db:seed    (adds sample data)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Docker is not available. You need to install PostgreSQL manually:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Install Docker Desktop" -ForegroundColor Cyan
    Write-Host "  Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host "  Then run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Install PostgreSQL directly" -ForegroundColor Cyan
    Write-Host "  1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "  2. Install with default settings" -ForegroundColor White
    Write-Host "  3. Remember your password" -ForegroundColor White
    Write-Host "  4. Update DATABASE_URL in .env file" -ForegroundColor White
    Write-Host "  5. Run: npm run db:push" -ForegroundColor White
    Write-Host "  6. Run: npm run db:seed" -ForegroundColor White
    Write-Host ""
}
