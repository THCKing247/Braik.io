# Quick Start Script for Braik Development
# This script starts PostgreSQL (via Docker) and the Next.js dev server

Write-Host "=== Starting Braik Development Environment ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is available
$dockerAvailable = $false
try {
    docker --version | Out-Null
    $dockerAvailable = $true
    Write-Host "✓ Docker found" -ForegroundColor Green
} catch {
    Write-Host "⚠ Docker not found. Make sure PostgreSQL is running manually." -ForegroundColor Yellow
}

# Start PostgreSQL with Docker if available
if ($dockerAvailable) {
    Write-Host ""
    Write-Host "Starting PostgreSQL container..." -ForegroundColor Yellow
    
    # Check if container already exists
    $containerExists = docker ps -a --filter "name=braik-postgres-dev" --format "{{.Names}}"
    
    if ($containerExists -eq "braik-postgres-dev") {
        Write-Host "Container exists, starting it..." -ForegroundColor Yellow
        docker start braik-postgres-dev | Out-Null
    } else {
        Write-Host "Creating new PostgreSQL container..." -ForegroundColor Yellow
        docker-compose -f docker-compose.dev.yml up -d
    }
    
    Write-Host "✓ PostgreSQL should be running on port 5432" -ForegroundColor Green
    Write-Host ""
}

# Check for .env file
if (-not (Test-Path .env)) {
    Write-Host "⚠ .env file not found!" -ForegroundColor Red
    Write-Host "Creating .env file with defaults..." -ForegroundColor Yellow
    
    $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $base64Secret = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($secret))
    
    $envContent = @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/braik?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$base64Secret"
UPLOAD_DIR="./uploads"
"@
    
    $envContent | Out-File -FilePath .env -Encoding utf8
    Write-Host "✓ .env file created" -ForegroundColor Green
}

# Check if node_modules exists
if (-not (Test-Path node_modules)) {
    Write-Host ""
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Check if Prisma client is generated
if (-not (Test-Path node_modules/.prisma)) {
    Write-Host ""
    Write-Host "Generating Prisma client..." -ForegroundColor Yellow
    npm run db:generate
}

Write-Host ""
Write-Host "=== Ready to start! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run db:push    (creates database tables)" -ForegroundColor White
Write-Host "2. Run: npm run db:seed    (adds sample data)" -ForegroundColor White
Write-Host "3. Run: npm run dev        (starts the server)" -ForegroundColor White
Write-Host ""
Write-Host "Or run all at once:" -ForegroundColor Yellow
Write-Host "  npm run db:push && npm run db:seed && npm run dev" -ForegroundColor Cyan
Write-Host ""
