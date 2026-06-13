import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { invalidateAssetsCache, queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Mic, Save, Loader2, Image, Film, RefreshCw, AlertTriangle, CheckCircle2, Brain, AudioLines, Music, Captions, Sparkles, Clapperboard, Trash2, Scissors, Eye, Play, Square } from "lucide-react";
import VideoTrimmer from "./video-trimmer";
import { FREE_MUSIC_LIBRARY } from "./studio/free-music-library";
import type { Asset, ScriptPrompt } from "@shared/schema";
import type { BuzzlyTimelineItem, BuzzlyTimelineJson } from "@shared/models/timeline";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  preview_url?: string;
}

interface ElevenLabsModel {
  model_id: string;
  name: string;
  description: string;
}

interface PendingShot {
  id: string;
  r2Key: string;
  category: string;
  shotType: string | null;
  durationSec: number;
  filename: string;
}

interface SavedShot extends Omit<PendingShot, "id"> {
  id: number;
  assetId: number;
  orientation: string;
}

type AssetMediaUrls = {
  photoUrl: string | null;
  videoUrl: string | null;
  musicUrl: string | null;
};

type MusicLibraryTrack = {
  id: number;
  name: string;
  musicKey: string;
  musicUrl: string | null;
};

type VideoAnalysisStatus = {
  status: "ready" | "missing";
  canAnalyze: boolean;
  analysisVersion: string;
  modelUsed: string;
  availableModels?: Array<{ id: string; name: string }>;
  analysis: {
    id: number;
    videoHash: string;
    analysisJson: Record<string, unknown>;
    modelUsed: string;
    analysisVersion: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

const MAX_FILE_SIZE_MB = 150;

const OPENAI_MODELS = [
  { id: "gpt-4.1", name: "GPT-4.1 (recommended)" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini (faster, cheaper)" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano (fastest)" },
];

const CATEGORIES = ["HOOK", "PROBLEM", "SOLUTION", "HIGHLIGHT", "BODY", "CTA"] as const;
const SHOT_TYPES = ["demo", "aesthetic", "feature", "top", "side", "pov", "closeup", "before_after"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  HOOK: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  PROBLEM: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  SOLUTION: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  HIGHLIGHT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  BODY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  CTA: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

function summarizeAnalysisField(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, 4)
      .map((item) => summarizeAnalysisField(item))
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const timing = [record.start_sec, record.end_sec].every((part) => typeof part === "number")
      ? `${record.start_sec}-${record.end_sec}s: `
      : typeof record.at_sec === "number"
        ? `${record.at_sec}s: `
        : "";
    const text = record.summary || record.description || record.action || record.beat || record.hook || record.label || record.type || record.category || record.note;
    if (text) return `${timing}${summarizeAnalysisField(text)}`;
    return JSON.stringify(record).slice(0, 180);
  }
  return "";
}

async function uploadFileWithProgress(
  file: File,
  type: "photo" | "video" | "music",
  assetId: string,
  onProgress: (percent: number) => void
): Promise<{ key: string; assetId: string }> {
  const defaultMime = type === "photo" ? "image/jpeg" : type === "music" ? "audio/mpeg" : "video/mp4";
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      assetId,
      filename: file.name,
      contentType: file.type || defaultMime,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to get upload URL (${res.status})`);
  }

  const { url, key } = await res.json();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || defaultMime);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ key, assetId });
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error - please check your connection and try again."));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timed out. Please try again with a stable connection."));
    });

    xhr.timeout = 10 * 60 * 1000;
    xhr.send(file);
  });
}

const studioClipKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

const readVideoFileDuration = (file: File): Promise<number> => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  video.onloadedmetadata = () => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6;
    URL.revokeObjectURL(url);
    resolve(Math.round(duration * 10) / 10);
  };
  video.onerror = () => {
    URL.revokeObjectURL(url);
    resolve(6);
  };
});

async function uploadStudioShot(file: File, assetId: number, index: number, category = "BODY"): Promise<PendingShot> {
  const durationSec = await readVideoFileDuration(file);
  const res = await fetch("/api/upload-shot-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetId,
      filename: file.name,
      contentType: file.type || "video/mp4",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to get shot upload URL (${res.status})`);
  }

  const { url, key } = await res.json();
  const uploadRes = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "video/mp4" },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Shot upload failed (${uploadRes.status})`);
  }

  return {
    id: crypto.randomUUID(),
    r2Key: key,
    category,
    shotType: SHOT_TYPES[index % SHOT_TYPES.length],
    durationSec,
    filename: file.name,
  };
}

type UploadStep = "idle" | "uploading-photo" | "uploading-video" | "uploading-music" | "converting-music" | "saving" | "analyzing-video" | "done";

interface SetupFormProps {
  onComplete: () => void;
  editingAsset?: Asset | null;
  onCancelEdit?: () => void;
  initialName?: string;
  initialPersonaPrompt?: string;
  initialVideoSource?: "edited" | "builder";
  studioVideoFiles?: File[];
  studioTimelineJson?: BuzzlyTimelineJson | null;
  onOpenVideoBuilder?: () => void;
  onOpenExistingStudio?: (asset: Asset) => void;
}

export function SetupForm({ onComplete, editingAsset, onCancelEdit, initialName, initialPersonaPrompt, initialVideoSource, studioVideoFiles = [], studioTimelineJson = null, onOpenVideoBuilder, onOpenExistingStudio }: SetupFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [videoSource, setVideoSource] = useState<"builder">("builder");
  const [personaPrompt, setPersonaPrompt] = useState("");
  const [scriptPromptId, setScriptPromptId] = useState<number | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [openaiModel, setOpenaiModel] = useState("gpt-4.1");
  const [elevenlabsModel, setElevenlabsModel] = useState("eleven_turbo_v2_5");
  const [useEnhance, setUseEnhance] = useState(true);
  const [thresholdDb, setThresholdDb] = useState(-35);
  const [removeSilencesLongerThan, setRemoveSilencesLongerThan] = useState(0.2);
  const [ignoreDetectionsShorterThan, setIgnoreDetectionsShorterThan] = useState(0.75);
  const [music, setMusic] = useState<File | null>(null);
  const [selectedMusicKey, setSelectedMusicKey] = useState("");
  const [previewingMusicKey, setPreviewingMusicKey] = useState<string | null>(null);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [autoCaptions, setAutoCaptions] = useState(false);
  const [hookHeadline, setHookHeadline] = useState(false);
  const [hookPrompt, setHookPrompt] = useState("");
  const [hookModel, setHookModel] = useState("gpt-4.1");
  const [captionEnabled, setCaptionEnabled] = useState(false);
  const [captionPrompt, setCaptionPrompt] = useState("");
  const [captionModel, setCaptionModel] = useState("gpt-4.1");
  const [seoEnabled, setSeoEnabled] = useState(false);
  const [seoPrompt, setSeoPrompt] = useState("");
  const [seoModel, setSeoModel] = useState("gpt-4.1");
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const [tempAssetId] = useState(() => crypto.randomUUID());
  const [pendingShots, setPendingShots] = useState<PendingShot[]>([]);
  const [shuffleStudioClips, setShuffleStudioClips] = useState(false);
  const [selectedShuffleClipKeys, setSelectedShuffleClipKeys] = useState<string[]>([]);
  const [shotCategory, setShotCategory] = useState<string>("BODY");
  const [shotType, setShotType] = useState<string>("");
  const [shotUploading, setShotUploading] = useState(false);
  const [shotUploadProgress, setShotUploadProgress] = useState(0);

  const [replacePhotoUploading, setReplacePhotoUploading] = useState(false);
  const [replacePhotoProgress, setReplacePhotoProgress] = useState(0);
  const [replaceVideoUploading, setReplaceVideoUploading] = useState(false);
  const [replaceVideoProgress, setReplaceVideoProgress] = useState(0);
  const [replaceMusicUploading, setReplaceMusicUploading] = useState(false);
  const [replaceMusicProgress, setReplaceMusicProgress] = useState(0);
  const [showVideoAnalysis, setShowVideoAnalysis] = useState(false);
  const [reanalyzingVideo, setReanalyzingVideo] = useState(false);
  const voicePreviewRef = useRef<HTMLAudioElement | null>(null);
  const musicPreviewRef = useRef<HTMLAudioElement | null>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);
  const replaceVideoInputRef = useRef<HTMLInputElement>(null);
  const replaceMusicInputRef = useRef<HTMLInputElement>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceR2Key, setSourceR2Key] = useState<string | null>(null);
  const [sourceUploading, setSourceUploading] = useState(false);
  const [sourceUploadProgress, setSourceUploadProgress] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(6);
  const [trimming, setTrimming] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingAsset;
  const isUploading = uploadStep !== "idle" && uploadStep !== "done";

  useEffect(() => {
    const availableKeys = studioVideoFiles.map(studioClipKey);
    setSelectedShuffleClipKeys((current) => {
      const kept = current.filter((key) => availableKeys.includes(key));
      const missing = availableKeys.filter((key) => !kept.includes(key));
      return [...kept, ...missing];
    });
  }, [studioVideoFiles]);

  useEffect(() => {
    if (!sourceFile) {
      setVideoDuration(0);
      setSourceVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(sourceFile);
    setSourceVideoUrl(url);

    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.src = url;
    vid.onloadedmetadata = () => {
      const dur = Math.round(vid.duration * 10) / 10;
      setVideoDuration(dur);
      setTrimEnd(Math.min(6, dur));
    };
    return () => {
      URL.revokeObjectURL(url);
      setSourceVideoUrl(null);
    };
  }, [sourceFile]);

  useEffect(() => {
    if (editingAsset) {
      setName(editingAsset.name);
      setVideoSource("builder");
      setPersonaPrompt(editingAsset.personaPrompt);
      setScriptPromptId(editingAsset.scriptPromptId || null);
      setVoiceId(editingAsset.voiceId || "");
      setVoiceName(editingAsset.voiceName || "");
      setOpenaiModel(editingAsset.openaiModel || "gpt-4.1");
      setElevenlabsModel(editingAsset.elevenlabsModel || "eleven_turbo_v2_5");
      setUseEnhance(editingAsset.useEnhance !== undefined ? editingAsset.useEnhance : true);
      setThresholdDb(editingAsset.thresholdDb);
      setRemoveSilencesLongerThan(editingAsset.removeSilencesLongerThan);
      setIgnoreDetectionsShorterThan(editingAsset.ignoreDetectionsShorterThan);
      setVoiceVolume(editingAsset.voiceVolume ?? 1.0);
      setMusicVolume(editingAsset.musicVolume ?? 0.3);
      setSelectedMusicKey(editingAsset.musicKey || "");
      setAutoCaptions(editingAsset.autoCaptions ?? false);
      setHookHeadline(editingAsset.hookHeadline ?? false);
      setHookPrompt(editingAsset.hookPrompt || "");
      setHookModel(editingAsset.hookModel || "gpt-4.1");
      setCaptionEnabled(editingAsset.captionEnabled ?? false);
      setCaptionPrompt(editingAsset.captionPrompt || "");
      setCaptionModel(editingAsset.captionModel || "gpt-4.1");
      setSeoEnabled(editingAsset.seoEnabled ?? false);
      setSeoPrompt(editingAsset.seoPrompt || "");
      setSeoModel(editingAsset.seoModel || "gpt-4.1");
      setPhoto(null);
      setVideo(null);
      setMusic(null);
    }
  }, [editingAsset]);

  useEffect(() => {
    if (editingAsset) return;
    if (initialName && !name) setName(initialName);
    if (initialPersonaPrompt && !personaPrompt) setPersonaPrompt(initialPersonaPrompt);
    setVideoSource("builder");
  }, [editingAsset, initialName, initialPersonaPrompt, initialVideoSource, name, personaPrompt]);

  const voicesQuery = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const elModelsQuery = useQuery<ElevenLabsModel[]>({
    queryKey: ["/api/elevenlabs/models"],
  });

  const [libraryPickerKey, setLibraryPickerKey] = useState(0);
  const [videoAnalysisModel, setVideoAnalysisModel] = useState("gpt-4o");
  const scriptPromptsQuery = useQuery<ScriptPrompt[]>({
    queryKey: ["/api/script-prompts"],
  });
  const mediaUrlsQuery = useQuery<Record<number, AssetMediaUrls>>({
    queryKey: ["/api/assets/media-urls"],
  });
  const videoAnalysisQuery = useQuery<VideoAnalysisStatus>({
    queryKey: [`/api/assets/${editingAsset?.id}/video-analysis`],
    enabled: !!editingAsset,
  });
  const assetsQuery = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });
  const musicLibraryQuery = useQuery<MusicLibraryTrack[]>({
    queryKey: ["/api/music-library"],
  });
  const currentMedia = editingAsset ? mediaUrlsQuery.data?.[editingAsset.id] : undefined;
  const videoAnalysis = videoAnalysisQuery.data?.analysis;
  const videoAnalysisJson = videoAnalysis?.analysisJson || null;
  const videoAnalysisHighlights = videoAnalysisJson
    ? [
        ["Summary", videoAnalysisJson.overall_summary],
        ["Product / subject", videoAnalysisJson.product_or_main_subject],
        ["Best hook moments", videoAnalysisJson.suggested_hooks],
        ["VO beats", videoAnalysisJson.voiceover_beats || videoAnalysisJson.script_timing_guidance],
        ["Weak spots", videoAnalysisJson.weak_or_dead_spots],
        ["Shot categories", videoAnalysisJson.shot_categories],
      ]
        .map(([label, value]) => ({ label: String(label), value: summarizeAnalysisField(value) }))
        .filter((item) => item.value)
    : [];
  const videoAnalysisModels = videoAnalysisQuery.data?.availableModels?.length
    ? videoAnalysisQuery.data.availableModels
    : OPENAI_MODELS;
  const normalizedVoiceSearch = voiceSearch.trim().toLowerCase();
  const filteredVoices = (voicesQuery.data || []).filter((voice) =>
    !normalizedVoiceSearch || voice.name.toLowerCase().includes(normalizedVoiceSearch)
  );
  const selectedVoice = voicesQuery.data?.find((voice) => voice.voice_id === voiceId);
  const uploadedMusicOptions = Array.from(new Map([
    ...(assetsQuery.data || [])
      .filter((asset) => asset.musicKey && asset.personaPrompt !== "__ADMIN_MUSIC_LIBRARY__")
      .map((asset) => [asset.musicKey!, { key: asset.musicKey!, label: asset.name, url: mediaUrlsQuery.data?.[asset.id]?.musicUrl || null }] as const),
    ...(musicLibraryQuery.data || [])
      .map((track) => [track.musicKey, { key: track.musicKey, label: track.name, url: track.musicUrl }] as const),
  ]).values());
  const selectedFreeMusicTrack = FREE_MUSIC_LIBRARY.find((track) => `public:${track.uri}` === selectedMusicKey);
  const selectedUploadedMusicOption = uploadedMusicOptions.find((option) => option.key === selectedMusicKey);
  const selectedMusicPreviewUrl = selectedFreeMusicTrack?.uri || selectedUploadedMusicOption?.url || "";

  useEffect(() => {
    if (videoAnalysisQuery.data?.modelUsed) {
      setVideoAnalysisModel(videoAnalysisQuery.data.modelUsed);
    }
  }, [videoAnalysisQuery.data?.modelUsed]);

  useEffect(() => {
    return () => {
      voicePreviewRef.current?.pause();
      voicePreviewRef.current = null;
      musicPreviewRef.current?.pause();
      musicPreviewRef.current = null;
    };
  }, []);

  const handleUploadSource = async (file: File) => {
    setSourceUploading(true);
    setSourceUploadProgress(0);
    try {
      const defaultMime = "video/mp4";
      const presignRes = await fetch("/api/upload-source-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: tempAssetId,
          filename: file.name,
          contentType: file.type || defaultMime,
        }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get upload URL");
      }
      const { url, key } = await presignRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type || defaultMime);
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setSourceUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.timeout = 10 * 60 * 1000;
        xhr.send(file);
      });

      setSourceR2Key(key);
      toast({ title: "Source video uploaded", description: "You can now trim shots from this video." });
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setSourceUploading(false);
      setSourceUploadProgress(0);
    }
  };

  const handleTrimShot = async () => {
    if (!sourceR2Key || sourceUploading) return;
    if (trimEnd <= trimStart) {
      toast({ title: "Invalid trim", description: "End time must be after start time.", variant: "destructive" });
      return;
    }
    if (videoDuration > 0 && trimEnd > videoDuration + 0.5) {
      toast({ title: "Invalid trim", description: `End time (${trimEnd}s) exceeds video duration (${videoDuration}s).`, variant: "destructive" });
      return;
    }

    setTrimming(true);
    setShotUploadProgress(0);
    try {
      const res = await fetch("/api/trim-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceR2Key,
          startSec: trimStart,
          endSec: trimEnd,
          assetId: tempAssetId,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to trim video");
      }
      const { key, durationSec } = await res.json();

      const newShot: PendingShot = {
        id: crypto.randomUUID(),
        r2Key: key,
        category: shotCategory,
        shotType: shotType && shotType !== "none" ? shotType : null,
        durationSec,
        filename: `trim_${formatTime(trimStart)}-${formatTime(trimEnd)}`,
      };

      setPendingShots((prev) => [...prev, newShot]);
      toast({ title: "Shot trimmed", description: `${newShot.filename} (${durationSec}s) added as ${shotCategory}.` });
    } catch (err: any) {
      toast({ title: "Trim error", description: err.message, variant: "destructive" });
    } finally {
      setTrimming(false);
    }
  };

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}:${s.padStart(4, "0")}`;
  };

  const handleDeletePendingShot = (shotId: string) => {
    setPendingShots((prev) => prev.filter((s) => s.id !== shotId));
  };

  const getTimelineItemFilename = (item: BuzzlyTimelineItem) => {
    const sourceName = item.source?.filename?.trim();
    if (sourceName) return sourceName;
    return item.name.trim();
  };

  const buildPersistedTimeline = (savedShots: SavedShot[]): BuzzlyTimelineJson | null => {
    if (!studioTimelineJson) return null;

    const timeline: BuzzlyTimelineJson = JSON.parse(JSON.stringify(studioTimelineJson));
    const shotsByFilename = new Map<string, SavedShot[]>();
    const shotsByR2Key = new Map(savedShots.map((shot) => [shot.r2Key, shot]));

    for (const shot of savedShots) {
      const key = shot.filename || "";
      const queue = shotsByFilename.get(key) || [];
      queue.push(shot);
      shotsByFilename.set(key, queue);
    }

    timeline.tracks = timeline.tracks.map((track) => ({
      ...track,
      items: track.items.map((item) => {
        if (item.type !== "video") return item;

        const existingShot = item.source?.r2Key ? shotsByR2Key.get(item.source.r2Key) : null;
        const filename = getTimelineItemFilename(item);
        const queue = shotsByFilename.get(filename);
        const matchedShot = existingShot || queue?.[0];

        if (!matchedShot) return item;

        return {
          ...item,
          source: {
            ...item.source,
            kind: "remote",
            uri: `/api/shots/${matchedShot.id}/media`,
            r2Key: matchedShot.r2Key,
            filename: matchedShot.filename || item.source?.filename || item.name,
            mimeType: item.source?.mimeType || "video/mp4",
          },
        };
      }),
    }));

    return timeline;
  };

  const saveSetupShots = async (assetId: number): Promise<SavedShot[]> => {
    const studioShots = studioVideoFiles.length > 0
      ? await Promise.all(studioVideoFiles.map((file, index) => {
        const category = shuffleStudioClips
          ? selectedShuffleClipKeys.includes(studioClipKey(file)) ? `SHUFFLE_${index}` : `FIXED_${index}`
          : `FIXED_${index}`;
        return uploadStudioShot(file, assetId, index, category);
      }))
      : [];
    const shotsToSave = [...pendingShots, ...studioShots];
    const savedShots: SavedShot[] = [];

    for (const shot of shotsToSave) {
      const shotRes = await fetch(`/api/assets/${assetId}/shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: shot.category,
          shotType: shot.shotType,
          durationSec: shot.durationSec,
          r2Key: shot.r2Key,
          orientation: "portrait",
          filename: shot.filename,
        }),
      });
      if (!shotRes.ok) {
        const errData = await shotRes.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to save shot (${shotRes.status})`);
      }
      savedShots.push(await shotRes.json());
    }

    return savedShots;
  };

  const handleSave = async (options: { analyzeVideo?: boolean } = {}) => {
    if (isEditing) {
      try {
        setUploadStep("saving");
        const res = await fetch(`/api/assets/${editingAsset!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, videoSource: "builder", personaPrompt, scriptPromptId, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance,
            thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan,
            musicKey: selectedMusicKey || null, voiceVolume, musicVolume, autoCaptions, hookHeadline, hookPrompt: hookPrompt || null, hookModel,
            captionEnabled, captionPrompt: captionPrompt || null, captionModel,
            seoEnabled, seoPrompt: seoPrompt || null, seoModel,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server error (${res.status})`);
        }
        const savedShots = await saveSetupShots(editingAsset!.id);
        const persistedTimeline = buildPersistedTimeline(savedShots);
        if (persistedTimeline) {
          const timelineRes = await fetch(`/api/assets/${editingAsset!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timelineJson: persistedTimeline }),
          });
          if (!timelineRes.ok) {
            const errData = await timelineRes.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to save Studio timeline (${timelineRes.status})`);
          }
        }
        invalidateAssetsCache();
        toast({
          title: "Setup updated",
          description: savedShots.length > 0
            ? `${savedShots.length} shot${savedShots.length === 1 ? "" : "s"} saved for activation.`
            : "Your setup has been updated successfully.",
        });
        onCancelEdit?.();
        onComplete();
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setUploadStep("idle");
      }
      return;
    }

    if (!photo) return;
    if (pendingShots.length === 0 && studioVideoFiles.length === 0) return;

    const photoSizeMB = photo.size / 1024 / 1024;
    if (photoSizeMB > MAX_FILE_SIZE_MB) {
      toast({ title: "Error", description: `Photo is too large (${photoSizeMB.toFixed(0)} MB). Max is ${MAX_FILE_SIZE_MB} MB.`, variant: "destructive" });
      return;
    }
    if (video) {
      const videoSizeMB = video.size / 1024 / 1024;
      if (videoSizeMB > MAX_FILE_SIZE_MB) {
        toast({ title: "Error", description: `Video is too large (${videoSizeMB.toFixed(0)} MB). Max is ${MAX_FILE_SIZE_MB} MB.`, variant: "destructive" });
        return;
      }
    }

    try {
      setUploadStep("uploading-photo");
      setUploadProgress(0);
      const photoResult = await uploadFileWithProgress(photo, "photo", tempAssetId, setUploadProgress);

      let musicKeyValue: string | null = selectedMusicKey || null;
      if (music) {
        setUploadStep("uploading-music");
        setUploadProgress(0);
        const musicResult = await uploadFileWithProgress(music, "music", tempAssetId, setUploadProgress);
        musicKeyValue = musicResult.key;

        if (music.type.startsWith("video/")) {
          setUploadStep("converting-music");
          setUploadProgress(0);
          const convertRes = await fetch("/api/convert-music", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ r2Key: musicKeyValue }),
          });
          if (!convertRes.ok) {
            const errData = await convertRes.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to extract audio from video");
          }
          const { audioKey } = await convertRes.json();
          musicKeyValue = audioKey;
        }
      }

      setUploadStep("saving");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, photoKey: photoResult.key, videoKey: "",
          scriptPromptId,
          videoSource: "builder", personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance,
          thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan,
          musicKey: musicKeyValue, voiceVolume, musicVolume,
          autoCaptions, hookHeadline, hookPrompt: hookPrompt || null, hookModel,
          captionEnabled, captionPrompt: captionPrompt || null, captionModel,
          seoEnabled, seoPrompt: seoPrompt || null, seoModel,
        }),
      });

      if (!res.ok) {
        let errorMessage = `Server error (${res.status})`;
        try { const errData = await res.json(); errorMessage = errData.error || errorMessage; } catch {}
        throw new Error(errorMessage);
      }

      const createdAsset = await res.json();
      const savedShots = await saveSetupShots(createdAsset.id);
      const persistedTimeline = buildPersistedTimeline(savedShots);
      if (persistedTimeline) {
        const timelineRes = await fetch(`/api/assets/${createdAsset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timelineJson: persistedTimeline }),
        });
        if (!timelineRes.ok) {
          const errData = await timelineRes.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to save Studio timeline (${timelineRes.status})`);
        }
      }

      if (options.analyzeVideo) {
        setUploadStep("analyzing-video");
        const analysisRes = await fetch(`/api/assets/${createdAsset.id}/video-analysis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true, model: videoAnalysisModel }),
        });
        if (!analysisRes.ok) {
          const errData = await analysisRes.json().catch(() => ({}));
          throw new Error(errData.error || `Video analysis failed (${analysisRes.status})`);
        }
      }

      setUploadStep("done");
      invalidateAssetsCache();
      toast({
        title: options.analyzeVideo ? "Setup saved + video analyzed" : "Setup saved",
        description: options.analyzeVideo
          ? "Buzzly saved fresh visual intelligence for this setup."
          : "Your setup has been saved successfully.",
      });
      setName("");
      setPersonaPrompt("");
      setScriptPromptId(null);
      setPhoto(null);
      setVideo(null);
      setMusic(null);
      setSelectedMusicKey("");
      setVoiceId("");
      setVoiceName("");
      setOpenaiModel("gpt-4.1");
      setElevenlabsModel("eleven_turbo_v2_5");
      setUseEnhance(true);
      setVoiceVolume(1.0);
      setMusicVolume(0.3);
      setAutoCaptions(false);
      setHookHeadline(false);
      setHookPrompt("");
      setPendingShots([]);
      setShuffleStudioClips(false);
      setSelectedShuffleClipKeys([]);
      setSourceFile(null);
      setSourceR2Key(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (musicInputRef.current) musicInputRef.current.value = "";
      if (sourceInputRef.current) sourceInputRef.current.value = "";
      onComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save setup", variant: "destructive" });
    } finally {
      setUploadStep("idle");
      setUploadProgress(0);
    }
  };

  const handleVoiceSelect = (id: string) => {
    setVoiceId(id);
    const voice = voicesQuery.data?.find((v) => v.voice_id === id);
    setVoiceName(voice?.name || "");
  };

  const stopVoicePreview = () => {
    voicePreviewRef.current?.pause();
    voicePreviewRef.current = null;
    setPreviewingVoiceId(null);
  };

  const handlePreviewVoice = async (voice: Voice) => {
    if (previewingVoiceId === voice.voice_id) {
      stopVoicePreview();
      return;
    }

    stopVoicePreview();
    if (!voice.preview_url) {
      toast({ title: "Preview not available", description: "ElevenLabs did not provide a sample URL for this voice." });
      return;
    }

    try {
      const audio = new Audio(voice.preview_url);
      voicePreviewRef.current = audio;
      setPreviewingVoiceId(voice.voice_id);
      audio.onended = () => setPreviewingVoiceId(null);
      audio.onerror = () => {
        setPreviewingVoiceId(null);
        toast({ title: "Preview failed", description: "The ElevenLabs sample could not be played.", variant: "destructive" });
      };
      await audio.play();
    } catch (err: any) {
      setPreviewingVoiceId(null);
      toast({ title: "Preview failed", description: err.message || "The ElevenLabs sample could not be played.", variant: "destructive" });
    }
  };

  const stopMusicPreview = () => {
    musicPreviewRef.current?.pause();
    musicPreviewRef.current = null;
    setPreviewingMusicKey(null);
  };

  const handlePreviewMusic = async () => {
    if (!selectedMusicKey || selectedMusicKey === "none") return;
    if (previewingMusicKey === selectedMusicKey) {
      stopMusicPreview();
      return;
    }

    stopMusicPreview();
    if (!selectedMusicPreviewUrl) {
      toast({ title: "Preview not available", description: "This music track does not have a preview URL yet." });
      return;
    }

    try {
      const audio = new Audio(selectedMusicPreviewUrl);
      audio.volume = 0.75;
      musicPreviewRef.current = audio;
      setPreviewingMusicKey(selectedMusicKey);
      audio.onended = () => setPreviewingMusicKey(null);
      audio.onerror = () => {
        setPreviewingMusicKey(null);
        toast({ title: "Music preview failed", description: "This track could not be played.", variant: "destructive" });
      };
      await audio.play();
    } catch (err: any) {
      setPreviewingMusicKey(null);
      toast({ title: "Music preview failed", description: err.message || "This track could not be played.", variant: "destructive" });
    }
  };

  const handleReplaceFile = async (file: File, type: "photo" | "video" | "music") => {
    if (!editingAsset) return;
    const setUploading = type === "photo" ? setReplacePhotoUploading : type === "video" ? setReplaceVideoUploading : setReplaceMusicUploading;
    const setProgress = type === "photo" ? setReplacePhotoProgress : type === "video" ? setReplaceVideoProgress : setReplaceMusicProgress;

    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadFileWithProgress(file, type, String(editingAsset.id), setProgress);
      let finalKey = result.key;

      if (type === "music" && file.type.startsWith("video/")) {
        const convertRes = await fetch("/api/convert-music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ r2Key: finalKey }),
        });
        if (!convertRes.ok) throw new Error("Failed to convert video to audio");
        const { audioKey } = await convertRes.json();
        finalKey = audioKey;
      }

      const patchBody: Record<string, string> = type === "photo"
        ? { photoKey: result.key }
        : type === "video"
        ? { videoKey: result.key }
        : { musicKey: finalKey };
      const res = await fetch(`/api/assets/${editingAsset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to update ${type}`);
      }
      invalidateAssetsCache();
      const label = type === "photo" ? "Photo" : type === "video" ? "Video" : "Music";
      toast({ title: `${label} replaced`, description: `Your ${type} has been replaced successfully.` });
    } catch (err: any) {
      toast({ title: "Replace error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
      if (type === "photo" && replacePhotoInputRef.current) replacePhotoInputRef.current.value = "";
      if (type === "video" && replaceVideoInputRef.current) replaceVideoInputRef.current.value = "";
      if (type === "music" && replaceMusicInputRef.current) replaceMusicInputRef.current.value = "";
    }
  };

  const handleReanalyzeVideo = async () => {
    if (!editingAsset || reanalyzingVideo) return;
    setReanalyzingVideo(true);
    try {
      const res = await fetch(`/api/assets/${editingAsset.id}/video-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, model: videoAnalysisModel }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Video analysis failed (${res.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: [`/api/assets/${editingAsset.id}/video-analysis`] });
      setShowVideoAnalysis(true);
      toast({ title: "Video analysis ready", description: "Buzzly saved fresh visual intelligence for this setup." });
    } catch (err: any) {
      toast({ title: "Analysis error", description: err.message, variant: "destructive" });
    } finally {
      setReanalyzingVideo(false);
    }
  };

  const canSave = isEditing
    ? name && personaPrompt && voiceId
    : name && personaPrompt && photo && (pendingShots.length > 0 || studioVideoFiles.length > 0) && voiceId;

  const missingFields = [];
  if (!name) missingFields.push("Setup Name");
  if (!isEditing && !photo) missingFields.push("Product Photo");
  if (!isEditing && pendingShots.length === 0 && studioVideoFiles.length === 0) missingFields.push("At least 1 Studio clip");
  if (!personaPrompt) missingFields.push("Persona Prompt");
  if (!voiceId) missingFields.push("Voice");

  const videoSizeMB = video ? video.size / 1024 / 1024 : 0;
  const isLargeFile = videoSizeMB > 50;

  const stepLabel = uploadStep === "uploading-photo"
    ? "Uploading photo..."
    : uploadStep === "uploading-video"
    ? "Uploading video..."
    : uploadStep === "uploading-music"
    ? "Uploading music..."
    : uploadStep === "converting-music"
    ? "Extracting audio from video..."
    : uploadStep === "saving"
    ? "Saving..."
    : uploadStep === "analyzing-video"
    ? "Analyzing video..."
    : "";

  const shotCounts: Record<string, number> = {};
  for (const s of pendingShots) {
    shotCounts[s.category] = (shotCounts[s.category] || 0) + 1;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-1 sm:px-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {isEditing ? `Edit: ${editingAsset?.name}` : "New Setup"}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? "Update files, prompt, and voice."
              : "Upload assets, set voice, save."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="setup-name">Setup Name</Label>
            <Input
              id="setup-name"
              data-testid="input-setup-name"
              placeholder="e.g. Buzzly Promo v1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {!isEditing && (
            <>
              <div className="space-y-2">
                <Label htmlFor="photo-upload">Product Photo</Label>
                <Input
                  ref={photoInputRef}
                  id="photo-upload"
                  data-testid="input-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  disabled={isUploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-2 sm:w-auto"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Image className="h-4 w-4" />
                  {photo ? "Replace photo" : "Upload photo"}
                </Button>
                {photo && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Image className="w-3 h-3" />
                    {photo.name} ({(photo.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-medium">Video Builder opens in Studio</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload clips, trim, arrange, then tap Done edit. You can reopen this anytime.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" className="h-11 w-full justify-center gap-2" onClick={onOpenVideoBuilder}>
                      <Clapperboard className="h-4 w-4" />
                      {studioVideoFiles.length > 0 ? "Edit in Studio" : "Open Studio Builder"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-center gap-2"
                      onClick={() => handleSave({ analyzeVideo: true })}
                      disabled={!canSave || isUploading}
                      data-testid="button-save-analyze-video"
                    >
                      {uploadStep === "analyzing-video" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                      Save + Analyze video
                    </Button>
                  </div>
                  {studioVideoFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-emerald-500">
                          {studioVideoFiles.length} clip{studioVideoFiles.length === 1 ? "" : "s"} ready from Studio
                        </p>
                        <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5">
                          <Label htmlFor="shuffle-studio-clips" className="text-[11px] text-muted-foreground">
                            Shuffle clips
                          </Label>
                          <Switch
                            id="shuffle-studio-clips"
                            checked={shuffleStudioClips}
                            onCheckedChange={setShuffleStudioClips}
                          />
                        </div>
                      </div>
                      {shuffleStudioClips && (
                        <p className="text-[11px] text-muted-foreground">
                          Checked clips can swap order every Activate. Unchecked clips stay fixed.
                        </p>
                      )}
                      <div className="grid gap-1 sm:grid-cols-2">
                        {studioVideoFiles.slice(0, 12).map((file, index) => {
                          const key = studioClipKey(file);
                          const checked = selectedShuffleClipKeys.includes(key);
                          return (
                            <label
                              key={key}
                              className="flex min-w-0 items-center gap-2 rounded-md bg-background px-2 py-1.5 text-[10px] text-muted-foreground"
                            >
                              {shuffleStudioClips && (
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    setSelectedShuffleClipKeys((current) => (
                                      value
                                        ? Array.from(new Set([...current, key]))
                                        : current.filter((item) => item !== key)
                                    ));
                                  }}
                                />
                              )}
                              <span className="shrink-0 text-[10px] text-muted-foreground/70">{index + 1}</span>
                              <span className="truncate">{file.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
            </>
          )}

          {isEditing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Product Photo</Label>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    {editingAsset?.photoKey ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Photo attached
                      </>
                    ) : (
                      <>
                        <span className="w-4 h-4 text-muted-foreground">—</span>
                        No photo
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={replacePhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleReplaceFile(f, "photo");
                      }}
                      data-testid="input-replace-photo"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => replacePhotoInputRef.current?.click()}
                      disabled={replacePhotoUploading || replaceVideoUploading}
                      data-testid="button-replace-photo"
                    >
                      {replacePhotoUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Replace
                    </Button>
                  </div>
                </div>
                {currentMedia?.photoUrl && (
                  <img
                    src={currentMedia.photoUrl}
                    alt={`${editingAsset?.name || "Setup"} photo`}
                    className="h-36 w-full rounded-lg border object-cover sm:w-56"
                  />
                )}
                {replacePhotoUploading && (
                  <div className="space-y-1">
                    <Progress value={replacePhotoProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">Uploading new photo... {replacePhotoProgress}%</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Video Builder</Label>
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Builder setup
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        ref={replaceVideoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleReplaceFile(f, "video");
                        }}
                        data-testid="input-replace-video"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editingAsset && onOpenExistingStudio ? onOpenExistingStudio(editingAsset) : onOpenVideoBuilder?.()}
                        disabled={replaceVideoUploading}
                        data-testid="button-edit-video-builder"
                      >
                        <Clapperboard className="w-4 h-4" />
                        Edit in Studio
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => replaceVideoInputRef.current?.click()}
                        disabled={replacePhotoUploading || replaceVideoUploading}
                        data-testid="button-replace-video"
                      >
                        {replaceVideoUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Replace source
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Single video or multiple clips are edited in Studio, then used by Activate or Activate with Shuffle.
                  </p>
                </div>
                {replaceVideoUploading && (
                  <div className="space-y-1">
                    <Progress value={replaceVideoProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">Uploading new video... {replaceVideoProgress}%</p>
                  </div>
                )}
                <div className="space-y-3 rounded-lg border bg-background/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        Video Analysis: {videoAnalysisQuery.isLoading ? "Checking" : videoAnalysis ? "Ready" : "Missing"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Use this analysis for script, captions, sound effects, and transitions.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowVideoAnalysis((value) => !value)}
                        disabled={!videoAnalysis}
                        data-testid="button-view-video-analysis"
                      >
                        <Eye className="h-4 w-4" />
                        View analysis
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReanalyzeVideo}
                        disabled={reanalyzingVideo || !videoAnalysisQuery.data?.canAnalyze}
                        data-testid="button-reanalyze-video"
                      >
                        {reanalyzingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Re-analyze video
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="video-analysis-model">Video analysis model</Label>
                      <Select value={videoAnalysisModel} onValueChange={setVideoAnalysisModel}>
                        <SelectTrigger id="video-analysis-model" data-testid="select-video-analysis-model">
                          <SelectValue placeholder="Choose model" />
                        </SelectTrigger>
                        <SelectContent>
                          {videoAnalysisModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {videoAnalysis && videoAnalysis.modelUsed !== videoAnalysisModel && (
                      <Badge variant="outline" className="w-fit">
                        Re-analyze to use {videoAnalysisModel}
                      </Badge>
                    )}
                  </div>
                  {videoAnalysis && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="secondary">{videoAnalysis.modelUsed}</Badge>
                      <Badge variant="outline">{videoAnalysis.analysisVersion}</Badge>
                      <span>Updated {new Date(videoAnalysis.updatedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {videoAnalysisHighlights.length > 0 && (
                    <div className="grid gap-2 md:grid-cols-2">
                      {videoAnalysisHighlights.map((item) => (
                        <div key={item.label} className="rounded-md border bg-muted/40 p-3">
                          <p className="text-[11px] font-medium uppercase text-muted-foreground">{item.label}</p>
                          <p className="mt-1 line-clamp-3 text-sm">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {showVideoAnalysis && videoAnalysisJson && (
                    <div className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                      <pre className="whitespace-pre-wrap font-mono">
                        {JSON.stringify(videoAnalysisJson, null, 2)}
                      </pre>
                    </div>
                  )}
                  {!videoAnalysis && videoAnalysisQuery.data?.canAnalyze && (
                    <p className="text-xs text-muted-foreground">
                      No saved analysis yet. Click Re-analyze video once, then future generations can reuse it.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Background Music</Label>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    {editingAsset?.musicKey ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Music uploaded
                      </>
                    ) : (
                      <>
                        <span className="w-4 h-4 text-muted-foreground">—</span>
                        No music
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={replaceMusicInputRef}
                      type="file"
                      accept="audio/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleReplaceFile(f, "music");
                      }}
                      data-testid="input-replace-music"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => replaceMusicInputRef.current?.click()}
                      disabled={replacePhotoUploading || replaceVideoUploading || replaceMusicUploading}
                      data-testid="button-replace-music"
                    >
                      {replaceMusicUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      {editingAsset?.musicKey ? "Replace" : "Add"}
                    </Button>
                  </div>
                </div>
                {currentMedia?.musicUrl && (
                  <audio src={currentMedia.musicUrl} controls className="w-full" />
                )}
                {replaceMusicUploading && (
                  <div className="space-y-1">
                    <Progress value={replaceMusicProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">Uploading music... {replaceMusicProgress}%</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="persona-prompt">Persona / Instruction Prompt</Label>
            <div className="flex items-center gap-2">
              <Select
                key={libraryPickerKey}
                onValueChange={(val) => {
                  const chosen = scriptPromptsQuery.data?.find((p) => String(p.id) === val);
                  if (chosen) {
                    setPersonaPrompt(chosen.promptText);
                    setScriptPromptId(chosen.id);
                    setLibraryPickerKey((k) => k + 1);
                  }
                }}
                disabled={isUploading || (scriptPromptsQuery.data?.length ?? 0) === 0}
              >
                <SelectTrigger className="text-sm h-8" data-testid="select-load-prompt">
                  <SelectValue placeholder={
                    (scriptPromptsQuery.data?.length ?? 0) === 0
                      ? "No saved prompts — add in Settings"
                      : "Load from prompt library…"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {scriptPromptsQuery.data?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} title={p.promptText}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              id="persona-prompt"
              data-testid="input-persona-prompt"
              placeholder="Describe the product, target audience, and tone. Example: 'This is a rechargeable LED desk lamp perfect for students. Highlight the 3 brightness levels, USB-C charging, and 40-hour battery life. Tone: enthusiastic Buzzly reviewing tech products for families.'"
              value={personaPrompt}
              onChange={(e) => {
                setPersonaPrompt(e.target.value);
                setScriptPromptId(null);
              }}
              rows={5}
              disabled={isUploading}
            />
            {!isEditing && (
              <p className="text-xs text-muted-foreground">
                The product photo will be analyzed by AI along with this prompt to generate an accurate script.
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Model Settings
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>OpenAI Model</Label>
                <Select value={openaiModel} onValueChange={setOpenaiModel} disabled={isUploading}>
                  <SelectTrigger data-testid="select-openai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>ElevenLabs TTS Model</Label>
                <Select value={elevenlabsModel} onValueChange={setElevenlabsModel} disabled={isUploading || elModelsQuery.isLoading}>
                  <SelectTrigger data-testid="select-elevenlabs-model">
                    <SelectValue placeholder={elModelsQuery.isLoading ? "Loading models..." : "Select model..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {elModelsQuery.data?.map((m) => (
                      <SelectItem key={m.model_id} value={m.model_id}>
                        {m.name}
                      </SelectItem>
                    ))}
                    {!elModelsQuery.data?.length && !elModelsQuery.isLoading && (
                      <>
                        <SelectItem value="eleven_turbo_v2_5">Eleven Turbo v2.5</SelectItem>
                        <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Voice Selection
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="voice-search">ElevenLabs Voice</Label>
                  <Input
                    id="voice-search"
                    value={voiceSearch}
                    onChange={(event) => setVoiceSearch(event.target.value)}
                    placeholder={voicesQuery.isLoading ? "Loading voices..." : "Search voice name..."}
                    disabled={isUploading || voicesQuery.isLoading || !voicesQuery.data?.length}
                    data-testid="input-voice-search"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => voicesQuery.refetch()}
                  disabled={isUploading || voicesQuery.isFetching}
                  data-testid="button-load-voices"
                  size="icon"
                  title="Refresh voices"
                >
                  {voicesQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>

              {selectedVoice && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{selectedVoice.name}</span> ({selectedVoice.category})
                </p>
              )}

              <div className="max-h-64 overflow-auto rounded-md border bg-background">
                {voicesQuery.isLoading && (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading voices...
                  </div>
                )}
                {!voicesQuery.isLoading && filteredVoices.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    {voicesQuery.data?.length ? "No voices found." : "No voices available."}
                  </p>
                )}
                {filteredVoices.map((voice) => {
                  const isSelected = voice.voice_id === voiceId;
                  const isPreviewing = previewingVoiceId === voice.voice_id;
                  return (
                    <div
                      key={voice.voice_id}
                      className={`flex items-center justify-between gap-3 border-b p-3 last:border-b-0 ${isSelected ? "bg-primary/10" : "hover:bg-muted/60"}`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => handleVoiceSelect(voice.voice_id)}
                        disabled={isUploading}
                        data-testid="button-select-voice"
                      >
                        <p className="truncate text-sm font-medium">{voice.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{voice.category}</p>
                      </button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-2"
                        onClick={() => handlePreviewVoice(voice)}
                        disabled={isUploading || (!voice.preview_url && !isPreviewing)}
                        title={voice.preview_url ? "Preview voice" : "Preview not available"}
                        data-testid="button-preview-voice"
                      >
                        {isPreviewing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {isPreviewing ? "Stop" : voice.preview_url ? "Preview" : "No preview"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="enhance-toggle" className="text-sm font-medium">ElevenLabs Enhance</Label>
              <p className="text-xs text-muted-foreground">Speaker boost for clearer, more professional audio</p>
            </div>
            <Switch
              id="enhance-toggle"
              data-testid="switch-enhance"
              checked={useEnhance}
              onCheckedChange={setUseEnhance}
              disabled={isUploading}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <AudioLines className="w-4 h-4" />
              Dead-Air Removal Settings
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure silence detection thresholds for automatic dead-air removal (TimeBolt-style).
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Threshold (dB)</Label>
                  <span className="text-sm text-muted-foreground">{thresholdDb} dB</span>
                </div>
                <Slider
                  data-testid="slider-threshold-db"
                  value={[thresholdDb]}
                  onValueChange={([v]) => setThresholdDb(v)}
                  min={-60}
                  max={-10}
                  step={1}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Remove silences longer than</Label>
                  <span className="text-sm text-muted-foreground">{removeSilencesLongerThan}s</span>
                </div>
                <Slider
                  data-testid="slider-remove-silences"
                  value={[removeSilencesLongerThan]}
                  onValueChange={([v]) => setRemoveSilencesLongerThan(v)}
                  min={0.05}
                  max={2}
                  step={0.05}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Ignore detections shorter than</Label>
                  <span className="text-sm text-muted-foreground">{ignoreDetectionsShorterThan}s</span>
                </div>
                <Slider
                  data-testid="slider-ignore-detections"
                  value={[ignoreDetectionsShorterThan]}
                  onValueChange={([v]) => setIgnoreDetectionsShorterThan(v)}
                  min={0.1}
                  max={3}
                  step={0.05}
                  disabled={isUploading}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Music className="w-4 h-4" />
              Music optional
            </h3>

            <div className="space-y-2">
              <Label>Choose music</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedMusicKey || "none"}
                  onValueChange={(value) => {
                    stopMusicPreview();
                    setSelectedMusicKey(value === "none" ? "" : value);
                  }}
                  disabled={isUploading}
                >
                  <SelectTrigger data-testid="select-background-music">
                    <SelectValue placeholder="Choose music" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No music</SelectItem>
                    {FREE_MUSIC_LIBRARY.map((track) => (
                      <SelectItem key={track.id} value={`public:${track.uri}`}>
                        {track.title} · {track.mood}
                      </SelectItem>
                    ))}
                    {uploadedMusicOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        Uploaded · {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-2"
                  onClick={handlePreviewMusic}
                  disabled={isUploading || !selectedMusicKey || !selectedMusicPreviewUrl}
                  data-testid="button-preview-music"
                >
                  {previewingMusicKey === selectedMusicKey ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {previewingMusicKey === selectedMusicKey ? "Stop" : "Preview"}
                </Button>
              </div>
              {(selectedFreeMusicTrack || selectedUploadedMusicOption) && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{selectedFreeMusicTrack?.title || selectedUploadedMusicOption?.label}</span>
                  {selectedFreeMusicTrack ? ` · ${selectedFreeMusicTrack.mood}` : ""}
                </p>
              )}
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="music-upload">Track</Label>
                <Input
                  ref={musicInputRef}
                  id="music-upload"
                  data-testid="input-music"
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => setMusic(e.target.files?.[0] || null)}
                  disabled={isUploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-2 sm:w-auto"
                  onClick={() => musicInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Music className="h-4 w-4" />
                  {music ? "Replace music" : "Upload music"}
                </Button>
                {music && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    {music.name} ({(music.size / 1024 / 1024).toFixed(1)} MB)
                    {music.type.startsWith("video/") && (
                      <Badge variant="secondary" className="text-[10px] ml-1">video - will extract audio</Badge>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Audio or video. We extract audio from video.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Voiceover Volume</Label>
                <span className="text-sm text-muted-foreground">{Math.round(voiceVolume * 100)}%</span>
              </div>
              <Slider
                data-testid="slider-voice-volume"
                value={[voiceVolume]}
                onValueChange={([v]) => setVoiceVolume(v)}
                min={0}
                max={1.5}
                step={0.05}
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Music Volume</Label>
                <span className="text-sm text-muted-foreground">{Math.round(musicVolume * 100)}%</span>
              </div>
              <Slider
                data-testid="slider-music-volume"
                value={[musicVolume]}
                onValueChange={([v]) => setMusicVolume(v)}
                min={0}
                max={1.0}
                step={0.05}
                disabled={isUploading}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Advanced Features
            </h3>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="autocaptions-toggle" className="text-sm font-medium">Auto Captions</Label>
                <p className="text-xs text-muted-foreground">Automatically burn captions into the final video using AI transcription</p>
              </div>
              <Switch
                id="autocaptions-toggle"
                data-testid="switch-auto-captions"
                checked={autoCaptions}
                onCheckedChange={setAutoCaptions}
                disabled={isUploading}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="hookheadline-toggle" className="text-sm font-medium">Hook Headline</Label>
                <p className="text-xs text-muted-foreground">Generate an AI hook headline text (copy-paste ready)</p>
              </div>
              <Switch
                id="hookheadline-toggle"
                data-testid="switch-hook-headline"
                checked={hookHeadline}
                onCheckedChange={setHookHeadline}
                disabled={isUploading}
              />
            </div>

            {hookHeadline && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label htmlFor="hook-prompt">Hook Headline Prompt</Label>
                <Textarea
                  id="hook-prompt"
                  data-testid="input-hook-prompt"
                  placeholder="e.g. 'Create a 5-7 word attention-grabbing headline about this product'"
                  value={hookPrompt}
                  onChange={(e) => setHookPrompt(e.target.value)}
                  rows={2}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  Custom prompt for generating the hook headline. Leave empty for a default hook.
                </p>
                <div className="space-y-1 mt-2">
                  <Label className="text-xs">Hook Model</Label>
                  <Select value={hookModel} onValueChange={setHookModel} disabled={isUploading}>
                    <SelectTrigger data-testid="select-hook-model" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="caption-toggle" className="text-sm font-medium">Social Media Caption</Label>
                <p className="text-xs text-muted-foreground">Generate an AI caption for your post (copy-paste ready)</p>
              </div>
              <Switch
                id="caption-toggle"
                data-testid="switch-caption"
                checked={captionEnabled}
                onCheckedChange={setCaptionEnabled}
                disabled={isUploading}
              />
            </div>

            {captionEnabled && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label htmlFor="caption-prompt">Caption Prompt</Label>
                <Textarea
                  id="caption-prompt"
                  data-testid="input-caption-prompt"
                  placeholder="e.g. 'Write an engaging FB/IG caption with emojis and hashtags'"
                  value={captionPrompt}
                  onChange={(e) => setCaptionPrompt(e.target.value)}
                  rows={2}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  Custom prompt for caption style. Leave empty for a default social media caption.
                </p>
                <div className="space-y-1 mt-2">
                  <Label className="text-xs">Caption Model</Label>
                  <Select value={captionModel} onValueChange={setCaptionModel} disabled={isUploading}>
                    <SelectTrigger data-testid="select-caption-model" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="seo-toggle" className="text-sm font-medium">SEO Keywords & Hashtags</Label>
                <p className="text-xs text-muted-foreground">Generate AI hashtags and SEO keywords (copy-paste ready)</p>
              </div>
              <Switch
                id="seo-toggle"
                data-testid="switch-seo"
                checked={seoEnabled}
                onCheckedChange={setSeoEnabled}
                disabled={isUploading}
              />
            </div>

            {seoEnabled && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label htmlFor="seo-prompt">SEO Prompt</Label>
                <Textarea
                  id="seo-prompt"
                  data-testid="input-seo-prompt"
                  placeholder="e.g. 'Focus on Filipino market keywords and trending hashtags'"
                  value={seoPrompt}
                  onChange={(e) => setSeoPrompt(e.target.value)}
                  rows={2}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  Custom prompt for SEO focus. Leave empty for default hashtags and keywords.
                </p>
                <div className="space-y-1 mt-2">
                  <Label className="text-xs">SEO Model</Label>
                  <Select value={seoModel} onValueChange={setSeoModel} disabled={isUploading}>
                    <SelectTrigger data-testid="select-seo-model" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {!canSave && !isUploading && missingFields.length > 0 && (
            <p className="text-sm text-destructive" data-testid="text-validation-hint">
              Please fill in: {missingFields.join(", ")}
            </p>
          )}

          {isUploading && !isEditing && (
            <div className="space-y-3" data-testid="upload-progress">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {uploadStep === "uploading-photo" && <Loader2 className="w-3 h-3 animate-spin" />}
                  {(uploadStep === "uploading-video" || uploadStep === "uploading-music" || uploadStep === "saving") && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  <span className={uploadStep === "uploading-photo" ? "font-medium" : "text-muted-foreground"}>
                    Upload photo
                  </span>
                  {uploadStep === "uploading-photo" && <span className="ml-auto text-xs">{uploadProgress}%</span>}
                </div>
                {uploadStep === "uploading-photo" && <Progress value={uploadProgress} className="h-2" />}
              </div>

              {music && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    {uploadStep === "uploading-music" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {uploadStep === "saving" && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    {(uploadStep === "uploading-photo" || uploadStep === "uploading-video") && <span className="w-3 h-3" />}
                    <span className={uploadStep === "uploading-music" ? "font-medium" : "text-muted-foreground"}>
                      Upload music
                    </span>
                    {uploadStep === "uploading-music" && <span className="ml-auto text-xs">{uploadProgress}%</span>}
                  </div>
                  {uploadStep === "uploading-music" && <Progress value={uploadProgress} className="h-2" />}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                {uploadStep === "saving" && <Loader2 className="w-3 h-3 animate-spin" />}
                {uploadStep === "analyzing-video" && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                {(uploadStep === "uploading-photo" || uploadStep === "uploading-video" || uploadStep === "uploading-music") && <span className="w-3 h-3" />}
                <span className={uploadStep === "saving" ? "font-medium" : "text-muted-foreground"}>
                  Save setup + shots
                </span>
              </div>

              {uploadStep === "analyzing-video" && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="font-medium">Analyze video</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {isEditing && (
              <Button
                variant="secondary"
                className="flex-1"
                size="lg"
                onClick={onCancelEdit}
                disabled={isUploading}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
            )}
            <Button
              className="flex-1"
              size="lg"
              onClick={() => handleSave()}
              disabled={!canSave || isUploading}
              data-testid="button-save-setup"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isUploading ? stepLabel : isEditing ? "Update Setup" : "Save Setup"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
