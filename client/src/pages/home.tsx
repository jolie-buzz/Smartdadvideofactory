import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { SetupForm } from "@/components/setup-form";
import { SetupsList } from "@/components/setups-list";
import { JobsList } from "@/components/jobs-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Settings, Zap, Video, FolderOpen, LogOut, User, Shield, KeyRound, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Asset, ScriptPrompt } from "@shared/schema";

export default function Home() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("setups");
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [excludedWordsInput, setExcludedWordsInput] = useState("");

  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptText, setEditPromptText] = useState("");

  const scriptPromptsQuery = useQuery<ScriptPrompt[]>({
    queryKey: ["/api/script-prompts"],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/script-prompts"] });
      setEditingPromptId(null);
      toast({ title: "Prompt updated" });
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

  const settingsQuery = useQuery<{ excludedWords: string | null }>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setExcludedWordsInput(settingsQuery.data.excludedWords ?? "");
    }
  }, [settingsQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { excludedWords: string }) => {
      const res = await apiRequest("PATCH", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved", description: "Excluded words updated. Will apply to all future jobs." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setActiveTab("setup");
  };

  const handleCancelEdit = () => {
    setEditingAsset(null);
    setActiveTab("setups");
  };

  const handleFormComplete = () => {
    setEditingAsset(null);
    setActiveTab("setups");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-app-title">
                SmartDad Video Factory
              </h1>
              <p className="text-sm text-muted-foreground">
                AI-powered video production pipeline
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-current-user">
              <User className="w-4 h-4" />
              <span>{user?.username}</span>
              {user?.role === "admin" && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">admin</span>
              )}
            </div>
            {user?.role === "admin" && (
              <Link href="/admin">
                <Button variant="outline" className="gap-2" data-testid="link-admin">
                  <Shield className="w-4 h-4" />
                  Admin
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPasswordDialog(true)}
              title="Change password"
              data-testid="button-change-password"
            >
              <KeyRound className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              data-testid="button-logout"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "setup") setEditingAsset(null); }} className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-4 mx-auto">
            <TabsTrigger value="setup" className="gap-2" data-testid="tab-setup">
              <Settings className="w-4 h-4" />
              {editingAsset ? "Edit" : "New Setup"}
            </TabsTrigger>
            <TabsTrigger value="setups" className="gap-2" data-testid="tab-setups">
              <FolderOpen className="w-4 h-4" />
              Setups
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-2" data-testid="tab-jobs">
              <Zap className="w-4 h-4" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <KeyRound className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup">
            <SetupForm
              onComplete={handleFormComplete}
              editingAsset={editingAsset}
              onCancelEdit={handleCancelEdit}
            />
          </TabsContent>

          <TabsContent value="setups">
            <SetupsList onActivate={() => setActiveTab("jobs")} onEdit={handleEdit} />
          </TabsContent>

          <TabsContent value="jobs">
            <JobsList />
          </TabsContent>

          <TabsContent value="settings">
            <div className="max-w-2xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Excluded Words</CardTitle>
                  <CardDescription>
                    Words or phrases listed here will never appear in any generated voiceover script. This applies to all setups and all future jobs. Enter one per line or separate with commas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    onClick={() => saveSettingsMutation.mutate({ excludedWords: excludedWordsInput })}
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
                    Save reusable prompts here. In any setup, you can load one to instantly pre-fill the script prompt field — then edit it freely per product.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scriptPromptsQuery.isLoading && (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  )}

                  {scriptPromptsQuery.data?.map((prompt) => (
                    <div key={prompt.id} className="border rounded-lg p-3 space-y-2">
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
                              <Check className="w-3 h-3 mr-1" />
                              {updatePromptMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingPromptId(null)} data-testid={`button-cancel-edit-prompt-${prompt.id}`}>
                              <X className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`text-prompt-name-${prompt.id}`}>{prompt.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5" data-testid={`text-prompt-preview-${prompt.id}`}>
                              {prompt.promptText.slice(0, 120)}{prompt.promptText.length > 120 ? "…" : ""}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => { setEditingPromptId(prompt.id); setEditPromptName(prompt.name); setEditPromptText(prompt.promptText); }}
                              data-testid={`button-edit-prompt-${prompt.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deletePromptMutation.mutate(prompt.id)}
                              disabled={deletePromptMutation.isPending}
                              data-testid={`button-delete-prompt-${prompt.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
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
                    <div className="border rounded-lg p-3 space-y-2 border-dashed">
                      <Input
                        value={newPromptName}
                        onChange={(e) => setNewPromptName(e.target.value)}
                        placeholder="Prompt name (e.g. Skincare Persona v1)"
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
                          <Check className="w-3 h-3 mr-1" />
                          {createPromptMutation.isPending ? "Saving..." : "Save Prompt"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAddPrompt(false); setNewPromptName(""); setNewPromptText(""); }} data-testid="button-cancel-new-prompt">
                          <X className="w-3 h-3 mr-1" /> Cancel
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
                      <Plus className="w-3 h-3 mr-1" /> Add Prompt
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

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
              <Input
                id="current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-pw">Confirm New Password</Label>
              <Input
                id="confirm-new-pw"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                data-testid="input-confirm-new-password"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={changePasswordMutation.isPending} data-testid="button-submit-password">
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
