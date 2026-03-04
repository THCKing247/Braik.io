import { NextResponse } from "next/server"

export async function PATCH() {
  return NextResponse.json(
    { error: "Not migrated: Prisma removed. Use Supabase." },
    { status: 501 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Not migrated: Prisma removed. Use Supabase." },
    { status: 501 }
  )
}
