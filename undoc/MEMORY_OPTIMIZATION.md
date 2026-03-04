# Memory Optimization Guide

This document outlines the memory optimizations applied to prevent crashes and improve performance.

## Applied Optimizations

### 1. Node.js Memory Limits
- **Increased heap size**: Set to 4GB (`--max-old-space-size=4096`)
- **Garbage collection**: Enabled `--expose-gc` for manual GC control
- **Environment variable**: `NODE_OPTIONS` set in dev script

### 2. Next.js Configuration (`next.config.js`)

#### Image Optimization
- Enabled AVIF and WebP formats for better compression
- Reduces memory footprint of image processing

#### SWC Minification
- Enabled `swcMinify: true` for faster, more efficient builds
- Reduces memory usage during compilation

#### Console Removal (Production)
- Removes console.log statements in production builds
- Reduces bundle size and runtime memory

#### On-Demand Entries
- `maxInactiveAge: 25s` - Pages kept in buffer for 25 seconds
- `pagesBufferLength: 2` - Only 2 pages kept simultaneously
- Prevents memory buildup from keeping too many pages in memory

#### Webpack Optimization
- Polling interval: 1000ms (reduces CPU/memory spikes)
- Aggregate timeout: 300ms (batches file changes)
- Ignores node_modules (reduces watch overhead)

## Running the Optimized Server

### Standard (with optimizations):
```bash
npm run dev
```

### Alternative (if cross-env is installed):
```bash
npm run dev:optimized
```

### Manual (with custom memory):
```bash
$env:NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"; npm run dev
```

## Memory Monitoring

### Check Node.js Memory Usage:
```powershell
# In PowerShell
Get-Process node | Select-Object Id, ProcessName, @{Name="Memory(MB)";Expression={[math]::Round($_.WS/1MB,2)}}
```

### Monitor in Real-time:
```powershell
# Watch memory usage
while ($true) {
    Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, @{Name="Memory(MB)";Expression={[math]::Round($_.WS/1MB,2)}} | Format-Table
    Start-Sleep -Seconds 5
}
```

## Best Practices to Prevent Memory Issues

### 1. Component Optimization
- Use `React.memo()` for expensive components
- Avoid creating large objects in render functions
- Use `useMemo()` and `useCallback()` for heavy computations

### 2. Data Fetching
- Implement pagination for large datasets
- Use `revalidate` in Next.js data fetching
- Limit concurrent API requests

### 3. Image Handling
- Use Next.js Image component with proper sizing
- Implement lazy loading
- Optimize image formats (WebP, AVIF)

### 4. State Management
- Avoid storing large objects in component state
- Use context providers sparingly
- Clear unused state and subscriptions

### 5. Development Practices
- Restart dev server periodically if memory grows
- Clear browser cache regularly
- Close unused browser tabs
- Monitor memory usage during development

## Troubleshooting

### If Memory Issues Persist:

1. **Increase Memory Limit**:
   ```bash
   $env:NODE_OPTIONS="--max-old-space-size=6144 --expose-gc"; npm run dev
   ```

2. **Clear Next.js Cache**:
   ```bash
   Remove-Item -Recurse -Force .next
   npm run dev
   ```

3. **Clear Node Modules** (if needed):
   ```bash
   Remove-Item -Recurse -Force node_modules
   npm install
   ```

4. **Check for Memory Leaks**:
   - Use Chrome DevTools Memory Profiler
   - Look for components that don't unmount properly
   - Check for event listeners that aren't cleaned up

## Current Memory Settings

- **Heap Size**: 4GB (4096 MB)
- **Garbage Collection**: Enabled
- **Page Buffer**: 2 pages max
- **Inactive Age**: 25 seconds

These settings should handle most development scenarios. Adjust as needed based on your system's available RAM.
