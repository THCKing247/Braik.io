import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default function WhyBraikPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      
      <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <h2 className="text-4xl md:text-5xl font-athletic font-bold text-center mb-12 text-[#212529] uppercase tracking-tight">
            WHY BRAIK?
          </h2>
          <div className="max-w-4xl mx-auto">
            <div
              className="p-10 rounded-[14px] relative overflow-hidden text-[#FFFFFF] space-y-8"
              style={{
                backgroundColor: "rgba(28, 28, 28, 0.9)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <div>
                <p className="text-xl font-semibold text-[#FFFFFF] mb-6 leading-relaxed text-center">
                  Don't break your budget. Braik into a better system.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Most coaching platforms solve one problem—and charge you for five.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Coaches are often forced to stitch together multiple tools for scheduling, communication, payments, documents, and team coordination. The result is higher costs, more complexity, and more time spent managing software instead of running the program.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  Braik was built to offer a better path forward.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  The Problem With Most Coaching Software
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Many coaching and team-management tools focus on a single feature:
                </p>
                <ul className="text-lg text-[#FFFFFF] mb-4 leading-relaxed list-disc list-inside space-y-2 ml-4">
                  <li>scheduling</li>
                  <li>messaging</li>
                  <li>payments</li>
                  <li>documents</li>
                  <li>film or analytics</li>
                </ul>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  While each tool may work well on its own, programs are left juggling multiple subscriptions, logins, and workflows. Over time, this creates:
                </p>
                <ul className="text-lg text-[#FFFFFF] mb-4 leading-relaxed list-disc list-inside space-y-2 ml-4">
                  <li>rising costs</li>
                  <li>fragmented communication</li>
                  <li>duplicated work</li>
                  <li>confusion for parents and players</li>
                  <li>added stress for coaches</li>
                </ul>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  Most platforms weren't built to manage the entire program.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Where Braik Stands Apart
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik brings everything together into one system, designed around how coaches actually operate.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Instead of stacking apps, Braik centralizes:
                </p>
                <ul className="text-lg text-[#FFFFFF] mb-4 leading-relaxed list-disc list-inside space-y-2 ml-4">
                  <li>scheduling and calendars</li>
                  <li>communication and announcements</li>
                  <li>payments and dues</li>
                  <li>documents and resources</li>
                  <li>role-based access for staff, players, and parents</li>
                  <li>AI-assisted support to reduce routine workload</li>
                </ul>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  This unified approach reduces friction, saves time, and removes the need to manage multiple disconnected tools.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Built for Real Program Constraints
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik was designed with a clear reality in mind:
                </p>
                <ul className="text-lg text-[#FFFFFF] mb-4 leading-relaxed list-disc list-inside space-y-2 ml-4">
                  <li>coaching staffs are limited</li>
                  <li>budgets are tight</li>
                  <li>expectations remain high</li>
                </ul>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Rather than pushing premium pricing or locking teams into rigid plans, Braik is structured to stay accessible for real programs—especially at the high school level.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  The platform is built to grow with your program, not force you to overpay for features you don't need.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Built for Entire Programs — Varsity and JV
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Most athletic programs don't operate as a single roster.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Varsity and JV teams often share resources, staff, and schedules—but are forced into separate systems or duplicate subscriptions. Braik was built to reflect how programs actually function.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  With Braik, Varsity and JV teams are managed under one program, giving coaches a unified system without sacrificing team-level autonomy.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Varsity Head Coaches manage the full program and can create and configure JV teams, assign JV Head Coaches, and maintain program-level oversight.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  JV Head Coaches have full authority over their own team dashboards, schedules, communication, and players, but cannot access or override Varsity teams or program-level settings.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  This structure keeps programs unified while respecting clear lines of responsibility across all sports.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  One System. Less Stress.
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik exists to remove the operational noise that slows programs down.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  When communication is clear, systems are unified, and tools work together, coaches regain time and focus. That's where Braik stands apart—not by doing more, but by bringing everything into one place.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
