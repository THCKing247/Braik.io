# Inventory System Enhancements

## Overview
Enhanced the inventory management system with equipment presets, modal-based item creation, and improved grid/list views.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20260319000000_equipment_inventory_enhancements.sql`
- Added `equipment_type` column to `inventory_items` table
- Tracks whether equipment is from preset list or custom
- Added index for efficient lookups

### 2. Equipment Presets
The following preset equipment types are available:
- Helmets
- Pads
- Practice Jerseys
- Home Jersey
- Away Jersey
- Alternate Jersey
- Home Pants
- Away Pants
- Alternate Pants
- Practice Pants
- Chinstraps
- Knee Pads
- Mouthpieces
- Locks
- Lockers
- Playcall Wristbands

### 3. Add Item Modal
**File:** `components/portal/add-item-modal.tsx`
- Modal-based interface for adding equipment
- Radio buttons to choose between preset and custom equipment
- Dropdown for preset selection
- Text input for custom equipment names
- Quantity input
- Baseline condition selection
- Availability status selection
- Optional player assignment
- Notes field

### 4. API Updates
**File:** `app/api/teams/[teamId]/inventory/route.ts`
- Updated GET endpoint to include `equipment_type` in response
- Implemented POST endpoint to create inventory items
- Supports creating multiple items when quantity > 1
- Handles both preset and custom equipment types

### 5. Inventory Manager Component
**File:** `components/portal/inventory-manager.tsx` (to be updated)
- Integrated AddItemModal component
- Grid and list view toggle
- Enhanced item cards with assign to player functionality
- Better visual organization

## Database Schema Changes

### New Column
```sql
equipment_type text
```
- Stores preset equipment type (e.g., "Helmets", "Pads") or "CUSTOM"
- Nullable for backward compatibility
- Indexed for performance

## Usage

### Adding Equipment
1. Click "Add Item" button
2. Choose "Preset Equipment" or "Custom Equipment"
3. If preset: Select from dropdown
4. If custom: Enter equipment name
5. Enter quantity
6. Select baseline condition
7. Select availability status
8. Optionally assign to player
9. Add notes if needed
10. Click "Add Equipment"

### Viewing Inventory
- Toggle between grid and list views
- See all equipment items with their status
- Assign/unassign items to players
- Edit item details
- Delete items

## Supabase Migration

To apply the database changes:

```bash
supabase migration up
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/20260319000000_equipment_inventory_enhancements.sql`
3. Run the SQL

## Next Steps

1. Update InventoryManager component to use AddItemModal
2. Add grid/list view toggle
3. Enhance item cards with better assign functionality
4. Add filtering and search capabilities
5. Add bulk operations (assign multiple items, etc.)
