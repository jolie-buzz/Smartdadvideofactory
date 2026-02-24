import { useState } from "react";
import { SetupForm } from "@/components/setup-form";
import { SetupsList } from "@/components/setups-list";
import { JobsList } from "@/components/jobs-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Zap, Video, FolderOpen } from "lucide-react";
import type { Asset } from "@shared/schema";

export default function Home() {
  const [activeTab, setActiveTab] = useState("setups");
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

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
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
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
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "setup") setEditingAsset(null); }} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 mx-auto">
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
        </Tabs>
      </main>
    </div>
  );
}
