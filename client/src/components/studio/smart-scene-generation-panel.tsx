import { Clapperboard, Film, Image, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyGenerationEngine, BuzzlySmartSceneGeneration, BuzzlySmartSceneType } from "@shared/models/timeline";

type SmartSceneGenerationPanelProps = {
  generation: BuzzlySmartSceneGeneration;
  onGenerateScenes: () => void;
};

const sceneTypeLabels: Record<BuzzlySmartSceneType, string> = {
  "cinematic-closeup": "Cinematic closeup",
  "lifestyle-shot": "Lifestyle",
  "motion-scene": "Motion",
  "ai-broll": "AI B-roll",
  "background-animation": "Background",
};

const engineLabels: Record<BuzzlyGenerationEngine, string> = {
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

export function SmartSceneGenerationPanel({ generation, onGenerateScenes }: SmartSceneGenerationPanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-cyan-300/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300 text-black">
              <WandSparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Smart Scene Generation</h2>
              <p className="text-xs text-slate-400">Auto-build missing scenes.</p>
            </div>
          </div>
          <Button size="sm" onClick={onGenerateScenes} className="h-8 gap-2 bg-cyan-300 px-3 font-semibold text-black hover:bg-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-300">{generation.summary}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div className="rounded bg-white/[0.04] px-2 py-1">Input assets: {generation.inputAssetCount}</div>
          <div className="rounded bg-white/[0.04] px-2 py-1">Scenes: {generation.suggestions.length}</div>
        </div>

        {generation.suggestions.map((scene) => {
          const Icon = scene.type === "cinematic-closeup" ? Image : scene.type === "background-animation" ? Film : Clapperboard;
          return (
            <div key={scene.id} className="rounded-lg border border-white/10 bg-[#0b1018] p-3">
              <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <Icon className="h-4 w-4 text-cyan-200" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{scene.title}</p>
                  <p className="text-[11px] text-slate-500">{sceneTypeLabels[scene.type]} · {scene.duration}s</p>
                </div>
                <span className="rounded bg-cyan-300/15 px-2 py-1 text-[10px] font-semibold uppercase text-cyan-100">
                  {scene.status.replace("-", " ")}
                </span>
              </div>
              <p className="mb-2 text-xs leading-5 text-slate-300">{scene.prompt}</p>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-medium">
                <span className="rounded-full bg-white/[0.06] px-2 py-1 text-slate-300">Fills: {scene.fillsGap.replace("-", " ")}</span>
                <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-100">Engine: {engineLabels[scene.recommendedEngine]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
