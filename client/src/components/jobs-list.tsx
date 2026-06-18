import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  Share2,
  FileText,
  Copy,
  Check,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  AudioLines,
  Film,
  FileAudio,
  ChevronDown,
  ChevronUp,
  Play,
  Trash2,
  Eye,
  X,
  Square,
  Sparkles,
  MessageSquare,
  Hash,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sanitizeNarrationScript } from "@shared/script-cleaner";

type JobWithAsset = {
  id: number;
  assetId: number;
  status: string;
  scriptText: string | null;
  headlineText: string | null;
  captionText: string | null;
  seoText: string | null;
  audioRawKey: string | null;
  audioCleanKey: string | null;
  finalVideoKey: string | null;
  shareEnabled: boolean;
  shareToken: string | null;
  shareRevokedAt: string | null;
  tiktokPublishId: string | null;
  tiktokPublishStatus: string | null;
  tiktokPublishError: string | null;
  tiktokPrivacyLevel: string | null;
  tiktokPostMode: string | null;
  tiktokOpenId: string | null;
  tiktokCreatorUsername: string | null;
  tiktokCreatorNickname: string | null;
  tiktokAccessTokenFingerprint: string | null;
  tiktokInitResponse: Record<string, unknown> | null;
  tiktokStatusResponse: Record<string, unknown> | null;
  tiktokCreatorInfo: Record<string, unknown> | null;
  logs: string;
  createdAt: string;
  assetName?: string;
};

type DownloadState = {
  status: "downloading" | "complete" | "error";
  progress: number;
  label: string;
};

type TikTokStatus = {
  connected: boolean;
  configured: boolean;
  hasClientKey?: boolean;
  hasClientSecret?: boolean;
  openId?: string | null;
  scope?: string | null;
  creatorUsername?: string | null;
  creatorNickname?: string | null;
  accessTokenFingerprint?: string | null;
  privacyLevelOptions?: string[] | null;
  creatorInfo?: Record<string, unknown> | null;
  creatorInfoError?: Record<string, unknown> | null;
};

type TikTokJobStatusResult = {
  status: "PROCESSING" | "PUBLISHED" | "FAILED" | "REJECTED" | "UNKNOWN";
  tiktokStatus?: string | null;
  failReason?: string | null;
  error?: string | null;
  publishId?: string | null;
  openId?: string | null;
  accessTokenFingerprint?: string | null;
  raw?: Record<string, unknown> | null;
  statusResponse?: Record<string, unknown> | null;
  checkedAt?: string;
};

const TIKTOK_TERMINAL_STATUSES = new Set<TikTokJobStatusResult["status"]>(["PUBLISHED", "FAILED", "REJECTED"]);

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; progress: number }> = {
  queued: { label: "Queued", color: "secondary", icon: Clock, progress: 5 },
  building_video: { label: "Building Video", color: "secondary", icon: Film, progress: 10 },
  generating_script: { label: "Generating Script", color: "secondary", icon: FileText, progress: 20 },
  generating_audio: { label: "Generating Audio", color: "secondary", icon: AudioLines, progress: 40 },
  cutting_dead_air: { label: "Cutting Dead Air", color: "secondary", icon: FileAudio, progress: 60 },
  rendering: { label: "Rendering Video", color: "secondary", icon: Film, progress: 80 },
  done: { label: "Done", color: "default", icon: CheckCircle2, progress: 100 },
  failed: { label: "Failed", color: "destructive", icon: AlertCircle, progress: 0 },
  stopped: { label: "Stopped", color: "outline", icon: Square, progress: 0 },
};

function AudioPlayer({ jobId, type, label }: { jobId: number; type: "raw" | "clean"; label: string }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAudio = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = type === "raw"
        ? `/api/jobs/${jobId}/preview-audio-raw`
        : `/api/jobs/${jobId}/preview-audio-clean`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to load audio");
      const data = await res.json();
      setAudioUrl(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="text-xs text-destructive">{error}</div>
    );
  }

  if (!audioUrl) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={loadAudio}
        disabled={loading}
        data-testid={`button-play-${type}-${jobId}`}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <audio controls className="w-full h-8" data-testid={`audio-${type}-${jobId}`}>
        <source src={audioUrl} type="audio/mpeg" />
      </audio>
    </div>
  );
}

function VideoPreview({ jobId }: { jobId: number }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const openPreview = async () => {
    if (videoUrl) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/preview`);
      if (!res.ok) throw new Error("Failed to load preview");
      const data = await res.json();
      setVideoUrl(data.url);
      setOpen(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <span className="text-xs text-destructive">{error}</span>;
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={openPreview}
        disabled={loading}
        data-testid={`button-preview-${jobId}`}
        className="gap-1.5 max-sm:w-full"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        Preview
      </Button>
      {open && videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
          data-testid={`modal-preview-${jobId}`}
        >
          <div
            className="relative bg-background rounded-lg shadow-lg max-w-3xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10"
              onClick={() => setOpen(false)}
              data-testid={`button-close-preview-${jobId}`}
            >
              <X className="w-5 h-5" />
            </Button>
            <div className="p-4">
              <video
                key={videoUrl}
                controls
                preload="metadata"
                className="w-full rounded"
                data-testid={`video-preview-${jobId}`}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CopyTextButton({ text, label, jobId, field }: { text: string; label: string; jobId: number; field: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          if (!successful) throw new Error("execCommand copy failed");
        } catch (err) {
          console.error('Fallback copy failed', err);
          throw err;
        } finally {
          document.body.removeChild(textArea);
        }
      }
      setCopied(true);
      toast({ title: "Copied!", description: `${label} copied to clipboard.` });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleCopy}
      data-testid={`button-copy-${field}-${jobId}`}
      className="gap-1.5"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : `Copy ${label}`}
    </Button>
  );
}

export function JobsList() {
  const { toast } = useToast();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingTikTokJob, setPendingTikTokJob] = useState<JobWithAsset | null>(null);
  const [tiktokCaption, setTikTokCaption] = useState("");
  const [visibleTikTokRawJobs, setVisibleTikTokRawJobs] = useState<Set<number>>(new Set());
  const [autoPollingTikTokJobs, setAutoPollingTikTokJobs] = useState<Set<number>>(new Set());
  const [tiktokPublishStatus, setTikTokPublishStatus] = useState<{
    state: "idle" | "sending" | "success" | "error";
    message?: string;
    publishId?: string;
    raw?: Record<string, unknown> | null;
  }>({ state: "idle" });
  const [tiktokStatusResults, setTikTokStatusResults] = useState<Record<number, TikTokJobStatusResult>>({});
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});
  const [autoDownload, setAutoDownload] = useState(() => localStorage.getItem("buzzly.autoDownloadJobs") === "true");
  const autoDownloadedJobsRef = useRef<Set<number>>(new Set());
  const activeTikTokPollsRef = useRef<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTikTokRaw = (id: number) => {
    setVisibleTikTokRawJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const jobsQuery = useQuery<JobWithAsset[]>({
    queryKey: ["/api/jobs"],
    refetchInterval: 3000,
  });

  const tiktokStatusQuery = useQuery<TikTokStatus>({
    queryKey: ["/api/tiktok/status"],
  });

  const hasActiveJobs = jobsQuery.data?.some(
    (j) => !["done", "failed", "stopped"].includes(j.status)
  );

  const downloadKey = (jobId: number, type: "final" | "raw" | "clean") => `${jobId}:${type}`;

  const filenameFromDisposition = (value: string | null, fallback: string) => {
    const match = value?.match(/filename="?([^";]+)"?/i);
    return match?.[1] || fallback;
  };

  const handleDownload = async (jobId: number, type: "final" | "raw" | "clean") => {
    const endpoint = type === "final"
      ? `/api/jobs/${jobId}/download`
      : type === "raw"
      ? `/api/jobs/${jobId}/download-audio-raw`
      : `/api/jobs/${jobId}/download-audio-clean`;
    const key = downloadKey(jobId, type);
    const fallbackFilename = type === "final" ? `job-${jobId}-final.mp4` : `job-${jobId}-${type}.mp3`;

    setDownloadStates((current) => ({
      ...current,
      [key]: { status: "downloading", progress: 1, label: "Starting download..." },
    }));

    try {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);

      const total = Number(res.headers.get("content-length") || 0);
      const filename = filenameFromDisposition(res.headers.get("content-disposition"), fallbackFilename);
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.length;
            const progress = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 50;
            const mbLoaded = (loaded / 1024 / 1024).toFixed(1);
            const mbTotal = total > 0 ? ` / ${(total / 1024 / 1024).toFixed(1)} MB` : " MB";
            setDownloadStates((current) => ({
              ...current,
              [key]: {
                status: "downloading",
                progress,
                label: `Downloading ${mbLoaded}${mbTotal}`,
              },
            }));
          }
        }
      } else {
        chunks.push(new Uint8Array(await res.arrayBuffer()));
      }

      const blob = new Blob(chunks, { type: res.headers.get("content-type") || (type === "final" ? "video/mp4" : "audio/mpeg") });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      setDownloadStates((current) => ({
        ...current,
        [key]: { status: "complete", progress: 100, label: "Download complete" },
      }));
      toast({ title: "Download complete", description: `${filename} is ready on this device.` });
      setTimeout(() => {
        setDownloadStates((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }, 5000);
    } catch (err: any) {
      setDownloadStates((current) => ({
        ...current,
        [key]: { status: "error", progress: 100, label: err.message || "Download failed" },
      }));
      toast({ title: "Download failed", description: err.message || "Please try again.", variant: "destructive" });
    }
  };

  useEffect(() => {
    localStorage.setItem("buzzly.autoDownloadJobs", autoDownload ? "true" : "false");
  }, [autoDownload]);

  useEffect(() => {
    if (!autoDownload || !jobsQuery.data?.length) return;
    for (const job of jobsQuery.data) {
      if (job.status !== "done" || !job.finalVideoKey || autoDownloadedJobsRef.current.has(job.id)) continue;
      autoDownloadedJobsRef.current.add(job.id);
      handleDownload(job.id, "final");
      toast({ title: "Auto download", description: `Job #${job.id} video is downloading.` });
    }
  }, [autoDownload, jobsQuery.data, toast]);

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      await apiRequest("DELETE", `/api/jobs/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Deleted", description: "Job has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stopJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/stop`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job stopped", description: "The job will exit at the next processing checkpoint." });
    },
    onError: (err: Error) => {
      toast({ title: "Stop failed", description: err.message, variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/jobs");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowClearConfirm(false);
      toast({ title: "All jobs cleared", description: `${data.deleted} job${data.deleted !== 1 ? "s" : ""} removed.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/share`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Share Error", description: err.message, variant: "destructive" });
    },
  });

  const socialMediaCaption = (job: JobWithAsset) => job.captionText?.trim() || "";

  const checkTikTokStatus = async (jobId: number, options?: { silent?: boolean }): Promise<TikTokJobStatusResult | null> => {
    if (activeTikTokPollsRef.current.has(jobId)) return null;
    activeTikTokPollsRef.current.add(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tiktok/status`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      const result = {
        ...(data as TikTokJobStatusResult),
        checkedAt: new Date().toISOString(),
      };
      if (!res.ok) {
        const err = new Error(data.error || `TikTok status check failed (${res.status})`) as Error & { payload?: any; jobId?: number };
        err.payload = result;
        err.jobId = jobId;
        throw err;
      }
      setTikTokStatusResults((current) => ({ ...current, [jobId]: result }));
      if (TIKTOK_TERMINAL_STATUSES.has(result.status)) {
        setAutoPollingTikTokJobs((current) => {
          const next = new Set(current);
          next.delete(jobId);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      if (!options?.silent) {
        toast({ title: "TikTok status checked", description: `Status: ${result.status}` });
      }
      return result;
    } catch (err: any) {
      if (err.jobId) {
        setTikTokStatusResults((current) => ({
          ...current,
          [err.jobId!]: {
            status: err.payload?.status || "UNKNOWN",
            error: err.message,
            publishId: err.payload?.publishId || null,
            openId: err.payload?.openId || null,
            accessTokenFingerprint: err.payload?.accessTokenFingerprint || null,
            raw: err.payload?.raw || null,
            statusResponse: err.payload?.statusResponse || null,
            checkedAt: new Date().toISOString(),
          },
        }));
      }
      if (!options?.silent) {
        toast({ title: "TikTok status failed", description: err.message, variant: "destructive" });
      }
      return null;
    } finally {
      activeTikTokPollsRef.current.delete(jobId);
    }
  };

  const publishTikTokMutation = useMutation({
    mutationFn: async ({ job, title }: { job: JobWithAsset; title: string }) => {
      setTikTokPublishStatus({
        state: "sending",
        message: "Uploading the final video to TikTok. Keep this dialog open until it finishes.",
      });
      const res = await fetch(`/api/jobs/${job.id}/tiktok/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          privacyLevel: "SELF_ONLY",
          brandContentToggle: false,
          brandOrganicToggle: true,
          isAigc: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || `TikTok publish failed (${res.status})`) as Error & { payload?: any };
        err.payload = data;
        throw err;
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setTikTokPublishStatus({
        state: "success",
        message: "TikTok accepted the upload into its publish queue. It may take a moment before it appears in the TikTok app.",
        publishId: data.publishId,
        raw: data.raw || data.initResponse || null,
      });
      if (pendingTikTokJob) {
        const postedJobId = pendingTikTokJob.id;
        setTikTokStatusResults((current) => ({
          ...current,
          [postedJobId]: {
            status: data.status || "PROCESSING",
            publishId: data.publishId,
            openId: data.openId,
            accessTokenFingerprint: data.accessTokenFingerprint,
            raw: data.raw || null,
            statusResponse: data.initResponse || null,
            checkedAt: new Date().toISOString(),
          },
        }));
        setAutoPollingTikTokJobs((current) => new Set(current).add(postedJobId));
        window.setTimeout(() => {
          checkTikTokStatus(postedJobId, { silent: true });
        }, 1500);
      }
      toast({
        title: "TikTok upload accepted",
        description: `Publish ID: ${data.publishId}. Auto-checking status every 10 seconds.`,
      });
    },
    onError: (err: Error & { payload?: any }) => {
      setTikTokPublishStatus({
        state: "error",
        message: err.message,
        raw: err.payload?.raw || err.payload?.details || null,
      });
      toast({ title: "TikTok publish failed", description: err.message, variant: "destructive" });
    },
  });

  const checkTikTokStatusMutation = useMutation<
    { jobId: number; data: TikTokJobStatusResult | null },
    Error,
    number
  >({
    mutationFn: async (jobId: number) => {
      const data = await checkTikTokStatus(jobId);
      return { jobId, data };
    },
    onSuccess: ({ jobId, data }) => {
      if (data) setTikTokStatusResults((current) => ({ ...current, [jobId]: data }));
    },
  });

  const handleTikTokPublish = (job: JobWithAsset) => {
    if (!tiktokStatusQuery.data?.connected) {
      window.location.href = "/api/auth/tiktok";
      return;
    }
    if (!socialMediaCaption(job)) {
      toast({
        title: "No Social Media Caption",
        description: "Generate a Social Media Caption first before posting to TikTok.",
        variant: "destructive",
      });
      return;
    }
    setPendingTikTokJob(job);
    setTikTokCaption(socialMediaCaption(job));
    setTikTokPublishStatus({ state: "idle" });
  };

  useEffect(() => {
    if (!jobsQuery.data?.length) return;
    setAutoPollingTikTokJobs((current) => {
      const next = new Set(current);
      let changed = false;
      for (const job of jobsQuery.data) {
        const liveStatus = tiktokStatusResults[job.id]?.status;
        const status = (liveStatus || job.tiktokPublishStatus || (job.tiktokPublishId ? "PROCESSING" : null)) as TikTokJobStatusResult["status"] | null;
        if (job.tiktokPublishId && (!status || !TIKTOK_TERMINAL_STATUSES.has(status)) && !next.has(job.id)) {
          next.add(job.id);
          changed = true;
        }
        if (status && TIKTOK_TERMINAL_STATUSES.has(status) && next.has(job.id)) {
          next.delete(job.id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [jobsQuery.data, tiktokStatusResults]);

  useEffect(() => {
    if (!autoPollingTikTokJobs.size) return;
    const intervalId = window.setInterval(() => {
      for (const jobId of Array.from(autoPollingTikTokJobs)) {
        checkTikTokStatus(jobId, { silent: true });
      }
    }, 10_000);
    return () => window.clearInterval(intervalId);
  }, [autoPollingTikTokJobs]);

  const copyShareLink = async (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedToken(token);
      toast({ title: "Copied", description: "Share link copied to clipboard." });
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
    }
  };

  if (jobsQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!jobsQuery.data?.length) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2" data-testid="text-no-jobs">No jobs yet</h3>
            <p className="text-sm text-muted-foreground">
              Activate a setup to start producing videos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl min-w-0 space-y-4 overflow-x-clip">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Production Jobs</h2>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="col-span-2 flex items-center justify-between gap-2 rounded-md border px-3 py-2 sm:col-span-1 sm:justify-start sm:px-2 sm:py-1">
            <Label htmlFor="auto-download-jobs" className="text-xs text-muted-foreground">
              Auto Download
            </Label>
            <Switch
              id="auto-download-jobs"
              checked={autoDownload}
              onCheckedChange={setAutoDownload}
              data-testid="switch-auto-download"
            />
          </div>
          {hasActiveJobs && (
            <Badge variant="secondary" className="justify-center animate-pulse">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Processing
            </Badge>
          )}
          <Badge variant="secondary" className="justify-center">{jobsQuery.data.length} job{jobsQuery.data.length !== 1 ? "s" : ""}</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            disabled={clearAllMutation.isPending}
            data-testid="button-clear-all-jobs"
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </Button>
        </div>
      </div>

      {jobsQuery.data.map((job) => {
        const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
        const StatusIcon = config.icon;
        const isActive = !["done", "failed", "stopped"].includes(job.status);
        const isExpanded = expandedJobs.has(job.id);
        const hasContent = job.scriptText || job.headlineText || job.captionText || job.seoText || job.audioRawKey || job.audioCleanKey || job.logs;
        const finalDownloadState = downloadStates[downloadKey(job.id, "final")];
        const liveTikTokStatus = tiktokStatusResults[job.id];
        const displayedTikTokStatus = liveTikTokStatus?.status || job.tiktokPublishStatus || (job.tiktokPublishId ? "PROCESSING" : null);
        const displayedTikTokError = liveTikTokStatus?.failReason || liveTikTokStatus?.error || job.tiktokPublishError;
        const displayedTikTokStatusResponse = liveTikTokStatus?.statusResponse || job.tiktokStatusResponse || null;
        const displayedTikTokRaw = displayedTikTokStatusResponse || liveTikTokStatus?.raw || job.tiktokInitResponse;
        const rawStatusPayload = displayedTikTokStatusResponse as any;
        const rawStatusValue = rawStatusPayload?.data?.status || liveTikTokStatus?.tiktokStatus || displayedTikTokStatus || "UNKNOWN";
        const rawFailReason = rawStatusPayload?.data?.fail_reason || liveTikTokStatus?.failReason || displayedTikTokError || null;
        const isTikTokRawVisible = visibleTikTokRawJobs.has(job.id);
        const isTikTokAutoPolling = autoPollingTikTokJobs.has(job.id) && Boolean(job.tiktokPublishId) && !TIKTOK_TERMINAL_STATUSES.has(displayedTikTokStatus || "");

        return (
          <Card key={job.id}>
            <CardContent className="space-y-3 p-3 sm:p-5">
              <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="min-w-0 space-y-1 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:space-y-0">
                    <h3 className="font-medium leading-tight" data-testid={`text-job-name-${job.id}`}>
                      Job #{job.id}
                    </h3>
                    {job.assetName && (
                      <span className="block break-words text-sm text-muted-foreground sm:inline">
                        &mdash; {job.assetName}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={config.color as any}
                      data-testid={`badge-status-${job.id}`}
                    >
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:justify-end sm:gap-1 [&>button]:min-w-0 max-sm:[&>button]:w-full max-sm:[&>button]:justify-center">
                  {job.status === "done" && job.finalVideoKey && (
                    <>
                      <VideoPreview jobId={job.id} />
                      <Button
                        size="sm"
                        onClick={() => handleDownload(job.id, "final")}
                        disabled={finalDownloadState?.status === "downloading"}
                        data-testid={`button-download-${job.id}`}
                        className="gap-1.5"
                      >
                        {finalDownloadState?.status === "downloading"
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Download className="w-4 h-4" />}
                        {finalDownloadState?.status === "downloading" ? "Downloading" : "Video"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTikTokPublish(job)}
                        disabled={publishTikTokMutation.isPending || tiktokStatusQuery.isLoading || !tiktokStatusQuery.data?.configured}
                        data-testid={`button-tiktok-publish-${job.id}`}
                        title={tiktokStatusQuery.data?.connected ? "Post to TikTok" : "Connect TikTok"}
                        className="gap-1.5"
                      >
                        {publishTikTokMutation.isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Share2 className="w-4 h-4" />}
                        {tiktokStatusQuery.data?.connected ? "TikTok" : "Connect"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => checkTikTokStatusMutation.mutate(job.id)}
                        disabled={!job.tiktokPublishId || checkTikTokStatusMutation.isPending}
                        data-testid={`button-tiktok-status-${job.id}`}
                        title={job.tiktokPublishId ? "Check TikTok publish status" : "No TikTok publish ID yet"}
                        className="gap-1.5"
                      >
                        {checkTikTokStatusMutation.isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Clock className="w-4 h-4" />}
                        Status
                      </Button>
                    </>
                  )}

                  {hasContent && (
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => toggleExpanded(job.id)}
                      data-testid={`button-expand-${job.id}`}
                      className="max-sm:w-full"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                  {isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => stopJobMutation.mutate(job.id)}
                      disabled={stopJobMutation.isPending}
                      data-testid={`button-stop-job-${job.id}`}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      {stopJobMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                      Stop
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => deleteJobMutation.mutate(job.id)}
                    disabled={deleteJobMutation.isPending}
                    data-testid={`button-delete-job-${job.id}`}
                    title="Delete job"
                    className="max-sm:w-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {isActive && (
                <Progress value={config.progress} className="h-1.5" data-testid={`progress-${job.id}`} />
              )}

              {finalDownloadState && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-2" data-testid={`download-progress-${job.id}`}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className={finalDownloadState.status === "error" ? "text-destructive" : "text-muted-foreground"}>
                      {finalDownloadState.label}
                    </span>
                    <span className="font-medium">{Math.round(finalDownloadState.progress)}%</span>
                  </div>
                  <Progress value={finalDownloadState.progress} className="h-2" />
                </div>
              )}

              {isExpanded && hasContent && (
                <div className="space-y-4 pt-2 border-t">
                  {job.scriptText && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-1.5">
                        <FileText className="w-4 h-4" />
                        Generated Script
                      </h4>
                      <div
                        className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto"
                        data-testid={`text-script-${job.id}`}
                      >
                        {sanitizeNarrationScript(job.scriptText)}
                      </div>
                    </div>
                  )}

                  {job.headlineText && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          Hook Headline
                        </h4>
                        <CopyTextButton text={job.headlineText} label="Headline" jobId={job.id} field="headline" />
                      </div>
                      <div
                        className="bg-muted rounded-md p-3 text-sm font-medium"
                        data-testid={`text-headline-${job.id}`}
                      >
                        {job.headlineText}
                      </div>
                    </div>
                  )}

                  {job.captionText && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4" />
                          Social Media Caption
                        </h4>
                        <CopyTextButton text={job.captionText} label="Caption" jobId={job.id} field="caption" />
                      </div>
                      <div
                        className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto"
                        data-testid={`text-caption-${job.id}`}
                      >
                        {job.captionText}
                      </div>
                    </div>
                  )}

                  {job.seoText && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-1.5">
                          <Hash className="w-4 h-4" />
                          SEO Keywords & Hashtags
                        </h4>
                        <CopyTextButton text={job.seoText} label="SEO" jobId={job.id} field="seo" />
                      </div>
                      <div
                        className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto"
                        data-testid={`text-seo-${job.id}`}
                      >
                        {job.seoText}
                      </div>
                    </div>
                  )}

                  {(job.audioRawKey || job.audioCleanKey) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-1.5">
                        <AudioLines className="w-4 h-4" />
                        Voiceover
                      </h4>
                      <div className="space-y-2">
                        {job.audioRawKey && (
                          <AudioPlayer jobId={job.id} type="raw" label="Original Voiceover" />
                        )}
                        {job.audioCleanKey && (
                          <AudioPlayer jobId={job.id} type="clean" label="Clean Voiceover (dead air removed)" />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      Logs
                    </h4>
                    <ScrollArea className="h-32">
                      <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-md p-3">
                        {job.logs || "No logs yet."}
                      </pre>
                    </ScrollArea>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {job.scriptText && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const blob = new Blob([sanitizeNarrationScript(job.scriptText)], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `job-${job.id}-script.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        data-testid={`button-download-script-${job.id}`}
                      >
                        <Download className="w-3 h-3 mr-1" /> Script
                      </Button>
                    )}
                    {job.audioRawKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(job.id, "raw")}
                        data-testid={`button-download-raw-${job.id}`}
                      >
                        <Download className="w-3 h-3 mr-1" /> Raw Audio
                      </Button>
                    )}
                    {job.audioCleanKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(job.id, "clean")}
                        data-testid={`button-download-clean-${job.id}`}
                      >
                        <Download className="w-3 h-3 mr-1" /> Clean Audio
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {job.status === "done" && job.finalVideoKey && (
                <div className="flex flex-col gap-3 pt-2 border-t sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor={`share-${job.id}`} className="text-sm">
                      Sharable link
                    </Label>
                    <Switch
                      id={`share-${job.id}`}
                      data-testid={`switch-share-${job.id}`}
                      checked={job.shareEnabled}
                      onCheckedChange={() => shareMutation.mutate(job.id)}
                    />
                  </div>
                  {job.shareEnabled && job.shareToken && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyShareLink(job.shareToken!)}
                      data-testid={`button-copy-share-${job.id}`}
                      className="max-sm:w-full"
                    >
                      {copiedToken === job.shareToken ? (
                        <Check className="w-4 h-4 mr-1" />
                      ) : (
                        <Copy className="w-4 h-4 mr-1" />
                      )}
                      Copy Link
                    </Button>
                  )}
                </div>
              )}

              {job.status === "done" && job.finalVideoKey && (job.tiktokPublishId || liveTikTokStatus) && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-3" data-testid={`tiktok-debug-${job.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Share2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">TikTok Debug</span>
                      {displayedTikTokStatus && (
                        <Badge
                          variant={
                            displayedTikTokStatus === "PUBLISHED"
                              ? "default"
                              : displayedTikTokStatus === "FAILED" || displayedTikTokStatus === "REJECTED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {displayedTikTokStatus}
                        </Badge>
                      )}
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => checkTikTokStatusMutation.mutate(job.id)}
                        disabled={!job.tiktokPublishId || checkTikTokStatusMutation.isPending}
                        data-testid={`button-tiktok-status-panel-${job.id}`}
                        className="max-sm:w-full"
                      >
                        {checkTikTokStatusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Clock className="w-3.5 h-3.5 mr-1" />}
                        Check TikTok Status
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleTikTokRaw(job.id)}
                        data-testid={`button-tiktok-raw-json-${job.id}`}
                        className="max-sm:w-full"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        {isTikTokRawVisible ? "Hide Raw JSON" : "Show Raw JSON"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="break-all"><span className="font-medium text-foreground">publish_id:</span> {liveTikTokStatus?.publishId || job.tiktokPublishId || "none"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">status API:</span> {rawStatusValue}</div>
                    <div className="break-all"><span className="font-medium text-foreground">fail_reason:</span> {rawFailReason || "none"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">mode:</span> {job.tiktokPostMode || "DIRECT_POST_VIDEO_PUBLISH_FILE_UPLOAD"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">scope:</span> video.publish direct post</div>
                    <div className="break-all"><span className="font-medium text-foreground">privacy:</span> {job.tiktokPrivacyLevel || "SELF_ONLY"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">creator:</span> {job.tiktokCreatorNickname || tiktokStatusQuery.data?.creatorNickname || "unknown"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">username:</span> {job.tiktokCreatorUsername || tiktokStatusQuery.data?.creatorUsername || "unknown"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">open_id:</span> {liveTikTokStatus?.openId || job.tiktokOpenId || tiktokStatusQuery.data?.openId || "unknown"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">token fingerprint:</span> {liveTikTokStatus?.accessTokenFingerprint || job.tiktokAccessTokenFingerprint || tiktokStatusQuery.data?.accessTokenFingerprint || "unknown"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">auto polling:</span> {isTikTokAutoPolling ? "every 10s" : "stopped"}</div>
                    <div className="break-all"><span className="font-medium text-foreground">last checked:</span> {liveTikTokStatus?.checkedAt ? new Date(liveTikTokStatus.checkedAt).toLocaleTimeString() : "not yet"}</div>
                  </div>
                  {displayedTikTokError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                      {displayedTikTokError}
                    </div>
                  )}
                  {isTikTokRawVisible && (
                    <div className="rounded-md border bg-background/60 p-2 text-xs">
                      <div className="font-medium">Raw TikTok Publish Status API response</div>
                      {!displayedTikTokStatusResponse && (
                        <div className="mt-1 text-muted-foreground">
                          No status API response yet. Buzzly will auto-check every 10 seconds while this publish is processing.
                        </div>
                      )}
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(displayedTikTokStatusResponse || displayedTikTokRaw || {
                          message: "No TikTok status response captured yet.",
                          publish_id: liveTikTokStatus?.publishId || job.tiktokPublishId || null,
                          current_status: displayedTikTokStatus,
                        }, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Jobs</DialogTitle>
            <DialogDescription>
              This will permanently delete all your jobs and cannot be undone. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
              disabled={clearAllMutation.isPending}
              data-testid="button-cancel-clear-all"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              data-testid="button-confirm-clear-all"
            >
              {clearAllMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Clearing...</> : "Yes, Clear All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingTikTokJob)} onOpenChange={(open) => {
        if (!open && !publishTikTokMutation.isPending) {
          setPendingTikTokJob(null);
          setTikTokCaption("");
          setTikTokPublishStatus({ state: "idle" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post to TikTok?</DialogTitle>
            <DialogDescription>
              This sends the video as Private/Self only. While the TikTok app is unaudited, the connected TikTok account must also be set to Private in TikTok settings.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="font-medium">
              {pendingTikTokJob?.assetName || `Job #${pendingTikTokJob?.id}`}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Post privacy: Private/Self only
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Posting as: {tiktokStatusQuery.data?.creatorNickname || "unknown"} @{tiktokStatusQuery.data?.creatorUsername || "unknown"}
            </div>
            <div className="mt-1 break-all text-xs text-muted-foreground">
              open_id: {tiktokStatusQuery.data?.openId || "unknown"} • token: {tiktokStatusQuery.data?.accessTokenFingerprint || "unknown"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Testing requirement: TikTok account privacy must be Private until app audit is approved.
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tiktok-caption">Caption</Label>
            <Textarea
              id="tiktok-caption"
              value={tiktokCaption}
              onChange={(event) => setTikTokCaption(event.target.value)}
              rows={6}
              maxLength={2200}
              disabled={publishTikTokMutation.isPending}
              data-testid="input-tiktok-caption"
            />
            <div className="text-right text-xs text-muted-foreground">
              From Social Media Caption • {tiktokCaption.length}/2200
            </div>
          </div>
          {tiktokPublishStatus.state !== "idle" && (
            <div
              className={`rounded-md border p-3 text-sm ${
                tiktokPublishStatus.state === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : tiktokPublishStatus.state === "error"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "bg-muted/40 text-muted-foreground"
              }`}
              data-testid="tiktok-publish-status"
            >
              <div className="flex items-start gap-2">
                {tiktokPublishStatus.state === "sending" && <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />}
                {tiktokPublishStatus.state === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4" />}
                {tiktokPublishStatus.state === "error" && <AlertCircle className="mt-0.5 h-4 w-4" />}
                <div className="space-y-1">
                  <div className="font-medium">
                    {tiktokPublishStatus.state === "sending" && "Sending to TikTok"}
                    {tiktokPublishStatus.state === "success" && "Accepted by TikTok"}
                    {tiktokPublishStatus.state === "error" && "TikTok did not post it"}
                  </div>
                  <div>{tiktokPublishStatus.message}</div>
                  {tiktokPublishStatus.publishId && (
                    <div className="text-xs opacity-80">Publish ID: {tiktokPublishStatus.publishId}</div>
                  )}
                  {tiktokPublishStatus.raw && (
                    <details className="mt-2 rounded border bg-background/60 p-2 text-xs">
                      <summary className="cursor-pointer font-medium">Raw TikTok response</summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(tiktokPublishStatus.raw, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPendingTikTokJob(null);
                setTikTokCaption("");
                setTikTokPublishStatus({ state: "idle" });
              }}
              disabled={publishTikTokMutation.isPending}
              data-testid="button-cancel-tiktok-publish"
            >
              {tiktokPublishStatus.state === "success" ? "Done" : "Cancel"}
            </Button>
            <Button
              onClick={() => pendingTikTokJob && publishTikTokMutation.mutate({ job: pendingTikTokJob, title: tiktokCaption })}
              disabled={!pendingTikTokJob || publishTikTokMutation.isPending || !tiktokCaption.trim() || tiktokPublishStatus.state === "success"}
              data-testid="button-confirm-tiktok-publish"
            >
              {publishTikTokMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending...</> : "Post to TikTok"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
