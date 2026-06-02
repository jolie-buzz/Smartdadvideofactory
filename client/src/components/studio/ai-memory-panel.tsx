import { Brain, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyAiMemorySystem } from "@shared/models/timeline";

type AiMemoryPanelProps = {
  memory: BuzzlyAiMemorySystem;
  canApply: boolean;
  onApplyMemory: () => void;
  onLearnFromEdit: () => void;
};

export function AiMemoryPanel({ memory, canApply, onApplyMemory, onLearnFromEdit }: AiMemoryPanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-rose-300/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-rose-300 text-black">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Memory</h2>
              <p className="text-xs text-slate-400">{memory.profileName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onLearnFromEdit} className="h-8 border-white/10 bg-white/[0.03] px-3 text-xs text-white hover:bg-white/10">
              <History className="mr-1.5 h-3.5 w-3.5" />
              Learn
            </Button>
            <Button size="sm" onClick={onApplyMemory} disabled={!canApply} className="h-8 gap-2 bg-rose-300 px-3 font-semibold text-black hover:bg-rose-200 disabled:opacity-45">
              <Sparkles className="h-3.5 w-3.5" />
              Apply
            </Button>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-300">{memory.summary}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {memory.signals.map((signal) => (
          <div key={signal.key} className="rounded-lg border border-white/10 bg-[#0b1018] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{signal.label}</p>
              <span className="rounded bg-rose-300/15 px-2 py-1 text-[10px] font-semibold uppercase text-rose-100">
                {Math.round(signal.confidence * 100)}%
              </span>
            </div>
            <p className="text-xs leading-5 text-slate-300">{signal.value}</p>
            <p className="mt-2 text-[11px] capitalize text-slate-500">Source: {signal.source}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
