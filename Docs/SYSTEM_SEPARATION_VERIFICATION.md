# System Separation Verification

## Overview

This document describes the system separation verification process for ensuring that **Inventory** and **Documents** systems remain properly separated in the Braik codebase.

## Separation Requirements

The following separation requirements must be maintained:

### 1. UI Component Separation
- **Inventory** uses `components/inventory-manager.tsx`
- **Documents** uses `components/documents-manager.tsx`
- Components must not reference each other
- Pages must use their respective components only

### 2. API Route Separation
- **Inventory** API: `/api/teams/[teamId]/inventory`
- **Documents** API: `/api/documents`
- Routes must use their respective permission systems
- No cross-contamination of permission checks

### 3. Permissions System Separation
- **Inventory** permissions: `lib/inventory-permissions.ts`
- **Documents** permissions: `lib/documents-permissions.ts`
- Each system has its own permission interface and logic
- No shared permission utilities between systems

### 4. Page Separation
- **Inventory** page: `app/dashboard/inventory/page.tsx`
- **Documents** page: `app/dashboard/documents/page.tsx`
- Pages must use their respective managers and permissions

### 5. Navigation Separation
- Both systems have separate entries in `config/quickActions.ts`
- Separate navigation hrefs and labels
- Role-based access control applied independently

## Running Verification

### Command Line

Run the verification script to check all separation requirements:

```bash
npm run verify:separation
```

Or directly:

```bash
npx tsx scripts/verify-separation.ts
```

### Programmatic Usage

You can also use the verification functions programmatically:

```typescript
import { verifySystemSeparation, formatVerificationReport } from '@/lib/separation-verification'

const report = verifySystemSeparation()
console.log(formatVerificationReport(report))

if (!report.allPassed) {
  // Handle verification failures
  process.exit(1)
}
```

## Verification Checks

The verification system performs the following checks:

### 1. Component Separation Check
- Verifies `inventory-manager.tsx` doesn't reference documents
- Verifies `documents-manager.tsx` doesn't reference inventory
- Checks for cross-imports and shared logic

### 2. API Route Separation Check
- Verifies inventory API route uses `getInventoryPermissions`
- Verifies documents API route uses `getDocumentPermissions`
- Ensures no permission system cross-contamination

### 3. Permissions System Separation Check
- Verifies `inventory-permissions.ts` exists and is separate
- Verifies `documents-permissions.ts` exists and is separate
- Checks for cross-references between permission systems

### 4. Page Separation Check
- Verifies inventory page uses `InventoryManager`
- Verifies documents page uses `DocumentsManager`
- Ensures no component mixing

### 5. Navigation Separation Check
- Verifies both systems have separate navigation entries
- Checks for unique hrefs
- Validates role-based access configuration

## Expected Output

When verification passes, you'll see:

```
============================================================
SYSTEM SEPARATION VERIFICATION REPORT
============================================================
Timestamp: 2024-01-15T10:30:00.000Z
Overall Status: ✅ PASSED

✅ Component Separation
   Inventory and Documents components are properly separated
   ✓ inventory-manager.tsx checked
   ✓ documents-manager.tsx checked

✅ API Route Separation
   Inventory and Documents have separate API routes
   ✓ Inventory API route exists and uses correct permissions
   ✓ Documents API route exists and uses correct permissions

✅ Permissions System Separation
   Inventory and Documents have separate permissions systems
   ✓ inventory-permissions.ts exists and is separate
   ✓ documents-permissions.ts exists and is separate

✅ Page Separation
   Inventory and Documents pages are properly separated
   ✓ Inventory page exists and uses correct component
   ✓ Documents page exists and uses correct component

✅ Navigation Separation
   Inventory and Documents have separate navigation entries
   ✓ Inventory entry found in quick actions
   ✓ Documents entry found in quick actions
   ✓ Inventory and Documents have separate navigation hrefs

============================================================
```

## Integration with CI/CD

Consider adding this verification to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Verify System Separation
  run: npm run verify:separation
```

This ensures that any changes that violate separation requirements are caught before merging.

## Maintenance

When adding new features:

1. **Before merging**: Run `npm run verify:separation`
2. **If adding new components**: Ensure they don't conflate Inventory and Documents
3. **If modifying API routes**: Verify permission system usage
4. **If updating navigation**: Ensure separate entries remain

## Troubleshooting

### Common Issues

**Issue**: Verification fails with "component not found"
- **Solution**: Ensure all required files exist in their expected locations

**Issue**: False positives in regex matching
- **Solution**: The verification uses case-insensitive matching. If legitimate references exist (e.g., in comments), they may need to be excluded from checks.

**Issue**: Permission system cross-reference detected
- **Solution**: Review the code to ensure Inventory and Documents use their respective permission systems only

## Related Documentation

- [BRAIK_MASTER_INTENT.md](../Documents/BRAIK_MASTER_INTENT.md) - Overall system architecture
- [INVENTORY_PERMISSIONS_AUDIT.md](./INVENTORY_PERMISSIONS_AUDIT.md) - Inventory permissions details
