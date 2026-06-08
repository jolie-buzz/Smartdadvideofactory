import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Expand, Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { BuzzlyTimelineItem, BuzzlyTimelineJson } from "@shared/models/timeline";

type PreviewPanelProps = {
  timeline: BuzzlyTimelineJson;
  currentTime: number;
  isPlaying: boolean;
  selectedItemId: string | null;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSelectItem: (id: string) => void;
  onUpdateItem: (id: string, patch: Partial<BuzzlyTimelineItem>) => void;
};

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  const tenths = Math.floor((seconds % 1) * 10);
  return `${minutes}:${remainingSeconds}.${tenths}`;
};

const isActiveAtTime = (item: BuzzlyTimelineItem, currentTime: number) =>
  currentTime >= item.startTime && currentTime < item.startTime + item.duration;

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getPlaybackRate = (item: BuzzlyTimelineItem) => clampNumber(item.playbackRate || 1, 0.25, 4);
const getMediaTimeAtTimelineTime = (item: BuzzlyTimelineItem, currentTime: number) => {
  const trimStart = Math.max(0, item.trimStart || 0);
  const trimEnd = Math.max(trimStart, item.trimEnd || trimStart + item.duration * getPlaybackRate(item));
  const localTimelineTime = clampNumber(currentTime - item.startTime, 0, item.duration);
  return clampNumber(trimStart + localTimelineTime * getPlaybackRate(item), trimStart, trimEnd);
};
const SNAP_THRESHOLD = 0.025;

type SnapGuides = {
  vertical: number[];
  horizontal: number[];
};

const uniqueGuideValues = (values: number[]) => Array.from(new Set(values.map((value) => Number(value.toFixed(3)))));

const snapScalar = (value: number, targets: number[]) => {
  const target = targets.find((snapTarget) => Math.abs(value - snapTarget) <= SNAP_THRESHOLD);
  return target ?? value;
};

function snapPositionToCanvas(
  position: { x: number; y: number },
  frameSize: { width: number; height: number },
): { position: { x: number; y: number }; guides: SnapGuides } {
  const halfWidth = frameSize.width / 2;
  const halfHeight = frameSize.height / 2;
  const xTargets = [0.5, halfWidth, 1 - halfWidth];
  const yTargets = [0.5, halfHeight, 1 - halfHeight];
  const x = snapScalar(position.x, xTargets);
  const y = snapScalar(position.y, yTargets);
  const vertical = [];
  const horizontal = [];

  if (x !== position.x) vertical.push(x === 0.5 ? 0.5 : x < 0.5 ? 0 : 1);
  if (y !== position.y) horizontal.push(y === 0.5 ? 0.5 : y < 0.5 ? 0 : 1);

  return {
    position: { x: clampNumber(x, 0.02, 0.98), y: clampNumber(y, 0.02, 0.98) },
    guides: { vertical: uniqueGuideValues(vertical), horizontal: uniqueGuideValues(horizontal) },
  };
}

function snapSizeToCanvas(
  position: { x: number; y: number },
  frameSize: { width: number; height: number },
): { frameSize: { width: number; height: number }; guides: SnapGuides } {
  const leftFitWidth = position.x * 2;
  const rightFitWidth = (1 - position.x) * 2;
  const topFitHeight = position.y * 2;
  const bottomFitHeight = (1 - position.y) * 2;
  const widthTargets = [1, leftFitWidth, rightFitWidth].filter((value) => value >= 0.12 && value <= 1.5);
  const heightTargets = [1, topFitHeight, bottomFitHeight].filter((value) => value >= 0.12 && value <= 1.5);
  const width = snapScalar(frameSize.width, widthTargets);
  const height = snapScalar(frameSize.height, heightTargets);
  const vertical = [];
  const horizontal = [];

  if (width !== frameSize.width) {
    if (Math.abs(width - 1) <= SNAP_THRESHOLD) vertical.push(0, 1);
    if (Math.abs(width - leftFitWidth) <= SNAP_THRESHOLD) vertical.push(0);
    if (Math.abs(width - rightFitWidth) <= SNAP_THRESHOLD) vertical.push(1);
  }
  if (height !== frameSize.height) {
    if (Math.abs(height - 1) <= SNAP_THRESHOLD) horizontal.push(0, 1);
    if (Math.abs(height - topFitHeight) <= SNAP_THRESHOLD) horizontal.push(0);
    if (Math.abs(height - bottomFitHeight) <= SNAP_THRESHOLD) horizontal.push(1);
  }

  return {
    frameSize: { width: clampNumber(width, 0.12, 1.5), height: clampNumber(height, 0.12, 1.5) },
    guides: { vertical: uniqueGuideValues(vertical), horizontal: uniqueGuideValues(horizontal) },
  };
}

type PreviewAudioNode = {
  oscillator: OscillatorNode;
  gain: GainNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
};

export function PreviewPanel({ timeline, currentTime, isPlaying, selectedItemId, onPlayPause, onSeek, onSelectItem, onUpdateItem }: PreviewPanelProps) {
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({ vertical: [], horizontal: [] });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<PreviewAudioNode[]>([]);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const lastPreviewTimeRef = useRef(currentTime);

  const activeItems = timeline.tracks
    .flatMap((track) => track.items.map((item) => ({ item, muted: track.muted })))
    .filter(({ item, muted }) => !muted && isActiveAtTime(item, currentTime));

  const visualItems = activeItems.filter(({ item }) => item.type !== "audio");
  const activeAudioItems = activeItems.filter(({ item }) => item.type === "audio").map(({ item }) => item);
  const realAudioItems = activeAudioItems.filter((item) => item.source?.uri);
  const placeholderAudioItems = activeAudioItems.filter((item) => !item.source?.uri);
  const activeAudioSignature = useMemo(
    () => placeholderAudioItems.map((item) => `${item.id}:${item.volume}:${item.source?.filename || item.name}`).join("|"),
    [placeholderAudioItems],
  );
  const formatLabel = timeline.project.format === "square-1x1" ? "1:1" : timeline.project.format === "landscape-16x9" ? "16:9" : "9:16";
  const aspectRatio = `${timeline.project.width} / ${timeline.project.height}`;

  const moveItemToPointer = (item: BuzzlyTimelineItem, clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frameSize = item.frameSize || (item.type === "video"
      ? { width: 1, height: 1 }
      : item.type === "image"
      ? { width: 0.86, height: 0.86 }
      : { width: 0.72, height: 0.54 });
    const nextPosition = snapPositionToCanvas({
      x: clampNumber((clientX - rect.left) / rect.width, 0.02, 0.98),
      y: clampNumber((clientY - rect.top) / rect.height, 0.02, 0.98),
    }, frameSize);
    setSnapGuides(nextPosition.guides);
    onUpdateItem(item.id, {
      position: {
        x: Number(nextPosition.position.x.toFixed(3)),
        y: Number(nextPosition.position.y.toFixed(3)),
      },
    });
  };

  const resizeItemToPointer = (item: BuzzlyTimelineItem, clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawSize = {
      width: clampNumber((Math.abs(clientX - (rect.left + rect.width * item.position.x)) * 2) / rect.width, 0.12, 1.5),
      height: clampNumber((Math.abs(clientY - (rect.top + rect.height * item.position.y)) * 2) / rect.height, 0.12, 1.5),
    };
    const nextSize = snapSizeToCanvas(item.position, rawSize);
    setSnapGuides(nextSize.guides);
    onUpdateItem(item.id, {
      frameSize: {
        width: Number(nextSize.frameSize.width.toFixed(3)),
        height: Number(nextSize.frameSize.height.toFixed(3)),
      },
    });
  };

  const handleLayerPointerDown = (item: BuzzlyTimelineItem, event: PointerEvent<HTMLElement>) => {
    if (item.type === "audio") return;
    event.preventDefault();
    event.stopPropagation();
    onSelectItem(item.id);
    moveItemToPointer(item, event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    const clearGuides = () => setSnapGuides({ vertical: [], horizontal: [] });
    window.addEventListener("pointerup", clearGuides, { once: true });
  };

  const handleResizePointerDown = (item: BuzzlyTimelineItem, event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectItem(item.id);
    resizeItemToPointer(item, event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    const clearGuides = () => setSnapGuides({ vertical: [], horizontal: [] });
    window.addEventListener("pointerup", clearGuides, { once: true });
  };

  const stopPreviewAudio = () => {
    audioNodesRef.current.forEach((node) => {
      try {
        node.lfo?.stop();
        node.oscillator.stop();
      } catch {
        // Already stopped.
      }
      node.lfo?.disconnect();
      node.lfoGain?.disconnect();
      node.gain.disconnect();
      node.oscillator.disconnect();
    });
    audioNodesRef.current = [];
  };

  const getAudioContext = () => {
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  };

  const primeAudio = async () => {
    const context = getAudioContext();
    if (context?.state === "suspended") await context.resume();
  };

  useEffect(() => {
    stopPreviewAudio();
    if (!isPlaying || placeholderAudioItems.length === 0) return;

    const context = getAudioContext();
    if (!context) return;

    const master = context.createGain();
    master.gain.setValueAtTime(0.22, context.currentTime);
    master.connect(context.destination);

    placeholderAudioItems.forEach((item, index) => {
      const descriptor = `${item.name} ${item.source?.filename || ""}`.toLowerCase();
      const isMusic = descriptor.includes("music") || descriptor.includes("beat");
      const isEmotional = descriptor.includes("emotional");
      const isGenZ = descriptor.includes("gen-z") || descriptor.includes("bounce");
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();

      oscillator.type = isMusic ? "triangle" : "sawtooth";
      oscillator.frequency.setValueAtTime(
        isMusic ? (isGenZ ? 220 : isEmotional ? 174 : 146.83) : 196 + index * 18,
        context.currentTime,
      );
      gain.gain.setValueAtTime(Math.min(0.12, Math.max(0, item.volume) * (isMusic ? 0.08 : 0.035)), context.currentTime);
      lfo.frequency.setValueAtTime(isMusic ? 3.2 : 5.5, context.currentTime);
      lfoGain.gain.setValueAtTime(isMusic ? 0.025 : 0.01, context.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      lfo.start();
      audioNodesRef.current.push({ oscillator, gain, lfo, lfoGain });
    });

    void context.resume();

    return () => {
      stopPreviewAudio();
      master.disconnect();
    };
  }, [isPlaying, activeAudioSignature]);

  useEffect(() => {
    const timeDelta = Math.abs(currentTime - lastPreviewTimeRef.current);
    const isTimelineScrub = !isPlaying || timeDelta > 0.45;
    lastPreviewTimeRef.current = currentTime;

    visualItems.forEach(({ item }) => {
      if (item.type !== "video" || !item.source?.uri) return;
      const video = videoRefs.current[item.id];
      if (!video) return;

      const itemTime = getMediaTimeAtTimelineTime(item, currentTime);
      const allowedDrift = isPlaying && !isTimelineScrub ? 1.25 : 0.18;
      if (Number.isFinite(itemTime) && Math.abs(video.currentTime - itemTime) > allowedDrift) {
        video.currentTime = itemTime;
      }
      video.volume = clampNumber(item.volume, 0, 1);
      video.muted = item.volume <= 0.01;
      video.playbackRate = getPlaybackRate(item);
      if (isPlaying && video.paused) {
        void video.play().catch(() => undefined);
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    });

    realAudioItems.forEach((item) => {
      const audio = audioRefs.current[item.id];
      if (!audio) return;

      const itemTime = getMediaTimeAtTimelineTime(item, currentTime);
      const allowedDrift = isPlaying && !isTimelineScrub ? 1.25 : 0.18;
      if (Number.isFinite(itemTime) && Math.abs(audio.currentTime - itemTime) > allowedDrift) {
        audio.currentTime = itemTime;
      }
      audio.volume = clampNumber(item.volume, 0, 1);
      audio.playbackRate = getPlaybackRate(item);
      if (isPlaying && audio.paused) {
        void audio.play().catch(() => undefined);
      } else if (!isPlaying && !audio.paused) {
        audio.pause();
      }
    });
  }, [currentTime, isPlaying, visualItems, realAudioItems]);

  useEffect(() => {
    const handlePrimeAudio = () => {
      void primeAudio();
    };
    window.addEventListener("buzzly-prime-audio", handlePrimeAudio);
    return () => window.removeEventListener("buzzly-prime-audio", handlePrimeAudio);
  }, []);

  useEffect(() => () => stopPreviewAudio(), []);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)] max-md:rounded-xl">
      <div className="relative grid min-h-0 flex-1 place-items-center bg-[#090d14] p-4 max-md:p-2">
        <div className="absolute left-4 top-4 rounded-md border border-white/10 bg-black/35 px-2 py-1 text-xs text-slate-200 max-md:left-2 max-md:top-2 max-md:text-[10px]">{formatLabel}</div>
        <div
          ref={stageRef}
          className={`relative h-full w-auto max-w-full overflow-hidden border border-white/10 bg-[#05070a] shadow-2xl max-md:max-h-[42dvh] ${expandedPreview ? "max-h-[64vh]" : "max-h-[48vh]"}`}
          style={{ aspectRatio }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_34%),radial-gradient(circle_at_50%_38%,rgba(255,196,0,0.1),transparent_34%),linear-gradient(180deg,#0b1018,#05070a)]" />
          {snapGuides.vertical.map((x) => (
            <span
              key={`v-${x}`}
              className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-[#ffc400]/80 shadow-[0_0_18px_rgba(255,196,0,0.65)]"
              style={{ left: `${x * 100}%` }}
            />
          ))}
          {snapGuides.horizontal.map((y) => (
            <span
              key={`h-${y}`}
              className="pointer-events-none absolute left-0 right-0 z-30 h-px bg-[#ffc400]/80 shadow-[0_0_18px_rgba(255,196,0,0.65)]"
              style={{ top: `${y * 100}%` }}
            />
          ))}

          {visualItems.map(({ item }) => {
            const effectPreset = item.effectPreset || "none";
            const localTime = clampNumber(currentTime - item.startTime, 0, item.duration);
            const transitionDuration = Math.min(item.transitionDuration || 0.35, item.duration / 2);
            const inProgress = transitionDuration > 0 ? clampNumber(localTime / transitionDuration, 0, 1) : 1;
            const outProgress = transitionDuration > 0 ? clampNumber((item.duration - localTime) / transitionDuration, 0, 1) : 1;
            const transitionOpacity = Math.min(inProgress, outProgress);
            const zoomProgress = item.duration > 0 ? clampNumber(localTime / item.duration, 0, 1) : 0;
            const animatedScale = item.zoomAnimation?.enabled
              ? item.zoomAnimation.startScale + (item.zoomAnimation.endScale - item.zoomAnimation.startScale) * zoomProgress
              : item.scale;
            const transitionIn = item.transitionIn || "none";
            const transitionOut = item.transitionOut || "none";
            const transitionY = transitionIn === "slide-up" && inProgress < 1
              ? (1 - inProgress) * 18
              : transitionOut === "slide-down" && outProgress < 1
              ? (1 - outProgress) * 18
              : 0;
            const transitionZoom = (transitionIn === "zoom" && inProgress < 1) || (transitionOut === "zoom" && outProgress < 1)
              ? 0.96 + Math.min(inProgress, outProgress) * 0.04
              : 1;
            const presetFilter = effectPreset === "enhance"
              ? "saturate(1.08)"
              : effectPreset === "punch"
              ? "saturate(1.22) contrast(1.08)"
              : effectPreset === "vivid"
              ? "saturate(1.28) brightness(1.04)"
              : effectPreset === "warm"
              ? "sepia(0.16) saturate(1.08)"
              : effectPreset === "cool"
              ? "saturate(0.96) hue-rotate(8deg)"
              : effectPreset === "cinematic"
              ? "contrast(1.16) saturate(0.92)"
              : effectPreset === "mono"
              ? "grayscale(1) contrast(1.12)"
              : effectPreset === "dream"
              ? "saturate(1.14) brightness(1.08)"
              : "";
            const commonStyle: CSSProperties = {
              left: `${item.position.x * 100}%`,
              top: `${item.position.y * 100}%`,
              opacity: item.opacity * (transitionIn === "fade" || transitionOut === "fade" ? transitionOpacity : 1),
              transform: `translate(-50%, calc(-50% + ${transitionY}px)) scale(${animatedScale * transitionZoom}) rotate(${item.rotation || 0}deg)`,
              filter: [
                `brightness(${item.brightness || 1})`,
                `contrast(${item.contrast || 1})`,
                `blur(${item.blur || 0}px)`,
                presetFilter,
              ].filter(Boolean).join(" "),
            };
            const frameSize = item.frameSize || (item.type === "video"
              ? { width: 1, height: 1 }
              : item.type === "image"
              ? { width: 0.86, height: 0.86 }
              : { width: 0.72, height: 0.54 });
            const mediaFrameStyle: CSSProperties = {
              ...commonStyle,
              width: `${frameSize.width * 100}%`,
              height: `${frameSize.height * 100}%`,
            };
            const resizeHandle = selectedItemId === item.id && (item.type === "image" || item.type === "video") ? (
              <span
                className="absolute -bottom-2 -right-2 z-20 h-4 w-4 cursor-nwse-resize rounded border border-black/60 bg-[#ffc400] shadow-lg"
                title="Drag to resize"
                onPointerDown={(event) => handleResizePointerDown(item, event)}
                onPointerMove={(event) => {
                  if (event.buttons === 1 && selectedItemId === item.id) resizeItemToPointer(item, event.clientX, event.clientY);
                }}
              />
            ) : null;

            if ((item.type === "image" || item.type === "video") && !item.source?.uri) {
              return (
                <div
                  key={item.id}
                  className={`absolute flex cursor-move touch-none items-center justify-center rounded-lg border border-dashed bg-white/[0.06] p-4 text-center text-xs font-semibold text-slate-200 shadow-2xl ${selectedItemId === item.id ? "border-[#ffc400] ring-2 ring-[#ffc400]/45" : "border-white/20"}`}
                  style={mediaFrameStyle}
                  onPointerDown={(event) => handleLayerPointerDown(item, event)}
                  onPointerMove={(event) => {
                    if (event.buttons === 1 && selectedItemId === item.id) moveItemToPointer(item, event.clientX, event.clientY);
                  }}
                >
                  {item.source?.filename || item.name}
                  {resizeHandle}
                </div>
              );
            }

            if (item.type === "image" && item.source?.uri) {
              return (
                <div
                  key={item.id}
                  className={`absolute cursor-move touch-none overflow-hidden rounded-lg border shadow-2xl ${selectedItemId === item.id ? "border-[#ffc400] ring-2 ring-[#ffc400]/45" : "border-white/20"}`}
                  style={mediaFrameStyle}
                  onPointerDown={(event) => handleLayerPointerDown(item, event)}
                  onPointerMove={(event) => {
                    if (event.buttons === 1 && selectedItemId === item.id) moveItemToPointer(item, event.clientX, event.clientY);
                  }}
                >
                  <img
                    src={item.source.uri}
                    alt={item.name}
                    className="h-full w-full"
                    style={{ objectFit: item.mediaFit || "contain" }}
                    draggable={false}
                  />
                  {resizeHandle}
                </div>
              );
            }

            if (item.type === "video" && item.source?.uri) {
              return (
                <div
                  key={item.id}
                  className={`absolute cursor-move touch-none overflow-hidden rounded-lg border shadow-2xl ${selectedItemId === item.id ? "border-[#ffc400] ring-2 ring-[#ffc400]/45" : "border-white/20"}`}
                  style={mediaFrameStyle}
                  onPointerDown={(event) => handleLayerPointerDown(item, event)}
                  onPointerMove={(event) => {
                    if (event.buttons === 1 && selectedItemId === item.id) moveItemToPointer(item, event.clientX, event.clientY);
                  }}
                >
                  <video
                    key={`${item.id}:${item.source.uri}:${item.trimStart}:${item.trimEnd}`}
                    ref={(element) => {
                      if (element) {
                        videoRefs.current[item.id] = element;
                      } else {
                        delete videoRefs.current[item.id];
                      }
                    }}
                    src={item.source.uri}
                    className="h-full w-full"
                    style={{ objectFit: item.mediaFit || "cover" }}
                    playsInline
                  />
                  {resizeHandle}
                </div>
              );
            }

            if (item.type === "text" || item.type === "caption") {
              return (
                <div
                  key={item.id}
                  className={
                    item.type === "caption"
                      ? `absolute max-w-[88%] cursor-move touch-none rounded-md bg-black/75 px-4 py-3 text-center text-base font-semibold leading-tight text-white shadow-xl ${selectedItemId === item.id ? "ring-2 ring-[#ffc400]/70" : ""}`
                      : `absolute max-w-[84%] cursor-move touch-none rounded-md bg-[#ffc400] px-4 py-3 text-center text-xl font-black leading-tight text-black shadow-xl ${selectedItemId === item.id ? "ring-2 ring-white/70" : ""}`
                  }
                  style={commonStyle}
                  onPointerDown={(event) => handleLayerPointerDown(item, event)}
                  onPointerMove={(event) => {
                    if (event.buttons === 1 && selectedItemId === item.id) moveItemToPointer(item, event.clientX, event.clientY);
                  }}
                >
                  {item.text}
                </div>
              );
            }

            return null;
          })}

          {!visualItems.length && (
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 rounded-md bg-white/10 px-4 py-3 text-center text-sm text-white">
              No visual layers at this time
            </div>
          )}
        </div>

        {realAudioItems.map((item) => (
          <audio
            key={item.id}
            ref={(element) => {
              audioRefs.current[item.id] = element;
            }}
            src={item.source?.uri}
            preload="metadata"
          />
        ))}
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-t border-white/10 bg-[#0c1119] px-5 py-4">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => onSeek(0)} title="Restart">
            <SkipBack className="h-4 w-4 fill-current" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 text-white hover:bg-white/10"
            onClick={() => {
              if (!isPlaying) void primeAudio();
              onPlayPause();
            }}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-5 w-5 fill-white" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-300 hover:bg-white/10 hover:text-white" title="Next" onClick={() => onSeek(Math.min(timeline.project.duration, currentTime + 5))}>
            <SkipForward className="h-4 w-4 fill-current" />
          </Button>
        </div>
        <div className="flex min-w-0 items-center gap-4">
          <span className="w-28 shrink-0 text-sm tabular-nums text-slate-300">
            {formatTime(currentTime)} / {formatTime(timeline.project.duration)}
          </span>
          <Slider value={[currentTime]} min={0} max={timeline.project.duration} step={0.1} onValueChange={([time]) => onSeek(time)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded bg-white/[0.06] px-2 py-1 text-[11px] text-slate-300 xl:inline">
            Sound: {activeAudioItems.length ? activeAudioItems.map((item) => item.name).join(", ") : "none"}
          </span>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => onSeek(0)} title="Restart">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-300 hover:bg-white/10 hover:text-white" title="Fit canvas" onClick={() => setExpandedPreview(false)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-300 hover:bg-white/10 hover:text-white" title="Fullscreen" onClick={() => setExpandedPreview((value) => !value)}>
            <Expand className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
