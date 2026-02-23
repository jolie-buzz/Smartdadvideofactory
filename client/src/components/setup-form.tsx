import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { Upload, Mic, Save, Loader2, Image, Film, RefreshCw, AlertTriangle, CheckCircle2, Brain, AudioLines } from "lucide-react";
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

const MAX_FILE_SIZE_MB = 150;

const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o (recommended)" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini (faster, cheaper)" },
  { id: "gpt-4.1", name: "GPT-4.1" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano (fastest)" },
];

function uploadFileWithProgress(
  file: File,
  type: "photo" | "video",
  assetId: string,
  onProgress: (percent: number) => void
): Promise<{ key: string; assetId: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("assetId", assetId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid server response"));
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const data = JSON.parse(xhr.responseText);
          msg = data.error || msg;
        } catch {
          if (xhr.responseText.length < 200) msg = xhr.responseText;
        }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error - please check your connection and try again."));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timed out. Please try again with a stable connection."));
    });

    xhr.timeout = 10 * 60 * 1000;
    xhr.send(formData);
  });
}

type UploadStep = "idle" | "uploading-photo" | "uploading-video" | "saving" | "done";

interface SetupFormProps {
  onComplete: () => void;
  editingAsset?: Asset | null;
  onCancelEdit?: () => void;
}

export function SetupForm({ onComplete, editingAsset, onCancelEdit }: SetupFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
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
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingAsset;
  const isUploading = uploadStep !== "idle" && uploadStep !== "done";

  useEffect(() => {
    if (editingAsset) {
      setName(editingAsset.name);
      setPersonaPrompt(editingAsset.personaPrompt);
      setVoiceId(editingAsset.voiceId || "");
      setVoiceName(editingAsset.voiceName || "");
      setOpenaiModel(editingAsset.openaiModel || "gpt-4o");
      setElevenlabsModel(editingAsset.elevenlabsModel || "eleven_multilingual_v2");
      setUseEnhance(editingAsset.useEnhance !== undefined ? editingAsset.useEnhance : true);
      setThresholdDb(editingAsset.thresholdDb);
      setRemoveSilencesLongerThan(editingAsset.removeSilencesLongerThan);
      setIgnoreDetectionsShorterThan(editingAsset.ignoreDetectionsShorterThan);
      setPhoto(null);
      setVideo(null);
    }
  }, [editingAsset]);

  const voicesQuery = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const handleSave = async () => {
    if (isEditing) {
      try {
        setUploadStep("saving");
        const res = await fetch(`/api/assets/${editingAsset!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance,
            thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan,
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

    if (!photo || !video) return;

    const photoSizeMB = photo.size / 1024 / 1024;
    const videoSizeMB = video.size / 1024 / 1024;
    if (photoSizeMB > MAX_FILE_SIZE_MB) {
      toast({ title: "Error", description: `Photo is too large (${photoSizeMB.toFixed(0)} MB). Max is ${MAX_FILE_SIZE_MB} MB.`, variant: "destructive" });
      return;
    }
    if (videoSizeMB > MAX_FILE_SIZE_MB) {
      toast({ title: "Error", description: `Video is too large (${videoSizeMB.toFixed(0)} MB). Max is ${MAX_FILE_SIZE_MB} MB.`, variant: "destructive" });
      return;
    }

    const assetId = crypto.randomUUID();

    try {
      setUploadStep("uploading-photo");
      setUploadProgress(0);
      const photoResult = await uploadFileWithProgress(photo, "photo", assetId, setUploadProgress);

      setUploadStep("uploading-video");
      setUploadProgress(0);
      const videoResult = await uploadFileWithProgress(video, "video", assetId, setUploadProgress);

      setUploadStep("saving");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, photoKey: photoResult.key, videoKey: videoResult.key,
          personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance,
          thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan,
        }),
      });

      if (!res.ok) {
        let errorMessage = `Server error (${res.status})`;
        try { const errData = await res.json(); errorMessage = errData.error || errorMessage; } catch {}
        throw new Error(errorMessage);
      }

      setUploadStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Setup saved", description: "Your setup has been saved successfully." });
      setName("");
      setPersonaPrompt("");
      setPhoto(null);
      setVideo(null);
      setVoiceId("");
      setVoiceName("");
      setOpenaiModel("gpt-4o");
      setElevenlabsModel("eleven_multilingual_v2");
      setUseEnhance(true);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
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
    : name && personaPrompt && photo && video && voiceId;

  const missingFields = [];
  if (!name) missingFields.push("Setup Name");
  if (!isEditing && !photo) missingFields.push("Product Photo");
  if (!isEditing && !video) missingFields.push("Edited Video");
  if (!personaPrompt) missingFields.push("Persona Prompt");
  if (!voiceId) missingFields.push("Voice");

  const videoSizeMB = video ? video.size / 1024 / 1024 : 0;
  const isLargeFile = videoSizeMB > 50;

  const stepLabel = uploadStep === "uploading-photo"
    ? "Uploading photo..."
    : uploadStep === "uploading-video"
    ? "Uploading video..."
    : uploadStep === "saving"
    ? "Saving..."
    : "";

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="photo-upload">Product Photo</Label>
                <div className="relative">
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
                </div>
                {photo && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Image className="w-3 h-3" />
                    {photo.name} ({(photo.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>

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
            </div>
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
                <Select value={elevenlabsModel} onValueChange={setElevenlabsModel} disabled={isUploading}>
                  <SelectTrigger data-testid="select-elevenlabs-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2</SelectItem>
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
                  {(uploadStep === "uploading-video" || uploadStep === "saving") && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  <span className={uploadStep === "uploading-photo" ? "font-medium" : "text-muted-foreground"}>
                    Upload photo
                  </span>
                  {uploadStep === "uploading-photo" && <span className="ml-auto text-xs">{uploadProgress}%</span>}
                </div>
                {uploadStep === "uploading-photo" && <Progress value={uploadProgress} className="h-2" />}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {uploadStep === "uploading-video" && <Loader2 className="w-3 h-3 animate-spin" />}
                  {uploadStep === "saving" && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  {uploadStep === "uploading-photo" && <span className="w-3 h-3" />}
                  <span className={uploadStep === "uploading-video" ? "font-medium" : "text-muted-foreground"}>
                    Upload video
                  </span>
                  {uploadStep === "uploading-video" && <span className="ml-auto text-xs">{uploadProgress}%</span>}
                </div>
                {uploadStep === "uploading-video" && <Progress value={uploadProgress} className="h-2" />}
              </div>

              <div className="flex items-center gap-2 text-sm">
                {uploadStep === "saving" && <Loader2 className="w-3 h-3 animate-spin" />}
                {(uploadStep === "uploading-photo" || uploadStep === "uploading-video") && <span className="w-3 h-3" />}
                <span className={uploadStep === "saving" ? "font-medium" : "text-muted-foreground"}>
                  Save setup
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
