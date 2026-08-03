import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  Captions,
  Check,
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  Clock3,
  Film,
  LayoutGrid,
  ListVideo,
  Mic2,
  Play,
  Send,
  Sparkles,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";
import { SiInstagram, SiTiktok, SiX, SiYoutube } from "react-icons/si";

const supportEmail = "brandbuzzerph@gmail.com";

const features = [
  {
    icon: WandSparkles,
    title: "AI script generation",
    description: "Turn a simple product idea into a clear, scroll-stopping video script in seconds.",
    color: "from-violet-600 to-fuchsia-500",
    glow: "shadow-violet-500/25",
  },
  {
    icon: Mic2,
    title: "AI voiceover",
    description: "Give every video a polished voice without recording, retakes, or studio equipment.",
    color: "from-sky-500 to-cyan-400",
    glow: "shadow-cyan-500/25",
  },
  {
    icon: Captions,
    title: "Auto captions",
    description: "Add accurate captions automatically so your message lands with sound on or off.",
    color: "from-amber-400 to-orange-500",
    glow: "shadow-orange-500/25",
  },
  {
    icon: Send,
    title: "TikTok publishing",
    description: "Move from finished edit to TikTok faster with a simple, connected publishing workflow.",
    color: "from-rose-500 to-pink-500",
    glow: "shadow-pink-500/25",
  },
];

const workflow = [
  {
    number: "01",
    title: "Bring your idea",
    description: "Start with a product, a hook, and the raw clips already on your phone.",
  },
  {
    number: "02",
    title: "Let Buzzly build",
    description: "Generate the script, voiceover, captions, pacing, and creative structure.",
  },
  {
    number: "03",
    title: "Review and publish",
    description: "Polish your edit, export it, or send it into your TikTok publishing flow.",
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      <img
        src="/buzzly-logo.png"
        alt=""
        className={`${compact ? "h-8 w-8" : "h-8 w-8 sm:h-10 sm:w-10"} shrink-0 object-contain drop-shadow-[0_0_1px_rgba(255,255,255,0.8)]`}
      />
      <span className={`${compact ? "text-lg" : "text-lg sm:text-xl"} whitespace-nowrap font-extrabold tracking-[-0.03em]`}>Buzzly</span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060b] text-white selection:bg-[#ffc800] selection:text-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[850px] bg-[radial-gradient(circle_at_58%_20%,rgba(111,45,189,0.28),transparent_38%),radial-gradient(circle_at_75%_55%,rgba(31,104,191,0.18),transparent_32%)]" />
      <div className="pointer-events-none absolute left-[-160px] top-[380px] h-96 w-96 rounded-full bg-blue-500/10 blur-[100px]" />

      <header className="relative z-30 border-b border-white/[0.07] bg-[#05060b]/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-8 lg:h-20">
          <Link href="/" aria-label="Buzzly home" className="min-w-0 shrink">
            <Brand />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex" aria-label="Main navigation">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#examples" className="transition hover:text-white">Examples</a>
            <a href="#contact" className="transition hover:text-white">Contact</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold transition hover:border-white/25 hover:bg-white/10"
              data-testid="button-header-sign-in"
            >
              Sign In
            </Link>
            <Link
              href="/login?mode=register"
              className="hidden rounded-full bg-[#ffc800] px-5 py-2.5 text-sm font-extrabold text-[#111217] shadow-lg shadow-yellow-500/10 transition hover:bg-[#ffd633] sm:inline-flex"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid lg:min-h-[690px] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14 lg:pb-20 lg:pt-14">
          <div className="relative z-10 text-center lg:text-left">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.08] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI-powered video creation
            </div>

            <h1 className="text-[42px] font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-[68px]">
              Make videos
              <span className="block">
                that{" "}
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent">
                  stop
                </span>
              </span>
              <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent">
                the scroll.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8 lg:mx-0 lg:max-w-lg">
              Turn product ideas and raw clips into ready-to-publish short videos—with AI scripts, voiceovers, captions, and a faster path to TikTok.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/login?mode=register"
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#ffc800] px-6 py-3.5 text-sm font-extrabold text-[#111217] shadow-xl shadow-yellow-500/10 transition hover:bg-[#ffd633] sm:w-auto"
                data-testid="button-hero-sign-in"
              >
                Start creating free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#how-it-works"
                className="group flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-slate-200 transition hover:text-white sm:w-auto"
              >
                See how it works
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#ffc800] text-[#ffc800]">
                  <Play className="h-2.5 w-2.5 fill-current" />
                </span>
              </a>
            </div>

            <div className="mt-9 flex flex-wrap justify-center gap-x-5 gap-y-3 text-xs text-slate-400 lg:justify-start">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> No credit card required</span>
              <span className="flex items-center gap-2"><Zap className="h-4 w-4" /> AI powered</span>
              <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Export in minutes</span>
            </div>
          </div>

          <div className="relative mx-auto mt-16 w-full max-w-2xl lg:mt-0">
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-blue-500/20 blur-3xl" />
            <div className="relative rounded-[28px] border border-white/15 bg-[#0c0f17]/95 p-3 shadow-2xl shadow-black/60">
              <div className="flex min-h-[500px] overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080a10]">
                <aside className="hidden w-14 flex-col items-center border-r border-white/[0.08] bg-white/[0.025] py-5 sm:flex">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                    <WandSparkles className="h-4 w-4" />
                  </div>
                  <div className="mt-6 flex flex-col gap-5 text-slate-500">
                    <ListVideo className="h-4 w-4" />
                    <BadgeCheck className="h-4 w-4" />
                    <Users className="h-4 w-4" />
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Buzzly Studio</span>
                  </div>

                  <div className="relative mt-5 flex flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_70%_80%,rgba(156,42,195,0.45),transparent_35%),linear-gradient(145deg,#24134a_0%,#1b102d_45%,#41203a_100%)] p-4 sm:p-6">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:24px_24px]" />
                    <div className="relative flex w-full flex-col justify-between rounded-xl border border-white/15 bg-black/10 p-5 sm:p-7">
                      <span className="w-fit rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-900">
                        New drop
                      </span>
                      <div>
                        <p className="max-w-sm text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                          Your next viral video starts here.
                        </p>
                        <div className="mt-5 flex items-center gap-2 text-xs font-medium text-white/80">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                            <Mic2 className="h-3.5 w-3.5" />
                          </span>
                          AI voiceover · Captions
                        </div>
                        <div className="mt-5 flex h-8 items-end gap-[2px] overflow-hidden">
                          {[8, 13, 18, 12, 25, 19, 30, 22, 16, 28, 18, 10, 15, 23, 12, 8, 17, 27, 20, 12, 7, 11].map((height, index) => (
                            <span
                              key={`${height}-${index}`}
                              className="flex-1 rounded-full bg-gradient-to-t from-violet-600 to-fuchsia-400"
                              style={{ height }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      ["Script ready", "text-emerald-400"],
                      ["Voice added", "text-violet-400"],
                      ["Captions on", "text-blue-400"],
                    ].map(([item, color]) => (
                      <div key={item} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.025] px-2 py-3 text-center">
                        <Check className={`h-3.5 w-3.5 ${color}`} />
                        <p className="text-[9px] font-medium text-slate-300 sm:text-[11px]">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-white/[0.07] bg-white/[0.018]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">One simple workflow</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-5xl">From idea to upload, faster.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-400">
              Keep the creative work moving without jumping between a pile of different tools.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, description, color, glow }, index) => (
                <article
                  key={title}
                  className="group min-h-[260px] rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.018] p-5 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.055] sm:p-6"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg ${glow}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="mt-6 text-xs font-bold text-violet-400/70">0{index + 1}</p>
                  <h3 className="mt-2 text-lg font-bold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffc800]">How it works</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-5xl">Create without slowing down.</h2>
              <p className="mt-5 max-w-lg leading-7 text-slate-400">
                Buzzly keeps the repetitive production work moving so you can stay focused on the idea, the product, and the audience.
              </p>
              <Link href="/login?mode=register" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#ffc800]">
                Build your first video <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-3">
              {workflow.map((step) => (
                <div key={step.number} className="grid grid-cols-[48px_1fr] gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:grid-cols-[64px_1fr] sm:p-6">
                  <span className="text-xl font-black text-white/20 sm:text-2xl">{step.number}</span>
                  <div>
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="examples" className="border-y border-white/[0.07] bg-white/[0.018]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">Built for short-form</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-5xl">One Studio. Every scroll.</h2>
            </div>
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
              {[
                { icon: Film, title: "Product demos", copy: "Show what it does without losing the viewer." },
                { icon: CirclePlay, title: "UGC-style videos", copy: "Build authentic-feeling creative at a faster pace." },
                { icon: Sparkles, title: "Promos and launches", copy: "Turn a new offer into a sharp, ready-to-post story." },
              ].map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-2xl border border-white/10 bg-[#0a0c13] p-6">
                  <Icon className="h-6 w-6 text-[#ffc800]" />
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.3),transparent_50%),linear-gradient(135deg,#160d2b,#0c0d18)] px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <Sparkles className="relative mx-auto h-8 w-8 text-violet-300" />
            <h2 className="relative mt-4 text-3xl font-black tracking-[-0.035em] sm:text-5xl">Ready to make some noise?</h2>
            <p className="relative mx-auto mt-4 max-w-xl leading-7 text-slate-300">
              Sign up to Buzzly and turn your next idea into a video built to be watched.
            </p>
            <Link
              href="/login?mode=register"
              className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-[#ffc800] px-7 py-3.5 text-sm font-extrabold text-[#111217] transition hover:bg-[#ffd633]"
              data-testid="button-cta-sign-in"
            >
              Sign up to Buzzly
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer id="contact" className="relative border-t border-white/[0.07] bg-[#04050a]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <div>
            <Brand compact />
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Make videos that stop the scroll.</p>
            <a href={`mailto:${supportEmail}`} className="mt-5 inline-flex text-sm font-medium text-slate-300 transition hover:text-white">
              {supportEmail}
            </a>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Product</p>
            <nav className="mt-4 grid gap-3 text-sm text-slate-400">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#how-it-works" className="hover:text-white">How it works</a>
              <a href="#examples" className="hover:text-white">Examples</a>
            </nav>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Legal</p>
            <nav className="mt-4 grid gap-3 text-sm text-slate-400">
              <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white">Terms of Service</Link>
              <Link href="/login" className="hover:text-white">Sign In</Link>
            </nav>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/[0.07] px-5 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Buzzly. All rights reserved.</span>
          <div className="flex items-center gap-5 text-slate-400">
            <SiTiktok className="h-4 w-4" aria-label="TikTok" />
            <SiYoutube className="h-4 w-4" aria-label="YouTube" />
            <SiX className="h-4 w-4" aria-label="X" />
            <SiInstagram className="h-4 w-4" aria-label="Instagram" />
          </div>
        </div>
      </footer>
    </div>
  );
}
