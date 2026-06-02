import { Brain, Film, Lightbulb, Package, Sparkles, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BuzzlyCreativeBrainInput, BuzzlyCreativeBrainOutput } from "@shared/models/timeline";

type CreativeBrainPanelProps = {
  input: BuzzlyCreativeBrainInput;
  output: BuzzlyCreativeBrainOutput;
  onInputChange: (patch: Partial<BuzzlyCreativeBrainInput>) => void;
  onGenerate: () => void;
};

const inputFields = [
  { key: "goal", label: "Goal", icon: Target },
  { key: "style", label: "Style", icon: Film },
  { key: "audience", label: "Audience", icon: Users },
  { key: "product", label: "Product", icon: Package },
] as const;

export function CreativeBrainPanel({ input, output, onInputChange, onGenerate }: CreativeBrainPanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#ffc400]/25 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-5">
        <div className="mb-1 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#ffc400] text-black">
            <Brain className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold text-white">Creative Brain</h2>
        </div>
        <p className="text-xs leading-5 text-slate-400">
          Creative Director first. The edit follows the strategy.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <div className="grid gap-3">
          {inputFields.map((field) => {
            const Icon = field.icon;
            return (
              <label key={field.key} className="space-y-1.5">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <Icon className="h-3.5 w-3.5 text-[#ffc400]" />
                  {field.label}
                </span>
                <Input
                  value={input[field.key]}
                  onChange={(event) => onInputChange({ [field.key]: event.target.value })}
                  className="border-white/10 bg-[#0b1018] text-sm text-white placeholder:text-slate-500 focus-visible:ring-[#ffc400]"
                />
              </label>
            );
          })}
        </div>

        <label className="space-y-1.5">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-[#ffc400]" />
            Persona
          </span>
          <Input
            value={input.persona}
            onChange={(event) => onInputChange({ persona: event.target.value })}
            className="border-white/10 bg-[#0b1018] text-sm text-white placeholder:text-slate-500 focus-visible:ring-[#ffc400]"
          />
        </label>

        <label className="space-y-1.5">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Lightbulb className="h-3.5 w-3.5 text-[#ffc400]" />
            User idea
          </span>
          <Textarea
            value={input.userIdea}
            onChange={(event) => onInputChange({ userIdea: event.target.value })}
            rows={3}
            className="resize-none border-white/10 bg-[#0b1018] text-sm text-white placeholder:text-slate-500 focus-visible:ring-[#ffc400]"
          />
        </label>

        <Button onClick={onGenerate} className="w-full gap-2 bg-[#ffc400] font-semibold text-black hover:bg-[#ffd84a]">
          <Brain className="h-4 w-4" />
          Generate Creative Direction
        </Button>

        <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Strategy</p>
            <p className="text-sm leading-6 text-slate-200">{output.contentStrategy}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Flow</p>
            <div className="space-y-2">
              {output.flow.map((step, index) => (
                <div key={`${step}-${index}`} className="grid grid-cols-[22px_1fr] gap-2 text-sm text-slate-300">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[11px] text-white">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Hook</p>
            <p className="text-sm leading-6 text-slate-300">{output.hookDirection}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Pacing</p>
            <p className="text-sm leading-6 text-slate-300">{output.pacing}</p>
          </div>
        </div>

        <div className="grid gap-3">
          <AssetChecklist title="Visuals Needed" items={output.visualsNeeded} />
          <AssetChecklist title="Missing Assets" items={output.missingAssets} muted />
        </div>
      </div>
    </section>
  );
}

function AssetChecklist({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b1018] p-4">
      <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${muted ? "text-orange-300" : "text-emerald-300"}`}>
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-md bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
