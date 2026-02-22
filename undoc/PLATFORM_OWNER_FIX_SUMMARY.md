# Platform Owner Identification Fix Summary

## Issue
Platform Owner was incorrectly identified as a role (`PLATFORM_OWNER`) instead of a flag (`isPlatformOwner` in User model).

## Root Cause
- Session didn't include `isPlatformOwner` flag
- Navigation and some API routes checked for `PLATFORM_OWNER` role string
- Platform Owner is a privilege flag, not a role (Platform Owners can have regular team roles)

## Changes Made

### 1. Type Definitions (`types/next-auth.d.ts`)
- ✅ Added `isPlatformOwner?: boolean` to `Session.user` interface
- ✅ Added `isPlatformOwner?: boolean` to `User` interface  
- ✅ Added `isPlatformOwner?: boolean` to `JWT` interface

### 2. Auth System (`lib/auth.ts`)
- ✅ Updated `authorize` function to select `isPlatformOwner` from User model
- ✅ Added `isPlatformOwner` to returned user object
- ✅ Updated `jwt` callback to include `isPlatformOwner` in token
- ✅ Updated `session` callback to include `isPlatformOwner` in session

### 3. Navigation Component (`components/dashboard-nav.tsx`)
- ✅ Removed `"PLATFORM_OWNER"` from all roles arrays
- ✅ Added `isPlatformOwner` check from session
- ✅ Added `isPlatformOwnerOnly` flag for Admin navigation item
- ✅ Updated filtering logic to check Platform Owner flag separately
- ✅ Platform Owners now see items based on their team role + Admin link

### 4. Quick Actions Config (`config/quickActions.ts`)
- ✅ Removed `"PLATFORM_OWNER"` from roles array
- ✅ Added comment explaining Platform Owner is a flag, not a role

## Remaining API Route Fixes Needed

The following API routes still check for `PLATFORM_OWNER` role and should be updated to query the User model for `isPlatformOwner` flag:

1. **`app/api/messages/attachments/serve/route.ts`** (line 184)
   - Current: `if (userRole === "PLATFORM_OWNER")`
   - Should: Query User model for `isPlatformOwner` flag

2. **`app/api/messages/attachments/[attachmentId]/route.ts`** (line 148)
   - Current: `if (userRole === "PLATFORM_OWNER")`
   - Should: Query User model for `isPlatformOwner` flag

**Recommended Approach**: Create a helper function in `lib/rbac.ts`:
```typescript
export async function isPlatformOwner(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformOwner: true },
  })
  return user?.isPlatformOwner || false
}
```

Then use it in API routes:
```typescript
const isPlatformOwner = await isPlatformOwner(session.user.id)
if (isPlatformOwner) {
  return true
}
```

## Testing Checklist

- [ ] Platform Owner with HEAD_COACH role sees:
  - All Head Coach navigation items
  - Admin navigation item
  - Correct role badge (shows "Head Coach", not "Platform Owner")
- [ ] Platform Owner without team role sees:
  - Admin navigation item only
- [ ] Regular users (non-Platform Owners) do NOT see Admin link
- [ ] Session includes `isPlatformOwner` flag after login
- [ ] Navigation filtering works correctly for all role combinations

## Notes

- Platform Owner is a **flag**, not a role
- Platform Owners can have regular team roles (HEAD_COACH, etc.)
- Platform Owners see navigation based on their team role + Admin access
- All permission checks should verify `isPlatformOwner` flag, not a role string
