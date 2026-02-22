# Optimized Development Server Startup Script
# This script starts the Next.js dev server with memory optimizations

Write-Host "=== Starting Braik Development Server (Optimized) ===" -ForegroundColor Cyan
Write-Host ""

# Set Node.js memory options
$env:NODE_OPTIONS = "--max-old-space-size=4096 --expose-gc"

Write-Host "Memory settings:" -ForegroundColor Yellow
Write-Host "  Max heap size: 4GB" -ForegroundColor White
Write-Host "  Garbage collection: Enabled" -ForegroundColor White
Write-Host ""

Write-Host "Starting Next.js development server..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# Start the dev server
npm run dev
