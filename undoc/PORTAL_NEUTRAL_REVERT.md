# Portal Neutral Color Changes - Revert Guide

This document tracks all changes made to neutralize the portal UI colors. If you want to revert these changes, use this as a reference.

## Files Modified

### 1. `app/dashboard/layout.tsx`
**Changes:**
- Main background: Changed from `rgb(var(--braik-navy))` to `#FFFFFF`
- Aside background: Added `#FFFFFF`
- Main background: Added `#FFFFFF`

**Original:**
```tsx
<div className="min-h-screen" style={{ backgroundColor: "rgb(var(--braik-navy))" }}>
```

**New:**
```tsx
<div className="min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
```

---

### 2. `components/dashboard-nav.tsx`
**Changes:**
- Header background: Changed from `rgb(var(--braik-navy))` to `#FFFFFF`
- Border color: Changed from `rgb(var(--braik-navy))` to `#1F2937`
- Active tab: Removed blue pill background, added underline with `border-b-2 border-[#3B82F6]`
- Navigation text: Changed from `text-white` to `text-[#111827]`
- Role badge: Changed from `bg-[#1F2937]` with colored text to `border border-[#1F2937]` with `#111827` text and `#F7F7F8` background
- Email text: Changed from `text-white` to `text-[#111827]`
- Sign Out button: Added `text-[#111827]` class

---

### 3. `components/quick-actions-sidebar.tsx`
**Changes:**
- Base card background: Changed from `rgb(var(--braik-navy))` to `#FFFFFF`
- Border: Changed from `border-2` with `#3B82F6` to `border` with `#1F2937` (1px)
- Icon color: Changed from `text-white` to `#111827`
- Hover overlay background: Changed from `rgb(var(--braik-navy))` to `#FFFFFF`
- Hover overlay border: Changed to `#1F2937` (1px)
- Hover overlay content background: Added `#F7F7F8`
- Hover overlay text: Changed from `text-white` to `#111827`

---

### 4. `components/unified-team-header.tsx`
**Changes:**
- Card background: Changed from `bg-white` to `#F7F7F8`
- Border: Changed from `borderColor: "#3B82F6"` to `borderColor: "#1F2937"` with `borderWidth: "1px"`
- Title text: Changed from `text-[#0F172A]` to inline style `color: "#111827"`
- Slogan text: Changed from `text-[#0F172A]` to inline style `color: "#111827"`
- Subtext: Changed from `text-[#6B7280]` to inline style `color: "#6B7280"`
- Record labels: Changed to inline style `color: "#6B7280"`
- Record values: Changed to inline style `color: "#111827"`
- Logo placeholder border: Changed from `border-2` with `#E5E7EB` to `border` with `#1F2937`

---

### 5. `components/ui/card.tsx`
**Changes:**
- Default background: Changed from `bg-white` to `bg-[#F7F7F8]`
- Default border: Changed from `border-[#3B82F6]` to `border-[#1F2937]` with `borderWidth: "1px"`
- Added inline styles to override className defaults

---

### 6. `components/calendar-widget.tsx`
**Changes:**
- Card background: Changed from `bg-[#FFFFFF]` to `#F7F7F8`
- Card border: Changed from `border-2` with `secondaryColor` to `border` with `#1F2937` (1px)
- Calendar title: Changed from `text-[#0F172A]` to inline style `color: "#111827"`
- View buttons container: Changed border to `#1F2937` (1px), background to `#FFFFFF`
- Active view button: Changed from `variant="default"` (blue fill) to `variant="outline"` with `border-b-2 border-[#3B82F6]` underline
- Navigation buttons: Changed to `variant="outline"` with `#1F2937` border
- Week view header: Changed border to `#1F2937`
- Day cards: Changed border to `#1F2937` (1px), background to `#FFFFFF`
- Selected day: Kept blue outline (`#3B82F6`) but removed filled background
- Event items: Changed backgrounds to `#FFFFFF`, text to `#111827`
- Day view header: Changed border to `#1F2937`
- Day view events: Changed border to `#1F2937` (1px)
- Priority badge: Changed from blue fill to border with `#F7F7F8` background
- Month view: Updated borders and colors to match neutral theme

---

## Color Mapping Reference

| Element | Original | New |
|---------|----------|-----|
| Main background | `rgb(var(--braik-navy))` | `#FFFFFF` |
| Card background | `#FFFFFF` | `#F7F7F8` |
| Card border | `#3B82F6` (blue) | `#1F2937` (near-black) |
| Primary text | `#0F172A` / `text-white` | `#111827` |
| Secondary text | `#6B7280` | `#6B7280` (unchanged) |
| Active tab indicator | Blue pill background | Blue underline only |
| Selected calendar day | Blue border + fill | Blue outline only |
| Icon color | White | `#111827` |
| Hover background | Blue tint | `#F7F7F8` |

---

## To Revert

To revert all changes, you would need to:
1. Restore the original color values in each file listed above
2. Remove inline style overrides where added
3. Restore original className values

The changes are purely cosmetic and do not affect functionality or layout structure.
