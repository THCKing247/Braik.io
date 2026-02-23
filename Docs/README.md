# Braik - Sports Team Operating System

**Braik the Huddle. Braik the Norm.**

Braik is a comprehensive sports team operating system designed for football-first, multi-sport teams. It provides roster management, digital dues collection, scheduling, communication, document management, and an AI assistant.

## Features

- **Roster Management**: Track players, positions, and status with CSV import
- **Digital Dues**: Season-based pricing ($5 per player) with Stripe integration
- **Scheduling & RSVPs**: Calendar for practices, games, meetings with player RSVPs
- **Communication**: Announcements and targeted messaging
- **Document Hub**: Upload and manage playbooks, waivers, policies with role-based access
- **AI Assistant**: Draft messages, summarize content, generate reminders
- **Role-Based Access**: Head Coach, Assistant Coach, Player, Parent roles with strict permissions

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes & Server Actions
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js
- **Payments**: Stripe
- **AI**: OpenAI API

## Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Stripe account (for payments)
- OpenAI API key (optional, for AI assistant)

## Quick Start

**Fastest way to get running:**

1. Install Node.js from https://nodejs.org/ (includes npm)
2. Install PostgreSQL or use Docker
3. Run the setup script:
   ```powershell
   .\setup.ps1
   ```
4. Update `.env` with your database credentials
5. Set up database:
   ```powershell
   npm run db:push
   npm run db:seed
   ```
6. Start server:
   ```powershell
   npm run dev
   ```

Visit: http://localhost:3000

**See QUICK_START.md for detailed instructions.**

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Docker)

### 2. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
- `OPENAI_API_KEY`: (Optional) For AI assistant

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database with sample data
npm run db:seed
```

### 4. Create Uploads Directory

```bash
mkdir -p uploads
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Docker Setup (Alternative)

A `docker-compose.yml` file is included for local development:

```bash
docker-compose up -d
```

This will start PostgreSQL and the app. Make sure to set your `DATABASE_URL` to:
```
postgresql://postgres:postgres@localhost:5432/braik?schema=public
```

## Default Accounts

After seeding, you can login with:

- **Head Coach**: `coach@example.com` / `password123`
- **Assistant Coach**: `assistant@example.com` / `password123`
- **Player**: `player1@example.com` / `password123`
- **Parent**: `parent1@example.com` / `password123`

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── login/             # Auth pages
│   └── signup/
├── components/             # React components
│   └── ui/                # shadcn/ui components
├── lib/                    # Utilities
│   ├── auth.ts            # NextAuth config
│   ├── prisma.ts          # Prisma client
│   ├── rbac.ts            # Role-based access control
│   └── roles.ts           # Role definitions
├── prisma/                 # Prisma schema and migrations
│   └── seed.ts            # Database seed script
└── uploads/                # File uploads (local dev)
```

## Key Features Implementation

### Role-Based Access Control

Roles are enforced at the API level using `requireTeamPermission()`:
- `HEAD_COACH`: Full access
- `ASSISTANT_COACH`: Limited admin (no billing)
- `PLAYER`: View-only for most features
- `PARENT`: View + payment access

### Payments

Stripe checkout sessions are created for each player's dues. Payment status is tracked in the database. Coaches can export payment status as CSV.

### AI Assistant

The AI assistant uses OpenAI to:
- Draft messages based on prompts
- Summarize long content
- Generate reminders based on team data (unpaid dues, etc.)

## Development

### Database Commands

```bash
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema changes
npm run db:migrate     # Run migrations
npm run db:studio      # Open Prisma Studio
npm run db:seed        # Seed database
```

### Building for Production

```bash
npm run build
npm start
```

## Future Enhancements

- Film module (video upload and analysis)
- SMS notifications
- Mobile app
- Advanced analytics
- Multi-team switching UI

## License

Proprietary - All rights reserved

## Support

For issues or questions, please contact the development team.

