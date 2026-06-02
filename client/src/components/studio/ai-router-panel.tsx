import { Cpu, Image, Mic2, Route, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyGenerationModality, BuzzlyGenerationRoute, BuzzlyHybridGeneration } from "@shared/models/timeline";

type AiRouterPanelProps = {
  router: BuzzlyHybridGeneration;
  onRoute: () => void;
};

const modalityIcons: Record<BuzzlyGenerationModality, typeof Image> = {
  image: Image,
  video: Video,
  voice: Mic2,
};

const engineLabels: Record<BuzzlyGenerationRoute["selectedEngine"], string> = {
  chatgpt: "ChatGPT",
  "gpt-image": "GPT Image",
  flux: "Flux",
  "gemini-flow": "Gemini Flow",
  ideogram: "Ideogram",
  veo: "Veo",
  seedance: "Seedance",
  kling: "Kling",
  runway: "Runway",
  pika: "Pika",
  "grok-video": "Grok Video",
  elevenlabs: "ElevenLabs",
  "openai-voice": "OpenAI Voice",
};

export function AiRouterPanel({ router, onRoute }: AiRouterPanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-violet-400/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-violet-400 text-black">
              <Route className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Router</h2>
              <p className="text-xs text-slate-400">Best engine, automatically.</p>
            </div>
          </div>
          <Button size="sm" onClick={onRoute} className="h-8 gap-2 bg-violet-400 px-3 font-semibold text-black hover:bg-violet-300">
            <Cpu className="h-3.5 w-3.5" />
            Route
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-300">{router.routingGoal}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {router.routes.map((route) => {
          const Icon = modalityIcons[route.modality];
          return (
            <div key={route.modality} className="rounded-lg border border-white/10 bg-[#0b1018] p-3">
              <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <Icon className="h-4 w-4 text-violet-300" />
                <div>
                  <p className="text-sm font-semibold capitalize text-white">{route.modality}</p>
                  <p className="text-[11px] text-slate-500">Selected: {engineLabels[route.selectedEngine]}</p>
                </div>
                <span className="rounded bg-violet-400/15 px-2 py-1 text-[10px] font-semibold uppercase text-violet-200">
                  {route.status.replace("-", " ")}
                </span>
              </div>

              <p className="mb-2 text-xs leading-5 text-slate-300">{route.reason}</p>

              <div className="mb-2 flex flex-wrap gap-1.5">
                {route.decisionFactors.map((factor) => (
                  <span key={factor} className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-slate-300">
                    {factor}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div className="rounded bg-white/[0.04] px-2 py-1">Cost: {route.estimatedCost}</div>
                <div className="rounded bg-white/[0.04] px-2 py-1">Speed: {route.estimatedSpeed}</div>
              </div>
            </div>
          );
        })}

        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Provider Pool
          </div>
          <p className="text-xs leading-5 text-slate-400">
            Image: {router.providerPool.image.map((engine) => engineLabels[engine]).join(", ")} · Video: {router.providerPool.video.map((engine) => engineLabels[engine]).join(", ")} · Voice: {router.providerPool.voice.map((engine) => engineLabels[engine]).join(", ")}
          </p>
        </div>
      </div>
    </section>
  );
}
