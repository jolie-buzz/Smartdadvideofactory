import { CheckCircle2, GitBranch, PlayCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyAiPipeline, BuzzlyAiPipelineStep } from "@shared/models/timeline";

type AiPipelinePanelProps = {
  pipeline: BuzzlyAiPipeline;
  onRunPipeline: () => void;
};

const statusStyles: Record<BuzzlyAiPipelineStep["status"], string> = {
  done: "bg-emerald-400/15 text-emerald-300",
  running: "bg-blue-300/15 text-blue-200",
  ready: "bg-white/[0.06] text-slate-300",
  "needs-input": "bg-[#ffc400]/15 text-[#ffc400]",
};

export function AiPipelinePanel({ pipeline, onRunPipeline }: AiPipelinePanelProps) {
  const doneCount = pipeline.steps.filter((step) => step.status === "done").length;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-indigo-300/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-indigo-300 text-black">
              <GitBranch className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Pipeline</h2>
              <p className="text-xs text-slate-400">Idea to render workflow.</p>
            </div>
          </div>
          <Button size="sm" onClick={onRunPipeline} className="h-8 gap-2 bg-indigo-300 px-3 font-semibold text-black hover:bg-indigo-200">
            <PlayCircle className="h-3.5 w-3.5" />
            Run
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-300">{pipeline.summary}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-indigo-300" style={{ width: `${(doneCount / pipeline.steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {pipeline.steps.map((step, index) => (
          <div key={step.key} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-lg border border-white/10 bg-[#0b1018] p-3">
            <div className="grid h-7 w-7 place-items-center rounded bg-indigo-300/15 text-xs font-bold text-indigo-100">
              {step.status === "done" ? <CheckCircle2 className="h-4 w-4" /> : step.status === "running" ? <RotateCw className="h-4 w-4" /> : index + 1}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{step.description}</p>
              <p className="mt-1 text-[11px] text-slate-500">{step.ownerLayer}</p>
            </div>
            <span className={`h-fit rounded px-2 py-1 text-[10px] font-semibold uppercase ${statusStyles[step.status]}`}>
              {step.status.replace("-", " ")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
