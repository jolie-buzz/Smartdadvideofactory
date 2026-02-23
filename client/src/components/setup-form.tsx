import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Upload, Mic, Save, Loader2, Image, Film, RefreshCw, AlertTriangle } from "lucide-react";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
}

const MAX_FILE_SIZE_MB = 150;

export function SetupForm({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [personaPrompt, setPersonaPrompt] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [thresholdDb, setThresholdDb] = useState(-35);
  const [removeSilencesLongerThan, setRemoveSilencesLongerThan] = useState(0.2);
  const [ignoreDetectionsShorterThan, setIgnoreDetectionsShorterThan] = useState(0.75);

  const voicesQuery = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!photo || !video) throw new Error("Photo and video are required");

      const photoSizeMB = photo.size / 1024 / 1024;
      const videoSizeMB = video.size / 1024 / 1024;
      if (photoSizeMB > MAX_FILE_SIZE_MB) {
        throw new Error(`Photo is too large (${photoSizeMB.toFixed(0)} MB). Max is ${MAX_FILE_SIZE_MB} MB.`);
      }
      if (videoSizeMB > MAX_FILE_SIZE_MB) {
        throw new Error(`Video is too large (${videoSizeMB.toFixed(0)} MB). Max is ${MAX_FILE_SIZE_MB} MB.`);
      }

      const formData = new FormData();
      formData.append("name", name);
      formData.append("personaPrompt", personaPrompt);
      formData.append("voiceId", voiceId);
      formData.append("voiceName", voiceName);
      formData.append("thresholdDb", String(thresholdDb));
      formData.append("removeSilencesLongerThan", String(removeSilencesLongerThan));
      formData.append("ignoreDetectionsShorterThan", String(ignoreDetectionsShorterThan));
      formData.append("photo", photo);
      formData.append("video", video);

      let res: Response;
      try {
        res = await fetch("/api/setup", {
          method: "POST",
          body: formData,
        });
      } catch (networkErr) {
        throw new Error("Network error - please check your connection and try again. Large files may take a while to upload.");
      }

      if (!res.ok) {
        let errorMessage = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } catch {
          try {
            const text = await res.text();
            if (text.length < 200) errorMessage = text;
          } catch {}
        }
        throw new Error(errorMessage);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Setup saved", description: "Your setup has been saved successfully." });
      setName("");
      setPersonaPrompt("");
      setPhoto(null);
      setVideo(null);
      setVoiceId("");
      setVoiceName("");
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleVoiceSelect = (id: string) => {
    setVoiceId(id);
    const voice = voicesQuery.data?.find((v) => v.voice_id === id);
    setVoiceName(voice?.name || "");
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setVideo(file);
  };

  const canSave = name && personaPrompt && photo && video && voiceId;

  const missingFields = [];
  if (!name) missingFields.push("Setup Name");
  if (!photo) missingFields.push("Product Photo");
  if (!video) missingFields.push("Edited Video");
  if (!personaPrompt) missingFields.push("Persona Prompt");
  if (!voiceId) missingFields.push("Voice");

  const videoSizeMB = video ? video.size / 1024 / 1024 : 0;
  const isLargeFile = videoSizeMB > 50;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Create New Setup
          </CardTitle>
          <CardDescription>
            Upload your product photo and edited video, configure your persona and voice settings.
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
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="photo-upload">Product Photo</Label>
              <div className="relative">
                <Input
                  id="photo-upload"
                  data-testid="input-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
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
                id="video-upload"
                data-testid="input-video"
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
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

          <div className="space-y-2">
            <Label htmlFor="persona-prompt">Persona / Instruction Prompt</Label>
            <Textarea
              id="persona-prompt"
              data-testid="input-persona-prompt"
              placeholder="Describe the product, target audience, and tone. Example: 'This is a rechargeable LED desk lamp perfect for students. Highlight the 3 brightness levels, USB-C charging, and 40-hour battery life. Tone: enthusiastic SmartDad reviewing tech products for families.'"
              value={personaPrompt}
              onChange={(e) => setPersonaPrompt(e.target.value)}
              rows={5}
            />
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
                <Select value={voiceId} onValueChange={handleVoiceSelect} disabled={voicesQuery.isLoading || !voicesQuery.data?.length}>
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
                disabled={voicesQuery.isFetching}
                data-testid="button-load-voices"
                size="icon"
                title="Refresh voices"
              >
                {voicesQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Dead-Air Removal Settings</h3>
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
                />
              </div>
            </div>
          </div>

          {!canSave && missingFields.length > 0 && (
            <p className="text-sm text-destructive" data-testid="text-validation-hint">
              Please fill in: {missingFields.join(", ")}
            </p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            data-testid="button-save-setup"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saveMutation.isPending ? "Uploading..." : "Save Setup"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
