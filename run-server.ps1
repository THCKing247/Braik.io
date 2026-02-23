# Complete Setup and Run Script
# Run this AFTER installing Node.js

Write-Host "=== Braik Server Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check for Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js first:" -ForegroundColor Yellow
    Write-Host "1. Go to https://nodejs.org/" -ForegroundColor White
    Write-Host "2. Download and install the LTS version" -ForegroundColor White
    Write-Host "3. Restart your terminal" -ForegroundColor White
    Write-Host "4. Run this script again" -ForegroundColor White
    exit 1
}

# Check for npm
try {
    $npmVersion = npm --version
    Write-Host "✓ npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create .env if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
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
    Write-Host "  Note: Update DATABASE_URL if your PostgreSQL password is different" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file exists" -ForegroundColor Green
}

# Install dependencies
if (-not (Test-Path node_modules)) {
    Write-Host ""
    Write-Host "Installing dependencies (this may take a few minutes)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
}

# Generate Prisma client
Write-Host ""
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npm run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Prisma client generated" -ForegroundColor Green

# Check database connection
Write-Host ""
Write-Host "Setting up database..." -ForegroundColor Yellow
Write-Host "  Make sure PostgreSQL is running!" -ForegroundColor Yellow

# Push schema
Write-Host "  Creating database tables..." -ForegroundColor Yellow
npm run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠ Database setup failed. Make sure:" -ForegroundColor Yellow
    Write-Host "  1. PostgreSQL is installed and running" -ForegroundColor White
    Write-Host "  2. DATABASE_URL in .env is correct" -ForegroundColor White
    Write-Host "  3. Database 'braik' exists (or will be created)" -ForegroundColor White
    Write-Host ""
    Write-Host "You can start PostgreSQL with Docker:" -ForegroundColor Cyan
    Write-Host "  docker run --name braik-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=braik -p 5432:5432 -d postgres:15" -ForegroundColor White
    exit 1
}
Write-Host "✓ Database tables created" -ForegroundColor Green

# Seed database
Write-Host "  Adding sample data..." -ForegroundColor Yellow
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Seeding failed, but continuing..." -ForegroundColor Yellow
} else {
    Write-Host "✓ Sample data added" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Starting Server ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "The server will start at: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Test accounts:" -ForegroundColor Yellow
Write-Host "  Head Coach: coach@example.com / password123" -ForegroundColor White
Write-Host "  Assistant: assistant@example.com / password123" -ForegroundColor White
Write-Host "  Player: player1@example.com / password123" -ForegroundColor White
Write-Host "  Parent: parent1@example.com / password123" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start dev server
npm run dev
