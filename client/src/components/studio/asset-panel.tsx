import { useMemo, useRef, useState } from "react";
import { ChevronDown, CloudUpload, Image, Music2, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyClipType, BuzzlySource, BuzzlyTimelineJson } from "@shared/models/timeline";

export type StudioLibraryAsset = {
  id: string;
  type: Extract<BuzzlyClipType, "video" | "image" | "audio">;
  name: string;
  filename: string;
  source: BuzzlySource;
  origin: "uploaded" | "free-music" | "timeline";
  description?: string;
};

type AssetPanelProps = {
  timeline: BuzzlyTimelineJson;
  libraryAssets?: StudioLibraryAsset[];
  compact?: boolean;
  onAssetSelect?: (id: string) => void;
  onUploadClick?: () => void;
  onFilesUpload?: (files: FileList) => void;
};

export function AssetPanel({ timeline, libraryAssets = [], compact = false, onAssetSelect, onUploadClick, onFilesUpload }: AssetPanelProps) {
  const [activeTab, setActiveTab] = useState("All");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assets = useMemo(() => {
    const timelineAssets: StudioLibraryAsset[] = timeline.tracks.flatMap((track) =>
      track.items
        .filter((item) => item.source && ["video", "image", "audio"].includes(item.type))
        .map((item) => ({
          id: item.id,
          type: item.type as Extract<BuzzlyClipType, "video" | "image" | "audio">,
          name: item.name,
          filename: item.source?.filename || "Generated asset",
          source: item.source!,
          origin: "timeline" as const,
        })),
    );
    const deduped = new Map<string, StudioLibraryAsset>();
    [...libraryAssets, ...timelineAssets].forEach((asset) => {
      deduped.set(`${asset.origin}:${asset.id}`, asset);
    });
    return Array.from(deduped.values());
  }, [libraryAssets, timeline]);
  const visibleAssets = assets.filter((asset) => {
    if (activeTab === "Videos") return asset.type === "video";
    if (activeTab === "Images") return asset.type === "image";
    if (activeTab === "Audio") return asset.type === "audio";
    return true;
  });
  const openFilePicker = () => {
    onUploadClick?.();
    fileInputRef.current?.click();
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Assets</h2>
          <Button size="icon" variant="outline" className="h-8 w-8 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white" title="Add asset" onClick={openFilePicker}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-7 text-sm">
          {["All", "Videos", "Images", "Audio"].map((tab, index) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-3 transition ${activeTab === tab ? "border-[#ffc400] text-[#ffc400]" : "border-transparent text-slate-400 hover:text-white"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <div className={`grid place-items-center rounded-xl border border-dashed border-white/15 bg-black/20 px-6 text-center ${compact ? "py-5" : "py-8"}`}>
          <CloudUpload className="mb-3 h-10 w-10 text-white" />
          <p className="font-medium text-white">Upload Files</p>
          <p className="mt-1 text-xs text-slate-400">or drag and drop</p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="video/*,image/*,audio/*"
            onChange={(event) => {
              if (event.target.files?.length) onFilesUpload?.(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <Button className="mt-4 gap-3 bg-[#ffc400] font-semibold text-black hover:bg-[#ffd84a]" onClick={openFilePicker}>
            Upload
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {visibleAssets.slice(0, compact ? 6 : 9).map((asset, index) => {
            const Icon = asset.type === "audio" ? Music2 : asset.type === "image" ? Image : Video;
            const duration = asset.type === "audio" ? "00:30" : `00:${String(5 + index).padStart(2, "0")}`;
            return (
              <button
                key={asset.id}
                type="button"
                className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-[#18202c] text-left shadow-lg"
                title={asset.filename}
                onClick={() => onAssetSelect?.(asset.id)}
              >
                <div
                  className="absolute inset-0 opacity-90 transition group-hover:scale-105"
                  style={{
                    background:
                      asset.type === "audio"
                        ? "linear-gradient(135deg, #154734, #286f4a 48%, #0b1b2b)"
                        : `radial-gradient(circle at ${30 + index * 7}% ${25 + index * 3}%, rgba(255,196,0,0.9), transparent 14%), linear-gradient(135deg, #29351f, #111722 44%, #05070a)`,
                  }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,0.72))]" />
                <Icon className="absolute left-2 top-2 h-4 w-4 text-white/80" />
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {duration}
                </span>
                <span className="absolute bottom-2 left-2 max-w-[68%] truncate text-[10px] font-medium text-white">
                  {asset.name}
                </span>
                {asset.origin !== "timeline" && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/80">
                    {asset.origin === "free-music" ? "Free" : "Asset"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
