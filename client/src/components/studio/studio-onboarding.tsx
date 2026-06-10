import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgePercent,
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

  return (
    <main className="min-h-screen overflow-y-auto bg-[#070a0f] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-6 pt-[calc(env(safe-area-inset-top)+22px)] sm:px-6 sm:pt-6 lg:px-8">
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

        <section className="flex flex-1 flex-col items-center justify-center gap-5 py-8 text-center">
          <div className="mx-auto max-w-2xl">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#ffc400]/15 text-[#ffc400]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Buzzly Studio</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">What are you making today?</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Choose a video goal first. Buzzly will open the guided setup after this.
            </p>
          </div>

          <div className="flex w-full max-w-3xl flex-wrap justify-center gap-2">
            {studioGoals.map((goal) => {
              const Icon = goal.icon;
              const isSelected = goal.id === selectedGoal.id;
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoalId(goal.id)}
                  className={`group relative flex min-h-[92px] w-[calc(50%-0.25rem)] flex-col items-center justify-center rounded-lg border px-3 py-3 text-center transition sm:w-[150px] ${
                    isSelected
                      ? "border-[#ffc400] bg-[#ffc400]/10 shadow-[0_0_0_1px_rgba(255,196,0,0.22)]"
                      : "border-white/10 bg-[#101620]/80 hover:border-white/25 hover:bg-[#151d2a]"
                  }`}
                >
                  {goal.recommended && (
                    <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-emerald-400/12 text-emerald-300" title="Recommended">
                      <Star className="h-3 w-3 fill-emerald-300" />
                    </span>
                  )}
                  <div className={`grid h-9 w-9 place-items-center rounded-md ${
                    isSelected ? "bg-[#ffc400] text-black" : "bg-white/[0.06] text-[#ffc400]"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="mt-2 max-w-[8.5rem] text-xs font-semibold leading-4 text-white">{goal.title}</h2>
                </button>
              );
            })}
          </div>

          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            <p className="min-h-5 text-xs leading-5 text-slate-400">{selectedGoal.description}</p>
            <Button
              onClick={() => onStart(selectedGoal)}
              className="h-11 w-full gap-2 bg-[#ffc400] font-semibold text-black hover:bg-[#ffd84a]"
            >
              Start with this
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
