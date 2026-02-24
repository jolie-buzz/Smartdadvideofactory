import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Upload, Trash2, Loader2, Play, Download, Send, Film, Clapperboard, RefreshCw } from "lucide-react";
import type { Shot, Variant } from "@shared/schema";

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

interface VideoBuilderProps {
  assetId: number;
}

export function VideoBuilder({ assetId }: VideoBuilderProps) {
  const { toast } = useToast();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("BODY");
  const [shotType, setShotType] = useState<string>("");
  const [durationSec, setDurationSec] = useState<string>("6");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [templateDuration, setTemplateDuration] = useState<string>("45");
  const [numVariants, setNumVariants] = useState<string>("1");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shotsQuery = useQuery<Shot[]>({
    queryKey: ["/api/assets", assetId, "shots"],
    queryFn: async () => {
      const res = await fetch(`/api/assets/${assetId}/shots`);
      if (!res.ok) throw new Error("Failed to load shots");
      return res.json();
    },
  });

  const variantsQuery = useQuery<Variant[]>({
    queryKey: ["/api/assets", assetId, "variants"],
    queryFn: async () => {
      const res = await fetch(`/api/assets/${assetId}/variants`);
      if (!res.ok) throw new Error("Failed to load variants");
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/assets/${assetId}/generate-variants`, {
        templateDuration: parseInt(templateDuration),
        numVariants: parseInt(numVariants),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets", assetId, "variants"] });
      toast({ title: "Variants generated", description: `Created ${numVariants} variant(s) ready for rendering.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const renderMutation = useMutation({
    mutationFn: async (variantId: number) => {
      const res = await apiRequest("POST", `/api/variants/${variantId}/render`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rendering started", description: "The video is being rendered. This may take a minute." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/assets", assetId, "variants"] });
      }, 5000);
    },
    onError: (err: any) => {
      toast({ title: "Render error", description: err.message, variant: "destructive" });
    },
  });

  const sendToPipelineMutation = useMutation({
    mutationFn: async (variantId: number) => {
      const res = await apiRequest("POST", `/api/variants/${variantId}/send-to-pipeline`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Sent to pipeline", description: "A new job has been created with this video. Check the Jobs tab." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleUploadShot = async () => {
    if (!uploadFile) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const defaultMime = "video/mp4";
      const presignRes = await fetch("/api/upload-shot-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: assetId.toString(),
          filename: uploadFile.name,
          contentType: uploadFile.type || defaultMime,
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
        xhr.setRequestHeader("Content-Type", uploadFile.type || defaultMime);
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.timeout = 10 * 60 * 1000;
        xhr.send(uploadFile);
      });

      const saveRes = await fetch(`/api/assets/${assetId}/shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          shotType: shotType || null,
          durationSec: parseFloat(durationSec),
          r2Key: key,
          orientation: "portrait",
          filename: uploadFile.name,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save shot");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/assets", assetId, "shots"] });
      toast({ title: "Shot uploaded", description: `${uploadFile.name} added to shot library.` });
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteShot = async (shotId: number) => {
    try {
      await apiRequest("DELETE", `/api/shots/${shotId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/assets", assetId, "shots"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteVariant = async (variantId: number) => {
    try {
      await apiRequest("DELETE", `/api/variants/${variantId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/assets", assetId, "variants"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handlePreview = async (variantId: number) => {
    try {
      const res = await fetch(`/api/variants/${variantId}/preview`);
      if (!res.ok) throw new Error("Preview not available");
      const data = await res.json();
      setPreviewUrl(data.url);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDownload = async (variantId: number) => {
    try {
      const res = await fetch(`/api/variants/${variantId}/download`);
      if (!res.ok) throw new Error("Download not available");
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const shots = shotsQuery.data || [];
  const variants = variantsQuery.data || [];

  const shotCounts: Record<string, number> = {};
  for (const s of shots) {
    shotCounts[s.category] = (shotCounts[s.category] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5" />
            Shot Library
          </CardTitle>
          <CardDescription>
            Upload 9:16 vertical clips tagged by category and shot type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Video Clip</Label>
              <Input
                ref={fileInputRef}
                data-testid="input-shot-file"
                type="file"
                accept="video/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                disabled={uploading}
                className="file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:text-secondary-foreground file:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory} disabled={uploading}>
                <SelectTrigger data-testid="select-shot-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Shot Type {category === "BODY" ? "(required)" : "(optional)"}</Label>
              <Select value={shotType} onValueChange={setShotType} disabled={uploading}>
                <SelectTrigger data-testid="select-shot-type">
                  <SelectValue placeholder="Select shot type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {SHOT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (seconds)</Label>
              <Input
                data-testid="input-shot-duration"
                type="number"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                min="1"
                max="30"
                step="0.5"
                disabled={uploading}
              />
            </div>
          </div>

          {uploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Uploading... {uploadProgress}%</p>
            </div>
          )}

          <Button
            onClick={handleUploadShot}
            disabled={!uploadFile || uploading || (category === "BODY" && (!shotType || shotType === "none"))}
            data-testid="button-upload-shot"
            className="w-full"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload Shot
          </Button>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Uploaded Shots ({shots.length})</h4>
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {c}: {shotCounts[c] || 0}
                  </Badge>
                ))}
              </div>
            </div>

            {shotsQuery.isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {shots.length === 0 && !shotsQuery.isLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">No shots uploaded yet.</p>
            )}

            <div className="space-y-1 max-h-60 overflow-y-auto">
              {shots.map((shot) => (
                <div key={shot.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50" data-testid={`shot-item-${shot.id}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge className={`text-xs shrink-0 ${CATEGORY_COLORS[shot.category] || ""}`}>
                      {shot.category}
                    </Badge>
                    {shot.shotType && (
                      <span className="text-xs text-muted-foreground">{shot.shotType}</span>
                    )}
                    <span className="text-xs text-muted-foreground truncate">{shot.filename || shot.r2Key.split("/").pop()}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{shot.durationSec}s</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleDeleteShot(shot.id)}
                    data-testid={`button-delete-shot-${shot.id}`}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Generate Variants
          </CardTitle>
          <CardDescription>
            Select a template duration and generate video variants from your shot library.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Duration</Label>
              <Select value={templateDuration} onValueChange={setTemplateDuration}>
                <SelectTrigger data-testid="select-template-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="45">45s (Hook 3s + Problem 1.5s + Solution 1.5s + Highlight 3s + 6x Body 6s + CTA)</SelectItem>
                  <SelectItem value="60">60s (Hook 3s + Problem 1.5s + Solution 1.5s + Highlight 3s + 8x Body 6s + CTA 3s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of Variants</Label>
              <Input
                data-testid="input-num-variants"
                type="number"
                value={numVariants}
                onChange={(e) => setNumVariants(e.target.value)}
                min="1"
                max="20"
              />
            </div>
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || shots.length < 4}
            data-testid="button-generate-variants"
            className="w-full"
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clapperboard className="w-4 h-4 mr-2" />}
            Generate {numVariants} Variant(s)
          </Button>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Variants ({variants.length})</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/assets", assetId, "variants"] })}
                data-testid="button-refresh-variants"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Refresh
              </Button>
            </div>

            {variantsQuery.isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {variants.length === 0 && !variantsQuery.isLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">No variants generated yet.</p>
            )}

            <div className="space-y-2">
              {variants.map((variant) => (
                <div key={variant.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`variant-item-${variant.id}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Film className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Variant #{variant.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {variant.templateDuration}s template &middot; {(variant.clipIds as number[]).length} clips
                      </p>
                    </div>
                    <Badge variant={
                      variant.status === "done" ? "default" :
                      variant.status === "rendering" ? "secondary" :
                      variant.status === "failed" ? "destructive" : "outline"
                    }>
                      {variant.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {variant.status === "pending" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => renderMutation.mutate(variant.id)}
                        disabled={renderMutation.isPending}
                        data-testid={`button-render-${variant.id}`}
                      >
                        <Clapperboard className="w-3 h-3 mr-1" />
                        Render
                      </Button>
                    )}
                    {variant.status === "done" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePreview(variant.id)}
                          data-testid={`button-preview-variant-${variant.id}`}
                          title="Preview"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(variant.id)}
                          data-testid={`button-download-variant-${variant.id}`}
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => sendToPipelineMutation.mutate(variant.id)}
                          disabled={sendToPipelineMutation.isPending}
                          data-testid={`button-send-pipeline-${variant.id}`}
                          title="Send to AI voiceover pipeline"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Pipeline
                        </Button>
                      </>
                    )}
                    {variant.status === "rendering" && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteVariant(variant.id)}
                      data-testid={`button-delete-variant-${variant.id}`}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {previewUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)} data-testid="variant-preview-modal">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium">Variant Preview</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}>Close</Button>
            </div>
            <div className="p-4">
              <video
                src={previewUrl}
                controls
                autoPlay
                className="w-full rounded-md"
                style={{ maxHeight: "70vh" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
