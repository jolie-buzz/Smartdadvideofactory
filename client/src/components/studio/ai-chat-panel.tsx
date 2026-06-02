import { Bot, Clock3, ImagePlus, Music, Send, Sparkles, Subtitles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BuzzlyTimelineJson } from "@shared/models/timeline";

type AiChatPanelProps = {
  timeline: BuzzlyTimelineJson;
  prompt: string;
  onPromptChange: (value: string) => void;
  onMockApply: () => void;
  onSuggestionApply: (prompt: string) => void;
};

const suggestions = [
  { label: "Gawing mas funny", icon: Sparkles },
  { label: "Lagyan mo ng stronger CTA", icon: WandSparkles },
  { label: "Mas mabilis cuts", icon: Clock3 },
  { label: "Too boring", icon: Sparkles },
  { label: "Mas pang Gen Z", icon: WandSparkles },
  { label: "Palitan music", icon: Music },
  { label: "Add AI B-roll", icon: ImagePlus },
  { label: "Make intro faster", icon: Clock3 },
  { label: "Make captions more premium", icon: Subtitles },
];

export function AiChatPanel({ timeline, prompt, onPromptChange, onMockApply, onSuggestionApply }: AiChatPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-[#ffc400] text-black">
            <Bot className="h-4 w-4" />
          </div>
          <h2 className="font-semibold text-white">AI Assistant</h2>
        </div>
        <Sparkles className="h-5 w-5 text-violet-400" />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <div className="rounded-xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-xl">
          <p className="text-lg font-medium text-white">Hi John!</p>
          <p className="mt-2 text-sm text-slate-300">How can I help you create today?</p>
          <div className="my-5 h-px bg-white/10" />
          <p className="mb-3 text-sm text-slate-300">Try these:</p>
          <div className="space-y-2">
            {suggestions.map((suggestion) => {
              const Icon = suggestion.icon;
              return (
                <button
                  key={suggestion.label}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-[#0d131d] px-3 py-3 text-left text-sm text-slate-100 transition hover:border-[#ffc400]/50 hover:bg-white/[0.06]"
                  onClick={() => onSuggestionApply(suggestion.label)}
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  {suggestion.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-2 text-sm font-semibold text-white">Creative direction</p>
          <p className="text-sm leading-6 text-slate-400">{timeline.aiPlan.objective}</p>
          <div className="mt-4 rounded-lg border border-white/10 bg-[#0b1018] p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-300">Conversational Editing</p>
            <p className="text-xs leading-5 text-slate-300">{timeline.conversationalEditing.principle.replaceAll("-", " ")}</p>
            {timeline.conversationalEditing.recentEdits[0] && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Buzzly: {timeline.conversationalEditing.recentEdits[0].response}
              </p>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-[#0b1018] p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">AI Timeline Engine</p>
            <p className="text-xs leading-5 text-slate-300">{timeline.aiTimelineEngine.principle.replaceAll("-", " ")}</p>
            {timeline.aiTimelineEngine.lastCommand && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Last edit: {timeline.aiTimelineEngine.lastCommand.summary}
              </p>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-[#0b1018] p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Hook</p>
            <p className="text-xs leading-5 text-slate-300">{timeline.creativeBrain.output.hookDirection}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-5">
        <div className="grid grid-cols-[1fr_auto] items-end gap-3 rounded-2xl border border-white/10 bg-[#0b1018] p-2">
          <Textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={2}
            placeholder="Type your request..."
            className="min-h-12 resize-none border-0 bg-transparent text-sm text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0"
          />
          <Button size="icon" variant="ghost" className="h-10 w-10 text-slate-200 hover:bg-white/10 hover:text-white" onClick={onMockApply}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
