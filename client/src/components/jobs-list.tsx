import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Sparkles,
  MessageSquare,
  Hash,
} from "lucide-react";
import { useState } from "react";

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
  logs: string;
  createdAt: string;
  assetName?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; progress: number }> = {
  queued: { label: "Queued", color: "secondary", icon: Clock, progress: 5 },
  building_video: { label: "Building Video", color: "secondary", icon: Film, progress: 10 },
  generating_script: { label: "Generating Script", color: "secondary", icon: FileText, progress: 20 },
  generating_audio: { label: "Generating Audio", color: "secondary", icon: AudioLines, progress: 40 },
  cutting_dead_air: { label: "Cutting Dead Air", color: "secondary", icon: FileAudio, progress: 60 },
  rendering: { label: "Rendering Video", color: "secondary", icon: Film, progress: 80 },
  done: { label: "Done", color: "default", icon: CheckCircle2, progress: 100 },
  failed: { label: "Failed", color: "destructive", icon: AlertCircle, progress: 0 },
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
        ? `/api/jobs/${jobId}/download-audio-raw`
        : `/api/jobs/${jobId}/download-audio-clean`;
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

  const loadPreview = async () => {
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
        onClick={loadPreview}
        disabled={loading}
        data-testid={`button-preview-${jobId}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
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
                controls
                autoPlay
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

  const toggleExpanded = (id: number) => {
    setExpandedJobs((prev) => {
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

  const hasActiveJobs = jobsQuery.data?.some(
    (j) => !["done", "failed"].includes(j.status)
  );

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadMutation = useMutation({
    mutationFn: async ({ jobId, type }: { jobId: number; type: "final" | "raw" | "clean" }) => {
      const dlKey = `${jobId}-${type}`;
      setDownloadingId(dlKey);
      const endpoint = type === "final"
        ? `/api/jobs/${jobId}/download`
        : type === "raw"
        ? `/api/jobs/${jobId}/download-audio-raw`
        : `/api/jobs/${jobId}/download-audio-clean`;
      const res = await apiRequest("GET", endpoint);
      const data = await res.json();
      const a = document.createElement("a");
      a.href = data.url;
      a.target = "_self";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return data;
    },
    onSuccess: () => {
      setDownloadingId(null);
    },
    onError: (err: Error) => {
      setDownloadingId(null);
      toast({ title: "Download Error", description: err.message, variant: "destructive" });
    },
  });

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
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Production Jobs</h2>
        <div className="flex items-center gap-2">
          {hasActiveJobs && (
            <Badge variant="secondary" className="animate-pulse">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Processing
            </Badge>
          )}
          <Badge variant="secondary">{jobsQuery.data.length} job{jobsQuery.data.length !== 1 ? "s" : ""}</Badge>
        </div>
      </div>

      {jobsQuery.data.map((job) => {
        const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
        const StatusIcon = config.icon;
        const isActive = !["done", "failed"].includes(job.status);
        const isExpanded = expandedJobs.has(job.id);
        const hasContent = job.scriptText || job.headlineText || job.captionText || job.seoText || job.audioRawKey || job.audioCleanKey || job.logs;

        return (
          <Card key={job.id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium" data-testid={`text-job-name-${job.id}`}>
                      Job #{job.id}
                    </h3>
                    {job.assetName && (
                      <span className="text-sm text-muted-foreground">
                        &mdash; {job.assetName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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

                <div className="flex items-center gap-1 shrink-0">
                  {job.status === "done" && job.finalVideoKey && (
                    <>
                      <VideoPreview jobId={job.id} />
                      <Button
                        size="sm"
                        onClick={() => downloadMutation.mutate({ jobId: job.id, type: "final" })}
                        disabled={downloadMutation.isPending}
                        data-testid={`button-download-${job.id}`}
                      >
                        {downloadingId === `${job.id}-final` ? (
                          <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Downloading...</>
                        ) : (
                          <><Download className="w-4 h-4 mr-1" /> Video</>
                        )}
                      </Button>
                    </>
                  )}

                  {hasContent && (
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => toggleExpanded(job.id)}
                      data-testid={`button-expand-${job.id}`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => deleteJobMutation.mutate(job.id)}
                    disabled={deleteJobMutation.isPending}
                    data-testid={`button-delete-job-${job.id}`}
                    title="Delete job"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {isActive && (
                <Progress value={config.progress} className="h-1.5" data-testid={`progress-${job.id}`} />
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
                        {job.scriptText}
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
                          const blob = new Blob([job.scriptText!], { type: "text/plain" });
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
                        onClick={() => downloadMutation.mutate({ jobId: job.id, type: "raw" })}
                        disabled={downloadMutation.isPending}
                        data-testid={`button-download-raw-${job.id}`}
                      >
                        {downloadingId === `${job.id}-raw` ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Downloading...</>
                        ) : (
                          <><Download className="w-3 h-3 mr-1" /> Raw Audio</>
                        )}
                      </Button>
                    )}
                    {job.audioCleanKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadMutation.mutate({ jobId: job.id, type: "clean" })}
                        disabled={downloadMutation.isPending}
                        data-testid={`button-download-clean-${job.id}`}
                      >
                        {downloadingId === `${job.id}-clean` ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Downloading...</>
                        ) : (
                          <><Download className="w-3 h-3 mr-1" /> Clean Audio</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {job.status === "done" && job.finalVideoKey && (
                <div className="flex items-center justify-between pt-2 border-t">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
