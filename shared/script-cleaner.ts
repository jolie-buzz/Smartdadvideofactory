const KEEP_SECTION_HEADERS = new Set([
  "hook",
  "smartlolo hook",
  "smart lolo hook",
  "script",
  "full script",
  "generated script",
  "voice over",
  "voiceover",
  "narration",
]);

const DROP_SECTION_HEADERS = new Set([
  "overlay",
  "overlay text",
  "overlay texts",
  "b-roll",
  "b roll",
  "b-roll suggestion",
  "b-roll suggestions",
  "b roll suggestion",
  "b roll suggestions",
  "caption",
  "captions",
  "social media caption",
  "hashtags",
  "hashtag",
  "seo",
  "seo keyword",
  "seo keywords",
  "seo keywords hashtags",
  "keywords",
]);

function normalizeHeader(line: string) {
  return line
    .trim()
    .replace(/[:：]+$/g, "")
    .replace(/[&/]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function classifySectionHeader(line: string): "keep" | "drop" | null {
  const normalized = normalizeHeader(line);
  if (!normalized || normalized.length > 48) return null;
  if (KEEP_SECTION_HEADERS.has(normalized)) return "keep";
  if (DROP_SECTION_HEADERS.has(normalized)) return "drop";
  if (/^(overlay|b[- ]?roll|caption|hashtag|seo|keyword)/i.test(normalized)) return "drop";
  if (/^(smartlolo\s+)?hook$/i.test(normalized) || /^(full\s+)?script$/i.test(normalized)) return "keep";
  return null;
}

function stripLinePrefix(line: string) {
  return line
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/^\s*(hook|script|voice\s*over|narration)\s*[:：]\s*/i, "")
    .trim();
}

export function sanitizeNarrationScript(input: string | null | undefined) {
  if (!input) return "";

  const lines = input
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, ""))
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const output: string[] = [];
  let mode: "keep" | "drop" = "keep";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (mode === "keep" && output.length && output[output.length - 1] !== "") output.push("");
      continue;
    }

    const section = classifySectionHeader(line);
    if (section) {
      mode = section;
      if (mode === "drop") break;
      continue;
    }

    if (mode === "drop") continue;
    if (/^#+\w/.test(line)) continue;
    if (/^(overlay|b[- ]?roll|caption|hashtags?|seo|keywords?)\s*[:：]/i.test(line)) break;

    const cleaned = stripLinePrefix(line);
    if (cleaned) output.push(cleaned);
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
