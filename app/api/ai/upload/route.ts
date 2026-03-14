import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({
    extractedText:
      "File upload received. Parsing is not implemented yet.",
  })
}
