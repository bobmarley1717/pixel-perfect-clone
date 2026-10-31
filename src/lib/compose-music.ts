import { createServerFn } from "@tanstack/react-start";

export const SCALES = ["major pentatonic", "minor pentatonic", "dorian", "lydian", "aeolian"] as const;
export const INSTRUMENTS = ["chime", "flute", "pluck", "marimba"] as const;
export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export type Composition = {
  title: string;
  description: string;
  bpm: number;
  key: (typeof KEYS)[number];
  scale: (typeof SCALES)[number];
  instrument: (typeof INSTRUMENTS)[number];
  // Scale degrees (0 = root, 7 = root an octave up); null is a rest. One entry per eighth note.
  melody: (number | null)[];
  drone: number;
  layers: { sound: string; level: number; swell: number }[];
};

const MODEL = "openai/gpt-oss-120b";

const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
const pick = <T extends string>(v: unknown, opts: readonly T[]): T => (opts.includes(v as T) ? (v as T) : opts[0]!);

// Model output and saved rows are untrusted, so every field is checked and clamped before it reaches the audio engine.
type RawLayer = { sound?: unknown; level?: unknown; swell?: unknown };

export function sanitizeComposition(raw: Partial<Record<keyof Composition, unknown>>, sounds: string[]): Composition {
  const layers = (Array.isArray(raw.layers) ? (raw.layers as RawLayer[]) : [])
    .filter((l) => !!l && typeof l === "object" && sounds.includes(l.sound as string))
    .slice(0, 6)
    .map((l) => ({ sound: l.sound as string, level: clamp(l.level, 0, 100, 50), swell: clamp(l.swell, 0, 1, 0.3) }));
  const melody = (Array.isArray(raw.melody) ? raw.melody : [])
    .slice(0, 32)
    .map((n) => (typeof n === "number" ? Math.round(clamp(n, 0, 14, 0)) : null));
  return {
    title: String(raw.title ?? "Untitled soundscape").slice(0, 60),
    description: String(raw.description ?? "").slice(0, 280),
    bpm: Math.round(clamp(raw.bpm, 40, 120, 70)),
    key: pick(raw.key, KEYS),
    scale: pick(raw.scale, SCALES),
    instrument: pick(raw.instrument, INSTRUMENTS),
    melody: melody.length ? melody : [0, null, 2, null, 4, null, 2, null],
    drone: clamp(raw.drone, 0, 100, 30),
    layers: layers.length ? layers : [{ sound: sounds[0]!, level: 50, swell: 0.3 }],
  };
}

export const composeMusic = createServerFn({ method: "POST" })
  .validator((d: { prompt: string; sounds: string[] }) => ({
    prompt: String(d.prompt ?? "").slice(0, 500),
    sounds: (Array.isArray(d.sounds) ? d.sounds : []).map(String).slice(0, 60),
  }))
  .handler(async ({ data }): Promise<Composition> => {
    const key = process.env["GROQ_API_KEY"];
    if (!key) throw new Error("GROQ_API_KEY is not set on the server.");

    const system = `You compose short ambient music loops built from nature sounds.
Reply with ONLY a JSON object with these fields:
- title: evocative name (max 6 words)
- description: one or two sentences on the mood and why these sounds were chosen
- bpm: 40-120 (slow for sleep/calm, faster for energy)
- key: one of ${KEYS.join(", ")}
- scale: one of ${SCALES.join(", ")}
- instrument: one of ${INSTRUMENTS.join(", ")}
- melody: array of 16 to 32 items, one per eighth note; each is a scale degree integer 0-14 (0 = root, 5 = root an octave up for pentatonic, 7 for 7-note scales) or null for a rest. Use plenty of rests for calm moods. Make it a singable, repeating phrase.
- drone: 0-100, volume of a soft sustained pad on the root and fifth
- layers: 3 to 6 objects {sound, level 0-100, swell 0-1 (how much the sound slowly breathes in and out)}. sound MUST be exactly one of: ${data.sounds.join(", ")}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.9,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.prompt || "A peaceful nature soundscape" },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    return sanitizeComposition(JSON.parse(content) as Partial<Record<keyof Composition, unknown>>, data.sounds);
  });
