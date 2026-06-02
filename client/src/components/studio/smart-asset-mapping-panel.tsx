import { BrainCircuit, CheckCircle2, Clapperboard, Image, Music2, ScanSearch, Sparkles, TriangleAlert, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyAssetCategory, BuzzlyAssetIntelligence } from "@shared/models/timeline";

type SmartAssetMappingPanelProps = {
  intelligence: BuzzlyAssetIntelligence;
  onScan: () => void;
};

const categoryLabels: Record<BuzzlyAssetCategory, string> = {
  "hook-shot": "Hook",
  "emotional-shot": "Emotion",
  "product-closeup": "Close-up",
  "face-clip": "Face",
  "movement-clip": "Movement",
  "aesthetic-shot": "Aesthetic",
  "demo-shot": "Proof",
  "before-after": "Before/After",
  "music-bed": "Music",
  voiceover: "Voiceover",
  packshot: "Packshot",
};

export function SmartAssetMappingPanel({ intelligence, onScan }: SmartAssetMappingPanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-400 text-black">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Smart Asset Mapping</h2>
              <p className="text-xs text-slate-400">Auto-tags every usable shot.</p>
            </div>
          </div>
          <Button size="sm" onClick={onScan} className="h-8 gap-2 bg-emerald-400 px-3 font-semibold text-black hover:bg-emerald-300">
            <ScanSearch className="h-3.5 w-3.5" />
            Scan
          </Button>
        </div>

        <p className="text-xs leading-5 text-slate-300">{intelligence.summary}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          <CoverageCard title="Ready" items={intelligence.coverage.ready} tone="ready" />
          <CoverageCard title="Missing" items={intelligence.coverage.missing} tone="missing" />
        </div>

        <div className="space-y-2">
          {intelligence.mappings.map((asset) => {
            const Icon = asset.mediaType === "audio" ? Music2 : asset.mediaType === "image" ? Image : asset.mediaType === "video" ? Video : Clapperboard;
            return (
              <div key={asset.assetId} className="rounded-lg border border-white/10 bg-[#0b1018] p-3">
                <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{asset.assetName}</p>
                    <p className="truncate text-[11px] text-slate-500">{asset.filename}</p>
                  </div>
                  <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${asset.strategyFit === "high" ? "bg-emerald-400/15 text-emerald-300" : asset.strategyFit === "medium" ? "bg-[#ffc400]/15 text-[#ffc400]" : "bg-white/10 text-slate-300"}`}>
                    {asset.strategyFit}
                  </span>
                </div>

                <div className="mb-2 flex flex-wrap gap-1.5">
                  {asset.categories.map((category) => (
                    <span key={category} className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-slate-300">
                      {categoryLabels[category]}
                    </span>
                  ))}
                </div>

                <div className="grid gap-2 text-xs leading-5 text-slate-400">
                  <p>{asset.bestUse}</p>
                  <p className="text-slate-500">
                    Confidence {Math.round(asset.confidence * 100)}% · {asset.detectedMoments.join(", ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CoverageCard({ title, items, tone }: { title: string; items: BuzzlyAssetCategory[]; tone: "ready" | "missing" }) {
  const Icon = tone === "ready" ? CheckCircle2 : TriangleAlert;
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${tone === "ready" ? "text-emerald-300" : "text-orange-300"}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? items.map((item) => (
          <span key={item} className="rounded bg-white/[0.06] px-2 py-1 text-[10px] text-slate-300">
            {categoryLabels[item]}
          </span>
        )) : (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Sparkles className="h-3 w-3" />
            None
          </span>
        )}
      </div>
    </div>
  );
}
