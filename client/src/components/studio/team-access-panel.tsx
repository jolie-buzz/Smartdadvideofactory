import { Crown, Edit3, Eye, ShieldCheck, Sparkles, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuzzlyTeamMember, BuzzlyUserRole, BuzzlyUserSystem } from "@shared/models/timeline";

type TeamAccessPanelProps = {
  system: BuzzlyUserSystem;
  onSwitchMember: (member: BuzzlyTeamMember) => void;
};

const roleIcons: Record<BuzzlyUserRole, typeof Crown> = {
  owner: Crown,
  editor: Edit3,
  creator: Sparkles,
  viewer: Eye,
};

const roleSummaries: Record<BuzzlyUserRole, string> = {
  owner: "Controls team, Brand DNA, project edits, generation, and reviews.",
  editor: "Can edit projects, generate assets, and review.",
  creator: "Can generate assets and review, but cannot manually edit timeline.",
  viewer: "Review only. No editing or generation actions.",
};

export function TeamAccessPanel({ system, onSwitchMember }: TeamAccessPanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-amber-300/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-300 text-black">
            <UserCog className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Team Access</h2>
            <p className="text-xs text-slate-400">Multi-level agency roles.</p>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-300">{roleSummaries[system.currentRole]}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {system.members.map((member) => {
          const Icon = roleIcons[member.role];
          const isActive = member.id === system.currentUserId;
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSwitchMember(member)}
              className={`w-full rounded-lg border p-3 text-left transition ${isActive ? "border-amber-300/45 bg-amber-300/10" : "border-white/10 bg-[#0b1018] hover:border-amber-300/35 hover:bg-white/[0.05]"}`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-amber-200" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{member.name}</p>
                    <p className="text-[11px] capitalize text-slate-500">{member.role}</p>
                  </div>
                </div>
                {isActive && (
                  <span className="rounded bg-amber-300/15 px-2 py-1 text-[10px] font-semibold uppercase text-amber-100">
                    Active
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {member.permissions.map((permission) => (
                  <span key={permission} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-slate-300">
                    <ShieldCheck className="h-3 w-3" />
                    {permission.replace("-", " ")}
                  </span>
                ))}
              </div>
            </button>
          );
        })}

        <Button variant="outline" className="h-9 w-full border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10">
          Owner manages invites later
        </Button>
      </div>
    </section>
  );
}
