import { ClipboardList, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyPlanningLayer } from "@shared/models/timeline";

type CreativePlanPanelProps = {
  plan: BuzzlyPlanningLayer;
  onApplyPlan: () => void;
};

export function CreativePlanPanel({ plan, onApplyPlan }: CreativePlanPanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-sky-400/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-300 text-black">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Creative Plan</h2>
              <p className="text-xs text-slate-400">Plan before generation.</p>
            </div>
          </div>
          <Button size="sm" onClick={onApplyPlan} className="h-8 gap-2 bg-sky-300 px-3 font-semibold text-black hover:bg-sky-200">
            <WandSparkles className="h-3.5 w-3.5" />
            Apply
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-300">{plan.generationBrief}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {plan.beats.map((beat, index) => (
          <div key={beat.key} className="rounded-lg border border-white/10 bg-[#0b1018] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{index + 1}. {beat.label}</p>
              <span className="rounded bg-sky-300/15 px-2 py-1 text-[10px] font-semibold text-sky-200">{beat.duration}s</span>
            </div>
            <p className="text-sm leading-5 text-slate-200">{beat.line}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{beat.visualDirection}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
