import { Gauge, Rocket, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyRenderingArchitecture } from "@shared/models/timeline";

type RenderingArchitecturePanelProps = {
  architecture: BuzzlyRenderingArchitecture;
  onOptimize: () => void;
  onFastExport: () => void;
};

const statusStyles = {
  fast: "bg-emerald-400/15 text-emerald-300",
  watch: "bg-[#ffc400]/15 text-[#ffc400]",
  "too-heavy": "bg-rose-400/15 text-rose-300",
};

export function RenderingArchitecturePanel({ architecture, onOptimize, onFastExport }: RenderingArchitecturePanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-orange-300/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-orange-300 text-black">
              <Rocket className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Speed Render Engine</h2>
              <p className="text-xs text-slate-400">Rendering Architecture</p>
            </div>
          </div>
          <Button size="sm" onClick={onOptimize} className="h-8 gap-2 bg-orange-300 px-3 font-semibold text-black hover:bg-orange-200">
            <Zap className="h-3.5 w-3.5" />
            Optimize
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-300">{architecture.benchmark}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-[92px_1fr] items-center gap-4 rounded-lg border border-white/10 bg-[#0b1018] p-3">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-orange-300/35 bg-orange-300/10 text-center">
            <div>
              <p className="text-2xl font-black leading-none text-orange-200">{architecture.currentEstimate.speedScore}</p>
              <p className="text-[10px] font-semibold uppercase text-orange-100/70">speed</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-200">Export Estimate</p>
              <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${statusStyles[architecture.currentEstimate.status]}`}>
                {architecture.currentEstimate.status.replace("-", " ")}
              </span>
            </div>
            <p className="text-sm text-white">
              {architecture.currentEstimate.estimatedExportSeconds}s export for {architecture.currentEstimate.duration}s video
            </p>
            <p className="text-xs text-slate-500">
              Target: under {architecture.targetExportSeconds}s for {architecture.maxRecommendedDuration}s
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
          <RenderStat icon={Gauge} label="Resolution" value={`${architecture.targetResolution.width}x${architecture.targetResolution.height}`} />
          <RenderStat icon={Timer} label="Max duration" value={`${architecture.maxRecommendedDuration}s`} />
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-200">Lightweight Effects Only</p>
          <div className="flex flex-wrap gap-1.5">
            {architecture.effectPolicy.allowed.map((effect) => (
              <span key={effect} className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
                {effect}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-200">Avoid</p>
          <div className="flex flex-wrap gap-1.5">
            {architecture.effectPolicy.avoid.map((effect) => (
              <span key={effect} className="rounded-full bg-rose-400/10 px-2 py-1 text-[10px] font-medium text-rose-200">
                {effect}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-200">Pipeline</p>
          <div className="space-y-1.5">
            {architecture.pipeline.map((step, index) => (
              <div key={step} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="grid h-5 w-5 place-items-center rounded bg-orange-300/15 text-[10px] font-bold text-orange-100">{index + 1}</span>
                {step.replace("-", " ")}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={onFastExport} className="h-10 w-full gap-2 bg-[#ffc400] font-semibold text-black hover:bg-[#ffd84a]">
          <Rocket className="h-4 w-4" />
          Fast Export
        </Button>
      </div>
    </section>
  );
}

function RenderStat({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded bg-white/[0.04] px-2 py-2">
      <div className="mb-1 flex items-center gap-1 text-orange-200">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}
