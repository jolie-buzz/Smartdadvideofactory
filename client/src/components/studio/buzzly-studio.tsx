import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  Download,
  FileJson,
  FolderOpen,
  Image,
  Layers3,
  Music2,
  PanelLeftClose,
  Play,
  Plus,
  Save,
  Settings,
  Shuffle,
  Sparkles,
  SquarePlay,
  Type,
  Undo2,
  UserCircle,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SetupForm } from "@/components/setup-form";
import { SetupsList, type AssetMediaUrls } from "@/components/setups-list";
import { JobsList } from "@/components/jobs-list";
import { AssetPanel, type StudioLibraryAsset } from "./asset-panel";
import { AiChatPanel } from "./ai-chat-panel";
import { AiMemoryPanel } from "./ai-memory-panel";
import { AiPipelinePanel } from "./ai-pipeline-panel";
import { AiRouterPanel } from "./ai-router-panel";
import { ClipInspectorPanel } from "./clip-inspector-panel";
import { CreativeBrainPanel } from "./creative-brain-panel";
import { CreativePlanPanel } from "./creative-plan-panel";
import {
  GuidedSetupWizard,
  createInitialGuidedSetupState,
  type GuidedSetupDraft,
  type GuidedSetupState,
  type GuidedShotSlot,
} from "./guided-setup-wizard";
import { FREE_MUSIC_LIBRARY } from "./free-music-library";
import { PerformanceEnginePanel } from "./performance-engine-panel";
import { PreviewPanel } from "./preview-panel";
import { RenderingArchitecturePanel } from "./rendering-architecture-panel";
import { SmartAssetMappingPanel } from "./smart-asset-mapping-panel";
import { SmartSceneGenerationPanel } from "./smart-scene-generation-panel";
import { StudioSettingsPanel } from "./studio-settings-panel";
import type { StudioGoal } from "./studio-onboarding";
import { StyleDnaPanel } from "./style-dna-panel";
import { TeamAccessPanel } from "./team-access-panel";
import { TimelinePanel, type TimelineToolAction, type TimelineTransitionPreset } from "./timeline-panel";
import { WorkspacePanel } from "./workspace-panel";
import type { Asset } from "@shared/schema";
import {
  mockBuzzlyTimeline,
  type BuzzlyAiPipeline,
  type BuzzlyAiMemorySystem,
  type BuzzlyAiPlanScene,
  type BuzzlyAssetCategory,
  type BuzzlyAssetIntelligence,
  type BuzzlyCreativeBrainInput,
  type BuzzlyCreativeBrainOutput,
  type BuzzlyGenerationEngine,
  type BuzzlyGenerationRoute,
  type BuzzlyHybridGeneration,
  type BuzzlyConversationalIntent,
  type BuzzlyPlanningLayer,
  type BuzzlyPerformanceMetric,
  type BuzzlyPerformanceSuggestion,
  type BuzzlyRenderingArchitecture,
  type BuzzlySmartSceneGeneration,
  type BuzzlySmartSceneSuggestion,
  type BuzzlyStyleDnaPreset,
  type BuzzlyTeamMember,
  type BuzzlyTimelineCommand,
  type BuzzlyTimelineItem,
  type BuzzlyTimelineJson,
  type BuzzlyUserPermission,
  type BuzzlyWorkspace,
} from "@shared/models/timeline";

const cloneTimeline = (goal?: StudioGoal | null): BuzzlyTimelineJson => {
  const timeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(mockBuzzlyTimeline));
  const emptyTimeline: BuzzlyTimelineJson = {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({ ...track, items: [] })),
  };
  if (!goal) return emptyTimeline;

  return {
    ...emptyTimeline,
    project: {
      ...emptyTimeline.project,
      name: `${goal.title} Project`,
      format: "tiktok-reel-9x16",
      width: 1080,
      height: 1920,
    },
    creativeBrain: {
      ...emptyTimeline.creativeBrain,
      input: {
        ...emptyTimeline.creativeBrain.input,
        goal: goal.title,
        platform: "TikTok/Reels",
        userIdea: goal.description,
      },
      output: {
        ...emptyTimeline.creativeBrain.output,
        contentStrategy: goal.description,
        hookDirection: goal.setupHint,
      },
    },
    aiPlan: {
      ...emptyTimeline.aiPlan,
      objective: goal.description,
    },
  };
};

type StudioRailId = "studio" | "setup" | "setups" | "jobs" | "settings" | "assets" | "text" | "audio" | "elements" | "ai";
type MobileToolId = Extract<StudioRailId, "text" | "audio" | "elements" | "ai"> | null;

const productionRails = new Set<StudioRailId>(["setup", "setups", "jobs", "settings"]);

const railItems: Array<{ id: StudioRailId; label: string; icon: LucideIcon }> = [
  { id: "studio", label: "Studio", icon: SquarePlay },
  { id: "setup", label: "Setup", icon: Settings },
  { id: "setups", label: "Activate", icon: FolderOpen },
  { id: "jobs", label: "Jobs", icon: Zap },
  { id: "settings", label: "Settings", icon: UserCircle },
  { id: "text", label: "Text", icon: Type },
  { id: "audio", label: "Audio", icon: Music2 },
  { id: "elements", label: "Elements", icon: Layers3 },
  { id: "ai", label: "AI Tools", icon: Bot },
];

type BuzzlyStudioProps = {
  initialGoal?: StudioGoal | null;
  onChangeGoal?: () => void;
};

const MOBILE_TIMELINE_HEIGHT_KEY = "buzzly.mobileTimelineHeightDvh";
const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getInitialMobileTimelineHeight = () => {
  if (typeof window === "undefined") return 34;
  const stored = Number(window.localStorage.getItem(MOBILE_TIMELINE_HEIGHT_KEY));
  return Number.isFinite(stored) ? clampNumber(stored, 24, 52) : 34;
};

const defaultVisualFrame = (type: BuzzlyTimelineItem["type"]) => {
  if (type === "video") return { frameSize: { width: 1, height: 1 }, mediaFit: "cover" as const, scale: 1 };
  if (type === "image") return { frameSize: { width: 0.86, height: 0.86 }, mediaFit: "contain" as const, scale: 1 };
  return {};
};

function effectPatchForPreset(preset: NonNullable<BuzzlyTimelineItem["effectPreset"]>): Partial<BuzzlyTimelineItem> {
  if (preset === "enhance") return { effectPreset: preset, brightness: 1.08, contrast: 1.12, blur: 0 };
  if (preset === "punch") return { effectPreset: preset, brightness: 1.05, contrast: 1.18, blur: 0 };
  if (preset === "vivid") return { effectPreset: preset, brightness: 1.06, contrast: 1.08, blur: 0 };
  if (preset === "warm") return { effectPreset: preset, brightness: 1.04, contrast: 1.06, blur: 0 };
  if (preset === "cool") return { effectPreset: preset, brightness: 1.02, contrast: 1.08, blur: 0 };
  if (preset === "cinematic") return { effectPreset: preset, brightness: 0.94, contrast: 1.18, blur: 0 };
  if (preset === "mono") return { effectPreset: preset, brightness: 1, contrast: 1.12, blur: 0 };
  if (preset === "dream") return { effectPreset: preset, brightness: 1.08, contrast: 0.96, blur: 0.6 };
  if (preset === "soft-blur") return { effectPreset: preset, brightness: 1, contrast: 1, blur: 1.4 };
  return { effectPreset: "none", brightness: 1, contrast: 1, blur: 0 };
}

function effectLabel(preset: NonNullable<BuzzlyTimelineItem["effectPreset"]>) {
  if (preset === "cinematic") return "Cinema";
  if (preset === "mono") return "Mono";
  return preset.charAt(0).toUpperCase() + preset.slice(1);
}

const withContentDuration = (timeline: BuzzlyTimelineJson): BuzzlyTimelineJson => {
  const contentDuration = Math.max(
    timeline.project.duration,
    ...timeline.tracks.flatMap((track) => track.items.map((item) => item.startTime + item.duration)),
  );
  return {
    ...timeline,
    project: {
      ...timeline.project,
      duration: Math.ceil(contentDuration),
    },
  };
};

const readMediaDuration = (file: File): Promise<number | null> => new Promise((resolve) => {
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
    resolve(null);
    return;
  }

  const element = file.type.startsWith("video/")
    ? document.createElement("video")
    : document.createElement("audio");
  const url = URL.createObjectURL(file);
  const cleanup = () => {
    element.removeAttribute("src");
    URL.revokeObjectURL(url);
  };

  element.preload = "metadata";
  element.onloadedmetadata = () => {
    const duration = Number.isFinite(element.duration) && element.duration > 0
      ? Number(element.duration.toFixed(2))
      : null;
    cleanup();
    resolve(duration);
  };
  element.onerror = () => {
    cleanup();
    resolve(null);
  };
  element.src = url;
});

const readRemoteMediaDuration = (uri: string, mediaType: "video" | "audio"): Promise<number | null> => new Promise((resolve) => {
  const element = mediaType === "video"
    ? document.createElement("video")
    : document.createElement("audio");
  const cleanup = () => {
    element.removeAttribute("src");
  };

  element.preload = "metadata";
  element.onloadedmetadata = () => {
    const duration = Number.isFinite(element.duration) && element.duration > 0
      ? Number(element.duration.toFixed(2))
      : null;
    cleanup();
    resolve(duration);
  };
  element.onerror = () => {
    cleanup();
    resolve(null);
  };
  element.src = uri;
});

const mimeTypeFromKey = (key: string, fallback: string) => {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  return fallback;
};

const moveMainVideoClipWithRipple = (timeline: BuzzlyTimelineJson, id: string, desiredStartTime: number): BuzzlyTimelineJson => {
  let didMoveSequenceClip = false;
  const nextTracks = timeline.tracks.map((track) => {
    if (track.id !== "video-main") return track;
    const movingItem = track.items.find((item) => item.id === id && item.type === "video");
    if (!movingItem) return track;

    didMoveSequenceClip = true;
    const dragDirection = desiredStartTime >= movingItem.startTime ? 1 : -1;
    const sortedItems = track.items
      .map((item) => item.id === id ? { ...item, startTime: desiredStartTime } : item)
      .sort((a, b) => {
        const aSort = a.startTime + (a.id === id ? dragDirection * 0.001 : 0);
        const bSort = b.startTime + (b.id === id ? dragDirection * 0.001 : 0);
        return aSort - bSort;
      });

    let cursor = 0;
    return {
      ...track,
      items: sortedItems.map((item) => {
        const nextItem = { ...item, startTime: Number(cursor.toFixed(2)) };
        cursor += item.duration;
        return nextItem;
      }),
    };
  });

  if (!didMoveSequenceClip) return timeline;
  return withContentDuration({ ...timeline, tracks: nextTracks });
};

const sequenceMainVideoTrack = (timeline: BuzzlyTimelineJson): BuzzlyTimelineJson => {
  const nextTracks = timeline.tracks.map((track) => {
    if (track.id !== "video-main") return track;
    let cursor = 0;
    const sequencedVideoItems = track.items
      .filter((item) => item.type === "video")
      .sort((a, b) => a.startTime - b.startTime)
      .map((item) => {
        const nextItem = { ...item, startTime: Number(cursor.toFixed(2)) };
        cursor += item.duration;
        return nextItem;
      });
    const sequencedById = new Map(sequencedVideoItems.map((item) => [item.id, item]));
    return {
      ...track,
      items: track.items
        .map((item) => sequencedById.get(item.id) || item)
        .sort((a, b) => a.startTime - b.startTime),
    };
  });

  return withContentDuration({ ...timeline, tracks: nextTracks });
};

export function BuzzlyStudio({ initialGoal = null, onChangeGoal }: BuzzlyStudioProps) {
  const { toast } = useToast();
  const showStudioSidePanels = false;
  const videoLayerInputRef = useRef<HTMLInputElement | null>(null);
  const imageLayerInputRef = useRef<HTMLInputElement | null>(null);
  const musicLayerInputRef = useRef<HTMLInputElement | null>(null);
  const [timeline, setTimeline] = useState<BuzzlyTimelineJson>(() => cloneTimeline(initialGoal));
  const [undoStack, setUndoStack] = useState<BuzzlyTimelineJson[]>([]);
  const [redoStack, setRedoStack] = useState<BuzzlyTimelineJson[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTimelineItemIds, setSelectedTimelineItemIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [activeRail, setActiveRail] = useState<StudioRailId>(() => initialGoal ? "setup" : "studio");
  const [mobileTool, setMobileTool] = useState<MobileToolId>(null);
  const [mobileTimelineHeight, setMobileTimelineHeight] = useState(getInitialMobileTimelineHeight);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [setupMode, setSetupMode] = useState<"guided" | "form">(() => initialGoal ? "guided" : "form");
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState(false);
  const [lastGuidedDraft, setLastGuidedDraft] = useState<GuidedSetupDraft | null>(null);
  const [guidedSetupState, setGuidedSetupState] = useState<GuidedSetupState>(() => createInitialGuidedSetupState());
  const [activeShotEdit, setActiveShotEdit] = useState<GuidedShotSlot | null>(null);
  const [setupBuilderMode, setSetupBuilderMode] = useState(false);
  const [setupBuilderFiles, setSetupBuilderFiles] = useState<File[]>([]);
  const [setupBuilderTimeline, setSetupBuilderTimeline] = useState<{ assetId: number | null; timeline: BuzzlyTimelineJson } | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<StudioLibraryAsset[]>(() => (
    FREE_MUSIC_LIBRARY.map((track) => ({
      id: track.id,
      type: "audio",
      name: track.title,
      filename: track.filename,
      source: { kind: "remote", uri: track.uri, filename: track.filename, mimeType: "audio/mpeg" },
      origin: "free-music",
      description: track.mood,
    }))
  ));
  const isProductionRail = productionRails.has(activeRail);

  const selectedItem = useMemo(
    () => timeline.tracks.flatMap((track) => track.items).find((item) => item.id === selectedItemId) || null,
    [selectedItemId, timeline],
  );
  const mainVideoClipCount = useMemo(
    () => timeline.tracks.find((track) => track.id === "video-main")?.items.filter((item) => item.type === "video").length || 0,
    [timeline.tracks],
  );
  const setupBuilderMediaCount = useMemo(
    () => timeline.tracks.flatMap((track) => track.items).filter((item) => item.type === "video" || item.type === "image").length,
    [timeline.tracks],
  );
  const mobilePreviewHeight = clampNumber(82 - mobileTimelineHeight, 30, 58);
  const permissions = useMemo(() => getActivePermissions(timeline), [timeline]);
  const activeMember = useMemo(
    () => timeline.userSystem.members.find((member) => member.id === timeline.userSystem.currentUserId) || timeline.userSystem.members[0],
    [timeline.userSystem],
  );

  useEffect(() => {
    window.localStorage.setItem(MOBILE_TIMELINE_HEIGHT_KEY, String(Math.round(mobileTimelineHeight)));
  }, [mobileTimelineHeight]);

  const beginMobileLayoutDrag = (startY: number) => {
    const startHeight = mobileTimelineHeight;
    const applyClientY = (clientY: number) => {
      const viewportHeight = Math.max(1, window.innerHeight);
      const deltaDvh = ((startY - clientY) / viewportHeight) * 100;
      setMobileTimelineHeight(clampNumber(startHeight + deltaDvh, 24, 52));
    };
    const handleMove = (moveEvent: PointerEvent) => applyClientY(moveEvent.clientY);
    const handleTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault();
      const touch = moveEvent.touches[0];
      if (touch) applyClientY(touch.clientY);
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("touchcancel", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    window.addEventListener("pointercancel", handleUp, { once: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleUp, { once: true });
    window.addEventListener("touchcancel", handleUp, { once: true });
  };

  const startMobileLayoutDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    beginMobileLayoutDrag(event.clientY);
  };

  const startMobileLayoutTouchDrag = (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!touch) return;
    event.preventDefault();
    event.stopPropagation();
    beginMobileLayoutDrag(touch.clientY);
  };

  const selectTimelineItem = (id: string) => {
    setSelectedItemId(id);
    setSelectedTimelineItemIds([id]);
  };

  const toggleTimelineItemSelection = (id: string) => {
    setSelectedTimelineItemIds((current) => {
      const next = current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id];
      setSelectedItemId(next[next.length - 1] || null);
      return next;
    });
  };

  const recordHistory = useCallback(() => {
    setUndoStack((stack) => [...stack.slice(-29), JSON.parse(JSON.stringify(timeline))]);
    setRedoStack([]);
  }, [timeline]);

  const undoTimeline = useCallback(() => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setRedoStack((stack) => [JSON.parse(JSON.stringify(timeline)), ...stack.slice(0, 29)]);
    setUndoStack((stack) => stack.slice(0, -1));
    setTimeline(previous);
    setSelectedItemId(previous.tracks.flatMap((track) => track.items).some((item) => item.id === selectedItemId) ? selectedItemId : null);
    toast({ title: "Undo", description: "Last Studio edit reverted." });
  }, [selectedItemId, timeline, toast, undoStack]);

  const redoTimeline = useCallback(() => {
    const next = redoStack[0];
    if (!next) return;
    setUndoStack((stack) => [...stack.slice(-29), JSON.parse(JSON.stringify(timeline))]);
    setRedoStack((stack) => stack.slice(1));
    setTimeline(next);
    setSelectedItemId(next.tracks.flatMap((track) => track.items).some((item) => item.id === selectedItemId) ? selectedItemId : null);
    toast({ title: "Redo", description: "Studio edit restored." });
  }, [redoStack, selectedItemId, timeline, toast]);

  const requirePermission = (permission: BuzzlyUserPermission) => {
    if (permissions.includes(permission)) return true;
    toast({
      title: "Permission needed",
      description: `${activeMember?.role || "viewer"} access cannot use this action.`,
      variant: "destructive",
    });
    return false;
  };

  const updateItem = (id: string, patch: Partial<BuzzlyTimelineItem>) => {
    if (!permissions.includes("edit-project")) return;
    if (Object.keys(patch).length === 0) return;
    recordHistory();
    setTimeline((current) => {
      const shouldCloseVideoGap = current.tracks.some((track) => (
        track.id === "video-main"
        && track.items.some((item) => item.id === id && item.type === "video")
        && ("startTime" in patch || "duration" in patch || "trimStart" in patch || "trimEnd" in patch)
      ));
      const nextTimeline = {
        ...current,
        tracks: current.tracks.map((track) => ({
          ...track,
          items: track.items.map((item) => item.id === id ? { ...item, ...patch } : item),
        })),
      };
      return shouldCloseVideoGap ? sequenceMainVideoTrack(nextTimeline) : nextTimeline;
    });
  };

  const moveTimelineItem = (id: string, startTime: number, ripple = false) => {
    if (!permissions.includes("edit-project")) return;
    recordHistory();
    setTimeline((current) => {
      if (ripple) {
        const rippleTimeline = moveMainVideoClipWithRipple(current, id, startTime);
        if (rippleTimeline !== current) return rippleTimeline;
      }

      return withContentDuration({
        ...current,
        tracks: current.tracks.map((track) => ({
          ...track,
          items: track.items.map((item) => item.id === id ? { ...item, startTime } : item),
        })),
      });
    });
  };

  const addLayerToTimeline = (type: Extract<BuzzlyTimelineItem["type"], "video" | "image" | "audio" | "text">, file?: File) => {
    if (!requirePermission("edit-project")) return;
    const targetTrackType = type;
    const targetTrack = timeline.tracks.find((track) => track.type === targetTrackType);
    if (!targetTrack) {
      toast({ title: "Track missing", description: `No ${type} track is available in this project.`, variant: "destructive" });
      return;
    }

    const isAudio = type === "audio";
    const isText = type === "text";
    const defaultDuration = isAudio ? Math.max(8, timeline.project.duration - currentTime) : isText ? 4 : 5;
    const duration = Math.min(defaultDuration, Math.max(1, timeline.project.duration - currentTime));
    const layerLabel = isText ? "Text layer" : file?.name || `${type} layer`;
    const id = `${type}-layer-${Date.now()}`;
    const newItem: BuzzlyTimelineItem = {
      id,
      type,
      name: layerLabel,
      trackId: targetTrack.id,
      source: file
        ? {
            kind: "local",
            uri: URL.createObjectURL(file),
            filename: file.name,
            mimeType: file.type,
          }
        : undefined,
      text: isText ? "New text" : undefined,
      startTime: currentTime,
      duration,
      trimStart: 0,
      trimEnd: duration,
      volume: isAudio ? 0.38 : type === "video" ? 0.75 : 0,
      position: isAudio ? { x: 0, y: 0 } : { x: 0.5, y: isText ? 0.24 : 0.5 },
      ...defaultVisualFrame(type),
      scale: isText ? 1 : defaultVisualFrame(type).scale || 1,
      opacity: 1,
    };

    recordHistory();
    setTimeline((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === targetTrack.id ? { ...track, items: [...track.items, newItem] } : track),
    }));
    setSelectedItemId(id);
    seekTo(currentTime);
    toast({
      title: `${isAudio ? "Music" : isText ? "Text" : type === "image" ? "Photo" : "Video"} layer added`,
      description: `${layerLabel} is now in the Studio timeline.`,
    });
  };

  const registerAssetFiles = (files: File[]) => {
    const supportedFiles = files.filter((file) => (
      file.type.startsWith("video/")
      || file.type.startsWith("image/")
      || file.type.startsWith("audio/")
    ));
    if (!supportedFiles.length) return;

    setLibraryAssets((current) => {
      const next = [...current];
      supportedFiles.forEach((file) => {
        const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "audio";
        const source = {
          kind: "local" as const,
          uri: URL.createObjectURL(file),
          filename: file.name,
          mimeType: file.type,
        };
        const existingIndex = next.findIndex((asset) => (
          asset.origin === "uploaded"
          && asset.filename === file.name
          && asset.source.mimeType === file.type
        ));
        const asset: StudioLibraryAsset = {
          id: `asset-${type}-${file.name}-${file.size}-${file.lastModified}`,
          type,
          name: file.name.replace(/\.[^/.]+$/, "") || file.name,
          filename: file.name,
          source,
          origin: "uploaded",
        };
        if (existingIndex >= 0) next[existingIndex] = asset;
        else next.unshift(asset);
      });
      return next;
    });
  };

  const addLibraryAssetToTimeline = (asset: StudioLibraryAsset) => {
    if (!requirePermission("edit-project")) return;
    const targetTrack = timeline.tracks.find((track) => track.type === asset.type);
    if (!targetTrack) {
      toast({ title: "Track missing", description: `No ${asset.type} track is available in this project.`, variant: "destructive" });
      return;
    }

    const isAudio = asset.type === "audio";
    const defaultDuration = isAudio ? Math.max(8, timeline.project.duration - currentTime) : asset.type === "image" ? 5 : 6;
    const duration = Math.min(defaultDuration, Math.max(1, timeline.project.duration - currentTime));
    const id = `${asset.type}-library-${Date.now()}`;
    const item: BuzzlyTimelineItem = {
      id,
      type: asset.type,
      name: asset.name,
      trackId: targetTrack.id,
      source: asset.source,
      startTime: isAudio ? 0 : currentTime,
      duration: isAudio ? timeline.project.duration : duration,
      trimStart: 0,
      trimEnd: isAudio ? timeline.project.duration : duration,
      volume: isAudio ? 0.35 : asset.type === "video" ? 0.75 : 0,
      position: isAudio ? { x: 0, y: 0 } : { x: 0.5, y: 0.5 },
      ...defaultVisualFrame(asset.type),
      scale: defaultVisualFrame(asset.type).scale || 1,
      opacity: 1,
    };

    recordHistory();
    setTimeline((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === targetTrack.id ? { ...track, items: [...track.items, item] } : track),
    }));
    setSelectedItemId(id);
    seekTo(item.startTime);
    toast({ title: "Asset added to timeline", description: `${asset.name} is ready to edit in Studio.` });
  };

  const handleLayerFileUpload = (type: Extract<BuzzlyTimelineItem["type"], "video" | "image" | "audio">, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    registerAssetFiles([file]);
    addLayerToTimeline(type, file);
  };

  const handleTimelineToolAction = (tool: TimelineToolAction) => {
    if (!requirePermission("edit-project")) return;
    if (tool === "cut-dead-air") {
      const videoTrack = timeline.tracks.find((track) => track.id === "video-main");
      const sortedVideos = [...(videoTrack?.items || [])]
        .filter((item) => item.type === "video")
        .sort((a, b) => a.startTime - b.startTime);
      const gapCount = sortedVideos.reduce((count, item, index) => {
        if (index === 0) return count + (item.startTime > 0.05 ? 1 : 0);
        const previous = sortedVideos[index - 1];
        return count + (item.startTime - (previous.startTime + previous.duration) > 0.05 ? 1 : 0);
      }, 0);

      if (!sortedVideos.length) {
        toast({ title: "No video clips", description: "Upload or select video clips before cutting dead air." });
        return;
      }
      if (gapCount === 0) {
        toast({ title: "No dead air found", description: "Your main video track is already continuous." });
        return;
      }

      recordHistory();
      setTimeline((current) => sequenceMainVideoTrack(current));
      seekTo(0);
      toast({ title: "Dead air removed", description: `${gapCount} blank gap${gapCount === 1 ? "" : "s"} closed in the video track.` });
      return;
    }

    if (!selectedItem) {
      toast({ title: "Select a clip first", description: "Choose a timeline clip before using this tool." });
      return;
    }

    if (tool === "delete") {
      recordHistory();
      setTimeline((current) => {
        const isMainVideoItem = current.tracks.some((track) => (
          track.id === "video-main" && track.items.some((item) => item.id === selectedItem.id && item.type === "video")
        ));
        const nextTimeline = {
          ...current,
          tracks: current.tracks.map((track) => ({
            ...track,
            items: track.items.filter((item) => item.id !== selectedItem.id),
          })),
        };
        return isMainVideoItem ? sequenceMainVideoTrack(nextTimeline) : nextTimeline;
      });
      setSelectedItemId(null);
      toast({ title: "Clip deleted", description: `${selectedItem.name} was removed from the timeline.` });
      return;
    }

    if (tool === "duplicate") {
      const clone: BuzzlyTimelineItem = {
        ...selectedItem,
        id: `${selectedItem.id}-duplicate-${Date.now()}`,
        name: `${selectedItem.name} copy`,
        startTime: Math.min(timeline.project.duration - selectedItem.duration, selectedItem.startTime + 0.6),
      };
      recordHistory();
      setTimeline((current) => {
        const isMainVideoItem = current.tracks.some((track) => (
          track.id === "video-main" && track.items.some((item) => item.id === selectedItem.id && item.type === "video")
        ));
        const nextTimeline = {
          ...current,
          tracks: current.tracks.map((track) => (
            track.id === selectedItem.trackId ? { ...track, items: [...track.items, clone] } : track
          )),
        };
        return isMainVideoItem ? sequenceMainVideoTrack(nextTimeline) : nextTimeline;
      });
      setSelectedItemId(clone.id);
      seekTo(clone.startTime);
      toast({ title: "Clip duplicated", description: `${selectedItem.name} was copied for another beat.` });
      return;
    }

    if (tool === "split") {
      const splitOffset = Number((currentTime - selectedItem.startTime).toFixed(2));
      if (splitOffset <= 0.15 || splitOffset >= selectedItem.duration - 0.5) {
        toast({
          title: "Move playhead inside the clip",
          description: "Click the exact point inside the selected clip, then press Split.",
        });
        return;
      }
      const firstDuration = Math.max(0.15, splitOffset);
      const secondDuration = Math.max(0.5, selectedItem.duration - firstDuration);
      const baseName = selectedItem.name.replace(/\s+(part\s+\d+|cut)+$/i, "").trim() || selectedItem.name;
      const leftClip: BuzzlyTimelineItem = {
        ...selectedItem,
        name: `${baseName} part 1`,
        duration: firstDuration,
        trimEnd: Number((selectedItem.trimStart + firstDuration).toFixed(2)),
      };
      const clone: BuzzlyTimelineItem = {
        ...selectedItem,
        id: `${selectedItem.id}-split-${Date.now()}`,
        name: `${baseName} part 2`,
        startTime: Number((selectedItem.startTime + firstDuration).toFixed(2)),
        duration: secondDuration,
        trimStart: Number((selectedItem.trimStart + firstDuration).toFixed(2)),
        trimEnd: selectedItem.trimEnd,
      };

      recordHistory();
      setTimeline((current) => {
        const isMainVideoItem = current.tracks.some((track) => (
          track.id === "video-main" && track.items.some((item) => item.id === selectedItem.id && item.type === "video")
        ));
        const nextTimeline = {
          ...current,
          tracks: current.tracks.map((track) => ({
            ...track,
            items: track.items.flatMap((item) => item.id === selectedItem.id ? [leftClip, clone] : [item]),
          })),
        };
        return isMainVideoItem ? sequenceMainVideoTrack(nextTimeline) : nextTimeline;
      });
      setSelectedItemId(clone.id);
      seekTo(Number((clone.startTime + 0.03).toFixed(2)));
      toast({ title: "Clip split", description: `${selectedItem.name} was split into two editable clips.` });
      return;
    }

    if (tool === "zoom-in") {
      updateItem(selectedItem.id, { scale: Math.min(2.5, Number((selectedItem.scale + 0.12).toFixed(2))) });
      toast({ title: "Zoomed in", description: `${selectedItem.name} has a tighter frame.` });
      return;
    }

    if (tool === "zoom-out") {
      updateItem(selectedItem.id, { scale: Math.max(0.45, Number((selectedItem.scale - 0.12).toFixed(2))) });
      toast({ title: "Zoomed out", description: `${selectedItem.name} has more frame visible.` });
      return;
    }

    if (tool === "zoom-in-motion" || tool === "zoom-out-motion") {
      if (selectedItem.type !== "video" && selectedItem.type !== "image") {
        toast({ title: "Select a visual clip", description: "Animated zoom works on video or image clips." });
        return;
      }
      const startScale = tool === "zoom-in-motion" ? Math.max(1, selectedItem.scale) : Math.min(1.25, Math.max(1.08, selectedItem.scale));
      const endScale = tool === "zoom-in-motion" ? Math.min(2.2, Number((startScale + 0.32).toFixed(2))) : 1;
      updateItem(selectedItem.id, {
        scale: startScale,
        zoomAnimation: {
          enabled: true,
          startScale,
          endScale,
        },
      });
      toast({
        title: tool === "zoom-in-motion" ? "Zoom-in motion added" : "Zoom-out motion added",
        description: `${selectedItem.name} will animate across the clip.`,
      });
      return;
    }

    if (tool === "fit") {
      updateItem(selectedItem.id, {
        position: { x: 0.5, y: 0.5 },
        frameSize: selectedItem.type === "video" || selectedItem.type === "image" ? { width: 1, height: 1 } : selectedItem.frameSize,
        mediaFit: selectedItem.type === "video" || selectedItem.type === "image" ? "contain" : selectedItem.mediaFit,
        scale: 1,
        rotation: 0,
      });
      toast({ title: "Fit to frame", description: `${selectedItem.name} was centered and reset to normal scale.` });
      return;
    }

    if (tool === "fade") {
      const nextOpacity = selectedItem.opacity >= 0.95 ? 0.72 : 1;
      updateItem(selectedItem.id, { opacity: nextOpacity });
      toast({ title: nextOpacity < 1 ? "Fade applied" : "Fade removed", description: `${selectedItem.name} opacity updated.` });
      return;
    }

    if (tool === "speed") {
      const currentRate = selectedItem.playbackRate || 1;
      const nextRate = currentRate === 1 ? 1.25 : currentRate === 1.25 ? 1.5 : 1;
      updateItem(selectedItem.id, { playbackRate: nextRate });
      return;
    }

    if (tool === "enhance") {
      const isEnhanced = selectedItem.effectPreset === "enhance";
      updateItem(selectedItem.id, {
        effectPreset: isEnhanced ? "none" : "enhance",
        brightness: isEnhanced ? 1 : 1.08,
        contrast: isEnhanced ? 1 : 1.12,
        blur: 0,
      });
      toast({ title: isEnhanced ? "Enhance removed" : "Enhance applied", description: `${selectedItem.name} visual treatment updated.` });
      return;
    }

    const effectMap: Partial<Record<TimelineToolAction, NonNullable<BuzzlyTimelineItem["effectPreset"]>>> = {
      "effect-none": "none",
      "effect-punch": "punch",
      "effect-vivid": "vivid",
      "effect-warm": "warm",
      "effect-cool": "cool",
      "effect-cinematic": "cinematic",
      "effect-mono": "mono",
      "effect-dream": "dream",
    };
    const effectPreset = effectMap[tool];
    if (effectPreset) {
      if (selectedItem.type !== "video" && selectedItem.type !== "image") {
        toast({ title: "Select a visual clip", description: "Effects work on video or image clips." });
        return;
      }
      const currentPreset = selectedItem.effectPreset || "none";
      const isActive = currentPreset === effectPreset;
      updateItem(selectedItem.id, isActive ? effectPatchForPreset("none") : effectPatchForPreset(effectPreset));
      toast({
        title: isActive || effectPreset === "none" ? "Effect removed" : `${effectLabel(effectPreset)} effect added`,
        description: `${selectedItem.name} visual style updated.`,
      });
      return;
    }

    if (tool === "reset") {
      updateItem(selectedItem.id, {
        scale: 1,
        opacity: 1,
        position: { x: 0.5, y: 0.5 },
        rotation: 0,
        playbackRate: 1,
        brightness: 1,
        contrast: 1,
        blur: 0,
        effectPreset: "none",
        transitionIn: "none",
        transitionOut: "none",
        transitionDuration: 0.35,
        zoomAnimation: { enabled: false, startScale: 1, endScale: 1 },
      });
      toast({ title: "Clip reset", description: `${selectedItem.name} edit settings were reset.` });
      return;
    }

    updateItem(selectedItem.id, { volume: selectedItem.volume <= 0.05 ? 0.75 : selectedItem.volume });
    toast({ title: "Volume ready", description: "Use the timeline slider to adjust clip volume." });
  };

  const applyTransitionBetweenClips = (leftId: string, rightId: string, preset: TimelineTransitionPreset) => {
    if (!requirePermission("edit-project")) return;
    const left = timeline.tracks.flatMap((track) => track.items).find((item) => item.id === leftId);
    const right = timeline.tracks.flatMap((track) => track.items).find((item) => item.id === rightId);
    if (!left || !right) return;

    const transitionIn = preset === "slide" ? "slide-up" : preset;
    const transitionOut = preset === "slide" ? "slide-down" : preset;
    recordHistory();
    setTimeline((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        items: track.items.map((item) => {
          if (item.id === leftId) {
            return {
              ...item,
              transitionOut,
              transitionDuration: preset === "none" ? 0.35 : 0.45,
            };
          }
          if (item.id === rightId) {
            return {
              ...item,
              transitionIn,
              transitionDuration: preset === "none" ? 0.35 : 0.45,
            };
          }
          return item;
        }),
      })),
    }));
    toast({
      title: preset === "none" ? "Transition removed" : `${preset === "slide" ? "Slide" : preset} transition added`,
      description: `${left.name} to ${right.name}`,
    });
  };

  const generateAiTransitionBetweenClips = async (leftId: string, rightId: string, prompt: string, seconds: number) => {
    if (!requirePermission("edit-project")) return;
    const videoTrack = timeline.tracks.find((track) => track.items.some((item) => item.id === leftId || item.id === rightId));
    const left = videoTrack?.items.find((item) => item.id === leftId);
    const right = videoTrack?.items.find((item) => item.id === rightId);
    if (!videoTrack || !left || !right) return;

    toast({ title: "Generating transition", description: "Gemini/Veo is creating a short transition clip." });
    const res = await fetch("/api/gemini/video-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, seconds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gemini transition failed (${res.status})`);
    }
    const data = await res.json();
    const startTime = Number((left.startTime + left.duration).toFixed(2));
    const duration = Number(data.durationSec || seconds);
    const id = `ai-transition-${Date.now()}`;
    const transitionItem: BuzzlyTimelineItem = {
      id,
      type: "video",
      name: "AI transition",
      trackId: videoTrack.id,
      source: {
        kind: "generated",
        uri: data.url,
        filename: data.filename || "gemini-transition.mp4",
        mimeType: "video/mp4",
      },
      startTime,
      duration,
      trimStart: 0,
      trimEnd: duration,
      volume: 0.25,
      position: { x: 0.5, y: 0.5 },
      scale: 1,
      opacity: 1,
      editNotes: prompt,
    };

    recordHistory();
    setTimeline((current) => ({
      ...current,
      project: {
        ...current.project,
        duration: Math.max(current.project.duration, startTime + duration),
      },
      tracks: current.tracks.map((track) => (
        track.id === videoTrack.id
          ? {
              ...track,
              items: [
                ...track.items.map((item) => (
                  item.startTime >= right.startTime ? { ...item, startTime: Number((item.startTime + duration).toFixed(2)) } : item
                )),
                transitionItem,
              ].sort((a, b) => a.startTime - b.startTime),
            }
          : track
      )),
    }));
    setSelectedItemId(id);
    seekTo(startTime);
    toast({ title: "AI transition added", description: "Generated clip was inserted between the shots." });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      const modifier = event.metaKey || event.ctrlKey;
      if (activeRail === "studio" && event.code === "Space") {
        event.preventDefault();
        setIsPlaying((value) => {
          if (!value) window.dispatchEvent(new Event("buzzly-prime-audio"));
          return !value;
        });
        return;
      }
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoTimeline();
        else undoTimeline();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedItem) {
        event.preventDefault();
        handleTimelineToolAction("delete");
        return;
      }
      if (event.key.toLowerCase() === "s" && selectedItem) {
        event.preventDefault();
        handleTimelineToolAction("split");
        return;
      }
      if (modifier && event.key.toLowerCase() === "d" && selectedItem) {
        event.preventDefault();
        handleTimelineToolAction("duplicate");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeRail, currentTime, redoTimeline, selectedItem, undoTimeline]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = window.setInterval(() => {
      setCurrentTime((time) => {
        const nextTime = Number((time + 0.1).toFixed(1));
        if (nextTime >= timeline.project.duration) {
          setIsPlaying(false);
          return timeline.project.duration;
        }
        return nextTime;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [isPlaying, timeline.project.duration]);

  useEffect(() => {
    setCurrentTime((time) => Math.min(time, timeline.project.duration));
  }, [timeline.project.duration]);

  const seekTo = (time: number) => {
    setCurrentTime(Math.min(Math.max(0, time), timeline.project.duration));
  };

  const updateCreativeBrainInput = (patch: Partial<BuzzlyCreativeBrainInput>) => {
    setTimeline((current) => ({
      ...current,
      creativeBrain: {
        ...current.creativeBrain,
        input: { ...current.creativeBrain.input, ...patch },
      },
    }));
  };

  const generateCreativeDirection = () => {
    if (!requirePermission("generate-assets")) return;
    const input = timeline.creativeBrain.input;
    const output = buildCreativeDirection(input);
    const plan = buildCreativePlan(input, output);
    const isLandscape = input.platform.toLowerCase().includes("youtube");

    setTimeline((current) => ({
      ...current,
      project: {
        ...current.project,
        name: `${input.product || "Buzzly"} ${input.goal || "Campaign"}`,
        format: isLandscape ? "landscape-16x9" : "tiktok-reel-9x16",
        width: isLandscape ? 1920 : 1080,
        height: isLandscape ? 1080 : 1920,
      },
      creativeBrain: {
        ...current.creativeBrain,
        output,
      },
      planningLayer: plan,
      smartSceneGeneration: buildSmartSceneGeneration({
        ...current,
        creativeBrain: {
          ...current.creativeBrain,
          output,
        },
        planningLayer: plan,
      }),
      aiPlan: {
        ...current.aiPlan,
        objective: output.contentStrategy,
        scenes: current.aiPlan.scenes.map((scene, index) => ({
          ...scene,
          goal: output.flow[index] || scene.goal,
          script: index === 0 ? output.hookDirection : scene.script,
          captionText: index === 0 ? output.hookDirection : scene.captionText,
          clipSelection: output.visualsNeeded.slice(index * 2, index * 2 + 2),
        })),
      },
    }));

    toast({
      title: "Creative direction generated",
      description: "Buzzly mapped the strategy before editing the timeline.",
    });
  };

  const applyCreativePlan = () => {
    if (!requirePermission("edit-project")) return;
    setTimeline((current) => applyPlanToTimeline(current, current.planningLayer));
    seekTo(0);
    toast({
      title: "Creative Plan applied",
      description: "Buzzly rebuilt the script spine around Hook, Problem, Solution, Highlight, and CTA.",
    });
  };

  const scanAssets = () => {
    setTimeline((current) => ({
      ...current,
      assetIntelligence: buildSmartAssetMapping(current),
      smartSceneGeneration: buildSmartSceneGeneration({
        ...current,
        assetIntelligence: buildSmartAssetMapping(current),
      }),
    }));

    toast({
      title: "Smart Asset Mapping complete",
      description: "Buzzly categorized the assets and flagged missing creative coverage.",
    });
  };

  const routeGenerationEngines = () => {
    if (!requirePermission("generate-assets")) return;
    setTimeline((current) => ({
      ...current,
      hybridGeneration: buildHybridGenerationRoutes(current),
    }));

    toast({
      title: "AI Router updated",
      description: "Buzzly picked engines for image, video, and voice generation.",
    });
  };

  const generateSmartScenes = () => {
    if (!requirePermission("generate-assets")) return;
    const result = applySmartSceneGeneration(timeline);
    setTimeline(result.timeline);
    if (result.seekTo !== undefined) seekTo(result.seekTo);
    toast({
      title: "Smart scenes generated",
      description: result.summary,
    });
  };

  const analyzePerformance = () => {
    setTimeline((current) => ({
      ...current,
      performanceEngine: buildPerformanceEngine(current),
    }));

    toast({
      title: "Creative analysis complete",
      description: "Buzzly scored hook, retention, pacing, CTA, subtitles, emotion, and audio energy.",
    });
  };

  const applyPerformanceSuggestion = (suggestion: BuzzlyPerformanceSuggestion) => {
    if (!requirePermission("edit-project")) return;
    const result = applyTimelineCommand(timeline, suggestion.timelinePrompt.toLowerCase(), selectedItemId);
    const nextPerformance = buildPerformanceEngine(result.timeline);

    setTimeline({
      ...result.timeline,
      performanceEngine: {
        ...nextPerformance,
        suggestions: nextPerformance.suggestions.map((item) => item.command === suggestion.command ? { ...item, status: "applied" } : item),
      },
    });
    if (result.seekTo !== undefined) seekTo(result.seekTo);
    toast({
      title: "Performance fix applied",
      description: suggestion.title,
    });
  };

  const applyStyleDna = (preset: BuzzlyStyleDnaPreset) => {
    if (!requirePermission("generate-assets")) return;
    const nextTimeline = applyStyleDnaPreset(timeline, preset);
    setTimeline(nextTimeline);
    seekTo(0);
    toast({
      title: "Style DNA applied",
      description: `${preset.name} updated pacing, captions, hook tone, and CTA behavior.`,
    });
  };

  const createStyleFromCurrent = () => {
    if (!requirePermission("manage-style-dna")) return;
    setTimeline((current) => createStyleDnaFromCurrent(current));
    toast({
      title: "Brand DNA created",
      description: "Admin preset saved from the current creative direction.",
    });
  };

  const switchTeamMember = (member: BuzzlyTeamMember) => {
    setTimeline((current) => ({
      ...current,
      userSystem: {
        ...current.userSystem,
        currentUserId: member.id,
        currentRole: member.role,
      },
    }));
    toast({
      title: `${member.role} mode active`,
      description: `${member.name} permissions are now applied.`,
    });
  };

  const switchWorkspace = (workspace: BuzzlyWorkspace) => {
    setTimeline((current) => ({
      ...current,
      workspaceSystem: {
        ...current.workspaceSystem,
        activeWorkspaceId: workspace.id,
      },
    }));
    toast({
      title: "Workspace switched",
      description: `${workspace.name} is now active.`,
    });
  };

  const applyWorkspace = () => {
    if (!requirePermission("manage-workspace")) return;
    const nextTimeline = applyWorkspaceToProject(timeline);
    setTimeline(nextTimeline);
    toast({
      title: "Workspace applied",
      description: "Client brand voice, colors, prompts, styles, and templates are now connected.",
    });
  };

  const applyAiMemory = () => {
    if (!requirePermission("generate-assets")) return;
    const nextTimeline = applyAiMemoryToProject(timeline);
    setTimeline(nextTimeline);
    seekTo(0);
    toast({
      title: "AI Memory applied",
      description: `${timeline.aiMemorySystem.profileName} adjusted pacing, hooks, captions, voice, and CTA.`,
    });
  };

  const learnFromCurrentEdit = () => {
    setTimeline((current) => ({
      ...current,
      aiMemorySystem: learnMemoryFromTimeline(current),
    }));
    toast({
      title: "AI Memory updated",
      description: "Buzzly learned from the current edit and performance profile.",
    });
  };

  const optimizeRenderSpeed = () => {
    setTimeline((current) => optimizeTimelineForSpeed(current));
    toast({
      title: "Render speed optimized",
      description: "Buzzly locked the edit to short vertical export, lightweight effects, and faster packaging.",
    });
  };

  const runSuggestedPipeline = () => {
    if (!requirePermission("generate-assets")) return;
    const result = runAiPipeline(timeline);
    setTimeline(result.timeline);
    seekTo(0);
    toast({
      title: "AI Pipeline complete",
      description: result.summary,
    });
  };

  const runAiTimelineCommand = (prompt: string) => {
    if (!requirePermission("edit-project")) return;
    const command = prompt.toLowerCase();
    const result = applyTimelineCommand(timeline, command, selectedItemId);

    setTimeline(result.timeline);
    if (result.seekTo !== undefined) seekTo(result.seekTo);
    toast({ title: "AI timeline edit applied", description: result.summary });
  };

  const applyMockAiEdit = () => {
    runAiTimelineCommand(aiPrompt);
    setAiPrompt("");
  };

  const selectAsset = (id: string) => {
    const libraryAsset = libraryAssets.find((asset) => asset.id === id);
    if (libraryAsset) {
      addLibraryAssetToTimeline(libraryAsset);
      return;
    }

    setSelectedItemId(id);
    const item = timeline.tracks.flatMap((track) => track.items).find((timelineItem) => timelineItem.id === id);
    if (item) seekTo(item.startTime);
    toast({ title: "Asset selected", description: item?.name || "Selected asset on the timeline." });
  };

  const navigateRail = (rail: StudioRailId) => {
    if (rail !== "setup") setEditingAsset(null);
    setActiveRail(rail);
  };

  const handleEditSetup = (asset: Asset) => {
    setEditingAsset(asset);
    setSetupMode("form");
    setActiveRail("setup");
  };

  const handleOpenSetupInStudio = async (asset: Asset, media?: AssetMediaUrls) => {
    if (!requirePermission("edit-project")) return;
    try {
      if (setupBuilderTimeline?.assetId === asset.id) {
        const restoredTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(setupBuilderTimeline.timeline));
        const restoredItems = restoredTimeline.tracks.flatMap((track) => track.items);
        setTimeline(restoredTimeline);
        setEditingAsset(asset);
        setSetupBuilderMode(true);
        setSetupMode("form");
        setSelectedItemId(restoredItems.find((item) => item.type === "video")?.id || restoredItems[0]?.id || null);
        seekTo(0);
        setActiveRail("studio");
        toast({ title: "Reopened Studio edits", description: "Your current unsaved timeline edits are still here." });
        return;
      }

      if (asset.timelineJson && typeof asset.timelineJson === "object") {
        const savedTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(asset.timelineJson));
        const savedItems = savedTimeline.tracks.flatMap((track) => track.items);
        setTimeline(savedTimeline);
        setSetupBuilderTimeline({ assetId: asset.id, timeline: savedTimeline });
        setEditingAsset(asset);
        setSetupBuilderMode(true);
        setSetupMode("form");
        setSelectedItemId(savedItems.find((item) => item.type === "video")?.id || savedItems[0]?.id || null);
        seekTo(0);
        setActiveRail("studio");
        toast({ title: "Opened saved Studio timeline", description: `${asset.name} timeline edits were restored.` });
        return;
      }

      const mediaUrls = media ?? await fetch("/api/assets/media-urls", { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error("Could not load asset media URLs");
          return res.json() as Promise<Record<number, AssetMediaUrls>>;
        })
        .then((urls) => urls[asset.id]);

      if (!mediaUrls?.videoUrl && !mediaUrls?.photoUrl && !mediaUrls?.musicUrl) {
        toast({ title: "No media found", description: "This setup has no recoverable media attached yet.", variant: "destructive" });
        return;
      }

      const videoDuration = mediaUrls.videoUrl
        ? await readRemoteMediaDuration(mediaUrls.videoUrl, "video")
        : null;
      const audioDuration = mediaUrls.musicUrl
        ? await readRemoteMediaDuration(mediaUrls.musicUrl, "audio")
        : null;
      const visualDuration = videoDuration || 8;
      const projectDuration = Math.ceil(Math.max(visualDuration, audioDuration || 0, 8));
      const videoItems: BuzzlyTimelineItem[] = [];
      const imageItems: BuzzlyTimelineItem[] = [];
      const audioItems: BuzzlyTimelineItem[] = [];

      if (mediaUrls.videoUrl) {
        videoItems.push({
          id: `recovered-video-${asset.id}`,
          type: "video",
          name: asset.name,
          trackId: "video-main",
          source: {
            kind: "remote",
            uri: mediaUrls.videoUrl,
            filename: asset.videoKey.split("/").pop() || asset.videoKey,
            mimeType: mimeTypeFromKey(asset.videoKey, "video/mp4"),
          },
          startTime: 0,
          duration: visualDuration,
          trimStart: 0,
          trimEnd: visualDuration,
          volume: 0.8,
          position: { x: 0.5, y: 0.5 },
          ...defaultVisualFrame("video"),
          opacity: 1,
        });
      }

      if (mediaUrls.photoUrl) {
        imageItems.push({
          id: `recovered-photo-${asset.id}`,
          type: "image",
          name: `${asset.name} photo`,
          trackId: "image-overlays",
          source: {
            kind: "remote",
            uri: mediaUrls.photoUrl,
            filename: asset.photoKey.split("/").pop() || asset.photoKey,
            mimeType: mimeTypeFromKey(asset.photoKey, "image/jpeg"),
          },
          startTime: mediaUrls.videoUrl ? Math.max(0, visualDuration - 4) : 0,
          duration: mediaUrls.videoUrl ? 4 : visualDuration,
          trimStart: 0,
          trimEnd: mediaUrls.videoUrl ? 4 : visualDuration,
          volume: 0,
          position: { x: 0.5, y: 0.5 },
          ...defaultVisualFrame("image"),
          opacity: 1,
        });
      }

      if (mediaUrls.musicUrl) {
        audioItems.push({
          id: `recovered-music-${asset.id}`,
          type: "audio",
          name: `${asset.name} music`,
          trackId: "audio-main",
          source: {
            kind: "remote",
            uri: mediaUrls.musicUrl,
            filename: asset.musicKey?.split("/").pop() || asset.musicKey || "music.mp3",
            mimeType: mimeTypeFromKey(asset.musicKey || "", "audio/mpeg"),
          },
          startTime: 0,
          duration: Math.min(audioDuration || projectDuration, projectDuration),
          trimStart: 0,
          trimEnd: Math.min(audioDuration || projectDuration, projectDuration),
          volume: asset.musicVolume ?? 0.3,
          position: { x: 0.5, y: 0.5 },
          scale: 1,
          opacity: 1,
        });
      }

      setTimeline((current) => {
        const nextTimeline: BuzzlyTimelineJson = {
          ...current,
          project: {
            ...current.project,
            name: asset.name,
            duration: projectDuration,
          },
          tracks: current.tracks.map((track) => {
            if (track.id === "video-main") return { ...track, items: videoItems };
            if (track.id === "image-overlays") return { ...track, items: imageItems };
            if (track.id === "audio-main") return { ...track, items: audioItems };
            if (track.type === "text" || track.type === "caption") return { ...track, items: [] };
            return { ...track, items: [] };
          }),
        };
        return {
          ...nextTimeline,
          assetIntelligence: buildSmartAssetMapping(nextTimeline),
          smartSceneGeneration: buildSmartSceneGeneration({
            ...nextTimeline,
            assetIntelligence: buildSmartAssetMapping(nextTimeline),
          }),
        };
      });
      setEditingAsset(asset);
      setSetupBuilderMode(true);
      setSetupMode("form");
      setSelectedItemId(videoItems[0]?.id || imageItems[0]?.id || audioItems[0]?.id || null);
      seekTo(0);
      setActiveRail("studio");
      toast({ title: "Opened in Studio", description: `${asset.name} media is ready to preview and edit.` });
    } catch (err: any) {
      toast({ title: "Could not open Studio", description: err.message, variant: "destructive" });
    }
  };

  const handleSetupComplete = () => {
    setEditingAsset(null);
    setActiveRail("setups");
  };

  const handleCancelSetupEdit = () => {
    setEditingAsset(null);
    setActiveRail("setups");
  };

  const handleUploadPlaceholder = () => {
    toast({ title: "Choose files", description: "You can add video, image, or audio files to this editor." });
  };

  const handleFilesUpload = async (files: FileList) => {
    if (!requirePermission("edit-project")) return;
    const uploadedFiles = Array.from(files);
    const supportedFiles = uploadedFiles.filter((file) => (
      file.type.startsWith("video/")
      || file.type.startsWith("image/")
      || file.type.startsWith("audio/")
    ));

    if (!supportedFiles.length) {
      toast({ title: "Unsupported file", description: "Please upload a video, image, or audio file.", variant: "destructive" });
      return;
    }

    registerAssetFiles(supportedFiles);
    const durationByFile = new Map<File, number>();
    await Promise.all(supportedFiles.map(async (file) => {
      const mediaDuration = await readMediaDuration(file);
      if (mediaDuration) durationByFile.set(file, mediaDuration);
    }));
    const uploadedVideos = supportedFiles.filter((file) => file.type.startsWith("video/"));
    if (setupBuilderMode && uploadedVideos.length) {
      setSetupBuilderFiles((current) => {
        const next = new Map(current.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
        uploadedVideos.forEach((file) => next.set(`${file.name}-${file.size}-${file.lastModified}`, file));
        return Array.from(next.values());
      });
    }

    let firstUploadedId: string | null = null;
    let firstUploadedStart = currentTime;
    setTimeline((current) => {
      const shouldReplaceStarterVisuals = shouldUseUploadedProjectName(current.project.name)
        && supportedFiles.some((file) => file.type.startsWith("video/") || file.type.startsWith("image/"));
      let nextTimeline: BuzzlyTimelineJson = shouldReplaceStarterVisuals
        ? {
            ...current,
            tracks: current.tracks.map((track) => (
              track.type === "video" || track.type === "image"
                ? { ...track, items: track.items.filter((item) => item.source?.kind !== "mock") }
                : track
            )),
          }
        : current;

      let nextVideoStart = Math.max(
        0,
        ...nextTimeline.tracks
          .find((track) => track.id === "video-main" || track.type === "video")
          ?.items
          .filter((item) => item.type === "video")
          .map((item) => item.startTime + item.duration) || [0],
      );
      supportedFiles.forEach((file, index) => {
        const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "audio";
        const trackId = type === "video" ? "video-main" : type === "image" ? "image-overlays" : "audio-main";
        const startTime = type === "audio"
          ? 0
          : type === "video"
            ? (shouldReplaceStarterVisuals && nextVideoStart === 0 ? 0 : nextVideoStart)
            : shouldReplaceStarterVisuals ? 0 : Math.min(current.project.duration - 1, currentTime + index * 2);
        const duration = type === "image"
          ? 5
          : type === "audio"
            ? (durationByFile.get(file) || current.project.duration)
            : (durationByFile.get(file) || 6);
        const id = `${type}-${Date.now()}-${index}`;
        const item: BuzzlyTimelineItem = {
          id,
          type,
          name: file.name.replace(/\.[^/.]+$/, "") || file.name,
          trackId,
          source: {
            kind: "local",
            uri: URL.createObjectURL(file),
            filename: file.name,
            mimeType: file.type,
          },
          startTime,
          duration,
          trimStart: 0,
          trimEnd: duration,
          volume: type === "audio" ? 0.75 : type === "video" ? 0.8 : 0,
          position: { x: 0.5, y: 0.5 },
          ...defaultVisualFrame(type),
          scale: defaultVisualFrame(type).scale || 1,
          opacity: 1,
        };

        if (!firstUploadedId) {
          firstUploadedId = id;
          firstUploadedStart = startTime;
        }
        if (type === "video") nextVideoStart = Number((startTime + duration).toFixed(2));
        nextTimeline = {
          ...nextTimeline,
          tracks: nextTimeline.tracks.map((track) => (
            track.id === trackId ? { ...track, items: [...track.items, item] } : track
          )),
        };
      });

      nextTimeline = sequenceMainVideoTrack(nextTimeline);
      const contentDuration = Math.max(
        nextTimeline.project.duration,
        ...nextTimeline.tracks.flatMap((track) => track.items.map((item) => item.startTime + item.duration)),
      );

      return {
        ...nextTimeline,
        project: {
          ...nextTimeline.project,
          duration: Math.ceil(contentDuration),
          name: shouldUseUploadedProjectName(nextTimeline.project.name)
            ? supportedFiles[0].name.replace(/\.[^/.]+$/, "") || "Buzzly Project"
            : nextTimeline.project.name,
        },
        assetIntelligence: buildSmartAssetMapping(nextTimeline),
        smartSceneGeneration: buildSmartSceneGeneration({
          ...nextTimeline,
          assetIntelligence: buildSmartAssetMapping(nextTimeline),
        }),
      };
    });

    if (firstUploadedId) {
      setSelectedItemId(firstUploadedId);
      seekTo(firstUploadedStart);
    }

    toast({
      title: "Uploaded to editor",
      description: `${supportedFiles.length} file${supportedFiles.length === 1 ? "" : "s"} added to assets and timeline.`,
    });
  };

  const handleToolAction = (tool: "brain" | "panel" | "text" | "image") => {
    if (tool === "brain") {
      generateCreativeDirection();
      return;
    }
    if (tool === "panel") {
      setLeftPanelOpen((value) => !value);
      return;
    }
    if (tool === "text") {
      setActiveRail("text");
      setSelectedItemId("hook-text");
      seekTo(0);
      toast({ title: "Text layer selected", description: "Edit captions and text from the Text panel." });
      return;
    }
    setActiveRail("assets");
    setSelectedItemId("product-packshot");
    seekTo(14);
    toast({ title: "Image layer selected", description: "Product packshot selected on the timeline." });
  };

  const exportTimelineJson = () => {
    const blob = new Blob([JSON.stringify(timeline, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "buzzly-studio-timeline.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExport = () => {
    const architecture = buildRenderingArchitecture(timeline);
    toast({
      title: "Fast export ready",
      description: `${architecture.currentEstimate.duration}s video estimated at ${architecture.currentEstimate.estimatedExportSeconds}s export. Target: under ${architecture.targetExportSeconds}s.`,
    });
  };

  const openShotSlotInStudio = (slot: GuidedShotSlot) => {
    if (!slot.file) return;
    const duration = 10;
    const shotName = `${slot.name} shot`;
    const shotItem: BuzzlyTimelineItem = {
      id: `shot-edit-${slot.id}`,
      type: "video",
      name: slot.file.name.replace(/\.[^/.]+$/, "") || shotName,
      trackId: "video-main",
      source: {
        kind: "local",
        uri: URL.createObjectURL(slot.file),
        filename: slot.file.name,
        mimeType: slot.file.type || "video/mp4",
      },
      startTime: 0,
      duration,
      trimStart: 0,
      trimEnd: duration,
      volume: 0.85,
      position: { x: 0.5, y: 0.5 },
      scale: 1,
      opacity: 1,
    };

    setTimeline((current) => ({
      ...current,
      project: {
        ...current.project,
        name: `${slot.name} Edit`,
        duration,
        format: "tiktok-reel-9x16",
        width: 1080,
        height: 1920,
      },
      tracks: current.tracks.map((track) => {
        if (track.id === "video-main") return { ...track, items: [shotItem] };
        if (track.id === "text-main") {
          return {
            ...track,
            items: [{
              id: `shot-edit-label-${slot.id}`,
              type: "text",
              name: "Shot label",
              trackId: "text-main",
              text: slot.name,
              startTime: 0,
              duration: 2,
              trimStart: 0,
              trimEnd: 2,
              volume: 0,
              position: { x: 0.5, y: 0.16 },
              scale: 1,
              opacity: 1,
            }],
          };
        }
        if (track.id === "captions-main" || track.id === "image-overlays" || track.id === "audio-main") {
          return { ...track, items: [] };
        }
        return track;
      }),
    }));
    setActiveShotEdit(slot);
    setSelectedItemId(shotItem.id);
    seekTo(0);
    setActiveRail("studio");
    toast({
      title: `Editing ${slot.name}`,
      description: `${slot.role}: ${slot.guidance}`,
    });
  };

  const finishShotSlotEdit = () => {
    if (!activeShotEdit) return;
    setGuidedSetupState((current) => ({
      ...current,
      shotSlots: current.shotSlots.map((slot) => (
        slot.id === activeShotEdit.id ? { ...slot, edited: true } : slot
      )),
    }));
    toast({
      title: `Shot ${activeShotEdit.index + 1} saved`,
      description: "This slot is ready for Buzzly to use during generation.",
    });
    setActiveShotEdit(null);
    setSetupMode("guided");
    setActiveRail("setup");
  };

  const openSetupVideoBuilder = () => {
    const activeBuilderSnapshot = setupBuilderTimeline?.assetId === (editingAsset?.id ?? null) ? setupBuilderTimeline : null;
    const hasExistingBuilderDraft = setupBuilderFiles.length > 0 || Boolean(activeBuilderSnapshot);
    setSetupBuilderMode(true);
    setSetupMode("form");
    seekTo(0);
    if (activeBuilderSnapshot) {
      const restoredTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(activeBuilderSnapshot.timeline));
      const restoredItems = restoredTimeline.tracks.flatMap((track) => track.items);
      setTimeline(restoredTimeline);
      setSelectedItemId(restoredItems.find((item) => item.type === "video")?.id || restoredItems[0]?.id || null);
    } else if (!hasExistingBuilderDraft) {
      setTimeline((current) => ({
        ...current,
        tracks: current.tracks.map((track) => ({ ...track, items: [] })),
      }));
      setSelectedItemId(null);
    } else {
      setSelectedItemId(null);
    }
    setActiveRail("studio");
    toast({
      title: hasExistingBuilderDraft ? "Re-edit Studio Builder" : "Studio Builder",
      description: hasExistingBuilderDraft
        ? "Your previous clips are still here. Adjust them, then tap Done edit."
        : "Upload multiple videos here. Edit them, then tap Done edit.",
    });
  };

  const finishSetupVideoBuilder = () => {
    setSetupBuilderTimeline({
      assetId: editingAsset?.id ?? null,
      timeline: JSON.parse(JSON.stringify(timeline)),
    });
    setSetupBuilderMode(false);
    setSetupMode("form");
    setActiveRail("setup");
    toast({
      title: "Clips ready",
      description: `${setupBuilderMediaCount} Studio clip${setupBuilderMediaCount === 1 ? "" : "s"} will be used for Generate.`,
    });
  };

  const shuffleSelectedShots = () => {
    const videoTrack = timeline.tracks.find((track) => track.id === "video-main" || track.type === "video");
    const videoItems = videoTrack?.items.filter((item) => item.type === "video") || [];
    const selectedVideoIds = new Set(selectedTimelineItemIds);
    const selectedVideoItems = videoItems.filter((item) => selectedVideoIds.has(item.id));
    if (!videoTrack || selectedVideoItems.length < 2) {
      toast({
        title: "Select clips to shuffle",
        description: "Cmd/Ctrl-click at least 2 video clips, then press Shuffle shots.",
        variant: "destructive",
      });
      return;
    }

    const currentOrder = [...selectedVideoItems].sort((a, b) => a.startTime - b.startTime);
    const shuffled = [...currentOrder];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    if (shuffled.every((item, index) => item.id === currentOrder[index]?.id)) {
      shuffled.push(shuffled.shift()!);
    }

    const sequencedItems = shuffled.map((item, index) => {
      const slot = currentOrder[index];
      return {
        ...item,
        startTime: slot.startTime,
      };
    });
    const sequencedById = new Map(sequencedItems.map((item) => [item.id, item]));

    recordHistory();
    setTimeline((current) => ({
      ...current,
      project: {
        ...current.project,
        duration: Math.max(current.project.duration, ...sequencedItems.map((item) => item.startTime + item.duration)),
      },
      tracks: current.tracks.map((track) => (
        track.id === videoTrack.id
          ? {
              ...track,
              items: track.items
                .map((item) => sequencedById.get(item.id) || item)
                .sort((a, b) => a.startTime - b.startTime),
            }
          : track
      )),
    }));
    setSelectedItemId(sequencedItems[0]?.id || null);
    seekTo(0);
    toast({
      title: "Shots shuffled",
      description: `${sequencedItems.length} selected clip${sequencedItems.length === 1 ? "" : "s"} shuffled. Other clips stayed in place.`,
    });
  };

  const applyGuidedSetupDraft = (draft: GuidedSetupDraft) => {
    setLastGuidedDraft(draft);
    const videoDuration = draft.duration;
    const rawClipCount = Math.max(1, draft.rawVideos.length);
    const clipDuration = Math.max(3, Number((videoDuration / rawClipCount).toFixed(1)));
    const scenes = buildGuidedScenes(draft);
    const captionDuration = Number((videoDuration / scenes.length).toFixed(1));
    const photoUrl = draft.productPhoto ? URL.createObjectURL(draft.productPhoto) : undefined;

    const rawVideoItems: BuzzlyTimelineItem[] = draft.rawVideos.map((file, index) => {
      const startTime = Math.min(videoDuration - 1, Number((index * clipDuration).toFixed(1)));
      const duration = Math.max(1, Math.min(clipDuration, videoDuration - startTime));
      return {
        id: `guided-raw-${Date.now()}-${index}`,
        type: "video",
        name: file.name.replace(/\.[^/.]+$/, "") || `Raw clip ${index + 1}`,
        trackId: "video-main",
        source: {
          kind: "local",
          uri: URL.createObjectURL(file),
          filename: file.name,
          mimeType: file.type || "video/mp4",
        },
        startTime,
        duration,
        trimStart: 0,
        trimEnd: duration,
        volume: draft.voiceMode === "Use clip audio" ? 0.85 : 0.2,
        position: { x: 0.5, y: 0.5 },
        frameSize: { width: 1, height: 1 },
        mediaFit: "cover",
        scale: 1,
        opacity: 1,
      };
    });

    const imageItems: BuzzlyTimelineItem[] = [
      ...(draft.productPhoto ? [{
        id: "guided-product-photo",
        type: "image" as const,
        name: "AI-analyzed product photo",
        trackId: "image-overlays",
        source: {
          kind: "local" as const,
          uri: photoUrl,
          filename: draft.productPhoto.name,
          mimeType: draft.productPhoto.type || "image/png",
        },
        startTime: Math.max(0, videoDuration - 7),
        duration: 5,
        trimStart: 0,
        trimEnd: 5,
        volume: 0,
        position: { x: 0.5, y: 0.42 },
        frameSize: { width: 0.76, height: 0.76 },
        mediaFit: "contain",
        scale: 0.72,
        opacity: 0.96,
      }] : []),
      {
        id: "guided-ai-broll",
        type: "image",
        name: "Generated B-roll image prompt",
        trackId: "image-overlays",
        source: { kind: "generated", filename: "ai-product-broll.png", mimeType: "image/png" },
        startTime: Math.max(4, Math.round(videoDuration * 0.45)),
        duration: 5,
        trimStart: 0,
        trimEnd: 5,
        volume: 0,
        position: { x: 0.5, y: 0.48 },
        frameSize: { width: 0.82, height: 0.82 },
        mediaFit: "contain",
        scale: 0.82,
        opacity: 0.88,
      },
    ];

    const captionItems: BuzzlyTimelineItem[] = scenes.map((scene, index) => ({
      id: `guided-caption-${index}`,
      type: "caption",
      name: `${scene.title} caption`,
      trackId: "captions-main",
      text: scene.captionText,
      startTime: Number((index * captionDuration).toFixed(1)),
      duration: captionDuration,
      trimStart: 0,
      trimEnd: captionDuration,
      volume: 0,
      position: { x: 0.5, y: 0.82 },
      scale: 1,
      opacity: 1,
    }));

    const audioItems: BuzzlyTimelineItem[] = [
      ...(draft.voiceMode === "AI voiceover" ? [{
        id: "guided-voiceover",
        type: "audio" as const,
        name: draft.voiceName ? `Voiceover · ${draft.voiceName}` : "Generated AI voiceover",
        trackId: "audio-main",
        source: { kind: "generated" as const, filename: draft.voiceId ? `elevenlabs-${draft.voiceId}.mp3` : "guided-voiceover.mp3", mimeType: "audio/mpeg" },
        startTime: 0,
        duration: videoDuration,
        trimStart: 0,
        trimEnd: videoDuration,
        volume: 1,
        position: { x: 0, y: 0 },
        scale: 1,
        opacity: 1,
      }] : []),
      ...(draft.musicMode !== "No music" ? [{
        id: "guided-music",
        type: "audio" as const,
        name: draft.musicName ? `Music · ${draft.musicName}` : "Background music placeholder",
        trackId: "audio-main",
        source: draft.musicUri
          ? { kind: "remote" as const, uri: draft.musicUri, filename: draft.musicName ? `${draft.musicName}.mp3` : "free-background-music.mp3", mimeType: "audio/mpeg" }
          : { kind: "generated" as const, filename: "background-music-placeholder.mp3", mimeType: "audio/mpeg" },
        startTime: 0,
        duration: videoDuration,
        trimStart: 0,
        trimEnd: videoDuration,
        volume: 0.28,
        position: { x: 0, y: 0 },
        scale: 1,
        opacity: 1,
      }] : []),
    ];

    const hookText = scenes[0]?.captionText || draft.goal.title;
    setTimeline((current) => ({
      ...current,
      project: {
        ...current.project,
        name: `${draft.productName} ${draft.goal.title}`,
        duration: videoDuration,
        format: draft.platform.includes("Shorts") ? "tiktok-reel-9x16" : "tiktok-reel-9x16",
        width: 1080,
        height: 1920,
      },
      creativeBrain: {
        ...current.creativeBrain,
        input: {
          ...current.creativeBrain.input,
          goal: draft.goal.title,
          product: draft.productName,
          platform: draft.platform,
          style: draft.style,
          userIdea: draft.productNotes || draft.goal.description,
        },
        output: {
          ...current.creativeBrain.output,
          contentStrategy: `${draft.goal.description} Style: ${draft.style}. Duration: ${videoDuration}s.`,
          hookDirection: hookText,
          visualsNeeded: [
            "Best raw product clips from upload",
            "AI-generated product B-roll from product photo",
            "Product close-up or packshot",
            "Captioned CTA end beat",
          ],
          missingAssets: draft.rawVideos.length < 3 ? ["More alternate product angles for regeneration variety"] : [],
        },
      },
      tracks: current.tracks.map((track) => {
        if (track.id === "video-main") return { ...track, items: rawVideoItems };
        if (track.id === "image-overlays") return { ...track, items: imageItems };
        if (track.id === "audio-main") return { ...track, items: audioItems };
        if (track.id === "text-main") {
          return {
            ...track,
            items: [{
              id: "guided-hook-text",
              type: "text",
              name: "Generated hook",
              trackId: "text-main",
              text: hookText,
              startTime: 0,
              duration: Math.min(4, videoDuration),
              trimStart: 0,
              trimEnd: Math.min(4, videoDuration),
              volume: 0,
              position: { x: 0.5, y: 0.18 },
              scale: 1,
              opacity: 1,
            }],
          };
        }
        if (track.id === "captions-main") return { ...track, items: captionItems };
        return track;
      }),
      aiPlan: {
        ...current.aiPlan,
        objective: `${draft.goal.title}: ${draft.goal.description}`,
        scenes,
        seoKeywords: ["#tiktokshop", "#affiliate", "#productdemo", "#ugc", `#${draft.productName.replace(/\s+/g, "").toLowerCase()}`],
      },
      planningLayer: {
        ...current.planningLayer,
        planName: `${draft.goal.title} Guided Plan`,
        beats: scenes.map((scene, index) => ({
          key: (["hook", "problem", "solution", "cta"] as const)[index] || "highlight",
          label: scene.title,
          line: scene.captionText,
          purpose: scene.goal,
          duration: Math.round(captionDuration),
          visualDirection: scene.clipSelection.join(", "),
        })),
        generationBrief: `Analyze ${draft.rawVideos.length} raw video(s) and ${draft.productPhoto?.name || "the product photo"}, generate B-roll, voiceover, captions, music, then organize the ${videoDuration}s ${draft.platform} timeline.`,
      },
    }));
    setSelectedItemId(rawVideoItems[0]?.id || "guided-hook-text");
    seekTo(0);
    setHasGeneratedDraft(true);
    toast({
      title: "Studio timeline generated",
      description: "Buzzly organized the raw clips, AI B-roll, captions, voiceover, and music into the editor.",
    });
  };

  return (
    <div
      className="h-screen overflow-hidden bg-[#070a0f] text-slate-100 max-md:h-[100dvh]"
      onWheelCapture={(event) => {
        if (event.ctrlKey) event.preventDefault();
      }}
    >
      <div className="flex h-screen flex-col max-md:h-[100dvh] max-md:pb-[calc(env(safe-area-inset-bottom)+72px)]">
        <header className="hidden min-h-16 grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/10 bg-[#090d14]/95 px-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur md:grid">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#ffc400] text-black shadow-[0_0_28px_rgba(255,196,0,0.35)]">
                <Play className="h-5 w-5 fill-black" />
              </div>
              <span className="text-2xl font-bold tracking-tight">Buzzly</span>
            </div>
            <div className="hidden h-8 w-px bg-white/10 sm:block" />
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="font-medium text-white">{timeline.project.name}</span>
              {initialGoal && (
                <span className="rounded bg-[#ffc400]/15 px-2 py-1 text-[11px] font-semibold text-[#ffc400]">
                  {initialGoal.title}
                </span>
              )}
              <span className="rounded bg-white/[0.06] px-2 py-1 text-[11px] font-semibold capitalize text-[#ffc400]">{timeline.userSystem.currentRole}</span>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => navigateRail("settings")} title="Project settings">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="hidden items-center justify-center gap-6 lg:flex">
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Save className="h-4 w-4" />
              Saved
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white disabled:text-slate-700"
                onClick={undoTimeline}
                disabled={undoStack.length === 0}
                title="Undo (Cmd/Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white disabled:text-slate-700"
                onClick={redoTimeline}
                disabled={redoStack.length === 0}
                title="Redo (Cmd/Ctrl+Shift+Z)"
              >
                <Undo2 className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {onChangeGoal && (
              <Button variant="outline" className="h-10 border-white/10 bg-white/[0.03] px-3 text-xs text-white hover:bg-white/10 sm:text-sm" onClick={onChangeGoal}>
                Change goal
              </Button>
            )}
            <Button variant="outline" className="hidden h-10 gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/10 md:inline-flex" onClick={routeGenerationEngines}>
              <Sparkles className="h-4 w-4 text-[#ffc400]" />
              Pro Plan
            </Button>
            <Button variant="outline" className="hidden h-10 gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/10 sm:inline-flex" onClick={() => toast({ title: "Credits", description: "Generation credits will connect to billing later." })}>
              125 Credits
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ffc400] text-black">+</span>
            </Button>
            <Button size="icon" variant="ghost" className="h-10 w-10 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => toast({ title: "No new notifications", description: "Buzzly is ready for your next edit." })} title="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" className="h-10 gap-2 px-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigateRail("settings")} title="Account">
              <UserCircle className="h-8 w-8 text-[#ffc400]" />
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[52px_minmax(0,1fr)] max-md:block">
          <aside className="flex flex-col items-center justify-between border-r border-white/10 bg-[#080d14] px-1 py-2 max-md:hidden">
            <nav className="flex w-full flex-col items-center gap-1 overflow-y-auto">
              {railItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => navigateRail(item.id)}
                    className={`grid h-11 w-11 place-items-center rounded-xl transition ${
                      activeRail === item.id
                        ? "bg-[#ffc400]/16 text-[#ffc400] shadow-[inset_0_0_0_1px_rgba(255,196,0,0.18)]"
                        : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="sr-only">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div />
          </aside>

          <main className={`grid min-h-0 bg-[radial-gradient(circle_at_top_left,rgba(255,196,0,0.08),transparent_30%),#070a0f] max-md:flex max-md:h-full max-md:flex-col ${
            isProductionRail ? "grid-rows-[minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)_320px]"
          }`}>
            {isProductionRail ? (
              <section className="min-h-0 overflow-y-auto p-4 max-md:p-3">
                <StudioWorkflowPanel
                  activeRail={activeRail}
                  editingAsset={editingAsset}
                  goal={initialGoal}
                  setupMode={setupMode}
                  hasGeneratedDraft={hasGeneratedDraft}
                  lastGuidedDraft={lastGuidedDraft}
                  guidedSetupState={guidedSetupState}
                  setupBuilderFiles={setupBuilderFiles}
                  studioTimelineJson={setupBuilderTimeline?.assetId === (editingAsset?.id ?? null) ? setupBuilderTimeline.timeline : timeline}
                  onGuidedSetupStateChange={setGuidedSetupState}
                  onRegisterAssetFiles={registerAssetFiles}
                  onOpenStudioBuilder={openSetupVideoBuilder}
                  onGenerateGuidedDraft={applyGuidedSetupDraft}
                  onSetupComplete={handleSetupComplete}
                  onCancelSetupEdit={handleCancelSetupEdit}
                  onEditSetup={handleEditSetup}
                  onOpenSetupInStudio={handleOpenSetupInStudio}
                  onActivateSetup={() => navigateRail("jobs")}
                  onCreateSetup={() => {
                    setSetupBuilderMode(false);
                    setSetupBuilderFiles([]);
                    setSetupBuilderTimeline(null);
                    setSetupMode("form");
                    navigateRail("setup");
                  }}
                  onOpenStudio={() => navigateRail("studio")}
                  onOpenSaveSetup={() => {
                    setSetupMode("form");
                    navigateRail("setup");
                  }}
                />
              </section>
            ) : (
              <>
            <section className={`grid min-h-0 min-w-0 gap-4 overflow-hidden p-4 pb-0 max-[1180px]:[&_.assistant-pane]:hidden max-[920px]:grid-cols-1 max-md:block max-md:flex-none max-md:overflow-hidden max-md:p-0 ${
              showStudioSidePanels
                ? leftPanelOpen
                  ? "grid-cols-[360px_minmax(520px,1fr)_360px] max-[1180px]:grid-cols-[320px_minmax(480px,1fr)]"
                  : "grid-cols-[minmax(520px,1fr)_360px] max-[1180px]:grid-cols-1"
                : "grid-cols-[minmax(0,1fr)]"
            }`}>
              {showStudioSidePanels && leftPanelOpen && renderLeftPanel({
                activeRail,
                timeline,
                libraryAssets,
                updateCreativeBrainInput,
                generateCreativeDirection,
                applyCreativePlan,
                scanAssets,
                routeGenerationEngines,
                generateSmartScenes,
                analyzePerformance,
                applyPerformanceSuggestion,
                applyStyleDna,
                createStyleFromCurrent,
                switchTeamMember,
                switchWorkspace,
                applyWorkspace,
                applyAiMemory,
                learnFromCurrentEdit,
                optimizeRenderSpeed,
                runSuggestedPipeline,
                selectAsset,
                handleUploadPlaceholder,
                handleFilesUpload,
                runAiTimelineCommand,
              })}
              <div className="flex min-h-0 min-w-0 flex-col gap-4 max-md:h-full max-md:gap-0">
                <div className="hidden shrink-0 items-center justify-between rounded-lg border border-white/10 bg-[#101620]/90 px-4 py-3 md:flex">
                  <div className="flex items-center gap-2">
                    <input
                      ref={videoLayerInputRef}
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        if (event.currentTarget.files?.length) handleFilesUpload(event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                    />
                    <input
                      ref={imageLayerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        handleLayerFileUpload("image", event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                    />
                    <input
                      ref={musicLayerInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(event) => {
                        handleLayerFileUpload("audio", event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                    />
                    {[
                      { icon: WandSparkles, action: "brain" as const, title: "Generate direction" },
                      { icon: PanelLeftClose, action: "panel" as const, title: "Toggle left panel" },
                      { icon: Video, action: "add-video" as const, title: "Add video layer" },
                      { icon: Image, action: "add-image" as const, title: "Add photo layer" },
                      { icon: Music2, action: "add-music" as const, title: "Add music layer" },
                      { icon: Type, action: "add-text" as const, title: "Add text layer" },
                    ].map((tool, index) => {
                      const Icon = tool.icon;
                      return (
                      <Button
                        key={index}
                        size="icon"
                        variant="ghost"
                        title={tool.title}
                        onClick={() => {
                          if (tool.action === "add-video") videoLayerInputRef.current?.click();
                          else if (tool.action === "add-image") imageLayerInputRef.current?.click();
                          else if (tool.action === "add-music") musicLayerInputRef.current?.click();
                          else if (tool.action === "add-text") addLayerToTimeline("text");
                          else handleToolAction(tool.action);
                        }}
                        className={`h-9 w-9 rounded-md ${index === 0 ? "bg-white/10 text-[#ffc400]" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    {setupBuilderMode && (
                      <div className="mr-2 hidden items-center gap-2 rounded-md border border-[#ffc400]/35 bg-[#ffc400]/10 px-3 py-2 text-xs text-[#ffc400] md:flex">
                        Setup Builder
                        <span className="text-white/80">· {setupBuilderMediaCount} clip{setupBuilderMediaCount === 1 ? "" : "s"}</span>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="h-10 gap-2 border-[#ffc400]/30 bg-[#ffc400]/10 text-[#ffc400] hover:bg-[#ffc400]/20"
                      onClick={shuffleSelectedShots}
                    >
                      <Shuffle className="h-4 w-4" />
                      Shuffle shots{selectedTimelineItemIds.length > 1 ? ` (${selectedTimelineItemIds.length})` : ""}
                    </Button>
                    {setupBuilderMode && (
                      <Button
                        variant="outline"
                        className="h-10 gap-2 border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                        onClick={finishSetupVideoBuilder}
                        disabled={setupBuilderMediaCount === 0}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Done edit
                      </Button>
                    )}
                    {activeShotEdit && (
                      <div className="mr-2 hidden items-center gap-2 rounded-md border border-[#ffc400]/35 bg-[#ffc400]/10 px-3 py-2 text-xs text-[#ffc400] md:flex">
                        Editing Shot {activeShotEdit.index + 1}
                        <span className="text-white/80">· {activeShotEdit.name}</span>
                      </div>
                    )}
                    {activeShotEdit && (
                      <Button
                        variant="outline"
                        className="h-10 gap-2 border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                        onClick={finishShotSlotEdit}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Done editing shot
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-10 gap-2 border-white/10 bg-[#0b1018] text-white hover:bg-white/10"
                      onClick={() => {
                        if (!isPlaying) window.dispatchEvent(new Event("buzzly-prime-audio"));
                        setIsPlaying((value) => !value);
                      }}
                    >
                      <Play className="h-4 w-4" />
                      Preview
                    </Button>
                    <Button onClick={handleExport} className="h-10 gap-2 bg-[#ffc400] font-semibold text-black hover:bg-[#ffd84a]">
                      Export Video
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="sticky top-0 z-20 flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#090d14]/95 px-3 py-2 pt-[calc(env(safe-area-inset-top)+8px)] backdrop-blur [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                  <Button
                    variant="outline"
                    className="h-11 min-w-[52px] border-white/10 bg-white/[0.04] px-2 text-xs text-white hover:bg-white/10 disabled:text-slate-700"
                    onClick={undoTimeline}
                    disabled={undoStack.length === 0}
                    title="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 min-w-[52px] border-white/10 bg-white/[0.04] px-2 text-xs text-white hover:bg-white/10 disabled:text-slate-700"
                    onClick={redoTimeline}
                    disabled={redoStack.length === 0}
                    title="Redo"
                  >
                    <Undo2 className="h-4 w-4 rotate-180" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 min-w-[92px] border-white/10 bg-white/[0.04] px-2 text-xs text-white hover:bg-white/10"
                    onClick={() => {
                      if (!isPlaying) window.dispatchEvent(new Event("buzzly-prime-audio"));
                      setIsPlaying((value) => !value);
                    }}
                  >
                    <Play className="mr-1 h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 min-w-[96px] border-[#ffc400]/35 bg-[#ffc400]/10 px-2 text-xs text-[#ffc400] hover:bg-[#ffc400]/20"
                    onClick={shuffleSelectedShots}
                  >
                    <Shuffle className="mr-1 h-4 w-4" />
                    Shuffle
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 min-w-[92px] border-[#ffc400]/35 bg-[#ffc400]/10 px-2 text-xs text-[#ffc400] hover:bg-[#ffc400]/20"
                    onClick={() => handleTimelineToolAction("cut-dead-air")}
                  >
                    Cut Air
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 min-w-[82px] border-emerald-400/30 bg-emerald-400/10 px-2 text-xs text-emerald-200 hover:bg-emerald-400/20"
                    onClick={setupBuilderMode ? finishSetupVideoBuilder : () => navigateRail("setup")}
                    disabled={setupBuilderMode && setupBuilderMediaCount === 0}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Done
                  </Button>
                  <Button className="h-11 min-w-[84px] bg-[#ffc400] px-2 text-xs font-semibold text-black hover:bg-[#ffd84a]" onClick={handleExport}>
                    Export
                  </Button>
                </div>
                <div
                  className="min-h-0 min-w-0 flex-1 max-md:h-[var(--mobile-preview-height)] max-md:flex-none max-md:px-3 max-md:py-3"
                  style={{ "--mobile-preview-height": `min(${mobilePreviewHeight}dvh, ${mobilePreviewHeight}vh)` } as CSSProperties}
                >
                  <PreviewPanel
                    timeline={timeline}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    selectedItemId={selectedItemId}
                    onPlayPause={() => setIsPlaying((value) => !value)}
                    onSeek={seekTo}
                    onSelectItem={setSelectedItemId}
                    onUpdateItem={updateItem}
                  />
                </div>
              </div>
              {showStudioSidePanels && (
              <div className="assistant-pane min-h-0 min-w-0">
                <div className="grid h-full min-h-0 grid-rows-[minmax(240px,0.8fr)_minmax(260px,1fr)] gap-4">
                  {selectedItem ? (
                    <ClipInspectorPanel
                      selectedItem={selectedItem}
                      onUpdateItem={updateItem}
                      onToolAction={handleTimelineToolAction}
                    />
                  ) : (
                    <AiRouterPanel
                      router={timeline.hybridGeneration}
                      onRoute={routeGenerationEngines}
                    />
                  )}
                  <AiChatPanel
                    timeline={timeline}
                    prompt={aiPrompt}
                    onPromptChange={setAiPrompt}
                    onMockApply={applyMockAiEdit}
                    onSuggestionApply={runAiTimelineCommand}
                  />
                </div>
              </div>
              )}
            </section>

            <button
              type="button"
              className="hidden h-9 touch-none select-none items-center justify-center border-y border-white/10 bg-[#090d14] text-[10px] uppercase tracking-wide text-slate-500 max-md:flex"
              onPointerDown={startMobileLayoutDrag}
              onTouchStart={startMobileLayoutTouchDrag}
              aria-label="Resize preview and timeline"
            >
              <span className="h-1 w-14 rounded-full bg-slate-600" />
            </button>

            <section
              className="min-h-0 min-w-0 overflow-hidden p-4 max-md:h-[var(--mobile-timeline-height)] max-md:p-0"
              style={{ "--mobile-timeline-height": `min(${mobileTimelineHeight}dvh, ${mobileTimelineHeight}vh)` } as CSSProperties}
            >
              <TimelinePanel
                timeline={timeline}
                currentTime={currentTime}
                selectedItemId={selectedItemId}
                selectedItemIds={selectedTimelineItemIds}
                onSelectItem={selectTimelineItem}
                onToggleItemSelection={toggleTimelineItemSelection}
                onUpdateItem={updateItem}
                onSeek={seekTo}
                onToolAction={handleTimelineToolAction}
                onTrackUpload={(type) => {
                  if (type === "video") videoLayerInputRef.current?.click();
                  if (type === "image") imageLayerInputRef.current?.click();
                  if (type === "audio") musicLayerInputRef.current?.click();
                }}
                onMoveItem={moveTimelineItem}
                onTrimItem={updateItem}
                onApplyTransition={applyTransitionBetweenClips}
                onGenerateAiTransition={generateAiTransitionBetweenClips}
              />
            </section>
              </>
            )}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#090d14]/96 px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 backdrop-blur md:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {railItems.map((item) => {
            const Icon = item.icon;
            const opensSheet = item.id === "text" || item.id === "audio" || item.id === "elements" || item.id === "ai";
            const active = opensSheet ? activeRail === item.id || mobileTool === item.id : activeRail === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`flex min-h-[56px] min-w-[68px] flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-medium ${
                  active ? "bg-[#ffc400]/15 text-[#ffc400]" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
                onClick={() => {
                  if (opensSheet) {
                    setActiveRail(item.id);
                    setMobileTool((current) => current === item.id ? null : item.id);
                    return;
                  }
                  if (item.id === "studio") {
                    setMobileTool(null);
                    navigateRail("studio");
                    return;
                  }
                  setMobileTool(null);
                  navigateRail(item.id);
                }}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {mobileTool && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+70px)] z-50 max-h-[46dvh] overflow-hidden rounded-t-2xl border border-white/10 bg-[#101620] text-white shadow-[0_-24px_70px_rgba(0,0,0,0.55)] md:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#ffc400]">Tools</p>
              <h3 className="text-base font-semibold">
                {mobileTool === "text" ? "Text" : mobileTool === "audio" ? "Audio" : mobileTool === "elements" ? "Elements" : "AI Tools"}
              </h3>
            </div>
            <Button variant="ghost" className="h-10 px-3 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setMobileTool(null)}>
              Close
            </Button>
          </div>
          <div className="max-h-[calc(46dvh-66px)] overflow-y-auto p-4">
            {mobileTool === "text" && (
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-12 justify-start gap-2 bg-[#ffc400] text-black hover:bg-[#ffd84a]" onClick={() => addLayerToTimeline("text")}>
                  <Type className="h-4 w-4" />
                  Add text
                </Button>
                <Button variant="outline" className="h-12 justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/10" onClick={() => runAiTimelineCommand("Make captions more premium")}>
                  Premium captions
                </Button>
                <Button variant="outline" className="h-12 justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/10" onClick={() => runAiTimelineCommand("Lagyan mo ng stronger CTA")}>
                  Strong CTA
                </Button>
              </div>
            )}
            {mobileTool === "audio" && (
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-12 justify-start gap-2 bg-[#ffc400] text-black hover:bg-[#ffd84a]" onClick={() => musicLayerInputRef.current?.click()}>
                  <Music2 className="h-4 w-4" />
                  Add audio
                </Button>
                <Button variant="outline" className="h-12 justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/10" onClick={() => runAiTimelineCommand("Palitan music")}>
                  Change music
                </Button>
                <Button variant="outline" className="h-12 justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/10" onClick={() => selectAsset("music-bed")}>
                  Select music
                </Button>
              </div>
            )}
            {mobileTool === "elements" && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Zoom in", "zoom-in-motion"],
                  ["Zoom out", "zoom-out-motion"],
                  ["No effect", "effect-none"],
                  ["Punch", "effect-punch"],
                  ["Vivid", "effect-vivid"],
                  ["Cinema", "effect-cinematic"],
                  ["Reset", "reset"],
                ].map(([label, action]) => (
                  <Button
                    key={action}
                    variant="outline"
                    className="h-12 justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
                    onClick={() => handleTimelineToolAction(action as TimelineToolAction)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
            {mobileTool === "ai" && (
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-12 justify-start gap-2 bg-[#ffc400] text-black hover:bg-[#ffd84a]" onClick={routeGenerationEngines}>
                  <Sparkles className="h-4 w-4" />
                  Route AI
                </Button>
                <Button variant="outline" className="h-12 justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/10" onClick={runSuggestedPipeline}>
                  Run pipeline
                </Button>
                <Button variant="outline" className="h-12 justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/10" onClick={generateSmartScenes}>
                  Smart scenes
                </Button>
                <Button variant="outline" className="h-12 justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/10" onClick={analyzePerformance}>
                  Analyze edit
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {showJson && (
        <Card className="fixed inset-x-8 bottom-8 z-50 border-white/10 bg-[#111722] text-white shadow-2xl">
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileJson className="h-4 w-4 text-[#ffc400]" />
                Timeline JSON
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportTimelineJson} className="border-white/10 bg-white/[0.03] text-white hover:bg-white/10">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowJson(false)} className="text-slate-300 hover:bg-white/10 hover:text-white">
                  Close
                </Button>
              </div>
            </div>
            <Textarea
              readOnly
              value={JSON.stringify(timeline, null, 2)}
              rows={12}
              className="border-white/10 bg-black/40 font-mono text-xs text-slate-200"
            />
          </CardContent>
        </Card>
      )}

      <Button
        size="icon"
        variant="outline"
        className="fixed bottom-6 right-6 z-40 h-11 w-11 border-white/10 bg-[#101620] text-slate-200 shadow-2xl hover:bg-white/10"
        onClick={() => setShowJson((value) => !value)}
        title="Timeline JSON"
      >
        <FileJson className="h-5 w-5" />
      </Button>
    </div>
  );
}

function buildGuidedScenes(draft: GuidedSetupDraft): BuzzlyAiPlanScene[] {
  const product = draft.productName || "the product";
  const clipNames = draft.rawVideos.length
    ? draft.rawVideos.map((file) => file.name.replace(/\.[^/.]+$/, "") || file.name)
    : ["Raw product clip"];

  return [
    {
      id: "guided-scene-hook",
      title: "Hook",
      goal: "Stop the scroll and make the product instantly relevant.",
      script: `POV: you found ${product} and it actually solves the problem.`,
      captionText: `${product}: worth checking before you buy.`,
      clipSelection: [clipNames[0], "fast product close-up"],
      musicSuggestion: "Clean first beat with fast social pacing.",
      cta: "Watch the proof.",
    },
    {
      id: "guided-scene-problem",
      title: "Problem",
      goal: "Show the pain point or need before selling.",
      script: `Most people miss this detail until they see ${product} in action.`,
      captionText: "Here is the problem it fixes.",
      clipSelection: [clipNames[1] || clipNames[0], "reaction or before shot"],
      musicSuggestion: "Keep rhythm under the voiceover.",
      cta: "Stay for the demo.",
    },
    {
      id: "guided-scene-proof",
      title: "Product Proof",
      goal: "Use uploaded clips to prove the product benefit.",
      script: `This is the part that makes ${product} useful: quick, visible proof from the clip.`,
      captionText: "The proof is in the demo.",
      clipSelection: [clipNames[2] || clipNames[0], "AI-generated B-roll"],
      musicSuggestion: draft.musicMode,
      cta: "Check the result.",
    },
    {
      id: "guided-scene-cta",
      title: "CTA",
      goal: "Close with one simple buying action.",
      script: `If you want this result, check ${product} from the link.`,
      captionText: "Check the link before it sells out.",
      clipSelection: ["Product photo packshot", "CTA end card"],
      musicSuggestion: "Small lift into final beat.",
      cta: "Check the link.",
    },
  ];
}

function buildGuidedSetupPrompt(draft: GuidedSetupDraft) {
  return [
    `Goal: ${draft.goal.title}`,
    `Product: ${draft.productName}`,
    `Style: ${draft.style}`,
    `Platform: ${draft.platform}`,
    `Duration: ${draft.duration}s`,
    `Voice: ${draft.voiceName || draft.voiceMode}`,
    draft.voiceId ? `ElevenLabs voice_id: ${draft.voiceId}` : "",
    draft.elevenlabsModel ? `ElevenLabs model: ${draft.elevenlabsModel}` : "",
    `Captions: ${draft.captionStyle}`,
    `Music: ${draft.musicName || draft.musicMode}`,
    draft.productNotes ? `Notes: ${draft.productNotes}` : "",
    "Generate a short-form selling video using the uploaded raw clips, product photo analysis, generated B-roll, captions, voiceover, background music, and a clear CTA.",
  ].filter(Boolean).join("\n");
}

function StudioWorkflowPanel({
  activeRail,
  editingAsset,
  goal,
  setupMode,
  hasGeneratedDraft,
  lastGuidedDraft,
  guidedSetupState,
  setupBuilderFiles,
  studioTimelineJson,
  onGuidedSetupStateChange,
  onRegisterAssetFiles,
  onOpenStudioBuilder,
  onGenerateGuidedDraft,
  onSetupComplete,
  onCancelSetupEdit,
  onEditSetup,
  onOpenSetupInStudio,
  onActivateSetup,
  onCreateSetup,
  onOpenStudio,
  onOpenSaveSetup,
}: {
  activeRail: StudioRailId;
  editingAsset: Asset | null;
  goal?: StudioGoal | null;
  setupMode: "guided" | "form";
  hasGeneratedDraft: boolean;
  lastGuidedDraft: GuidedSetupDraft | null;
  guidedSetupState: GuidedSetupState;
  setupBuilderFiles: File[];
  studioTimelineJson: BuzzlyTimelineJson;
  onGuidedSetupStateChange: (state: GuidedSetupState) => void;
  onRegisterAssetFiles: (files: File[]) => void;
  onOpenStudioBuilder: () => void;
  onGenerateGuidedDraft: (draft: GuidedSetupDraft) => void;
  onSetupComplete: () => void;
  onCancelSetupEdit: () => void;
  onEditSetup: (asset: Asset) => void;
  onOpenSetupInStudio: (asset: Asset, media?: AssetMediaUrls) => void;
  onActivateSetup: () => void;
  onCreateSetup: () => void;
  onOpenStudio: () => void;
  onOpenSaveSetup: () => void;
}) {
  const titles: Record<Extract<StudioRailId, "setup" | "setups" | "jobs" | "settings">, { title: string; description: string }> = {
    setup: {
      title: editingAsset ? "Edit Setup" : goal ? `${goal.title} Setup` : "Create Setup",
      description: editingAsset
        ? "Update the product, prompt, voice, and rendering settings for this real production setup."
        : goal
          ? goal.description
        : "Create a production-ready setup from inside Studio. This is the source for generated jobs.",
    },
    setups: {
      title: "Saved Setups",
      description: "Pick, edit, duplicate, or activate real setups without leaving Studio.",
    },
    jobs: {
      title: "Production Jobs",
      description: "Track renders, preview final videos, download outputs, and copy generated text.",
    },
    settings: {
      title: "Settings",
      description: "Manage account access, excluded words, and reusable script prompts.",
    },
  };

  const current = activeRail === "setup" || activeRail === "setups" || activeRail === "jobs" || activeRail === "settings"
    ? titles[activeRail]
    : titles.setup;

  return (
    <div className="dark mx-auto flex min-h-full w-full max-w-6xl flex-col rounded-xl border border-white/10 bg-background text-foreground shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Buzzly Studio</p>
          <h2 className="text-xl font-semibold tracking-tight">{current.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
        </div>
        {activeRail !== "setup" && (
          <Button onClick={onCreateSetup} className="gap-2">
            <Settings className="h-4 w-4" />
            New Setup
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {activeRail === "setup" && goal && setupMode === "guided" && !editingAsset && (
          <GuidedSetupWizard
            goal={goal}
            setupState={guidedSetupState}
            hasGeneratedDraft={hasGeneratedDraft}
            onSetupStateChange={onGuidedSetupStateChange}
            onRegisterAssetFiles={onRegisterAssetFiles}
            studioVideoFiles={setupBuilderFiles}
            onOpenStudioBuilder={onOpenStudioBuilder}
            onGenerateDraft={onGenerateGuidedDraft}
            onOpenStudio={onOpenStudio}
            onOpenSaveSetup={onOpenSaveSetup}
          />
        )}
        {activeRail === "setup" && (!goal || setupMode === "form" || editingAsset) && (
          <SetupForm
            onComplete={onSetupComplete}
            editingAsset={editingAsset}
            onCancelEdit={onCancelSetupEdit}
            initialName={lastGuidedDraft ? `${lastGuidedDraft.productName} ${lastGuidedDraft.goal.title}` : undefined}
            initialPersonaPrompt={lastGuidedDraft ? buildGuidedSetupPrompt(lastGuidedDraft) : undefined}
            initialVideoSource={lastGuidedDraft || setupBuilderFiles.length > 0 ? "builder" : undefined}
            studioVideoFiles={setupBuilderFiles}
            studioTimelineJson={studioTimelineJson}
            onOpenVideoBuilder={onOpenStudioBuilder}
            onOpenExistingStudio={onOpenSetupInStudio}
          />
        )}
        {activeRail === "setups" && (
          <SetupsList onActivate={onActivateSetup} onEdit={onEditSetup} onOpenStudio={onOpenSetupInStudio} />
        )}
        {activeRail === "jobs" && <JobsList />}
        {activeRail === "settings" && <StudioSettingsPanel />}
      </div>
    </div>
  );
}

function renderLeftPanel({
  activeRail,
  timeline,
  libraryAssets,
  updateCreativeBrainInput,
  generateCreativeDirection,
  applyCreativePlan,
  scanAssets,
  routeGenerationEngines,
  generateSmartScenes,
  analyzePerformance,
  applyPerformanceSuggestion,
  applyStyleDna,
  createStyleFromCurrent,
  switchTeamMember,
  switchWorkspace,
  applyWorkspace,
  applyAiMemory,
  learnFromCurrentEdit,
  optimizeRenderSpeed,
  runSuggestedPipeline,
  selectAsset,
  handleUploadPlaceholder,
  handleFilesUpload,
  runAiTimelineCommand,
}: {
  activeRail: StudioRailId;
  timeline: BuzzlyTimelineJson;
  libraryAssets: StudioLibraryAsset[];
  updateCreativeBrainInput: (patch: Partial<BuzzlyCreativeBrainInput>) => void;
  generateCreativeDirection: () => void;
  applyCreativePlan: () => void;
  scanAssets: () => void;
  routeGenerationEngines: () => void;
  generateSmartScenes: () => void;
  analyzePerformance: () => void;
  applyPerformanceSuggestion: (suggestion: BuzzlyPerformanceSuggestion) => void;
  applyStyleDna: (preset: BuzzlyStyleDnaPreset) => void;
  createStyleFromCurrent: () => void;
  switchTeamMember: (member: BuzzlyTeamMember) => void;
  switchWorkspace: (workspace: BuzzlyWorkspace) => void;
  applyWorkspace: () => void;
  applyAiMemory: () => void;
  learnFromCurrentEdit: () => void;
  optimizeRenderSpeed: () => void;
  runSuggestedPipeline: () => void;
  selectAsset: (id: string) => void;
  handleUploadPlaceholder: () => void;
  handleFilesUpload: (files: FileList) => void;
  runAiTimelineCommand: (prompt: string) => void;
}) {
  if (activeRail === "assets") {
    return (
      <AssetPanel
        timeline={timeline}
        libraryAssets={libraryAssets}
        onAssetSelect={selectAsset}
        onUploadClick={handleUploadPlaceholder}
        onFilesUpload={handleFilesUpload}
      />
    );
  }

  if (activeRail === "text") {
    return (
      <ToolPanel title="Text & Captions" kicker="Layer controls">
        <CommandButton label="Select hook text" onClick={() => selectAsset("hook-text")} />
        <CommandButton label="Make captions more premium" onClick={() => runAiTimelineCommand("Make captions more premium")} />
        <CommandButton label="Lagyan mo ng stronger CTA" onClick={() => runAiTimelineCommand("Lagyan mo ng stronger CTA")} />
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Current hook</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{timeline.creativeBrain.output.hookDirection}</p>
        </div>
      </ToolPanel>
    );
  }

  if (activeRail === "audio") {
    return (
      <ToolPanel title="Audio" kicker="Music and voice">
        <CommandButton label="Palitan music" onClick={() => runAiTimelineCommand("Palitan music")} />
        <CommandButton label="Change music to emotional" onClick={() => runAiTimelineCommand("Change music to emotional")} />
        <CommandButton label="Select music bed" onClick={() => selectAsset("music-bed")} />
        <CommandButton label="Select voiceover" onClick={() => selectAsset("voiceover")} />
      </ToolPanel>
    );
  }

  if (activeRail === "elements") {
    return (
      <ToolPanel title="Elements" kicker="B-roll and overlays">
        <CommandButton label="Add AI B-roll" onClick={() => runAiTimelineCommand("Add AI B-roll")} />
        <CommandButton label="Generate missing scenes" onClick={generateSmartScenes} />
        <CommandButton label="Add more product close-ups" onClick={() => runAiTimelineCommand("Add more product close-ups")} />
        <CommandButton label="Select product packshot" onClick={() => selectAsset("product-packshot")} />
        <SmartSceneGenerationPanel generation={timeline.smartSceneGeneration} onGenerateScenes={generateSmartScenes} />
        <SmartAssetMappingPanel intelligence={timeline.assetIntelligence} onScan={scanAssets} />
      </ToolPanel>
    );
  }

  if (activeRail === "ai") {
    return (
      <div className="grid min-h-0 grid-rows-[minmax(240px,0.85fr)_minmax(230px,0.8fr)_minmax(230px,0.8fr)_minmax(220px,0.75fr)] gap-4">
        <AiPipelinePanel pipeline={timeline.aiPipeline} onRunPipeline={runSuggestedPipeline} />
        <RenderingArchitecturePanel
          architecture={timeline.renderingArchitecture}
          onOptimize={optimizeRenderSpeed}
          onFastExport={optimizeRenderSpeed}
        />
        <AiMemoryPanel
          memory={timeline.aiMemorySystem}
          canApply={hasPermission(timeline, "generate-assets")}
          onApplyMemory={applyAiMemory}
          onLearnFromEdit={learnFromCurrentEdit}
        />
        <WorkspacePanel
          system={timeline.workspaceSystem}
          timeline={timeline}
          styleSystem={timeline.styleDnaSystem}
          teamMembers={timeline.userSystem.members}
          canManage={hasPermission(timeline, "manage-workspace")}
          onSwitchWorkspace={switchWorkspace}
          onApplyWorkspace={applyWorkspace}
        />
        <StyleDnaPanel
          system={timeline.styleDnaSystem}
          canManage={hasPermission(timeline, "manage-style-dna")}
          canApply={hasPermission(timeline, "generate-assets")}
          onApplyStyle={applyStyleDna}
          onCreateStyle={createStyleFromCurrent}
        />
      </div>
    );
  }

  return (
    <div className="grid min-h-0 grid-rows-[minmax(220px,0.95fr)_minmax(210px,0.9fr)_minmax(190px,0.8fr)] gap-4">
      <WorkspacePanel
        system={timeline.workspaceSystem}
        timeline={timeline}
        styleSystem={timeline.styleDnaSystem}
        teamMembers={timeline.userSystem.members}
        canManage={hasPermission(timeline, "manage-workspace")}
        onSwitchWorkspace={switchWorkspace}
        onApplyWorkspace={applyWorkspace}
      />
      <CreativeBrainPanel
        input={timeline.creativeBrain.input}
        output={timeline.creativeBrain.output}
        onInputChange={updateCreativeBrainInput}
        onGenerate={generateCreativeDirection}
      />
      <AiMemoryPanel
        memory={timeline.aiMemorySystem}
        canApply={hasPermission(timeline, "generate-assets")}
        onApplyMemory={applyAiMemory}
        onLearnFromEdit={learnFromCurrentEdit}
      />
      <TeamAccessPanel system={timeline.userSystem} onSwitchMember={switchTeamMember} />
    </div>
  );
}

function ToolPanel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-5">
        <p className="text-xs uppercase tracking-wide text-[#ffc400]">{kicker}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
        {children}
      </div>
    </section>
  );
}

function CommandButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[#0d131d] px-3 py-3 text-left text-sm text-slate-100 transition hover:border-[#ffc400]/50 hover:bg-white/[0.06]"
    >
      <span>{label}</span>
      <Sparkles className="h-4 w-4 text-[#ffc400]" />
    </button>
  );
}

function getActivePermissions(timeline: BuzzlyTimelineJson): BuzzlyUserPermission[] {
  return timeline.userSystem.members.find((member) => member.id === timeline.userSystem.currentUserId)?.permissions || ["review-only"];
}

function hasPermission(timeline: BuzzlyTimelineJson, permission: BuzzlyUserPermission) {
  return getActivePermissions(timeline).includes(permission);
}

function getActiveWorkspace(timeline: BuzzlyTimelineJson) {
  return timeline.workspaceSystem.workspaces.find((workspace) => workspace.id === timeline.workspaceSystem.activeWorkspaceId) || timeline.workspaceSystem.workspaces[0];
}

function applyWorkspaceToProject(timeline: BuzzlyTimelineJson): BuzzlyTimelineJson {
  const workspace = getActiveWorkspace(timeline);
  const template = workspace.templates[0];
  const workspaceStyles = timeline.styleDnaSystem.presets.filter((preset) => workspace.stylePresetIds.includes(preset.id));
  const activeStyleId = workspaceStyles[0]?.id || timeline.styleDnaSystem.activePresetId;

  const nextTimeline: BuzzlyTimelineJson = {
    ...timeline,
    project: {
      ...timeline.project,
      name: `${workspace.name} ${template?.name || "Project"}`,
      format: template?.format || timeline.project.format,
      duration: template?.duration || timeline.project.duration,
      width: template?.format === "landscape-16x9" ? 1920 : timeline.project.width,
      height: template?.format === "landscape-16x9" ? 1080 : timeline.project.height,
    },
    creativeBrain: {
      ...timeline.creativeBrain,
      input: {
        ...timeline.creativeBrain.input,
        persona: workspace.brandVoice,
        product: workspace.name,
        style: workspaceStyles[0]?.name || timeline.creativeBrain.input.style,
      },
      output: {
        ...timeline.creativeBrain.output,
        contentStrategy: `${timeline.creativeBrain.output.contentStrategy} Workspace context: ${workspace.brandVoice}`,
        visualsNeeded: uniqueStrings([...timeline.creativeBrain.output.visualsNeeded, ...workspace.promptLibrary.slice(0, 2)]),
      },
    },
    styleDnaSystem: {
      ...timeline.styleDnaSystem,
      activePresetId: activeStyleId,
      lastAppliedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
    userSystem: {
      ...timeline.userSystem,
      currentUserId: workspace.teamMemberIds.includes(timeline.userSystem.currentUserId) ? timeline.userSystem.currentUserId : workspace.teamMemberIds[0],
    },
  };

  return {
    ...nextTimeline,
    assetIntelligence: buildSmartAssetMapping(nextTimeline),
    smartSceneGeneration: buildSmartSceneGeneration(nextTimeline),
    performanceEngine: buildPerformanceEngine(nextTimeline),
  };
}

function applyAiMemoryToProject(timeline: BuzzlyTimelineJson): BuzzlyTimelineJson {
  const nextTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(timeline));
  const pacing = getMemoryValue(nextTimeline.aiMemorySystem, "preferred-pacing");
  const hooks = getMemoryValue(nextTimeline.aiMemorySystem, "favorite-hooks");
  const captions = getMemoryValue(nextTimeline.aiMemorySystem, "best-performing-captions");
  const voices = getMemoryValue(nextTimeline.aiMemorySystem, "preferred-voices");
  const cta = getMemoryValue(nextTimeline.aiMemorySystem, "common-cta");

  nextTimeline.creativeBrain.output.pacing = pacing;
  nextTimeline.creativeBrain.output.hookDirection = hooks;
  nextTimeline.creativeBrain.input.persona = voices;
  nextTimeline.aiMemorySystem = {
    ...nextTimeline.aiMemorySystem,
    summary: `${nextTimeline.aiMemorySystem.profileName} is active: ${hooks}`,
    lastAppliedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  nextTimeline.tracks = nextTimeline.tracks.map((track) => ({
    ...track,
    items: track.items.map((item) => {
      if (item.id === "clip-hook") return { ...item, duration: 2.8, trimEnd: Math.min(item.trimEnd, item.trimStart + 2.8), scale: Math.max(item.scale, 1.12) };
      if (item.id === "clip-demo") return { ...item, startTime: 2.8, duration: Math.min(item.duration, 8), scale: Math.max(item.scale, 1.1) };
      if (item.id === "hook-text") return { ...item, text: "Stop scrolling. This fixes the slow edit problem.", duration: 3, scale: 1.16, position: { x: 0.5, y: 0.18 } };
      if (item.type === "caption") return { ...item, text: "Stop scrolling. Faster videos start here.", duration: 2.2, scale: 1.18, position: { x: 0.5, y: 0.76 } };
      if (item.id === "music-bed") return { ...item, volume: Math.max(item.volume, 0.42) };
      if (item.id === "voiceover") return { ...item, name: "Jolie preferred voice", source: { kind: "generated", filename: "jolie-energetic-voice.mp3", mimeType: "audio/mpeg" } };
      return item;
    }),
  }));

  const hasMemoryCta = nextTimeline.tracks.some((track) => track.items.some((item) => item.id === "memory-cta"));
  nextTimeline.tracks = nextTimeline.tracks.map((track) => (
    track.id === "text-main"
      ? {
          ...track,
          items: hasMemoryCta
            ? track.items.map((item) => item.id === "memory-cta" ? { ...item, text: cta, startTime: Math.max(0, nextTimeline.project.duration - 6) } : item)
            : [
                ...track.items,
                {
                  id: "memory-cta",
                  type: "text",
                  name: "Memory CTA",
                  trackId: "text-main",
                  text: cta,
                  startTime: Math.max(0, nextTimeline.project.duration - 6),
                  duration: 4,
                  trimStart: 0,
                  trimEnd: 4,
                  volume: 0,
                  position: { x: 0.5, y: 0.72 },
                  scale: captions.toLowerCase().includes("large") ? 1 : 0.9,
                  opacity: 1,
                },
              ],
        }
      : track
  ));

  return {
    ...nextTimeline,
    performanceEngine: buildPerformanceEngine(nextTimeline),
  };
}

function learnMemoryFromTimeline(timeline: BuzzlyTimelineJson): BuzzlyAiMemorySystem {
  const hookText = timeline.tracks.flatMap((track) => track.items).find((item) => item.id === "hook-text")?.text || "Aggressive hooks";
  const ctaText = timeline.tracks.flatMap((track) => track.items).find((item) => /cta/i.test(item.name))?.text || getMemoryValue(timeline.aiMemorySystem, "common-cta");
  const score = timeline.performanceEngine.viralPotentialScore;
  const source = score >= 80 ? "performance" as const : "behavior" as const;

  return {
    ...timeline.aiMemorySystem,
    summary: `Buzzly remembers ${timeline.aiMemorySystem.profileName.replace(" Creator Memory", "")} prefers aggressive hooks, fast proof, bold captions, and direct CTAs.`,
    signals: timeline.aiMemorySystem.signals.map((signal) => {
      if (signal.key === "favorite-hooks") return { ...signal, value: hookText, confidence: Math.min(0.96, signal.confidence + 0.03), source };
      if (signal.key === "common-cta") return { ...signal, value: ctaText, confidence: Math.min(0.95, signal.confidence + 0.03), source };
      if (signal.key === "best-performing-captions") return { ...signal, confidence: Math.min(0.94, signal.confidence + 0.02), source };
      return signal;
    }),
  };
}

function getMemoryValue(memory: BuzzlyAiMemorySystem, key: BuzzlyAiMemorySystem["signals"][number]["key"]) {
  return memory.signals.find((signal) => signal.key === key)?.value || "";
}

function createStyleDnaFromCurrent(timeline: BuzzlyTimelineJson): BuzzlyTimelineJson {
  const preset: BuzzlyStyleDnaPreset = {
    id: `custom-style-${Date.now()}`,
    name: `${timeline.creativeBrain.input.product || "Brand"} DNA`,
    description: "Admin-created preset based on the current creative direction.",
    traits: timeline.creativeBrain.input.style.toLowerCase().includes("fast")
      ? ["fast-cuts", "punchy-hooks", "aggressive-captions", "premium-cta"]
      : ["cinematic", "elegant-subtitles", "direct", "premium-cta"],
    pacing: timeline.creativeBrain.output.pacing,
    hookStyle: timeline.creativeBrain.output.hookDirection,
    captionStyle: "Match the current caption scale, placement, and tone.",
    ctaStyle: timeline.aiPlan.scenes.at(-1)?.cta || "Clear premium CTA.",
    createdBy: "admin",
  };

  return {
    ...timeline,
    styleDnaSystem: {
      ...timeline.styleDnaSystem,
      activePresetId: preset.id,
      lastAppliedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      presets: [preset, ...timeline.styleDnaSystem.presets],
    },
  };
}

function applyStyleDnaPreset(timeline: BuzzlyTimelineJson, preset: BuzzlyStyleDnaPreset): BuzzlyTimelineJson {
  const nextTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(timeline));
  const fast = preset.traits.includes("fast-cuts");
  const slow = preset.traits.includes("slow") || preset.traits.includes("cinematic");
  const aggressiveCaptions = preset.traits.includes("aggressive-captions");
  const elegantSubtitles = preset.traits.includes("elegant-subtitles");
  const premiumCta = preset.traits.includes("premium-cta");
  const direct = preset.traits.includes("direct") || preset.traits.includes("sales-focused");

  nextTimeline.styleDnaSystem = {
    ...nextTimeline.styleDnaSystem,
    activePresetId: preset.id,
    lastAppliedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  nextTimeline.creativeBrain.input.style = preset.name;
  nextTimeline.creativeBrain.output.pacing = preset.pacing;
  nextTimeline.creativeBrain.output.hookDirection = preset.hookStyle;
  nextTimeline.aiPlan.objective = `${nextTimeline.aiPlan.objective} Style DNA applied: ${preset.name}.`;

  nextTimeline.tracks = nextTimeline.tracks.map((track) => ({
    ...track,
    items: track.items.map((item) => {
      if (item.type === "video") {
        if (fast && item.startTime < 8) return { ...item, duration: Math.min(item.duration, 3.2), trimEnd: Math.min(item.trimEnd, item.trimStart + 3.2), scale: Math.max(item.scale, 1.08) };
        if (slow) return { ...item, duration: Math.min(item.duration + 1.5, 8), trimEnd: Math.min(item.trimEnd + 1.5, item.trimStart + 8), scale: Math.max(0.9, item.scale - 0.04) };
      }
      if (item.type === "caption") {
        if (aggressiveCaptions) return { ...item, scale: 1.18, position: { x: 0.5, y: 0.76 }, duration: Math.min(item.duration, 2.2), opacity: 1 };
        if (elegantSubtitles) return { ...item, scale: 0.86, position: { x: 0.5, y: 0.84 }, duration: Math.max(item.duration, 3.4), opacity: 0.9 };
      }
      if (item.type === "text" && item.id === "hook-text") {
        return {
          ...item,
          text: direct ? "Stop wasting time. Try the faster way." : preset.hookStyle,
          scale: aggressiveCaptions ? 1.16 : elegantSubtitles ? 0.9 : item.scale,
          position: { x: 0.5, y: aggressiveCaptions ? 0.18 : 0.22 },
        };
      }
      if (item.type === "audio" && item.id === "music-bed") {
        return { ...item, volume: fast ? 0.42 : slow ? 0.22 : item.volume };
      }
      return item;
    }),
  }));

  const ctaText = premiumCta
    ? "Create better videos in minutes."
    : direct
      ? "Try it today."
      : "See the difference.";
  const ctaStart = Math.max(0, nextTimeline.project.duration - (fast ? 6 : 5));
  const hasStyleCta = nextTimeline.tracks.some((track) => track.items.some((item) => item.id === "style-dna-cta"));
  nextTimeline.tracks = nextTimeline.tracks.map((track) => (
    track.id === "text-main"
      ? {
          ...track,
          items: hasStyleCta
            ? track.items.map((item) => item.id === "style-dna-cta" ? { ...item, text: ctaText, startTime: ctaStart, scale: premiumCta ? 1 : 0.9 } : item)
            : [
                ...track.items,
                {
                  id: "style-dna-cta",
                  type: "text",
                  name: `${preset.name} CTA`,
                  trackId: "text-main",
                  text: ctaText,
                  startTime: ctaStart,
                  duration: 4,
                  trimStart: 0,
                  trimEnd: 4,
                  volume: 0,
                  position: { x: 0.5, y: 0.72 },
                  scale: premiumCta ? 1 : 0.9,
                  opacity: 1,
                },
              ],
        }
      : track
  ));

  nextTimeline.performanceEngine = buildPerformanceEngine(nextTimeline);
  return nextTimeline;
}

function applyTimelineCommand(timeline: BuzzlyTimelineJson, command: string, selectedItemId: string | null): { timeline: BuzzlyTimelineJson; summary: string; seekTo?: number } {
  const requestedDuration = Number(command.match(/(\d+)\s*(sec|second|seconds|s)?/)?.[1]);
  const originalCommand = command.trim();
  let action: BuzzlyTimelineCommand = "manual-trim";
  let detectedIntent: BuzzlyConversationalIntent = "timeline-edit";
  let summary = "Adjusted the selected clip while keeping timeline control manual.";
  let response = "Done. I made a small timeline adjustment, and you can still fine-tune it manually.";
  let seekTo: number | undefined;

  const nextTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(timeline));
  const allItems = () => nextTimeline.tracks.flatMap((track) => track.items);
  const updateById = (id: string, patch: Partial<BuzzlyTimelineItem>) => {
    nextTimeline.tracks = nextTimeline.tracks.map((track) => ({
      ...track,
      items: track.items.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  };
  const ensureItem = (trackId: string, item: BuzzlyTimelineItem) => {
    nextTimeline.tracks = nextTimeline.tracks.map((track) => (
      track.id === trackId && !track.items.some((existing) => existing.id === item.id)
        ? { ...track, items: [...track.items, item] }
        : track
    ));
  };

  if (command.includes("funny") || command.includes("mas funny")) {
    action = "make-funnier";
    detectedIntent = "tone-funny";
    const funnyHook = "Pagod ka na? Same. Yung kalat, parang may comeback tour.";
    updateById("hook-text", { text: funnyHook, duration: 3.8, scale: 1.08 });
    updateById("caption-1", { text: funnyHook, duration: 3.2, scale: 1.08 });
    updateById("clip-hook", { duration: 4, trimEnd: 4 });
    nextTimeline.creativeBrain.output.hookDirection = "Use a relatable joke first, then quickly reveal the practical product payoff.";
    summary = "Tone shifted funnier with a playful hook and tighter opening beat.";
    response = "Ginawa kong mas funny: playful first line, quicker hook, same selling point.";
    seekTo = 0;
  } else if ((command.includes("cta") && (command.includes("strong") || command.includes("stronger"))) || command.includes("lagyan mo")) {
    action = "stronger-cta";
    detectedIntent = "cta-stronger";
    const cta = "Try it today. Linis faster, pahinga sooner.";
    updateById("product-packshot", { startTime: Math.max(0, nextTimeline.project.duration - 7), duration: 6, scale: 0.92, opacity: 1 });
    ensureItem("text-main", {
      id: "cta-text",
      type: "text",
      name: "Strong CTA",
      trackId: "text-main",
      text: cta,
      startTime: Math.max(0, nextTimeline.project.duration - 5),
      duration: 4,
      trimStart: 0,
      trimEnd: 4,
      volume: 0,
      position: { x: 0.5, y: 0.72 },
      scale: 0.9,
      opacity: 1,
    });
    summary = "Stronger CTA added near the end with packshot emphasis.";
    response = "Added a stronger CTA near the end so the video closes with a clear next step.";
    seekTo = Math.max(0, nextTimeline.project.duration - 6);
  } else if ((command.includes("mabilis") && command.includes("cut")) || command.includes("faster cuts") || command.includes("fast cuts")) {
    action = "faster-cuts";
    detectedIntent = "pace-faster";
    updateById("clip-hook", { duration: 2.8, trimEnd: 2.8 });
    updateById("clip-demo", { startTime: 2.8, duration: 8.5, trimStart: 1, trimEnd: 9.5 });
    updateById("product-packshot", { startTime: 11.3, duration: 4.5 });
    updateById("caption-1", { duration: 1.8, scale: 1.12 });
    nextTimeline.project.duration = Math.min(nextTimeline.project.duration, 24);
    summary = "Cut pacing accelerated: shorter hook, earlier product proof, earlier product beat.";
    response = "Mas mabilis na cuts: shorter intro, earlier product proof, tighter product beat.";
    seekTo = 0;
  } else if (command.includes("boring") || command.includes("too boring")) {
    action = "fix-boring";
    detectedIntent = "fix-boring";
    updateById("hook-text", { text: "Wait. This cleaning shortcut actually works.", scale: 1.14, duration: 3 });
    updateById("clip-hook", { duration: 3, scale: 1.08 });
    updateById("clip-demo", { startTime: 3, scale: 1.18 });
    updateById("music-bed", { volume: 0.42 });
    summary = "Energy increased with a sharper hook, zoomed visuals, and louder music bed.";
    response = "I gave it more energy: sharper hook, stronger zoom, and more music lift.";
    seekTo = 0;
  } else if (command.includes("gen z") || command.includes("genz") || command.includes("pang gen")) {
    action = "gen-z-style";
    detectedIntent = "style-gen-z";
    updateById("hook-text", { text: "POV: may shortcut ka sa linis.", scale: 1.1, duration: 3 });
    updateById("caption-1", { text: "POV: may shortcut ka sa linis.", scale: 1.14, position: { x: 0.5, y: 0.76 } });
    updateById("music-bed", {
      name: "Gen Z bounce beat",
      source: { kind: "mock", filename: "gen-z-bounce-beat.mp3", mimeType: "audio/mpeg" },
      volume: 0.38,
    });
    summary = "Style shifted Gen Z with POV hook, bouncier music, and punchier caption treatment.";
    response = "Mas pang Gen Z na: POV hook, punchier caption, bouncier music.";
    seekTo = 0;
  } else if ((command.includes("palitan") && command.includes("music")) || (command.includes("change") && command.includes("music") && !command.includes("emotional"))) {
    action = "change-music";
    detectedIntent = "music-change";
    updateById("music-bed", {
      name: "Fresh upbeat beat",
      source: { kind: "mock", filename: "fresh-upbeat-beat.mp3", mimeType: "audio/mpeg" },
      volume: 0.34,
    });
    summary = "Music swapped to a fresh upbeat beat.";
    response = "Music changed. I picked a fresher upbeat track for more scroll energy.";
  } else if (command.includes("b-roll") || command.includes("broll")) {
    action = "add-ai-broll";
    detectedIntent = "add-ai-broll";
    ensureItem("video-main", {
      id: "ai-broll-cleaning-reset",
      type: "video",
      name: "AI B-roll: cleaning reset",
      trackId: "video-main",
      source: { kind: "generated", filename: "ai-cleaning-reset.mp4", mimeType: "video/mp4" },
      startTime: 12,
      duration: 5,
      trimStart: 0,
      trimEnd: 5,
      volume: 0,
      position: { x: 0.5, y: 0.5 },
      scale: 1.08,
      opacity: 1,
    });
    nextTimeline.assetIntelligence.coverage.ready = uniqueCategories([...nextTimeline.assetIntelligence.coverage.ready, "aesthetic-shot", "before-after"]);
    nextTimeline.assetIntelligence.coverage.missing = nextTimeline.assetIntelligence.coverage.missing.filter((category) => category !== "before-after");
    summary = "AI B-roll placeholder added to cover the missing transformation shot.";
    response = "Added AI B-roll for the transformation moment. Later this can route through the video engine.";
    seekTo = 12;
  } else if (command.includes("intro") && (command.includes("fast") || command.includes("faster"))) {
    action = "make-intro-faster";
    detectedIntent = "pace-faster";
    updateById("clip-hook", { duration: 3.5, trimEnd: 3.5 });
    updateById("hook-text", { duration: 2.8, scale: 1.08 });
    updateById("caption-1", { duration: 2.2, scale: 1.06 });
    updateById("clip-demo", { startTime: 3.5, duration: 12, trimStart: 0.5, trimEnd: 12.5 });
    summary = "Intro tightened: hook shortened, product proof starts earlier, captions snap faster.";
    response = "Intro is faster now: shorter hook and product proof starts earlier.";
    seekTo = 0;
  } else if (command.includes("hook")) {
    action = "add-stronger-hook";
    detectedIntent = "timeline-edit";
    const hookText = "Pagod ka na ba sa linis na paulit-ulit?";
    updateById("hook-text", { text: hookText, duration: 3.5, scale: 1.12, position: { x: 0.5, y: 0.16 } });
    updateById("caption-1", { text: hookText, duration: 2.6, scale: 1.08 });
    nextTimeline.creativeBrain.output.hookDirection = "Open with the cleaning frustration in plain language, then cut quickly to the product solving it.";
    summary = "Hook strengthened with a clearer pain-point line and bigger first caption.";
    response = "Stronger hook added with a clearer pain point.";
    seekTo = 0;
  } else if (command.includes("music") && (command.includes("emotional") || command.includes("background"))) {
    action = "change-music-emotional";
    detectedIntent = "music-change";
    updateById("music-bed", {
      name: "Emotional soft beat",
      source: { kind: "mock", filename: "emotional-soft-beat.mp3", mimeType: "audio/mpeg" },
      volume: 0.24,
    });
    summary = "Music changed to an emotional soft beat and ducked under the voiceover.";
    response = "Music is more emotional now and sits under the voice better.";
  } else if (command.includes("shorten") || command.includes("duration")) {
    action = "shorten-duration";
    detectedIntent = "timeline-edit";
    const duration = requestedDuration || 35;
    nextTimeline.project.duration = duration;
    nextTimeline.tracks = nextTimeline.tracks.map((track) => ({
      ...track,
      items: track.items
        .filter((item) => item.startTime < duration)
        .map((item) => ({ ...item, duration: Math.min(item.duration, Math.max(0.5, duration - item.startTime)) })),
    }));
    summary = `Timeline shortened to ${duration} seconds while preserving visible clips.`;
    response = `Shortened it to ${duration} seconds and kept the visible clips intact.`;
    seekTo = Math.min(timeline.project.duration, duration);
  } else if (command.includes("caption") && (command.includes("premium") || command.includes("bigger"))) {
    action = "premium-captions";
    detectedIntent = "timeline-edit";
    allItems().filter((item) => item.type === "caption").forEach((item) => {
      updateById(item.id, { scale: 1.16, opacity: 1, position: { x: 0.5, y: 0.78 } });
    });
    summary = "Captions moved higher, scaled up, and made cleaner for a premium look.";
    response = "Captions are more premium now: bigger, cleaner, and positioned higher.";
  } else if (command.includes("close") || command.includes("product")) {
    action = "add-product-closeups";
    detectedIntent = "timeline-edit";
    updateById("product-packshot", { startTime: 14, duration: 6, scale: 0.9, opacity: 1, position: { x: 0.5, y: 0.44 } });
    updateById("clip-demo", { scale: 1.16, position: { x: 0.48, y: 0.48 } });
    summary = "Product closeups emphasized by scaling the proof clip and bringing the packshot earlier.";
    response = "Added more product focus by zooming the proof clip and moving the packshot earlier.";
    seekTo = 14;
  } else if (selectedItemId) {
    const selected = allItems().find((item) => item.id === selectedItemId);
    if (selected) {
      updateById(selected.id, { duration: Math.max(0.5, selected.duration - 0.5), trimEnd: selected.trimEnd - 0.5 });
      summary = `Trimmed ${selected.name} by half a second.`;
      response = `Trimmed ${selected.name}. You can still adjust it on the timeline.`;
      seekTo = selected.startTime;
    }
  }

  nextTimeline.aiTimelineEngine.lastCommand = {
    prompt: command || "manual timeline assist",
    action,
    summary,
  };
  nextTimeline.conversationalEditing.recentEdits = [
    {
      id: `conversation-${Date.now()}`,
      userMessage: originalCommand || "timeline assist",
      detectedIntent,
      timelineAction: action,
      response,
    },
    ...nextTimeline.conversationalEditing.recentEdits,
  ].slice(0, 6);
  nextTimeline.performanceEngine = buildPerformanceEngine(nextTimeline);

  return { timeline: nextTimeline, summary, seekTo };
}

function buildCreativePlan(input: BuzzlyCreativeBrainInput, output: BuzzlyCreativeBrainOutput): BuzzlyPlanningLayer {
  const product = input.product || "Buzzly";
  const audience = input.audience || "creators";
  const idea = input.userIdea || "editing takes too long";
  const isEditingProduct = `${product} ${idea}`.toLowerCase().includes("edit") || product.toLowerCase().includes("buzzly");

  return {
    mode: "creative-plan-before-generation",
    principle: "strategy-first-not-random-generation",
    planName: `${product} Creative Plan`,
    beats: [
      {
        key: "hook",
        label: "Hook",
        line: isEditingProduct ? "POV: Hirap ka na mag edit?" : output.hookDirection,
        purpose: "Stop the scroll with the sharpest pain point.",
        duration: 3,
        visualDirection: "Start on the most relatable frustration visual, then cut fast.",
      },
      {
        key: "problem",
        label: "Problem",
        line: isEditingProduct ? "Editing takes too long." : idea,
        purpose: `Make ${audience} feel understood before selling.`,
        duration: 5,
        visualDirection: "Show the annoying manual work or messy before state.",
      },
      {
        key: "solution",
        label: "Solution",
        line: isEditingProduct ? "Buzzly AI workflow builds the video around your strategy." : `${product} is the shortcut.`,
        purpose: "Introduce the product as the practical answer.",
        duration: 8,
        visualDirection: "Show product-in-use, automation, or a clean workflow moment.",
      },
      {
        key: "highlight",
        label: "Highlight",
        line: isEditingProduct ? "Fast automation. Smart assets. Better videos." : "Fast automation with a clearer result.",
        purpose: "Prove the advantage with one memorable benefit.",
        duration: 8,
        visualDirection: "Use closeups, speed ramps, captions, and before/after proof.",
      },
      {
        key: "cta",
        label: "CTA",
        line: isEditingProduct ? "Generate 10 videos in minutes." : `Try ${product} today.`,
        purpose: "End with one simple action.",
        duration: 4,
        visualDirection: "Packshot or offer card with the CTA large and clean.",
      },
    ],
    generationBrief: `Build every generated image, B-roll, voice line, caption, and timeline beat around ${product}'s Hook > Problem > Solution > Highlight > CTA plan. No random generation.`,
  };
}

function applyPlanToTimeline(timeline: BuzzlyTimelineJson, plan: BuzzlyPlanningLayer): BuzzlyTimelineJson {
  const nextTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(timeline));
  const [hook, problem, solution, highlight, cta] = plan.beats;
  const starts = [0, hook.duration, hook.duration + problem.duration, hook.duration + problem.duration + solution.duration, hook.duration + problem.duration + solution.duration + highlight.duration];
  const totalDuration = plan.beats.reduce((total, beat) => total + beat.duration, 0);

  nextTimeline.project.duration = totalDuration;
  nextTimeline.aiPlan.objective = plan.generationBrief;
  nextTimeline.aiPlan.scenes = plan.beats.map((beat, index) => ({
    id: `plan-${beat.key}`,
    title: beat.label,
    goal: beat.purpose,
    script: beat.line,
    captionText: beat.line,
    clipSelection: [beat.visualDirection],
    musicSuggestion: index === 0 ? "Fast first beat under the hook." : "Keep music supporting the voiceover.",
    cta: cta.line,
  }));

  nextTimeline.tracks = nextTimeline.tracks.map((track) => ({
    ...track,
    items: track.items.map((item) => {
      if (item.id === "clip-hook") return { ...item, startTime: starts[0], duration: hook.duration, trimStart: 0, trimEnd: hook.duration };
      if (item.id === "clip-demo") return { ...item, startTime: starts[2], duration: solution.duration, trimStart: 0, trimEnd: solution.duration, scale: 1.1 };
      if (item.id === "product-packshot") return { ...item, startTime: starts[4], duration: cta.duration, scale: 0.94, opacity: 1 };
      if (item.id === "hook-text") return { ...item, text: hook.line, startTime: starts[0], duration: hook.duration, scale: 1.08 };
      if (item.id === "caption-1") return { ...item, text: hook.line, startTime: starts[0], duration: hook.duration, scale: 1.1 };
      if (item.id === "voiceover") return { ...item, startTime: 0, duration: totalDuration, trimStart: 0, trimEnd: totalDuration };
      if (item.id === "music-bed") return { ...item, startTime: 0, duration: totalDuration, trimStart: 0, trimEnd: totalDuration, volume: 0.34 };
      return item;
    }),
  }));

  const hasCtaText = nextTimeline.tracks.some((track) => track.items.some((item) => item.id === "plan-cta-text"));
  if (!hasCtaText) {
    nextTimeline.tracks = nextTimeline.tracks.map((track) => (
      track.id === "text-main"
        ? {
            ...track,
            items: [
              ...track.items,
              {
                id: "plan-cta-text",
                type: "text",
                name: "Plan CTA",
                trackId: "text-main",
                text: cta.line,
                startTime: starts[4],
                duration: cta.duration,
                trimStart: 0,
                trimEnd: cta.duration,
                volume: 0,
                position: { x: 0.5, y: 0.72 },
                scale: 0.92,
                opacity: 1,
              },
            ],
          }
        : track
    ));
  }

  nextTimeline.aiTimelineEngine.lastCommand = {
    prompt: "apply creative plan",
    action: "stronger-cta",
    summary: "Applied Hook, Problem, Solution, Highlight, CTA structure to the timeline.",
  };
  nextTimeline.smartSceneGeneration = buildSmartSceneGeneration(nextTimeline);
  nextTimeline.performanceEngine = buildPerformanceEngine(nextTimeline);

  return nextTimeline;
}

function buildPerformanceEngine(timeline: BuzzlyTimelineJson) {
  const items = timeline.tracks.flatMap((track) => track.items);
  const visualItems = items.filter((item) => item.type !== "audio");
  const audioItems = items.filter((item) => item.type === "audio");
  const captionItems = items.filter((item) => item.type === "caption");
  const textItems = items.filter((item) => item.type === "text");
  const generatedVisuals = visualItems.filter((item) => item.source?.kind === "generated");
  const hookText = `${textItems.find((item) => item.startTime < 4)?.text || ""} ${captionItems.find((item) => item.startTime < 4)?.text || ""}`;
  const firstVisual = visualItems.filter((item) => item.startTime < 4).sort((a, b) => a.startTime - b.startTime)[0];
  const firstThreeVisualCount = visualItems.filter((item) => item.startTime < 3).length;
  const ctaItems = textItems.filter((item) => /cta|try|generate|buy|today|minutes/i.test(`${item.name} ${item.text || ""}`));
  const ctaStart = ctaItems.length ? Math.min(...ctaItems.map((item) => item.startTime)) : timeline.project.duration;
  const avgCaptionSeconds = captionItems.length
    ? captionItems.reduce((total, item) => total + item.duration, 0) / captionItems.length
    : 3;
  const visualLayerDensity = Math.max(...Array.from({ length: Math.ceil(timeline.project.duration) }, (_, second) =>
    visualItems.filter((item) => second >= item.startTime && second < item.startTime + item.duration).length,
  ));
  const hasEmotion = timeline.assetIntelligence.coverage.ready.some((category) => category === "emotional-shot" || category === "face-clip" || category === "before-after")
    || generatedVisuals.some((item) => /emotion|lifestyle|transformation|reaction|before|after/i.test(`${item.name} ${item.source?.filename || ""}`));
  const audioEnergy = audioItems.reduce((max, item) => Math.max(max, item.volume), 0);
  const longestVisualDuration = visualItems.reduce((max, item) => Math.max(max, item.duration), 0);

  const hookStrength = scoreClamp(62 + (hookText.length > 20 ? 14 : 0) + (firstVisual?.duration && firstVisual.duration <= 4 ? 8 : 0) + (firstThreeVisualCount >= 2 ? 6 : 0));
  const retentionPacing = scoreClamp(88 - Math.max(0, longestVisualDuration - 5) * 4 + (firstThreeVisualCount >= 2 ? 6 : -6));
  const deadMoments = scoreClamp(90 - Math.max(0, longestVisualDuration - 6) * 5 - (visualItems.length < 3 ? 8 : 0));
  const visualOverload = scoreClamp(92 - Math.max(0, visualLayerDensity - 3) * 12);
  const ctaTiming = scoreClamp(60 + (ctaStart <= timeline.project.duration - 5 ? 18 : 0) + (ctaStart >= timeline.project.duration - 9 ? 8 : -6));
  const subtitleSpeed = scoreClamp(86 - Math.max(0, 1.6 - avgCaptionSeconds) * 12 - Math.max(0, avgCaptionSeconds - 4) * 8);
  const emotionalVariation = scoreClamp(58 + (hasEmotion ? 22 : 0) + (generatedVisuals.length ? 6 : 0));
  const audioEnergyScore = scoreClamp(58 + audioEnergy * 50 + (audioItems.length > 1 ? 6 : 0));

  const metricInputs = [
    {
      key: "hook-strength" as const,
      label: "Hook strength",
      score: hookStrength,
      insight: hookStrength >= 80 ? "The opening has a clear hook and enough early motion." : "The opening needs a sharper first line or faster visual interruption.",
    },
    {
      key: "retention-pacing" as const,
      label: "Retention pacing",
      score: retentionPacing,
      insight: retentionPacing >= 80 ? "Cut rhythm is strong enough for short-form viewing." : "The edit has clips that stay on screen too long for a high-retention ad.",
    },
    {
      key: "dead-moments" as const,
      label: "Dead moments",
      score: deadMoments,
      insight: deadMoments >= 80 ? "No major slow zones detected." : "There are stretches that can be trimmed or replaced with a proof beat.",
    },
    {
      key: "visual-overload" as const,
      label: "Visual overload",
      score: visualOverload,
      insight: visualOverload >= 80 ? "Layer density is readable." : "Too many overlapping visual layers may compete with the message.",
    },
    {
      key: "cta-timing" as const,
      label: "CTA timing",
      score: ctaTiming,
      insight: ctaTiming >= 80 ? "CTA lands close to the payoff window." : "CTA should arrive earlier and feel more direct.",
    },
    {
      key: "subtitle-speed" as const,
      label: "Subtitle speed",
      score: subtitleSpeed,
      insight: subtitleSpeed >= 80 ? "Subtitle timing is readable for fast viewing." : "Captions may be too fast or too slow for thumb-stopping edits.",
    },
    {
      key: "emotional-variation" as const,
      label: "Emotional variation",
      score: emotionalVariation,
      insight: emotionalVariation >= 80 ? "The edit has enough human feeling or transformation proof." : "Add a reaction, lifestyle, or before/after moment to avoid a flat product pitch.",
    },
    {
      key: "audio-energy" as const,
      label: "Audio energy",
      score: audioEnergyScore,
      insight: audioEnergyScore >= 80 ? "Audio supports momentum." : "Music or voice energy can lift the hook and midpoint.",
    },
  ];
  const metrics = metricInputs.map((metric) => ({
    ...metric,
    status: metric.score >= 80 ? "strong" as const : metric.score >= 70 ? "watch" as const : "fix" as const,
  }));
  const viralPotentialScore = Math.round(metrics.reduce((total, metric) => total + metric.score, 0) / metrics.length);
  const suggestions = buildPerformanceSuggestions(metrics, timeline.performanceEngine?.suggestions || []);

  return {
    mode: "ai-creative-analyst" as const,
    principle: "performance-is-the-core-moat" as const,
    viralPotentialScore,
    summary: viralPotentialScore >= 82
      ? "Strong viral structure. Keep testing hooks and CTA variants."
      : viralPotentialScore >= 72
        ? "Good first-cut potential. Biggest upside is tightening pacing, CTA clarity, and emotional variation."
        : "Needs performance work before export. Fix the hook, pacing, CTA, and emotional proof before scaling.",
    metrics,
    suggestions,
    lastAnalyzedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function buildPerformanceSuggestions(
  metrics: BuzzlyPerformanceMetric[],
  previousSuggestions: BuzzlyPerformanceSuggestion[],
): BuzzlyPerformanceSuggestion[] {
  const previous = new Map(previousSuggestions.map((suggestion) => [suggestion.command, suggestion.status]));
  const metricScore = (key: string) => metrics.find((metric) => metric.key === key)?.score || 100;
  const candidates: BuzzlyPerformanceSuggestion[] = [
    {
      id: "perf-faster-first-3",
      title: "Make first 3 seconds faster",
      command: "faster-first-3-seconds",
      impact: Math.max(5, Math.round((100 - metricScore("retention-pacing")) / 3)),
      reason: "Earlier motion and tighter first beats improve retention.",
      timelinePrompt: "Mas mabilis cuts",
      status: "suggested",
    },
    {
      id: "perf-shorten-intro",
      title: "Shorten intro",
      command: "shorten-intro",
      impact: Math.max(4, Math.round((100 - metricScore("hook-strength")) / 4)),
      reason: "The hook should land before viewers can swipe away.",
      timelinePrompt: "Make intro faster",
      status: "suggested",
    },
    {
      id: "perf-stronger-cta",
      title: "Add stronger CTA",
      command: "stronger-cta",
      impact: Math.max(5, Math.round((100 - metricScore("cta-timing")) / 3)),
      reason: "A clearer CTA turns attention into action.",
      timelinePrompt: "Lagyan mo ng stronger CTA",
      status: "suggested",
    },
    {
      id: "perf-premium-subtitles",
      title: "Improve subtitle readability",
      command: "premium-subtitles",
      impact: Math.max(4, Math.round((100 - metricScore("subtitle-speed")) / 5)),
      reason: "Readable captions protect retention when viewers watch muted.",
      timelinePrompt: "Make captions more premium",
      status: "suggested",
    },
    {
      id: "perf-boost-audio",
      title: "Boost audio energy",
      command: "boost-audio-energy",
      impact: Math.max(4, Math.round((100 - metricScore("audio-energy")) / 4)),
      reason: "More audio lift helps the hook and keeps the edit moving.",
      timelinePrompt: "Palitan music",
      status: "suggested",
    },
    {
      id: "perf-emotional-variation",
      title: "Add emotional variation",
      command: "add-emotional-variation",
      impact: Math.max(6, Math.round((100 - metricScore("emotional-variation")) / 3)),
      reason: "A reaction, lifestyle, or transformation beat keeps the video from feeling flat.",
      timelinePrompt: "Add AI B-roll",
      status: "suggested",
    },
    {
      id: "perf-remove-weak-clip",
      title: "Remove weak clip",
      command: "remove-weak-clip",
      impact: Math.max(4, Math.round((100 - metricScore("dead-moments")) / 4)),
      reason: "Cutting weak moments keeps the viewer moving toward the payoff.",
      timelinePrompt: "Shorten duration",
      status: "suggested",
    },
  ];

  return candidates
    .filter((suggestion) => suggestion.impact >= 5)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 4)
    .map((suggestion) => ({
      ...suggestion,
      status: previous.get(suggestion.command) || suggestion.status,
    }));
}

function scoreClamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildAiPipeline(timeline: BuzzlyTimelineJson, completed: Array<BuzzlyAiPipeline["steps"][number]["key"]> = []): BuzzlyAiPipeline {
  const done = new Set(completed);
  const hasIdea = Boolean(timeline.creativeBrain.input.userIdea);
  const missingCount = timeline.assetIntelligence.coverage.missing.length;
  const generatedCount = timeline.tracks.flatMap((track) => track.items).filter((item) => item.source?.kind === "generated").length;
  const hasVoice = timeline.tracks.some((track) => track.items.some((item) => item.id === "voiceover" || item.name.toLowerCase().includes("voice")));
  const hasCaptions = timeline.tracks.some((track) => track.items.some((item) => item.type === "caption"));
  const hasMusic = timeline.tracks.some((track) => track.items.some((item) => item.id === "music-bed" || item.name.toLowerCase().includes("music")));
  const renderReady = timeline.renderingArchitecture.currentEstimate.status !== "too-heavy";
  const steps: BuzzlyAiPipeline["steps"] = [
    { key: "user-idea", label: "User Idea", description: "Capture the creator goal, audience, product, platform, and raw concept.", ownerLayer: "Creative Brain", status: hasIdea ? "done" : "needs-input" },
    { key: "ai-planning", label: "AI Planning", description: "Build the Hook, Problem, Solution, Highlight, CTA plan before generation.", ownerLayer: "Creative Plan", status: done.has("ai-planning") || timeline.planningLayer.beats.length >= 5 ? "done" : "ready" },
    { key: "asset-scanning", label: "Asset Scanning", description: "Scan uploaded and generated media into smart asset categories.", ownerLayer: "Smart Asset Mapping", status: timeline.assetIntelligence.lastScanStatus === "scanned" || done.has("asset-scanning") ? "done" : "ready" },
    { key: "missing-asset-detection", label: "Missing Asset Detection", description: "Find weak or missing proof, emotion, closeup, and packshot coverage.", ownerLayer: "Asset Intelligence", status: done.has("missing-asset-detection") || missingCount >= 0 ? "done" : "ready" },
    { key: "ai-asset-generation", label: "AI Asset Generation", description: "Generate closeups, lifestyle shots, motion scenes, AI B-roll, and backgrounds.", ownerLayer: "Smart Scene Generation", status: generatedCount > 0 || done.has("ai-asset-generation") ? "done" : "ready" },
    { key: "script-generation", label: "Script Generation", description: "Generate script lines and captions from the creative plan.", ownerLayer: "Creative Brain", status: timeline.aiPlan.scenes.length > 0 || done.has("script-generation") ? "done" : "ready" },
    { key: "voice-generation", label: "Voice Generation", description: "Route and prepare narration using language and emotion rules.", ownerLayer: "AI Router", status: hasVoice || done.has("voice-generation") ? "done" : "ready" },
    { key: "timeline-auto-assembly", label: "Timeline Auto Assembly", description: "Assemble clips, text, captions, voice, music, and generated scenes.", ownerLayer: "AI Timeline Engine", status: timeline.tracks.some((track) => track.items.length > 0) || done.has("timeline-auto-assembly") ? "done" : "ready" },
    { key: "subtitle-music", label: "Subtitle + Music", description: "Apply subtitle styling, music bed, and audio energy.", ownerLayer: "Timeline Engine", status: hasCaptions && hasMusic ? "done" : "ready" },
    { key: "performance-optimization", label: "Performance Optimization", description: "Score hook, retention, CTA, dead moments, emotion, and audio.", ownerLayer: "Performance Engine", status: done.has("performance-optimization") || timeline.performanceEngine.lastAnalyzedAt !== "Not analyzed in this session" ? "done" : "ready" },
    { key: "render", label: "Render", description: "Use speed-first 1080x1920 lightweight rendering.", ownerLayer: "Speed Render Engine", status: renderReady || done.has("render") ? "done" : "ready" },
    { key: "chat-based-revisions", label: "Chat-based Revisions", description: "Let users revise the edit conversationally after preview or render.", ownerLayer: "AI Assistant", status: done.has("chat-based-revisions") || timeline.conversationalEditing.recentEdits.length > 0 ? "done" : "ready" },
  ];

  const current = steps.find((step) => step.status !== "done")?.key || "chat-based-revisions";
  const doneCount = steps.filter((step) => step.status === "done").length;
  return {
    ...timeline.aiPipeline,
    currentStep: current,
    summary: `Pipeline progress: ${doneCount}/${steps.length} steps ready from idea to render and chat revisions.`,
    steps,
  };
}

function runAiPipeline(timeline: BuzzlyTimelineJson): { timeline: BuzzlyTimelineJson; summary: string } {
  const input = timeline.creativeBrain.input;
  const output = buildCreativeDirection(input);
  const plan = buildCreativePlan(input, output);
  let nextTimeline: BuzzlyTimelineJson = {
    ...timeline,
    creativeBrain: {
      ...timeline.creativeBrain,
      output,
    },
    planningLayer: plan,
  };
  nextTimeline = applyPlanToTimeline(nextTimeline, plan);
  nextTimeline.assetIntelligence = buildSmartAssetMapping(nextTimeline);
  nextTimeline.smartSceneGeneration = buildSmartSceneGeneration(nextTimeline);
  nextTimeline = applySmartSceneGeneration(nextTimeline).timeline;
  nextTimeline.hybridGeneration = buildHybridGenerationRoutes(nextTimeline);
  nextTimeline.performanceEngine = buildPerformanceEngine(nextTimeline);
  nextTimeline = optimizeTimelineForSpeed(nextTimeline);
  nextTimeline.aiPipeline = buildAiPipeline(nextTimeline, [
    "user-idea",
    "ai-planning",
    "asset-scanning",
    "missing-asset-detection",
    "ai-asset-generation",
    "script-generation",
    "voice-generation",
    "timeline-auto-assembly",
    "subtitle-music",
    "performance-optimization",
    "render",
  ]);
  nextTimeline.aiTimelineEngine.lastCommand = {
    prompt: "run full ai pipeline",
    action: "add-ai-broll",
    summary: "Ran the full idea-to-render pipeline and left chat revisions ready.",
  };

  return {
    timeline: nextTimeline,
    summary: "User idea planned, assets scanned, missing scenes generated, timeline assembled, performance optimized, and render prepared.",
  };
}

function buildRenderingArchitecture(timeline: BuzzlyTimelineJson): BuzzlyRenderingArchitecture {
  const visualItems = timeline.tracks.flatMap((track) => track.items).filter((item) => item.type !== "audio");
  const generatedVisuals = visualItems.filter((item) => item.source?.kind === "generated").length;
  const localVisuals = visualItems.filter((item) => item.source?.kind === "local").length;
  const layerDensity = Math.max(1, ...Array.from({ length: Math.max(1, Math.ceil(timeline.project.duration)) }, (_, second) =>
    visualItems.filter((item) => second >= item.startTime && second < item.startTime + item.duration).length,
  ));
  const resolutionMultiplier = (timeline.project.width * timeline.project.height) / (1080 * 1920);
  const baseSeconds = timeline.project.duration * 1.45;
  const complexitySeconds = layerDensity * 5 + generatedVisuals * 6 + localVisuals * 3;
  const estimatedExportSeconds = Math.round((baseSeconds + complexitySeconds) * Math.max(1, resolutionMultiplier));
  const overDuration = Math.max(0, timeline.project.duration - 45);
  const speedScore = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, estimatedExportSeconds - 90) * 0.35 - overDuration * 2.2 - Math.max(0, layerDensity - 4) * 8)));
  const status = estimatedExportSeconds <= 120 && timeline.project.duration <= 45 && speedScore >= 75
    ? "fast"
    : estimatedExportSeconds <= 150 && timeline.project.duration <= 60
      ? "watch"
      : "too-heavy";

  return {
    ...timeline.renderingArchitecture,
    targetResolution: {
      width: 1080,
      height: 1920,
    },
    currentEstimate: {
      duration: timeline.project.duration,
      estimatedExportSeconds,
      speedScore,
      status,
      notes: [
        `${timeline.project.width}x${timeline.project.height} project, optimized target 1080x1920`,
        `${layerDensity} peak visual layer${layerDensity === 1 ? "" : "s"}`,
        timeline.project.duration <= 45 ? "Short-form duration is inside speed target" : "Duration exceeds the 45-second speed target",
      ],
    },
  };
}

function optimizeTimelineForSpeed(timeline: BuzzlyTimelineJson): BuzzlyTimelineJson {
  const nextTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(timeline));
  nextTimeline.project = {
    ...nextTimeline.project,
    format: "tiktok-reel-9x16",
    width: 1080,
    height: 1920,
    duration: Math.min(nextTimeline.project.duration, 45),
  };
  nextTimeline.tracks = nextTimeline.tracks.map((track) => ({
    ...track,
    items: track.items
      .filter((item) => item.startTime < nextTimeline.project.duration)
      .map((item) => ({
        ...item,
        duration: Math.min(item.duration, Math.max(0.5, nextTimeline.project.duration - item.startTime)),
        trimEnd: Math.min(item.trimEnd, item.trimStart + Math.min(item.duration, Math.max(0.5, nextTimeline.project.duration - item.startTime))),
        scale: item.type === "video" ? Math.min(item.scale, 1.25) : item.scale,
      })),
  }));
  nextTimeline.render = {
    ...nextTimeline.render,
    primary: "remotion",
    helpers: ["ffmpeg"],
    futurePreview: ["webcodecs"],
  };
  nextTimeline.renderingArchitecture = buildRenderingArchitecture(nextTimeline);
  nextTimeline.performanceEngine = buildPerformanceEngine(nextTimeline);
  return nextTimeline;
}

function buildHybridGenerationRoutes(timeline: BuzzlyTimelineJson): BuzzlyHybridGeneration {
  const input = timeline.creativeBrain.input;
  const style = input.style.toLowerCase();
  const idea = input.userIdea.toLowerCase();
  const missing = timeline.assetIntelligence.coverage.missing;
  const needsBeforeAfter = missing.includes("before-after") || idea.includes("before") || idea.includes("after");
  const needsEmotion = missing.includes("emotional-shot") || missing.includes("face-clip") || input.persona.toLowerCase().includes("warm");
  const fast = style.includes("fast") || style.includes("ugc") || input.platform.toLowerCase().includes("tiktok");
  const animation = style.includes("animation") || style.includes("cartoon");
  const language = /ng|pag|hirap|linis|tagalog|filipino/i.test(`${input.userIdea} ${input.audience} ${input.persona}`);

  const lowAssetCount = timeline.tracks.flatMap((track) => track.items).filter((item) => item.source && item.source.kind !== "mock").length <= 2;
  const imageEngine: BuzzlyGenerationEngine = lowAssetCount ? "chatgpt" : style.includes("poster") || style.includes("typography") ? "ideogram" : animation ? "flux" : "gpt-image";
  const videoEngine: BuzzlyGenerationEngine = lowAssetCount ? "gemini-flow" : needsBeforeAfter ? (fast ? "seedance" : "runway") : animation ? "pika" : fast ? "kling" : "veo";
  const voiceEngine: BuzzlyGenerationEngine = needsEmotion || language ? "elevenlabs" : "openai-voice";

  const routes: BuzzlyGenerationRoute[] = [
    {
      modality: "image",
      selectedEngine: imageEngine,
      alternatives: ["chatgpt", "gpt-image", "flux", "ideogram"].filter((engine) => engine !== imageEngine) as BuzzlyGenerationEngine[],
      decisionFactors: animation ? ["animation", "quality"] : style.includes("poster") ? ["quality", "cost"] : ["realism", "quality"],
      reason: imageEngine === "chatgpt"
        ? "Best fit for turning rough product photos into usable scene concepts, product angles, and prompt-ready creative."
        : imageEngine === "ideogram"
        ? "Best for text-forward concepts, offer cards, and branded layouts."
        : imageEngine === "flux"
          ? "Best for stylized or aesthetic generated visuals when realism is not the only goal."
          : "Best default for realistic product images, clean packshots, and editable visual concepts.",
      estimatedCost: imageEngine === "flux" ? "low" : "medium",
      estimatedSpeed: imageEngine === "ideogram" ? "fast" : "standard",
      status: "recommended",
    },
    {
      modality: "video",
      selectedEngine: videoEngine,
      alternatives: ["gemini-flow", "seedance", "veo", "kling", "runway", "pika", "grok-video"].filter((engine) => engine !== videoEngine) as BuzzlyGenerationEngine[],
      decisionFactors: lowAssetCount ? ["quality", "realism"] : needsBeforeAfter ? ["realism", "quality"] : animation ? ["animation", "speed"] : fast ? ["speed", "realism"] : ["quality", "realism"],
      reason: videoEngine === "gemini-flow"
        ? "Best fit when assets are limited because it can plan scene flow and generate missing motion from product references."
        : videoEngine === "seedance"
        ? "Best fit for fast product motion, lifestyle B-roll, and before/after proof from small-business asset sets."
        : videoEngine === "runway"
        ? "Best fit for controlled transformation shots and before/after proof."
        : videoEngine === "pika"
          ? "Best fit for stylized motion and quick animated clips."
          : videoEngine === "kling"
            ? "Best fit for fast UGC-style motion with a practical speed/quality balance."
            : "Best fit when cinematic realism matters more than fast iteration.",
      estimatedCost: videoEngine === "veo" || videoEngine === "runway" ? "high" : "medium",
      estimatedSpeed: videoEngine === "kling" || videoEngine === "pika" || videoEngine === "seedance" ? "fast" : "standard",
      status: "recommended",
    },
    {
      modality: "voice",
      selectedEngine: voiceEngine,
      alternatives: voiceEngine === "elevenlabs" ? ["openai-voice"] : ["elevenlabs"],
      decisionFactors: language ? ["language", "emotion"] : needsEmotion ? ["emotion", "quality"] : ["speed", "cost"],
      reason: voiceEngine === "elevenlabs"
        ? "Best fit for emotional delivery, multilingual reads, and creator-style voiceover."
        : "Best fit for fast, cost-aware narration when heavy emotional acting is not required.",
      estimatedCost: voiceEngine === "elevenlabs" ? "medium" : "low",
      estimatedSpeed: "fast",
      status: "recommended",
    },
  ];

  return {
    ...timeline.hybridGeneration,
    routingGoal: `Auto-select engines for ${input.goal.toLowerCase()} creative on ${input.platform}, optimized for ${fast ? "speed and UGC realism" : "quality and brand fit"}.`,
    providerPool: {
      image: ["chatgpt", "gpt-image", "flux", "ideogram"],
      video: ["gemini-flow", "veo", "seedance", "kling", "runway", "pika", "grok-video"],
      voice: ["elevenlabs", "openai-voice"],
    },
    routes,
  };
}

function buildSmartSceneGeneration(timeline: BuzzlyTimelineJson): BuzzlySmartSceneGeneration {
  const visualAssets = timeline.tracks
    .flatMap((track) => track.items)
    .filter((item) => (item.type === "video" || item.type === "image") && item.source);
  const inputAssetCount = visualAssets.filter((item) => item.source?.kind !== "mock").length || visualAssets.length;
  const missing = timeline.assetIntelligence.coverage.missing.length
    ? timeline.assetIntelligence.coverage.missing
    : inferDesiredCoverage(timeline.creativeBrain.output.visualsNeeded).filter((category) => !timeline.assetIntelligence.coverage.ready.includes(category));
  const requiredGaps = inputAssetCount <= 2
    ? uniqueCategories([...missing, "product-closeup", "emotional-shot", "before-after", "aesthetic-shot", "movement-clip"])
    : missing;
  const existingStatuses = new Map(timeline.smartSceneGeneration?.suggestions.map((scene) => [scene.id, scene.status]));
  const suggestions = uniqueCategories(requiredGaps)
    .filter((category) => category !== "music-bed" && category !== "voiceover")
    .slice(0, 5)
    .map((category) => buildSceneSuggestion(category, timeline, existingStatuses));

  return {
    mode: "auto-generate-missing-scenes",
    principle: "solve-kulang-assets-for-small-businesses",
    summary: suggestions.length
      ? `Buzzly found ${suggestions.length} scene${suggestions.length === 1 ? "" : "s"} it can generate to cover kulang assets.`
      : "Buzzly has enough visual coverage for this creative plan. Smart Scene Generation is ready if new gaps appear.",
    inputAssetCount,
    suggestions,
  };
}

function buildSceneSuggestion(
  category: BuzzlyAssetCategory,
  timeline: BuzzlyTimelineJson,
  existingStatuses: Map<string, BuzzlySmartSceneSuggestion["status"]>,
): BuzzlySmartSceneSuggestion {
  const product = timeline.creativeBrain.input.product || "the product";
  const idea = timeline.creativeBrain.input.userIdea || "the customer pain point";
  const fallback: Record<BuzzlyAssetCategory, BuzzlySmartSceneSuggestion> = {
    "hook-shot": {
      id: "smart-scene-hook-shot",
      title: "Generated hook shot",
      type: "motion-scene",
      fillsGap: "hook-shot",
      prompt: `Generate a thumb-stopping first shot for "${idea}" with fast UGC movement and room for captions.`,
      recommendedEngine: "gemini-flow",
      duration: 3,
      status: "suggested",
    },
    "emotional-shot": {
      id: "smart-scene-lifestyle-emotion",
      title: "Lifestyle emotion shot",
      type: "lifestyle-shot",
      fillsGap: "emotional-shot",
      prompt: `Generate a relatable lifestyle moment showing the frustration before ${product} solves it.`,
      recommendedEngine: "gemini-flow",
      duration: 5,
      status: "suggested",
    },
    "product-closeup": {
      id: "smart-scene-cinematic-closeup",
      title: "Cinematic product closeup",
      type: "cinematic-closeup",
      fillsGap: "product-closeup",
      prompt: `Create a premium closeup of ${product} with clean highlights, subtle motion, and social ad framing.`,
      recommendedEngine: "chatgpt",
      duration: 4,
      status: "suggested",
    },
    "face-clip": {
      id: "smart-scene-face-reaction",
      title: "Creator reaction shot",
      type: "lifestyle-shot",
      fillsGap: "face-clip",
      prompt: `Generate a creator-style reaction shot that feels natural for ${timeline.creativeBrain.input.audience}.`,
      recommendedEngine: "gemini-flow",
      duration: 4,
      status: "suggested",
    },
    "movement-clip": {
      id: "smart-scene-motion",
      title: "Product motion scene",
      type: "motion-scene",
      fillsGap: "movement-clip",
      prompt: `Animate ${product} with clean motion, fast cuts, and a clear product-benefit reveal.`,
      recommendedEngine: "seedance",
      duration: 5,
      status: "suggested",
    },
    "aesthetic-shot": {
      id: "smart-scene-background",
      title: "Background animation",
      type: "background-animation",
      fillsGap: "aesthetic-shot",
      prompt: `Create a branded background animation that supports ${product} without distracting from captions.`,
      recommendedEngine: "flux",
      duration: 5,
      status: "suggested",
    },
    "demo-shot": {
      id: "smart-scene-product-proof",
      title: "Product proof scene",
      type: "ai-broll",
      fillsGap: "demo-shot",
      prompt: `Generate a clear product-in-use proof scene showing exactly how ${product} solves the problem.`,
      recommendedEngine: "seedance",
      duration: 5,
      status: "suggested",
    },
    "before-after": {
      id: "smart-scene-transformation",
      title: "Before/after transformation",
      type: "ai-broll",
      fillsGap: "before-after",
      prompt: `Generate a fast before-and-after transformation clip that makes the payoff from ${product} obvious.`,
      recommendedEngine: "seedance",
      duration: 5,
      status: "suggested",
    },
    packshot: {
      id: "smart-scene-packshot",
      title: "Generated offer packshot",
      type: "cinematic-closeup",
      fillsGap: "packshot",
      prompt: `Generate a clean end-card packshot for ${product} with space for a CTA.`,
      recommendedEngine: "chatgpt",
      duration: 4,
      status: "suggested",
    },
    "music-bed": {
      id: "smart-scene-music",
      title: "Music bed",
      type: "background-animation",
      fillsGap: "music-bed",
      prompt: "Generate a music brief for the edit.",
      recommendedEngine: "chatgpt",
      duration: 0,
      status: "suggested",
    },
    voiceover: {
      id: "smart-scene-voice",
      title: "Voiceover",
      type: "background-animation",
      fillsGap: "voiceover",
      prompt: "Generate a voiceover brief for the edit.",
      recommendedEngine: "chatgpt",
      duration: 0,
      status: "suggested",
    },
  };

  const suggestion = fallback[category];
  return {
    ...suggestion,
    status: existingStatuses.get(suggestion.id) || suggestion.status,
  };
}

function applySmartSceneGeneration(timeline: BuzzlyTimelineJson): { timeline: BuzzlyTimelineJson; summary: string; seekTo?: number } {
  const nextTimeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(timeline));
  const generation = buildSmartSceneGeneration(nextTimeline);
  const scenesToCreate = generation.suggestions.filter((scene) => !nextTimeline.tracks.some((track) => track.items.some((item) => item.id === scene.id)));
  const baseStart = Math.min(4, Math.max(0, nextTimeline.project.duration - 8));

  nextTimeline.tracks = nextTimeline.tracks.map((track) => {
    if (track.id !== "video-main") return track;

    return {
      ...track,
      items: [
        ...track.items,
        ...scenesToCreate.map((scene, index): BuzzlyTimelineItem => ({
          id: scene.id,
          type: "video",
          name: scene.title,
          trackId: "video-main",
          source: {
            kind: "generated",
            filename: `${scene.recommendedEngine}-${scene.id}.mp4`,
            mimeType: "video/mp4",
          },
          startTime: Math.min(Math.max(0, nextTimeline.project.duration - scene.duration), baseStart + index * 4),
          duration: scene.duration,
          trimStart: 0,
          trimEnd: scene.duration,
          volume: 0,
          position: { x: 0.5, y: 0.5 },
          scale: 1,
          opacity: 1,
        })),
      ],
    };
  });

  const covered = uniqueCategories(generation.suggestions.map((scene) => scene.fillsGap));
  nextTimeline.assetIntelligence.coverage.ready = uniqueCategories([...nextTimeline.assetIntelligence.coverage.ready, ...covered]);
  nextTimeline.assetIntelligence.coverage.missing = nextTimeline.assetIntelligence.coverage.missing.filter((category) => !covered.includes(category));
  nextTimeline.smartSceneGeneration = {
    ...generation,
    summary: scenesToCreate.length
      ? `Generated ${scenesToCreate.length} smart scene${scenesToCreate.length === 1 ? "" : "s"} from the missing asset gaps.`
      : "Smart scenes are already on the timeline.",
    suggestions: generation.suggestions.map((scene) => ({ ...scene, status: "in-timeline" })),
  };
  nextTimeline.hybridGeneration = buildHybridGenerationRoutes(nextTimeline);
  nextTimeline.performanceEngine = buildPerformanceEngine(nextTimeline);
  nextTimeline.aiTimelineEngine.lastCommand = {
    prompt: "generate missing smart scenes",
    action: "add-ai-broll",
    summary: nextTimeline.smartSceneGeneration.summary,
  };

  return {
    timeline: nextTimeline,
    summary: nextTimeline.smartSceneGeneration.summary,
    seekTo: scenesToCreate[0] ? Math.min(Math.max(0, nextTimeline.project.duration - scenesToCreate[0].duration), baseStart) : undefined,
  };
}

function buildSmartAssetMapping(timeline: BuzzlyTimelineJson): BuzzlyAssetIntelligence {
  const assets = timeline.tracks.flatMap((track) =>
    track.items
      .filter((item) => item.source)
      .map((item) => {
        const filename = item.source?.filename || "Generated asset";
        const searchable = `${item.name} ${filename} ${timeline.creativeBrain.input.userIdea} ${timeline.creativeBrain.output.visualsNeeded.join(" ")}`.toLowerCase();
        const categories = inferAssetCategories(item, searchable);

        return {
          assetId: item.id,
          assetName: item.name,
          filename,
          sourceKind: item.source?.kind || "mock",
          mediaType: item.type,
          categories,
          confidence: inferConfidence(categories, item.type),
          detectedMoments: inferDetectedMoments(categories),
          bestUse: inferBestUse(categories, item.name),
          strategyFit: inferStrategyFit(categories),
        };
      }),
  );

  const ready = uniqueCategories(assets.flatMap((asset) => asset.categories));
  const desired = inferDesiredCoverage(timeline.creativeBrain.output.visualsNeeded);
  const missing = desired.filter((category) => !ready.includes(category));

  return {
    mode: "smart-asset-mapping",
    lastScanStatus: "scanned",
    summary: missing.length
      ? `Buzzly mapped ${assets.length} assets. Ready categories are ${ready.length}; missing coverage: ${missing.map((category) => assetCategoryLabel(category)).join(", ")}.`
      : `Buzzly mapped ${assets.length} assets and found coverage for the current creative direction.`,
    coverage: { ready, missing },
    mappings: assets,
  };
}

function inferAssetCategories(item: BuzzlyTimelineItem, searchable: string): BuzzlyAssetCategory[] {
  const categories: BuzzlyAssetCategory[] = [];

  if (item.type === "audio") {
    categories.push(searchable.includes("voice") ? "voiceover" : "music-bed");
    return categories;
  }

  if (searchable.includes("hook")) categories.push("hook-shot");
  if (searchable.includes("demo") || searchable.includes("use")) categories.push("demo-shot");
  if (searchable.includes("product") || searchable.includes("packshot") || searchable.includes("close")) categories.push("product-closeup");
  if (searchable.includes("packshot")) categories.push("packshot");
  if (searchable.includes("face") || searchable.includes("reaction") || searchable.includes("parent")) categories.push("face-clip", "emotional-shot");
  if (searchable.includes("before") || searchable.includes("after") || searchable.includes("proof")) categories.push("before-after");
  if (item.type === "video") categories.push("movement-clip");
  if (item.type === "image") categories.push("aesthetic-shot");

  return uniqueCategories(categories.length ? categories : item.type === "image" ? ["aesthetic-shot"] : ["movement-clip"]);
}

function inferDesiredCoverage(visualsNeeded: string[]): BuzzlyAssetCategory[] {
  const text = visualsNeeded.join(" ").toLowerCase();
  const desired: BuzzlyAssetCategory[] = ["hook-shot", "demo-shot", "product-closeup"];

  if (text.includes("reaction") || text.includes("parent") || text.includes("face")) desired.push("face-clip", "emotional-shot");
  if (text.includes("before") || text.includes("after") || text.includes("proof")) desired.push("before-after");
  if (text.includes("packshot") || text.includes("end card")) desired.push("packshot");

  return uniqueCategories(desired);
}

function inferDetectedMoments(categories: BuzzlyAssetCategory[]) {
  const moments: Partial<Record<BuzzlyAssetCategory, string>> = {
    "hook-shot": "strong opening frame",
    "emotional-shot": "human feeling cue",
    "product-closeup": "product detail visible",
    "face-clip": "face or reaction opportunity",
    "movement-clip": "usable motion",
    "aesthetic-shot": "clean composition",
    "demo-shot": "product action",
    "before-after": "proof structure",
    "music-bed": "rhythm bed",
    voiceover: "narration layer",
    packshot: "end-card asset",
  };

  return categories.map((category) => moments[category] || category);
}

function inferBestUse(categories: BuzzlyAssetCategory[], fallbackName: string) {
  if (categories.includes("hook-shot")) return "Use at the opening to stop the scroll.";
  if (categories.includes("demo-shot")) return "Use in the proof section after the hook.";
  if (categories.includes("before-after")) return "Use as transformation proof before the CTA.";
  if (categories.includes("emotional-shot")) return "Use to make the pain point feel human.";
  if (categories.includes("packshot")) return "Use in the final CTA or offer card.";
  if (categories.includes("voiceover")) return "Use as the narrative spine.";
  if (categories.includes("music-bed")) return "Use under the edit for pace and energy.";
  return `Use ${fallbackName} as supporting visual texture.`;
}

function inferStrategyFit(categories: BuzzlyAssetCategory[]): "high" | "medium" | "low" {
  if (categories.some((category) => ["hook-shot", "demo-shot", "product-closeup", "before-after"].includes(category))) return "high";
  if (categories.some((category) => ["emotional-shot", "face-clip", "packshot", "voiceover"].includes(category))) return "medium";
  return "low";
}

function inferConfidence(categories: BuzzlyAssetCategory[], type: BuzzlyTimelineItem["type"]) {
  const base = type === "audio" ? 0.86 : 0.74;
  return Math.min(0.96, Number((base + categories.length * 0.04).toFixed(2)));
}

function uniqueCategories(categories: BuzzlyAssetCategory[]) {
  return Array.from(new Set(categories));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function assetCategoryLabel(category: BuzzlyAssetCategory) {
  return category.replace("-", " ");
}

function shouldUseUploadedProjectName(projectName: string) {
  const normalized = projectName.toLowerCase();
  return normalized.includes("demo") || normalized.includes("untitled");
}

function buildCreativeDirection(input: BuzzlyCreativeBrainInput): BuzzlyCreativeBrainOutput {
  const goal = input.goal || "Conversion";
  const style = input.style || "Fast TikTok UGC";
  const audience = input.audience || "busy buyers";
  const product = input.product || "the product";
  const idea = input.userIdea || "a relatable pain point";
  const platform = input.platform || "TikTok/Reels";

  return {
    contentStrategy: `For ${platform}, sell ${product} to ${audience} by opening with "${idea}", then prove the payoff with fast, specific UGC-style evidence. The creative goal is ${goal.toLowerCase()}, so every scene should make the next action feel obvious.`,
    flow: [
      `Pain point: ${idea}`,
      `Persona beat: ${input.persona || "relatable creator"} says the problem out loud`,
      `Product proof: show ${product} solving one concrete moment`,
      "Transformation: before/after or side-by-side result",
      `CTA: ask ${audience} to try the simple next step`,
    ],
    hookDirection: `Open on the most frustrating visual of "${idea}" and say it like a real person, not an ad.`,
    pacing: style.toLowerCase().includes("fast")
      ? "Fast UGC pacing: first cut before 2 seconds, new visual every 1.5-2.5 seconds, captions locked to spoken beats."
      : "Clear story pacing: first hook inside 3 seconds, proof by the midpoint, CTA in the final 4 seconds.",
    visualsNeeded: [
      "Raw pain-point scene",
      "Creator reaction close-up",
      "Product-in-use proof",
      "Result or transformation shot",
      "Packshot or offer end card",
    ],
    missingAssets: [
      `A real ${audience} reaction clip`,
      `${product} close-up while solving the pain point`,
      "Before/after proof shot",
    ],
  };
}
