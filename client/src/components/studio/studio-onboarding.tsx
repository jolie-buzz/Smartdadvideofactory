import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  Clapperboard,
  GraduationCap,
  MessageCircle,
  Play,
  Repeat2,
  ShoppingBag,
  Sparkles,
  Star,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type StudioGoalId =
  | "tiktok-affiliate"
  | "product-demo"
  | "ugc-ad"
  | "testimonial-video"
  | "promo-sale"
  | "before-after"
  | "educational-reel";

export type StudioGoal = {
  id: StudioGoalId;
  title: string;
  description: string;
  setupHint: string;
  recommended?: boolean;
  icon: LucideIcon;
};

export const studioGoals: StudioGoal[] = [
  {
    id: "tiktok-affiliate",
    title: "TikTok Affiliate Video",
    description: "Turn your raw product clips into a ready-to-post selling video.",
    setupHint: "Best when the user already has product clips and wants a fast selling edit.",
    recommended: true,
    icon: ShoppingBag,
  },
  {
    id: "product-demo",
    title: "Product Demo",
    description: "Show what the product does, how it works, and why it matters.",
    setupHint: "Use this for feature walkthroughs, app demos, and proof-focused product videos.",
    icon: Clapperboard,
  },
  {
    id: "ugc-ad",
    title: "UGC Ad",
    description: "Build a creator-style ad with a hook, problem, proof, and CTA.",
    setupHint: "Good for casual creator voice, direct response ads, and social proof angles.",
    icon: UserRound,
  },
  {
    id: "testimonial-video",
    title: "Testimonial Video",
    description: "Turn customer clips or quotes into a trust-building video.",
    setupHint: "Use this when proof, credibility, and real customer words are the main asset.",
    icon: MessageCircle,
  },
  {
    id: "promo-sale",
    title: "Promo/Sale Video",
    description: "Create an urgent offer video for discounts, drops, bundles, or flash sales.",
    setupHint: "Best for clear offers, deadlines, price drops, and campaign announcements.",
    icon: BadgePercent,
  },
  {
    id: "before-after",
    title: "Before/After Video",
    description: "Frame the transformation so viewers understand the payoff fast.",
    setupHint: "Use this for cleaning, beauty, fitness, repair, home, and transformation content.",
    icon: Repeat2,
  },
  {
    id: "educational-reel",
    title: "Educational Reel",
    description: "Teach one useful idea and connect it to the product naturally.",
    setupHint: "Great for tips, explainers, how-to reels, and problem-aware audiences.",
    icon: GraduationCap,
  },
];

type StudioOnboardingProps = {
  onStart: (goal: StudioGoal) => void;
};

export function StudioOnboarding({ onStart }: StudioOnboardingProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<StudioGoalId>("tiktok-affiliate");
  const selectedGoal = useMemo(
    () => studioGoals.find((goal) => goal.id === selectedGoalId) || studioGoals[0],
    [selectedGoalId],
  );
  const SelectedIcon = selectedGoal.icon;

  return (
    <main className="min-h-screen overflow-y-auto bg-[#070a0f] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-5 pt-[calc(env(safe-area-inset-top)+22px)] sm:px-6 sm:pt-6 lg:px-8">
        <header className="flex min-h-12 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#ffc400] text-black shadow-[0_0_28px_rgba(255,196,0,0.32)]">
              <Play className="h-5 w-5 fill-black" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none tracking-tight">Buzzly</p>
              <p className="mt-1 text-xs text-slate-400">SmartDad Video Factory</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 sm:flex">
            <Sparkles className="h-4 w-4 text-[#ffc400]" />
            Studio setup starts here
          </div>
        </header>

        <section className="grid flex-1 items-center gap-5 py-6 lg:grid-cols-[minmax(340px,0.9fr)_minmax(520px,1.1fr)] lg:py-8">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-white/10 bg-[#101620] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#ffc400]/15 text-[#ffc400]">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Buzzly Studio</p>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What are you making today?</h1>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-300">
                Choose the video goal first. After this, Buzzly will take you to the setup where you add product details, clips, voice, and job settings.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#0c111a] p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Simple flow</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Pick goal, create setup, upload clips, generate job, review output. Studio becomes the main place, pero guided muna ang first step.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {studioGoals.map((goal) => {
                const Icon = goal.icon;
                const isSelected = goal.id === selectedGoal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setSelectedGoalId(goal.id)}
                    className={`group min-h-[118px] rounded-lg border p-4 text-left transition ${
                      isSelected
                        ? "border-[#ffc400] bg-[#ffc400]/10 shadow-[0_0_0_1px_rgba(255,196,0,0.25)]"
                        : "border-white/10 bg-[#101620]/85 hover:border-white/25 hover:bg-[#151d2a]"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className={`grid h-10 w-10 place-items-center rounded-md ${
                        isSelected ? "bg-[#ffc400] text-black" : "bg-white/[0.06] text-[#ffc400]"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {goal.recommended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                          <Star className="h-3 w-3 fill-emerald-300" />
                          Recommended
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-semibold text-white">{goal.title}</h2>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{goal.description}</p>
                  </button>
                );
              })}
            </div>

            <aside className="flex min-h-[360px] flex-col justify-between rounded-lg border border-white/10 bg-[#101620] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.26)]">
              <div>
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-[#ffc400] text-black">
                  <SelectedIcon className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Selected goal</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{selectedGoal.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{selectedGoal.description}</p>
                <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Setup guide</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{selectedGoal.setupHint}</p>
                </div>
              </div>
              <Button
                onClick={() => onStart(selectedGoal)}
                className="mt-6 h-11 w-full gap-2 bg-[#ffc400] font-semibold text-black hover:bg-[#ffd84a]"
              >
                Start with this
                <ArrowRight className="h-4 w-4" />
              </Button>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
