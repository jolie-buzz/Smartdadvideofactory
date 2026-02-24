import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Upload, Mic, Save, Loader2, Image, Film, RefreshCw, AlertTriangle, CheckCircle2, Brain, AudioLines, Music, Captions, Sparkles, Clapperboard, Trash2, Scissors } from "lucide-react";
import VideoTrimmer from "./video-trimmer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Asset } from "@shared/schema";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
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

const MAX_FILE_SIZE_MB = 150;

const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o (recommended)" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini (faster, cheaper)" },
  { id: "gpt-4.1", name: "GPT-4.1" },
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

type UploadStep = "idle" | "uploading-photo" | "uploading-video" | "uploading-music" | "converting-music" | "saving" | "done";

interface SetupFormProps {
  onComplete: () => void;
  editingAsset?: Asset | null;
  onCancelEdit?: () => void;
}

export function SetupForm({ onComplete, editingAsset, onCancelEdit }: SetupFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [videoSource, setVideoSource] = useState<"edited" | "builder">("edited");
  const [personaPrompt, setPersonaPrompt] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [elevenlabsModel, setElevenlabsModel] = useState("eleven_multilingual_v2");
  const [useEnhance, setUseEnhance] = useState(true);
  const [thresholdDb, setThresholdDb] = useState(-35);
  const [removeSilencesLongerThan, setRemoveSilencesLongerThan] = useState(0.2);
  const [ignoreDetectionsShorterThan, setIgnoreDetectionsShorterThan] = useState(0.75);
  const [music, setMusic] = useState<File | null>(null);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [autoCaptions, setAutoCaptions] = useState(false);
  const [hookHeadline, setHookHeadline] = useState(false);
  const [hookPrompt, setHookPrompt] = useState("");
  const [hookModel, setHookModel] = useState("gpt-4o");
  const [hookFontSize, setHookFontSize] = useState(48);
  const [hookFontColor, setHookFontColor] = useState("#FFFFFF");
  const [hookStrokeColor, setHookStrokeColor] = useState("#000000");
  const [hookPosition, setHookPosition] = useState("center");
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const [tempAssetId] = useState(() => crypto.randomUUID());
  const [pendingShots, setPendingShots] = useState<PendingShot[]>([]);
  const [shotCategory, setShotCategory] = useState<string>("BODY");
  const [shotType, setShotType] = useState<string>("");
  const [shotUploading, setShotUploading] = useState(false);
  const [shotUploadProgress, setShotUploadProgress] = useState(0);

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
      setVideoSource((editingAsset.videoSource as "edited" | "builder") || "edited");
      setPersonaPrompt(editingAsset.personaPrompt);
      setVoiceId(editingAsset.voiceId || "");
      setVoiceName(editingAsset.voiceName || "");
      setOpenaiModel(editingAsset.openaiModel || "gpt-4o");
      setElevenlabsModel(editingAsset.elevenlabsModel || "eleven_multilingual_v2");
      setUseEnhance(editingAsset.useEnhance !== undefined ? editingAsset.useEnhance : true);
      setThresholdDb(editingAsset.thresholdDb);
      setRemoveSilencesLongerThan(editingAsset.removeSilencesLongerThan);
      setIgnoreDetectionsShorterThan(editingAsset.ignoreDetectionsShorterThan);
      setVoiceVolume(editingAsset.voiceVolume ?? 1.0);
      setMusicVolume(editingAsset.musicVolume ?? 0.3);
      setAutoCaptions(editingAsset.autoCaptions ?? false);
      setHookHeadline(editingAsset.hookHeadline ?? false);
      setHookPrompt(editingAsset.hookPrompt || "");
      setHookModel(editingAsset.hookModel || "gpt-4o");
      setHookFontSize(editingAsset.hookFontSize ?? 48);
      setHookFontColor(editingAsset.hookFontColor ?? "#FFFFFF");
      setHookStrokeColor(editingAsset.hookStrokeColor ?? "#000000");
      setHookPosition(editingAsset.hookPosition ?? "center");
      setPhoto(null);
      setVideo(null);
      setMusic(null);
    }
  }, [editingAsset]);

  const voicesQuery = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const elModelsQuery = useQuery<ElevenLabsModel[]>({
    queryKey: ["/api/elevenlabs/models"],
  });

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

  const handleSave = async () => {
    if (isEditing) {
      try {
        setUploadStep("saving");
        const res = await fetch(`/api/assets/${editingAsset!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, videoSource, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance,
            thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan,
            voiceVolume, musicVolume, autoCaptions, hookHeadline, hookPrompt: hookPrompt || null, hookModel,
            hookFontSize, hookFontColor, hookStrokeColor, hookPosition,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server error (${res.status})`);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
        toast({ title: "Setup updated", description: "Your setup has been updated successfully." });
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
    if (videoSource === "edited" && !video) return;
    if (videoSource === "builder" && pendingShots.length === 0) return;

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

      let videoResult: { key: string; assetId: string } | null = null;
      if (video && videoSource === "edited") {
        setUploadStep("uploading-video");
        setUploadProgress(0);
        videoResult = await uploadFileWithProgress(video, "video", tempAssetId, setUploadProgress);
      }

      let musicKeyValue: string | null = null;
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
          name, photoKey: photoResult.key, videoKey: videoResult?.key || "",
          videoSource, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance,
          thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan,
          musicKey: musicKeyValue, voiceVolume, musicVolume,
          autoCaptions, hookHeadline, hookPrompt: hookPrompt || null, hookModel,
          hookFontSize, hookFontColor, hookStrokeColor, hookPosition,
        }),
      });

      if (!res.ok) {
        let errorMessage = `Server error (${res.status})`;
        try { const errData = await res.json(); errorMessage = errData.error || errorMessage; } catch {}
        throw new Error(errorMessage);
      }

      const createdAsset = await res.json();

      if (videoSource === "builder" && pendingShots.length > 0) {
        for (const shot of pendingShots) {
          await fetch(`/api/assets/${createdAsset.id}/shots`, {
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
        }
      }

      setUploadStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Setup saved", description: "Your setup has been saved successfully." });
      setName("");
      setPersonaPrompt("");
      setPhoto(null);
      setVideo(null);
      setMusic(null);
      setVoiceId("");
      setVoiceName("");
      setOpenaiModel("gpt-4o");
      setElevenlabsModel("eleven_multilingual_v2");
      setUseEnhance(true);
      setVoiceVolume(1.0);
      setMusicVolume(0.3);
      setAutoCaptions(false);
      setHookHeadline(false);
      setHookPrompt("");
      setPendingShots([]);
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

  const canSave = isEditing
    ? name && personaPrompt && voiceId
    : name && personaPrompt && photo && (videoSource === "builder" ? pendingShots.length > 0 : !!video) && voiceId;

  const missingFields = [];
  if (!name) missingFields.push("Setup Name");
  if (!isEditing && !photo) missingFields.push("Product Photo");
  if (!isEditing && videoSource === "edited" && !video) missingFields.push("Edited Video");
  if (!isEditing && videoSource === "builder" && pendingShots.length === 0) missingFields.push("At least 1 shot clip");
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
    : "";

  const shotCounts: Record<string, number> = {};
  for (const s of pendingShots) {
    shotCounts[s.category] = (shotCounts[s.category] || 0) + 1;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {isEditing ? `Edit Setup: ${editingAsset?.name}` : "Create New Setup"}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? "Update your setup settings. Photo and video cannot be changed."
              : "Upload your product photo and edited video, configure your persona and voice settings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="setup-name">Setup Name</Label>
            <Input
              id="setup-name"
              data-testid="input-setup-name"
              placeholder="e.g. SmartDad Promo v1"
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
                  className="file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:text-secondary-foreground file:text-sm"
                />
                {photo && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Image className="w-3 h-3" />
                    {photo.name} ({(photo.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Video Source</Label>
                <RadioGroup
                  value={videoSource}
                  onValueChange={(v) => setVideoSource(v as "edited" | "builder")}
                  className="flex gap-4"
                  disabled={isUploading}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="edited" id="vs-edited" data-testid="radio-video-edited" />
                    <Label htmlFor="vs-edited" className="flex items-center gap-1.5 cursor-pointer">
                      <Film className="w-4 h-4" />
                      Edited Video
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="builder" id="vs-builder" data-testid="radio-video-builder" />
                    <Label htmlFor="vs-builder" className="flex items-center gap-1.5 cursor-pointer">
                      <Clapperboard className="w-4 h-4" />
                      Video Builder
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  {videoSource === "edited"
                    ? "Upload an already-edited video to use as the base."
                    : "Upload shot clips below. When you activate, a video will be auto-built from your clips and sent to the AI pipeline."}
                </p>
              </div>

              {videoSource === "edited" && (
                <div className="space-y-2">
                  <Label htmlFor="video-upload">Edited Video</Label>
                  <Input
                    ref={videoInputRef}
                    id="video-upload"
                    data-testid="input-video"
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideo(e.target.files?.[0] || null)}
                    disabled={isUploading}
                    className="file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:text-secondary-foreground file:text-sm"
                  />
                  {video && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {video.name} ({videoSizeMB.toFixed(1)} MB)
                    </p>
                  )}
                  {isLargeFile && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Large file - upload may take a while on slow connections
                    </p>
                  )}
                </div>
              )}

              {videoSource === "builder" && (
                <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Clapperboard className="w-4 h-4" />
                    <h4 className="text-sm font-medium">Shot Library</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a source video, then trim multiple shots from it. Need at least 1 HOOK and 4 BODY shots with different types.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Source Video</Label>
                      {!sourceFile ? (
                        <Input
                          ref={sourceInputRef}
                          data-testid="input-source-video"
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            if (f) {
                              setSourceFile(f);
                              setSourceR2Key(null);
                              handleUploadSource(f);
                            }
                          }}
                          disabled={sourceUploading || trimming || isUploading}
                          className="file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:text-secondary-foreground file:text-xs text-xs"
                        />
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Film className="w-3 h-3" />
                              {sourceFile.name} ({(sourceFile.size / 1024 / 1024).toFixed(1)} MB)
                              {sourceR2Key && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                setSourceFile(null);
                                setSourceR2Key(null);
                                if (sourceInputRef.current) sourceInputRef.current.value = "";
                              }}
                              disabled={sourceUploading || trimming}
                              data-testid="button-change-source"
                            >
                              Change
                            </Button>
                          </div>
                        </div>
                      )}

                      {sourceUploading && (
                        <div className="space-y-1">
                          <Progress value={sourceUploadProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground">Uploading source video... {sourceUploadProgress}%</p>
                        </div>
                      )}
                    </div>

                    {sourceFile && sourceR2Key && sourceVideoUrl && (
                      <>
                        <VideoTrimmer
                          videoSrc={sourceVideoUrl}
                          duration={videoDuration}
                          startTime={trimStart}
                          endTime={trimEnd}
                          onStartChange={setTrimStart}
                          onEndChange={setTrimEnd}
                          disabled={trimming}
                        />

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Scissors className="w-4 h-4" />
                            <h4 className="text-xs font-medium">Shot Details</h4>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Category</Label>
                              <Select value={shotCategory} onValueChange={setShotCategory} disabled={trimming || isUploading}>
                                <SelectTrigger data-testid="select-shot-category" className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Shot Type {shotCategory === "BODY" ? "(required)" : "(optional)"}</Label>
                              <Select value={shotType} onValueChange={setShotType} disabled={trimming || isUploading}>
                                <SelectTrigger data-testid="select-shot-type" className="h-8 text-xs">
                                  <SelectValue placeholder="Select type..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {SHOT_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {trimming && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <p className="text-xs text-muted-foreground">Trimming clip on server...</p>
                              </div>
                            </div>
                          )}

                          <Button
                            onClick={handleTrimShot}
                            disabled={!sourceR2Key || trimming || isUploading || (shotCategory === "BODY" && (!shotType || shotType === "none")) || trimEnd <= trimStart}
                            data-testid="button-trim-shot"
                            size="sm"
                            className="w-full"
                          >
                            {trimming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Scissors className="w-3 h-3 mr-1" />}
                            Trim & Add Shot
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {pendingShots.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-medium">Shots ({pendingShots.length})</h4>
                          <div className="flex gap-1 flex-wrap">
                            {CATEGORIES.map((c) => shotCounts[c] ? (
                              <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">
                                {c}: {shotCounts[c]}
                              </Badge>
                            ) : null)}
                          </div>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {pendingShots.map((shot) => (
                            <div key={shot.id} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50" data-testid={`shot-item-${shot.id}`}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge className={`text-[10px] shrink-0 ${CATEGORY_COLORS[shot.category] || ""}`}>
                                  {shot.category}
                                </Badge>
                                {shot.shotType && (
                                  <span className="text-[10px] text-muted-foreground">{shot.shotType}</span>
                                )}
                                <span className="text-[10px] text-muted-foreground truncate">{shot.filename}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{shot.durationSec}s</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={() => handleDeletePendingShot(shot.id)}
                                data-testid={`button-delete-shot-${shot.id}`}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="persona-prompt">Persona / Instruction Prompt</Label>
            <Textarea
              id="persona-prompt"
              data-testid="input-persona-prompt"
              placeholder="Describe the product, target audience, and tone. Example: 'This is a rechargeable LED desk lamp perfect for students. Highlight the 3 brightness levels, USB-C charging, and 40-hour battery life. Tone: enthusiastic SmartDad reviewing tech products for families.'"
              value={personaPrompt}
              onChange={(e) => setPersonaPrompt(e.target.value)}
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
                      <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2</SelectItem>
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
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label>ElevenLabs Voice</Label>
                <Select value={voiceId} onValueChange={handleVoiceSelect} disabled={isUploading || voicesQuery.isLoading || !voicesQuery.data?.length}>
                  <SelectTrigger data-testid="select-voice">
                    <SelectValue placeholder={voicesQuery.isLoading ? "Loading voices..." : voicesQuery.data?.length ? "Select a voice..." : "No voices available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voicesQuery.data?.map((v) => (
                      <SelectItem key={v.voice_id} value={v.voice_id}>
                        {v.name} ({v.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
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
              Background Music (Optional)
            </h3>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="music-upload">Music Track</Label>
                <Input
                  ref={musicInputRef}
                  id="music-upload"
                  data-testid="input-music"
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => setMusic(e.target.files?.[0] || null)}
                  disabled={isUploading}
                  className="file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:text-secondary-foreground file:text-sm"
                />
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
                  Upload an audio or video file. If you upload a video, the audio track will be automatically extracted.
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
                <p className="text-xs text-muted-foreground">Add an AI-generated hook headline overlay at the start of the video</p>
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
              <div className="space-y-2">
                <Label htmlFor="hook-prompt">Hook Headline Prompt</Label>
                <Textarea
                  id="hook-prompt"
                  data-testid="input-hook-prompt"
                  placeholder="e.g. 'Create a 5-7 word attention-grabbing headline about this product that makes people stop scrolling'"
                  value={hookPrompt}
                  onChange={(e) => setHookPrompt(e.target.value)}
                  rows={3}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  Custom prompt for generating the hook headline. Leave empty for a default hook.
                </p>
                <div className="space-y-1 mt-2">
                  <Label className="text-xs">Hook Headline Model</Label>
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

                <Separator className="my-3" />
                <p className="text-xs font-medium text-muted-foreground">Font Style</p>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Font Size</Label>
                    <Select value={String(hookFontSize)} onValueChange={(v) => setHookFontSize(Number(v))} disabled={isUploading}>
                      <SelectTrigger data-testid="select-hook-font-size" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="32">32 (Small)</SelectItem>
                        <SelectItem value="40">40 (Medium)</SelectItem>
                        <SelectItem value="48">48 (Default)</SelectItem>
                        <SelectItem value="56">56 (Large)</SelectItem>
                        <SelectItem value="64">64 (XL)</SelectItem>
                        <SelectItem value="72">72 (XXL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Position</Label>
                    <Select value={hookPosition} onValueChange={setHookPosition} disabled={isUploading}>
                      <SelectTrigger data-testid="select-hook-position" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Font Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        data-testid="input-hook-font-color"
                        value={hookFontColor}
                        onChange={(e) => setHookFontColor(e.target.value)}
                        disabled={isUploading}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <span className="text-xs text-muted-foreground">{hookFontColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stroke Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        data-testid="input-hook-stroke-color"
                        value={hookStrokeColor}
                        onChange={(e) => setHookStrokeColor(e.target.value)}
                        disabled={isUploading}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <span className="text-xs text-muted-foreground">{hookStrokeColor}</span>
                    </div>
                  </div>
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

              {videoSource === "edited" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    {uploadStep === "uploading-video" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {(uploadStep === "uploading-music" || uploadStep === "saving") && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    {uploadStep === "uploading-photo" && <span className="w-3 h-3" />}
                    <span className={uploadStep === "uploading-video" ? "font-medium" : "text-muted-foreground"}>
                      Upload video
                    </span>
                    {uploadStep === "uploading-video" && <span className="ml-auto text-xs">{uploadProgress}%</span>}
                  </div>
                  {uploadStep === "uploading-video" && <Progress value={uploadProgress} className="h-2" />}
                </div>
              )}

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
                {(uploadStep === "uploading-photo" || uploadStep === "uploading-video" || uploadStep === "uploading-music") && <span className="w-3 h-3" />}
                <span className={uploadStep === "saving" ? "font-medium" : "text-muted-foreground"}>
                  Save setup{videoSource === "builder" ? " + shots" : ""}
                </span>
              </div>
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
              onClick={handleSave}
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
