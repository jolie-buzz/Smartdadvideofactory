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
import { Settings, Zap, Video, FolderOpen, LogOut, User, Shield, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Asset } from "@shared/schema";

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
