import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { error: "Not migrated: Prisma removed. Use Supabase." },
    { status: 501 }
  )
}
