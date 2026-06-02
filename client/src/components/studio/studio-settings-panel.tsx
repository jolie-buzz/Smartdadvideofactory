import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, KeyRound, LogOut, Pencil, Plus, Shield, Trash2, User, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ScriptPrompt } from "@shared/schema";

export function StudioSettingsPanel() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [excludedWordsInput, setExcludedWordsInput] = useState("");
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

  const settingsQuery = useQuery<{ excludedWords: string | null }>({
    queryKey: ["/api/settings"],
  });

  const scriptPromptsQuery = useQuery<ScriptPrompt[]>({
    queryKey: ["/api/script-prompts"],
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
      toast({ title: "Settings saved", description: "Excluded words updated for future jobs." });
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
            <CardTitle>Excluded Words</CardTitle>
            <CardDescription>
              Words or phrases listed here will never appear in generated voiceover scripts.
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
