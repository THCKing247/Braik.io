# Schema Update Required

To fix the runtime error, you need to add the `imageUrl` field to the Player model in `prisma/schema.prisma`:

```prisma
model Player {
  id           String   @id @default(cuid())
  teamId       String
  userId       String?  // nullable - player may not have account yet
  firstName    String
  lastName     String
  grade        Int?
  jerseyNumber Int?
  positionGroup String? // "QB", "RB", "WR", "OL", "DL", "LB", "DB", "K", etc.
  status       String   @default("active") // "active", "inactive"
  notes        String?  @db.Text
  imageUrl     String?  // ADD THIS LINE - Player profile image URL
  uniqueCode   String?  @unique // 8-character unique code for joining (generated per player)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  // ... rest of the model
}
```

After adding the field, run:
```bash
npm run db:push
```

This will update your database schema without losing data.
