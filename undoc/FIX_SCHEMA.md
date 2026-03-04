# Fix Schema - Manual Steps Required

The schema needs two updates. Please manually edit `prisma/schema.prisma`:

## 1. Add imageUrl field (after line 206)

Find this:
```prisma
  notes        String?  @db.Text
  uniqueCode   String?  @unique
```

Change to:
```prisma
  notes        String?  @db.Text
  imageUrl     String?  // Player profile image URL
  uniqueCode   String?  @unique
```

## 2. Add depthChartEntries relation (after line 216)

Find this:
```prisma
  assignedInventory InventoryItem[]

  @@index([teamId])
```

Change to:
```prisma
  assignedInventory InventoryItem[]
  depthChartEntries DepthChartEntry[]

  @@index([teamId])
```

## 3. Run migration

After making these changes, run:
```bash
npm run db:push
```

This will fix the runtime error.
