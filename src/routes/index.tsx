import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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

const PRESETS: Record<string, { goal: string; eco: string; v: number[]; why: string }> = {
  Calm: { goal: "High anxiety", eco: "Coastal mangrove dawn chorus", v: [40, 55, 70, 62, 48, 35, 58, 44, 30, 20], why: "Rhythmic regularity and soft spectral balance in the low-mids." },
  Create: { goal: "Creative work", eco: "Amazon rainforest canopy", v: [30, 45, 50, 60, 72, 80, 90, 85, 70, 55], why: "High vocal diversity and acoustic richness in upper bands." },
  Focus: { goal: "Deep focus", eco: "Arctic tundra windscape", v: [55, 60, 75, 70, 50, 30, 22, 18, 14, 10], why: "Low temporal complexity and steady broadband wind texture." },
  Sleep: { goal: "Sleep", eco: "Humpback whale communication", v: [90, 82, 64, 45, 30, 20, 14, 10, 8, 5], why: "Slow frequency modulation and dominant sub-bass contours." },
  Regulate: { goal: "Emotional regulation", eco: "Temperate forest after rainfall", v: [35, 48, 62, 74, 66, 55, 60, 48, 36, 26], why: "Even harmonic spacing with gentle droplet transients." },
};

const STAGES = [
  ["Global Bioacoustic Intelligence", "Millions of recordings from Macaulay Library, Xeno-Canto, NOAA and Rainforest Connection."],
  ["AI Species Intelligence", "Species, habitat, behavior, season and acoustic-health fingerprints for every clip."],
  ["Bioacoustic Embedding", "Pitch contours, MFCCs, spectral entropy and rhythm complexity in one latent space."],
  ["Therapeutic Composer", "Transformer models generate original soundscapes tuned to mood, stress and time of day."],
  ["Continuous Learning", "Mood, listening duration and HRV feedback refine every next session."],
];

function Index() {
  const [preset, setPreset] = useState("Calm");
  const [vals, setVals] = useState(PRESETS.Calm.v);
  const p = PRESETS[preset];
  const health = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);

  return (
    <main className="min-h-screen font-sans">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="EchoNature AI logo" className="h-10 w-10 rounded-full" />
          <span className="font-display text-lg font-semibold">EchoNature<span className="text-primary"> AI</span></span>
        </div>
        <a href="#mixer" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground glow">Start a session</a>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">Bioacoustic foundation model</p>
        <h1 className="mt-4 max-w-4xl font-display text-5xl font-light leading-tight md:text-7xl">
          Nature becomes the dataset. <span className="font-semibold text-primary">AI becomes the interpreter.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Personalized therapeutic soundscapes composed from the acoustic structure of living ecosystems — and every session teaches you the species behind the sound.
        </p>
      </section>

      <section id="mixer" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-[2rem] bg-card p-6 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold text-primary">Ecosystem Composer</h2>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESETS).map((k) => (
                <button key={k} onClick={() => { setPreset(k); setVals(PRESETS[k].v); }}
                  className={`rounded-full px-4 py-1.5 text-sm transition ${k === preset ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_260px]">
            <div className="rounded-3xl bg-muted p-6">
              <div className="flex h-72 items-end justify-between gap-2">
                {vals.map((v, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center">
                    <div className="relative h-full w-2 rounded-full bg-track">
                      <div className="bar-fill absolute bottom-0 w-full rounded-full transition-all duration-500" style={{ height: `${v}%` }} />
                      <div className="absolute left-1/2 h-5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-primary bg-secondary transition-all duration-500" style={{ bottom: `${v}%` }} />
                      <input type="range" min={0} max={100} value={v} aria-label={BANDS[i]}
                        onChange={(e) => setVals(vals.map((x, j) => (j === i ? +e.target.value : x)))}
                        className="absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 cursor-pointer opacity-0 [writing-mode:vertical-lr] [direction:rtl]" />
                    </div>
                    <span className="mt-4 text-xs text-foreground">{BAND_HZ[i]}</span>
                    <span className="text-[10px] text-muted-foreground">{BANDS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <aside className="flex flex-col gap-4">
              <div className="rounded-3xl bg-muted p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.goal}</p>
                <p className="mt-2 font-display text-lg">{p.eco}</p>
              </div>
              <div className="rounded-3xl bg-muted p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Acoustic Health Index</p>
                <p className="mt-1 font-display text-4xl font-semibold text-primary">{health}</p>
              </div>
              <div className="flex-1 rounded-3xl bg-muted p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Why this ecosystem</p>
                <p className="mt-2 text-sm">{p.why}</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display text-3xl font-semibold">The Ecological Therapeutic Engine</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-5">
          {STAGES.map(([t, d], i) => (
            <div key={t} className="rounded-3xl border border-border bg-card p-5">
              <span className="font-display text-sm text-primary">0{i + 1}</span>
              <h3 className="mt-3 font-display font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        EchoNature AI — healthcare personalized through ecology.
      </footer>
    </main>
  );
}
