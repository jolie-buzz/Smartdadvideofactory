import { useQuery, useMutation } from "@tanstack/react-query";
import { invalidateAssetsCache, queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Trash2, Image, Film, Mic, Settings, FolderOpen, Loader2, Pencil, Brain, Clapperboard, Copy, Star, Download, Music } from "lucide-react";
import { useState } from "react";
import type { Asset } from "@shared/schema";
import { FREE_MUSIC_LIBRARY } from "./studio/free-music-library";

export type AssetMediaUrls = {
  photoUrl: string | null;
  videoUrl: string | null;
  musicUrl: string | null;
};

type Voice = {
  voice_id: string;
  name: string;
  category: string;
};

type MusicLibraryTrack = {
  id: number;
  name: string;
  musicKey: string;
  musicUrl: string | null;
};

interface SetupsListProps {
  onActivate: () => void;
  onEdit: (asset: Asset) => void;
  onOpenStudio?: (asset: Asset, media?: AssetMediaUrls) => void;
}

function SetupThumbnail({ asset, media, priority = false }: { asset: Asset; media?: AssetMediaUrls; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = asset.photoKey ? `/api/assets/${asset.id}/media/photo` : null;
  const videoUrl = media?.videoUrl || (asset.videoKey ? `/api/assets/${asset.id}/media/video` : null);

  if (!failed && photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={asset.name}
        className="h-full w-full object-cover"
        loading={priority ? "eager" : "lazy"}
        onError={(event) => {
          console.warn("[thumbnail] photo load failed", {
            assetId: asset.id,
            assetName: asset.name,
            src: event.currentTarget.currentSrc || photoUrl,
          });
          setFailed(true);
        }}
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
        onError={(event) => {
          console.warn("[thumbnail] video fallback load failed", {
            assetId: asset.id,
            assetName: asset.name,
            src: event.currentTarget.currentSrc || videoUrl,
          });
          setFailed(true);
        }}
      />
    );
  }

  return <Image className="h-8 w-8" />;
}

const isMusicLibraryAsset = (asset: Asset) => (
  asset.personaPrompt === "__ADMIN_MUSIC_LIBRARY__"
);

export function SetupsList({ onActivate, onEdit, onOpenStudio }: SetupsListProps) {
  const { toast } = useToast();
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);

  const assetsQuery = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });
  const mediaUrlsQuery = useQuery<Record<number, AssetMediaUrls>>({
    queryKey: ["/api/assets/media-urls"],
    enabled: !!assetsQuery.data?.length,
  });
  const voicesQuery = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });
  const musicLibraryQuery = useQuery<MusicLibraryTrack[]>({
    queryKey: ["/api/music-library"],
  });

  const visibleAssets = (assetsQuery.data || []).filter((asset) => !isMusicLibraryAsset(asset));
  const sortedAssets = [...visibleAssets].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
  const selectedCount = selectedAssetIds.length;

  const activateMutation = useMutation({
    mutationFn: async ({ assetId, shuffle }: { assetId: number; shuffle: boolean }) => {
      const res = await apiRequest("POST", "/api/activate", { assetId, shuffle });
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

  const bulkActivateMutation = useMutation({
    mutationFn: async ({ assetIds, shuffle }: { assetIds: number[]; shuffle: boolean }) => {
      const results = [];
      for (const assetId of assetIds) {
        const res = await apiRequest("POST", "/api/activate", { assetId, shuffle });
        results.push(await res.json());
      }
      return results;
    },
    onSuccess: (jobs) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Jobs activated", description: `${jobs.length} setup${jobs.length === 1 ? "" : "s"} queued for processing.` });
      setSelectedAssetIds([]);
      onActivate();
    },
    onError: (err: Error) => {
      toast({ title: "Bulk activate error", description: err.message, variant: "destructive" });
    },
  });

  const quickUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Pick<Asset, "voiceId" | "voiceName" | "musicKey">> }) => {
      const res = await apiRequest("PATCH", `/api/assets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAssetsCache();
      queryClient.invalidateQueries({ queryKey: ["/api/music-library"] });
      toast({ title: "Setup updated", description: "Voice or music has been changed." });
    },
    onError: (err: Error) => {
      toast({ title: "Update error", description: err.message, variant: "destructive" });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: number; isFavorite: boolean }) => {
      const res = await apiRequest("PATCH", `/api/assets/${id}`, { isFavorite });
      return res.json();
    },
    onSuccess: () => {
      invalidateAssetsCache();
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

  const downloadRecoveredMedia = (asset: Asset, kind: "photo" | "video" | "music") => {
    const link = document.createElement("a");
    link.href = `/api/assets/${asset.id}/media/${kind}?download=1`;
    link.download = `${asset.name}-${kind}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast({ title: "Download started", description: `${kind[0].toUpperCase()}${kind.slice(1)} is downloading.` });
  };

  const toggleSelected = (assetId: number, checked: boolean) => {
    setSelectedAssetIds((current) => (
      checked
        ? Array.from(new Set([...current, assetId]))
        : current.filter((id) => id !== assetId)
    ));
  };

  const allSelected = sortedAssets.length > 0 && selectedAssetIds.length === sortedAssets.length;
  const musicOptions = [
    ...FREE_MUSIC_LIBRARY.map((track) => ({
      key: `public:${track.uri}`,
      label: `${track.title} · ${track.mood}`,
    })),
    ...(musicLibraryQuery.data || []).map((track) => ({
      key: track.musicKey,
      label: `Uploaded · ${track.name}`,
    })),
  ];

  if (assetsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
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

  if (!visibleAssets.length) {
    return (
      <div className="mx-auto max-w-5xl">
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
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Saved Setups</h2>
        <Badge variant="secondary">{visibleAssets.length} setup{visibleAssets.length !== 1 ? "s" : ""}</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(value) => setSelectedAssetIds(value ? sortedAssets.map((asset) => asset.id) : [])}
              data-testid="checkbox-select-all-setups"
            />
            Select all
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{selectedCount} selected</Badge>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={selectedCount === 0 || bulkActivateMutation.isPending}
              onClick={() => bulkActivateMutation.mutate({ assetIds: selectedAssetIds, shuffle: false })}
              data-testid="button-bulk-activate"
            >
              {bulkActivateMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />}
              Activate Selected
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedCount === 0 || bulkActivateMutation.isPending}
              onClick={() => bulkActivateMutation.mutate({ assetIds: selectedAssetIds, shuffle: true })}
              data-testid="button-bulk-activate-shuffle"
            >
              {bulkActivateMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />}
              Shuffle Selected
            </Button>
          </div>
        </CardContent>
      </Card>

      {sortedAssets.map((asset, index) => {
        const media = mediaUrlsQuery.data?.[asset.id];
        const isRecovered = asset.name.startsWith("Recovered Asset ");
        const selectedMusicLabel = musicOptions.find((option) => option.key === asset.musicKey)?.label;
        return (
        <Card key={asset.id}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3 max-sm:flex-col">
              <Checkbox
                checked={selectedAssetIds.includes(asset.id)}
                onCheckedChange={(value) => toggleSelected(asset.id, Boolean(value))}
                className="mt-7 shrink-0 max-sm:mt-1"
                aria-label={`Select ${asset.name}`}
                data-testid={`checkbox-select-setup-${asset.id}`}
              />
              <button
                type="button"
                className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 bg-black/30 text-muted-foreground max-sm:h-32 max-sm:w-full"
                onClick={() => onOpenStudio?.(asset, media)}
                disabled={!onOpenStudio}
                title="Open in Studio"
              >
                <SetupThumbnail asset={asset} media={media} priority={index < 6} />
                {asset.videoKey && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 p-1 text-white">
                    <Film className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-3 max-lg:flex-col">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 truncate font-medium leading-5" data-testid={`text-asset-name-${asset.id}`}>
                        {asset.name}
                      </h3>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={`h-7 w-7 shrink-0 ${asset.isFavorite ? "text-[#ffc400]" : "text-muted-foreground"}`}
                        onClick={() => favoriteMutation.mutate({ id: asset.id, isFavorite: !asset.isFavorite })}
                        disabled={favoriteMutation.isPending}
                        title={asset.isFavorite ? "Remove favorite" : "Favorite setup"}
                        data-testid={`button-favorite-${asset.id}`}
                      >
                        <Star className={`h-4 w-4 ${asset.isFavorite ? "fill-current" : ""}`} />
                      </Button>
                      {isRecovered && (
                        <Badge variant="outline" className="shrink-0 text-xs">Recovered</Badge>
                      )}
                      {asset.voiceName && (
                        <Badge variant="secondary" className="min-w-0 max-w-[260px] truncate text-xs">
                          <Mic className="mr-1 h-3 w-3 shrink-0" />
                          {asset.voiceName}
                        </Badge>
                      )}
                    </div>

                    <p className="truncate text-sm text-muted-foreground">
                      {asset.personaPrompt}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-lg:w-full max-lg:justify-start">
                    {onOpenStudio && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenStudio(asset, media)}
                        data-testid={`button-open-studio-${asset.id}`}
                        className="h-8 max-sm:flex-1"
                      >
                        <Clapperboard className="mr-1 h-4 w-4" />
                        Studio
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => activateMutation.mutate({ assetId: asset.id, shuffle: false })}
                      disabled={activateMutation.isPending}
                      data-testid={`button-activate-${asset.id}`}
                      className="h-8 max-sm:flex-1"
                    >
                      {activateMutation.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-1 h-4 w-4" />
                      )}
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => activateMutation.mutate({ assetId: asset.id, shuffle: true })}
                      disabled={activateMutation.isPending}
                      data-testid={`button-activate-shuffle-${asset.id}`}
                      className="h-8 max-sm:flex-1"
                    >
                      {activateMutation.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-1 h-4 w-4" />
                      )}
                      Activate with Shuffle
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (onOpenStudio) {
                          onOpenStudio(asset, media);
                          return;
                        }
                        onEdit(asset);
                      }}
                      data-testid={`button-edit-${asset.id}`}
                      title="Edit setup"
                      className="h-8 max-sm:flex-1"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="ml-1">Edit</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => duplicateMutation.mutate(asset.id)}
                      disabled={duplicateMutation.isPending}
                      data-testid={`button-duplicate-${asset.id}`}
                      title="Duplicate setup"
                      className="h-8 w-8"
                    >
                      {duplicateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => deleteMutation.mutate(asset.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${asset.id}`}
                      title="Delete setup"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Voice</p>
                    <Select
                      value={asset.voiceId || "none"}
                      onValueChange={(value) => {
                        const voice = voicesQuery.data?.find((item) => item.voice_id === value);
                        quickUpdateMutation.mutate({
                          id: asset.id,
                          data: {
                            voiceId: value === "none" ? null : value,
                            voiceName: value === "none" ? null : voice?.name || "",
                          },
                        });
                      }}
                      disabled={voicesQuery.isLoading || quickUpdateMutation.isPending}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`select-card-voice-${asset.id}`}>
                        <SelectValue placeholder={asset.voiceName || "Choose voice"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No voice</SelectItem>
                        {(voicesQuery.data || []).map((voice) => (
                          <SelectItem key={voice.voice_id} value={voice.voice_id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Music</p>
                    <Select
                      value={asset.musicKey || "none"}
                      onValueChange={(value) => {
                        quickUpdateMutation.mutate({
                          id: asset.id,
                          data: { musicKey: value === "none" ? null : value },
                        });
                      }}
                      disabled={quickUpdateMutation.isPending || musicLibraryQuery.isLoading}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`select-card-music-${asset.id}`}>
                        <SelectValue placeholder={selectedMusicLabel || "Choose music"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No music</SelectItem>
                        {musicOptions.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Image className="w-3 h-3" /> {asset.photoKey ? "Photo" : "No photo"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clapperboard className="w-3 h-3" /> Builder
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

                {isRecovered && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {asset.photoKey && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => downloadRecoveredMedia(asset, "photo")}
                        data-testid={`button-download-recovered-photo-${asset.id}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <Image className="h-3.5 w-3.5" />
                        Photo
                      </Button>
                    )}
                    {asset.videoKey && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => downloadRecoveredMedia(asset, "video")}
                        data-testid={`button-download-recovered-video-${asset.id}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <Film className="h-3.5 w-3.5" />
                        Video
                      </Button>
                    )}
                    {asset.musicKey && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => downloadRecoveredMedia(asset, "music")}
                        data-testid={`button-download-recovered-music-${asset.id}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <Music className="h-3.5 w-3.5" />
                        Music
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}
