import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, KeyRound, Loader2, LogOut, Music, Pencil, Plus, RefreshCw, Send, Shield, Sparkles, Trash2, Upload, User, X } from "lucide-react";
import { invalidateAssetsCache, queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { ScriptPrompt } from "@shared/schema";

const SCRIPT_DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;
const normalizeDuration = (value: unknown) => SCRIPT_DURATION_OPTIONS.includes(Number(value) as any) ? Number(value) : 60;
const durationIndex = (value: number) => Math.max(0, SCRIPT_DURATION_OPTIONS.indexOf(normalizeDuration(value) as any));

type MusicLibraryTrack = {
  id: number;
  name: string;
  musicKey: string;
  musicUrl: string | null;
};

type AdminGeneralPrompts = {
  hookPrompt: string;
  captionPrompt: string;
  seoPrompt: string;
};

type TikTokStatus = {
  connected: boolean;
  configured: boolean;
  hasClientKey?: boolean;
  hasClientSecret?: boolean;
  clientKeyName?: string | null;
  clientSecretName?: string | null;
  redirectUri: string;
  openId?: string;
  scope?: string;
  expiresAt?: string;
};

async function uploadMusicWithProgress(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ key: string }> {
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "music",
      assetId: `admin-music-${crypto.randomUUID()}`,
      filename: file.name,
      contentType: file.type || "audio/mpeg",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to get upload URL (${res.status})`);
  }

  const { url, key } = await res.json();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.timeout = 10 * 60 * 1000;
    xhr.send(file);
  });

  return { key };
}

export function StudioSettingsPanel() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [excludedWordsInput, setExcludedWordsInput] = useState("");
  const [scriptDurationSec, setScriptDurationSec] = useState(60);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptText, setEditPromptText] = useState("");
  const [adminMusicProgress, setAdminMusicProgress] = useState(0);
  const [adminPromptHook, setAdminPromptHook] = useState("");
  const [adminPromptCaption, setAdminPromptCaption] = useState("");
  const [adminPromptSeo, setAdminPromptSeo] = useState("");
  const adminMusicInputRef = useRef<HTMLInputElement>(null);

  const settingsQuery = useQuery<{ excludedWords: string | null; scriptDurationSec: number }>({
    queryKey: ["/api/settings"],
  });

  const scriptPromptsQuery = useQuery<ScriptPrompt[]>({
    queryKey: ["/api/script-prompts"],
  });

  const musicLibraryQuery = useQuery<MusicLibraryTrack[]>({
    queryKey: ["/api/music-library"],
    enabled: user?.role === "admin",
  });

  const adminPromptsQuery = useQuery<AdminGeneralPrompts>({
    queryKey: ["/api/admin/general-prompts"],
    enabled: user?.role === "admin",
  });

  const tiktokStatusQuery = useQuery<TikTokStatus>({
    queryKey: ["/api/tiktok/status"],
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setExcludedWordsInput(settingsQuery.data.excludedWords ?? "");
      setScriptDurationSec(normalizeDuration(settingsQuery.data.scriptDurationSec));
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (adminPromptsQuery.data) {
      setAdminPromptHook(adminPromptsQuery.data.hookPrompt || "");
      setAdminPromptCaption(adminPromptsQuery.data.captionPrompt || "");
      setAdminPromptSeo(adminPromptsQuery.data.seoPrompt || "");
    }
  }, [adminPromptsQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { excludedWords: string; scriptDurationSec: number }) => {
      const res = await apiRequest("PATCH", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved", description: "Default script duration and excluded words updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createPromptMutation = useMutation({
    mutationFn: async (data: { name: string; promptText: string }) => {
      const res = await apiRequest("POST", "/api/script-prompts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/script-prompts"] });
      setShowAddPrompt(false);
      setNewPromptName("");
      setNewPromptText("");
      toast({ title: "Prompt saved", description: "Added to your script prompt library." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, name, promptText }: { id: number; name: string; promptText: string }) => {
      const res = await apiRequest("PATCH", `/api/script-prompts/${id}`, { name, promptText });
      return res.json();
    },
    onSuccess: (prompt: ScriptPrompt & { syncedAssets?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/script-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setEditingPromptId(null);
      toast({
        title: "Prompt updated",
        description: prompt.syncedAssets
          ? `${prompt.syncedAssets} activation setup${prompt.syncedAssets === 1 ? "" : "s"} updated automatically.`
          : "Saved prompt updated.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/script-prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/script-prompts"] });
      toast({ title: "Prompt deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const adminMusicMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const tracks = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const result = await uploadMusicWithProgress(
          file,
          (percent) => setAdminMusicProgress(Math.round(((index + percent / 100) / files.length) * 100)),
        );
        tracks.push({
          name: file.name.replace(/\.[^.]+$/, "") || file.name,
          musicKey: result.key,
        });
      }
      const res = await apiRequest("POST", "/api/admin/music-library", { tracks });
      return res.json();
    },
    onSuccess: (tracks) => {
      queryClient.invalidateQueries({ queryKey: ["/api/music-library"] });
      invalidateAssetsCache();
      setAdminMusicProgress(0);
      toast({ title: "Music added", description: `${tracks.length} track${tracks.length === 1 ? "" : "s"} added to the app library.` });
    },
    onError: (err: Error) => {
      setAdminMusicProgress(0);
      toast({ title: "Music upload error", description: err.message, variant: "destructive" });
    },
  });

  const saveAdminPromptsMutation = useMutation({
    mutationFn: async (data: AdminGeneralPrompts) => {
      const res = await apiRequest("PATCH", "/api/admin/general-prompts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/general-prompts"] });
      toast({ title: "Admin prompts saved", description: "These will be added to future hook, caption, and SEO generations." });
    },
    onError: (err: Error) => {
      toast({ title: "Prompt save error", description: err.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated." });
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const disconnectTikTokMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/tiktok/connection");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tiktok/status"] });
      toast({ title: "TikTok disconnected", description: "This Buzzly account is no longer linked to TikTok." });
    },
    onError: (err: Error) => {
      toast({ title: "TikTok disconnect failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your Buzzly access and workspace account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{user?.username}</span>
              {user?.role === "admin" && (
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">admin</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="outline" className="gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button variant="outline" className="gap-2" onClick={() => setShowPasswordDialog(true)}>
                <KeyRound className="h-4 w-4" />
                Change Password
              </Button>
              <Button variant="ghost" className="gap-2" onClick={() => logout.mutate()} disabled={logout.isPending}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              TikTok Connection
            </CardTitle>
            <CardDescription>
              Connect Login Kit and direct posting for completed Buzzly videos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {tiktokStatusQuery.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : tiktokStatusQuery.data?.connected ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  {tiktokStatusQuery.data?.connected ? "Connected" : "Not connected"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tiktokStatusQuery.data?.connected
                    ? `Authorized scopes: ${tiktokStatusQuery.data.scope || "TikTok posting"}`
                    : tiktokStatusQuery.data?.configured
                      ? `Ready to authorize. Server detected ${tiktokStatusQuery.data.clientKeyName || "client key"} and ${tiktokStatusQuery.data.clientSecretName || "client secret"}.`
                      : `Missing on server: ${[
                          !tiktokStatusQuery.data?.hasClientKey ? "client key" : null,
                          !tiktokStatusQuery.data?.hasClientSecret ? "client secret" : null,
                        ].filter(Boolean).join(" and ") || "TikTok config"}. Add env vars, then restart/redeploy.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  onClick={() => tiktokStatusQuery.refetch()}
                  disabled={tiktokStatusQuery.isFetching}
                  data-testid="button-refresh-tiktok-status"
                >
                  {tiktokStatusQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </Button>
                {tiktokStatusQuery.data?.connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => disconnectTikTokMutation.mutate()}
                    disabled={disconnectTikTokMutation.isPending}
                    data-testid="button-disconnect-tiktok"
                  >
                    {disconnectTikTokMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => { window.location.href = "/api/auth/tiktok"; }}
                    disabled={tiktokStatusQuery.isLoading || !tiktokStatusQuery.data?.configured}
                    data-testid="button-connect-tiktok"
                  >
                    <Send className="h-4 w-4" />
                    Connect TikTok
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tiktok-redirect-uri">TikTok OAuth redirect URI</Label>
              <Input
                id="tiktok-redirect-uri"
                value={tiktokStatusQuery.data?.redirectUri || "https://buzzly.brandbuzzer.net/api/auth/tiktok/callback"}
                readOnly
                data-testid="input-tiktok-redirect-uri"
              />
              <p className="text-xs text-muted-foreground">
                Register this exact URL in TikTok Developer Portal under Login Kit.
              </p>
            </div>
          </CardContent>
        </Card>

        {user?.role === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Admin Settings
              </CardTitle>
              <CardDescription>
                Global hidden settings for every user and setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      <Music className="h-4 w-4" />
                      Music Library
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Add multiple tracks once, then reuse them in any setup.
                    </p>
                  </div>
                  <input
                    ref={adminMusicInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("audio/"));
                      if (!files.length) {
                        toast({ title: "No audio files", description: "Please choose MP3, WAV, M4A, or another audio file.", variant: "destructive" });
                        return;
                      }
                      adminMusicMutation.mutate(files);
                      event.target.value = "";
                    }}
                    data-testid="input-admin-settings-music-library"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => adminMusicInputRef.current?.click()}
                    disabled={adminMusicMutation.isPending}
                    data-testid="button-admin-settings-upload-music"
                  >
                    {adminMusicMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload Music
                  </Button>
                </div>
                {adminMusicMutation.isPending && (
                  <div className="space-y-1">
                    <Progress value={adminMusicProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">Uploading music... {adminMusicProgress}%</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {(musicLibraryQuery.data?.length ?? 0)} uploaded track{musicLibraryQuery.data?.length === 1 ? "" : "s"} available.
                </p>
              </div>

              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4" />
                    Global Prompt Add-ons
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    These hidden admin prompts are appended after each setup prompt for all users.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="admin-hook-prompt">Hook add-on</Label>
                    <Textarea
                      id="admin-hook-prompt"
                      value={adminPromptHook}
                      onChange={(event) => setAdminPromptHook(event.target.value)}
                      rows={6}
                      placeholder="Extra global hook direction..."
                      disabled={adminPromptsQuery.isLoading || saveAdminPromptsMutation.isPending}
                      data-testid="input-admin-hook-prompt"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-caption-prompt">Caption add-on</Label>
                    <Textarea
                      id="admin-caption-prompt"
                      value={adminPromptCaption}
                      onChange={(event) => setAdminPromptCaption(event.target.value)}
                      rows={6}
                      placeholder="Extra global caption direction..."
                      disabled={adminPromptsQuery.isLoading || saveAdminPromptsMutation.isPending}
                      data-testid="input-admin-caption-prompt"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-seo-prompt">SEO add-on</Label>
                    <Textarea
                      id="admin-seo-prompt"
                      value={adminPromptSeo}
                      onChange={(event) => setAdminPromptSeo(event.target.value)}
                      rows={6}
                      placeholder="Extra global SEO direction..."
                      disabled={adminPromptsQuery.isLoading || saveAdminPromptsMutation.isPending}
                      data-testid="input-admin-seo-prompt"
                    />
                  </div>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => saveAdminPromptsMutation.mutate({
                    hookPrompt: adminPromptHook,
                    captionPrompt: adminPromptCaption,
                    seoPrompt: adminPromptSeo,
                  })}
                  disabled={adminPromptsQuery.isLoading || saveAdminPromptsMutation.isPending}
                  data-testid="button-save-admin-general-prompts"
                >
                  {saveAdminPromptsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Admin Prompts
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Excluded Words</CardTitle>
            <CardDescription>
              Set your default script length and words that should never appear in generated voiceover scripts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="script-duration-default">Default script duration</Label>
                  <p className="text-xs text-muted-foreground">Used by new setups. You can still override per setup.</p>
                </div>
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                  {scriptDurationSec}s
                </span>
              </div>
              <Slider
                id="script-duration-default"
                min={0}
                max={SCRIPT_DURATION_OPTIONS.length - 1}
                step={1}
                value={[durationIndex(scriptDurationSec)]}
                onValueChange={([index]) => setScriptDurationSec(SCRIPT_DURATION_OPTIONS[index] ?? 60)}
                disabled={settingsQuery.isLoading || saveSettingsMutation.isPending}
                data-testid="slider-default-script-duration"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                {SCRIPT_DURATION_OPTIONS.map((duration) => (
                  <span key={duration}>{duration}s</span>
                ))}
              </div>
            </div>
            <Textarea
              data-testid="input-excluded-words"
              placeholder={"e.g.\nsuper, amazing, revolutionary\ngame-changer\nunbelievable"}
              value={excludedWordsInput}
              onChange={(e) => setExcludedWordsInput(e.target.value)}
              rows={8}
              disabled={settingsQuery.isLoading || saveSettingsMutation.isPending}
            />
            <Button
              data-testid="button-save-settings"
              onClick={() => saveSettingsMutation.mutate({ excludedWords: excludedWordsInput, scriptDurationSec })}
              disabled={saveSettingsMutation.isPending || settingsQuery.isLoading}
            >
              {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Script Prompt Library</CardTitle>
            <CardDescription>
              Save reusable prompts, then load them from any setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scriptPromptsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}

            {scriptPromptsQuery.data?.map((prompt) => (
              <div key={prompt.id} className="space-y-2 rounded-lg border p-3">
                {editingPromptId === prompt.id ? (
                  <>
                    <Input
                      value={editPromptName}
                      onChange={(e) => setEditPromptName(e.target.value)}
                      placeholder="Prompt name"
                      data-testid={`input-edit-prompt-name-${prompt.id}`}
                    />
                    <Textarea
                      value={editPromptText}
                      onChange={(e) => setEditPromptText(e.target.value)}
                      rows={5}
                      placeholder="Prompt text..."
                      data-testid={`input-edit-prompt-text-${prompt.id}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={updatePromptMutation.isPending}
                        onClick={() => updatePromptMutation.mutate({ id: prompt.id, name: editPromptName, promptText: editPromptText })}
                        data-testid={`button-save-prompt-${prompt.id}`}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        {updatePromptMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPromptId(null)} data-testid={`button-cancel-edit-prompt-${prompt.id}`}>
                        <X className="mr-1 h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" data-testid={`text-prompt-name-${prompt.id}`}>{prompt.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" data-testid={`text-prompt-preview-${prompt.id}`}>
                        {prompt.promptText.slice(0, 120)}{prompt.promptText.length > 120 ? "..." : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditingPromptId(prompt.id); setEditPromptName(prompt.name); setEditPromptText(prompt.promptText); }}
                        data-testid={`button-edit-prompt-${prompt.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deletePromptMutation.mutate(prompt.id)}
                        disabled={deletePromptMutation.isPending}
                        data-testid={`button-delete-prompt-${prompt.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {scriptPromptsQuery.data?.length === 0 && !showAddPrompt && (
              <p className="text-sm text-muted-foreground">No prompts saved yet. Add your first one below.</p>
            )}

            {showAddPrompt ? (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <Input
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  placeholder="Prompt name"
                  data-testid="input-new-prompt-name"
                />
                <Textarea
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  rows={5}
                  placeholder="Write your script prompt here..."
                  data-testid="input-new-prompt-text"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={createPromptMutation.isPending || !newPromptName.trim() || !newPromptText.trim()}
                    onClick={() => createPromptMutation.mutate({ name: newPromptName, promptText: newPromptText })}
                    data-testid="button-save-new-prompt"
                  >
                    <Check className="mr-1 h-3 w-3" />
                    {createPromptMutation.isPending ? "Saving..." : "Save Prompt"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddPrompt(false); setNewPromptName(""); setNewPromptText(""); }} data-testid="button-cancel-new-prompt">
                    <X className="mr-1 h-3 w-3" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddPrompt(true)}
                data-testid="button-add-prompt"
              >
                <Plus className="mr-1 h-3 w-3" /> Add Prompt
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPassword !== confirmNewPassword) {
                toast({ title: "Passwords don't match", variant: "destructive" });
                return;
              }
              if (newPassword.length < 4) {
                toast({ title: "Password must be at least 4 characters", variant: "destructive" });
                return;
              }
              changePasswordMutation.mutate({ currentPassword, newPassword });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current Password</Label>
              <Input id="current-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required data-testid="input-current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required data-testid="input-new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-pw">Confirm New Password</Label>
              <Input id="confirm-new-pw" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required data-testid="input-confirm-new-password" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={changePasswordMutation.isPending} data-testid="button-submit-password">
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
