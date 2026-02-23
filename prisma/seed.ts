import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create Platform Owner account (admin for all roles)
  const platformOwnerPassword = await bcrypt.hash("admin123", 10)
  const platformOwner = await prisma.user.upsert({
    where: { email: "admin@braik.com" },
    update: {
      isPlatformOwner: true,
    },
    create: {
      email: "admin@braik.com",
      name: "Platform Owner",
      password: platformOwnerPassword,
      isPlatformOwner: true,
    },
  })

  // Create master admin account for development (also Platform Owner)
  const masterPassword = await bcrypt.hash("admin123", 10)
  const masterAdmin = await prisma.user.upsert({
    where: { email: "master@braik.com" },
    update: {
      isPlatformOwner: true,
    },
    create: {
      email: "master@braik.com",
      name: "Master Admin",
      password: masterPassword,
      isPlatformOwner: true,
    },
  })

  // Create users
  const headCoachPassword = await bcrypt.hash("password123", 10)
  const headCoach = await prisma.user.upsert({
    where: { email: "coach@example.com" },
    update: {},
    create: {
      email: "coach@example.com",
      name: "Head Coach",
      password: headCoachPassword,
    },
  })

  const assistantPassword = await bcrypt.hash("password123", 10)
  const assistant = await prisma.user.upsert({
    where: { email: "assistant@example.com" },
    update: {},
    create: {
      email: "assistant@example.com",
      name: "Assistant Coach",
      password: assistantPassword,
    },
  })

  const player1Password = await bcrypt.hash("password123", 10)
  const player1 = await prisma.user.upsert({
    where: { email: "player1@example.com" },
    update: {},
    create: {
      email: "player1@example.com",
      name: "John Doe",
      password: player1Password,
    },
  })

  const player2Password = await bcrypt.hash("password123", 10)
  const player2 = await prisma.user.upsert({
    where: { email: "player2@example.com" },
    update: {},
    create: {
      email: "player2@example.com",
      name: "Jane Smith",
      password: player2Password,
    },
  })

  const parent1Password = await bcrypt.hash("password123", 10)
  const parent1 = await prisma.user.upsert({
    where: { email: "parent1@example.com" },
    update: {},
    create: {
      email: "parent1@example.com",
      name: "Parent One",
      password: parent1Password,
    },
  })

  const parent2Password = await bcrypt.hash("password123", 10)
  const parent2 = await prisma.user.upsert({
    where: { email: "parent2@example.com" },
    update: {},
    create: {
      email: "parent2@example.com",
      name: "Parent Two",
      password: parent2Password,
    },
  })

  // Create organization
  const organization = await prisma.organization.create({
    data: {
      name: "Lincoln High School",
      type: "school",
    },
  })

  // Create team
  const seasonStart = new Date()
  seasonStart.setMonth(seasonStart.getMonth() - 1)
  const seasonEnd = new Date()
  seasonEnd.setMonth(seasonEnd.getMonth() + 2)
  const duesDueDate = new Date()
  duesDueDate.setMonth(duesDueDate.getMonth() + 1)

  const team = await prisma.team.create({
    data: {
      organizationId: organization.id,
      name: "Varsity Football",
      slogan: "Braik the huddle. Braik the norm.",
      sport: "football",
      seasonName: "Fall 2024",
      seasonStart,
      seasonEnd,
      rosterCap: 50,
      duesAmount: 5.0,
      duesDueDate,
      primaryColor: "#1e3a5f",
      secondaryColor: "#FFFFFF",
    },
  })

  // Create calendar settings
  await prisma.calendarSettings.create({
    data: {
      teamId: team.id,
      defaultView: "week",
      practiceColor: "#22C55E", // Green - Practice/Positive
      gameColor: "#2563EB", // Blue - Games/Primary UI
      meetingColor: "#475569", // Slate - Neutral
      customColor: "#334155", // Slate - Neutral
      assistantsCanAddMeetings: true,
      assistantsCanAddPractices: false,
      assistantsCanEditNonlocked: false,
    },
  })

  // Create memberships
  // Platform Owner membership (can access as HEAD_COACH)
  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: platformOwner.id,
        teamId: team.id,
      },
    },
    update: {
      role: "HEAD_COACH",
    },
    create: {
      userId: platformOwner.id,
      teamId: team.id,
      role: "HEAD_COACH",
    },
  })

  // Master admin membership (for development access)
  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: masterAdmin.id,
        teamId: team.id,
      },
    },
    update: {
      role: "HEAD_COACH",
    },
    create: {
      userId: masterAdmin.id,
      teamId: team.id,
      role: "HEAD_COACH",
    },
  })

  await prisma.membership.create({
    data: {
      userId: headCoach.id,
      teamId: team.id,
      role: "HEAD_COACH",
    },
  })

  await prisma.membership.create({
    data: {
      userId: assistant.id,
      teamId: team.id,
      role: "ASSISTANT_COACH",
    },
  })

  await prisma.membership.create({
    data: {
      userId: player1.id,
      teamId: team.id,
      role: "PLAYER",
    },
  })

  await prisma.membership.create({
    data: {
      userId: player2.id,
      teamId: team.id,
      role: "PLAYER",
    },
  })

  await prisma.membership.create({
    data: {
      userId: parent1.id,
      teamId: team.id,
      role: "PARENT",
    },
  })

  await prisma.membership.create({
    data: {
      userId: parent2.id,
      teamId: team.id,
      role: "PARENT",
    },
  })

  // Create guardian profiles
  const guardian1 = await prisma.guardian.upsert({
    where: { userId: parent1.id },
    update: {},
    create: {
      userId: parent1.id,
    },
  })

  const guardian2 = await prisma.guardian.upsert({
    where: { userId: parent2.id },
    update: {},
    create: {
      userId: parent2.id,
    },
  })

  // Create players
  const player1Record = await prisma.player.create({
    data: {
      teamId: team.id,
      userId: player1.id,
      firstName: "John",
      lastName: "Doe",
      grade: 11,
      jerseyNumber: 7,
      positionGroup: "QB",
      status: "active",
    },
  })

  const player2Record = await prisma.player.create({
    data: {
      teamId: team.id,
      userId: player2.id,
      firstName: "Jane",
      lastName: "Smith",
      grade: 10,
      jerseyNumber: 23,
      positionGroup: "RB",
      status: "active",
    },
  })

  // Link guardians to players
  await prisma.guardianPlayer.create({
    data: {
      guardianId: guardian1.id,
      playerId: player1Record.id,
      relationship: "parent",
    },
  })

  await prisma.guardianPlayer.create({
    data: {
      guardianId: guardian2.id,
      playerId: player2Record.id,
      relationship: "parent",
    },
  })

  // Create events
  const practice1 = new Date()
  practice1.setDate(practice1.getDate() + 1)
  practice1.setHours(15, 0, 0, 0)
  const practice1End = new Date(practice1)
  practice1End.setHours(17, 0, 0, 0)

  const practiceEvent = await prisma.event.create({
    data: {
      teamId: team.id,
      eventType: "PRACTICE",
      title: "Team Practice",
      description: "Bring water bottles",
      start: practice1,
      end: practice1End,
      location: "Main Field",
      visibility: "TEAM",
      createdBy: headCoach.id,
    },
  })

  const game1 = new Date()
  game1.setDate(game1.getDate() + 7)
  game1.setHours(19, 0, 0, 0)
  const game1End = new Date(game1)
  game1End.setHours(21, 0, 0, 0)

  const gameEvent = await prisma.event.create({
    data: {
      teamId: team.id,
      eventType: "GAME",
      title: "Home Game vs. Rivals",
      description: "Arrive 1 hour early",
      start: game1,
      end: game1End,
      location: "Home Stadium",
      visibility: "PARENTS_AND_TEAM",
      highlight: true,
      createdBy: headCoach.id,
    },
  })

  const meeting1 = new Date()
  meeting1.setDate(meeting1.getDate() + 3)
  meeting1.setHours(18, 0, 0, 0)
  const meeting1End = new Date(meeting1)
  meeting1End.setHours(19, 0, 0, 0)

  await prisma.event.create({
    data: {
      teamId: team.id,
      eventType: "MEETING",
      title: "Coaches Meeting",
      start: meeting1,
      end: meeting1End,
      location: "Coach's Office",
      visibility: "COACHES_ONLY",
      createdBy: headCoach.id,
    },
  })

  // Create updates feed entries
  await prisma.updatesFeed.create({
    data: {
      teamId: team.id,
      type: "event_created",
      title: "New practice scheduled",
      description: "Team Practice scheduled for tomorrow at Main Field",
      linkType: "event",
      linkId: practiceEvent.id,
      urgency: "normal",
    },
  })

  await prisma.updatesFeed.create({
    data: {
      teamId: team.id,
      type: "event_created",
      title: "Home game scheduled",
      description: "Home Game vs. Rivals - Priority event",
      linkType: "event",
      linkId: gameEvent.id,
      urgency: "high",
    },
  })

  // Create announcement
  const announcement = await prisma.announcement.create({
    data: {
      teamId: team.id,
      title: "Welcome to the Season!",
      body: "Welcome everyone to the Fall 2024 season. Let's have a great year!",
      audience: "all",
      createdBy: headCoach.id,
    },
  })

  await prisma.updatesFeed.create({
    data: {
      teamId: team.id,
      type: "announcement",
      title: "Welcome to the Season!",
      description: "New announcement from Head Coach",
      linkType: "announcement",
      linkId: announcement.id,
      urgency: "normal",
    },
  })

  // Create inventory items
  const helmet1 = await prisma.inventoryItem.create({
    data: {
      teamId: team.id,
      category: "Helmets",
      name: "Helmet #7",
      quantityTotal: 1,
      quantityAvailable: 0,
      condition: "GOOD",
      status: "ASSIGNED",
      assignedToPlayerId: player1Record.id,
    },
  })

  await prisma.inventoryItem.create({
    data: {
      teamId: team.id,
      category: "Jerseys",
      name: "Jersey #23",
      quantityTotal: 1,
      quantityAvailable: 0,
      condition: "GOOD",
      status: "ASSIGNED",
      assignedToPlayerId: player2Record.id,
    },
  })

  await prisma.inventoryItem.create({
    data: {
      teamId: team.id,
      category: "Equipment",
      name: "Practice Cones",
      quantityTotal: 20,
      quantityAvailable: 20,
      condition: "GOOD",
      status: "AVAILABLE",
    },
  })

  await prisma.updatesFeed.create({
    data: {
      teamId: team.id,
      type: "inventory_update",
      title: "Inventory items added",
      description: "New equipment added to inventory",
      linkType: "inventory",
      linkId: helmet1.id,
      urgency: "low",
    },
  })

  // Create document (placeholder)
  await prisma.document.create({
    data: {
      teamId: team.id,
      title: "Team Handbook",
      fileName: "/uploads/placeholder.pdf",
      fileUrl: "/uploads/placeholder.pdf",
      category: "policy",
      visibility: "all",
      fileSize: 1024,
      mimeType: "application/pdf",
      createdBy: headCoach.id,
    },
  })

  console.log("Seed completed!")
  console.log("\n" + "=".repeat(50))
  console.log("=== PLATFORM OWNER (Admin) ===")
  console.log("Email: admin@braik.com")
  console.log("Password: admin123")
  console.log("Role: Platform Owner + HEAD_COACH")
  console.log("=".repeat(50))
  console.log("\n=== TEST ACCOUNTS BY ROLE ===")
  console.log("\nHEAD COACH:")
  console.log("  Email: coach@example.com")
  console.log("  Password: password123")
  console.log("\nASSISTANT COACH:")
  console.log("  Email: assistant@example.com")
  console.log("  Password: password123")
  console.log("\nPLAYER:")
  console.log("  Email: player1@example.com")
  console.log("  Password: password123")
  console.log("\nPARENT:")
  console.log("  Email: parent1@example.com")
  console.log("  Password: password123")
  console.log("\n" + "=".repeat(50) + "\n")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

