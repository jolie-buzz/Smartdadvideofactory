import { Link } from "wouter";
import { ArrowRight, Captions, Check, Mic2, Send, Sparkles, WandSparkles } from "lucide-react";

const supportEmail = "brandbuzzerph@gmail.com";

const features = [
  {
    icon: WandSparkles,
    title: "AI script generation",
    description: "Turn a simple product idea into a clear, scroll-stopping video script in seconds.",
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: Mic2,
    title: "AI voiceover",
    description: "Give every video a polished voice without recording, retakes, or studio equipment.",
    color: "from-sky-500 to-cyan-400",
  },
  {
    icon: Captions,
    title: "Auto captions",
    description: "Add accurate, easy-to-read captions automatically so your message lands with sound on or off.",
    color: "from-amber-400 to-orange-500",
  },
  {
    icon: Send,
    title: "TikTok publishing",
    description: "Move from finished edit to TikTok faster with a simple, connected publishing workflow.",
    color: "from-rose-500 to-pink-500",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090f] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(circle_at_50%_10%,rgba(124,58,237,0.24),transparent_48%)]" />
      <div className="pointer-events-none absolute right-[-120px] top-[520px] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <header className="relative z-10 border-b border-white/10 bg-[#07090f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-20 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Buzzly home">
            <img src="/buzzly-logo.png" alt="" className="h-10 w-10 rounded-xl object-contain sm:h-11 sm:w-11" />
            <span className="text-xl font-bold tracking-tight">Buzzly</span>
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:border-white/30 hover:bg-white/10"
            data-testid="button-header-sign-in"
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pb-28">
          <div className="relative z-10 text-center lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              AI-powered video creation
            </div>
            <h1 className="text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Make videos that
              <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-300 bg-clip-text text-transparent">
                stop the scroll.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8 lg:mx-0">
              Buzzly helps creators turn product ideas and raw clips into ready-to-publish short videos—with AI scripts, voiceovers, captions, and a faster path to TikTok.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/login"
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-violet-100 sm:w-auto"
                data-testid="button-hero-sign-in"
              >
                Start creating
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#features"
                className="flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold text-slate-300 transition hover:text-white sm:w-auto"
              >
                See what Buzzly does
              </a>
            </div>
          </div>

          <div className="relative mx-auto mt-14 max-w-md lg:mt-0">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-violet-500/30 via-fuchsia-500/10 to-cyan-400/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#111522]/90 p-3 shadow-2xl shadow-violet-950/40">
              <div className="rounded-[1.45rem] border border-white/10 bg-[#090c14] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Buzzly Studio
                  </span>
                </div>

                <div className="mt-5 aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-b from-violet-500/30 via-fuchsia-500/20 to-orange-400/30 p-5">
                  <div className="flex h-full flex-col justify-between rounded-xl border border-white/15 bg-black/25 p-5 backdrop-blur-sm">
                    <span className="w-fit rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-900">
                      New drop
                    </span>
                    <div>
                      <p className="text-3xl font-black leading-tight tracking-tight">
                        Your next viral video starts here.
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-white/80">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                          <Mic2 className="h-3.5 w-3.5" />
                        </span>
                        AI voiceover + captions
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {["Script ready", "Voice added", "Captions on"].map((item) => (
                    <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center">
                      <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                      <p className="mt-1.5 text-[10px] font-medium text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-white/10 bg-white/[0.025]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-400">One simple workflow</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">From idea to upload, faster.</h2>
              <p className="mt-4 leading-7 text-slate-400">
                Keep the creative work moving without jumping between a pile of different tools.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, description, color }, index) => (
                <article
                  key={title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="mt-6 text-xs font-bold text-slate-500">0{index + 1}</p>
                  <h3 className="mt-2 text-lg font-bold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-600/25 via-fuchsia-500/10 to-cyan-400/10 px-6 py-10 text-center sm:px-12 sm:py-14">
            <Sparkles className="mx-auto h-7 w-7 text-violet-300" />
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Ready to make some noise?</h2>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-300">
              Sign in to Buzzly and turn your next idea into a video built to be watched.
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-violet-100"
              data-testid="button-cta-sign-in"
            >
              Sign In to Buzzly
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <img src="/buzzly-logo.png" alt="" className="h-7 w-7 rounded-lg object-contain" />
            <span>© {new Date().getFullYear()} Buzzly</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-3" aria-label="Footer">
            <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms of Service</Link>
            <a href={`mailto:${supportEmail}`} className="transition hover:text-white">{supportEmail}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
