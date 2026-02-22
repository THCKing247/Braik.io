# Memory Check Script for Braik Development
# Run this to monitor Node.js memory usage

Write-Host "=== Braik Memory Monitor ===" -ForegroundColor Cyan
Write-Host ""

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Node.js Processes Found:" -ForegroundColor Green
    Write-Host ""
    
    $nodeProcesses | ForEach-Object {
        $memoryMB = [math]::Round($_.WS / 1MB, 2)
        $memoryGB = [math]::Round($_.WS / 1GB, 2)
        
        Write-Host "PID: $($_.Id)" -ForegroundColor Yellow
        Write-Host "  Memory: $memoryMB MB ($memoryGB GB)" -ForegroundColor White
        
        if ($memoryMB -gt 2048) {
            Write-Host "  Status: HIGH MEMORY USAGE" -ForegroundColor Red
        } elseif ($memoryMB -gt 1024) {
            Write-Host "  Status: Moderate" -ForegroundColor Yellow
        } else {
            Write-Host "  Status: Normal" -ForegroundColor Green
        }
        Write-Host ""
    }
    
    $totalMemory = ($nodeProcesses | Measure-Object -Property WS -Sum).Sum
    $totalMemoryMB = [math]::Round($totalMemory / 1MB, 2)
    $totalMemoryGB = [math]::Round($totalMemory / 1GB, 2)
    
    Write-Host "Total Memory Usage: $totalMemoryMB MB ($totalMemoryGB GB)" -ForegroundColor Cyan
    Write-Host ""
    
    if ($totalMemoryMB -gt 3072) {
        Write-Host "WARNING: Total memory usage is high. Consider restarting the dev server." -ForegroundColor Red
    }
} else {
    Write-Host "No Node.js processes found." -ForegroundColor Yellow
    Write-Host "The development server may not be running." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "To restart with optimized memory:" -ForegroundColor Cyan
Write-Host '  $env:NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"; npm run dev' -ForegroundColor White
