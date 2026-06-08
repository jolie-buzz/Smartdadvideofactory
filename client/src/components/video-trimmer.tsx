import { useState, useRef, useEffect, useCallback } from "react";

interface VideoTrimmerProps {
  videoSrc: string;
  duration: number;
  startTime: number;
  endTime: number;
  onStartChange: (time: number) => void;
  onEndChange: (time: number) => void;
  onCurrentTimeChange?: (time: number) => void;
  disabled?: boolean;
}

const MIN_CLIP_DURATION = 0.5;
const THUMBNAIL_COUNT = 12;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
}

export default function VideoTrimmer({
  videoSrc,
  duration,
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  onCurrentTimeChange,
  disabled = false,
}: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | "region" | null>(null);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, startVal: 0, endVal: 0 });
  const [currentTime, setCurrentTime] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false);
  const animFrameRef = useRef<number>(0);

  const safeDuration = duration > 0 ? duration : 1;

  useEffect(() => {
    if (!videoSrc || duration <= 0) return;

    let cancelled = false;
    setIsGeneratingThumbs(true);

    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = videoSrc;

    (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("Failed to load video for thumbnails"));
          setTimeout(() => resolve(), 5000);
        });

        if (cancelled) return;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 80;
        canvas.height = 56;

        const thumbs: string[] = [];
        for (let i = 0; i < THUMBNAIL_COUNT; i++) {
          if (cancelled) return;
          const time = (i / THUMBNAIL_COUNT) * duration;
          video.currentTime = time;
          await new Promise<void>((resolve) => {
            video.onseeked = () => resolve();
            setTimeout(() => resolve(), 500);
          });
          if (cancelled) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbs.push(canvas.toDataURL("image/jpeg", 0.5));
        }
        if (!cancelled) setThumbnails(thumbs);
      } catch {
        if (!cancelled) setThumbnails([]);
      } finally {
        if (!cancelled) setIsGeneratingThumbs(false);
        video.src = "";
        video.load();
      }
    })();

    return () => {
      cancelled = true;
      video.src = "";
      video.load();
    };
  }, [videoSrc, duration]);

  const timeToPercent = (t: number) => (t / safeDuration) * 100;
  const percentToTime = (pct: number) => (pct / 100) * safeDuration;

  const getPercentFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      return Math.max(0, Math.min(100, pct));
    },
    []
  );

  const handlePointerDown = useCallback(
    (type: "start" | "end" | "region", e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(type);
      setDragOrigin({ x: e.clientX, startVal: startTime, endVal: endTime });
    },
    [disabled, startTime, endTime]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging || disabled) return;
      e.preventDefault();

      const pct = getPercentFromEvent(e.clientX);
      const time = percentToTime(pct);

      if (dragging === "start") {
        const newStart = Math.max(0, Math.min(time, endTime - MIN_CLIP_DURATION));
        onStartChange(Math.round(newStart * 10) / 10);
        if (videoRef.current) videoRef.current.currentTime = newStart;
      } else if (dragging === "end") {
        const newEnd = Math.min(safeDuration, Math.max(time, startTime + MIN_CLIP_DURATION));
        onEndChange(Math.round(newEnd * 10) / 10);
        if (videoRef.current) videoRef.current.currentTime = newEnd;
      } else if (dragging === "region") {
        const dx = e.clientX - dragOrigin.x;
        const track = trackRef.current;
        if (!track) return;
        const pxPerSec = track.getBoundingClientRect().width / safeDuration;
        const dtSec = dx / pxPerSec;
        const regionLen = dragOrigin.endVal - dragOrigin.startVal;
        let newStart = dragOrigin.startVal + dtSec;
        let newEnd = dragOrigin.endVal + dtSec;
        if (newStart < 0) {
          newStart = 0;
          newEnd = regionLen;
        }
        if (newEnd > safeDuration) {
          newEnd = safeDuration;
          newStart = safeDuration - regionLen;
        }
        onStartChange(Math.round(newStart * 10) / 10);
        onEndChange(Math.round(newEnd * 10) / 10);
        if (videoRef.current) videoRef.current.currentTime = newStart;
      }
    },
    [dragging, disabled, getPercentFromEvent, percentToTime, startTime, endTime, safeDuration, onStartChange, onEndChange, dragOrigin]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [dragging, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const updateTime = () => {
      const t = Math.round(vid.currentTime * 10) / 10;
      setCurrentTime(t);
      onCurrentTimeChange?.(t);
    };

    vid.addEventListener("timeupdate", updateTime);
    return () => vid.removeEventListener("timeupdate", updateTime);
  }, [onCurrentTimeChange]);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || dragging) return;
      const pct = getPercentFromEvent(e.clientX);
      const time = percentToTime(pct);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        videoRef.current.pause();
      }
    },
    [disabled, dragging, getPercentFromEvent, percentToTime]
  );

  const playSelection = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    vid.currentTime = startTime;
    vid.play();

    const checkEnd = () => {
      if (vid.currentTime >= endTime) {
        vid.pause();
        vid.currentTime = endTime;
        return;
      }
      animFrameRef.current = requestAnimationFrame(checkEnd);
    };
    animFrameRef.current = requestAnimationFrame(checkEnd);
  }, [startTime, endTime]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startPct = timeToPercent(startTime);
  const endPct = timeToPercent(endTime);
  const playheadPct = timeToPercent(currentTime);
  const clipDuration = Math.max(0, endTime - startTime);

  return (
    <div className="space-y-2" data-testid="video-trimmer">
      <div className="rounded-md overflow-hidden bg-black relative">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full max-h-64"
          data-testid="video-trimmer-player"
          preload="auto"
          playsInline
          onLoadedMetadata={() => {
            const vid = videoRef.current;
            if (vid) {
              vid.currentTime = startTime;
            }
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span className="font-mono">{formatTime(currentTime)}</span>
        <button
          onClick={playSelection}
          disabled={disabled}
          className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors text-[10px] font-medium"
          data-testid="button-play-selection"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Preview clip
        </button>
        <span className="font-mono">{formatTime(safeDuration)}</span>
      </div>

      <div
        ref={trackRef}
        className="relative h-14 rounded-md overflow-hidden cursor-pointer select-none touch-none"
        style={{ background: "#1a1a2e" }}
        onClick={handleTrackClick}
        data-testid="trimmer-track"
      >
        {thumbnails.length > 0 && (
          <div className="absolute inset-0 flex">
            {thumbnails.map((thumb, i) => (
              <div
                key={i}
                className="flex-1 h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${thumb})` }}
              />
            ))}
          </div>
        )}

        {isGeneratingThumbs && thumbnails.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[10px] text-muted-foreground animate-pulse">Loading timeline...</div>
          </div>
        )}

        <div
          className="absolute inset-y-0 left-0 bg-black/60 pointer-events-none"
          style={{ width: `${startPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-black/60 pointer-events-none"
          style={{ width: `${100 - endPct}%` }}
        />

        <div
          className="absolute inset-y-0 cursor-grab active:cursor-grabbing"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            borderTop: "2px solid #fbbf24",
            borderBottom: "2px solid #fbbf24",
          }}
          onPointerDown={(e) => handlePointerDown("region", e)}
          data-testid="trimmer-region"
        />

        <div
          className="absolute inset-y-0 flex items-center z-10 cursor-ew-resize"
          style={{ left: `calc(${startPct}% - 10px)`, width: "20px" }}
          onPointerDown={(e) => handlePointerDown("start", e)}
          data-testid="trimmer-handle-start"
        >
          <div className="w-[6px] h-full rounded-l-sm flex items-center justify-center"
            style={{ background: "#fbbf24" }}
          >
            <div className="w-[2px] h-4 bg-black/40 rounded-full" />
          </div>
        </div>

        <div
          className="absolute inset-y-0 flex items-center justify-end z-10 cursor-ew-resize"
          style={{ left: `calc(${endPct}% - 10px)`, width: "20px" }}
          onPointerDown={(e) => handlePointerDown("end", e)}
          data-testid="trimmer-handle-end"
        >
          <div className="w-[6px] h-full rounded-r-sm flex items-center justify-center"
            style={{ background: "#fbbf24" }}
          >
            <div className="w-[2px] h-4 bg-black/40 rounded-full" />
          </div>
        </div>

        {currentTime >= 0 && (
          <div
            className="absolute inset-y-0 w-[2px] bg-white z-20 pointer-events-none"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="text-[10px]">
            <span className="text-muted-foreground">Start: </span>
            <span className="font-mono font-medium text-amber-500">{formatTime(startTime)}</span>
          </div>
          <div className="text-[10px]">
            <span className="text-muted-foreground">End: </span>
            <span className="font-mono font-medium text-amber-500">{formatTime(endTime)}</span>
          </div>
        </div>
        <div className="text-[10px]">
          <span className="text-muted-foreground">Clip: </span>
          <span className="font-mono font-semibold">{clipDuration.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}
