# ⚠️ URGENT: Fix Login - Database Required

## The Problem

**Login is failing because PostgreSQL database is not running.**

The app needs PostgreSQL to:
- Store user accounts
- Authenticate logins
- Store all team data

## Quick Solution

### Step 1: Install PostgreSQL

**Download and install:**
1. Go to: **https://www.postgresql.org/download/windows/**
2. Click "Download the installer"
3. Run the installer
4. **Important:** Remember the password you set for the `postgres` user
5. Complete installation (use default port 5432)

### Step 2: Update .env File

Edit the `.env` file in the project root and update the password:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/braik?schema=public"
```

Replace `YOUR_PASSWORD_HERE` with the password you set during installation.

### Step 3: Start PostgreSQL Service

Open PowerShell as Administrator and run:

```powershell
Get-Service -Name postgresql* | Start-Service
```

Or find "PostgreSQL" in Windows Services and start it.

### Step 4: Set Up Database

In your project terminal, run:

```powershell
npm run db:push
npm run db:seed
```

### Step 5: Try Login Again

Now you can login with:
- **Email:** `coach@example.com`
- **Password:** `password123`

## Verify It's Working

Check if PostgreSQL is running:
```powershell
netstat -ano | findstr :5432
```

If you see output, PostgreSQL is running!

## Alternative: Use Docker (if installed)

If you have Docker Desktop:
```powershell
docker run --name braik-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=braik -p 5432:5432 -d postgres:15
```

Then run `npm run db:push` and `npm run db:seed`.

---

**Once PostgreSQL is running and the database is set up, login will work!**
