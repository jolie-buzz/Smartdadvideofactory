import { BadgeCheck, Fingerprint, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyStyleDnaPreset, BuzzlyStyleDnaSystem } from "@shared/models/timeline";

type StyleDnaPanelProps = {
  system: BuzzlyStyleDnaSystem;
  canManage: boolean;
  canApply: boolean;
  onApplyStyle: (preset: BuzzlyStyleDnaPreset) => void;
  onCreateStyle: () => void;
};

export function StyleDnaPanel({ system, canManage, canApply, onApplyStyle, onCreateStyle }: StyleDnaPanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-fuchsia-300/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-fuchsia-300 text-black">
              <Fingerprint className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Style DNA</h2>
              <p className="text-xs text-slate-400">Brand presets, instantly applied.</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onCreateStyle}
            disabled={!canManage}
            className="h-8 gap-2 bg-fuchsia-300 px-3 font-semibold text-black hover:bg-fuchsia-200 disabled:opacity-45"
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-300">
          Admins create reusable Brand DNA. Teams apply a style to pacing, hooks, captions, and CTA behavior.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {system.presets.map((preset) => {
          const isActive = preset.id === system.activePresetId;
          return (
            <div key={preset.id} className={`rounded-lg border p-3 ${isActive ? "border-fuchsia-300/40 bg-fuchsia-300/10" : "border-white/10 bg-[#0b1018]"}`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{preset.name}</p>
                    {isActive && <BadgeCheck className="h-4 w-4 shrink-0 text-fuchsia-200" />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{preset.description}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onApplyStyle(preset)}
                  disabled={!canApply}
                  className="h-8 shrink-0 gap-1 bg-[#ffc400] px-3 text-xs font-semibold text-black hover:bg-[#ffd84a] disabled:opacity-45"
                >
                  <Sparkles className="h-3 w-3" />
                  Apply
                </Button>
              </div>

              <div className="mb-2 flex flex-wrap gap-1.5">
                {preset.traits.map((trait) => (
                  <span key={trait} className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-slate-300">
                    {trait.replace("-", " ")}
                  </span>
                ))}
              </div>

              <div className="grid gap-1 text-[11px] leading-4 text-slate-500">
                <p>Pacing: {preset.pacing}</p>
                <p>CTA: {preset.ctaStyle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
