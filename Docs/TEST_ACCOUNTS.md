# Test Accounts - Login Credentials

## Platform Owner (Admin Access)

**Email:** `admin@braik.com`  
**Password:** `admin123`  
**Role:** Platform Owner + HEAD_COACH  
**Access:** Full platform admin access + Head Coach permissions

---

## Role-Based Test Accounts

### Head Coach
**Email:** `coach@example.com`  
**Password:** `password123`  
**Role:** HEAD_COACH  
**Access:** Full administrative authority within their program

### Assistant Coach
**Email:** `assistant@example.com`  
**Password:** `password123`  
**Role:** ASSISTANT_COACH  
**Access:** Limited admin (no billing), can manage assigned position groups

### Player
**Email:** `player1@example.com`  
**Password:** `password123`  
**Role:** PLAYER  
**Access:** View-only role with limited interaction

### Parent
**Email:** `parent1@example.com`  
**Password:** `password123`  
**Role:** PARENT  
**Access:** View Head Coach events, receive announcements, view message threads (read-only)

---

## Additional Test Accounts

### Second Player
**Email:** `player2@example.com`  
**Password:** `password123`  
**Role:** PLAYER

### Second Parent
**Email:** `parent2@example.com`  
**Password:** `password123`  
**Role:** PARENT

---

## Quick Login Reference

| Role | Email | Password |
|------|-------|----------|
| Platform Owner | admin@braik.com | admin123 |
| Head Coach | coach@example.com | password123 |
| Assistant Coach | assistant@example.com | password123 |
| Player | player1@example.com | password123 |
| Parent | parent1@example.com | password123 |

---

## Notes

- All accounts are created when you run `npm run db:seed`
- Platform Owner has `isPlatformOwner: true` flag which grants admin privileges
- Platform Owner can access admin panel at `/dashboard/admin`
- All test accounts are part of the same team: "Varsity Football" at "Lincoln High School"
