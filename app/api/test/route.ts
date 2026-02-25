import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Test API route is active under App Router",
  })
}

