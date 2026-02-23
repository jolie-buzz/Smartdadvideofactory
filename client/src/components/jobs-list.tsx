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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { useState, useEffect } from "react";

type JobWithAsset = {
  id: number;
  assetId: number;
  status: string;
  scriptText: string | null;
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
  generating_script: { label: "Generating Script", color: "secondary", icon: FileText, progress: 20 },
  generating_audio: { label: "Generating Audio", color: "secondary", icon: AudioLines, progress: 40 },
  cutting_dead_air: { label: "Cutting Dead Air", color: "secondary", icon: FileAudio, progress: 60 },
  rendering: { label: "Rendering Video", color: "secondary", icon: Film, progress: 80 },
  done: { label: "Done", color: "default", icon: CheckCircle2, progress: 100 },
  failed: { label: "Failed", color: "destructive", icon: AlertCircle, progress: 0 },
};

export function JobsList() {
  const { toast } = useToast();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const jobsQuery = useQuery<JobWithAsset[]>({
    queryKey: ["/api/jobs"],
    refetchInterval: 3000,
  });

  const hasActiveJobs = jobsQuery.data?.some(
    (j) => !["done", "failed"].includes(j.status)
  );

  const downloadMutation = useMutation({
    mutationFn: async ({ jobId, type }: { jobId: number; type: "final" | "raw" | "clean" }) => {
      const endpoint = type === "final"
        ? `/api/jobs/${jobId}/download`
        : type === "raw"
        ? `/api/jobs/${jobId}/download-audio-raw`
        : `/api/jobs/${jobId}/download-audio-clean`;
      const res = await apiRequest("GET", endpoint);
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.open(data.url, "_blank");
    },
    onError: (err: Error) => {
      toast({ title: "Download Error", description: err.message, variant: "destructive" });
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

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast({ title: "Copied", description: "Share link copied to clipboard." });
    setTimeout(() => setCopiedToken(null), 2000);
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
            <h3 className="text-lg font-medium mb-2">No jobs yet</h3>
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

        return (
          <Card key={job.id}>
            <CardContent className="p-5 space-y-4">
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
                    <Button
                      size="sm"
                      onClick={() => downloadMutation.mutate({ jobId: job.id, type: "final" })}
                      disabled={downloadMutation.isPending}
                      data-testid={`button-download-${job.id}`}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  )}

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="secondary" data-testid={`button-logs-${job.id}`}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Job #{job.id} Details</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {job.scriptText && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Generated Script</h4>
                            <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                              {job.scriptText}
                            </div>
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Logs</h4>
                          <ScrollArea className="h-48">
                            <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-md p-3">
                              {job.logs || "No logs yet."}
                            </pre>
                          </ScrollArea>
                        </div>
                        {job.status === "done" && (
                          <div className="flex gap-2 flex-wrap">
                            {job.audioRawKey && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => downloadMutation.mutate({ jobId: job.id, type: "raw" })}
                              >
                                <AudioLines className="w-4 h-4 mr-1" /> Raw Audio
                              </Button>
                            )}
                            {job.audioCleanKey && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => downloadMutation.mutate({ jobId: job.id, type: "clean" })}
                              >
                                <FileAudio className="w-4 h-4 mr-1" /> Clean Audio
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {isActive && (
                <Progress value={config.progress} className="h-1.5" data-testid={`progress-${job.id}`} />
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
