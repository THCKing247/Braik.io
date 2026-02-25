import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const PARENTAL_CONSENT_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFsgMyAwIFIgXSAvQ291bnQgMSA+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9Db250ZW50cyA0IDAgUiAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDM0MSA+PgpzdHJlYW0KQlQKL0YxIDE2IFRmCjcyIDc0MCBUZAooQnJhaWsgUGFyZW50YWwgQ29uc2VudCBGb3JtKSBUagovRjEgMTAgVGYKNzIgNzEwIFRkCihQYXJlbnQvR3VhcmRpYW4gTmFtZTogX19fX19fX19fX19fX19fX19fX18pIFRqCjcyIDY4OCBUZAooUGxheWVyIE5hbWU6IF9fX19fX19fX19fX19fX19fX19fX18pIFRqCjcyIDY2NiBUZAooVGVhbTogX19fX19fX19fX19fX19fX19fX19fX19fXykgVGoKNzIgNjQ0IFRkCihJIGNvbmZpcm0gY29uc2VudCBmb3IgbWlub3IgcGFydGljaXBhdGlvbiBpbiBCcmFpay4pIFRqCjcyIDYyMiBUZAooU2lnbmF0dXJlOiBfX19fX19fX19fX19fX19fX19fX19fX18pIFRqCjcyIDYwMCBUZAooRGF0ZTogX19fX19fX19fX19fX19fX19fX19fX19fX18pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxMCAwMDAwMCBuIAowMDAwMDAwMDYwIDAwMDAwIG4gCjAwMDAwMDAxMTcgMDAwMDAgbiAKMDAwMDAwMDI0MyAwMDAwMCBuIAowMDAwMDAwNjM2IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNzI2CiUlRU9G"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bytes = Buffer.from(PARENTAL_CONSENT_PDF_BASE64, "base64")

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="braik-parental-consent-form.pdf"',
      "Cache-Control": "no-store",
    },
  })
}
