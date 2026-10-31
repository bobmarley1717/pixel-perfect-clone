import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logo.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EchoNature AI — Soundscapes composed by living ecosystems" },
      { name: "description", content: "A bioacoustic foundation model turning wildlife sound into personalized therapeutic soundscapes while advancing conservation." },
      { property: "og:title", content: "EchoNature AI" },
      { property: "og:description", content: "Personalized digital therapeutics derived from ecological intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const BANDS = ["Whale", "Frog", "Wind", "Rain", "Insect", "Canopy", "Thrush", "Wren", "Cicada", "Bat"];
const BAND_HZ = ["32", "64", "125", "250", "500", "1K", "2K", "4K", "8K", "16K"];

const PRESETS = {
  Calm: { goal: "High anxiety", eco: "Coastal mangrove dawn chorus", v: [40, 55, 70, 62, 48, 35, 58, 44, 30, 20], why: "Rhythmic regularity and soft spectral balance in the low-mids." },
  Create: { goal: "Creative work", eco: "Amazon rainforest canopy", v: [30, 45, 50, 60, 72, 80, 90, 85, 70, 55], why: "High vocal diversity and acoustic richness in upper bands." },
  Focus: { goal: "Deep focus", eco: "Arctic tundra windscape", v: [55, 60, 75, 70, 50, 30, 22, 18, 14, 10], why: "Low temporal complexity and steady broadband wind texture." },
  Sleep: { goal: "Sleep", eco: "Humpback whale communication", v: [90, 82, 64, 45, 30, 20, 14, 10, 8, 5], why: "Slow frequency modulation and dominant sub-bass contours." },
  Regulate: { goal: "Emotional regulation", eco: "Temperate forest after rainfall", v: [35, 48, 62, 74, 66, 55, 60, 48, 36, 26], why: "Even harmonic spacing with gentle droplet transients." },
} as Record<string, { goal: string; eco: string; v: number[]; why: string }>;

const STAGES = [
  ["Global Bioacoustic Intelligence", "Millions of recordings from Macaulay Library, Xeno-Canto, NOAA and Rainforest Connection."],
  ["AI Species Intelligence", "Species, habitat, behavior, season and acoustic-health fingerprints for every clip."],
  ["Bioacoustic Embedding", "Pitch contours, MFCCs, spectral entropy and rhythm complexity in one latent space."],
  ["Therapeutic Composer", "Transformer models generate original soundscapes tuned to mood, stress and time of day."],
  ["Continuous Learning", "Mood, listening duration and HRV feedback refine every next session."],
];

type Layer = { name: string; f: number; q: number; type: BiquadFilterType };
const BIOMES: Record<string, { tag: string; layers: Layer[] }> = {
  Rainforest: { tag: "Humid canopy, dense life", layers: [
    { name: "Canopy rainfall", f: 3000, q: 0.6, type: "bandpass" },
    { name: "Distant thunder", f: 80, q: 1, type: "lowpass" },
    { name: "Wildlife / birds", f: 4500, q: 8, type: "bandpass" },
    { name: "Humidity / wind", f: 600, q: 0.5, type: "bandpass" },
  ] },
  Desert: { tag: "Open dunes, dry air", layers: [
    { name: "Howling wind", f: 400, q: 4, type: "bandpass" },
    { name: "Shifting sand", f: 6000, q: 0.8, type: "highpass" },
    { name: "Night crickets", f: 5200, q: 20, type: "bandpass" },
    { name: "Thermal breeze", f: 250, q: 0.4, type: "lowpass" },
  ] },
  Cave: { tag: "Stone, echo, darkness", layers: [
    { name: "Water drops", f: 1800, q: 15, type: "bandpass" },
    { name: "Subterranean hum", f: 60, q: 2, type: "lowpass" },
    { name: "Echoes", f: 900, q: 3, type: "bandpass" },
    { name: "Underground stream", f: 1200, q: 0.7, type: "bandpass" },
  ] },
  Waterfall: { tag: "Falling water, spray", layers: [
    { name: "Heavy water roar", f: 300, q: 0.4, type: "lowpass" },
    { name: "Mist / spray", f: 8000, q: 0.5, type: "highpass" },
    { name: "River rapids", f: 1500, q: 0.6, type: "bandpass" },
    { name: "Ambient splash", f: 2500, q: 2, type: "bandpass" },
  ] },
};
const BIOME_KEYS = Object.keys(BIOMES);
const SOUND_LIBRARY: Layer[] = [
  ...Object.values(BIOMES).flatMap((b) => b.layers),
  { name: "Ocean waves", f: 400, q: 0.3, type: "lowpass" },
  { name: "Seagulls", f: 3500, q: 10, type: "bandpass" },
  { name: "Frog chorus", f: 1100, q: 12, type: "bandpass" },
  { name: "Whale song", f: 120, q: 6, type: "bandpass" },
  { name: "Crackling fire", f: 2200, q: 1.5, type: "highpass" },
  { name: "Leaves rustling", f: 5000, q: 0.7, type: "bandpass" },
  { name: "Snowfall hush", f: 200, q: 0.3, type: "lowpass" },
  { name: "Cicada buzz", f: 7000, q: 15, type: "bandpass" },
  { name: "Owl hoots", f: 450, q: 14, type: "bandpass" },
  { name: "Bubbling brook", f: 1700, q: 3, type: "bandpass" },
  { name: "Reef fish", f: 900, q: 6, type: "bandpass" },
  { name: "Coral snaps", f: 3000, q: 8, type: "bandpass" },
];
const DEFAULT_LEVELS = () => Object.fromEntries(BIOME_KEYS.map((b) => [b, [60, 40, 50, 35]]));

type View = "about" | "composer" | "equalizer" | "engine";

function Index() {
  const [view, setView] = useState<View>("about");

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden font-sans">
      <header className="glass z-10 flex w-full shrink-0 items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="EchoNature AI logo" className="h-10 w-10 rounded-full object-cover" />
          <span className="font-display text-lg font-semibold">EchoNature<span className="text-primary"> AI</span></span>
        </div>
        <nav className="flex items-center gap-1 rounded-full bg-secondary/60 p-1">
          {([["about", "About"], ["composer", "Ecosystem Composer"], ["equalizer", "Biome Equalizer"], ["engine", "Engine"]] as [View, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${view === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </nav>
        <p className="hidden text-xs uppercase tracking-[0.3em] text-primary xl:block">Bioacoustic foundation model</p>
      </header>

      <div className="min-h-0 flex-1 p-6">
        {view === "about" && <About onStart={() => setView("composer")} />}
        {view === "composer" && <Composer />}
        {view === "equalizer" && <BiomeEqualizer />}
        {view === "engine" && <Engine />}
      </div>

    </main>
  );
}

function BiomeEqualizer() {
  const [biomes, setBiomes] = useState(BIOMES);
  const [biome, setBiome] = useState("Rainforest");
  const [levels, setLevels] = useState<Record<string, number[]>>(DEFAULT_LEVELS);
  const [adding, setAdding] = useState(false);
  const defaults = (n: number) => Array(n).fill(50) as number[];
  const [playing, setPlaying] = useState(false);
  const audio = useRef<{ ctx: AudioContext; gains: GainNode[]; analyser: AnalyserNode; srcs: AudioBufferSourceNode[] } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const lv = levels[biome]!;
  const levelsRef = useRef(lv);
  levelsRef.current = lv;

  const stop = () => {
    audio.current?.srcs.forEach((s) => s.stop());
    audio.current?.ctx.close();
    audio.current = null;
  };

  const start = (b: string) => {
    stop();
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.connect(ctx.destination);
    const gains: GainNode[] = [];
    const srcs: AudioBufferSourceNode[] = [];
    biomes[b]!.layers.forEach((L, i) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      src.playbackRate.value = 0.9 + i * 0.07;
      const f = ctx.createBiquadFilter();
      f.type = L.type; f.frequency.value = L.f; f.Q.value = L.q;
      const g = ctx.createGain();
      g.gain.value = (levelsRef.current[i]! / 100) * 0.35;
      src.connect(f).connect(g).connect(analyser);
      src.start();
      gains.push(g); srcs.push(src);
    });
    audio.current = { ctx, gains, analyser, srcs };
  };

  useEffect(() => { if (playing) start(biome); return stop; }, [playing, biome]);
  useEffect(() => {
    audio.current?.gains.forEach((g, i) => g.gain.setTargetAtTime((lv[i]! / 100) * 0.35, audio.current!.ctx.currentTime, 0.1));
  }, [lv]);

  useEffect(() => {
    let raf = 0; let t = 0;
    const draw = () => {
      const c = canvas.current; if (!c) return;
      const g = c.getContext("2d")!;
      const w = (c.width = c.clientWidth), h = (c.height = c.clientHeight);
      const n = 64;
      let data: number[];
      if (audio.current) {
        const arr = new Uint8Array(audio.current.analyser.frequencyBinCount);
        audio.current.analyser.getByteFrequencyData(arr);
        data = Array.from(arr, (x) => x / 255);
      } else {
        t += 0.03;
        data = Array.from({ length: n }, (_, i) => {
          const l = levelsRef.current[Math.floor((i / n) * 4)]! / 100;
          return l * (0.55 + 0.35 * Math.sin(t + i * 0.5) * Math.cos(t * 0.7 + i * 0.13));
        });
      }
      const styles = getComputedStyle(document.documentElement);
      const col = styles.getPropertyValue("--primary").trim();
      const bw = w / data.length;
      data.forEach((v, i) => {
        const bh = Math.max(4, v * h * 0.9);
        g.fillStyle = col; g.globalAlpha = 0.35 + v * 0.65;
        g.beginPath(); g.roundRect(i * bw + 2, h - bh, bw - 4, bh, 4); g.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const energy = Math.round(lv.reduce((a, b) => a + b, 0) / lv.length);

  return (
    <div className="grid h-full grid-cols-[240px_1fr_280px] gap-6">
      <aside className="glass flex flex-col gap-2 rounded-3xl p-4">
        <p className="px-2 pb-2 text-xs uppercase tracking-widest text-muted-foreground">Biomes</p>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {Object.keys(biomes).map((b) => (
          <button key={b} onClick={() => setBiome(b)}
            className={`rounded-2xl px-4 py-3 text-left transition hover:translate-x-1 ${b === biome ? "bg-primary text-primary-foreground glow" : "bg-secondary/50 hover:bg-secondary"}`}>
            <span className="block font-display font-semibold">{b}</span>
            <span className={`text-xs ${b === biome ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{biomes[b]!.tag}</span>
          </button>
        ))}
        <button onClick={() => setAdding(true)} className="rounded-2xl border border-dashed border-primary/50 px-4 py-3 text-left text-sm text-primary transition hover:bg-primary/10">+ Add biome</button>
        </div>
        <button onClick={() => setPlaying(!playing)} className="mt-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow transition hover:scale-[1.02]">
          {playing ? "Pause soundscape" : "Play soundscape"}
        </button>
      </aside>

      <section className="glass flex min-h-0 flex-col gap-4 rounded-3xl p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-primary">{biome} Equalizer</h2>
          <span className="text-xs text-muted-foreground">{playing ? "Live spectrum" : "Preview spectrum"}</span>
        </div>
        <canvas ref={canvas} className="h-[30%] w-full rounded-2xl bg-track/60" />
        <div className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: `repeat(${lv.length}, minmax(0, 1fr))` }}>
          {biomes[biome]!.layers.map((L, i) => (
            <div key={L.name} className="flex min-h-0 flex-col items-center rounded-2xl bg-muted/60 p-4 transition hover:bg-muted">
              <span className="font-display text-3xl font-semibold text-primary tabular-nums">{lv[i]}</span>
              <div className="relative my-4 w-3 flex-1 rounded-full bg-track">
                <div className="bar-fill absolute bottom-0 w-full rounded-full transition-all duration-200" style={{ height: `${lv[i]}%` }} />
                <div className="absolute left-1/2 h-6 w-6 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-primary bg-secondary transition-all duration-200" style={{ bottom: `${lv[i]}%`, boxShadow: `0 0 ${lv[i]! / 3}px var(--primary)` }} />
                <input type="range" min={0} max={100} value={lv[i]} aria-label={L.name}
                  onChange={(e) => setLevels({ ...levels, [biome]: lv.map((x, j) => (j === i ? +e.target.value : x)) })}
                  className="absolute left-1/2 top-0 h-full w-10 -translate-x-1/2 cursor-pointer opacity-0 [writing-mode:vertical-lr] [direction:rtl]" />
              </div>
              <span className="text-center text-sm">{L.name}</span>
              <span className="text-[10px] text-muted-foreground">{L.f >= 1000 ? `${L.f / 1000}K` : L.f} Hz</span>
            </div>
          ))}
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="glass rounded-3xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Acoustic Health Index</p>
          <p className="mt-1 font-display text-5xl font-semibold text-primary">{energy}</p>
          <div className="mt-3 h-1.5 rounded-full bg-track"><div className="bar-fill h-full rounded-full transition-all" style={{ width: `${energy}%` }} /></div>
        </div>
        <div className="glass flex-1 rounded-3xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Layer mix</p>
          <ul className="mt-3 space-y-3">
            {biomes[biome]!.layers.map((L, i) => (
              <li key={L.name}>
                <div className="flex justify-between text-sm"><span>{L.name}</span><span className="text-muted-foreground">{lv[i]}%</span></div>
                <div className="mt-1 h-1 rounded-full bg-track"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${lv[i]}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setLevels({ ...levels, [biome]: BIOMES[biome] ? [60, 40, 50, 35] : defaults(lv.length) })} className="glass rounded-full px-5 py-3 text-sm text-muted-foreground transition hover:text-foreground">Reset biome</button>
      </aside>
      {adding && <AddBiomeModal taken={Object.keys(biomes)} onClose={() => setAdding(false)} onCreate={(name, layers) => {
        setBiomes({ ...biomes, [name]: { tag: "Custom biome", layers } });
        setLevels({ ...levels, [name]: defaults(layers.length) });
        setBiome(name); setAdding(false);
      }} />}
    </div>
  );
}

function Composer() {
  const [preset, setPreset] = useState("Calm");
  const [vals, setVals] = useState(PRESETS["Calm"]!.v);
  const p = PRESETS[preset]!;
  const health = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass flex w-full max-w-5xl flex-col rounded-[2rem] p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-primary">Ecosystem Composer</h2>
            <p className="mt-1 text-sm text-muted-foreground">Nature becomes the dataset. AI becomes the interpreter.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((k) => (
              <button key={k} onClick={() => { setPreset(k); setVals(PRESETS[k]!.v); }}
                className={`rounded-full px-4 py-1.5 text-sm transition ${k === preset ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{k}</button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_300px] items-start gap-6">
          <div className="rounded-3xl bg-muted/60 p-5">
            <div className="flex h-60 items-end justify-between gap-2">
              {vals.map((v, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center">
                  <div className="relative h-full w-2 rounded-full bg-track">
                    <div className="bar-fill absolute bottom-0 w-full rounded-full transition-all duration-500" style={{ height: `${v}%` }} />
                    <div className="absolute left-1/2 h-5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-primary bg-secondary transition-all duration-500" style={{ bottom: `${v}%` }} />
                    <input type="range" min={0} max={100} value={v} aria-label={BANDS[i]}
                      onChange={(e) => setVals(vals.map((x, j) => (j === i ? +e.target.value : x)))}
                      className="absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 cursor-pointer opacity-0 [writing-mode:vertical-lr] [direction:rtl]" />
                  </div>
                  <span className="mt-3 text-xs text-foreground">{BAND_HZ[i]}</span>
                  <span className="text-[10px] text-muted-foreground">{BANDS[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <aside className="flex flex-col gap-3">
            <div className="rounded-3xl bg-muted/60 p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.goal}</p>
              <p className="mt-2 font-display text-lg">{p.eco}</p>
            </div>
            <div className="rounded-3xl bg-muted/60 p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Acoustic Health Index</p>
              <p className="mt-1 font-display text-4xl font-semibold text-primary">{health}</p>
            </div>
            <div className="rounded-3xl bg-muted/60 p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Why this ecosystem</p>
              <p className="mt-2 text-sm">{p.why}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );

}

function Engine() {
  return (
    <div className="flex h-full flex-col">
      <h2 className="font-display text-3xl font-semibold">The Ecological Therapeutic Engine</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">Personalized therapeutic soundscapes composed from the acoustic structure of living ecosystems.</p>
      <div className="mt-8 grid flex-1 grid-cols-5 gap-4">
        {STAGES.map(([t, d], i) => (
          <div key={t} className="glass flex flex-col rounded-3xl p-6 transition hover:-translate-y-1">
            <span className="font-display text-5xl font-light text-primary">0{i + 1}</span>
            <h3 className="mt-auto font-display text-lg font-semibold">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function About({ onStart }: { onStart: () => void }) {
  return (
    <div className="grid h-full grid-cols-2 items-center gap-10 px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Our goal</p>
        <h1 className="mt-4 font-display text-5xl font-light leading-tight xl:text-6xl">
          Nature becomes the dataset. <span className="font-semibold text-primary">AI becomes the interpreter.</span>
        </h1>
        <p className="mt-6 max-w-xl text-muted-foreground">
          EchoNature AI is building a bioacoustic foundation model that learns from millions of wildlife recordings. Our mission is to turn the sound of living ecosystems into personalized digital therapeutics — while every listen supports and teaches biodiversity conservation.
        </p>
        <button onClick={onStart} className="mt-8 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow transition hover:scale-[1.02]">Start a session</button>
      </div>
      <div className="glass rounded-[2rem] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">How it helps</p>
        <ul className="mt-4 space-y-4 text-sm">
          <li><b>Calm anxiety & stress</b> — soundscapes tuned to slow, regular natural rhythms.</li>
          <li><b>Focus & create</b> — pick a biome and shape its layers to mask distractions.</li>
          <li><b>Sleep better</b> — low, steady textures like whale song and cave hum.</li>
          <li><b>Learn the species</b> — each session reveals the ecosystems behind the sound.</li>
          <li><b>Gets more personal</b> — mood and listening feedback refine every next session.</li>
        </ul>
      </div>
    </div>
  );
}

const DEFAULT_BIOME_NAME = "My Biome";
// Sounds that belong together. A name is suggested from the whole combination picked, not one sound.
const NAME_RECIPES: { name: string; sounds: string[] }[] = [
  { name: "Coral Reef", sounds: ["Reef fish", "Coral snaps", "Ocean waves", "Seagulls"] },
  { name: "Thunderstorm Forest", sounds: ["Distant thunder", "Canopy rainfall", "Humidity / wind"] },
  { name: "Rainforest Canopy", sounds: ["Canopy rainfall", "Wildlife / birds", "Humidity / wind", "Leaves rustling", "Cicada buzz"] },
  { name: "Desert Night", sounds: ["Night crickets", "Shifting sand", "Thermal breeze", "Howling wind"] },
  { name: "Echo Cavern", sounds: ["Water drops", "Echoes", "Subterranean hum", "Underground stream"] },
  { name: "Cascade Gorge", sounds: ["Heavy water roar", "Mist / spray", "River rapids", "Ambient splash"] },
  { name: "Tidal Shore", sounds: ["Ocean waves", "Seagulls", "Whale song"] },
  { name: "Marsh Hollow", sounds: ["Frog chorus", "Bubbling brook", "Water drops"] },
  { name: "Night Wood", sounds: ["Owl hoots", "Leaves rustling", "Night crickets", "Cicada buzz"] },
  { name: "Ember Camp", sounds: ["Crackling fire", "Owl hoots", "Leaves rustling", "Snowfall hush"] },
  { name: "Brook Forest", sounds: ["Bubbling brook", "Leaves rustling", "Wildlife / birds", "Canopy rainfall"] },
];
// Used only when a single sound is picked.
const SINGLE_NAMES: Record<string, string> = {
  "Canopy rainfall": "Rain Canopy",
  "Distant thunder": "Thunder Hollow",
  "Wildlife / birds": "Bird Canopy",
  "Humidity / wind": "Humid Wind",
  "Howling wind": "Windward Dunes",
  "Shifting sand": "Drifting Sands",
  "Night crickets": "Cricket Night",
  "Thermal breeze": "Warm Thermal",
  "Water drops": "Drip Cavern",
  "Subterranean hum": "Deep Stone",
  "Echoes": "Echo Chamber",
  "Underground stream": "Sunken River",
  "Heavy water roar": "Falling Water",
  "Mist / spray": "Spray Cliff",
  "River rapids": "Rushing Rapids",
  "Ambient splash": "Splash Pool",
  "Ocean waves": "Tidal Shore",
  "Seagulls": "Gull Coast",
  "Frog chorus": "Marsh Hollow",
  "Whale song": "Deep Current",
  "Crackling fire": "Ember Clearing",
  "Leaves rustling": "Rustling Grove",
  "Snowfall hush": "Frozen Hush",
  "Cicada buzz": "High Summer",
  "Owl hoots": "Night Hollow",
  "Bubbling brook": "Bubbling Brook",
  "Reef fish": "Reef Shoal",
  "Coral snaps": "Reef Shoal",
};

function suggestName(picked: string[]) {
  if (picked.length === 0) return DEFAULT_BIOME_NAME;
  const scored = NAME_RECIPES
    .map((r) => ({ name: r.name, hits: r.sounds.filter((s) => picked.includes(s)).length, size: r.sounds.length }))
    .filter((r) => r.hits >= 2)
    .sort((a, b) => b.hits - a.hits || a.size - b.size);
  const best = scored[0];
  if (best) return best.name;
  const only = picked.length === 1 ? picked[0] : undefined;
  return (only && SINGLE_NAMES[only]) || DEFAULT_BIOME_NAME;
  return DEFAULT_BIOME_NAME;
}

function AddBiomeModal({ taken, onClose, onCreate }: { taken: string[]; onClose: () => void; onCreate: (name: string, layers: Layer[]) => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const n = name.trim();
  const valid = n.length > 0 && !taken.includes(n) && picked.length > 0;
  const toggle = (s: string) => setPicked(picked.includes(s) ? picked.filter((x) => x !== s) : picked.length < 6 ? [...picked, s] : picked);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Add biome" onClick={(e) => e.stopPropagation()}
        className="glass flex max-h-[80vh] w-[min(820px,92vw)] flex-col rounded-[2rem] p-8 animate-in zoom-in-95">
        <h3 className="font-display text-2xl font-semibold text-primary">Create your biome</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Biome name, e.g. ${suggestName(picked)}`} maxLength={24}
          className="mt-4 rounded-full border border-input bg-secondary/60 px-5 py-2.5 text-sm outline-none focus:border-primary" />
        {taken.includes(n) && <p className="mt-1 px-2 text-xs text-destructive">That name is already used.</p>}
        <p className="mt-5 text-xs uppercase tracking-widest text-muted-foreground">Pick sounds ({picked.length}/6)</p>
        <div className="mt-2 flex min-h-0 flex-1 gap-4">
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-2">
            {SOUND_LIBRARY.map((s) => {
              const on = picked.includes(s.name);
              return (
                <li key={s.name}>
                  <button onClick={() => toggle(s.name)} className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm transition ${on ? "bg-primary text-primary-foreground" : "bg-secondary/50 hover:bg-secondary"}`}>
                    <span>{s.name}</span><span className="text-xs opacity-70">{on ? "Added" : "+"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex w-60 shrink-0 flex-col rounded-2xl border border-primary/20 bg-secondary/30 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected ({picked.length}/6)</p>
            {picked.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Nothing picked yet. Tap sounds on the left and they show up here.</p>
            ) : (
              <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {picked.map((s, i) => (
                  <li key={s} className="flex items-center justify-between gap-2 rounded-xl bg-primary/15 px-3 py-2 text-xs text-foreground">
                    <span className="truncate"><span className="mr-1.5 font-semibold text-primary">{i + 1}</span>{s}</span>
                    <button onClick={() => toggle(s)} aria-label={`Remove ${s}`} className="shrink-0 text-primary transition hover:text-foreground">&times;</button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Sounds play in the order listed here.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-5 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button disabled={!valid} onClick={() => onCreate(n, picked.map((s) => SOUND_LIBRARY.find((x) => x.name === s)!))}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground glow disabled:opacity-40 disabled:shadow-none">Create biome</button>
        </div>
      </div>
    </div>
  );
}
