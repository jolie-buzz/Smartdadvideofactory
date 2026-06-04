import { useQuery, useMutation } from "@tanstack/react-query";
import { invalidateAssetsCache, queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Trash2, Image, Film, Mic, Settings, FolderOpen, Loader2, Pencil, Brain, Clapperboard, Copy } from "lucide-react";
import { useState } from "react";
import type { Asset } from "@shared/schema";

export type AssetMediaUrls = {
  photoUrl: string | null;
  videoUrl: string | null;
  musicUrl: string | null;
};

interface SetupsListProps {
  onActivate: () => void;
  onEdit: (asset: Asset) => void;
  onOpenStudio?: (asset: Asset, media?: AssetMediaUrls) => void;
}

function SetupThumbnail({ asset, media }: { asset: Asset; media?: AssetMediaUrls }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = asset.photoKey ? `/api/assets/${asset.id}/media/photo` : null;
  const videoUrl = media?.videoUrl || (asset.videoKey ? `/api/assets/${asset.id}/media/video` : null);

  if (!failed && photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={asset.name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  if (!failed && videoUrl) {
    return (
      <video
        src={videoUrl}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (Number.isFinite(video.duration) && video.duration > 0.2) {
            video.currentTime = 0.2;
          }
        }}
        onError={() => setFailed(true)}
      />
    );
  }

  return <Image className="h-8 w-8" />;
}

export function SetupsList({ onActivate, onEdit, onOpenStudio }: SetupsListProps) {
  const { toast } = useToast();

  const assetsQuery = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });
  const mediaUrlsQuery = useQuery<Record<number, AssetMediaUrls>>({
    queryKey: ["/api/assets/media-urls"],
    enabled: !!assetsQuery.data?.length,
  });

  const activateMutation = useMutation({
    mutationFn: async (assetId: number) => {
      const res = await apiRequest("POST", "/api/activate", { assetId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job activated", description: "A new job has been queued for processing." });
      onActivate();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/assets/${id}/duplicate`);
      return res.json();
    },
    onSuccess: () => {
      invalidateAssetsCache();
      toast({ title: "Duplicated", description: "Setup has been copied. You can now edit the copy." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/assets/${id}`);
    },
    onSuccess: () => {
      invalidateAssetsCache();
      toast({ title: "Deleted", description: "Setup has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (assetsQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!assetsQuery.data?.length) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No setups yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first setup by going to the "New Setup" tab.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Saved Setups</h2>
        <Badge variant="secondary">{assetsQuery.data.length} setup{assetsQuery.data.length !== 1 ? "s" : ""}</Badge>
      </div>

      {assetsQuery.data.map((asset) => {
        const media = mediaUrlsQuery.data?.[asset.id];
        return (
        <Card key={asset.id}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 max-sm:flex-col">
              <button
                type="button"
                className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-muted-foreground max-sm:h-36 max-sm:w-full"
                onClick={() => onOpenStudio?.(asset, media)}
                disabled={!onOpenStudio}
                title="Open in Studio"
              >
                <SetupThumbnail asset={asset} media={media} />
                {asset.videoKey && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 p-1 text-white">
                    <Film className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium truncate" data-testid={`text-asset-name-${asset.id}`}>
                    {asset.name}
                  </h3>
                  {asset.name.startsWith("Recovered Asset ") && (
                    <Badge variant="outline" className="text-xs">Recovered</Badge>
                  )}
                  {asset.voiceName && (
                    <Badge variant="secondary" className="text-xs">
                      <Mic className="w-3 h-3 mr-1" />
                      {asset.voiceName}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                  {asset.personaPrompt}
                </p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Image className="w-3 h-3" /> {asset.photoKey ? "Photo" : "No photo"}
                  </span>
                  <span className="flex items-center gap-1">
                    {asset.videoKey ? (
                      <><Film className="w-3 h-3" /> Video</>
                    ) : asset.videoSource === "builder" ? (
                      <><Clapperboard className="w-3 h-3" /> Builder</>
                    ) : (
                      <><Film className="w-3 h-3" /> No video</>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Brain className="w-3 h-3" />
                    {asset.openaiModel || "gpt-4o"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    {asset.thresholdDb}dB / {asset.ignoreDetectionsShorterThan}s
                  </span>
                  <span>
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 max-sm:w-full max-sm:flex-wrap">
                {onOpenStudio && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpenStudio(asset, media)}
                    data-testid={`button-open-studio-${asset.id}`}
                    className="max-sm:flex-1"
                  >
                    <Clapperboard className="w-4 h-4 mr-1" />
                    Studio
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => activateMutation.mutate(asset.id)}
                  disabled={activateMutation.isPending}
                  data-testid={`button-activate-${asset.id}`}
                  className="max-sm:flex-1"
                >
                  {activateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Zap className="w-4 h-4 mr-1" />
                  )}
                  {asset.videoSource === "builder" ? "Activate shuffle" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (onOpenStudio && (asset.videoSource === "builder" || asset.name.startsWith("Recovered Asset "))) {
                      onOpenStudio(asset, media);
                      return;
                    }
                    onEdit(asset);
                  }}
                  data-testid={`button-edit-${asset.id}`}
                  title="Edit setup"
                  className="max-sm:flex-1"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="ml-1">Edit</span>
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => duplicateMutation.mutate(asset.id)}
                  disabled={duplicateMutation.isPending}
                  data-testid={`button-duplicate-${asset.id}`}
                  title="Duplicate setup"
                >
                  {duplicateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => deleteMutation.mutate(asset.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${asset.id}`}
                  title="Delete setup"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}
