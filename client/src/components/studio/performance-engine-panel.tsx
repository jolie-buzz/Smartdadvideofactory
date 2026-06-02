import { Activity, Gauge, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyPerformanceEngine, BuzzlyPerformanceSuggestion } from "@shared/models/timeline";

type PerformanceEnginePanelProps = {
  engine: BuzzlyPerformanceEngine;
  onAnalyze: () => void;
  onApplySuggestion: (suggestion: BuzzlyPerformanceSuggestion) => void;
};

const statusStyles = {
  strong: "bg-emerald-400/15 text-emerald-300",
  watch: "bg-[#ffc400]/15 text-[#ffc400]",
  fix: "bg-rose-400/15 text-rose-300",
};

export function PerformanceEnginePanel({ engine, onAnalyze, onApplySuggestion }: PerformanceEnginePanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-emerald-300/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-300 text-black">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Creative Analyst</h2>
              <p className="text-xs text-slate-400">Performance Engine</p>
            </div>
          </div>
          <Button size="sm" onClick={onAnalyze} className="h-8 gap-2 bg-emerald-300 px-3 font-semibold text-black hover:bg-emerald-200">
            <Activity className="h-3.5 w-3.5" />
            Analyze
          </Button>
        </div>

        <div className="grid grid-cols-[92px_1fr] items-center gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-emerald-300/35 bg-emerald-300/10 text-center">
            <div>
              <p className="text-2xl font-black leading-none text-emerald-200">{engine.viralPotentialScore}</p>
              <p className="text-[10px] font-semibold uppercase text-emerald-100/70">/100</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Viral Potential Score</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">{engine.summary}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid gap-2">
          {engine.metrics.map((metric) => (
            <div key={metric.key} className="rounded-lg border border-white/10 bg-[#0b1018] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{metric.label}</p>
                <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${statusStyles[metric.status]}`}>{metric.status}</span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-300" style={{ width: `${metric.score}%` }} />
              </div>
              <p className="text-xs leading-5 text-slate-400">{metric.insight}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-200">
            <TrendingUp className="h-3.5 w-3.5" />
            Suggestions
          </div>
          {engine.suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onApplySuggestion(suggestion)}
              className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-emerald-300/50 hover:bg-white/[0.05]"
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{suggestion.title}</p>
                <span className="rounded bg-emerald-300/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">+{suggestion.impact}</span>
              </div>
              <p className="text-xs leading-5 text-slate-400">{suggestion.reason}</p>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#ffc400]">
                <Sparkles className="h-3 w-3" />
                Apply fix
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
