# Quick Start - Run Braik on Localhost

## Option 1: Full Setup (Recommended)

### Step 1: Install Node.js
1. Download Node.js 18+ from: https://nodejs.org/
2. Install it (this includes npm)
3. Restart your terminal/PowerShell

### Step 2: Install PostgreSQL

**Option A: Using Docker (Easiest)**
```powershell
docker run --name braik-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=braik -p 5432:5432 -d postgres:15
```

**Option B: Install PostgreSQL directly**
1. Download from: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember your password (default user is `postgres`)

### Step 3: Run Setup Script
```powershell
.\setup.ps1
```

This will:
- Check for Node.js/npm
- Create .env file
- Install dependencies
- Generate Prisma client

### Step 4: Configure Database
Edit `.env` file and update DATABASE_URL:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/braik?schema=public"
```

### Step 5: Set Up Database
```powershell
npm run db:push
npm run db:seed
```

### Step 6: Start Server
```powershell
npm run dev
```

Visit: **http://localhost:3000**

---

## Option 2: Manual Setup

### 1. Install Node.js
Download and install from https://nodejs.org/

### 2. Install PostgreSQL
Download from https://www.postgresql.org/download/windows/

### 3. Create .env file
Copy this into a new file named `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/braik?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-this-to-a-random-string"
UPLOAD_DIR="./uploads"
```

### 4. Install and Setup
```powershell
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

---

## Test Accounts (After Seeding)

- **Head Coach**: coach@example.com / password123
- **Assistant**: assistant@example.com / password123
- **Player**: player1@example.com / password123
- **Parent**: parent1@example.com / password123

---

## Troubleshooting

### "npm is not recognized"
- Install Node.js from nodejs.org
- Restart your terminal

### "Cannot connect to database"
- Make sure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify database `braik` exists

### Port 3000 already in use
- Close other applications using port 3000
- Or change port in package.json: `"dev": "next dev -p 3001"`

---

## Need Help?

Check SETUP.md for detailed instructions.
