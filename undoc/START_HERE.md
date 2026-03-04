# 🚀 START HERE - Get Braik Running

## Step 1: Install Node.js (REQUIRED)

**You need Node.js installed first!**

1. Download from: **https://nodejs.org/**
2. Install the LTS version (recommended)
3. **Restart your terminal/PowerShell after installing**
4. Verify it works:
   ```powershell
   node --version
   npm --version
   ```

## Step 2: Install PostgreSQL (REQUIRED)

**Choose ONE option:**

### Option A: Docker (Easiest)
```powershell
docker run --name braik-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=braik -p 5432:5432 -d postgres:15
```

### Option B: Direct Install
1. Download from: **https://www.postgresql.org/download/windows/**
2. Install with default settings
3. Remember your password (default user: `postgres`)

## Step 3: Run Setup

After Node.js and PostgreSQL are installed, run:

```powershell
# Create .env file (if it doesn't exist)
# Then install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Create database tables
npm run db:push

# Add sample data
npm run db:seed

# Start the server
npm run dev
```

## Step 4: Open in Browser

Once the server starts, you'll see:
```
✓ Ready on http://localhost:3000
```

**Open your browser and go to:**
# 🌐 http://localhost:3000

## Test Accounts

After seeding:
- **Head Coach**: coach@example.com / password123
- **Assistant**: assistant@example.com / password123
- **Player**: player1@example.com / password123
- **Parent**: parent1@example.com / password123

---

## Need Help?

- See `QUICK_START.md` for detailed instructions
- See `SETUP.md` for troubleshooting
