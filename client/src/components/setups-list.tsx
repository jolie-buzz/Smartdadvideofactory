import { useQuery, useMutation } from "@tanstack/react-query";
import { invalidateAssetsCache, queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Trash2, Image, Film, Mic, Settings, FolderOpen, Loader2, Pencil, Brain, Clapperboard, Copy, Star, Download, Music, Search, LayoutGrid, List, Clock, Sparkles, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import type { Asset, ScriptPrompt } from "@shared/schema";
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

type JobSummary = {
  id: number;
  assetId: number;
  createdAt: string;
};

type SetupSortMode = "recent" | "newest" | "favorite" | "name";
type SetupViewMode = "list" | "grid";
const SCRIPT_DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;
const normalizeScriptDuration = (value: unknown) => (
  SCRIPT_DURATION_OPTIONS.includes(Number(value) as any) ? Number(value) : 60
);

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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SetupSortMode>("recent");
  const [viewMode, setViewMode] = useState<SetupViewMode>("list");

  const assetsQuery = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });
  const jobsQuery = useQuery<JobSummary[]>({
    queryKey: ["/api/jobs"],
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
  const scriptPromptsQuery = useQuery<ScriptPrompt[]>({
    queryKey: ["/api/script-prompts"],
  });

  const lastUsedByAssetId = useMemo(() => {
    const map = new Map<number, string>();
    for (const job of jobsQuery.data || []) {
      if (!map.has(job.assetId)) map.set(job.assetId, job.createdAt);
    }
    return map;
  }, [jobsQuery.data]);

  const visibleAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (assetsQuery.data || []).filter((asset) => {
      if (isMusicLibraryAsset(asset)) return false;
      if (!query) return true;
      return [
        asset.name,
        asset.personaPrompt,
        asset.voiceName || "",
        asset.openaiModel || "",
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [assetsQuery.data, searchQuery]);

  const sortedAssets = useMemo(() => {
    const timeValue = (value?: string | Date | null) => value ? new Date(value).getTime() || 0 : 0;
    return [...visibleAssets].sort((a, b) => {
      const favoriteDiff = Number(b.isFavorite) - Number(a.isFavorite);
      if (sortMode === "favorite" && favoriteDiff) return favoriteDiff;
      if (sortMode === "recent") {
        const recentDiff = timeValue(lastUsedByAssetId.get(b.id)) - timeValue(lastUsedByAssetId.get(a.id));
        if (recentDiff) return recentDiff;
      }
      if (sortMode === "newest") {
        const newestDiff = timeValue(b.createdAt) - timeValue(a.createdAt);
        if (newestDiff) return newestDiff;
      }
      if (sortMode === "name") {
        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff) return nameDiff;
      }
      return favoriteDiff || timeValue(b.createdAt) - timeValue(a.createdAt);
    });
  }, [lastUsedByAssetId, sortMode, visibleAssets]);

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
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<Pick<Asset, "voiceId" | "voiceName" | "musicKey" | "personaPrompt" | "scriptPromptId" | "scriptDurationSec">>;
    }) => {
      const res = await apiRequest("PATCH", `/api/assets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAssetsCache();
      queryClient.invalidateQueries({ queryKey: ["/api/music-library"] });
      toast({ title: "Setup saved", description: "Your setup changes are now active." });
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
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Deleted", description: "Setup has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (assetIds: number[]) => {
      const res = await apiRequest("POST", "/api/assets/bulk-delete", { assetIds });
      return res.json();
    },
    onSuccess: (result: { deleted: number }) => {
      invalidateAssetsCache();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setSelectedAssetIds([]);
      toast({
        title: "Setups deleted",
        description: `${result.deleted} setup${result.deleted === 1 ? "" : "s"} removed.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Bulk delete error", description: err.message, variant: "destructive" });
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

  const allSelected = sortedAssets.length > 0 && sortedAssets.every((asset) => selectedAssetIds.includes(asset.id));
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
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-3 overflow-x-clip">
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
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-3 overflow-x-clip">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Saved Setups</h2>
        <Badge variant="secondary">{sortedAssets.length} setup{sortedAssets.length !== 1 ? "s" : ""}</Badge>
      </div>

      <Card className="overflow-x-clip">
        <CardContent className="space-y-3 p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search setups..."
                className="h-10 pl-9"
                data-testid="input-search-setups"
              />
            </div>
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as SetupSortMode)}>
              <SelectTrigger className="h-10" data-testid="select-setup-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent use</SelectItem>
                <SelectItem value="newest">Newly added</SelectItem>
                <SelectItem value="favorite">Favorites first</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1">
              <Button
                type="button"
                size="icon"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                className="h-8 w-full"
                onClick={() => setViewMode("list")}
                title="List view"
                data-testid="button-list-view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                className="h-8 w-full"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                data-testid="button-grid-view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 max-sm:items-stretch">
            <label className="flex items-center gap-2 text-sm max-sm:w-full">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(value) => {
                  const visibleIds = sortedAssets.map((asset) => asset.id);
                  setSelectedAssetIds((current) => (
                    value
                      ? Array.from(new Set([...current, ...visibleIds]))
                      : current.filter((id) => !visibleIds.includes(id))
                  ));
                }}
                data-testid="checkbox-select-all-setups"
              />
              Select shown
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-2">
              <Badge variant="outline" className="max-sm:col-span-2 max-sm:w-fit">{selectedCount} selected</Badge>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={selectedCount === 0 || bulkActivateMutation.isPending}
                onClick={() => bulkActivateMutation.mutate({ assetIds: selectedAssetIds, shuffle: false })}
                data-testid="button-bulk-activate"
                className="max-sm:w-full max-sm:min-w-0"
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
                className="max-sm:w-full max-sm:min-w-0"
              >
                {bulkActivateMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />}
                Shuffle Selected
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={selectedCount === 0 || bulkDeleteMutation.isPending}
                onClick={() => {
                  if (!window.confirm(`Delete ${selectedCount} selected setup${selectedCount === 1 ? "" : "s"}? This cannot be undone.`)) return;
                  bulkDeleteMutation.mutate(selectedAssetIds);
                }}
                data-testid="button-bulk-delete-setups"
                className="max-sm:col-span-2 max-sm:w-full max-sm:min-w-0"
              >
                {bulkDeleteMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                Delete Selected
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {sortedAssets.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No setup matches your search.</p>
          </CardContent>
        </Card>
      )}

      <div className={viewMode === "grid" ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
      {sortedAssets.map((asset, index) => {
        const media = mediaUrlsQuery.data?.[asset.id];
        const isRecovered = asset.name.startsWith("Recovered Asset ");
        const selectedMusicLabel = musicOptions.find((option) => option.key === asset.musicKey)?.label;
        const selectedScriptPrompt = scriptPromptsQuery.data?.find((prompt) => prompt.id === asset.scriptPromptId);
        const lastUsedAt = lastUsedByAssetId.get(asset.id);
        const isGridView = viewMode === "grid";
        return (
        <Card key={asset.id} className="overflow-x-clip">
          <CardContent className={isGridView ? "p-3" : "p-2 sm:p-3"}>
            <div className={`flex min-w-0 items-start gap-3 ${isGridView ? "max-sm:flex-col md:flex-col" : "max-sm:flex-row"}`}>
              <Checkbox
                checked={selectedAssetIds.includes(asset.id)}
                onCheckedChange={(value) => toggleSelected(asset.id, Boolean(value))}
                className={`shrink-0 ${isGridView ? "mt-1 max-sm:mt-1" : "mt-7 max-sm:mt-5"}`}
                aria-label={`Select ${asset.name}`}
                data-testid={`checkbox-select-setup-${asset.id}`}
              />
              <button
                type="button"
                className={`relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 bg-black/30 text-muted-foreground ${isGridView ? "aspect-video h-auto w-full max-sm:h-32 max-sm:w-full" : "h-20 w-20 max-sm:h-16 max-sm:w-16"}`}
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
              <div className={`w-full min-w-0 flex-1 ${isGridView ? "space-y-2" : "space-y-2 max-sm:space-y-1"}`}>
                <div className="flex items-start justify-between gap-3 max-lg:flex-col">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className={`flex min-w-0 items-center gap-2 ${isGridView ? "flex-wrap" : "flex-nowrap"}`}>
                      <h3 className={`min-w-0 truncate font-medium leading-5 ${isGridView ? "" : "max-sm:text-sm"}`} data-testid={`text-asset-name-${asset.id}`}>
                        {asset.name}
                      </h3>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={`h-7 w-7 shrink-0 ${asset.isFavorite ? "text-[#ffc400]" : "text-muted-foreground"} ${isGridView ? "" : "max-sm:h-6 max-sm:w-6"}`}
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
                        <Badge variant="secondary" className={`min-w-0 max-w-[260px] truncate text-xs max-sm:max-w-full ${isGridView ? "" : "max-sm:max-w-[110px]"}`}>
                          <Mic className="mr-1 h-3 w-3 shrink-0" />
                          {asset.voiceName}
                        </Badge>
                      )}
                    </div>

                    <p className={`min-w-0 break-words text-sm text-muted-foreground sm:truncate max-sm:[-webkit-box-orient:vertical] max-sm:[-webkit-line-clamp:2] max-sm:overflow-hidden ${isGridView ? "max-sm:[display:-webkit-box]" : "max-sm:hidden"}`}>
                      {asset.personaPrompt}
                    </p>
                  </div>

                  <div className={`flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 max-lg:w-full max-lg:justify-start ${isGridView ? "max-sm:grid max-sm:grid-cols-2 md:grid md:grid-cols-2 md:w-full" : "max-sm:flex-nowrap max-sm:gap-1 max-sm:overflow-x-auto"}`}>
                    {onOpenStudio && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenStudio(asset, media)}
                        data-testid={`button-open-studio-${asset.id}`}
                        className={`h-8 max-sm:min-w-0 md:min-w-0 ${isGridView ? "max-sm:w-full" : "max-sm:w-8 max-sm:px-0"}`}
                      >
                        <Clapperboard className={`h-4 w-4 ${isGridView ? "mr-1" : "sm:mr-1"}`} />
                        <span className={isGridView ? "" : "max-sm:hidden"}>Studio</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => activateMutation.mutate({ assetId: asset.id, shuffle: false })}
                      disabled={activateMutation.isPending}
                      data-testid={`button-activate-${asset.id}`}
                      className={`h-8 max-sm:min-w-0 md:min-w-0 ${isGridView ? "max-sm:w-full" : "max-sm:w-8 max-sm:px-0"}`}
                    >
                      {activateMutation.isPending ? (
                        <Loader2 className={`h-4 w-4 animate-spin ${isGridView ? "mr-1" : "sm:mr-1"}`} />
                      ) : (
                        <Zap className={`h-4 w-4 ${isGridView ? "mr-1" : "sm:mr-1"}`} />
                      )}
                      <span className={isGridView ? "" : "max-sm:hidden"}>Activate</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => activateMutation.mutate({ assetId: asset.id, shuffle: true })}
                      disabled={activateMutation.isPending}
                      data-testid={`button-activate-shuffle-${asset.id}`}
                      className={`h-8 max-sm:min-w-0 md:min-w-0 ${isGridView ? "max-sm:w-full" : "max-sm:w-8 max-sm:px-0"}`}
                    >
                      {activateMutation.isPending ? (
                        <Loader2 className={`h-4 w-4 animate-spin ${isGridView ? "mr-1" : "sm:mr-1"}`} />
                      ) : (
                        <Zap className={`h-4 w-4 ${isGridView ? "mr-1" : "sm:mr-1"}`} />
                      )}
                      <span className={isGridView ? "" : "max-sm:hidden"}>Activate<span className="max-sm:hidden"> with Shuffle</span></span>
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
                      className={`h-8 max-sm:min-w-0 md:min-w-0 ${isGridView ? "max-sm:w-full" : "max-sm:w-8 max-sm:px-0"}`}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className={`ml-1 ${isGridView ? "" : "max-sm:hidden"}`}>Edit</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => duplicateMutation.mutate(asset.id)}
                      disabled={duplicateMutation.isPending}
                      data-testid={`button-duplicate-${asset.id}`}
                      title="Duplicate setup"
                      className={`h-8 w-8 ${isGridView ? "max-sm:w-full md:w-full" : "max-sm:w-8"}`}
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
                      className={`h-8 w-8 ${isGridView ? "max-sm:w-full md:w-full" : "max-sm:w-8"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className={`grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4 ${isGridView ? "" : ""}`}>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] text-muted-foreground">Script prompt</p>
                    <Select
                      value={asset.scriptPromptId ? String(asset.scriptPromptId) : "custom"}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          quickUpdateMutation.mutate({
                            id: asset.id,
                            data: { scriptPromptId: null },
                          });
                          return;
                        }
                        const prompt = scriptPromptsQuery.data?.find((item) => String(item.id) === value);
                        if (!prompt) return;
                        quickUpdateMutation.mutate({
                          id: asset.id,
                          data: {
                            scriptPromptId: prompt.id,
                            personaPrompt: prompt.promptText,
                          },
                        });
                      }}
                      disabled={quickUpdateMutation.isPending || scriptPromptsQuery.isLoading}
                    >
                      <SelectTrigger className="h-8 min-w-0 text-xs" data-testid={`select-card-script-prompt-${asset.id}`}>
                        <SelectValue placeholder={selectedScriptPrompt?.name || "Custom prompt"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom prompt</SelectItem>
                        {(scriptPromptsQuery.data || []).map((prompt) => (
                          <SelectItem key={prompt.id} value={String(prompt.id)}>
                            {prompt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] text-muted-foreground">Duration</p>
                    <Select
                      value={String(normalizeScriptDuration(asset.scriptDurationSec))}
                      onValueChange={(value) => {
                        quickUpdateMutation.mutate({
                          id: asset.id,
                          data: { scriptDurationSec: normalizeScriptDuration(value) },
                        });
                      }}
                      disabled={quickUpdateMutation.isPending}
                    >
                      <SelectTrigger className="h-8 min-w-0 text-xs" data-testid={`select-card-script-duration-${asset.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCRIPT_DURATION_OPTIONS.map((duration) => (
                          <SelectItem key={duration} value={String(duration)}>
                            {duration}s
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
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
                      <SelectTrigger className="h-8 min-w-0 text-xs" data-testid={`select-card-voice-${asset.id}`}>
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
                  <div className="min-w-0 space-y-1">
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
                      <SelectTrigger className="h-8 min-w-0 text-xs" data-testid={`select-card-music-${asset.id}`}>
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

                <div className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground ${isGridView ? "" : "max-sm:gap-x-2 max-sm:text-[11px]"}`}>
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
                    <ScrollText className="w-3 h-3" />
                    {normalizeScriptDuration(asset.scriptDurationSec)}s script
                  </span>
                  <span className={`flex items-center gap-1 ${isGridView ? "" : "max-sm:hidden"}`}>
                    <Settings className="w-3 h-3" />
                    {asset.thresholdDb}dB / {asset.ignoreDetectionsShorterThan}s
                  </span>
                  <span className={isGridView ? "" : "max-sm:hidden"}>
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    {lastUsedAt ? <Clock className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                    {lastUsedAt ? `Used ${new Date(lastUsedAt).toLocaleDateString()}` : "Newly added"}
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
    </div>
  );
}
