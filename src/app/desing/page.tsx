'use client';

import React, { useState } from 'react';

/**
 * /desing — Variaciones de la dirección "Quirófano" para CCEM UC
 *
 * El cliente eligió Quirófano. Aquí van tres variaciones que comparten su ADN
 * clínico (verde quirúrgico + campo estéril, Space Grotesk + Inter + Space Mono,
 * y el motivo de la "incisión") pero cambian de carácter:
 *
 *   01 Luz       — mínimo y aireado, casi todo espacio en blanco
 *   02 Pabellón  — oscuro y cinemático, con el halo de la lámpara cialítica
 *   03 Bisturí   — técnico y estructurado, como una lámina/plano quirúrgico
 *
 * Vitrina para elegir. No toca el resto del sitio.
 */

const NAV = ['Quiénes somos', 'Módulos', 'Cronograma', 'Competencia', 'Contacto'];

const MODULES = [
  { n: '01', sem: 'SEM 1', t: 'Cirugía Digestiva y Coloproctología', d: '02–04 SEP' },
  { n: '02', sem: 'SEM 1', t: 'Cirugía de Trauma y Urología', d: '02–04 SEP' },
  { n: '03', sem: 'SEM 2', t: 'Cirugía Plástica y Oncológica', d: '09–11 SEP' },
  { n: '04', sem: 'SEM 2', t: 'Cirugía de Tórax, Cardíaca y Vascular', d: '09–11 SEP' },
];

const PASSES = [
  { t: 'Pase General Congreso', p: '$25.900', d: 'Congreso completo + un módulo por semana' },
  { t: 'Pase Congreso + Workshop', p: '$28.900', d: 'Todo lo anterior + un workshop práctico' },
];

type DirId = 'v1' | 'v2' | 'v3';

const TABS: { id: DirId; idx: string; name: string; mood: string }[] = [
  { id: 'v1', idx: '01', name: 'Luz', mood: 'Mínimo · aireado · sereno' },
  { id: 'v2', idx: '02', name: 'Pabellón', mood: 'Oscuro · cinemático · premium' },
  { id: 'v3', idx: '03', name: 'Bisturí', mood: 'Técnico · preciso · estructurado' },
];

/* ---------------------------------- shared bits ---------------------------------- */

function Swatch({ hex, name }: { hex: string; name: string }) {
  return (
    <div className="dz-swatch">
      <span className="dz-swatch-chip" style={{ background: hex }} />
      <span className="dz-swatch-name">{name}</span>
      <span className="dz-swatch-hex">{hex}</span>
    </div>
  );
}

function TokenBlock({
  palette,
  type,
  signature,
  forWhom,
  risk,
}: {
  palette: { hex: string; name: string }[];
  type: { role: string; family: string }[];
  signature: string;
  forWhom: string;
  risk: string;
}) {
  return (
    <div className="dz-tokens">
      <div className="dz-token-col">
        <h4 className="dz-token-h">Paleta</h4>
        <div className="dz-swatches">
          {palette.map((p) => (
            <Swatch key={p.hex + p.name} hex={p.hex} name={p.name} />
          ))}
        </div>
      </div>
      <div className="dz-token-col">
        <h4 className="dz-token-h">Tipografía</h4>
        <ul className="dz-typelist">
          {type.map((t) => (
            <li key={t.role}>
              <span className="dz-type-role">{t.role}</span>
              <span className="dz-type-fam">{t.family}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="dz-token-col">
        <h4 className="dz-token-h">Firma</h4>
        <p className="dz-token-p">{signature}</p>
        <h4 className="dz-token-h dz-token-h--mt">Para quién</h4>
        <p className="dz-token-p">{forWhom}</p>
        <h4 className="dz-token-h dz-token-h--mt">Riesgo asumido</h4>
        <p className="dz-token-p">{risk}</p>
      </div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dz-frame">
      <div className="dz-frame-bar">
        <span className="dz-dot" />
        <span className="dz-dot" />
        <span className="dz-dot" />
        <span className="dz-url">ccemuc.cl</span>
      </div>
      <div className="dz-frame-body">{children}</div>
    </div>
  );
}

/* Bisturí — line-art técnico de un bisturí con cotas de medición */
const Scalpel = () => (
  <svg className="dz-v3-svg" viewBox="0 0 440 150" fill="none" aria-hidden>
    {/* cotas / crosshair */}
    <line x1="392" y1="20" x2="392" y2="44" stroke="#E2483D" strokeWidth="1.4" />
    <line x1="380" y1="32" x2="404" y2="32" stroke="#E2483D" strokeWidth="1.4" />
    <circle cx="392" cy="32" r="3" fill="#E2483D" />
    {/* mango */}
    <rect x="48" y="70" width="232" height="16" rx="8" stroke="#0F6E6E" strokeWidth="1.6" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
      <line key={i} x1={78 + i * 22} y1="73" x2={78 + i * 22} y2="83" stroke="#0F6E6E" strokeWidth="1" opacity="0.6" />
    ))}
    {/* cuello */}
    <path d="M280 74 L300 70 L300 86 L280 82 Z" stroke="#0F6E6E" strokeWidth="1.6" />
    {/* hoja */}
    <path d="M300 70 L398 44 Q418 42 410 62 L300 86 Z" stroke="#0F6E6E" strokeWidth="1.6" />
    {/* línea de medida bajo el mango */}
    <line x1="48" y1="110" x2="280" y2="110" stroke="#9AA8A6" strokeWidth="1" />
    <line x1="48" y1="105" x2="48" y2="115" stroke="#9AA8A6" strokeWidth="1" />
    <line x1="280" y1="105" x2="280" y2="115" stroke="#9AA8A6" strokeWidth="1" />
  </svg>
);

/* ============================== VARIATION 01 — LUZ ============================== */

function VariationLuz() {
  return (
    <div className="dz-dir">
      <Frame>
        <div className="dz-v1">
          <header className="dz-v1-head">
            <div className="dz-v1-brand">
              <span className="dz-v1-mark">CCEM·UC</span>
              <span className="dz-v1-sub">CONGRESO DE CIRUGÍA · ESTUDIANTES DE MEDICINA</span>
            </div>
            <nav className="dz-v1-nav">
              {NAV.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </nav>
            <button className="dz-v1-cta">Inscríbete</button>
          </header>

          <section className="dz-v1-hero">
            <p className="dz-v1-eyebrow">I CONGRESO · 31 AGO — 14 SEP 2024 · SANTIAGO</p>
            <h1 className="dz-v1-title">
              Cirugía UC para
              <br />
              estudiantes de medicina
            </h1>
            <div className="dz-v1-incision">
              <span className="dz-v1-incision-line" />
              <span className="dz-v1-incision-tick" />
            </div>
            <p className="dz-v1-lede">
              El futuro de la cirugía: innovación y nuevas perspectivas.
            </p>
            <div className="dz-v1-actions">
              <button className="dz-v1-cta dz-v1-cta--lg">Sé parte del congreso</button>
              <button className="dz-v1-ghost">Ver módulos →</button>
            </div>
            <div className="dz-v1-stats">
              <span><b>04</b> módulos</span>
              <span className="dz-v1-stats-sep" />
              <span><b>02</b> workshops</span>
              <span className="dz-v1-stats-sep" />
              <span><b>01</b> competencia científica</span>
            </div>
          </section>

          <section className="dz-v1-passes">
            {PASSES.map((p) => (
              <article className="dz-v1-pass" key={p.t}>
                <h3 className="dz-v1-pass-t">{p.t}</h3>
                <p className="dz-v1-pass-d">{p.d}</p>
                <span className="dz-v1-pass-p">{p.p}</span>
              </article>
            ))}
          </section>
        </div>
      </Frame>

      <TokenBlock
        palette={[
          { hex: '#F4F7F6', name: 'Campo estéril' },
          { hex: '#0F6E6E', name: 'Verde quirúrgico' },
          { hex: '#0A3B3B', name: 'Quirófano profundo' },
          { hex: '#9AA8A6', name: 'Acero' },
          { hex: '#E2483D', name: 'Incisión (acento)' },
        ]}
        type={[
          { role: 'Display', family: 'Space Grotesk · ajustado, técnico' },
          { role: 'Cuerpo', family: 'Inter · humanista, legible' },
          { role: 'Dato', family: 'Space Mono · etiquetas de ficha' },
        ]}
        signature="La incisión como único divisor y una franja de datos en mono. Casi todo es aire: el contenido respira."
        forWhom="Quien quiere claridad y confianza inmediata, sin ruido visual."
        risk="Apostar al vacío — el espacio en blanco hace casi todo el trabajo, no hay fotos ni adornos."
      />
    </div>
  );
}

/* ============================ VARIATION 02 — PABELLÓN ============================ */

function VariationPabellon() {
  return (
    <div className="dz-dir">
      <Frame>
        <div className="dz-v2">
          <header className="dz-v2-head">
            <span className="dz-v2-mark">CCEM·UC</span>
            <nav className="dz-v2-nav">
              {NAV.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </nav>
            <button className="dz-v2-cta">Inscríbete</button>
          </header>

          <section className="dz-v2-hero">
            <p className="dz-v2-eyebrow">I CONGRESO · 31 AGO — 14 SEP 2024</p>
            <h1 className="dz-v2-title">
              Cirugía UC para
              <br />
              estudiantes de medicina
            </h1>
            <div className="dz-v2-incision">
              <span className="dz-v2-incision-line" />
            </div>
            <p className="dz-v2-lede">El futuro de la cirugía: innovación y nuevas perspectivas.</p>
            <div className="dz-v2-actions">
              <button className="dz-v2-cta dz-v2-cta--lg">Sé parte del congreso</button>
              <button className="dz-v2-ghost">Ver módulos →</button>
            </div>
          </section>

          <section className="dz-v2-cards">
            {MODULES.map((m) => (
              <div className="dz-v2-card" key={m.n}>
                <div className="dz-v2-card-top">
                  <span className="dz-v2-card-n">M{m.n}</span>
                  <span className="dz-v2-card-sem">{m.sem}</span>
                </div>
                <h3 className="dz-v2-card-t">{m.t}</h3>
                <span className="dz-v2-card-d">{m.d}</span>
              </div>
            ))}
          </section>
        </div>
      </Frame>

      <TokenBlock
        palette={[
          { hex: '#07211F', name: 'Pabellón' },
          { hex: '#0A3B3B', name: 'Quirófano profundo' },
          { hex: '#0F6E6E', name: 'Verde quirúrgico' },
          { hex: '#6FD7CF', name: 'Menta vital' },
          { hex: '#DDF3EC', name: 'Luz cialítica' },
          { hex: '#E2483D', name: 'Incisión (acento)' },
        ]}
        type={[
          { role: 'Display', family: 'Space Grotesk · ajustado, técnico' },
          { role: 'Cuerpo', family: 'Inter · humanista, legible' },
          { role: 'Dato', family: 'Space Mono · etiquetas de ficha' },
        ]}
        signature="El halo de la lámpara cialítica detrás del título —la luz del pabellón— y la incisión que brilla sobre el fondo oscuro."
        forWhom="Tono premium y cinemático; rinde muy bien en afiches y redes sociales."
        risk="Invertir a oscuro un tema que suele ser blanco clínico, para ganar dramatismo y foco."
      />
    </div>
  );
}

/* ============================= VARIATION 03 — BISTURÍ ============================= */

function VariationBisturi() {
  return (
    <div className="dz-dir">
      <Frame>
        <div className="dz-v3">
          <header className="dz-v3-head">
            <div className="dz-v3-brand">
              <span className="dz-v3-mark">CCEM·UC</span>
              <span className="dz-v3-coord">33°26′S · 70°39′O</span>
            </div>
            <nav className="dz-v3-nav">
              {NAV.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </nav>
            <button className="dz-v3-cta">Inscríbete</button>
          </header>

          <section className="dz-v3-hero">
            <div className="dz-v3-hero-l">
              <p className="dz-v3-eyebrow">REG. 01 · CONGRESO DE CIRUGÍA UC</p>
              <h1 className="dz-v3-title">
                Cirugía UC para estudiantes de medicina
              </h1>
              <p className="dz-v3-lede">
                El futuro de la cirugía: innovación y nuevas perspectivas.
              </p>
              <div className="dz-v3-spec">
                <div><span className="dz-v3-tick" />31 AGO — 14 SEP 2024</div>
                <div><span className="dz-v3-tick" />04 módulos · 02 workshops</div>
                <div><span className="dz-v3-tick" />Competencia científica CCEM UC</div>
              </div>
              <div className="dz-v3-actions">
                <button className="dz-v3-cta dz-v3-cta--lg">Sé parte del congreso</button>
                <button className="dz-v3-ghost">Ver módulos →</button>
              </div>
            </div>
            <div className="dz-v3-hero-r">
              <Scalpel />
              <span className="dz-v3-fig">FIG. 1 — BISTURÍ Nº 15</span>
            </div>
          </section>

          <section className="dz-v3-tray">
            {MODULES.map((m) => (
              <div className="dz-v3-item" key={m.n}>
                <span className="dz-v3-item-n">{m.n}</span>
                <span className="dz-v3-item-sem">{m.sem}</span>
                <span className="dz-v3-item-t">{m.t}</span>
                <span className="dz-v3-item-d">{m.d}</span>
                <span className="dz-v3-tick dz-v3-tick--end" />
              </div>
            ))}
          </section>
        </div>
      </Frame>

      <TokenBlock
        palette={[
          { hex: '#F4F7F6', name: 'Campo estéril' },
          { hex: '#0F6E6E', name: 'Verde quirúrgico' },
          { hex: '#0A3B3B', name: 'Quirófano profundo' },
          { hex: '#9AA8A6', name: 'Acero' },
          { hex: '#E2483D', name: 'Incisión / cota' },
        ]}
        type={[
          { role: 'Display', family: 'Space Grotesk · ajustado, técnico' },
          { role: 'Cuerpo', family: 'Inter · humanista, legible' },
          { role: 'Dato', family: 'Space Mono · cotas y manifiesto' },
        ]}
        signature="Una lámina técnica: grilla de medición, el bisturí en line-art con cotas y marcas rojas, y los módulos como una bandeja de instrumental numerada."
        forWhom="Quien quiere transmitir rigor y precisión — sensación de plano o ficha quirúrgica."
        risk="Tratar la landing como un plano técnico (grilla + cotas + figuras) en lugar de fotografía."
      />
    </div>
  );
}

/* ================================== PAGE SHELL ================================== */

export default function DesignLookbook() {
  const [active, setActive] = useState<DirId>('v1');

  return (
    <main className="dz-root">
      <style>{CSS}</style>

      <header className="dz-top">
        <div className="dz-top-inner">
          <div className="dz-kicker">CCEM UC · Dirección «Quirófano» · 3 variaciones</div>
          <h1 className="dz-h1">
            Quirófano, <span className="dz-h1-accent">tres caminos</span>
          </h1>
          <p className="dz-intro">
            Las tres comparten el ADN clínico que elegiste —verde quirúrgico sobre campo estéril,
            Space Grotesk + Inter + Space Mono, y el motivo de la incisión— pero cambian de
            carácter: <b>Luz</b> apuesta al vacío, <b>Pabellón</b> se va a oscuro y cinemático, y
            <b> Bisturí</b> lo lleva a lámina técnica. Elige una y la construyo en todo el sitio.
          </p>
        </div>
      </header>

      <div className="dz-tabwrap">
        <div className="dz-tabs" role="tablist" aria-label="Variaciones de Quirófano">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              className={`dz-tab ${active === t.id ? 'dz-tab--on' : ''}`}
              onClick={() => setActive(t.id)}
            >
              <span className="dz-tab-idx">{t.idx}</span>
              <span className="dz-tab-name">{t.name}</span>
              <span className="dz-tab-mood">{t.mood}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="dz-stage">
        {active === 'v1' && <VariationLuz />}
        {active === 'v2' && <VariationPabellon />}
        {active === 'v3' && <VariationBisturi />}
      </section>

      <footer className="dz-foot">
        Vitrina interna · <code>/desing</code> · estas propuestas no afectan el sitio en producción
      </footer>
    </main>
  );
}

/* ================================== STYLES ================================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

.dz-root { --shell:#15171a; --shell-2:#1d2024; --mat:#0f1113; --line:#2c3036; --ink:#e8eaed; --mut:#9aa1ab;
  background:var(--shell); color:var(--ink); min-height:100vh;
  font-family:Inter, system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
.dz-root *, .dz-root *::before, .dz-root *::after { box-sizing:border-box; }

/* top */
.dz-top { border-bottom:1px solid var(--line); }
.dz-top-inner { max-width:1180px; margin:0 auto; padding:64px 32px 40px; }
.dz-kicker { font-family:'Space Mono', monospace; font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:var(--mut); }
.dz-h1 { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:clamp(34px,5vw,60px); line-height:1.02; letter-spacing:-.02em; margin:14px 0 0; }
.dz-h1-accent { color:#6fd7cf; }
.dz-intro { max-width:66ch; margin:20px 0 0; color:var(--mut); font-size:16px; line-height:1.65; }
.dz-intro b { color:var(--ink); font-weight:600; }

/* tabs */
.dz-tabwrap { position:sticky; top:0; z-index:20; background:rgba(21,23,26,.86); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
.dz-tabs { max-width:1180px; margin:0 auto; padding:14px 32px; display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.dz-tab { text-align:left; background:var(--shell-2); border:1px solid var(--line); border-radius:12px; padding:14px 16px;
  color:var(--mut); cursor:pointer; transition:border-color .18s, color .18s, transform .18s; display:flex; flex-direction:column; gap:3px; }
.dz-tab:hover { transform:translateY(-2px); border-color:#3a4048; }
.dz-tab:focus-visible { outline:2px solid #6fd7cf; outline-offset:2px; }
.dz-tab--on { border-color:#6fd7cf; color:var(--ink); background:#1a2422; }
.dz-tab-idx { font-family:'Space Mono', monospace; font-size:11px; letter-spacing:.2em; opacity:.7; }
.dz-tab-name { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:18px; color:var(--ink); }
.dz-tab-mood { font-size:12px; }

/* stage + frame */
.dz-stage { max-width:1180px; margin:0 auto; padding:40px 32px 56px; }
.dz-dir { display:flex; flex-direction:column; gap:34px; }
.dz-frame { background:var(--mat); border:1px solid var(--line); border-radius:16px; overflow:hidden; box-shadow:0 30px 70px -40px rgba(0,0,0,.8); }
.dz-frame-bar { display:flex; align-items:center; gap:7px; padding:11px 16px; background:#0a0c0e; border-bottom:1px solid var(--line); }
.dz-dot { width:11px; height:11px; border-radius:50%; background:#34383e; }
.dz-url { margin-left:14px; font-family:'Space Mono', monospace; font-size:12px; color:#5b626b; }

/* token block */
.dz-tokens { display:grid; grid-template-columns:1.1fr 1fr 1.4fr; gap:30px; padding:4px 4px 0; }
.dz-token-h { font-family:'Space Mono', monospace; font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--mut); margin:0 0 12px; }
.dz-token-h--mt { margin-top:18px; }
.dz-token-p { font-size:13.5px; line-height:1.55; color:#c6ccd4; margin:0; }
.dz-swatches { display:flex; flex-direction:column; gap:9px; }
.dz-swatch { display:flex; align-items:center; gap:10px; }
.dz-swatch-chip { width:24px; height:24px; border-radius:6px; border:1px solid rgba(255,255,255,.12); flex:none; }
.dz-swatch-name { font-size:13px; color:var(--ink); flex:1; }
.dz-swatch-hex { font-family:'Space Mono', monospace; font-size:11px; color:var(--mut); }
.dz-typelist { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:11px; }
.dz-typelist li { display:flex; flex-direction:column; gap:1px; }
.dz-type-role { font-family:'Space Mono', monospace; font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:var(--mut); }
.dz-type-fam { font-size:14px; color:var(--ink); }

/* foot */
.dz-foot { border-top:1px solid var(--line); text-align:center; padding:26px; color:var(--mut); font-size:13px; }
.dz-foot code { font-family:'Space Mono', monospace; color:#6fd7cf; }

/* ===================== shared incision keyframes ===================== */
@keyframes dz-cut { from { transform:scaleX(0); } to { transform:scaleX(1); } }
@keyframes dz-tick { from { opacity:0; transform:translateX(-6px) rotate(45deg) scale(0); } to { opacity:1; transform:translateX(-6px) rotate(45deg) scale(1); } }
@keyframes dz-glow { 0%,100% { box-shadow:0 0 10px rgba(111,215,207,.5); } 50% { box-shadow:0 0 22px rgba(111,215,207,.9); } }

/* =============================== 01 — LUZ =============================== */
.dz-v1 { background:#F4F7F6; color:#0A3B3B; font-family:Inter, sans-serif; }
.dz-v1-head { display:flex; align-items:center; gap:24px; padding:18px 40px; border-bottom:1px solid #e1eae8; }
.dz-v1-brand { display:flex; flex-direction:column; }
.dz-v1-mark { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:22px; letter-spacing:-.01em; color:#0F6E6E; }
.dz-v1-sub { font-family:'Space Mono', monospace; font-size:8.5px; letter-spacing:.14em; color:#7d8f8c; }
.dz-v1-nav { display:flex; gap:24px; margin-left:auto; font-size:13px; color:#3c5856; }
.dz-v1-cta { background:#0F6E6E; color:#fff; border:none; border-radius:8px; padding:9px 18px; font-size:13px; font-weight:600; cursor:pointer; }
.dz-v1-cta--lg { padding:14px 28px; font-size:15px; }
.dz-v1-hero { padding:96px 40px 64px; text-align:center; display:flex; flex-direction:column; align-items:center; }
.dz-v1-eyebrow { font-family:'Space Mono', monospace; font-size:12px; letter-spacing:.18em; color:#0F6E6E; margin:0 0 28px; }
.dz-v1-title { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:clamp(36px,6vw,72px); line-height:1.02; letter-spacing:-.03em; margin:0; color:#0A3B3B; }
.dz-v1-incision { position:relative; height:14px; margin:34px 0; display:flex; align-items:center; justify-content:center; width:100%; }
.dz-v1-incision-line { display:block; height:2px; width:200px; background:#0F6E6E; transform-origin:center; }
.dz-v1-incision-tick { position:absolute; left:calc(50% + 100px); width:11px; height:11px; background:#E2483D; transform:translateX(-6px) rotate(45deg); }
.dz-v1-lede { font-size:19px; line-height:1.55; color:#3c5856; margin:0 0 32px; max-width:46ch; }
.dz-v1-actions { display:flex; gap:14px; align-items:center; flex-wrap:wrap; justify-content:center; }
.dz-v1-ghost { background:none; border:1px solid #b8c8c5; color:#0A3B3B; border-radius:8px; padding:13px 22px; font-size:14px; font-weight:500; cursor:pointer; }
.dz-v1-stats { display:flex; gap:18px; align-items:center; margin-top:46px; font-family:'Space Mono', monospace; font-size:13px; letter-spacing:.04em; color:#5d716e; }
.dz-v1-stats b { color:#0F6E6E; }
.dz-v1-stats-sep { width:1px; height:14px; background:#c4d2cf; }
.dz-v1-passes { display:grid; grid-template-columns:repeat(2,1fr); gap:1px; background:#e1eae8; border-top:1px solid #e1eae8; }
.dz-v1-pass { background:#F4F7F6; padding:30px 40px; display:flex; flex-direction:column; gap:8px; }
.dz-v1-pass-t { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:20px; margin:0; color:#0A3B3B; }
.dz-v1-pass-d { font-size:14px; color:#5d716e; margin:0; flex:1; }
.dz-v1-pass-p { font-family:'Space Mono', monospace; font-size:24px; font-weight:700; color:#0F6E6E; margin-top:6px; }
@media (prefers-reduced-motion: no-preference) {
  .dz-v1-incision-line { animation:dz-cut 1s cubic-bezier(.7,0,.2,1) both; }
  .dz-v1-incision-tick { animation:dz-tick .3s ease-out .9s both; }
}

/* ============================ 02 — PABELLÓN ============================ */
.dz-v2 { position:relative; background:#07211F; color:#EAF6F2; font-family:Inter, sans-serif; overflow:hidden; }
.dz-v2::before { content:''; position:absolute; top:-220px; left:50%; transform:translateX(-50%); width:820px; height:560px;
  background:radial-gradient(ellipse at center, rgba(221,243,236,.20), rgba(15,110,110,.12) 42%, transparent 72%); pointer-events:none; }
.dz-v2-head { position:relative; display:flex; align-items:center; gap:24px; padding:18px 40px; border-bottom:1px solid rgba(111,215,207,.16); }
.dz-v2-mark { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:22px; letter-spacing:-.01em; color:#EAF6F2; }
.dz-v2-nav { display:flex; gap:24px; margin-left:auto; font-size:13px; color:#8fb3ad; }
.dz-v2-cta { background:#0F6E6E; color:#EAF6F2; border:none; border-radius:8px; padding:9px 18px; font-size:13px; font-weight:600; cursor:pointer; }
.dz-v2-cta--lg { padding:14px 28px; font-size:15px; background:#13877f; }
.dz-v2-hero { position:relative; padding:90px 40px 70px; text-align:center; display:flex; flex-direction:column; align-items:center; }
.dz-v2-eyebrow { font-family:'Space Mono', monospace; font-size:12px; letter-spacing:.18em; color:#6FD7CF; margin:0 0 26px; }
.dz-v2-title { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:clamp(36px,6vw,70px); line-height:1.02; letter-spacing:-.03em; margin:0;
  color:#F3FBF8; text-shadow:0 2px 40px rgba(111,215,207,.25); }
.dz-v2-incision { height:14px; margin:32px 0; display:flex; justify-content:center; width:100%; }
.dz-v2-incision-line { display:block; height:2px; width:220px; background:#6FD7CF; border-radius:2px; box-shadow:0 0 14px rgba(111,215,207,.8); }
.dz-v2-lede { font-size:18px; line-height:1.55; color:#a9ccc6; margin:0 0 32px; max-width:46ch; }
.dz-v2-actions { display:flex; gap:14px; flex-wrap:wrap; justify-content:center; }
.dz-v2-ghost { background:none; border:1px solid rgba(111,215,207,.4); color:#6FD7CF; border-radius:8px; padding:13px 22px; font-size:14px; font-weight:500; cursor:pointer; }
.dz-v2-cards { position:relative; display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:rgba(111,215,207,.14); border-top:1px solid rgba(111,215,207,.14); }
.dz-v2-card { background:#07211F; padding:22px 20px; }
.dz-v2-card-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.dz-v2-card-n { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:16px; color:#6FD7CF; }
.dz-v2-card-sem { font-family:'Space Mono', monospace; font-size:10px; letter-spacing:.1em; color:#7fa39d; }
.dz-v2-card-t { font-size:14px; font-weight:500; line-height:1.3; color:#EAF6F2; margin:0 0 12px; min-height:54px; }
.dz-v2-card-d { font-family:'Space Mono', monospace; font-size:12px; color:#7fa39d; }
@media (prefers-reduced-motion: no-preference) { .dz-v2-incision-line { animation:dz-cut 1s cubic-bezier(.7,0,.2,1) both, dz-glow 3s ease-in-out 1s infinite; } }

/* ============================= 03 — BISTURÍ ============================= */
.dz-v3 { background:#F4F7F6; color:#0A3B3B; font-family:Inter, sans-serif;
  background-image:linear-gradient(rgba(15,110,110,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(15,110,110,.06) 1px,transparent 1px);
  background-size:30px 30px; }
.dz-v3-head { display:flex; align-items:center; gap:24px; padding:18px 36px; border-bottom:1px solid #d4dedc; background:rgba(244,247,246,.7); }
.dz-v3-brand { display:flex; flex-direction:column; }
.dz-v3-mark { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:22px; letter-spacing:-.01em; color:#0F6E6E; }
.dz-v3-coord { font-family:'Space Mono', monospace; font-size:9px; letter-spacing:.12em; color:#8a9b98; }
.dz-v3-nav { display:flex; gap:22px; margin-left:auto; font-family:'Space Mono', monospace; font-size:12px; color:#3c5856; }
.dz-v3-cta { background:#0F6E6E; color:#fff; border:none; border-radius:6px; padding:9px 18px; font-size:13px; font-weight:600; cursor:pointer; }
.dz-v3-cta--lg { padding:13px 24px; font-size:14px; }
.dz-v3-hero { display:grid; grid-template-columns:1.1fr .9fr; gap:30px; align-items:center; padding:54px 36px; border-bottom:1px solid #d4dedc; }
.dz-v3-eyebrow { font-family:'Space Mono', monospace; font-size:12px; letter-spacing:.16em; color:#E2483D; margin:0 0 18px; }
.dz-v3-title { font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:clamp(30px,4.4vw,50px); line-height:1.04; letter-spacing:-.025em; margin:0; color:#0A3B3B; }
.dz-v3-lede { font-size:16px; line-height:1.55; color:#3c5856; margin:18px 0 22px; max-width:44ch; }
.dz-v3-spec { display:flex; flex-direction:column; gap:10px; margin-bottom:26px; font-family:'Space Mono', monospace; font-size:13px; color:#2e4846; }
.dz-v3-spec div { display:flex; align-items:center; gap:10px; }
.dz-v3-tick { width:9px; height:9px; background:#E2483D; transform:rotate(45deg); flex:none; }
.dz-v3-actions { display:flex; gap:12px; flex-wrap:wrap; }
.dz-v3-ghost { background:none; border:1px solid #b8c8c5; color:#0A3B3B; border-radius:6px; padding:12px 20px; font-size:14px; font-weight:500; cursor:pointer; }
.dz-v3-hero-r { display:flex; flex-direction:column; align-items:center; gap:12px; }
.dz-v3-svg { width:100%; max-width:380px; height:auto; }
.dz-v3-fig { font-family:'Space Mono', monospace; font-size:11px; letter-spacing:.14em; color:#8a9b98; }
.dz-v3-tray { display:flex; flex-direction:column; }
.dz-v3-item { display:grid; grid-template-columns:44px 60px 1fr auto 16px; align-items:center; gap:16px; padding:16px 36px; border-bottom:1px solid #e0e8e6; background:rgba(244,247,246,.6); }
.dz-v3-item-n { font-family:'Space Mono', monospace; font-size:13px; color:#9AA8A6; }
.dz-v3-item-sem { font-family:'Space Mono', monospace; font-size:11px; letter-spacing:.1em; color:#0F6E6E; }
.dz-v3-item-t { font-size:15px; font-weight:500; color:#0A3B3B; }
.dz-v3-item-d { font-family:'Space Mono', monospace; font-size:13px; color:#3c5856; }
.dz-v3-tick--end { width:8px; height:8px; }

/* responsive */
@media (max-width: 860px) {
  .dz-tabs { grid-template-columns:1fr; }
  .dz-tokens { grid-template-columns:1fr; gap:24px; }
  .dz-v1-nav, .dz-v2-nav, .dz-v3-nav { display:none; }
  .dz-v1-passes, .dz-v2-cards { grid-template-columns:1fr; }
  .dz-v2-card-t { min-height:0; }
  .dz-v3-hero { grid-template-columns:1fr; }
  .dz-v3-item { grid-template-columns:34px 1fr auto; }
  .dz-v3-item-sem, .dz-v3-tick--end { display:none; }
}
`;
