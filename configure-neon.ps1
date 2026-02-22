# Configure Neon Database Connection
# Run this script after you have your Neon connection string

Write-Host "=== Neon Database Configuration ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path .env)) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    New-Item -Path .env -ItemType File | Out-Null
}

# Read current .env content
$envContent = Get-Content .env -ErrorAction SilentlyContinue

# Prompt for Neon connection string
Write-Host "Please paste your Neon connection string below:" -ForegroundColor Green
Write-Host "(It should look like: postgresql://user:password@host.neon.tech/dbname?sslmode=require)" -ForegroundColor Gray
Write-Host ""
$neonUrl = Read-Host "Neon Connection String"

if ([string]::IsNullOrWhiteSpace($neonUrl)) {
    Write-Host "Error: Connection string cannot be empty!" -ForegroundColor Red
    exit 1
}

# Remove quotes if present
$neonUrl = $neonUrl.Trim('"', "'")

# Build new .env content
$newEnvContent = @()
$databaseUrlSet = $false

foreach ($line in $envContent) {
    if ($line -match '^DATABASE_URL=') {
        $newEnvContent += "DATABASE_URL=`"$neonUrl`""
        $databaseUrlSet = $true
    } else {
        $newEnvContent += $line
    }
}

# If DATABASE_URL wasn't found, add it
if (-not $databaseUrlSet) {
    $newEnvContent += "DATABASE_URL=`"$neonUrl`""
}

# Ensure other required variables exist
$requiredVars = @{
    "NEXTAUTH_URL" = "http://localhost:3000"
    "NEXTAUTH_SECRET" = "dWZtMmQ2bHJqSjlSMUl6WkRLTE1BY3NvMFNuV2tCVjM="
    "UPLOAD_DIR" = "./uploads"
}

foreach ($var in $requiredVars.GetEnumerator()) {
    $found = $false
    foreach ($line in $newEnvContent) {
        if ($line -match "^$($var.Key)=") {
            $found = $true
            break
        }
    }
    if (-not $found) {
        $newEnvContent += "$($var.Key)=`"$($var.Value)`""
    }
}

# Write updated .env file
$newEnvContent | Set-Content .env

Write-Host ""
Write-Host "✓ .env file updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart your PowerShell terminal to ensure Node.js/npm are recognized" -ForegroundColor Yellow
Write-Host "2. Run: npm run db:push" -ForegroundColor Yellow
Write-Host "3. Run: npm run db:seed" -ForegroundColor Yellow
Write-Host "4. Run: npm run dev" -ForegroundColor Yellow
Write-Host ""
