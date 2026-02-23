import { Card, CardContent } from "@/components/ui/card"

export default function FilmPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Film</h1>
        <p className="text-[#E5E7EB]">Video analysis and film review</p>
      </div>
      <Card>
            <CardContent className="pt-6 text-center text-[#94A3B8]">
          <p className="text-lg mb-2">Coming Soon</p>
          <p>The film module is under development and will be available in a future update.</p>
        </CardContent>
      </Card>
    </div>
  )
}

