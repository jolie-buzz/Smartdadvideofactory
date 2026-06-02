import {
  AudioLines,
  BadgeCheck,
  Captions,
  Clapperboard,
  Focus,
  Maximize2,
  RotateCcw,
  Sparkles,
  SplitSquareHorizontal,
  WandSparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { BuzzlyTimelineItem } from "@shared/models/timeline";
import type { TimelineToolAction } from "./timeline-panel";

type ClipInspectorPanelProps = {
  selectedItem: BuzzlyTimelineItem | null;
  onUpdateItem: (id: string, patch: Partial<BuzzlyTimelineItem>) => void;
  onToolAction: (tool: TimelineToolAction) => void;
};

const slotRoles: Array<NonNullable<BuzzlyTimelineItem["slotRole"]>> = ["hook", "problem", "demo", "proof", "lifestyle", "cta"];
const effectPresets: Array<NonNullable<BuzzlyTimelineItem["effectPreset"]>> = ["none", "enhance", "punch", "vivid", "warm", "cool", "cinematic", "mono", "dream", "soft-blur"];
const transitionPresets: Array<NonNullable<BuzzlyTimelineItem["transitionIn"]>> = ["none", "fade", "slide-up", "zoom"];
const transitionOutPresets: Array<NonNullable<BuzzlyTimelineItem["transitionOut"]>> = ["none", "fade", "slide-down", "zoom"];

const titleCase = (value: string) => value.replace(/(^|-)([a-z])/g, (_, separator, letter) => `${separator ? " " : ""}${letter.toUpperCase()}`);

export function ClipInspectorPanel({ selectedItem, onUpdateItem, onToolAction }: ClipInspectorPanelProps) {
  if (!selectedItem) {
    return (
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#ffc400] text-black">
              <Focus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Clip Inspector</h2>
              <p className="text-xs text-slate-400">Select a timeline clip to edit.</p>
            </div>
          </div>
        </div>
        <div className="grid flex-1 place-items-center p-4 text-center text-sm leading-6 text-slate-400">
          Choose a shot, image, caption, or audio layer. Buzzly will keep these edits as part of the reusable setup recipe.
        </div>
      </section>
    );
  }

  const update = (patch: Partial<BuzzlyTimelineItem>) => onUpdateItem(selectedItem.id, patch);
  const canFrameEdit = selectedItem.type === "video" || selectedItem.type === "image" || selectedItem.type === "text" || selectedItem.type === "caption";
  const canResizeMedia = selectedItem.type === "video" || selectedItem.type === "image";
  const isAudio = selectedItem.type === "audio";
  const frameSize = selectedItem.frameSize || (selectedItem.type === "video"
    ? { width: 1, height: 1 }
    : selectedItem.type === "image"
    ? { width: 0.86, height: 0.86 }
    : { width: 0.72, height: 0.54 });

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#ffc400]/20 bg-[#101620]/95 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#ffc400] text-black">
                <Clapperboard className="h-4 w-4" />
              </div>
              <h2 className="truncate text-base font-semibold text-white">Clip Inspector</h2>
            </div>
            <p className="truncate text-xs text-slate-400">{selectedItem.name}</p>
          </div>
          <Button size="sm" variant="outline" className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10" onClick={() => onToolAction("reset")}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
          <div className="rounded bg-white/[0.04] px-2 py-1">Start {selectedItem.startTime.toFixed(1)}s</div>
          <div className="rounded bg-white/[0.04] px-2 py-1">Dur {selectedItem.duration.toFixed(1)}s</div>
          <div className="rounded bg-white/[0.04] px-2 py-1 capitalize">{selectedItem.type}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <InspectorSection icon={BadgeCheck} title="Slot Role">
          <div className="grid grid-cols-2 gap-2">
            {slotRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => update({ slotRole: role })}
                className={`rounded-md border px-2 py-2 text-left text-xs font-medium capitalize transition ${
                  selectedItem.slotRole === role ? "border-[#ffc400] bg-[#ffc400]/15 text-[#ffc400]" : "border-white/10 bg-black/10 text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                {titleCase(role)}
              </button>
            ))}
          </div>
        </InspectorSection>

        {canFrameEdit && (
          <InspectorSection icon={Maximize2} title="Frame">
            <SliderControl label="Zoom" value={selectedItem.scale} min={0.45} max={2.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(scale) => update({ scale })} />
            {canResizeMedia && (
              <>
                <SliderControl
                  label="Width"
                  value={frameSize.width}
                  min={0.12}
                  max={1.5}
                  step={0.01}
                  format={(value) => `${Math.round(value * 100)}%`}
                  onChange={(width) => update({ frameSize: { ...frameSize, width } })}
                />
                <SliderControl
                  label="Height"
                  value={frameSize.height}
                  min={0.12}
                  max={1.5}
                  step={0.01}
                  format={(value) => `${Math.round(value * 100)}%`}
                  onChange={(height) => update({ frameSize: { ...frameSize, height } })}
                />
              </>
            )}
            <SliderControl label="Position X" value={selectedItem.position.x} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(x) => update({ position: { ...selectedItem.position, x } })} />
            <SliderControl label="Position Y" value={selectedItem.position.y} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(y) => update({ position: { ...selectedItem.position, y } })} />
            <SliderControl label="Rotate" value={selectedItem.rotation || 0} min={-20} max={20} step={1} format={(value) => `${value}deg`} onChange={(rotation) => update({ rotation })} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10" onClick={() => onToolAction("fit")}>Fit</Button>
              <Button variant="outline" className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10" onClick={() => onToolAction("zoom-in")}>Product close-up</Button>
            </div>
            {canResizeMedia && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className={`h-8 border-white/10 text-xs hover:bg-white/10 ${selectedItem.mediaFit === "contain" ? "bg-[#ffc400]/15 text-[#ffc400]" : "bg-white/[0.03] text-white"}`}
                  onClick={() => update({ position: { x: 0.5, y: 0.5 }, frameSize: { width: 1, height: 1 }, mediaFit: "contain", scale: 1, rotation: 0 })}
                >
                  Fit inside
                </Button>
                <Button
                  variant="outline"
                  className={`h-8 border-white/10 text-xs hover:bg-white/10 ${selectedItem.mediaFit === "cover" ? "bg-[#ffc400]/15 text-[#ffc400]" : "bg-white/[0.03] text-white"}`}
                  onClick={() => update({ position: { x: 0.5, y: 0.5 }, frameSize: { width: 1, height: 1 }, mediaFit: "cover", scale: 1, rotation: 0 })}
                >
                  Fill canvas
                </Button>
              </div>
            )}
          </InspectorSection>
        )}

        <InspectorSection icon={Zap} title="Motion">
          <div className="grid grid-cols-3 gap-2">
            {[1, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => update({ playbackRate: rate })}
                className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
                  (selectedItem.playbackRate || 1) === rate ? "border-[#ffc400] bg-[#ffc400]/15 text-[#ffc400]" : "border-white/10 bg-black/10 text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10" onClick={() => onToolAction("split")}>Split clip</Button>
            <Button variant="outline" className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10" onClick={() => onToolAction("duplicate")}>Duplicate beat</Button>
          </div>
        </InspectorSection>

        {canFrameEdit && (
          <InspectorSection icon={SplitSquareHorizontal} title="Transitions">
            <div className="space-y-2">
              <Label className="text-xs text-slate-300">In</Label>
              <div className="grid grid-cols-2 gap-2">
                {transitionPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => update({ transitionIn: preset })}
                    className={`rounded-md border px-2 py-2 text-left text-xs font-medium transition ${
                      (selectedItem.transitionIn || "none") === preset ? "border-[#ffc400] bg-[#ffc400]/15 text-[#ffc400]" : "border-white/10 bg-black/10 text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    {titleCase(preset)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-300">Out</Label>
              <div className="grid grid-cols-2 gap-2">
                {transitionOutPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => update({ transitionOut: preset })}
                    className={`rounded-md border px-2 py-2 text-left text-xs font-medium transition ${
                      (selectedItem.transitionOut || "none") === preset ? "border-[#ffc400] bg-[#ffc400]/15 text-[#ffc400]" : "border-white/10 bg-black/10 text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    {titleCase(preset)}
                  </button>
                ))}
              </div>
            </div>
            <SliderControl label="Transition time" value={selectedItem.transitionDuration || 0.35} min={0.1} max={1.5} step={0.05} format={(value) => `${value.toFixed(2)}s`} onChange={(transitionDuration) => update({ transitionDuration })} />
          </InspectorSection>
        )}

        {canFrameEdit && (
          <InspectorSection icon={Focus} title="Zoom Animation">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className={`h-8 border-white/10 text-xs hover:bg-white/10 ${selectedItem.zoomAnimation?.enabled ? "bg-[#ffc400]/15 text-[#ffc400]" : "bg-white/[0.03] text-white"}`}
                onClick={() => update({ zoomAnimation: { enabled: true, startScale: selectedItem.zoomAnimation?.startScale || selectedItem.scale, endScale: selectedItem.zoomAnimation?.endScale || Math.min(2, selectedItem.scale + 0.25) } })}
              >
                Enable
              </Button>
              <Button
                variant="outline"
                className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10"
                onClick={() => update({ zoomAnimation: { enabled: false, startScale: selectedItem.scale, endScale: selectedItem.scale } })}
              >
                Off
              </Button>
            </div>
            <SliderControl
              label="Start zoom"
              value={selectedItem.zoomAnimation?.startScale || selectedItem.scale}
              min={0.45}
              max={2.5}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(startScale) => update({ zoomAnimation: { enabled: true, startScale, endScale: selectedItem.zoomAnimation?.endScale || selectedItem.scale } })}
            />
            <SliderControl
              label="End zoom"
              value={selectedItem.zoomAnimation?.endScale || Math.min(2, selectedItem.scale + 0.25)}
              min={0.45}
              max={2.5}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(endScale) => update({ zoomAnimation: { enabled: true, startScale: selectedItem.zoomAnimation?.startScale || selectedItem.scale, endScale } })}
            />
          </InspectorSection>
        )}

        {canFrameEdit && (
          <InspectorSection icon={WandSparkles} title="Effects">
            <div className="grid grid-cols-2 gap-2">
              {effectPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => update(effectPatchForPreset(preset))}
                  className={`rounded-md border px-2 py-2 text-left text-xs font-medium transition ${
                    (selectedItem.effectPreset || "none") === preset ? "border-[#ffc400] bg-[#ffc400]/15 text-[#ffc400]" : "border-white/10 bg-black/10 text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {titleCase(preset)}
                </button>
              ))}
            </div>
            <SliderControl label="Opacity" value={selectedItem.opacity} min={0.1} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(opacity) => update({ opacity })} />
            <SliderControl label="Brightness" value={selectedItem.brightness || 1} min={0.6} max={1.4} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(brightness) => update({ brightness })} />
            <SliderControl label="Contrast" value={selectedItem.contrast || 1} min={0.6} max={1.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(contrast) => update({ contrast })} />
          </InspectorSection>
        )}

        {(isAudio || selectedItem.type === "video") && (
          <InspectorSection icon={AudioLines} title="Audio">
            <SliderControl label="Volume" value={selectedItem.volume} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(volume) => update({ volume })} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10" onClick={() => onToolAction("volume")}>
                {selectedItem.volume > 0.05 ? "Mute" : "Unmute"}
              </Button>
              <Button variant="outline" className="h-8 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/10" onClick={() => update({ volume: 0.3 })}>
                Bed level
              </Button>
            </div>
          </InspectorSection>
        )}

        {(selectedItem.type === "text" || selectedItem.type === "caption") && (
          <InspectorSection icon={Captions} title="Text">
            <Textarea
              value={selectedItem.text || ""}
              onChange={(event) => update({ text: event.target.value })}
              rows={4}
              className="border-white/10 bg-black/20 text-xs text-white"
            />
          </InspectorSection>
        )}

        <InspectorSection icon={Sparkles} title="Buzzly Notes">
          <Textarea
            value={selectedItem.editNotes || ""}
            onChange={(event) => update({ editNotes: event.target.value })}
            rows={3}
            placeholder="Example: use as hook close-up, keep first 2 seconds, avoid face crop."
            className="border-white/10 bg-black/20 text-xs text-white placeholder:text-slate-500"
          />
        </InspectorSection>
      </div>
    </section>
  );
}

function InspectorSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-[#0b1018] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#ffc400]">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-slate-300">{label}</Label>
        <span className="text-[11px] font-medium text-slate-500">{format(Number(value.toFixed(2)))}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} />
    </div>
  );
}

function effectPatchForPreset(preset: NonNullable<BuzzlyTimelineItem["effectPreset"]>): Partial<BuzzlyTimelineItem> {
  if (preset === "enhance") return { effectPreset: preset, brightness: 1.08, contrast: 1.12, blur: 0 };
  if (preset === "punch") return { effectPreset: preset, brightness: 1.05, contrast: 1.18, blur: 0 };
  if (preset === "vivid") return { effectPreset: preset, brightness: 1.06, contrast: 1.08, blur: 0 };
  if (preset === "warm") return { effectPreset: preset, brightness: 1.04, contrast: 1.06, blur: 0 };
  if (preset === "cool") return { effectPreset: preset, brightness: 1.02, contrast: 1.08, blur: 0 };
  if (preset === "cinematic") return { effectPreset: preset, brightness: 0.94, contrast: 1.18, blur: 0 };
  if (preset === "mono") return { effectPreset: preset, brightness: 1, contrast: 1.12, blur: 0 };
  if (preset === "dream") return { effectPreset: preset, brightness: 1.08, contrast: 0.96, blur: 0.6 };
  if (preset === "soft-blur") return { effectPreset: preset, brightness: 1, contrast: 1, blur: 1.4 };
  return { effectPreset: "none", brightness: 1, contrast: 1, blur: 0 };
}
