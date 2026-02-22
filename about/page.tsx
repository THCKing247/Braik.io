import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default function AboutPage() {
  return (
    <div className="min-h-screen text-[#FFFFFF] bg-[#64748B]">
      <SiteHeader />
      
      <section 
        className="relative min-h-screen bg-cover bg-no-repeat"
        style={{
          backgroundImage: 'url(/hero-background.jpg)',
          backgroundPosition: 'center 60%',
        }}
      >
        {/* Left-to-right gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#64748B]/70 via-[#64748B]/50 to-[#64748B]/30"></div>
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <h2 className="text-3xl font-athletic font-bold text-center mb-12 text-[#FFFFFF] uppercase tracking-wide drop-shadow-lg">
            ABOUT BRAIK
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="p-10 bg-[#1e3a5f] rounded-xl border-2 border-[#1e3a5f] text-[#FFFFFF] space-y-8">
              <div>
                <p className="text-xl font-semibold text-[#FFFFFF] mb-6 leading-relaxed text-center">
                  Built for Coaches. Designed to Lighten the Load.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Coaches today are expected to do far more than coach.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  They manage rosters, schedules, payments, communication, documents, parents, assistants, and increasingly complex software—often with limited staff and even less time. Braik exists to change that.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  Braik was built to support coaches who are stretched thin, giving them the tools—and the help—they need to run their programs without sacrificing focus, organization, or time with their team.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Why Braik Exists
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Most coaches don't need more apps.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  They need fewer responsibilities pulling them away from what matters.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik was created to reduce the behind-the-scenes work that consumes hours each week—work that often falls on a single head coach or a small staff. From administrative tasks to constant communication and coordination, the burden adds up quickly.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  Braik steps in as a system and a support layer, helping programs operate smoothly while allowing coaches to focus on coaching.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Who Braik Is For
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik is built primarily for high school athletic programs, where resources are limited and expectations are high. It is also well-suited for youth programs and smaller colleges that need structure without complexity.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  If you're running a program where organization, communication, and accountability matter—but time and staffing are limited—Braik is built for you.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  What Makes Braik Different
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik combines team management tools with a refined AI assistant designed to act like additional staff.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Instead of juggling spreadsheets, group texts, payment platforms, and document folders, Braik brings everything into one system—designed around the head coach's workflow.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  The AI assistant helps handle routine tasks, summarize information, surface issues, and reduce the mental load that comes with running a program. It's not meant to replace people—it's meant to support them.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Our Philosophy
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed font-semibold">
                  Coaches should coach.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed font-semibold">
                  They shouldn't have to run an office.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik is built on the belief that structure creates freedom. When systems work quietly in the background, coaches gain time, clarity, and control. Tools should support the program—not slow it down.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Looking Ahead
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik is being built as a long-term platform.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  Future plans include deeper analytics, film tools, and expanded capabilities that bring together the power of AI with the program-level insight coaches rely on today from tools like Hudl—without forcing teams to manage multiple disconnected systems.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Where It Started
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik was inspired by a lifelong sports fan, former player, and coach—along with input from coaches across the industry—who understood firsthand how demanding it is to run a program.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed font-semibold italic">
                  Braik isn't built from theory.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed font-semibold italic">
                  It's built from experience.
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
