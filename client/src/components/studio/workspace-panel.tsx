import { BriefcaseBusiness, FileText, Library, Mic2, Palette, Shapes, SwatchBook, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { BuzzlyStyleDnaSystem, BuzzlyTeamMember, BuzzlyTimelineJson, BuzzlyWorkspace, BuzzlyWorkspaceSystem } from "@shared/models/timeline";

type WorkspacePanelProps = {
  system: BuzzlyWorkspaceSystem;
  timeline: BuzzlyTimelineJson;
  styleSystem: BuzzlyStyleDnaSystem;
  teamMembers: BuzzlyTeamMember[];
  canManage: boolean;
  onSwitchWorkspace: (workspace: BuzzlyWorkspace) => void;
  onApplyWorkspace: () => void;
};

export function WorkspacePanel({ system, timeline, styleSystem, teamMembers, canManage, onSwitchWorkspace, onApplyWorkspace }: WorkspacePanelProps) {
  const activeWorkspace = system.workspaces.find((workspace) => workspace.id === system.activeWorkspaceId) || system.workspaces[0];
  const workspaceAssets = timeline.tracks
    .flatMap((track) => track.items)
    .filter((item) => activeWorkspace.assetIds.includes(item.id));
  const workspaceStyles = styleSystem.presets.filter((preset) => activeWorkspace.stylePresetIds.includes(preset.id));
  const workspaceTeam = teamMembers.filter((member) => activeWorkspace.teamMemberIds.includes(member.id));

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-blue-300/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-300 text-black">
              <BriefcaseBusiness className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Workspace</h2>
              <p className="text-xs text-slate-400">Client-ready agency container.</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onApplyWorkspace}
            disabled={!canManage}
            className="h-8 bg-blue-300 px-3 font-semibold text-black hover:bg-blue-200 disabled:opacity-45"
          >
            Apply
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-300">
          {activeWorkspace.name} keeps its own assets, styles, prompts, team, brand voice, colors, and templates.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="grid gap-2">
          {system.workspaces.map((workspace) => {
            const isActive = workspace.id === system.activeWorkspaceId;
            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => onSwitchWorkspace(workspace)}
                className={`rounded-lg border p-3 text-left transition ${isActive ? "border-blue-300/45 bg-blue-300/10" : "border-white/10 bg-[#0b1018] hover:border-blue-300/35 hover:bg-white/[0.05]"}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{workspace.name}</p>
                  <span className="rounded bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">
                    {workspace.clientType.replace("-", " ")}
                  </span>
                </div>
                <p className="text-xs leading-5 text-slate-400">{workspace.brandVoice}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
          <WorkspaceStat icon={Shapes} label="Assets" value={activeWorkspace.assetIds.length} />
          <WorkspaceStat icon={Palette} label="Styles" value={activeWorkspace.stylePresetIds.length} />
          <WorkspaceStat icon={FileText} label="Prompts" value={activeWorkspace.promptLibrary.length} />
          <WorkspaceStat icon={Users} label="Team" value={activeWorkspace.teamMemberIds.length} />
        </div>

        <WorkspaceSection icon={Shapes} title="Assets">
          <div className="grid grid-cols-2 gap-2">
            {workspaceAssets.map((asset) => (
              <div key={asset.id} className="rounded bg-white/[0.04] px-2 py-2">
                <p className="truncate text-xs font-semibold text-white">{asset.name}</p>
                <p className="text-[11px] capitalize text-slate-500">{asset.type} · {asset.source?.kind || "local"}</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection icon={SwatchBook} title="Styles">
          <div className="space-y-2">
            {workspaceStyles.map((style) => (
              <div key={style.id} className="rounded bg-white/[0.04] px-2 py-2">
                <p className="text-xs font-semibold text-white">{style.name}</p>
                <p className="text-[11px] text-slate-500">{style.traits.slice(0, 3).map((trait) => trait.replace("-", " ")).join(", ")}</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection icon={Library} title="Prompts">
          <div className="space-y-2">
            {activeWorkspace.promptLibrary.map((prompt) => (
              <p key={prompt} className="rounded bg-white/[0.04] px-2 py-2 text-xs leading-5 text-slate-300">{prompt}</p>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection icon={Users} title="Team">
          <div className="grid grid-cols-2 gap-2">
            {workspaceTeam.map((member) => (
              <div key={member.id} className="rounded bg-white/[0.04] px-2 py-2">
                <p className="truncate text-xs font-semibold text-white">{member.name}</p>
                <p className="text-[11px] capitalize text-slate-500">{member.role}</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection icon={Mic2} title="Brand Voice">
          <p className="text-xs leading-5 text-slate-300">{activeWorkspace.brandVoice}</p>
        </WorkspaceSection>

        <WorkspaceSection icon={Palette} title="Colors">
          <div className="flex flex-wrap gap-2">
            {activeWorkspace.colors.map((color) => (
              <span key={color} className="h-6 w-6 rounded-full border border-white/20" style={{ backgroundColor: color }} title={color} />
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection icon={FileText} title="Templates">
          <div className="space-y-2">
            {activeWorkspace.templates.map((template) => (
              <div key={template.id} className="rounded bg-white/[0.04] px-2 py-2">
                <p className="text-xs font-semibold text-white">{template.name}</p>
                <p className="text-[11px] text-slate-500">{template.duration}s · {template.useCase}</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>
      </div>
    </section>
  );
}

function WorkspaceSection({ icon: Icon, title, children }: { icon: typeof Shapes; title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function WorkspaceStat({ icon: Icon, label, value }: { icon: typeof Shapes; label: string; value: number }) {
  return (
    <div className="rounded bg-white/[0.04] px-2 py-2">
      <div className="mb-1 flex items-center gap-1 text-blue-200">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
