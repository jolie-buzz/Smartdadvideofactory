import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AudioLines,
  Captions,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Film,
  Image,
  Loader2,
  Mic,
  Music,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FREE_MUSIC_LIBRARY } from "./free-music-library";
import type { StudioGoal } from "./studio-onboarding";

type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category: string;
  preview_url?: string;
};

type ElevenLabsModel = {
  model_id: string;
  name: string;
  description: string;
};

export type GuidedSetupDraft = {
  goal: StudioGoal;
  productName: string;
  productPhoto: File | null;
  rawVideos: File[];
  productNotes: string;
  style: string;
  duration: number;
  platform: string;
  voiceMode: string;
  voiceId: string;
  voiceName: string;
  elevenlabsModel: string;
  captionStyle: string;
  musicMode: string;
  musicAssetId: string;
  musicName: string;
  musicUri: string;
};

export type GuidedShotSlot = {
  id: string;
  index: number;
  name: string;
  role: string;
  guidance: string;
  file: File | null;
  edited: boolean;
};

export type GuidedSetupState = {
  productName: string;
  productPhoto: File | null;
  shotSlots: GuidedShotSlot[];
  productNotes: string;
  style: string;
  duration: number;
  platform: string;
  voiceMode: string;
  voiceId: string;
  voiceName: string;
  elevenlabsModel: string;
  captionStyle: string;
  musicMode: string;
  musicAssetId: string;
  musicName: string;
  musicUri: string;
};

type GuidedSetupWizardProps = {
  goal: StudioGoal;
  setupState: GuidedSetupState;
  hasGeneratedDraft: boolean;
  onSetupStateChange: (state: GuidedSetupState) => void;
  onRegisterAssetFiles?: (files: File[]) => void;
  studioVideoFiles?: File[];
  onOpenStudioBuilder: () => void;
  onGenerateDraft: (draft: GuidedSetupDraft) => void;
  onOpenStudio: () => void;
  onOpenSaveSetup: () => void;
};

const wizardSteps = [
  { id: "assets", label: "Upload", icon: Upload },
  { id: "style", label: "Style", icon: Clapperboard },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "review", label: "Review", icon: CheckCircle2 },
] as const;

const aiProductionSteps = [
  "Analyzing Product Image",
  "Detecting Video Assets",
  "Identifying Best Video Segments",
  "Generating Sales Script",
  "Creating Voice Over",
  "Generating AI B-Roll Assets",
  "Selecting Background Music",
  "Building Timeline",
  "Preparing Studio Project",
];

const styleOptions = [
  "Fast TikTok UGC",
  "Clean Product Demo",
  "Creator Testimonial",
  "Promo/Sale Push",
  "Before/After Proof",
  "Educational Reel",
];

const durationOptions = [15, 30, 45, 60];
const platformOptions = ["TikTok/Reels", "YouTube Shorts", "Facebook Reels"];
const captionOptions = ["Bold TikTok captions", "Clean premium captions", "Native subtitle style"];
const voiceOptions = ["AI voiceover", "No voiceover", "Use clip audio"];
const musicOptions = ["Use free music library", "Use uploaded asset music", "No music"];

const defaultShotSlots = [
  {
    name: "Hook",
    role: "Stop scroll",
    guidance: "First 1-3 seconds. Strong visual or problem moment.",
  },
  {
    name: "Talking",
    role: "Creator intro",
    guidance: "Face or voice explanation. Make it personal and direct.",
  },
  {
    name: "Demo",
    role: "Product in action",
    guidance: "Show exactly how the product works.",
  },
  {
    name: "B-roll",
    role: "Beauty/details",
    guidance: "Close-ups, texture, packaging, hands, angles.",
  },
  {
    name: "Problem",
    role: "Pain point",
    guidance: "Show the before state or customer struggle.",
  },
  {
    name: "Result",
    role: "Payoff",
    guidance: "Show after, benefit, transformation, or proof.",
  },
  {
    name: "Proof",
    role: "Trust builder",
    guidance: "Test, comparison, review, screenshot, or claim support.",
  },
  {
    name: "Lifestyle",
    role: "Real use",
    guidance: "Show the product in a natural everyday setting.",
  },
  {
    name: "Offer",
    role: "Promo/price",
    guidance: "Sale, bundle, discount, bonus, or urgency shot.",
  },
  {
    name: "CTA",
    role: "Action",
    guidance: "Final product shot or clear next step.",
  },
];

export function createInitialGuidedSetupState(): GuidedSetupState {
  return {
    productName: "",
    productPhoto: null,
    shotSlots: Array.from({ length: 10 }, (_, index) => ({
      id: `shot-slot-${index + 1}`,
      index,
      name: defaultShotSlots[index].name,
      role: defaultShotSlots[index].role,
      guidance: defaultShotSlots[index].guidance,
      file: null,
      edited: false,
    })),
    productNotes: "",
    style: styleOptions[0],
    duration: 30,
    platform: "TikTok/Reels",
    voiceMode: "AI voiceover",
    voiceId: "",
    voiceName: "",
    elevenlabsModel: "eleven_turbo_v2_5",
    captionStyle: "Bold TikTok captions",
    musicMode: "Use free music library",
    musicAssetId: FREE_MUSIC_LIBRARY[0]?.id || "",
    musicName: FREE_MUSIC_LIBRARY[0]?.title || "",
    musicUri: FREE_MUSIC_LIBRARY[0]?.uri || "",
  };
}

export function GuidedSetupWizard({
  goal,
  setupState,
  hasGeneratedDraft,
  onSetupStateChange,
  onRegisterAssetFiles,
  studioVideoFiles = [],
  onOpenStudioBuilder,
  onGenerateDraft,
  onOpenStudio,
  onOpenSaveSetup,
}: GuidedSetupWizardProps) {
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState<(typeof wizardSteps)[number]["id"]>("assets");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStepIndex, setGenerationStepIndex] = useState(-1);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneDescription, setCloneDescription] = useState("");
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const cloneFileInputRef = useRef<HTMLInputElement | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceRecorderStreamRef = useRef<MediaStream | null>(null);
  const voiceRecorderChunksRef = useRef<Blob[]>([]);
  const voicesQuery = useQuery<ElevenLabsVoice[]>({ queryKey: ["/api/elevenlabs/voices"] });
  const elModelsQuery = useQuery<ElevenLabsModel[]>({ queryKey: ["/api/elevenlabs/models"] });

  const slotVideos = setupState.shotSlots.flatMap((slot) => slot.file ? [slot.file] : []);
  const rawVideos = useMemo(() => {
    const videoMap = new Map<string, File>();
    [...studioVideoFiles, ...slotVideos].forEach((file) => {
      videoMap.set(`${file.name}-${file.size}-${file.lastModified}`, file);
    });
    return Array.from(videoMap.values());
  }, [slotVideos, studioVideoFiles]);
  const editedShotCount = setupState.shotSlots.filter((slot) => slot.file && slot.edited).length;
  const canGenerate = rawVideos.length > 0 && !!setupState.productPhoto && setupState.productName.trim().length > 0;
  const totalAssetSize = useMemo(
    () => rawVideos.reduce((sum, file) => sum + file.size, 0) + (setupState.productPhoto?.size || 0),
    [setupState.productPhoto, rawVideos],
  );
  const selectedVoice = useMemo(
    () => voicesQuery.data?.find((voice) => voice.voice_id === setupState.voiceId),
    [setupState.voiceId, voicesQuery.data],
  );
  const filteredVoices = useMemo(() => {
    const query = voiceSearch.trim().toLowerCase();
    return (voicesQuery.data || []).filter((voice) => !query || voice.name.toLowerCase().includes(query));
  }, [voiceSearch, voicesQuery.data]);
  const cloneFilePreviews = useMemo(
    () => cloneFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [cloneFiles],
  );

  useEffect(() => {
    return () => {
      cloneFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [cloneFilePreviews]);

  useEffect(() => {
    return () => {
      voicePreviewAudioRef.current?.pause();
      voicePreviewAudioRef.current = null;
    };
  }, []);

  const updateState = (patch: Partial<GuidedSetupState>) => {
    onSetupStateChange({ ...setupState, ...patch });
  };

  const buildDraft = (): GuidedSetupDraft => ({
    goal,
    productName: setupState.productName.trim(),
    productPhoto: setupState.productPhoto,
    rawVideos,
    productNotes: setupState.productNotes,
    style: setupState.style,
    duration: setupState.duration,
    platform: setupState.platform,
    voiceMode: setupState.voiceMode,
    voiceId: setupState.voiceId,
    voiceName: setupState.voiceName,
    elevenlabsModel: setupState.elevenlabsModel,
    captionStyle: setupState.captionStyle,
    musicMode: setupState.musicMode,
    musicAssetId: setupState.musicAssetId,
    musicName: setupState.musicName,
    musicUri: setupState.musicUri,
  });

  const handleVoiceSelect = (voiceId: string) => {
    const selectedVoice = voicesQuery.data?.find((voice) => voice.voice_id === voiceId);
    updateState({
      voiceId,
      voiceName: selectedVoice ? `${selectedVoice.name} (${selectedVoice.category})` : voiceId,
      voiceMode: "AI voiceover",
    });
  };

  const stopVoicePreview = () => {
    voicePreviewAudioRef.current?.pause();
    voicePreviewAudioRef.current = null;
    setPreviewingVoiceId(null);
  };

  const addCloneFiles = (files: File[]) => {
    if (!files.length) return;
    setCloneFiles((currentFiles) => {
      const nextFiles = [...currentFiles, ...files].slice(0, 5);
      if (currentFiles.length + files.length > 5) {
        toast({ title: "Sample limit reached", description: "ElevenLabs clone upload is limited to 5 samples at a time." });
      }
      return nextFiles;
    });
  };

  const handleCloneFileUpload = (files: FileList | null) => {
    addCloneFiles(Array.from(files || []));
  };

  const handleStartVoiceRecording = async () => {
    if (isRecordingVoice || isCloningVoice) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const preferredMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, preferredMimeType ? { mimeType: preferredMimeType } : undefined);

      voiceRecorderChunksRef.current = [];
      voiceRecorderStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceRecorderChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (!voiceRecorderChunksRef.current.length) {
          voiceRecorderStreamRef.current?.getTracks().forEach((track) => track.stop());
          voiceRecorderStreamRef.current = null;
          voiceRecorderRef.current = null;
          setIsRecordingVoice(false);
          return;
        }
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("mp4") ? "m4a" : "webm";
        const recording = new File(
          voiceRecorderChunksRef.current,
          `mic-voice-sample-${Date.now()}.${extension}`,
          { type: mimeType },
        );
        addCloneFiles([recording]);
        voiceRecorderChunksRef.current = [];
        voiceRecorderStreamRef.current?.getTracks().forEach((track) => track.stop());
        voiceRecorderStreamRef.current = null;
        voiceRecorderRef.current = null;
        setIsRecordingVoice(false);
      };
      recorder.start();
      setIsRecordingVoice(true);
    } catch (error: any) {
      toast({
        title: "Mic recording failed",
        description: error.message || "Please allow microphone access and try again.",
        variant: "destructive",
      });
    }
  };

  const handleStopVoiceRecording = () => {
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== "inactive") {
      voiceRecorderRef.current.stop();
    }
  };

  const cloneVoiceName = cloneName.trim() || cloneDescription.trim();
  const cloneVoiceDescription = cloneName.trim() ? cloneDescription.trim() : "";

  const handlePreviewVoice = async (voice: ElevenLabsVoice) => {
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
      voicePreviewAudioRef.current = audio;
      setPreviewingVoiceId(voice.voice_id);
      audio.onended = () => setPreviewingVoiceId(null);
      audio.onerror = () => {
        setPreviewingVoiceId(null);
        toast({ title: "Voice preview failed", description: "The ElevenLabs sample could not be played.", variant: "destructive" });
      };
      await audio.play();
    } catch (error: any) {
      setPreviewingVoiceId(null);
      toast({ title: "Voice preview failed", description: error.message || "The ElevenLabs sample could not be played.", variant: "destructive" });
    }
  };

  const handleCloneVoice = async () => {
    if (!cloneVoiceName || !cloneFiles.length || isCloningVoice) return;
    setIsCloningVoice(true);
    try {
      const formData = new FormData();
      formData.append("name", cloneVoiceName);
      if (cloneVoiceDescription) formData.append("description", cloneVoiceDescription);
      cloneFiles.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/elevenlabs/voices/clone", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to clone voice");
      }

      const clonedVoice = await response.json() as { voice_id?: string; name?: string };
      await voicesQuery.refetch();
      if (clonedVoice.voice_id) {
        updateState({
          voiceId: clonedVoice.voice_id,
          voiceName: clonedVoice.name || cloneVoiceName,
          voiceMode: "AI voiceover",
        });
      }
      setCloneName("");
      setCloneDescription("");
      setCloneFiles([]);
      if (cloneFileInputRef.current) cloneFileInputRef.current.value = "";
      toast({ title: "Voice cloned", description: "Your new ElevenLabs voice is ready to use." });
    } catch (error: any) {
      toast({ title: "Voice clone failed", description: error.message || "Please check your sample files and ElevenLabs plan.", variant: "destructive" });
    } finally {
      setIsCloningVoice(false);
    }
  };

  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return;
    setIsGenerating(true);
    setGenerationComplete(false);
    setGenerationProgress(0);
    setGenerationStepIndex(0);
    const stepDelayMs = 220;

    aiProductionSteps.forEach((_, index) => {
      window.setTimeout(() => {
        setGenerationStepIndex(index);
        setGenerationProgress(Math.round(((index + 1) / aiProductionSteps.length) * 100));
      }, index * stepDelayMs);
    });

    window.setTimeout(() => {
      onGenerateDraft(buildDraft());
      setIsGenerating(false);
      setGenerationComplete(true);
      setGenerationStepIndex(aiProductionSteps.length - 1);
      setGenerationProgress(100);
    }, aiProductionSteps.length * stepDelayMs + 250);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Setup</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">{goal.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload, pick a style, generate.
            </p>
          </div>
          {hasGeneratedDraft && (
            <Button variant="outline" className="gap-2" onClick={onOpenStudio}>
              Open Studio Timeline
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {wizardSteps.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                  isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeStep === "assets" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="rounded-lg border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Upload assets</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guided-product-name">Product</Label>
                <Input
                  id="guided-product-name"
                  value={setupState.productName}
                  onChange={(event) => updateState({ productName: event.target.value })}
                  placeholder="e.g. Rechargeable LED desk lamp"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="space-y-3">
                  <div>
                    <Label>Videos</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Open Studio, upload multiple clips, trim/edit, then generate from those clips.
                    </p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Studio Video Builder</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {rawVideos.length ? `${rawVideos.length} video clip${rawVideos.length === 1 ? "" : "s"} ready for Generate.` : "No clips yet."}
                        </p>
                      </div>
                      <Button type="button" className="gap-2" onClick={onOpenStudioBuilder}>
                        <Clapperboard className="h-4 w-4" />
                        Open Studio Builder
                      </Button>
                    </div>
                    {rawVideos.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {rawVideos.slice(0, 6).map((file) => (
                          <div key={`${file.name}-${file.size}-${file.lastModified}`} className="truncate rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            {file.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guided-product-photo">Photo</Label>
                  <input
                    id="guided-product-photo"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file) onRegisterAssetFiles?.([file]);
                      updateState({ productPhoto: file });
                    }}
                    className="sr-only"
                  />
                  <label
                    htmlFor="guided-product-photo"
                    className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-white/[0.03] px-4 py-5 text-center transition hover:border-primary/60 hover:bg-white/[0.06]"
                  >
                    <Image className="h-6 w-6 text-primary" />
                    <span className="text-sm font-medium">{setupState.productPhoto ? "Replace photo" : "Upload photo"}</span>
                    <span className="max-w-48 truncate text-xs text-muted-foreground">
                      {setupState.productPhoto?.name || "Product image"}
                    </span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guided-notes">Notes</Label>
                <Textarea
                  id="guided-notes"
                  value={setupState.productNotes}
                  onChange={(event) => updateState({ productNotes: event.target.value })}
                  rows={3}
                  placeholder="Benefits, offer, CTA, target buyer..."
                />
              </div>
            </div>
          </div>

          <AssetSummary
            rawVideos={rawVideos}
            productPhoto={setupState.productPhoto}
            totalAssetSize={totalAssetSize}
            editedShotCount={editedShotCount}
          />
        </div>
      )}

      {activeStep === "style" && (
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">2. Choose Style, Duration, And Specs</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <OptionGroup label="Style" value={setupState.style} options={styleOptions} onChange={(style) => updateState({ style })} />
            <OptionGroup label="Platform" value={setupState.platform} options={platformOptions} onChange={(platform) => updateState({ platform })} />
            <OptionGroup label="Voice" value={setupState.voiceMode} options={voiceOptions} onChange={(voiceMode) => updateState({ voiceMode })} icon={AudioLines} />
            <OptionGroup label="Captions" value={setupState.captionStyle} options={captionOptions} onChange={(captionStyle) => updateState({ captionStyle })} icon={Captions} />
            <div className="space-y-3">
              <OptionGroup
                label="Music"
                value={setupState.musicMode}
                options={musicOptions}
                onChange={(musicMode) => {
                  const fallbackTrack = FREE_MUSIC_LIBRARY[0];
                  updateState({
                    musicMode,
                    ...(musicMode === "Use free music library" && fallbackTrack ? {
                      musicAssetId: setupState.musicAssetId || fallbackTrack.id,
                      musicName: setupState.musicName || fallbackTrack.title,
                      musicUri: setupState.musicUri || fallbackTrack.uri,
                    } : {}),
                  });
                }}
                icon={Music}
              />
              {setupState.musicMode === "Use free music library" && (
                <div className="rounded-md border bg-background p-3">
                  <Label>Free music track</Label>
                  <div className="mt-2 grid gap-2">
                    {FREE_MUSIC_LIBRARY.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => updateState({ musicAssetId: track.id, musicName: track.title, musicUri: track.uri })}
                        className={`rounded-md border px-3 py-2 text-left text-sm ${
                          setupState.musicAssetId === track.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                        }`}
                      >
                        <span className="block font-medium">{track.title}</span>
                        <span className="block text-xs text-muted-foreground">{track.mood}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {setupState.musicMode === "Use uploaded asset music" && (
                <p className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                  Upload music in Assets or with the Add Music button in Studio. Buzzly will keep it reusable for future setup activations.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {durationOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateState({ duration: option })}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      setupState.duration === option ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    {option}s
                  </button>
                ))}
              </div>
            </div>
            {setupState.voiceMode === "AI voiceover" && (
              <div className="space-y-4 rounded-lg border bg-background p-4 md:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Label className="flex items-center gap-2">
                      <AudioLines className="h-4 w-4 text-primary" />
                      ElevenLabs Voice
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose default ElevenLabs voices, saved voices, or cloned voices from the connected ElevenLabs account.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      void voicesQuery.refetch();
                      void elModelsQuery.refetch();
                    }}
                    disabled={voicesQuery.isFetching || elModelsQuery.isFetching}
                  >
                    {voicesQuery.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Refresh
                  </Button>
                </div>

                {voicesQuery.isError && (
                  <p className="rounded-md border border-amber-300/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    ElevenLabs voices could not load. Check `ELEVENLABS_API_KEY` on the server.
                  </p>
                )}

                <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="guided-voice-search">Voice</Label>
                    <Input
                      id="guided-voice-search"
                      value={voiceSearch}
                      onChange={(event) => setVoiceSearch(event.target.value)}
                      placeholder={voicesQuery.isLoading ? "Loading voices..." : "Search voice name..."}
                      disabled={voicesQuery.isLoading || !voicesQuery.data?.length}
                    />
                    {selectedVoice && (
                      <p className="text-xs text-muted-foreground">
                        Selected: <span className="font-medium text-foreground">{selectedVoice.name}</span> ({selectedVoice.category})
                      </p>
                    )}
                    <div className="max-h-48 overflow-auto rounded-md border bg-background">
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
                        const isSelected = voice.voice_id === setupState.voiceId;
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
                              disabled={!voice.preview_url && !isPreviewing}
                              title={voice.preview_url ? "Preview voice" : "Preview not available"}
                            >
                              {isPreviewing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                              {isPreviewing ? "Stop" : voice.preview_url ? "Preview" : "No preview"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Voice Model</Label>
                    <Select value={setupState.elevenlabsModel} onValueChange={(elevenlabsModel) => updateState({ elevenlabsModel })} disabled={elModelsQuery.isLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={elModelsQuery.isLoading ? "Loading models..." : "Select model..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {elModelsQuery.data?.map((model) => (
                          <SelectItem key={model.model_id} value={model.model_id}>
                            {model.name}
                          </SelectItem>
                        ))}
                        {!elModelsQuery.data?.length && (
                          <>
                            <SelectItem value="eleven_turbo_v2_5">Eleven Turbo v2.5</SelectItem>
                            <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-md border bg-card p-3">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Clone your own voice</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Record 30-60 seconds from your mic or upload audio/video. The server extracts and cleans the voice before creating it in ElevenLabs.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                    <div className="space-y-1">
                      <Label className="text-xs">Voice name</Label>
                      <Input value={cloneName} onChange={(event) => setCloneName(event.target.value)} placeholder="e.g. Jolie Creator Voice" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description optional</Label>
                      <Input value={cloneDescription} onChange={(event) => setCloneDescription(event.target.value)} placeholder="Language, tone, or use case" />
                    </div>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <Button
                        type="button"
                        variant={isRecordingVoice ? "destructive" : "outline"}
                        className="gap-2"
                        onClick={isRecordingVoice ? handleStopVoiceRecording : handleStartVoiceRecording}
                        disabled={isCloningVoice}
                      >
                        {isRecordingVoice ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {isRecordingVoice ? "Stop recording" : "Record voice"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => cloneFileInputRef.current?.click()}
                        disabled={isCloningVoice}
                      >
                        <Upload className="h-4 w-4" />
                        Upload sample
                      </Button>
                      <Input
                        ref={cloneFileInputRef}
                        type="file"
                        accept="audio/*,video/*"
                        multiple
                        onChange={(event) => {
                          handleCloneFileUpload(event.target.files);
                          event.target.value = "";
                        }}
                        className="sr-only"
                      />
                    </div>
                  </div>
                  {cloneFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {cloneFilePreviews.map(({ file, url }, index) => (
                        <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{file.name}</p>
                            <p className="text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                            <audio controls src={url} className="mt-2 h-8 w-full max-w-xl" />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setCloneFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}
                            disabled={isCloningVoice}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 gap-2"
                    onClick={handleCloneVoice}
                    disabled={!cloneVoiceName || !cloneFiles.length || isCloningVoice || isRecordingVoice}
                  >
                    {isCloningVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" />}
                    {isCloningVoice ? "Creating voice..." : "Clone voice"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeStep === "generate" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Generate Preview</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Buzzly creates an editable Studio draft first. Final rendering happens later, after review.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Analyze product",
                "Score clips",
                "Write script",
                "Create voice over",
                "Build B-roll",
                "Arrange timeline",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            {generationComplete && (
              <div className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                Project successfully generated. Your editable draft is ready in Studio.
              </div>
            )}
            {!canGenerate && (
              <p className="mt-4 rounded-md border border-amber-300/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                Add product name, at least one raw video, and one product photo before generating.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={generationComplete ? onOpenStudio : handleGenerate} disabled={!canGenerate || isGenerating} className="gap-2">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : generationComplete ? <ChevronRight className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating ? "Generating preview..." : generationComplete ? "Open Studio" : "Generate Preview"}
              </Button>
              {generationComplete && (
                <Button variant="outline" onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              )}
            </div>
          </div>

          <aside className="rounded-lg border bg-card p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold">AI Production Status</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Draft only. No final render yet.
              </p>
            </div>
            <div className="space-y-2">
              {aiProductionSteps.map((step, index) => {
                const isDone = generationComplete || (isGenerating && index < generationStepIndex);
                const isActive = isGenerating && index === generationStepIndex;
                return (
                  <div key={step} className="flex items-center gap-2 text-sm">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                    )}
                    <span className={isDone || isActive ? "text-foreground" : "text-muted-foreground"}>{step}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${generationProgress}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress: {generationProgress}%</span>
                <span>{generationComplete ? "Ready" : isGenerating ? "Few seconds" : "Waiting"}</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeStep === "review" && (
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold">4. Review In Studio, Then Save Setup</h3>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Buzzly has organized the draft into video, AI B-roll, captions, voiceover, and music tracks.
            Open the Studio timeline to edit the cut. When the user is happy, save the recipe as a reusable setup.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={onOpenStudio} className="gap-2" disabled={!hasGeneratedDraft}>
              Open Studio Timeline
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={onOpenSaveSetup}>
              Continue to Save Setup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetSummary({
  rawVideos,
  productPhoto,
  totalAssetSize,
  editedShotCount,
}: {
  rawVideos: File[];
  productPhoto: File | null;
  totalAssetSize: number;
  editedShotCount: number;
}) {
  return (
    <aside className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Image className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">AI Input Summary</h3>
      </div>
      <div className="space-y-3 text-sm">
        <SummaryRow label="Raw videos" value={`${rawVideos.length} file${rawVideos.length === 1 ? "" : "s"}`} ready={rawVideos.length > 0} />
        <SummaryRow label="Edited shots" value={`${editedShotCount}/10`} ready={editedShotCount > 0} />
        <SummaryRow label="Product photo" value={productPhoto?.name || "Missing"} ready={!!productPhoto} />
        <SummaryRow label="Total size" value={`${(totalAssetSize / 1024 / 1024).toFixed(1)} MB`} ready={totalAssetSize > 0} />
      </div>
      {rawVideos.length > 0 && (
        <div className="mt-4 space-y-2">
          {rawVideos.slice(0, 5).map((file) => (
            <div key={`${file.name}-${file.size}`} className="truncate rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {file.name}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function SummaryRow({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={ready ? "font-medium text-foreground" : "font-medium text-amber-600 dark:text-amber-300"}>{value}</span>
    </div>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </Label>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
              value === option ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
