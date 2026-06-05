export type BuzzlyClipType = "video" | "image" | "audio" | "text" | "caption";

export type BuzzlySource = {
  kind: "local" | "remote" | "generated" | "mock";
  uri?: string;
  r2Key?: string;
  filename?: string;
  mimeType?: string;
};

export type BuzzlyPosition = {
  x: number;
  y: number;
};

export type BuzzlyFrameSize = {
  width: number;
  height: number;
};

export type BuzzlyTimelineItem = {
  id: string;
  type: BuzzlyClipType;
  name: string;
  trackId: string;
  source?: BuzzlySource;
  text?: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  position: BuzzlyPosition;
  frameSize?: BuzzlyFrameSize;
  mediaFit?: "contain" | "cover";
  scale: number;
  opacity: number;
  rotation?: number;
  playbackRate?: number;
  brightness?: number;
  contrast?: number;
  blur?: number;
  effectPreset?: "none" | "enhance" | "warm" | "cool" | "cinematic" | "soft-blur" | "punch" | "mono" | "dream" | "vivid";
  transitionIn?: "none" | "fade" | "slide-up" | "zoom";
  transitionOut?: "none" | "fade" | "slide-down" | "zoom";
  transitionDuration?: number;
  zoomAnimation?: {
    enabled: boolean;
    startScale: number;
    endScale: number;
  };
  slotRole?: "hook" | "problem" | "demo" | "proof" | "lifestyle" | "cta";
  editNotes?: string;
};

export type BuzzlyTimelineTrack = {
  id: string;
  type: BuzzlyClipType;
  name: string;
  locked?: boolean;
  muted?: boolean;
  items: BuzzlyTimelineItem[];
};

export type BuzzlyAiPlanScene = {
  id: string;
  title: string;
  goal: string;
  script: string;
  captionText: string;
  clipSelection: string[];
  musicSuggestion: string;
  cta: string;
};

export type BuzzlyCreativeBrainInput = {
  goal: string;
  style: string;
  persona: string;
  product: string;
  platform: string;
  audience: string;
  userIdea: string;
};

export type BuzzlyCreativeBrainOutput = {
  contentStrategy: string;
  flow: string[];
  hookDirection: string;
  pacing: string;
  visualsNeeded: string[];
  missingAssets: string[];
};

export type BuzzlyAssetCategory =
  | "hook-shot"
  | "emotional-shot"
  | "product-closeup"
  | "face-clip"
  | "movement-clip"
  | "aesthetic-shot"
  | "demo-shot"
  | "before-after"
  | "music-bed"
  | "voiceover"
  | "packshot";

export type BuzzlyAssetMappingItem = {
  assetId: string;
  assetName: string;
  filename: string;
  sourceKind: BuzzlySource["kind"];
  mediaType: BuzzlyClipType;
  categories: BuzzlyAssetCategory[];
  confidence: number;
  detectedMoments: string[];
  bestUse: string;
  strategyFit: "high" | "medium" | "low";
};

export type BuzzlyAssetIntelligence = {
  mode: "smart-asset-mapping";
  lastScanStatus: "mock-ready" | "needs-scan" | "scanned";
  summary: string;
  coverage: {
    ready: BuzzlyAssetCategory[];
    missing: BuzzlyAssetCategory[];
  };
  mappings: BuzzlyAssetMappingItem[];
};

export type BuzzlyGenerationModality = "image" | "video" | "voice";

export type BuzzlyGenerationEngine =
  | "chatgpt"
  | "gpt-image"
  | "flux"
  | "gemini-flow"
  | "ideogram"
  | "veo"
  | "seedance"
  | "kling"
  | "runway"
  | "pika"
  | "grok-video"
  | "elevenlabs"
  | "openai-voice";

export type BuzzlyGenerationRouterPriority = "quality" | "speed" | "cost" | "realism" | "animation" | "lip-sync" | "emotion" | "language";

export type BuzzlyGenerationRoute = {
  modality: BuzzlyGenerationModality;
  selectedEngine: BuzzlyGenerationEngine;
  alternatives: BuzzlyGenerationEngine[];
  decisionFactors: BuzzlyGenerationRouterPriority[];
  reason: string;
  estimatedCost: "low" | "medium" | "high";
  estimatedSpeed: "fast" | "standard" | "slow";
  status: "recommended" | "ready" | "needs-provider";
};

export type BuzzlyHybridGeneration = {
  mode: "ai-router-system";
  principle: "users-care-about-results-not-models";
  routingGoal: string;
  routes: BuzzlyGenerationRoute[];
  providerPool: {
    image: Array<Extract<BuzzlyGenerationEngine, "chatgpt" | "gpt-image" | "flux" | "ideogram">>;
    video: Array<Extract<BuzzlyGenerationEngine, "gemini-flow" | "veo" | "seedance" | "kling" | "runway" | "pika" | "grok-video">>;
    voice: Array<Extract<BuzzlyGenerationEngine, "elevenlabs" | "openai-voice">>;
  };
};

export type BuzzlySmartSceneType =
  | "cinematic-closeup"
  | "lifestyle-shot"
  | "motion-scene"
  | "ai-broll"
  | "background-animation";

export type BuzzlySmartSceneSuggestion = {
  id: string;
  title: string;
  type: BuzzlySmartSceneType;
  fillsGap: BuzzlyAssetCategory;
  prompt: string;
  recommendedEngine: BuzzlyGenerationEngine;
  duration: number;
  status: "suggested" | "generated" | "in-timeline";
};

export type BuzzlySmartSceneGeneration = {
  mode: "auto-generate-missing-scenes";
  principle: "solve-kulang-assets-for-small-businesses";
  summary: string;
  inputAssetCount: number;
  suggestions: BuzzlySmartSceneSuggestion[];
};

export type BuzzlyPerformanceMetricKey =
  | "hook-strength"
  | "retention-pacing"
  | "dead-moments"
  | "visual-overload"
  | "cta-timing"
  | "subtitle-speed"
  | "emotional-variation"
  | "audio-energy";

export type BuzzlyPerformanceMetric = {
  key: BuzzlyPerformanceMetricKey;
  label: string;
  score: number;
  status: "strong" | "watch" | "fix";
  insight: string;
};

export type BuzzlyPerformanceCommand =
  | "shorten-intro"
  | "faster-first-3-seconds"
  | "stronger-cta"
  | "remove-weak-clip"
  | "premium-subtitles"
  | "boost-audio-energy"
  | "add-emotional-variation";

export type BuzzlyPerformanceSuggestion = {
  id: string;
  title: string;
  command: BuzzlyPerformanceCommand;
  impact: number;
  reason: string;
  timelinePrompt: string;
  status: "suggested" | "applied";
};

export type BuzzlyPerformanceEngine = {
  mode: "ai-creative-analyst";
  principle: "performance-is-the-core-moat";
  viralPotentialScore: number;
  summary: string;
  metrics: BuzzlyPerformanceMetric[];
  suggestions: BuzzlyPerformanceSuggestion[];
  lastAnalyzedAt: string;
};

export type BuzzlyStyleDnaTrait =
  | "fast-cuts"
  | "punchy-hooks"
  | "emotional-humor"
  | "aggressive-captions"
  | "minimal"
  | "slow"
  | "cinematic"
  | "elegant-subtitles"
  | "sales-focused"
  | "direct"
  | "premium-cta";

export type BuzzlyStyleDnaPreset = {
  id: string;
  name: string;
  description: string;
  traits: BuzzlyStyleDnaTrait[];
  pacing: string;
  hookStyle: string;
  captionStyle: string;
  ctaStyle: string;
  createdBy: "admin" | "system";
};

export type BuzzlyStyleDnaSystem = {
  mode: "brand-dna-presets";
  principle: "admins-create-style-users-apply-instantly";
  activePresetId: string;
  presets: BuzzlyStyleDnaPreset[];
  lastAppliedAt: string;
};

export type BuzzlyUserRole = "owner" | "editor" | "creator" | "viewer";

export type BuzzlyUserPermission =
  | "manage-team"
  | "manage-workspace"
  | "manage-style-dna"
  | "edit-project"
  | "generate-assets"
  | "review-only";

export type BuzzlyTeamMember = {
  id: string;
  name: string;
  role: BuzzlyUserRole;
  permissions: BuzzlyUserPermission[];
};

export type BuzzlyUserSystem = {
  mode: "multi-level-agency-access";
  principle: "owners-control-teams-roles-control-actions";
  currentUserId: string;
  currentRole: BuzzlyUserRole;
  members: BuzzlyTeamMember[];
};

export type BuzzlyWorkspaceTemplate = {
  id: string;
  name: string;
  format: BuzzlyTimelineJson["project"]["format"];
  duration: number;
  useCase: string;
};

export type BuzzlyWorkspace = {
  id: string;
  name: string;
  clientType: "brand" | "agency-client" | "internal";
  assetIds: string[];
  stylePresetIds: string[];
  promptLibrary: string[];
  teamMemberIds: string[];
  brandVoice: string;
  colors: string[];
  templates: BuzzlyWorkspaceTemplate[];
};

export type BuzzlyWorkspaceSystem = {
  mode: "agency-client-workspaces";
  principle: "each-client-keeps-assets-styles-prompts-team-and-brand-rules";
  activeWorkspaceId: string;
  workspaces: BuzzlyWorkspace[];
};

export type BuzzlyMemorySignalKey =
  | "preferred-pacing"
  | "favorite-hooks"
  | "best-performing-captions"
  | "preferred-voices"
  | "common-cta";

export type BuzzlyMemorySignal = {
  key: BuzzlyMemorySignalKey;
  label: string;
  value: string;
  confidence: number;
  source: "behavior" | "performance" | "manual";
};

export type BuzzlyAiMemorySystem = {
  mode: "personalization-memory";
  principle: "buzzly-adapts-to-the-creator-over-time";
  profileName: string;
  summary: string;
  signals: BuzzlyMemorySignal[];
  lastAppliedAt: string;
};

export type BuzzlyRenderEffectTier = "lightweight" | "standard" | "heavy";

export type BuzzlyRenderingArchitecture = {
  mode: "speed-first-rendering";
  principle: "fast-short-form-exports-are-the-advantage";
  targetResolution: {
    width: number;
    height: number;
  };
  maxRecommendedDuration: number;
  targetExportSeconds: number;
  benchmark: string;
  effectPolicy: {
    allowed: string[];
    avoid: string[];
    tier: BuzzlyRenderEffectTier;
  };
  pipeline: Array<"timeline-json" | "asset-normalization" | "preview-cache" | "remotion-render" | "ffmpeg-package">;
  currentEstimate: {
    duration: number;
    estimatedExportSeconds: number;
    speedScore: number;
    status: "fast" | "watch" | "too-heavy";
    notes: string[];
  };
};

export type BuzzlyAiPipelineStepKey =
  | "user-idea"
  | "ai-planning"
  | "asset-scanning"
  | "missing-asset-detection"
  | "ai-asset-generation"
  | "script-generation"
  | "voice-generation"
  | "timeline-auto-assembly"
  | "subtitle-music"
  | "performance-optimization"
  | "render"
  | "chat-based-revisions";

export type BuzzlyAiPipelineStep = {
  key: BuzzlyAiPipelineStepKey;
  label: string;
  description: string;
  ownerLayer: string;
  status: "ready" | "running" | "done" | "needs-input";
};

export type BuzzlyAiPipeline = {
  mode: "idea-to-render-ai-pipeline";
  principle: "strategy-assets-generation-timeline-performance-render-chat";
  currentStep: BuzzlyAiPipelineStepKey;
  summary: string;
  steps: BuzzlyAiPipelineStep[];
};

export type BuzzlyTimelineCommand =
  | "make-intro-faster"
  | "add-stronger-hook"
  | "change-music-emotional"
  | "shorten-duration"
  | "premium-captions"
  | "add-product-closeups"
  | "make-funnier"
  | "stronger-cta"
  | "faster-cuts"
  | "fix-boring"
  | "gen-z-style"
  | "change-music"
  | "add-ai-broll"
  | "manual-trim"
  | "manual-reorder";

export type BuzzlyTimelineEngine = {
  mode: "ai-plus-timeline";
  principle: "creators-keep-control";
  layout: {
    left: string[];
    center: string[];
    right: string[];
  };
  capabilities: BuzzlyTimelineCommand[];
  lastCommand: {
    prompt: string;
    action: BuzzlyTimelineCommand;
    summary: string;
  } | null;
};

export type BuzzlyConversationalIntent =
  | "tone-funny"
  | "cta-stronger"
  | "pace-faster"
  | "fix-boring"
  | "style-gen-z"
  | "music-change"
  | "add-ai-broll"
  | "timeline-edit";

export type BuzzlyConversationEdit = {
  id: string;
  userMessage: string;
  detectedIntent: BuzzlyConversationalIntent;
  timelineAction: BuzzlyTimelineCommand;
  response: string;
};

export type BuzzlyConversationalEditing = {
  mode: "chat-first-editing";
  principle: "natural-language-controls-the-timeline";
  supportedPhrases: string[];
  recentEdits: BuzzlyConversationEdit[];
};

export type BuzzlyCreativePlanBeatKey = "hook" | "problem" | "solution" | "highlight" | "cta";

export type BuzzlyCreativePlanBeat = {
  key: BuzzlyCreativePlanBeatKey;
  label: string;
  line: string;
  purpose: string;
  duration: number;
  visualDirection: string;
};

export type BuzzlyPlanningLayer = {
  mode: "creative-plan-before-generation";
  principle: "strategy-first-not-random-generation";
  planName: string;
  beats: BuzzlyCreativePlanBeat[];
  generationBrief: string;
};

export type BuzzlyTimelineJson = {
  version: "buzzly.timeline.v1";
  project: {
    id: string;
    name: string;
    format: "tiktok-reel-9x16" | "square-1x1" | "landscape-16x9";
    width: number;
    height: number;
    fps: number;
    duration: number;
  };
  creativeBrain: {
    mode: "creative-director-first";
    input: BuzzlyCreativeBrainInput;
    output: BuzzlyCreativeBrainOutput;
  };
  assetIntelligence: BuzzlyAssetIntelligence;
  hybridGeneration: BuzzlyHybridGeneration;
  smartSceneGeneration: BuzzlySmartSceneGeneration;
  performanceEngine: BuzzlyPerformanceEngine;
  styleDnaSystem: BuzzlyStyleDnaSystem;
  userSystem: BuzzlyUserSystem;
  workspaceSystem: BuzzlyWorkspaceSystem;
  aiMemorySystem: BuzzlyAiMemorySystem;
  renderingArchitecture: BuzzlyRenderingArchitecture;
  aiPipeline: BuzzlyAiPipeline;
  aiTimelineEngine: BuzzlyTimelineEngine;
  conversationalEditing: BuzzlyConversationalEditing;
  planningLayer: BuzzlyPlanningLayer;
  tracks: BuzzlyTimelineTrack[];
  aiPlan: {
    objective: string;
    scenes: BuzzlyAiPlanScene[];
    seoKeywords: string[];
  };
  render: {
    primary: "remotion";
    helpers: Array<"ffmpeg">;
    futurePreview: Array<"webcodecs">;
  };
};

export const mockBuzzlyTimeline: BuzzlyTimelineJson = {
  version: "buzzly.timeline.v1",
  project: {
    id: "studio-mock-project",
    name: "Untitled Buzzly Project",
    format: "tiktok-reel-9x16",
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 30,
  },
  creativeBrain: {
    mode: "creative-director-first",
    input: {
      goal: "Sales",
      style: "Fast TikTok UGC",
      persona: "Practical, direct, warm parent voice",
      product: "SmartDad cleaning helper",
      platform: "TikTok/Reels",
      audience: "Busy moms",
      userIdea: "Pain point ng hirap mag linis",
    },
    output: {
      contentStrategy: "Lead with a relatable cleaning frustration, prove the product saves time, then close with a simple before/after payoff.",
      flow: [
        "Pain point: messy room after a long day",
        "Pattern interrupt hook in the first 2 seconds",
        "Quick product proof showing the product doing the hard part",
        "Proof shot with cleaner space and relieved parent",
        "CTA with easy next step",
      ],
      hookDirection: "Show the mess first, then call out the exact feeling: pagod ka na, tapos may lilinisin pa.",
      pacing: "Fast cuts every 1.5-2.5 seconds, captions on every beat, no long intro.",
      visualsNeeded: [
        "Messy floor or kitchen counter",
        "Parent reaction close-up",
        "Product in-hand proof",
        "Before/after comparison",
        "Final product packshot",
      ],
      missingAssets: [
        "Authentic messy-home clip",
        "Product close-up in use",
        "Relieved parent reaction shot",
      ],
    },
  },
  assetIntelligence: {
    mode: "smart-asset-mapping",
    lastScanStatus: "mock-ready",
    summary: "Buzzly has enough hook, product proof, voiceover, and music assets for a first cut, but needs stronger emotional and before/after proof shots.",
    coverage: {
      ready: ["hook-shot", "demo-shot", "product-closeup", "packshot", "voiceover", "music-bed"],
      missing: ["emotional-shot", "face-clip", "before-after"],
    },
    mappings: [
      {
        assetId: "clip-hook",
        assetName: "Hook clip",
        filename: "product-hook.mp4",
        sourceKind: "mock",
        mediaType: "video",
        categories: ["hook-shot", "movement-clip"],
        confidence: 0.88,
        detectedMoments: ["fast first frame", "pattern interrupt", "hand movement"],
        bestUse: "Open the ad and stop the scroll in the first 2 seconds.",
        strategyFit: "high",
      },
      {
        assetId: "clip-demo",
        assetName: "Product proof",
        filename: "product-proof.mp4",
        sourceKind: "mock",
        mediaType: "video",
        categories: ["demo-shot", "product-closeup", "movement-clip"],
        confidence: 0.91,
        detectedMoments: ["product in use", "clear action", "medium close shot"],
        bestUse: "Prove the product benefit after the hook.",
        strategyFit: "high",
      },
      {
        assetId: "product-packshot",
        assetName: "Product packshot",
        filename: "packshot.png",
        sourceKind: "mock",
        mediaType: "image",
        categories: ["packshot", "product-closeup", "aesthetic-shot"],
        confidence: 0.84,
        detectedMoments: ["clean product frame", "end-card ready"],
        bestUse: "Use for the CTA or offer end card.",
        strategyFit: "medium",
      },
      {
        assetId: "voiceover",
        assetName: "AI voiceover",
        filename: "elevenlabs-voiceover.mp3",
        sourceKind: "generated",
        mediaType: "audio",
        categories: ["voiceover"],
        confidence: 0.96,
        detectedMoments: ["generated narration", "script timing"],
        bestUse: "Carry the narrative through the full ad.",
        strategyFit: "high",
      },
      {
        assetId: "music-bed",
        assetName: "Music bed",
        filename: "upbeat-pop.mp3",
        sourceKind: "mock",
        mediaType: "audio",
        categories: ["music-bed"],
        confidence: 0.79,
        detectedMoments: ["upbeat rhythm", "background energy"],
        bestUse: "Support fast TikTok pacing under the voiceover.",
        strategyFit: "medium",
      },
    ],
  },
  hybridGeneration: {
    mode: "ai-router-system",
    principle: "users-care-about-results-not-models",
    routingGoal: "Choose the best generation engine for the creative job, not the most familiar model name.",
    providerPool: {
      image: ["chatgpt", "gpt-image", "flux", "ideogram"],
      video: ["gemini-flow", "veo", "seedance", "kling", "runway", "pika", "grok-video"],
      voice: ["elevenlabs", "openai-voice"],
    },
    routes: [
      {
        modality: "image",
        selectedEngine: "gpt-image",
        alternatives: ["chatgpt", "flux", "ideogram"],
        decisionFactors: ["quality", "realism"],
        reason: "Best default for clean product visuals and editable brand-safe concepts.",
        estimatedCost: "medium",
        estimatedSpeed: "standard",
        status: "recommended",
      },
      {
        modality: "video",
        selectedEngine: "gemini-flow",
        alternatives: ["seedance", "kling", "veo", "runway", "pika", "grok-video"],
        decisionFactors: ["speed", "realism"],
        reason: "Best fit for turning a small set of product photos into scene flow, motion, and missing B-roll.",
        estimatedCost: "medium",
        estimatedSpeed: "standard",
        status: "recommended",
      },
      {
        modality: "voice",
        selectedEngine: "elevenlabs",
        alternatives: ["openai-voice"],
        decisionFactors: ["emotion", "language"],
        reason: "Best fit for expressive multilingual voiceover with natural emotional delivery.",
        estimatedCost: "medium",
        estimatedSpeed: "fast",
        status: "recommended",
      },
    ],
  },
  smartSceneGeneration: {
    mode: "auto-generate-missing-scenes",
    principle: "solve-kulang-assets-for-small-businesses",
    summary: "Buzzly can generate missing scenes from a small asset set: cinematic closeups, lifestyle shots, motion scenes, AI B-roll, and background animations.",
    inputAssetCount: 3,
    suggestions: [
      {
        id: "smart-scene-closeup",
        title: "Cinematic product closeup",
        type: "cinematic-closeup",
        fillsGap: "product-closeup",
        prompt: "Create a premium macro closeup of the product with soft motion, clean highlights, and social ad pacing.",
        recommendedEngine: "chatgpt",
        duration: 4,
        status: "suggested",
      },
      {
        id: "smart-scene-lifestyle",
        title: "Lifestyle problem shot",
        type: "lifestyle-shot",
        fillsGap: "emotional-shot",
        prompt: "Generate a relatable busy-parent lifestyle shot that shows the problem before the product appears.",
        recommendedEngine: "gemini-flow",
        duration: 5,
        status: "suggested",
      },
      {
        id: "smart-scene-broll",
        title: "AI transformation B-roll",
        type: "ai-broll",
        fillsGap: "before-after",
        prompt: "Generate a fast before-and-after transformation clip that makes the product payoff obvious.",
        recommendedEngine: "seedance",
        duration: 5,
        status: "suggested",
      },
    ],
  },
  performanceEngine: {
    mode: "ai-creative-analyst",
    principle: "performance-is-the-core-moat",
    viralPotentialScore: 78,
    summary: "Strong first-cut potential. Main opportunities: tighten the first 3 seconds, add clearer emotional variation, and make the CTA arrive earlier.",
    lastAnalyzedAt: "Not analyzed in this session",
    metrics: [
      {
        key: "hook-strength",
        label: "Hook strength",
        score: 82,
        status: "strong",
        insight: "The hook names a real pain point quickly and fits short-form UGC.",
      },
      {
        key: "retention-pacing",
        label: "Retention pacing",
        score: 74,
        status: "watch",
        insight: "The timeline has useful beats, but the intro can move faster.",
      },
      {
        key: "dead-moments",
        label: "Dead moments",
        score: 76,
        status: "watch",
        insight: "Some product proof time can be tightened before the packshot.",
      },
      {
        key: "visual-overload",
        label: "Visual overload",
        score: 84,
        status: "strong",
        insight: "Layer count is controlled and readable.",
      },
      {
        key: "cta-timing",
        label: "CTA timing",
        score: 70,
        status: "watch",
        insight: "CTA should land a little earlier for short-form retention.",
      },
      {
        key: "subtitle-speed",
        label: "Subtitle speed",
        score: 80,
        status: "strong",
        insight: "Captions are short enough for fast viewing.",
      },
      {
        key: "emotional-variation",
        label: "Emotional variation",
        score: 66,
        status: "fix",
        insight: "Needs more human feeling or transformation proof.",
      },
      {
        key: "audio-energy",
        label: "Audio energy",
        score: 78,
        status: "watch",
        insight: "Music bed supports the edit, but can lift more in the hook.",
      },
    ],
    suggestions: [
      {
        id: "perf-faster-first-3",
        title: "Make first 3 seconds faster",
        command: "faster-first-3-seconds",
        impact: 9,
        reason: "Earlier motion and shorter hook usually improve retention.",
        timelinePrompt: "Mas mabilis cuts",
        status: "suggested",
      },
      {
        id: "perf-stronger-cta",
        title: "Bring in stronger CTA",
        command: "stronger-cta",
        impact: 7,
        reason: "The current CTA can be clearer and closer to the payoff.",
        timelinePrompt: "Lagyan mo ng stronger CTA",
        status: "suggested",
      },
      {
        id: "perf-emotional-variation",
        title: "Add emotional variation",
        command: "add-emotional-variation",
        impact: 8,
        reason: "A reaction or transformation beat can make the ad feel less flat.",
        timelinePrompt: "Add AI B-roll",
        status: "suggested",
      },
    ],
  },
  styleDnaSystem: {
    mode: "brand-dna-presets",
    principle: "admins-create-style-users-apply-instantly",
    activePresetId: "smartdad-style",
    lastAppliedAt: "Not applied in this session",
    presets: [
      {
        id: "smartdad-style",
        name: "SmartDad Style",
        description: "Fast, punchy, emotional, and built for social sales content.",
        traits: ["fast-cuts", "punchy-hooks", "emotional-humor", "aggressive-captions"],
        pacing: "Fast cuts every 1.5-2 seconds with a strong first beat.",
        hookStyle: "Relatable pain point with emotional humor.",
        captionStyle: "Large aggressive captions, short lines, high contrast.",
        ctaStyle: "Direct CTA with practical benefit.",
        createdBy: "system",
      },
      {
        id: "luxury-brand",
        name: "Luxury Brand",
        description: "Minimal, cinematic, slower, and premium.",
        traits: ["minimal", "slow", "cinematic", "elegant-subtitles"],
        pacing: "Slow cinematic pacing with fewer, cleaner cuts.",
        hookStyle: "Quiet visual intrigue before the product reveal.",
        captionStyle: "Elegant subtitles with restraint and breathing room.",
        ctaStyle: "Soft premium CTA focused on aspiration.",
        createdBy: "system",
      },
      {
        id: "brand-buzzer-style",
        name: "Brand Buzzer Style",
        description: "Sales-focused, direct, polished, and conversion-oriented.",
        traits: ["sales-focused", "direct", "premium-cta", "punchy-hooks"],
        pacing: "Direct response pacing with proof early and CTA near the payoff.",
        hookStyle: "Immediate offer or pain-point hook.",
        captionStyle: "Premium captions with direct benefit language.",
        ctaStyle: "Strong sales CTA with urgency and clarity.",
        createdBy: "system",
      },
    ],
  },
  userSystem: {
    mode: "multi-level-agency-access",
    principle: "owners-control-teams-roles-control-actions",
    currentUserId: "owner-mia",
    currentRole: "owner",
    members: [
      {
        id: "owner-mia",
        name: "Mia Owner",
        role: "owner",
        permissions: ["manage-team", "manage-workspace", "manage-style-dna", "edit-project", "generate-assets", "review-only"],
      },
      {
        id: "editor-jo",
        name: "Jo Editor",
        role: "editor",
        permissions: ["edit-project", "generate-assets", "review-only"],
      },
      {
        id: "creator-ana",
        name: "Ana Creator",
        role: "creator",
        permissions: ["generate-assets", "review-only"],
      },
      {
        id: "viewer-lee",
        name: "Lee Viewer",
        role: "viewer",
        permissions: ["review-only"],
      },
    ],
  },
  workspaceSystem: {
    mode: "agency-client-workspaces",
    principle: "each-client-keeps-assets-styles-prompts-team-and-brand-rules",
    activeWorkspaceId: "nike-client",
    workspaces: [
      {
        id: "nike-client",
        name: "Nike Client",
        clientType: "agency-client",
        assetIds: ["clip-hook", "clip-demo", "product-packshot", "voiceover", "music-bed"],
        stylePresetIds: ["brand-buzzer-style", "luxury-brand"],
        promptLibrary: [
          "Create a performance sports hook with high momentum.",
          "Generate product closeups with athletic lighting and premium contrast.",
          "Rewrite captions to feel bold, direct, and motivational.",
        ],
        teamMemberIds: ["owner-mia", "editor-jo", "creator-ana", "viewer-lee"],
        brandVoice: "Confident, athletic, concise, motivational, and premium.",
        colors: ["#111111", "#ffffff", "#f5f5f5", "#ff3d00"],
        templates: [
          {
            id: "nike-ugc-launch",
            name: "UGC Product Launch",
            format: "tiktok-reel-9x16",
            duration: 30,
            useCase: "Short-form product launch ads.",
          },
          {
            id: "nike-proof-reel",
            name: "Proof Reel",
            format: "tiktok-reel-9x16",
            duration: 24,
            useCase: "Before/after or performance proof videos.",
          },
        ],
      },
      {
        id: "smartdad-internal",
        name: "SmartDad Internal",
        clientType: "internal",
        assetIds: ["clip-hook", "product-packshot"],
        stylePresetIds: ["smartdad-style", "brand-buzzer-style"],
        promptLibrary: [
          "Open with a Filipino parent pain point.",
          "Make the CTA practical, direct, and benefit-led.",
          "Add emotional humor without losing clarity.",
        ],
        teamMemberIds: ["owner-mia", "editor-jo"],
        brandVoice: "Warm, practical, direct, family-first, and lightly funny.",
        colors: ["#ffc400", "#05070a", "#ffffff", "#22c55e"],
        templates: [
          {
            id: "smartdad-sales-ad",
            name: "Sales Ad",
            format: "tiktok-reel-9x16",
            duration: 30,
            useCase: "Fast direct-response ads for social.",
          },
        ],
      },
    ],
  },
  aiMemorySystem: {
    mode: "personalization-memory",
    principle: "buzzly-adapts-to-the-creator-over-time",
    profileName: "Jolie Creator Memory",
    summary: "Jolie usually prefers aggressive hooks, fast pacing, bold captions, energetic voice, and direct CTA language.",
    lastAppliedAt: "Not applied in this session",
    signals: [
      {
        key: "preferred-pacing",
        label: "Preferred pacing",
        value: "Fast first 3 seconds, quick proof, no slow intro.",
        confidence: 0.91,
        source: "behavior",
      },
      {
        key: "favorite-hooks",
        label: "Favorite hooks",
        value: "Aggressive pain-point hooks with direct Taglish phrasing.",
        confidence: 0.88,
        source: "manual",
      },
      {
        key: "best-performing-captions",
        label: "Best performing captions",
        value: "Large punchy captions with short lines and strong contrast.",
        confidence: 0.84,
        source: "performance",
      },
      {
        key: "preferred-voices",
        label: "Preferred voices",
        value: "Energetic, confident, creator-style voice with natural Filipino rhythm.",
        confidence: 0.79,
        source: "behavior",
      },
      {
        key: "common-cta",
        label: "Common CTA",
        value: "Generate better videos faster. Try it today.",
        confidence: 0.82,
        source: "performance",
      },
    ],
  },
  renderingArchitecture: {
    mode: "speed-first-rendering",
    principle: "fast-short-form-exports-are-the-advantage",
    targetResolution: {
      width: 1080,
      height: 1920,
    },
    maxRecommendedDuration: 45,
    targetExportSeconds: 120,
    benchmark: "Export a 45-second 1080x1920 video in under 2 minutes.",
    effectPolicy: {
      tier: "lightweight",
      allowed: ["captions", "cuts", "scale", "opacity", "simple overlays", "audio mix"],
      avoid: ["full cinematic rendering", "heavy 3D scenes", "multi-pass compositing", "long-form exports", "complex particle effects"],
    },
    pipeline: ["timeline-json", "asset-normalization", "preview-cache", "remotion-render", "ffmpeg-package"],
    currentEstimate: {
      duration: 30,
      estimatedExportSeconds: 72,
      speedScore: 88,
      status: "fast",
      notes: ["1080x1920 target", "Short-form duration", "Lightweight effects only"],
    },
  },
  aiPipeline: {
    mode: "idea-to-render-ai-pipeline",
    principle: "strategy-assets-generation-timeline-performance-render-chat",
    currentStep: "user-idea",
    summary: "Buzzly moves from user idea to plan, asset intelligence, generation, timeline assembly, performance optimization, render, and chat-based revisions.",
    steps: [
      { key: "user-idea", label: "User Idea", description: "Capture the creator goal, audience, product, platform, and raw concept.", ownerLayer: "Creative Brain", status: "done" },
      { key: "ai-planning", label: "AI Planning", description: "Build the Hook, Problem, Solution, Highlight, CTA plan before generation.", ownerLayer: "Creative Plan", status: "done" },
      { key: "asset-scanning", label: "Asset Scanning", description: "Scan uploaded videos, images, audio, generated assets, and product files.", ownerLayer: "Smart Asset Mapping", status: "ready" },
      { key: "missing-asset-detection", label: "Missing Asset Detection", description: "Detect weak or missing clips before timeline assembly.", ownerLayer: "Asset Intelligence", status: "ready" },
      { key: "ai-asset-generation", label: "AI Asset Generation", description: "Generate closeups, lifestyle shots, motion scenes, AI B-roll, and backgrounds.", ownerLayer: "Smart Scene Generation", status: "ready" },
      { key: "script-generation", label: "Script Generation", description: "Generate scripts and captions from the creative plan.", ownerLayer: "Creative Brain", status: "ready" },
      { key: "voice-generation", label: "Voice Generation", description: "Choose voice engine and generate narration using language and emotion rules.", ownerLayer: "AI Router", status: "ready" },
      { key: "timeline-auto-assembly", label: "Timeline Auto Assembly", description: "Assemble clips, text, captions, voice, music, and generated scenes.", ownerLayer: "AI Timeline Engine", status: "ready" },
      { key: "subtitle-music", label: "Subtitle + Music", description: "Apply caption styling, subtitle pacing, music bed, and audio energy.", ownerLayer: "Timeline Engine", status: "ready" },
      { key: "performance-optimization", label: "Performance Optimization", description: "Score hook, retention, CTA, dead moments, subtitles, emotion, and audio.", ownerLayer: "Performance Engine", status: "ready" },
      { key: "render", label: "Render", description: "Use speed-first 1080x1920 lightweight rendering.", ownerLayer: "Speed Render Engine", status: "ready" },
      { key: "chat-based-revisions", label: "Chat-based Revisions", description: "Let users revise the edit conversationally after render or preview.", ownerLayer: "AI Assistant", status: "ready" },
    ],
  },
  aiTimelineEngine: {
    mode: "ai-plus-timeline",
    principle: "creators-keep-control",
    layout: {
      left: ["assets", "videos", "photos", "AI generated scenes", "music", "captions"],
      center: ["CapCut-style timeline", "drag clips", "trim", "reorder", "text", "layers", "subtitles"],
      right: ["AI chat assistant", "timeline commands", "creative edits", "style changes"],
    },
    capabilities: [
      "make-intro-faster",
      "add-stronger-hook",
      "change-music-emotional",
      "shorten-duration",
      "premium-captions",
      "add-product-closeups",
      "make-funnier",
      "stronger-cta",
      "faster-cuts",
      "fix-boring",
      "gen-z-style",
      "change-music",
      "add-ai-broll",
      "manual-trim",
      "manual-reorder",
    ],
    lastCommand: null,
  },
  conversationalEditing: {
    mode: "chat-first-editing",
    principle: "natural-language-controls-the-timeline",
    supportedPhrases: [
      "Gawing mas funny",
      "Lagyan mo ng stronger CTA",
      "Mas mabilis cuts",
      "Too boring",
      "Mas pang Gen Z",
      "Palitan music",
      "Add AI B-roll",
    ],
    recentEdits: [],
  },
  planningLayer: {
    mode: "creative-plan-before-generation",
    principle: "strategy-first-not-random-generation",
    planName: "Cleaning Shortcut Sales Plan",
    beats: [
      {
        key: "hook",
        label: "Hook",
        line: "POV: Hirap ka na maglinis after a long day?",
        purpose: "Stop the scroll with the exact pain point.",
        duration: 3,
        visualDirection: "Show the mess first with a quick creator reaction.",
      },
      {
        key: "problem",
        label: "Problem",
        line: "Cleaning takes too long when pagod ka na.",
        purpose: "Make the viewer feel understood.",
        duration: 5,
        visualDirection: "Messy counter or floor, fast cuts, tired hand/face shot.",
      },
      {
        key: "solution",
        label: "Solution",
        line: "Buzzly maps the workflow and finds the right shots automatically.",
        purpose: "Introduce the product as the shortcut.",
        duration: 8,
        visualDirection: "Product-in-use proof, UI automation, before/after motion.",
      },
      {
        key: "highlight",
        label: "Highlight",
        line: "Fast automation, clean captions, smarter video flow.",
        purpose: "Prove the main advantage.",
        duration: 8,
        visualDirection: "Product closeups, speed ramp, caption examples.",
      },
      {
        key: "cta",
        label: "CTA",
        line: "Generate 10 videos in minutes.",
        purpose: "Give one clear next step.",
        duration: 4,
        visualDirection: "Packshot or offer end card with strong CTA text.",
      },
    ],
    generationBrief: "Generate and edit every scene around the Hook, Problem, Solution, Highlight, CTA structure. Do not create random visuals that do not support the plan.",
  },
  tracks: [
    {
      id: "video-main",
      type: "video",
      name: "Video Track",
      items: [
        {
          id: "clip-hook",
          type: "video",
          name: "Hook clip",
          trackId: "video-main",
          source: { kind: "mock", filename: "product-hook.mp4", mimeType: "video/mp4" },
          startTime: 0,
          duration: 6,
          trimStart: 0,
          trimEnd: 6,
          volume: 0.8,
          position: { x: 0.5, y: 0.5 },
          scale: 1,
          opacity: 1,
        },
        {
          id: "clip-demo",
          type: "video",
          name: "Product proof",
          trackId: "video-main",
          source: { kind: "mock", filename: "product-proof.mp4", mimeType: "video/mp4" },
          startTime: 6,
          duration: 14,
          trimStart: 1,
          trimEnd: 15,
          volume: 0.65,
          position: { x: 0.5, y: 0.5 },
          scale: 1.04,
          opacity: 1,
        },
      ],
    },
    {
      id: "image-overlays",
      type: "image",
      name: "Image Track",
      items: [
        {
          id: "product-packshot",
          type: "image",
          name: "Product packshot",
          trackId: "image-overlays",
          source: { kind: "mock", filename: "packshot.png", mimeType: "image/png" },
          startTime: 20,
          duration: 5,
          trimStart: 0,
          trimEnd: 5,
          volume: 0,
          position: { x: 0.5, y: 0.42 },
          scale: 0.72,
          opacity: 0.96,
        },
      ],
    },
    {
      id: "audio-main",
      type: "audio",
      name: "Audio Track",
      items: [
        {
          id: "voiceover",
          type: "audio",
          name: "AI voiceover",
          trackId: "audio-main",
          source: { kind: "generated", filename: "elevenlabs-voiceover.mp3", mimeType: "audio/mpeg" },
          startTime: 0,
          duration: 28,
          trimStart: 0,
          trimEnd: 28,
          volume: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          opacity: 1,
        },
        {
          id: "music-bed",
          type: "audio",
          name: "Music bed",
          trackId: "audio-main",
          source: { kind: "mock", filename: "upbeat-pop.mp3", mimeType: "audio/mpeg" },
          startTime: 0,
          duration: 30,
          trimStart: 0,
          trimEnd: 30,
          volume: 0.32,
          position: { x: 0, y: 0 },
          scale: 1,
          opacity: 1,
        },
      ],
    },
    {
      id: "text-main",
      type: "text",
      name: "Text Track",
      items: [
        {
          id: "hook-text",
          type: "text",
          name: "Hook headline",
          trackId: "text-main",
          text: "Stop scrolling. This saves time.",
          startTime: 0,
          duration: 4,
          trimStart: 0,
          trimEnd: 4,
          volume: 0,
          position: { x: 0.5, y: 0.18 },
          scale: 1,
          opacity: 1,
        },
      ],
    },
    {
      id: "captions-main",
      type: "caption",
      name: "Captions",
      items: [
        {
          id: "caption-1",
          type: "caption",
          name: "Caption 1",
          trackId: "captions-main",
          text: "Stop scrolling. This saves time.",
          startTime: 0,
          duration: 2.6,
          trimStart: 0,
          trimEnd: 2.6,
          volume: 0,
          position: { x: 0.5, y: 0.82 },
          scale: 1,
          opacity: 1,
        },
      ],
    },
  ],
  aiPlan: {
    objective: "Create a 30-second short-form video ad with a strong hook, product proof, and CTA.",
    seoKeywords: ["#tiktokads", "#reelsads", "#videomarketing", "#aitools", "#buzzly"],
    scenes: [
      {
        id: "scene-hook",
        title: "Hook",
        goal: "Stop the scroll in the first 2 seconds.",
        script: "Stop scrolling. This saves time.",
        captionText: "Stop scrolling. This saves time.",
        clipSelection: ["Hook clip", "Product close-up"],
        musicSuggestion: "Fast upbeat pop with a clean first beat.",
        cta: "Watch until the end.",
      },
      {
        id: "scene-demo",
        title: "Solution",
        goal: "Show the product working clearly.",
        script: "Here is how it works in seconds.",
        captionText: "Here is how it works.",
        clipSelection: ["Product proof"],
        musicSuggestion: "Keep the rhythm steady under voiceover.",
        cta: "Try it today.",
      },
    ],
  },
  render: {
    primary: "remotion",
    helpers: ["ffmpeg"],
    futurePreview: ["webcodecs"],
  },
};
