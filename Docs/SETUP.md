# Local Development Setup Guide

Follow these steps to run Braik on localhost.

## Prerequisites

1. **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
2. **PostgreSQL** - Download from [postgresql.org](https://www.postgresql.org/download/) OR use Docker

## Quick Start (Using Docker - Recommended)

If you have Docker installed, this is the easiest way:

```bash
# 1. Start PostgreSQL with Docker
docker run --name braik-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=braik -p 5432:5432 -d postgres:15

# 2. Install dependencies
npm install

# 3. Generate Prisma client
npm run db:generate

# 4. Push database schema
npm run db:push

# 5. Seed database with sample data
npm run db:seed

# 6. Start development server
npm run dev
```

Visit: http://localhost:3000

## Manual Setup (Without Docker)

### 1. Install PostgreSQL

- Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/)
- Create a database named `braik`
- Note your database credentials

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/braik?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"

# Stripe (optional - for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# OpenAI (optional - for AI assistant)
OPENAI_API_KEY="sk-..."

# File Upload (local dev)
UPLOAD_DIR="./uploads"
```

**To generate NEXTAUTH_SECRET:**
- Windows PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))`
- Mac/Linux: `openssl rand -base64 32`

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Push database schema (creates tables)
npm run db:push

# Seed database with sample data
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## Default Test Accounts

After seeding, you can login with:

- **Head Coach**: `coach@example.com` / `password123`
- **Assistant Coach**: `assistant@example.com` / `password123`
- **Player**: `player1@example.com` / `password123`
- **Parent**: `parent1@example.com` / `password123`

## Troubleshooting

### Database Connection Issues

- Make sure PostgreSQL is running
- Check your DATABASE_URL in `.env` matches your PostgreSQL setup
- Verify the database `braik` exists

### Port Already in Use

If port 3000 is taken:
```bash
# Windows
netstat -ano | findstr :3000
# Kill the process or change port in package.json
```

### Prisma Issues

```bash
# Reset database (WARNING: deletes all data)
npm run db:push -- --force-reset

# Then reseed
npm run db:seed
```

## Useful Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:seed` - Reseed database
