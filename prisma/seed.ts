import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Optional: add seed data here
  // e.g. await prisma.user.create({ data: { ... } })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
