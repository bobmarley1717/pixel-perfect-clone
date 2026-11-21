import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import logo from "@/assets/logo-note.jpg";
import { composeMusic, INSTRUMENTS, KEYS, SCALES, sanitizeComposition, type Composition } from "@/lib/compose-music";
import type { User } from "@supabase/supabase-js";
import { supabase, type SavedBiome, type SavedComposition } from "@/lib/supabase";

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
// Rain as individual droplets: short, decaying ticks at random pitches over a faint wash, instead of steady white noise.
function rainBuffer(ctx: BaseAudioContext) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * 4, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.06;
  const drops = 4 * 70;
  for (let k = 0; k < drops; k++) {
    const at = Math.floor(Math.random() * d.length);
    const hz = 1800 + Math.random() * 4500;
    const len = Math.floor(sr * (0.004 + Math.random() * 0.018));
    const amp = 0.4 + Math.random() * 1.4;
    for (let j = 0; j < len; j++) {
      const env = Math.exp((-6 * j) / len);
      d[(at + j) % d.length]! += amp * env * (0.6 * Math.sin((2 * Math.PI * hz * j) / sr) + 0.4 * (Math.random() * 2 - 1));
    }
  }
  return buf;
}
// The source buffer a layer plays: its own texture if it has one, otherwise the shared filtered noise.
const layerBuffer = (ctx: BaseAudioContext, name: string, noise: AudioBuffer) => (name === "Canopy rainfall" ? rainBuffer(ctx) : noise);

const DEFAULT_LEVELS = () => Object.fromEntries(BIOME_KEYS.map((b) => [b, [50, 50, 50, 50]]));
// Gain per slider step (half the old 0.35/100); 50 is the normal listening level.
const EQ_GAIN_PER_STEP = 0.35 / 100 / 2;

type View = "about" | "equalizer" | "music" | "signin";

function Index() {
  const [view, setView] = useState<View>("about");
  const [user, setUser] = useState<User | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Arriving from a password-reset email: ask for the new password.
      if (event === "PASSWORD_RECOVERY") { setRecovering(true); setView("signin"); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden font-sans">
      <header className="glass z-10 flex w-full shrink-0 items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="EchoNature AI logo" className="h-10 w-10 rounded-full object-cover" />
          <div className="leading-tight">
            <span className="block font-display text-lg font-semibold">EchoNature<span className="text-primary"> AI</span></span>
            <span className="hidden text-[10px] uppercase tracking-[0.3em] text-primary xl:block">Bioacoustic foundation model</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 rounded-full bg-secondary/60 p-1">
            {([["about", "About"], ["music", "AI Ambience"], ["equalizer", "Biome Equalizer"]] as [View, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                className={`rounded-full px-4 py-1.5 text-sm transition ${view === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
            ))}
          </nav>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="max-w-48 truncate text-sm text-muted-foreground">{user.email}</span>
              <button onClick={() => supabase?.auth.signOut()} className="rounded-full border border-primary/50 px-4 py-1.5 text-sm text-primary transition hover:bg-primary/10">Sign out</button>
            </div>
          ) : (
            <button onClick={() => setView("signin")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${view === "signin" ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground glow"}`}>Sign in</button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 p-6">
        {view === "about" && <About onGo={setView} />}
        {view === "equalizer" && <BiomeEqualizer />}
        {view === "music" && <AiMusic />}
        {view === "signin" && <SignIn recovering={recovering} onDone={() => { setRecovering(false); setView("music"); }} />}
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
  const [saveError, setSaveError] = useState("");
  const lv = levels[biome]!;

  useEffect(() => {
    supabase?.from("biomes").select("id, name, sounds").order("created_at").then(({ data }) => {
      const rows = (data ?? []) as SavedBiome[];
      const loaded = rows
        .map((r) => [r.name, r.sounds.map((s) => SOUND_LIBRARY.find((x) => x.name === s)).filter((x): x is Layer => !!x)] as const)
        .filter(([name, layers]) => layers.length > 0 && !BIOMES[name]);
      if (!loaded.length) return;
      setBiomes((b) => ({ ...b, ...Object.fromEntries(loaded.map(([name, layers]) => [name, { tag: "Custom biome", layers }])) }));
      setLevels((l) => ({ ...Object.fromEntries(loaded.map(([name, layers]) => [name, defaults(layers.length)])), ...l }));
    });
  }, []);
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
      src.buffer = layerBuffer(ctx, L.name, buf); src.loop = true;
      src.playbackRate.value = 0.9 + i * 0.07;
      const f = ctx.createBiquadFilter();
      f.type = L.type; f.frequency.value = L.f; f.Q.value = L.q;
      const g = ctx.createGain();
      g.gain.value = levelsRef.current[i]! * EQ_GAIN_PER_STEP;
      src.connect(f).connect(g).connect(analyser);
      src.start();
      gains.push(g); srcs.push(src);
    });
    audio.current = { ctx, gains, analyser, srcs };
  };

  useEffect(() => { if (playing) start(biome); return stop; }, [playing, biome]);
  useEffect(() => {
    audio.current?.gains.forEach((g, i) => g.gain.setTargetAtTime(lv[i]! * EQ_GAIN_PER_STEP, audio.current!.ctx.currentTime, 0.1));
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
        {saveError && <p className="px-2 text-xs text-destructive">{saveError}</p>}
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
        <button onClick={() => setLevels({ ...levels, [biome]: defaults(lv.length) })} className="glass rounded-full px-5 py-3 text-sm text-muted-foreground transition hover:text-foreground">Reset biome</button>
      </aside>
      {adding && <AddBiomeModal taken={Object.keys(biomes)} onClose={() => setAdding(false)} onCreate={(name, layers) => {
        setBiomes({ ...biomes, [name]: { tag: "Custom biome", layers } });
        setLevels({ ...levels, [name]: defaults(layers.length) });
        setBiome(name); setAdding(false);
        setSaveError("");
        supabase?.from("biomes").insert({ name, sounds: layers.map((L) => L.name) }).then(({ error }) => {
          if (error) setSaveError(error.code === "23505" ? `"${name}" is already saved in the cloud by someone else; it is kept on this device only.` : "Couldn't save this biome to the cloud.");
        });
      }} />}
    </div>
  );
}

const MUSIC_PROMPTS = [
  "Rainy night in a misty forest, for deep sleep",
  "Sunrise on a tropical beach, hopeful and bright",
  "Cozy campfire under winter stars",
  "Focused study session beside a mountain stream",
  "Mysterious underwater reef at dusk",
];
const SCALE_STEPS: Record<Composition["scale"], number[]> = {
  "major pentatonic": [0, 2, 4, 7, 9],
  "minor pentatonic": [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};
const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const degreeMidi = (c: Pick<Composition, "key" | "scale">, d: number) => {
  const steps = SCALE_STEPS[c.scale];
  return 60 + KEY_NAMES.indexOf(c.key) + Math.floor(d / steps.length) * 12 + steps[d % steps.length]!;
};
const degreeHz = (c: Composition, d: number) => midiHz(degreeMidi(c, d));
const degreeName = (c: Pick<Composition, "key" | "scale">, d: number) => {
  const m = degreeMidi(c, d);
  return `${KEY_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
};

// Plays one melody note with a small synth voice per instrument, routed into `out`.
function playNote(ctx: AudioContext, out: AudioNode, inst: Composition["instrument"], hz: number, t: number, len: number) {
  const env = ctx.createGain();
  env.connect(out);
  const partials: [number, OscillatorType, number][] =
    inst === "chime" ? [[1, "sine", 1], [2.76, "sine", 0.3]] :
    inst === "marimba" ? [[1, "sine", 1], [4, "sine", 0.15]] :
    inst === "flute" ? [[1, "triangle", 1], [2, "sine", 0.1]] :
    [[1, "sawtooth", 0.6]];
  const decay = inst === "chime" ? 2.5 : inst === "marimba" ? 0.7 : inst === "pluck" ? 0.6 : len * 1.6;
  const attack = inst === "flute" ? 0.08 : 0.005;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.12, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  let dest: AudioNode = env;
  if (inst === "pluck") {
    const lp = ctx.createBiquadFilter();
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(400, t + 0.4);
    lp.connect(env); dest = lp;
  }
  partials.forEach(([ratio, type, amp]) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = hz * ratio; g.gain.value = amp;
    if (inst === "flute") {
      const vib = ctx.createOscillator(); const vg = ctx.createGain();
      vib.frequency.value = 5; vg.gain.value = hz * 0.006;
      vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + attack + decay);
    }
    o.connect(g).connect(dest); o.start(t); o.stop(t + attack + decay + 0.05);
  });
}

type MusicEngine = { ctx: AudioContext; analyser: AnalyserNode; layerGains: GainNode[]; timer: number; srcs: AudioScheduledSourceNode[] };

function startMusic(c: Composition, onStep: (i: number) => void): MusicEngine {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 128;
  analyser.connect(ctx.destination);
  // Generated impulse response for a soft natural reverb.
  const ir = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  }
  const verb = ctx.createConvolver(); verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.5;
  verb.connect(wet).connect(analyser);
  const bus = ctx.createGain();
  bus.connect(analyser); bus.connect(verb);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const srcs: AudioScheduledSourceNode[] = [];
  const layerGains = c.layers.map((L, i) => {
    const spec = SOUND_LIBRARY.find((s) => s.name === L.sound)!;
    const src = ctx.createBufferSource();
    src.buffer = layerBuffer(ctx, L.sound, noise); src.loop = true; src.playbackRate.value = 0.9 + i * 0.07;
    const f = ctx.createBiquadFilter();
    f.type = spec.type; f.frequency.value = spec.f; f.Q.value = spec.q;
    const g = ctx.createGain();
    const base = (L.level / 100) * 0.3;
    g.gain.value = base;
    const lfo = ctx.createOscillator(); const depth = ctx.createGain();
    lfo.frequency.value = 0.04 + i * 0.03; depth.gain.value = base * L.swell * 0.8;
    lfo.connect(depth).connect(g.gain);
    src.connect(f).connect(g).connect(bus);
    src.start(); lfo.start(); srcs.push(src, lfo);
    return g;
  });

  const pad = ctx.createBiquadFilter(); pad.type = "lowpass"; pad.frequency.value = 900;
  const padGain = ctx.createGain(); padGain.gain.value = (c.drone / 100) * 0.06;
  pad.connect(padGain).connect(bus);
  const root = midiHz(48 + KEY_NAMES.indexOf(c.key));
  [root, root * 1.5, root * 2.003].forEach((hz) => {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = hz;
    o.connect(pad); o.start(); srcs.push(o);
  });

  const step = 60 / c.bpm / 2;
  let next = ctx.currentTime + 0.1; let i = 0;
  const timer = window.setInterval(() => {
    while (next < ctx.currentTime + 0.2) {
      const d = c.melody[i % c.melody.length];
      if (d != null) playNote(ctx, bus, c.instrument, degreeHz(c, d), next, step);
      const idx = i % c.melody.length;
      window.setTimeout(() => onStep(idx), Math.max(0, (next - ctx.currentTime) * 1000));
      next += step; i++;
    }
  }, 25);
  return { ctx, analyser, layerGains, timer, srcs };
}

const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);
// "misty forest slumber" -> "Misty Forest Slumber"; small words stay lowercase unless first or last.
const titleCase = (s: string) => {
  const words = s.trim().replace(/^["'“”]+|["'“”.]+$/g, "").split(/\s+/);
  return words.map((w, i) => {
    if (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
    const lw = w.toLowerCase();
    return i > 0 && i < words.length - 1 && SMALL_WORDS.has(lw) ? lw : lw.charAt(0).toUpperCase() + lw.slice(1);
  }).join(" ");
};
const sentenceCase = (s: string) => {
  const t = s.trim();
  const c = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(c) ? c : `${c}.`;
};

function AiMusic() {
  const [prompt, setPrompt] = useState(MUSIC_PROMPTS[0]!);
  const [song, setSong] = useState<Composition | null>(null);
  const [levels, setLevels] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [library, setLibrary] = useState<SavedComposition[]>([]);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [showSaved, setShowSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const engine = useRef<MusicEngine | null>(null);
  const lastPrompt = useRef("");

  const loadLibrary = () =>
    supabase?.from("compositions").select("id, created_at, prompt, title, composition").order("created_at", { ascending: false })
      .then(({ data }) => setLibrary((data ?? []) as SavedComposition[]));
  useEffect(() => { loadLibrary(); }, []);

  const save = async () => {
    if (!supabase || !song) return;
    setSaved("saving"); setError("");
    const { error } = await supabase.from("compositions").insert({ prompt: lastPrompt.current, title: song.title, composition: song });
    if (error) {
      setSaved("idle");
      console.error("Saving composition failed", error);
      setError(/fetch|network/i.test(error.message)
        ? "Couldn't reach the cloud library. Check your connection, or that the Supabase project is running."
        : `Couldn't save to the cloud library: ${error.message}`);
      return;
    }
    setSaved("saved"); loadLibrary();
  };
  const open = (row: SavedComposition) => {
    const c = sanitizeComposition(row.composition as Partial<Record<keyof Composition, unknown>>, SOUND_LIBRARY.map((s) => s.name));
    setSong(c); setLevels(c.layers.map((l) => l.level)); setSaved("saved"); setOpenId(row.id); play(c);
  };
  const canvas = useRef<HTMLCanvasElement>(null);

  const stop = () => {
    const e = engine.current; if (!e) return;
    window.clearInterval(e.timer);
    e.srcs.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    e.ctx.close();
    engine.current = null; setBeat(-1);
  };
  const play = (c: Composition) => { stop(); engine.current = startMusic(c, setBeat); setPlaying(true); };

  useEffect(() => stop, []);
  useEffect(() => {
    const e = engine.current; if (!e || !song) return;
    e.layerGains.forEach((g, i) => g.gain.setTargetAtTime(((levels[i] ?? 0) / 100) * 0.3, e.ctx.currentTime, 0.1));
  }, [levels]);

  const generate = async () => {
    setLoading(true); setError("");
    try {
      const c = await composeMusic({ data: { prompt, sounds: SOUND_LIBRARY.map((s) => s.name) } });
      lastPrompt.current = prompt; setSaved("idle"); setOpenId(null);
      setSong(c); setLevels(c.layers.map((l) => l.level)); play(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong composing your music.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let raf = 0; let t = 0;
    const draw = () => {
      const c = canvas.current; if (!c) return;
      const g = c.getContext("2d")!;
      const w = (c.width = c.clientWidth), h = (c.height = c.clientHeight);
      let data: number[];
      if (engine.current) {
        const arr = new Uint8Array(engine.current.analyser.frequencyBinCount);
        engine.current.analyser.getByteFrequencyData(arr);
        data = Array.from(arr, (x) => x / 255);
      } else {
        t += 0.02;
        data = Array.from({ length: 64 }, (_, i) => 0.15 + 0.1 * Math.sin(t + i * 0.4));
      }
      const col = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
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

  return (
    <div className="grid h-full grid-cols-[300px_1fr_280px] gap-6">
      <aside className="glass flex flex-col gap-3 rounded-3xl p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Describe your music</p>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={500} rows={4}
          className="resize-none rounded-2xl border border-input bg-secondary/60 p-4 text-sm outline-none focus:border-primary" />
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {MUSIC_PROMPTS.map((p) => (
            <button key={p} onClick={() => setPrompt(p)}
              className={`rounded-xl px-3 py-2 text-left text-xs transition ${p === prompt ? "bg-primary/20 text-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{p}</button>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button onClick={generate} disabled={loading || !prompt.trim()}
          className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow transition hover:scale-[1.02] disabled:opacity-50">
          {loading ? "Composing…" : "Generate music"}
        </button>
      </aside>

      <section className="glass flex min-h-0 flex-col gap-4 rounded-3xl p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{song ? (playing ? "Now playing" : "Your track") : "AI Ambience"}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold leading-tight text-primary">{song ? titleCase(song.title) : "Compose an Ambience"}</h2>
            <p className="mt-3 max-w-xl border-l-2 border-primary/50 pl-4 text-sm italic leading-relaxed text-muted-foreground">
              {song?.description ? sentenceCase(song.description) : "Describe a place or a feeling. The AI composes a melody and arranges nature sounds around it."}
            </p>
          </div>
          {song && (
            <div className="flex w-28 shrink-0 flex-col gap-2">
              <button onClick={() => setEditing(true)}
                className="rounded-full border border-primary/50 px-5 py-2 text-sm text-primary transition hover:bg-primary/10">Edit</button>
              {supabase && (
                <button onClick={save} disabled={saved !== "idle"}
                  className="rounded-full border border-primary/50 px-5 py-2 text-sm text-primary transition hover:bg-primary/10 disabled:opacity-60">
                  {saved === "saved" ? "Saved" : saved === "saving" ? "Saving…" : "Save"}
                </button>
              )}
              <button onClick={() => (playing ? (stop(), setPlaying(false)) : play(song))}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground glow">{playing ? "Pause" : "Play"}</button>
            </div>
          )}
        </div>
        <canvas ref={canvas} className="min-h-0 w-full flex-1 rounded-2xl bg-track/60" />
        {song && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Melody · {song.instrument}</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${song.melody.length}, minmax(0, 1fr))` }}>
              {song.melody.map((d, i) => (
                <div key={i} className="relative h-16 rounded bg-muted/60">
                  {d != null && (
                    <div className={`absolute inset-x-0 h-1.5 rounded-full transition ${i === beat ? "bg-foreground" : "bg-primary"}`} style={{ bottom: `${(d / 14) * 85}%` }} />
                  )}
                  {i === beat && <div className="absolute inset-0 rounded bg-primary/20" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4">
        <div className="glass grid grid-cols-2 gap-3 rounded-3xl p-5 text-center">
          {([["Tempo", song ? `${song.bpm} BPM` : "–"], ["Key", song?.key ?? "–"], ["Scale", song?.scale ?? "–"]] as const).map(([k, v]) => (
            <div key={k} className={k === "Scale" ? "col-span-2" : ""}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</p>
              <p className="mt-1 font-display text-lg font-semibold capitalize text-primary">{v}</p>
            </div>
          ))}
        </div>
        {supabase && (
          <div className="glass flex max-h-[40%] min-h-0 flex-col rounded-3xl p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Saved library</p>
            {library.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nothing saved yet.</p>}
            <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {library.map((row) => (
                <li key={row.id}>
                  <button onClick={() => open(row)} title={row.prompt}
                    className="w-full truncate rounded-xl bg-secondary/50 px-3 py-2 text-left text-xs transition hover:bg-secondary">{titleCase(row.title)}</button>
                </li>
              ))}
            </ul>
            <button onClick={() => { loadLibrary(); setShowSaved(true); }}
              className="mt-3 rounded-full border border-primary/50 px-4 py-2 text-xs text-primary transition hover:bg-primary/10">View saved</button>
          </div>
        )}
        <div className="glass min-h-0 flex-1 overflow-y-auto rounded-3xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Nature layers</p>
          {!song && <p className="mt-3 text-sm text-muted-foreground">Generate a piece to see which sounds the AI picked.</p>}
          <ul className="mt-3 space-y-4">
            {song?.layers.map((L, i) => (
              <li key={L.sound}>
                <div className="flex justify-between text-sm"><span>{L.sound}</span><span className="text-muted-foreground">{levels[i]}%</span></div>
                <input type="range" min={0} max={100} value={levels[i] ?? 0} aria-label={L.sound}
                  onChange={(e) => setLevels(levels.map((x, j) => (j === i ? +e.target.value : x)))}
                  className="mt-1 w-full accent-[var(--primary)]" />
              </li>
            ))}
          </ul>
        </div>
      </aside>
      {showSaved && (
        <SavedLibraryModal library={library} playingId={playing ? openId : null} onClose={() => setShowSaved(false)}
          onPlay={open} onPause={() => { stop(); setPlaying(false); }} />
      )}
      {editing && song && (
        <EditMusicModal song={song} onClose={() => setEditing(false)} onApply={(c) => {
          // An edited piece is a new version, so it can be saved again.
          setSong(c); setSaved("idle"); setOpenId(null); setEditing(false);
          if (playing) play(c);
        }} />
      )}
    </div>
  );
}

const TOP_DEGREE = 14;

function EditMusicModal({ song, onClose, onApply }: { song: Composition; onClose: () => void; onApply: (c: Composition) => void }) {
  const [draft, setDraft] = useState(song);
  const set = (p: Partial<Composition>) => setDraft({ ...draft, ...p });
  const setNote = (i: number, d: number) => set({ melody: draft.melody.map((x, j) => (j === i ? (x === d ? null : d) : x)) });
  const resize = (n: number) => set({ melody: n < draft.melody.length ? draft.melody.slice(0, n) : [...draft.melody, ...Array(n - draft.melody.length).fill(null)] });
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const field = "rounded-full border border-input bg-secondary/60 px-4 py-2 text-sm capitalize outline-none focus:border-primary";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Edit music" onClick={(e) => e.stopPropagation()}
        className="glass flex max-h-[90vh] w-[min(980px,94vw)] flex-col rounded-[2rem] p-8 animate-in zoom-in-95">
        <h3 className="font-display text-2xl font-semibold text-primary">Edit “{titleCase(song.title)}”</h3>
        <div className="mt-5 grid grid-cols-4 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Key</span>
            <select value={draft.key} onChange={(e) => set({ key: e.target.value as Composition["key"] })} className={field}>
              {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Scale</span>
            <select value={draft.scale} onChange={(e) => set({ scale: e.target.value as Composition["scale"] })} className={field}>
              {SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Melody sound</span>
            <select value={draft.instrument} onChange={(e) => set({ instrument: e.target.value as Composition["instrument"] })} className={field}>
              {INSTRUMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">Tempo<span className="text-foreground">{draft.bpm} BPM</span></span>
            <input type="range" min={40} max={120} value={draft.bpm} onChange={(e) => set({ bpm: +e.target.value })} className="mt-2 w-full accent-[var(--primary)]" />
          </label>
        </div>

        <div className="mt-6 flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Melody · click a cell to place a note, click it again for a rest</p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Length
            <select value={draft.melody.length} onChange={(e) => resize(+e.target.value)} className="rounded-full border border-input bg-secondary/60 px-3 py-1 text-xs outline-none">
              {[8, 12, 16, 20, 24, 28, 32].map((n) => <option key={n} value={n}>{n} steps</option>)}
            </select>
          </label>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-2xl bg-muted/60 p-3">
          <div className="grid gap-px" style={{ gridTemplateColumns: `2.5rem repeat(${draft.melody.length}, minmax(1.25rem, 1fr))` }}>
            {Array.from({ length: TOP_DEGREE + 1 }, (_, r) => TOP_DEGREE - r).map((d) => (
              <Fragment key={d}>
                <span className="pr-2 text-right text-[10px] leading-5 text-muted-foreground">{degreeName(draft, d)}</span>
                {draft.melody.map((x, i) => (
                  <button key={i} onClick={() => setNote(i, d)} aria-label={`Step ${i + 1}, ${degreeName(draft, d)}`}
                    className={`h-5 rounded-sm transition ${x === d ? "bg-primary" : i % 4 === 0 ? "bg-track/80 hover:bg-primary/40" : "bg-track/50 hover:bg-primary/40"}`} />
                ))}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-5 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={() => onApply(draft)}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground glow">Apply changes</button>
        </div>
      </div>
    </div>
  );
}

function SavedLibraryModal({ library, playingId, onClose, onPlay, onPause }: {
  library: SavedComposition[]; playingId: string | null; onClose: () => void; onPlay: (row: SavedComposition) => void; onPause: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Saved music" onClick={(e) => e.stopPropagation()}
        className="glass flex max-h-[80vh] w-[min(640px,92vw)] flex-col rounded-[2rem] p-8 animate-in zoom-in-95">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-2xl font-semibold text-primary">Saved music</h3>
          <span className="text-xs text-muted-foreground">{library.length} {library.length === 1 ? "piece" : "pieces"}</span>
        </div>
        {library.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nothing saved yet. Generate a piece and press Save to add it here.</p>}
        <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {library.map((row) => {
            const on = row.id === playingId;
            return (
              <li key={row.id} className={`flex items-center gap-4 rounded-2xl px-4 py-3 transition ${on ? "bg-primary/15" : "bg-secondary/50"}`}>
                <button onClick={() => (on ? onPause() : onPlay(row))} aria-label={`${on ? "Pause" : "Play"} ${row.title}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground glow transition hover:scale-105">{on ? "❚❚" : "▶"}</button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold">{titleCase(row.title)}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.prompt}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-full px-5 py-2 text-sm text-muted-foreground hover:text-foreground">Close</button>
        </div>
      </div>
    </div>
  );
}

type AuthMode = "signin" | "signup" | "forgot" | "reset";
const AUTH_COPY: Record<AuthMode, [title: string, blurb: string, submit: string]> = {
  signin: ["Welcome back", "Sign in to keep composing your ambiences.", "Sign in"],
  signup: ["Create your account", "Join EchoNature to save your ambiences and biomes.", "Create account"],
  forgot: ["Reset your password", "Enter your email and we'll send you a link to choose a new password.", "Send reset link"],
  reset: ["Choose a new password", "Enter the new password for your account.", "Save new password"],
};

// Supabase reports an unreachable project as a fetch TypeError rather than an API error.
const authMessage = (e: { message: string }) =>
  /fetch|network/i.test(e.message) ? "Couldn't reach the sign-in service. Check your connection and try again." : e.message;

function SignIn({ recovering, onDone }: { recovering: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<AuthMode>(recovering ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (recovering) setMode("reset"); }, [recovering]);

  const go = (m: AuthMode) => { setMode(m); setError(""); setNotice(""); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return setError(authMessage(error));
        onDone();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return setError(authMessage(error));
        // With email confirmation on, there is no session until the link is clicked.
        if (data.session) onDone();
        else { go("signin"); setNotice("Check your email for a link to confirm your account, then sign in."); }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) return setError(authMessage(error));
        setNotice("If an account exists for that email, a reset link is on its way.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return setError(authMessage(error));
        setPassword(""); onDone();
      }
    } catch (err) {
      setError(authMessage(err instanceof Error ? err : { message: "network" }));
    } finally {
      setBusy(false);
    }
  };

  const [title, blurb, cta] = AUTH_COPY[mode];
  const field = "rounded-full border border-input bg-secondary/60 px-5 py-3 text-sm outline-none focus:border-primary";
  const link = "text-primary hover:underline";
  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={submit} className="glass flex w-[min(420px,92vw)] flex-col rounded-[2rem] p-8">
        <img src={logo} alt="" className="h-14 w-14 self-center rounded-full object-cover" />
        <h2 className="mt-4 text-center font-display text-3xl font-semibold text-primary">{title}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">{blurb}</p>
        {!supabase ? (
          <p className="mt-6 text-center text-sm text-destructive">Sign-in isn't available: the cloud connection isn't configured.</p>
        ) : (
          <>
            {mode !== "reset" && (
              <label className="mt-6 flex flex-col gap-1.5">
                <span className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground">Email</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </label>
            )}
            {mode !== "forgot" && (
              <label className={`${mode === "reset" ? "mt-6" : "mt-4"} flex flex-col gap-1.5`}>
                <span className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground">{mode === "reset" ? "New password" : "Password"}</span>
                <input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
              </label>
            )}
            {error && <p className="mt-3 px-2 text-xs text-destructive">{error}</p>}
            {notice && <p className="mt-3 px-2 text-xs text-primary">{notice}</p>}
            <button type="submit" disabled={busy}
              className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow transition hover:scale-[1.02] disabled:opacity-50">
              {busy ? "Please wait…" : cta}
            </button>
            {mode === "signin" && (
              <>
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  Forgot your password? <button type="button" onClick={() => go("forgot")} className={link}>Reset it</button>
                </p>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  New to EchoNature? <button type="button" onClick={() => go("signup")} className={link}>Create an account</button>
                </p>
              </>
            )}
            {(mode === "signup" || mode === "forgot") && (
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Already have an account? " : "Remembered it? "}
                <button type="button" onClick={() => go("signin")} className={link}>Sign in</button>
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}

const GUIDE: [string, string, View][] = [
  ["Compose with AI", "In AI Ambience, describe a place or a feeling. The AI writes a melody and arranges nature sounds around it.", "music"],
  ["Make it yours", "Press Edit to change the key, tempo, scale, melody notes and the instrument that plays them.", "music"],
  ["Save & replay", "Save the pieces you like. Use View saved to see every piece in your library and play any of them again.", "music"],
  ["Mix a biome", "In the Biome Equalizer, choose a habitat like Rainforest or Cave. Each slider is one layer; 50 is the normal level.", "equalizer"],
  ["Build your own", "Tap + Add biome, pick up to six sounds from the library and create a custom biome. It's saved so you can come back to it.", "equalizer"],
];

const USES: [string, string][] = [
  ["Wind down before sleep", "Low, steady textures — whale song, cave hum, soft rain — with high, busy layers turned down."],
  ["Get into focus", "Broadband sounds like wind, rapids or rainfall mask chatter and keep the room from feeling silent."],
  ["Take a calm break", "A few minutes of slow, regular natural rhythm between tasks helps reset stress."],
  ["Fuel creative work", "Rich, lively habitats like a rainforest canopy add energy without words to distract you."],
];

function About({ onGo }: { onGo: (v: View) => void }) {
  return (
    <div className="h-full overflow-y-auto px-6 pb-10">
      <section className="grid min-h-full grid-cols-2 items-center gap-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Our goal</p>
          <h1 className="mt-4 font-display text-5xl font-light leading-tight xl:text-6xl">
            Nature becomes the dataset. <span className="font-semibold text-primary">AI becomes the interpreter.</span>
          </h1>
          <p className="mt-6 max-w-xl text-muted-foreground">
            EchoNature AI is building a bioacoustic foundation model that learns from millions of wildlife recordings. Our mission is to turn the sound of living ecosystems into personalized digital therapeutics — while every listen supports and teaches biodiversity conservation.
          </p>
          <div className="mt-8 flex gap-3">
            <button onClick={() => onGo("music")} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow transition hover:scale-[1.02]">Start a session</button>
            <button onClick={() => onGo("equalizer")} className="rounded-full border border-primary/50 px-6 py-3 text-sm text-primary transition hover:bg-primary/10">Open Biome Equalizer</button>
          </div>
          <p className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">Scroll to learn how it works ↓</p>
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
      </section>

      <section className="mt-16">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Getting started</p>
        <h2 className="mt-3 font-display text-3xl font-semibold">How to use EchoNature</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          EchoNature has two tools. AI Ambience composes an original piece from a description; the Biome Equalizer lets you mix real habitat soundscapes by hand. Headphones at a comfortable volume give the best result.
        </p>
        <div className="mt-6 grid grid-cols-5 gap-4">
          {GUIDE.map(([t, d, v], i) => (
            <button key={t} onClick={() => onGo(v)} className="glass flex flex-col rounded-3xl p-6 text-left transition hover:-translate-y-1">
              <span className="text-xs uppercase tracking-widest text-primary">Step {i + 1}</span>
              <h3 className="mt-3 font-display text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">What to do with it</p>
        <h2 className="mt-3 font-display text-3xl font-semibold">Ideas for your sessions</h2>
        <div className="mt-6 grid grid-cols-4 gap-4">
          {USES.map(([t, d]) => (
            <div key={t} className="rounded-3xl bg-muted/60 p-6">
              <h3 className="font-display text-lg font-semibold text-primary">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Under the hood</p>
        <h2 className="mt-3 font-display text-3xl font-semibold">The Ecological Therapeutic Engine</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Personalized therapeutic soundscapes composed from the acoustic structure of living ecosystems.</p>
        <div className="mt-6 grid grid-cols-5 gap-4">
          {STAGES.map(([t, d], i) => (
            <div key={t} className="glass flex min-h-56 flex-col rounded-3xl p-6 transition hover:-translate-y-1">
              <span className="font-display text-5xl font-light text-primary">0{i + 1}</span>
              <h3 className="mt-auto font-display text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
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
  const typed = name.trim();
  // With no name typed, use the suggested one, numbered if it's already taken.
  const suggested = suggestName(picked);
  let fallback = suggested;
  for (let i = 2; taken.includes(fallback); i++) fallback = `${suggested} ${i}`;
  const n = typed || fallback;
  const valid = !taken.includes(n) && picked.length > 0;
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Biome name (default: ${fallback})`} maxLength={24}
          className="mt-4 rounded-full border border-input bg-secondary/60 px-5 py-2.5 text-sm outline-none focus:border-primary" />
        {typed && taken.includes(typed) && <p className="mt-1 px-2 text-xs text-destructive">That name is already used.</p>}
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
