import { notFound } from "next/navigation"
import Link from "next/link"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getPublicRecruitingPageData } from "@/lib/recruiting/profile-resolver"
import { RecruitingFilmSection } from "@/components/recruiting/recruiting-film-section"

export const dynamic = "force-dynamic"

export default async function PublicRecruitingProfilePage({
  params,
}: {
  params: Promise<{ slugOrId: string }>
}) {
  const { slugOrId } = await params
  if (!slugOrId) notFound()

  const supabase = getSupabaseServer()
  const data = await getPublicRecruitingPageData(supabase, slugOrId)
  if (!data) notFound()

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ") || "Player"
  const heightStr =
    data.heightFeet != null && data.heightInches != null
      ? `${data.heightFeet}'${data.heightInches}"`
      : data.heightFeet != null
        ? `${data.heightFeet}'`
        : null

  return (
    <div className="min-h-screen bg-[#0f1419] text-gray-100">
      <header className="border-b border-gray-800 py-4 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold text-white hover:text-gray-300">
            Braik
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/recruiting" className="text-blue-400 hover:text-blue-300 hover:underline">
              Browse athletes
            </Link>
            <span className="text-gray-500">Recruiting Profile</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-6">
        <div className="rounded-xl border border-gray-800 bg-[#161b22] overflow-hidden">
          {/* Hero */}
          <div className="p-6 md:p-8 border-b border-gray-800">
            <h1 className="text-2xl md:text-3xl font-bold text-white">{fullName}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
              {data.positionGroup && <span>{data.positionGroup}</span>}
              {data.graduationYear != null && <span>Class of {data.graduationYear}</span>}
              {data.teamName && (
                <span>
                  {data.teamName}
                  {data.teamLevel && ` · ${data.teamLevel}`}
                </span>
              )}
              {data.programName && <span>{data.programName}</span>}
            </div>
          </div>

          {/* Measurables */}
          <section className="p-6 md:p-8 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Measurables</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {heightStr && (
                <div>
                  <p className="text-xs text-gray-500">Height</p>
                  <p className="font-medium text-white">{heightStr}</p>
                </div>
              )}
              {data.weightLbs != null && (
                <div>
                  <p className="text-xs text-gray-500">Weight</p>
                  <p className="font-medium text-white">{data.weightLbs} lbs</p>
                </div>
              )}
              {data.fortyTime != null && (
                <div>
                  <p className="text-xs text-gray-500">40 Yard</p>
                  <p className="font-medium text-white">{data.fortyTime}s</p>
                </div>
              )}
              {data.gpa != null && (
                <div>
                  <p className="text-xs text-gray-500">GPA</p>
                  <p className="font-medium text-white">{data.gpa}</p>
                </div>
              )}
            </div>
          </section>

          {/* Bio */}
          {data.bio && (
            <section className="p-6 md:p-8 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Bio</h2>
              <p className="text-gray-300 whitespace-pre-wrap">{data.bio}</p>
            </section>
          )}

          <RecruitingFilmSection
            externalLinks={data.videoLinks}
            braikVideos={data.recruitingFilm.braikVideos}
            braikClips={data.recruitingFilm.braikClips}
            hudlUrl={data.hudlUrl}
            youtubeUrl={data.youtubeUrl}
          />

          {/* Stats (if visible) */}
          {data.statsSummary && Object.keys(data.statsSummary).length > 0 && (
            <section className="p-6 md:p-8 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Stats</h2>
              <pre className="text-sm text-gray-300 overflow-auto rounded bg-black/20 p-4">
                {JSON.stringify(data.statsSummary, null, 2)}
              </pre>
            </section>
          )}

          {/* Playbook mastery (if visible) */}
          {data.playbookMasteryPct != null && (
            <section className="p-6 md:p-8 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Playbook readiness</h2>
              <p className="text-gray-300">{data.playbookMasteryPct}% of assigned plays completed</p>
            </section>
          )}

          {/* Development (if visible) */}
          {data.developmentSummary && (
            <section className="p-6 md:p-8 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Development</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {data.developmentSummary.strength != null && (
                  <div>
                    <p className="text-xs text-gray-500">Strength</p>
                    <p className="font-medium text-white">{data.developmentSummary.strength}</p>
                  </div>
                )}
                {data.developmentSummary.speed != null && (
                  <div>
                    <p className="text-xs text-gray-500">Speed</p>
                    <p className="font-medium text-white">{data.developmentSummary.speed}</p>
                  </div>
                )}
                {data.developmentSummary.footballIq != null && (
                  <div>
                    <p className="text-xs text-gray-500">Football IQ</p>
                    <p className="font-medium text-white">{data.developmentSummary.footballIq}</p>
                  </div>
                )}
                {data.developmentSummary.leadership != null && (
                  <div>
                    <p className="text-xs text-gray-500">Leadership</p>
                    <p className="font-medium text-white">{data.developmentSummary.leadership}</p>
                  </div>
                )}
                {data.developmentSummary.discipline != null && (
                  <div>
                    <p className="text-xs text-gray-500">Discipline</p>
                    <p className="font-medium text-white">{data.developmentSummary.discipline}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Coach notes (if visible) */}
          {data.coachNotes && (
            <section className="p-6 md:p-8 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Coach notes</h2>
              <p className="text-gray-300 whitespace-pre-wrap">{data.coachNotes}</p>
            </section>
          )}

          {/* Social */}
          {(data.xHandle || data.instagramHandle) && (
            <section className="p-6 md:p-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Social</h2>
              <div className="flex gap-4">
                {data.xHandle && (
                  <a
                    href={`https://x.com/${data.xHandle.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    @{data.xHandle.replace(/^@/, "")}
                  </a>
                )}
                {data.instagramHandle && (
                  <a
                    href={`https://instagram.com/${data.instagramHandle.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    @{data.instagramHandle.replace(/^@/, "")}
                  </a>
                )}
              </div>
            </section>
          )}
        </div>

        <p className="mt-6 flex flex-wrap justify-center gap-4 text-center text-sm text-gray-500">
          <Link href="/recruiting" className="hover:text-gray-400">
            ← Browse athletes
          </Link>
          <Link href="/" className="hover:text-gray-400">
            Braik home
          </Link>
        </p>
      </main>
    </div>
  )
}
