import {
  Captions,
  Copy,
  Crop,
  Eye,
  Image,
  Lock,
  Loader2,
  Maximize2,
  MoveLeft,
  MoveRight,
  Music2,
  Plus,
  RotateCcw,
  Scissors,
  Shrink,
  Sparkles,
  Trash2,
  Type,
  Video,
  Volume2,
  WandSparkles,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { BuzzlyClipType, BuzzlyTimelineItem, BuzzlyTimelineJson } from "@shared/models/timeline";

export type TimelineToolAction =
  | "split"
  | "duplicate"
  | "delete"
  | "zoom-in"
  | "zoom-out"
  | "zoom-in-motion"
  | "zoom-out-motion"
  | "fit"
  | "fade"
  | "speed"
  | "enhance"
  | "cut-dead-air"
  | "effect-punch"
  | "effect-vivid"
  | "effect-warm"
  | "effect-cool"
  | "effect-cinematic"
  | "effect-mono"
  | "effect-dream"
  | "volume"
  | "reset";

export type TimelineTransitionPreset = "none" | "fade" | "slide" | "zoom";

type TimelinePanelProps = {
  timeline: BuzzlyTimelineJson;
  currentTime: number;
  selectedItemId: string | null;
  selectedItemIds?: string[];
  onSelectItem: (id: string) => void;
  onToggleItemSelection?: (id: string) => void;
  onUpdateItem: (id: string, patch: Partial<BuzzlyTimelineItem>) => void;
  onSeek: (time: number) => void;
  onToolAction: (tool: TimelineToolAction) => void;
  onTrackUpload?: (type: Extract<BuzzlyClipType, "video" | "image" | "audio">) => void;
  onMoveItem: (id: string, startTime: number, ripple?: boolean) => void;
  onTrimItem: (id: string, patch: Partial<BuzzlyTimelineItem>) => void;
  onApplyTransition: (leftId: string, rightId: string, preset: TimelineTransitionPreset) => void;
  onGenerateAiTransition: (leftId: string, rightId: string, prompt: string, seconds: number) => Promise<void>;
};

const iconByType: Record<BuzzlyClipType, typeof Video> = {
  video: Video,
  image: Image,
  audio: Music2,
  text: Type,
  caption: Captions,
};

const colorByType: Record<BuzzlyClipType, string> = {
  video: "from-[#5f4b00] to-[#181a0c] border-[#ffc400]",
  image: "from-[#5f4b00] to-[#181a0c] border-[#ffc400]",
  audio: "from-[#0d5b37] to-[#123925] border-[#2dcf76]",
  text: "from-[#4f3197] to-[#2f1f66] border-[#7354d6]",
  caption: "from-[#815f10] to-[#5c4010] border-[#b9851a]",
};

const formatSeconds = (seconds: number) => `${Math.round(seconds)}s`;
const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const SNAP_THRESHOLD_SECONDS = 0.35;
const MAX_VIDEO_THUMBNAILS = 60;
const LEFT_COLUMN_WIDTH = 148;
const DEFAULT_PIXELS_PER_SECOND = 75;
const MIN_PIXELS_PER_SECOND = 20;
const MAX_PIXELS_PER_SECOND = 300;
type TimelineThumbnail = {
  time: number;
  url: string;
};

type CachedThumbnailEntry = {
  signature: string;
  thumbnails: TimelineThumbnail[];
};

const cachedThumbnails = new Map<string, CachedThumbnailEntry>();

const waitForVideoEvent = (video: HTMLVideoElement, eventName: "loadedmetadata" | "seeked") =>
  new Promise<void>((resolve, reject) => {
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`Video ${eventName} failed`));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, handleSuccess);
      video.removeEventListener("error", handleError);
    };
    video.addEventListener(eventName, handleSuccess, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });

function TimelineVideoFilmstrip({ item }: { item: BuzzlyTimelineItem }) {
  const cacheSignature = `${item.source?.uri || ""}|${item.trimStart}|${item.trimEnd}|${item.duration}`;
  const [thumbnails, setThumbnails] = useState<TimelineThumbnail[]>(() => {
    const cached = cachedThumbnails.get(item.id);
    return cached?.signature === cacheSignature ? cached.thumbnails : [];
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!item.source?.uri) return;
    let cancelled = false;

    const cached = cachedThumbnails.get(item.id);
    if (cached?.signature === cacheSignature) {
      setThumbnails(cached.thumbnails);
      setFailed(false);
      return;
    }

    setFailed(false);

    const generateFrames = async () => {
      const video = document.createElement("video");
      video.src = item.source?.uri || "";
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";

      if (video.readyState < 1) await waitForVideoEvent(video, "loadedmetadata");
      if (cancelled) return;

      const canvas = document.createElement("canvas");
      const sourceWidth = video.videoWidth || 160;
      const sourceHeight = video.videoHeight || 90;
      const scale = Math.min(1, 180 / sourceWidth);
      canvas.width = Math.max(96, Math.round(sourceWidth * scale));
      canvas.height = Math.max(54, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");

      const start = clampNumber(item.trimStart, 0, Math.max(0, video.duration || item.trimEnd));
      const usableDuration = Math.max(0.1, item.duration);
      const generationInterval = item.duration > MAX_VIDEO_THUMBNAILS ? item.duration / MAX_VIDEO_THUMBNAILS : 1;
      const frameCount = clampNumber(Math.ceil(item.duration / generationInterval), 2, MAX_VIDEO_THUMBNAILS);
      const nextThumbnails: TimelineThumbnail[] = [];

      for (let index = 0; index < frameCount; index += 1) {
        if (cancelled) return;
        const maxSampleTime = Math.max(0.04, Math.min(video.duration || item.trimEnd, start + usableDuration) - 0.05);
        const localTime = Math.min(index * generationInterval, item.duration);
        const sampleTime = clampNumber(start + localTime, 0.04, maxSampleTime);
        const seekPromise = Math.abs(video.currentTime - sampleTime) > 0.02 ? waitForVideoEvent(video, "seeked") : Promise.resolve();
        video.currentTime = sampleTime;
        await seekPromise;
        if (cancelled) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        nextThumbnails.push({
          time: localTime,
          url: canvas.toDataURL("image/jpeg", 0.64),
        });
      }

      cachedThumbnails.set(item.id, { signature: cacheSignature, thumbnails: nextThumbnails });
      while (cachedThumbnails.size > 24) {
        const oldestKey = cachedThumbnails.keys().next().value;
        if (!oldestKey) break;
        cachedThumbnails.delete(oldestKey);
      }
      if (!cancelled) setThumbnails(nextThumbnails);
    };

    generateFrames().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheSignature, item.duration, item.id, item.source?.uri, item.trimEnd, item.trimStart]);

  if (failed) {
    return (
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.28)_0_10px,rgba(0,0,0,0.2)_10px_20px)] opacity-60" />
    );
  }

  if (thumbnails.length === 0) {
    return (
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,196,0,0.22),rgba(255,255,255,0.16),rgba(255,196,0,0.22))]" />
    );
  }

  return (
    <div className="absolute inset-0 grid gap-0" style={{ gridTemplateColumns: `repeat(${thumbnails.length}, minmax(0, 1fr))` }}>
      {thumbnails.map((thumbnail, index) => (
        <img
          key={`${item.id}-frame-${index}-${thumbnail.time}`}
          src={thumbnail.url}
          alt=""
          className="h-full w-full border-0 object-cover opacity-90"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function TimelineClipPreview({ item }: { item: BuzzlyTimelineItem }) {
  if (!item.source?.uri || (item.type !== "video" && item.type !== "image")) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {item.type === "image" ? (
        <img src={item.source.uri} alt="" className="h-full w-full object-cover opacity-65" aria-hidden="true" />
      ) : (
        <TimelineVideoFilmstrip item={item} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-black/55" />
      {item.type === "video" && (
        <div className="absolute inset-x-3 bottom-2 h-2 rounded bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.42)_0_8px,rgba(0,0,0,0.18)_8px_16px)] opacity-70" />
      )}
    </div>
  );
}

export function TimelinePanel({ timeline, currentTime, selectedItemId, selectedItemIds = [], onSelectItem, onToggleItemSelection, onUpdateItem, onSeek, onToolAction, onTrackUpload, onMoveItem, onTrimItem, onApplyTransition, onGenerateAiTransition }: TimelinePanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND);
  const [visibleTrackWidth, setVisibleTrackWidth] = useState(1080);
  const [isMobileTimeline, setIsMobileTimeline] = useState(false);
  const [transitionPair, setTransitionPair] = useState<{ leftId: string; rightId: string; x: number; y: number } | null>(null);
  const [aiPrompt, setAiPrompt] = useState("smooth product swipe transition, fast social ad style");
  const [aiSeconds, setAiSeconds] = useState(4);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState("");
  const [aiError, setAiError] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"scale" | "tools" | null>(null);
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const updateVisibleWidth = () => {
      const mobile = window.innerWidth < 768;
      const leftWidth = mobile ? 56 : LEFT_COLUMN_WIDTH;
      setIsMobileTimeline(mobile);
      setVisibleTrackWidth(Math.max(320, scrollArea.clientWidth - leftWidth));
    };
    updateVisibleWidth();

    const resizeObserver = new ResizeObserver(updateVisibleWidth);
    resizeObserver.observe(scrollArea);
    return () => resizeObserver.disconnect();
  }, []);

  const fitPixelsPerSecond = clampNumber(visibleTrackWidth / Math.max(1, timeline.project.duration), MIN_PIXELS_PER_SECOND, MAX_PIXELS_PER_SECOND);
  const timelineWidth = Math.max(visibleTrackWidth, timeline.project.duration * pixelsPerSecond);
  const effectivePixelsPerSecond = timelineWidth / Math.max(1, timeline.project.duration);
  const leftColumnWidth = isMobileTimeline ? 56 : LEFT_COLUMN_WIDTH;
  const playheadLeft = leftColumnWidth + clampNumber(currentTime * effectivePixelsPerSecond, 0, timelineWidth);

  useEffect(() => {
    setPixelsPerSecond((value) => Math.max(value, fitPixelsPerSecond));
  }, [fitPixelsPerSecond]);
  const markerStep = timeline.project.duration > 60 ? 10 : 5;
  const markers = Array.from(
    { length: Math.floor(timeline.project.duration / markerStep) + 1 },
    (_, index) => index * markerStep,
  ).filter((time) => time <= timeline.project.duration);
  if (!markers.includes(timeline.project.duration)) markers.push(timeline.project.duration);
  const selectedItem = timeline.tracks.flatMap((track) => track.items).find((item) => item.id === selectedItemId) || null;
  const selectedVisual = selectedItem && (selectedItem.type === "video" || selectedItem.type === "image") ? selectedItem : null;
  const pickerLeft = transitionPair && typeof window !== "undefined" ? Math.min(Math.max(12, transitionPair.x + 12), window.innerWidth - 340) : 12;
  const pickerTop = transitionPair && typeof window !== "undefined" ? Math.min(Math.max(12, transitionPair.y + 12), window.innerHeight - 460) : 80;

  return (
    <section className="relative flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)] max-md:rounded-none max-md:border-x-0 max-md:border-b-0">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0d131c] px-4 py-3 max-md:hidden">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { label: "Split", icon: Scissors, action: "split" as const },
            { label: "Duplicate", icon: Copy, action: "duplicate" as const },
            { label: "Delete", icon: Trash2, action: "delete" as const },
            { label: "Zoom In", icon: ZoomIn, action: "zoom-in-motion" as const },
            { label: "Zoom Out", icon: ZoomOut, action: "zoom-out-motion" as const },
            { label: "Fit", icon: Maximize2, action: "fit" as const },
            { label: "Fade", icon: Sparkles, action: "fade" as const },
            { label: selectedItem?.playbackRate && selectedItem.playbackRate !== 1 ? `Speed ${selectedItem.playbackRate}x` : "Speed", icon: Zap, action: "speed" as const },
            { label: "Cut Dead Air", icon: Scissors, action: "cut-dead-air" as const },
            { label: "Enhance", icon: WandSparkles, action: "enhance" as const },
            { label: "Reset", icon: RotateCcw, action: "reset" as const },
          ].map((tool) => {
            const Icon = tool.icon;
            const activeTool = tool.action === "speed" && !!selectedItem?.playbackRate && selectedItem.playbackRate !== 1;
            return (
              <Button
                key={tool.label}
                variant="ghost"
                className={`h-8 gap-2 px-3 text-xs hover:bg-white/10 hover:text-white ${
                  activeTool ? "bg-[#ffc400]/15 text-[#ffc400]" : "text-slate-300"
                }`}
                onClick={() => onToolAction(tool.action)}
              >
                <Icon className="h-4 w-4" />
                {tool.label}
              </Button>
            );
          })}
          {selectedItem && (selectedItem.type === "video" || selectedItem.type === "audio") && (
            <div className="ml-1 flex h-8 min-w-[180px] items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-slate-300">
              <Volume2 className="h-4 w-4 shrink-0" />
              <Slider
                value={[clampNumber(selectedItem.volume, 0, 1)]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={([volume]) => onUpdateItem(selectedItem.id, { volume })}
                className="w-24"
              />
              <span className="w-9 text-right text-xs text-slate-300">{Math.round(selectedItem.volume * 100)}%</span>
            </div>
          )}
          {selectedVisual && (
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-white/10 bg-black/20 p-1">
              {[
                { label: "Punch", action: "effect-punch" as const },
                { label: "Vivid", action: "effect-vivid" as const },
                { label: "Warm", action: "effect-warm" as const },
                { label: "Cool", action: "effect-cool" as const },
                { label: "Cinema", action: "effect-cinematic" as const },
                { label: "Mono", action: "effect-mono" as const },
                { label: "Dream", action: "effect-dream" as const },
              ].map((effect) => {
                const active = selectedVisual.effectPreset === effect.action.replace("effect-", "");
                return (
                  <Button
                    key={effect.action}
                    variant="ghost"
                    className={`h-7 shrink-0 px-2 text-[11px] hover:bg-white/10 hover:text-white ${
                      active ? "bg-[#ffc400]/15 text-[#ffc400]" : "text-slate-300"
                    }`}
                    onClick={() => onToolAction(effect.action)}
                  >
                    {effect.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        <div className="mx-2 flex min-w-[220px] items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-[11px] font-medium text-slate-400">Scale</span>
          <Slider
            value={[pixelsPerSecond]}
            min={MIN_PIXELS_PER_SECOND}
            max={MAX_PIXELS_PER_SECOND}
            step={1}
            onValueChange={([value]) => setPixelsPerSecond(value)}
            className="w-32"
          />
          <span className="w-14 text-right text-[11px] font-medium text-[#ffc400]">{Math.round(effectivePixelsPerSecond)}px/s</span>
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={() => setPixelsPerSecond(fitPixelsPerSecond)}
          >
            Fit
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {selectedItem && (
            <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1 md:flex">
              <Button
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const startTime = clampNumber(selectedItem.startTime - 0.5, 0, timeline.project.duration - selectedItem.duration);
                  onUpdateItem(selectedItem.id, { startTime });
                  onSeek(startTime);
                }}
              >
                <MoveLeft className="h-3.5 w-3.5" />
                Nudge
              </Button>
              <Button
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const duration = clampNumber(selectedItem.duration - 0.5, 0.5, timeline.project.duration - selectedItem.startTime);
                  onUpdateItem(selectedItem.id, { duration, trimEnd: selectedItem.trimStart + duration });
                }}
              >
                <Shrink className="h-3.5 w-3.5" />
                Trim
              </Button>
              <Button
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const startTime = clampNumber(selectedItem.startTime + 0.5, 0, timeline.project.duration - selectedItem.duration);
                  onUpdateItem(selectedItem.id, { startTime });
                  onSeek(startTime);
                }}
              >
                <MoveRight className="h-3.5 w-3.5" />
                Nudge
              </Button>
              <Button
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const trimStart = clampNumber(selectedItem.trimStart + 0.25, 0, Math.max(0, selectedItem.trimEnd - 0.5));
                  const duration = Math.max(0.5, selectedItem.trimEnd - trimStart);
                  onUpdateItem(selectedItem.id, { trimStart, duration });
                }}
              >
                <Crop className="h-3.5 w-3.5" />
                Start
              </Button>
              <Button
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const trimEnd = clampNumber(selectedItem.trimEnd - 0.25, selectedItem.trimStart + 0.5, selectedItem.trimEnd);
                  const duration = Math.max(0.5, trimEnd - selectedItem.trimStart);
                  onUpdateItem(selectedItem.id, { trimEnd, duration });
                }}
              >
                <Crop className="h-3.5 w-3.5" />
                End
              </Button>
            </div>
          )}
          <div className="text-xs text-slate-400">Duration: <span className="text-white">{formatSeconds(timeline.project.duration)}</span></div>
        </div>
      </div>

      <div className="hidden shrink-0 border-b border-white/10 bg-[#0b1018] max-md:block">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            className={`min-h-10 flex-1 rounded-xl border px-3 text-left text-xs font-medium ${
              mobilePanel === "scale"
                ? "border-[#ffc400]/60 bg-[#ffc400]/15 text-[#ffc400]"
                : "border-white/10 bg-white/[0.04] text-slate-300"
            }`}
            onClick={() => setMobilePanel((panel) => panel === "scale" ? null : "scale")}
          >
            Scale <span className="text-[#ffc400]">{Math.round(effectivePixelsPerSecond)}px/s</span>
          </button>
          <button
            type="button"
            className={`min-h-10 flex-1 rounded-xl border px-3 text-xs font-medium ${
              mobilePanel === "tools"
                ? "border-[#ffc400]/60 bg-[#ffc400]/15 text-[#ffc400]"
                : "border-white/10 bg-white/[0.04] text-slate-300"
            }`}
            onClick={() => setMobilePanel((panel) => panel === "tools" ? null : "tools")}
          >
            Tools
          </button>
          <Button
            type="button"
            variant="outline"
            className="h-10 border-white/10 bg-white/[0.04] px-3 text-xs text-white hover:bg-white/10"
            onClick={() => setPixelsPerSecond(fitPixelsPerSecond)}
          >
            Fit
          </Button>
        </div>
        {mobilePanel === "scale" && (
          <div className="flex items-center gap-3 border-t border-white/10 px-3 py-2">
            <Slider
              value={[pixelsPerSecond]}
              min={MIN_PIXELS_PER_SECOND}
              max={MAX_PIXELS_PER_SECOND}
              step={1}
              onValueChange={([value]) => setPixelsPerSecond(value)}
              className="min-w-0 flex-1"
            />
            <span className="w-14 text-right text-[11px] font-medium text-[#ffc400]">{Math.round(effectivePixelsPerSecond)}px/s</span>
          </div>
        )}
      </div>

      <div
        ref={scrollAreaRef}
        className="relative min-h-0 w-full max-w-full flex-1 overflow-auto [scrollbar-color:#ffc400_#0b1018] [scrollbar-width:thin]"
      >
        <div className="min-h-full" style={{ width: leftColumnWidth + timelineWidth }}>
          <div className="grid border-b border-white/10 bg-[#0a0f17]" style={{ gridTemplateColumns: `${leftColumnWidth}px ${timelineWidth}px` }}>
            <div className="sticky left-0 z-30 border-r border-white/10 bg-[#0a0f17] px-4 py-2 text-xs text-slate-500 max-md:grid max-md:place-items-center max-md:px-0">0s</div>
            <button
              type="button"
              className="relative h-9 cursor-crosshair overflow-hidden text-left max-md:h-11"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onSeek(clampNumber((event.clientX - rect.left) / effectivePixelsPerSecond, 0, timeline.project.duration));
              }}
            >
              {markers.map((time) => (
                <span
                  key={time}
                  className="absolute top-2 text-[11px] text-slate-400"
                  style={{ left: time * effectivePixelsPerSecond }}
                >
                  {time}s
                </span>
              ))}
            </button>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-white" style={{ left: playheadLeft }}>
              <span className="absolute -left-[5px] top-0 h-3 w-3 rounded-full bg-white" />
            </div>

            {timeline.tracks.map((track) => {
              const TrackIcon = iconByType[track.type];
              const uploadType = track.type === "video" || track.type === "image" || track.type === "audio" ? track.type : null;
              return (
            <div key={track.id} className="grid border-b border-white/10" style={{ gridTemplateColumns: `${leftColumnWidth}px ${timelineWidth}px` }}>
              <div className="sticky left-0 z-10 flex items-center gap-3 border-r border-white/10 bg-[#0b1018] px-4 py-3 max-md:justify-center max-md:px-0 max-md:py-1.5">
                <button
                  type="button"
                  className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition max-md:h-11 max-md:w-11 max-md:flex-none max-md:justify-center max-md:gap-0 ${
                    uploadType ? "cursor-pointer text-white hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#ffc400]" : "cursor-default"
                  }`}
                  title={uploadType ? `Upload ${uploadType}` : track.name}
                  onClick={() => {
                    if (uploadType) onTrackUpload?.(uploadType);
                  }}
                >
                  <TrackIcon className="h-4 w-4 shrink-0 text-slate-300" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white max-md:hidden">
                    {track.name.replace(" Track", "")}
                  </span>
                  {uploadType && <Plus className="hidden h-3.5 w-3.5 shrink-0 text-[#ffc400]" />}
                </button>
                <Eye className="h-3.5 w-3.5 text-slate-500 max-md:hidden" />
                <Lock className="h-3.5 w-3.5 text-slate-500 max-md:hidden" />
              </div>
              <div
                data-track-lane={track.id}
                className="relative min-h-[56px] overflow-hidden bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:8.33%_100%] px-2 py-2 max-md:min-h-[52px] max-md:py-1.5"
                style={{ backgroundSize: `${effectivePixelsPerSecond}px 100%` }}
                onClick={(event) => {
                  if (event.target !== event.currentTarget) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  onSeek(clampNumber((event.clientX - rect.left) / effectivePixelsPerSecond, 0, timeline.project.duration));
                }}
              >
                {[...track.items]
                  .sort((a, b) => a.startTime - b.startTime)
                  .map((item, index, sortedItems) => {
                    const next = sortedItems[index + 1];
                    if (!next) return null;
                    const endTime = item.startTime + item.duration;
                    const gap = Number((next.startTime - endTime).toFixed(2));
                    const isTouching = Math.abs(gap) <= 0.05;
                    const markerLeft = endTime * effectivePixelsPerSecond;
                    const gapLeft = endTime * effectivePixelsPerSecond;
                    const gapWidth = Math.max(0, gap * effectivePixelsPerSecond);
                    return (
                      <div key={`${item.id}-${next.id}-transition`}>
                        {gap > 0.05 && (
                          <div
                            className="pointer-events-none absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-black/60 ring-1 ring-red-400/40"
                            style={{ left: gapLeft, width: gapWidth }}
                            title={`${gap.toFixed(1)}s blank space`}
                          />
                        )}
                        {(isTouching || gap >= 0) && (
                          <button
                            type="button"
                            className={`absolute top-1/2 z-20 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[10px] shadow-lg transition max-md:h-11 max-md:w-11 ${
                              item.transitionOut && item.transitionOut !== "none"
                                ? "border-[#ffc400] bg-[#ffc400] text-black"
                                : "border-white/20 bg-[#0d131c] text-[#ffc400] hover:border-[#ffc400] hover:bg-[#ffc400] hover:text-black"
                            }`}
                            style={{ left: markerLeft }}
                            title="Add transition"
                            onClick={(event) => {
                              event.stopPropagation();
                              setTransitionPair({ leftId: item.id, rightId: next.id, x: event.clientX, y: event.clientY });
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                {track.items.map((item) => {
                  const left = Math.max(0, item.startTime * effectivePixelsPerSecond);
                  const width = Math.max(44, item.duration * effectivePixelsPerSecond);
                  const selected = selectedItemId === item.id || selectedItemIds.includes(item.id);
                  const timelineRectToSeconds = (clientX: number) => {
                    const rect = document.querySelector(`[data-track-lane="${track.id}"]`)?.getBoundingClientRect();
                    if (!rect) return item.startTime;
                    return clampNumber((clientX - rect.left) / effectivePixelsPerSecond, 0, timeline.project.duration);
                  };
                  const snapStartTime = (startTime: number) => {
                    const neighbors = track.items.filter((candidate) => candidate.id !== item.id);
                    let snapped = startTime;
                    let shouldRipple = false;
                    neighbors.forEach((candidate) => {
                      const candidateEnd = candidate.startTime + candidate.duration;
                      const candidateStart = candidate.startTime;
                      const itemEnd = startTime + item.duration;
                      if (Math.abs(startTime - candidateEnd) <= SNAP_THRESHOLD_SECONDS) {
                        snapped = candidateEnd;
                        shouldRipple = track.id === "video-main" && item.type === "video";
                      }
                      if (Math.abs(itemEnd - candidateStart) <= SNAP_THRESHOLD_SECONDS) {
                        snapped = candidateStart - item.duration;
                        shouldRipple = track.id === "video-main" && item.type === "video";
                      }
                    });
                    const maxStart = track.id === "video-main" && item.type === "video"
                      ? timeline.project.duration
                      : timeline.project.duration - item.duration;
                    return {
                      startTime: clampNumber(snapped, 0, maxStart),
                      shouldRipple,
                    };
                  };
                  const snapTrimEnd = (endTime: number) => {
                    const next = track.items
                      .filter((candidate) => candidate.id !== item.id && candidate.startTime >= item.startTime)
                      .sort((a, b) => a.startTime - b.startTime)[0];
                    if (next && Math.abs(endTime - next.startTime) <= SNAP_THRESHOLD_SECONDS) return next.startTime;
                    return endTime;
                  };
                  const snapTrimStart = (startTime: number) => {
                    const previous = track.items
                      .filter((candidate) => candidate.id !== item.id && candidate.startTime + candidate.duration <= item.startTime)
                      .sort((a, b) => (b.startTime + b.duration) - (a.startTime + a.duration))[0];
                    if (previous) {
                      const previousEnd = previous.startTime + previous.duration;
                      if (Math.abs(startTime - previousEnd) <= SNAP_THRESHOLD_SECONDS) return previousEnd;
                    }
                    return startTime;
                  };
                  const startMoveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
                    if (event.pointerType === "mouse" && event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    if (event.metaKey || event.ctrlKey) {
                      onToggleItemSelection?.(item.id);
                      return;
                    }
                    onSelectItem(item.id);
                    const pointerOffset = timelineRectToSeconds(event.clientX) - item.startTime;
                    let didMove = false;
                    const handleMove = (moveEvent: PointerEvent) => {
                      didMove = true;
                      const pointerTime = timelineRectToSeconds(moveEvent.clientX);
                      const snapResult = snapStartTime(pointerTime - pointerOffset);
                      const startTime = Number(snapResult.startTime.toFixed(2));
                      onMoveItem(item.id, startTime, snapResult.shouldRipple);
                      onSeek(startTime);
                    };
                    const handleUp = () => {
                      window.removeEventListener("pointermove", handleMove);
                      window.removeEventListener("pointerup", handleUp);
                      window.removeEventListener("pointercancel", handleUp);
                      if (!didMove) onSeek(item.startTime + clampNumber(pointerOffset, 0, item.duration));
                    };
                    window.addEventListener("pointermove", handleMove);
                    window.addEventListener("pointerup", handleUp, { once: true });
                    window.addEventListener("pointercancel", handleUp, { once: true });
                  };
                  const startTrimDrag = (edge: "start" | "end", event: ReactPointerEvent<HTMLSpanElement>) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    onSelectItem(item.id);
                    const handleMove = (moveEvent: PointerEvent) => {
                      const pointerTime = timelineRectToSeconds(moveEvent.clientX);
                      if (edge === "start") {
                        const maxStart = item.startTime + item.duration - 0.5;
                        const nextStart = snapTrimStart(clampNumber(pointerTime, 0, maxStart));
                        const delta = nextStart - item.startTime;
                        onTrimItem(item.id, {
                          startTime: Number(nextStart.toFixed(2)),
                          duration: Number((item.duration - delta).toFixed(2)),
                          trimStart: Number(Math.max(0, item.trimStart + delta).toFixed(2)),
                        });
                        onSeek(nextStart);
                      } else {
                        const nextEnd = snapTrimEnd(clampNumber(pointerTime, item.startTime + 0.5, timeline.project.duration));
                        const duration = Number((nextEnd - item.startTime).toFixed(2));
                        onTrimItem(item.id, {
                          duration,
                          trimEnd: Number((item.trimStart + duration).toFixed(2)),
                        });
                        onSeek(nextEnd);
                      }
                    };
                    const handleUp = () => {
                      window.removeEventListener("pointermove", handleMove);
                      window.removeEventListener("pointerup", handleUp);
                      window.removeEventListener("pointercancel", handleUp);
                    };
                    window.addEventListener("pointermove", handleMove);
                    window.addEventListener("pointerup", handleUp, { once: true });
                    window.addEventListener("pointercancel", handleUp, { once: true });
                  };
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onPointerDown={startMoveDrag}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (event.metaKey || event.ctrlKey) {
                          onToggleItemSelection?.(item.id);
                          return;
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        const clickedOffset = clampNumber((event.clientX - rect.left) / rect.width, 0, 1) * item.duration;
                        onSelectItem(item.id);
                        onSeek(item.startTime + clickedOffset);
                        onUpdateItem(item.id, {});
                      }}
                      className={`absolute top-2 h-10 min-w-[44px] touch-none select-none overflow-hidden rounded-md border bg-gradient-to-r px-3 text-left text-xs text-white shadow-lg transition max-md:top-1.5 max-md:h-10 max-md:rounded-md max-md:px-3 max-md:text-xs ${colorByType[item.type]} ${
                        selected ? "ring-2 ring-[#ffc400]" : "opacity-90 hover:opacity-100"
                      } cursor-grab active:cursor-grabbing`}
                      style={{ left, width }}
                    >
                      <TimelineClipPreview item={item} />
                      <span className="relative z-10 block truncate font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                        {item.text || item.name}
                      </span>
                      {item.type === "video" && !item.source?.uri && <span className="relative z-10 mt-1 block h-2 rounded bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.2)_0_8px,rgba(0,0,0,0.2)_8px_16px)]" />}
                      {item.type === "audio" && <span className="relative z-10 mt-1 block h-2 rounded bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.15)_0_2px,transparent_2px_5px)]" />}
                      {selected && (
                        <span className="absolute right-1 top-1 z-10 rounded bg-black/55 px-1 text-[10px] text-[#ffc400]">
                          {item.playbackRate && item.playbackRate !== 1 ? `${item.playbackRate}x` : item.effectPreset && item.effectPreset !== "none" ? item.effectPreset : `${Math.round(item.scale * 100)}%`}
                        </span>
                      )}
                      {selected && (
                        <>
                          <span
                            className="absolute inset-y-0 left-0 z-10 w-2 touch-none cursor-ew-resize bg-white/40 hover:bg-[#ffc400] max-md:w-5"
                            title="Drag to extend or trim start"
                            onPointerDown={(event) => startTrimDrag("start", event)}
                          />
                          <span
                            className="absolute inset-y-0 right-0 z-10 w-2 touch-none cursor-ew-resize bg-white/40 hover:bg-[#ffc400] max-md:w-5"
                            title="Drag to extend or trim end"
                            onPointerDown={(event) => startTrimDrag("end", event)}
                          />
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
              );
            })}
          </div>
        </div>
      </div>
      {mobilePanel === "tools" && (
      <div className="hidden shrink-0 border-t border-white/10 bg-[#0b1018] max-md:block">
        <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { label: "Split", icon: Scissors, action: "split" as const },
            { label: "Duplicate", icon: Copy, action: "duplicate" as const },
            { label: "Delete", icon: Trash2, action: "delete" as const },
            { label: "Zoom In", icon: ZoomIn, action: "zoom-in-motion" as const },
            { label: "Zoom Out", icon: ZoomOut, action: "zoom-out-motion" as const },
            { label: "Fade", icon: Sparkles, action: "fade" as const },
            { label: selectedItem?.playbackRate && selectedItem.playbackRate !== 1 ? `${selectedItem.playbackRate}x` : "Speed", icon: Zap, action: "speed" as const },
            { label: "Cut Air", icon: Scissors, action: "cut-dead-air" as const },
            { label: "Enhance", icon: WandSparkles, action: "enhance" as const },
            { label: "Reset", icon: RotateCcw, action: "reset" as const },
          ].map((tool) => {
            const Icon = tool.icon;
            const activeTool = tool.action === "speed" && !!selectedItem?.playbackRate && selectedItem.playbackRate !== 1;
            return (
              <button
                key={tool.action}
                type="button"
                className={`flex min-h-14 min-w-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-medium ${
                  activeTool
                    ? "border-[#ffc400]/50 bg-[#ffc400]/15 text-[#ffc400]"
                    : "border-white/10 bg-white/[0.04] text-slate-300"
                }`}
                onClick={() => onToolAction(tool.action)}
              >
                <Icon className="h-5 w-5" />
                {tool.label}
              </button>
            );
          })}
        </div>
        {selectedItem && (selectedItem.type === "video" || selectedItem.type === "audio") && (
          <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2 text-xs text-slate-300">
            <Volume2 className="h-4 w-4 shrink-0" />
            <Slider
              value={[clampNumber(selectedItem.volume, 0, 1)]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([volume]) => onUpdateItem(selectedItem.id, { volume })}
              className="min-w-0 flex-1"
            />
            <span className="w-10 text-right text-[#ffc400]">{Math.round(selectedItem.volume * 100)}%</span>
          </div>
        )}
        {selectedVisual && (
          <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { label: "Punch", action: "effect-punch" as const },
              { label: "Vivid", action: "effect-vivid" as const },
              { label: "Warm", action: "effect-warm" as const },
              { label: "Cool", action: "effect-cool" as const },
              { label: "Cinema", action: "effect-cinematic" as const },
              { label: "Mono", action: "effect-mono" as const },
              { label: "Dream", action: "effect-dream" as const },
            ].map((effect) => {
              const active = selectedVisual.effectPreset === effect.action.replace("effect-", "");
              return (
                <button
                  key={effect.action}
                  type="button"
                  className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-medium ${
                    active
                      ? "border-[#ffc400]/50 bg-[#ffc400]/15 text-[#ffc400]"
                      : "border-white/10 bg-white/[0.04] text-slate-300"
                  }`}
                  onClick={() => onToolAction(effect.action)}
                >
                  {effect.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}
      {transitionPair && (
        <div className="fixed z-50 w-[320px] rounded-xl border border-white/10 bg-[#0b1018] p-4 text-white shadow-2xl" style={{ left: pickerLeft, top: pickerTop }}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Transition</p>
              <h3 className="text-sm font-semibold">Choose transition</h3>
            </div>
            <button type="button" className="text-xs text-slate-400 hover:text-white" onClick={() => setTransitionPair(null)}>
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Cut", preset: "none" as const },
              { label: "Fade", preset: "fade" as const },
              { label: "Slide", preset: "slide" as const },
              { label: "Zoom", preset: "zoom" as const },
            ].map((item) => (
              <button
                key={item.preset}
                type="button"
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 hover:border-[#ffc400]/60 hover:bg-[#ffc400]/10"
                onClick={() => {
                  onApplyTransition(transitionPair.leftId, transitionPair.rightId, item.preset);
                  setTransitionPair(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3 rounded-lg border border-[#ffc400]/20 bg-[#ffc400]/5 p-3">
            <p className="text-xs font-semibold text-[#ffc400]">AI video transition</p>
            <textarea
              value={aiPrompt}
              onChange={(event) => {
                setAiPrompt(event.target.value);
                setAiError("");
              }}
              disabled={aiGenerating}
              rows={3}
              className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#ffc400]/70 disabled:opacity-60"
              placeholder="Prompt..."
            />
            <div className="flex items-center gap-2">
              {[4, 6, 8].map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  className={`h-8 rounded-md border px-3 text-xs ${aiSeconds === seconds ? "border-[#ffc400] bg-[#ffc400] text-black" : "border-white/10 bg-black/20 text-slate-200"}`}
                  disabled={aiGenerating}
                  onClick={() => setAiSeconds(seconds)}
                >
                  {seconds}s
                </button>
              ))}
            </div>
            {aiGenerating && (
              <div className="space-y-2 rounded-md border border-white/10 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-slate-200">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ffc400]" />
                    {aiStatus || "Starting Gemini..."}
                  </span>
                  <span className="font-medium text-[#ffc400]">{aiProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#ffc400] transition-all duration-500"
                    style={{ width: `${aiProgress}%` }}
                  />
                </div>
                <p className="text-[11px] leading-4 text-slate-400">
                  Generating can take a minute. The clip will auto-add to the timeline when ready.
                </p>
              </div>
            )}
            {aiError && (
              <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                {aiError}
              </div>
            )}
            <button
              type="button"
              className="h-9 w-full rounded-md bg-[#ffc400] text-sm font-semibold text-black hover:bg-[#ffd84a] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={aiGenerating || !aiPrompt.trim()}
              onClick={async () => {
                let progressTimer: number | undefined;
                let completed = false;
                try {
                  setAiError("");
                  setAiGenerating(true);
                  setAiProgress(8);
                  setAiStatus("Sending prompt to Gemini...");
                  const startedAt = Date.now();
                  progressTimer = window.setInterval(() => {
                    const elapsed = Date.now() - startedAt;
                    const nextProgress = Math.min(92, 8 + Math.round(elapsed / 1400));
                    setAiProgress(nextProgress);
                    setAiStatus(
                      nextProgress < 25
                        ? "Starting video generation..."
                        : nextProgress < 55
                          ? "Generating transition video..."
                          : nextProgress < 82
                            ? "Rendering frames..."
                            : "Preparing timeline clip..."
                    );
                  }, 1200);
                  await onGenerateAiTransition(transitionPair.leftId, transitionPair.rightId, aiPrompt.trim(), aiSeconds);
                  completed = true;
                  if (progressTimer) window.clearInterval(progressTimer);
                  setAiProgress(100);
                  setAiStatus("Added to timeline.");
                  setTransitionPair(null);
                } catch (error: any) {
                  const message = error?.message || "Gemini video generation failed.";
                  setAiError(message.length > 280 ? `${message.slice(0, 280)}...` : message);
                } finally {
                  if (progressTimer) window.clearInterval(progressTimer);
                  setAiGenerating(false);
                  if (completed) {
                    setAiProgress(0);
                    setAiStatus("");
                  }
                }
              }}
            >
              {aiGenerating ? "Generating..." : "Generate with Gemini"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
