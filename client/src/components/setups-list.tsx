import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Trash2, Image, Film, Mic, Settings, FolderOpen, Loader2, Pencil, Brain } from "lucide-react";
import type { Asset } from "@shared/schema";

interface SetupsListProps {
  onActivate: () => void;
  onEdit: (asset: Asset) => void;
}

export function SetupsList({ onActivate, onEdit }: SetupsListProps) {
  const { toast } = useToast();

  const assetsQuery = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/assets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
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

      {assetsQuery.data.map((asset) => (
        <Card key={asset.id}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium truncate" data-testid={`text-asset-name-${asset.id}`}>
                    {asset.name}
                  </h3>
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
                    <Image className="w-3 h-3" /> Photo
                  </span>
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" /> Video
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

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => activateMutation.mutate(asset.id)}
                  disabled={activateMutation.isPending}
                  data-testid={`button-activate-${asset.id}`}
                >
                  {activateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Zap className="w-4 h-4 mr-1" />
                  )}
                  Activate
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => onEdit(asset)}
                  data-testid={`button-edit-${asset.id}`}
                  title="Edit setup"
                >
                  <Pencil className="w-4 h-4" />
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
      ))}
    </div>
  );
}
