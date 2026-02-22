# Fix Login Issue - Database Setup Required

## The Problem

Login isn't working because **PostgreSQL database is not running**. The app needs a database to store users and authenticate them.

## Quick Fix (Choose One)

### Option 1: Install PostgreSQL with winget (Fastest)

```powershell
winget install PostgreSQL.PostgreSQL
```

After installation:
1. PostgreSQL will be installed as a Windows service
2. Default user: `postgres`
3. You'll be prompted to set a password during installation
4. Update `.env` file with your password:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/braik?schema=public"
   ```
5. Make sure PostgreSQL service is running:
   ```powershell
   Get-Service -Name postgresql* | Start-Service
   ```
6. Create the database:
   ```powershell
   npm run db:push
   npm run db:seed
   ```

### Option 2: Install PostgreSQL Manually

1. Download from: https://www.postgresql.org/download/windows/
2. Run the installer
3. Set a password (remember it!)
4. Update `.env` with your password
5. Run: `npm run db:push` and `npm run db:seed`

### Option 3: Use Docker (if you have Docker Desktop)

```powershell
docker run --name braik-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=braik -p 5432:5432 -d postgres:15
```

Then:
```powershell
npm run db:push
npm run db:seed
```

## After Database is Set Up

1. **Create database tables:**
   ```powershell
   npm run db:push
   ```

2. **Add sample data (includes test accounts):**
   ```powershell
   npm run db:seed
   ```

3. **Try logging in again with:**
   - Email: `coach@example.com`
   - Password: `password123`

## Verify Database is Running

Check if PostgreSQL is listening on port 5432:
```powershell
netstat -ano | findstr :5432
```

If you see output, PostgreSQL is running!

## Still Having Issues?

Check the server console/terminal for error messages. Common issues:
- PostgreSQL service not started
- Wrong password in DATABASE_URL
- Database "braik" doesn't exist (will be created by db:push)
