import { accountOwnerStatus, fetchWithHomeAssistantAuth, formatEuro, homeAssistantPath, selectedSuggestionSummary, trendSummary } from "./panel-utils.mjs";

const OVERVIEW_URL = "/api/finanzplaner/overview";
const ACCOUNTS_URL = "/api/finanzplaner/accounts";
const PERSONS_URL = "/api/finanzplaner/persons";
const REVIEW_URL = "/api/finanzplaner/bookings/unresolved";
const IMPORT_URL = "/api/finanzplaner/import";
const EXCEL_PREVIEW_URL = "/api/finanzplaner/excel/preview";
const EXCEL_CONFIRM_URL = "/api/finanzplaner/excel/confirm";
const PAPER_TEXTURE_PATH = "assets/plates/main-paper-sample.png";
const PAPER_TEXTURE_URL = new URL(PAPER_TEXTURE_PATH, import.meta.url).href;

const iconPaths = {
  home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z",
  overview: "M4 19V9m5 10V5m5 14v-7m5 7V3",
  energy: "m13 2-8 11h6l-1 9 8-12h-6Z",
  planner: "M4 19.5V8.5h16v11M7 8.5V5h10v3.5M8 12h2m2 0h2m2 0h2M8 15h2m2 0h2m2 0h2",
  calendar: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3-2v4m8-4v4M4 9h16",
  tasks: "M5 6h14M5 12h14M5 18h14M2.5 6h.01M2.5 12h.01M2.5 18h.01",
  household: "M4 20v-7l8-6 8 6v7M8 20v-4h8v4M9 10V7h6v3",
  people: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 20a5.5 5.5 0 0 1 11 0M14 15a4.5 4.5 0 0 1 7 5",
  settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-6v2m0 15v2m9-9h-2M5 12H3m15.36-6.36-1.41 1.41M7.05 16.95l-1.41 1.41m12.72 0-1.41-1.41M7.05 7.05 5.64 5.64",
  chevronLeft: "m14.5 5-7 7 7 7",
  chevronRight: "m9.5 5 7 7-7 7",
  arrowRight: "M4 12h15m-6-6 6 6-6 6",
  calendarSmall: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3-2v4m8-4v4M4 9h16",
  warning: "M12 3 2.8 19a1.2 1.2 0 0 0 1 1.8h16.4a1.2 1.2 0 0 0 1-1.8Zm0 5v5m0 3.5v.01",
  cart: "M3 4h2l2 11h10l2-8H6m3 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  bolt: "m13 2-8 11h6l-1 9 8-12h-6Z",
  paw: "M7.5 10a2 2 0 1 0-2-2 2 2 0 0 0 2 2Zm9 0a2 2 0 1 0-2-2 2 2 0 0 0 2 2Zm-5 1c-3.1 0-5.5 2.2-5.5 5 0 1.5 1 2.5 2.5 2.5 1.2 0 2-.8 3-.8s1.8.8 3 .8c1.5 0 2.5-1 2.5-2.5 0-2.8-2.4-5-5.5-5Z",
  car: "m5 16 1-5 2-4h8l2 4 1 5m-14 0h14M7 16v2m10-2v2M7 11h10M4 13h2m12 0h2",
  file: "M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 0v5h4M8 12h6m-6 4h6",
  check: "m5 12 4 4L19 6",
  income: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v10m-4-4 4-4 4 4",
  expense: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 14V7m-4 4 4 4 4-4",
  savings: "M5 9h14v10H5zM8 9V6h8v3m-8 5h8",
  coins: "M5 8c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Zm0 0v4c0 1.7 3.1 3 7 3s7-1.3 7-3V8m-14 4v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4",
};

const styles = `
  :host {
    --fp-navy: #17283e;
    --fp-navy-deep: #0b1e3b;
    --fp-paper: #f7f7f4;
    --fp-paper-strong: #fffef9;
    --fp-ink: #0b1e3f;
    --fp-muted: #5d6b7c;
    --fp-line: #d6dbdc;
    --fp-cyan: #0a9fc5;
    --fp-cyan-soft: #dff4f7;
    --fp-amber: #eb9b2f;
    --fp-amber-soft: #fff0d5;
    --fp-coral: #d85847;
    --fp-coral-soft: #fae4df;
    --fp-green: #078f82;
    --fp-display: "Mukta Malar", "Mukta", "Trebuchet MS", sans-serif;
    --fp-body: "Sintony", "Mukta", "Segoe UI", sans-serif;
    --fp-data: "Roboto Mono", "SFMono-Regular", Consolas, monospace;
    --fp-radius: 0.85rem;
    --fp-shadow: 0 0.6rem 1.7rem rgb(23 40 62 / 0.08);
    display: block;
    min-block-size: 100%;
    color: var(--fp-ink);
    background: var(--fp-paper);
    color-scheme: light;
    font-family: var(--fp-body);
  }

  *, *::before, *::after { box-sizing: border-box; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  a { color: inherit; }
  svg { display: block; }

  .app-shell {
    min-block-size: 100dvh;
    display: grid;
    grid-template-columns: clamp(14.25rem, 15.23vw, 16rem) minmax(0, 1fr);
    background: var(--fp-paper);
  }

  .rail {
    min-block-size: 100dvh;
    display: flex;
    flex-direction: column;
    color: rgb(247 247 244 / 0.86);
    background: var(--fp-navy);
  }

  .rail-brand {
    min-block-size: 4.75rem;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.8rem 1.15rem;
    border-block-end: 1px solid rgb(247 247 244 / 0.16);
    color: var(--fp-paper);
    text-decoration: none;
    font-size: 0.86rem;
    letter-spacing: 0.01em;
  }

  .rail-brand .brand-icon {
    display: grid;
    place-items: center;
    inline-size: 1.85rem;
    block-size: 1.85rem;
    color: var(--fp-navy);
    background: var(--fp-cyan);
    border-radius: 0.4rem;
  }

  .rail-brand .brand-arrow { margin-inline-start: auto; color: rgb(247 247 244 / 0.8); }

  .rail-nav {
    display: grid;
    gap: 0.2rem;
    padding: 1.05rem 0.5rem;
  }

  .nav-item {
    min-block-size: 2.85rem;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid transparent;
    border-radius: 0.45rem;
    color: rgb(247 247 244 / 0.78);
    background: transparent;
    text-align: start;
    transition: color 180ms ease, background-color 180ms ease, transform 180ms ease;
  }

  .nav-item:hover { color: var(--fp-paper); background: rgb(247 247 244 / 0.08); transform: translateX(0.15rem); }
  .nav-item[aria-current="page"] { color: var(--fp-paper); background: rgb(214 239 244 / 0.17); }
  .nav-item svg { flex: 0 0 auto; }

  .rail-footer {
    margin-block-start: auto;
    padding: 1rem 1.15rem 1.25rem;
    border-block-start: 1px solid rgb(247 247 244 / 0.16);
  }

  .household-switcher {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    inline-size: 100%;
    padding: 0;
    border: 0;
    color: var(--fp-paper);
    background: transparent;
    font-weight: 700;
    text-align: start;
  }

  .household-switcher span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rail-footer p { margin: 0.7rem 0 0; color: rgb(247 247 244 / 0.58); font-size: 0.75rem; line-height: 1.45; }

  .main {
    min-inline-size: 0;
    min-block-size: 100dvh;
    padding: 0 clamp(1rem, 2.35vw, 2.4rem) 1.5rem;
    background-color: var(--fp-paper);
    background-image: url("${PAPER_TEXTURE_URL}");
    background-size: 48rem auto;
    background-blend-mode: multiply;
  }

  .toolbar {
    min-block-size: 4.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    border-block-end: 1px solid var(--fp-line);
  }

  .product-lockup { display: flex; align-items: center; gap: 0.65rem; min-inline-size: 0; }
  .product-lockup h1 { margin: 0; font-family: var(--fp-display); font-size: clamp(1.7rem, 2.4vw, 2.2rem); line-height: 1; letter-spacing: -0.025em; }
  .product-lockup p { margin: 0 0 0 0.2rem; color: var(--fp-muted); font-size: 0.88rem; white-space: nowrap; }
  .demo-chip { padding: 0.25rem 0.45rem; color: var(--fp-muted); background: rgb(23 40 62 / 0.08); border-radius: 0.35rem; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; }

  .toolbar-actions { display: flex; align-items: center; gap: 0.5rem; }
  .month-control { display: flex; align-items: center; border: 1px solid var(--fp-line); border-radius: 0.55rem; background: rgb(255 254 249 / 0.72); }
  .month-control button, .icon-button { min-inline-size: 2.65rem; min-block-size: 2.65rem; display: grid; place-items: center; border: 0; color: var(--fp-muted); background: transparent; }
  .month-control button:hover, .icon-button:hover { color: var(--fp-ink); background: var(--fp-cyan-soft); }
  .month-label { min-inline-size: 8.75rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; color: var(--fp-ink); font-size: 0.92rem; font-weight: 700; }
  .review-pill { min-block-size: 2.65rem; display: flex; align-items: center; gap: 0.55rem; padding: 0.25rem 0.45rem 0.25rem 0.75rem; border: 1px solid var(--fp-navy); border-radius: 0.55rem; color: var(--fp-paper); background: var(--fp-navy); font-weight: 700; }
  .review-pill:hover { background: var(--fp-navy-deep); }
  .review-pill .count { min-inline-size: 1.85rem; min-block-size: 1.85rem; display: grid; place-items: center; color: var(--fp-navy); background: var(--fp-amber); border-radius: 50%; font-family: var(--fp-data); font-size: 0.9rem; }

  .hero { padding: 1.45rem 0 1.15rem; }
  .heading-line { display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
  .heading-line h2 { margin: 0; font-family: var(--fp-display); font-size: 2.1875rem; line-height: 1; letter-spacing: -0.03em; text-wrap: balance; }
  .heading-line p { margin: 0; color: var(--fp-muted); font-size: 0.9rem; }

  .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(12rem, 1.12fr); gap: clamp(0.6rem, 1vw, 1rem); margin-block-start: 1.35rem; }
  .metric { min-inline-size: 0; padding-inline: 0.85rem; border-inline-start: 1px solid var(--fp-line); }
  .metric:first-child { border-inline-start: 0; padding-inline-start: 0; }
  .metric-label { margin: 0; color: var(--fp-ink); font-size: 0.85rem; font-weight: 800; }
  .metric-value { margin: 0.35rem 0 0; color: var(--fp-ink); font-family: var(--fp-data); font-size: clamp(1.45rem, 2.45vw, 2.2rem); font-weight: 700; letter-spacing: -0.055em; line-height: 1.05; white-space: nowrap; }
  .metric--forecast .metric-value { color: var(--fp-cyan); }
  .metric--variance .metric-value { color: var(--fp-coral); }
  .metric-caption { margin: 0.35rem 0 0; color: var(--fp-muted); font-size: 0.82rem; }
  .metric--variance .metric-caption { color: var(--fp-coral); }
  .summary-sentence { align-self: center; max-inline-size: 27ch; margin-inline-start: 0.35rem; color: var(--fp-ink); font-size: 0.83rem; line-height: 1.2; text-wrap: pretty; }
  .summary-sentence strong { font-family: var(--fp-data); font-size: 1.05em; }

  .workspace { display: grid; grid-template-columns: minmax(0, 3fr) minmax(16rem, 1fr); gap: 1rem; }
  .surface { border: 1px solid var(--fp-line); border-radius: var(--fp-radius); background: rgb(255 254 249 / 0.72); box-shadow: var(--fp-shadow); }
  .trend-card { min-inline-size: 0; padding: 1.15rem 1.25rem 0.95rem; }
  .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  .section-heading h3 { margin: 0; font-family: var(--fp-display); font-size: 1.4rem; line-height: 1; letter-spacing: -0.025em; }
  .section-heading p { margin: 0; color: var(--fp-muted); font-size: 0.78rem; }
  .chart-wrap { position: relative; margin-block-start: 0.8rem; min-block-size: 15.5rem; }
  .chart-wrap svg { inline-size: 100%; block-size: 15.5rem; overflow: visible; }
  .chart-grid-line { stroke: #d7dddf; stroke-width: 1; }
  .chart-axis-label { fill: #647487; font-family: var(--fp-data); font-size: 10px; }
  .chart-plan { fill: none; stroke: #9daab6; stroke-width: 2; stroke-dasharray: 7 6; }
  .chart-forecast { fill: none; stroke: var(--fp-cyan); stroke-width: 2.5; stroke-dasharray: 7 5; }
  .chart-actual { fill: none; stroke: var(--fp-navy); stroke-width: 2.6; }
  .chart-today { stroke: var(--fp-navy); stroke-width: 1.4; stroke-dasharray: 4 4; }
  .chart-dot { fill: var(--fp-navy); stroke: var(--fp-paper); stroke-width: 2; }
  .chart-dot--planned { fill: var(--fp-paper); stroke: var(--fp-navy); }
  .chart-dot--forecast { fill: var(--fp-cyan); }
  .chart-today-label { fill: var(--fp-navy); font-size: 11px; font-weight: 800; }
  .chart-legend { display: flex; flex-wrap: wrap; gap: 0.8rem 1.1rem; margin-block-start: 0.3rem; color: var(--fp-muted); font-size: 0.75rem; }
  .legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }
  .legend-line { inline-size: 1.25rem; block-size: 0; border-block-start: 2px solid var(--fp-navy); }
  .legend-line--plan { border-color: #9daab6; border-style: dashed; }
  .legend-line--forecast { border-color: var(--fp-cyan); border-style: dashed; }
  .legend-dot { inline-size: 0.55rem; block-size: 0.55rem; border-radius: 50%; background: var(--fp-navy); }
  .legend-dot--plan { border: 1px solid var(--fp-navy); background: var(--fp-paper); }

  .review-card { display: flex; flex-direction: column; min-inline-size: 0; padding: 1.15rem 1rem 1rem; }
  .review-heading { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-family: var(--fp-display); font-size: 1.1rem; line-height: 1.05; letter-spacing: -0.02em; }
  .warning-badge { display: grid; place-items: center; inline-size: 1.85rem; block-size: 1.85rem; flex: 0 0 auto; color: var(--fp-paper); background: var(--fp-amber); border-radius: 50%; }
  .review-count { margin: 0.35rem 0 0; color: var(--fp-coral); font-family: var(--fp-data); font-size: clamp(3rem, 5vw, 4rem); font-weight: 700; line-height: 0.9; letter-spacing: -0.09em; }
  .review-label { margin: 0.3rem 0 0; color: var(--fp-muted); font-size: 0.82rem; }
  .review-action { min-block-size: 2.65rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-block-start: 1rem; padding: 0.55rem 0.8rem; border: 1px solid var(--fp-amber); border-radius: 0.5rem; color: var(--fp-navy-deep); background: var(--fp-amber); font-weight: 800; }
  .review-action:hover { background: #f0aa43; }
  .review-amount { margin-block-start: auto; padding-block-start: 1rem; border-block-start: 1px solid var(--fp-line); }
  .review-amount-label { margin: 0; color: var(--fp-muted); font-size: 0.77rem; }
  .review-amount-value { margin: 0.25rem 0 0; color: var(--fp-coral); font-family: var(--fp-data); font-size: 1.65rem; font-weight: 700; letter-spacing: -0.06em; }
  .review-amount-note { margin: 0.15rem 0 0; color: var(--fp-muted); font-size: 0.72rem; line-height: 1.35; }
  .last-review { display: flex; align-items: flex-start; gap: 0.55rem; margin-block-start: 0.9rem; padding-block-start: 0.8rem; border-block-start: 1px solid var(--fp-line); color: var(--fp-ink); font-size: 0.8rem; line-height: 1.3; }
  .last-review svg { color: var(--fp-muted); flex: 0 0 auto; }

  .bottom-grid { display: grid; grid-template-columns: 1fr 1fr 0.67fr; gap: 1rem; margin-block-start: 1rem; }
  .bottom-card { min-inline-size: 0; padding: 1rem 1.15rem; }
  .bottom-card h3 { margin: 0; font-family: var(--fp-display); font-size: 1.4rem; line-height: 1; letter-spacing: -0.02em; }
  .bottom-card .subline { margin: 0.25rem 0 0; color: var(--fp-muted); font-size: 0.78rem; }
  .metric-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; margin-block-start: 1.25rem; }
  .mini-metric { min-inline-size: 0; text-align: center; }
  .mini-metric-icon { min-block-size: 1.8rem; display: grid; place-items: center; color: var(--fp-navy); }
  .mini-metric-label { margin: 0.15rem 0 0; color: var(--fp-muted); font-size: 0.72rem; }
  .mini-metric-value { margin: 0.25rem 0 0; color: var(--fp-ink); font-family: var(--fp-data); font-size: 0.95rem; font-weight: 700; letter-spacing: -0.06em; white-space: nowrap; }
  .mini-metric-caption { margin: 0.22rem 0 0; color: var(--fp-muted); font-size: 0.67rem; white-space: nowrap; }
  .mini-metric--positive .mini-metric-value { color: var(--fp-green); }
  .mini-metric--negative .mini-metric-value { color: var(--fp-coral); }
  .mini-metric--available .mini-metric-value { color: var(--fp-ink); }
  .bar-list { display: grid; gap: 0.45rem; margin-block-start: 1rem; }
  .bar-row { display: grid; grid-template-columns: 5.1rem minmax(0, 1fr) 4.8rem; align-items: center; gap: 0.55rem; color: var(--fp-muted); font-size: 0.72rem; }
  .bar-track { block-size: 0.48rem; overflow: hidden; background: #e4e6e4; }
  .bar-fill { display: block; block-size: 100%; min-inline-size: 0.35rem; background: var(--fp-navy); }
  .bar-fill--cyan { background: var(--fp-cyan); }
  .bar-fill--amber { background: var(--fp-amber); }
  .bar-fill--coral { background: var(--fp-coral); }
  .bar-value { color: var(--fp-coral); font-family: var(--fp-data); text-align: end; white-space: nowrap; }
  .category-list { display: grid; gap: 0.38rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .category-item { display: grid; grid-template-columns: 1.3rem minmax(0, 1fr) auto; align-items: center; gap: 0.35rem; color: var(--fp-muted); font-size: 0.74rem; }
  .category-item svg { color: var(--fp-navy); }
  .category-item span:last-child { color: var(--fp-ink); font-family: var(--fp-data); white-space: nowrap; }

  .statusbar { display: flex; justify-content: space-between; gap: 1rem; margin-block-start: 1rem; color: var(--fp-muted); font-size: 0.7rem; }
  .statusbar span:last-child { text-align: end; }
  .statusbar strong { color: var(--fp-ink); font-weight: 700; }

  .review-view { max-inline-size: 62rem; padding-block: 1.8rem; }
  .review-view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .review-view h2 { margin: 0; font-family: var(--fp-display); font-size: clamp(2rem, 3vw, 2.65rem); line-height: 1; }
  .review-view-header p { margin: 0.5rem 0 0; color: var(--fp-muted); }
  .back-button { min-block-size: 2.5rem; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.8rem; border: 1px solid var(--fp-line); border-radius: 0.5rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-weight: 700; }
  .import-strip { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-block-start: 1.5rem; padding: 1rem; border: 1px solid var(--fp-line); border-radius: var(--fp-radius); background: rgb(255 254 249 / 0.78); }
  .import-strip h3 { margin: 0; font-size: 0.95rem; }
  .import-strip p { margin: 0.25rem 0 0; color: var(--fp-muted); font-size: 0.78rem; }
  .file-input { max-inline-size: 18rem; color: var(--fp-muted); font-size: 0.8rem; }
  .file-input::file-selector-button { min-block-size: 2.4rem; margin-inline-end: 0.5rem; padding: 0.45rem 0.7rem; border: 1px solid var(--fp-navy); border-radius: 0.45rem; color: var(--fp-paper); background: var(--fp-navy); font-weight: 700; }
  .excel-review { display: grid; gap: 1rem; margin-block-start: 1rem; padding: 1rem; }
  .excel-review-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .excel-review-header h3 { margin: 0; font-family: var(--fp-display); font-size: 1.35rem; line-height: 1; }
  .excel-review-header p { margin: 0.35rem 0 0; color: var(--fp-muted); font-size: 0.8rem; }
  .excel-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; padding: 0.7rem 0.8rem; border: 1px solid var(--fp-cyan); border-radius: 0.55rem; color: var(--fp-ink); background: var(--fp-cyan-soft); font-size: 0.82rem; }
  .excel-summary strong { font-family: var(--fp-data); }
  .excel-warning-summary { display: grid; gap: 0.35rem; padding: 0.7rem 0.8rem; border-inline-start: 0.25rem solid var(--fp-amber); color: var(--fp-ink); background: var(--fp-amber-soft); font-size: 0.78rem; }
  .excel-warning-summary p { margin: 0; }
  .excel-warning-summary ul { display: grid; gap: 0.2rem; margin: 0; padding-inline-start: 1.1rem; color: var(--fp-muted); }
  .excel-suggestion-list { display: grid; gap: 0.65rem; margin: 0; padding: 0; list-style: none; }
  .excel-suggestion-row { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.8rem; padding: 0.85rem; border: 1px solid var(--fp-line); border-radius: 0.65rem; background: rgb(255 254 249 / 0.86); }
  .excel-suggestion-row:has(input[data-excel-select]:not(:checked)) { opacity: 0.65; }
  .excel-select { display: flex; align-items: flex-start; padding-block-start: 0.25rem; }
  .excel-select input { inline-size: 1.15rem; block-size: 1.15rem; accent-color: var(--fp-cyan); }
  .excel-suggestion-content { min-inline-size: 0; display: grid; gap: 0.65rem; }
  .excel-suggestion-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; }
  .excel-suggestion-heading strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .excel-suggestion-amount { color: var(--fp-coral); font-family: var(--fp-data); font-weight: 700; white-space: nowrap; }
  .excel-suggestion-meta { display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem; color: var(--fp-muted); font-size: 0.72rem; }
  .excel-badge { display: inline-flex; align-items: center; padding: 0.12rem 0.35rem; border-radius: 0.3rem; color: var(--fp-navy); background: var(--fp-amber-soft); font-size: 0.68rem; font-weight: 800; }
  .excel-fields { display: grid; grid-template-columns: repeat(5, minmax(7rem, 1fr)); gap: 0.5rem; }
  .excel-field { display: grid; gap: 0.25rem; color: var(--fp-muted); font-size: 0.68rem; font-weight: 800; }
  .excel-field input, .excel-field select { min-block-size: 2.25rem; inline-size: 100%; min-inline-size: 0; padding: 0.35rem 0.45rem; border: 1px solid var(--fp-line); border-radius: 0.4rem; color: var(--fp-ink); background: var(--fp-paper-strong); }
  .excel-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.55rem; padding-block-start: 0.25rem; border-block-start: 1px solid var(--fp-line); }
  .excel-actions button { min-block-size: 2.5rem; padding: 0.5rem 0.8rem; border: 1px solid var(--fp-navy); border-radius: 0.45rem; font-weight: 800; }
  .excel-discard { color: var(--fp-navy); background: var(--fp-paper-strong); }
  .excel-confirm { color: var(--fp-paper); background: var(--fp-navy); }
  .excel-confirm:hover { background: var(--fp-navy-deep); }
  .excel-confirm:disabled { cursor: not-allowed; opacity: 0.5; }
  .booking-list { display: grid; gap: 0.65rem; margin-block-start: 1rem; padding: 0; list-style: none; }
  .booking-row { display: grid; grid-template-columns: 7rem minmax(0, 1fr) auto auto; align-items: center; gap: 1rem; padding: 0.85rem 1rem; border: 1px solid var(--fp-line); border-radius: 0.65rem; background: rgb(255 254 249 / 0.86); }
  .booking-date { color: var(--fp-muted); font-family: var(--fp-data); font-size: 0.75rem; }
  .booking-purpose { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .booking-account { color: var(--fp-muted); font-size: 0.75rem; }
  .booking-amount { color: var(--fp-coral); font-family: var(--fp-data); font-weight: 700; white-space: nowrap; }
  .booking-assignment { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(12rem, 1fr) 9rem auto; align-items: end; gap: 0.7rem; padding-block-start: 0.75rem; border-block-start: 1px solid var(--fp-line); }
  .assignment-field { display: grid; gap: 0.3rem; color: var(--fp-muted); font-size: 0.72rem; font-weight: 700; }
  .assignment-field select { min-block-size: 2.35rem; inline-size: 100%; padding: 0.35rem 0.45rem; border: 1px solid var(--fp-line); border-radius: 0.4rem; color: var(--fp-ink); background: var(--fp-paper-strong); }
  .assignment-field select[multiple] { min-block-size: 4.6rem; }
  .assign-button { min-block-size: 2.35rem; padding: 0.45rem 0.7rem; border: 1px solid var(--fp-navy); border-radius: 0.4rem; color: var(--fp-paper); background: var(--fp-navy); font-size: 0.78rem; font-weight: 800; }
  .assign-button:hover { background: var(--fp-navy-deep); }
  .assign-button:disabled { cursor: wait; opacity: 0.55; }
  .accounts-view { max-inline-size: 68rem; padding-block: 1.8rem; }
  .accounts-view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .accounts-view h2 { margin: 0; font-family: var(--fp-display); font-size: clamp(2rem, 3vw, 2.65rem); line-height: 1; }
  .accounts-view-header p { max-inline-size: 50rem; margin: 0.5rem 0 0; color: var(--fp-muted); }
  .accounts-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; }
  .accounts-actions .review-action { margin-block-start: 0; }
  .account-list { display: grid; gap: 1rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .account-card { display: grid; grid-template-columns: minmax(12rem, 1fr) minmax(14rem, 1fr); gap: 1rem; padding: 1.1rem; }
  .account-card-header { grid-column: 1 / -1; display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-block-end: 0.75rem; border-block-end: 1px solid var(--fp-line); }
  .account-card-header h3 { margin: 0; font-family: var(--fp-display); font-size: 1.35rem; line-height: 1; }
  .account-reference { margin: 0; color: var(--fp-muted); font-family: var(--fp-data); font-size: 0.8rem; }
  .account-field, .account-owners { display: grid; align-content: start; gap: 0.35rem; min-inline-size: 0; margin: 0; padding: 0; border: 0; color: var(--fp-muted); font-size: 0.78rem; font-weight: 700; }
  .account-field input, .account-owners select { inline-size: 100%; min-inline-size: 0; min-block-size: 2.75rem; padding: 0.5rem 0.6rem; border: 1px solid var(--fp-line); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .account-owners select { min-block-size: 7.4rem; }
  .account-owner-status { margin: 0; color: var(--fp-muted); font-size: 0.74rem; font-weight: 400; }
  .account-owner-status--missing { color: var(--fp-coral); font-weight: 700; }
  .account-toggle { min-block-size: 2.75rem; display: flex; align-items: center; gap: 0.6rem; color: var(--fp-ink); font-weight: 700; }
  .account-toggle input { inline-size: 1.2rem; block-size: 1.2rem; accent-color: var(--fp-cyan); }
  .account-card-actions { grid-column: 1 / -1; display: flex; align-items: center; justify-content: flex-end; gap: 0.8rem; padding-block-start: 0.75rem; border-block-start: 1px solid var(--fp-line); }
  .account-save-status { flex: 1; margin: 0; color: var(--fp-muted); font-size: 0.78rem; }
  .account-save { min-block-size: 2.75rem; padding: 0.5rem 0.85rem; border: 1px solid var(--fp-navy); border-radius: 0.45rem; color: var(--fp-paper); background: var(--fp-navy); font-weight: 800; }
  .account-save:hover { background: var(--fp-navy-deep); }
  .account-save:disabled { cursor: wait; opacity: 0.55; }
  .empty-state { margin-block-start: 1rem; padding: 2rem; border: 1px dashed var(--fp-line); color: var(--fp-muted); text-align: center; }

  .visually-hidden { position: absolute !important; inline-size: 1px !important; block-size: 1px !important; overflow: hidden !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
  .skip-link { inset: 0.75rem auto auto 0.75rem; z-index: 10; padding: 0.6rem 0.8rem; color: var(--fp-paper); background: var(--fp-navy); }
  :where(a, button, input, select):focus-visible { outline: 3px solid var(--fp-cyan); outline-offset: 3px; }
  ::selection { color: var(--fp-paper); background: var(--fp-navy); }
  * { scrollbar-color: var(--fp-muted) var(--fp-paper); scrollbar-width: thin; }
  [data-reveal] { animation: reveal 700ms cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--reveal-order, 0) * 70ms); }
  @keyframes reveal { from { opacity: 0; transform: translateY(0.75rem); filter: blur(0.25rem); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
  @media (prefers-reduced-motion: reduce) { [data-reveal] { animation: none; } .nav-item, .month-control button, .icon-button { transition: none; } }

  @media (max-width: 75rem) {
    .product-lockup p { display: none; }
    .metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .summary-sentence { grid-column: 1 / -1; max-inline-size: none; margin: 0.4rem 0 0; }
  }

  @media (max-width: 60rem) {
    .workspace, .bottom-grid { grid-template-columns: 1fr; }
    .review-card { min-block-size: 20rem; }
    .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 1.1rem; }
    .metric:nth-child(3) { border-inline-start: 0; padding-inline-start: 0; }
    .metric:nth-child(4) { border-inline-start: 1px solid var(--fp-line); }
    .summary-sentence { grid-column: 1 / -1; }
  }

  @media (max-width: 45rem) {
    .app-shell { display: block; }
    .rail { min-block-size: auto; position: sticky; inset-block-start: 0; z-index: 5; }
    .rail-brand { min-block-size: 3.5rem; padding-inline: 1rem; }
    .rail-nav { display: flex; gap: 0.25rem; overflow-x: auto; padding: 0.4rem 0.5rem; scrollbar-width: none; }
    .rail-nav::-webkit-scrollbar { display: none; }
    .nav-item { min-block-size: 2.5rem; flex: 0 0 auto; padding-inline: 0.7rem; }
    .nav-item span { display: none; }
    .rail-footer { display: none; }
    .main { padding-inline: 0.85rem; }
    .toolbar { min-block-size: auto; align-items: flex-start; flex-direction: column; padding-block: 0.8rem; }
    .toolbar-actions { inline-size: 100%; justify-content: space-between; }
    .month-label { min-inline-size: 7.5rem; }
    .review-pill { margin-inline-start: auto; }
    .heading-line h2 { font-size: 2rem; }
    .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.8rem; }
    .metric { padding-inline: 0.6rem; }
    .metric-value { font-size: 1.35rem; }
    .metric-caption { font-size: 0.73rem; }
    .trend-card { padding-inline: 0.75rem; }
    .section-heading { display: block; }
    .section-heading p { margin-block-start: 0.35rem; }
    .chart-wrap, .chart-wrap svg { min-block-size: 13rem; block-size: 13rem; }
    .chart-legend { gap: 0.45rem 0.7rem; font-size: 0.68rem; }
    .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 1rem; }
    .statusbar { display: block; }
    .statusbar span { display: block; }
    .statusbar span:last-child { margin-block-start: 0.35rem; text-align: start; }
    .review-view-header, .accounts-view-header, .import-strip, .excel-review-header { display: block; }
    .back-button { margin-block-start: 1rem; }
    .accounts-actions { margin-block-start: 1rem; }
    .account-card { grid-template-columns: 1fr; }
    .account-card-header, .account-card-actions { grid-column: 1; }
    .account-card-header, .account-card-actions { align-items: stretch; flex-direction: column; }
    .file-input { max-inline-size: 100%; margin-block-start: 0.8rem; }
    .excel-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .booking-row { grid-template-columns: 1fr auto; gap: 0.35rem 0.8rem; }
    .booking-date, .booking-account { grid-column: 1; }
    .booking-amount { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
    .booking-assignment { grid-template-columns: 1fr; align-items: stretch; }
  }

  @media (forced-colors: active) {
    .surface, .month-control, .import-strip, .booking-row, .excel-suggestion-row, .account-card { border: 1px solid CanvasText; box-shadow: none; }
    .review-pill, .review-action, .file-input::file-selector-button { border: 1px solid ButtonText; }
    .bar-track { border: 1px solid CanvasText; }
  }
`;

const demoHousehold = {
  income: 5220,
  expenses: -1934.6,
  savings: -300,
  available: 3285.4,
};

const fallbackOverview = {
  demo: true,
  month: new Date().toISOString().slice(0, 7),
  plan: 4200,
  forecast: 3710,
  actual: 3285.4,
  variance: -490,
  unresolved_count: 6,
  unresolved_total: -278.64,
  household: demoHousehold,
  areas: [
    { name: "Haushalt", value: -120.5 },
    { name: "PV-Anlage", value: -45 },
    { name: "Hunde", value: -18.9 },
    { name: "Sonstiges", value: -72.2 },
  ],
  categories: [
    { name: "Lebensmittel", value: -612.4, icon: "cart" },
    { name: "Wohnen", value: -540, icon: "household" },
    { name: "Strom (inkl. PV)", value: -221.3, icon: "bolt" },
    { name: "Hunde", value: -183.9, icon: "paw" },
    { name: "Mobilität", value: -142.6, icon: "car" },
    { name: "Sonstiges", value: -234.4, icon: "tasks" },
  ],
  trend: {
    planned: [0, 380, 1000, 1600, 2200, 2800, 3400, 3900, 4500, 5200, 6000],
    forecast: [0, 420, 1100, 1800, 2500, 3000, 3500, 3900, 4300, 4600, 4900],
    actual: [0, 290, 690, 1020, 1430, 1710, 1980, 2300, 2400],
    max_value: 8000,
    today_label: "17. Sep.",
    today_index: 8,
  },
  last_unresolved: { date: "2026-09-16", purpose: "Haushaltsbedarf", amount: -43.2 },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, size = 20) {
  const path = iconPaths[name] || iconPaths.overview;
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

function monthLabel(month) {
  const label = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(month);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthFromValue(value) {
  const [year, month] = String(value).split("-").map(Number);
  return Number.isFinite(year) && Number.isFinite(month) ? new Date(year, month - 1, 1) : new Date();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function percentBelowPlan(variance, plan) {
  if (!plan) return "0,0 %";
  return `${Math.abs((variance / plan) * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function chartMarkup(trend = fallbackOverview.trend) {
  const width = 720;
  const height = 260;
  const left = 42;
  const right = 12;
  const top = 18;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const series = [trend.planned || [], trend.forecast || [], trend.actual || []];
  const max = Math.max(1, Number(trend.max_value || 0), ...series.flat().map((value) => Number(value) || 0));
  const count = Math.max(2, ...series.map((values) => values.length));
  const point = (value, index) => `${left + (index / (count - 1)) * plotWidth},${top + plotHeight - ((Number(value) || 0) / max) * plotHeight}`;
  const points = (values) => values.map(point).join(" ");
  const todayIndex = Math.min(count - 1, Math.max(0, Number(trend.today_index || 0)));
  const todayX = left + (todayIndex / (count - 1)) * plotWidth;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = top + plotHeight - ratio * plotHeight;
    const label = Math.round(max * ratio).toLocaleString("de-DE");
    return `<line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"></line><text class="chart-axis-label" x="0" y="${y + 4}">${label}</text>`;
  }).join("");
  const dots = (values, className) => values.map((value, index) => `<circle class="chart-dot ${className}" cx="${point(value, index).split(",")[0]}" cy="${point(value, index).split(",")[1]}" r="${className.includes("planned") ? 3.2 : 4}"></circle>`).join("");
  return `<svg role="img" aria-labelledby="trend-title trend-description" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <title id="trend-title">Kumulativer Monatsverlauf</title>
    <desc id="trend-description">${escapeHtml(trendSummary(trend))}</desc>
    ${grid}
    <line class="chart-today" x1="${todayX}" x2="${todayX}" y1="${top - 2}" y2="${height - bottom + 2}"></line>
    <text class="chart-today-label" x="${Math.min(todayX + 7, width - 92)}" y="${top - 3}">Heute<tspan x="${Math.min(todayX + 7, width - 92)}" dy="13">${escapeHtml(trend.today_label || "17. Sep.")}</tspan></text>
    <polyline class="chart-plan" points="${points(trend.planned || [])}"></polyline>
    <polyline class="chart-forecast" points="${points(trend.forecast || [])}"></polyline>
    <polyline class="chart-actual" points="${points(trend.actual || [])}"></polyline>
    ${dots(trend.planned || [], "chart-dot--planned")}
    ${dots(trend.forecast || [], "chart-dot--forecast")}
    ${dots(trend.actual || [], "")}
  </svg>`;
}

function trendTable(trend = fallbackOverview.trend) {
  const rows = [
    ["Planung", trend.planned || []],
    ["Prognose", trend.forecast || []],
    ["Ist", trend.actual || []],
  ];
  return `<table class="visually-hidden"><caption>Monatsverlauf in Euro</caption><thead><tr><th scope="col">Reihe</th><th scope="col">Werte</th></tr></thead><tbody>${rows.map(([name, values]) => `<tr><th scope="row">${name}</th><td>${values.map(formatEuro).join(", ")}</td></tr>`).join("")}</tbody></table>`;
}

function dataWithDefaults(data) {
  const liveData = data?.demo === false;
  return {
    ...fallbackOverview,
    ...data,
    household: liveData
      ? { income: 0, expenses: 0, savings: 0, available: 0, ...(data?.household || {}) }
      : { ...demoHousehold, ...(data?.household || {}) },
    trend: { ...fallbackOverview.trend, ...(data?.trend || {}) },
    areas: data?.areas?.length ? data.areas : liveData ? [] : fallbackOverview.areas,
    categories: data?.categories?.length ? data.categories : liveData ? [] : fallbackOverview.categories,
  };
}

class FinanzplanerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._month = new Date();
    this._data = fallbackOverview;
    this._view = "overview";
    this._accounts = [];
    this._accountsLoading = false;
    this._accountsLoadFailed = false;
    this._bookings = [];
    this._persons = [];
    this._excelPreview = null;
    this._message = "";
    this._loading = false;
  }

  connectedCallback() {
    this._render();
    this._loadOverview();
  }

  set hass(value) {
    this._hass = value;
  }

  async _loadOverview() {
    this._loading = true;
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${OVERVIEW_URL}?month=${this._month.toISOString().slice(0, 7)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this._data = dataWithDefaults(await response.json());
      this._message = "";
    } catch (error) {
      this._data = dataWithDefaults(fallbackOverview);
      this._message = "Demo-Ansicht aktiv: Die Finanzplaner-API ist noch nicht erreichbar.";
    } finally {
      this._loading = false;
      if (this.isConnected) this._render();
    }
  }

  async _openReview() {
    this._view = "review";
    this._message = "";
    this._render();
    this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true });
    try {
      await this._loadReviewData();
    } catch (error) {
      this._bookings = [];
      this._persons = [];
      this._message = "Die Prüfliste konnte nicht geladen werden.";
    }
    this._render();
  }

  async _loadReviewData() {
    const [bookingResponse, personsResponse] = await Promise.all([
      fetchWithHomeAssistantAuth(this._hass, REVIEW_URL),
      fetchWithHomeAssistantAuth(this._hass, PERSONS_URL),
    ]);
    if (!bookingResponse.ok) throw new Error(`HTTP ${bookingResponse.status}`);
    this._bookings = (await bookingResponse.json()).bookings || [];
    this._persons = personsResponse.ok ? ((await personsResponse.json()).persons || []) : [];
  }

  async _openAccounts() {
    this._view = "accounts";
    this._message = "";
    this._accountsLoading = true;
    this._accountsLoadFailed = false;
    this._render();
    this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true });
    try {
      const [accountsResponse, personsResponse] = await Promise.all([
        fetchWithHomeAssistantAuth(this._hass, ACCOUNTS_URL),
        fetchWithHomeAssistantAuth(this._hass, PERSONS_URL),
      ]);
      if (!accountsResponse.ok || !personsResponse.ok) {
        throw new Error("Konten oder Personen konnten nicht geladen werden.");
      }
      this._accounts = (await accountsResponse.json()).accounts || [];
      this._persons = (await personsResponse.json()).persons || [];
    } catch (error) {
      this._accounts = [];
      this._persons = [];
      this._accountsLoadFailed = true;
      this._message = error.message || "Konten und Personen konnten nicht geladen werden.";
    } finally {
      this._accountsLoading = false;
    }
    this._render();
  }

  async _handleAccountSave(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("[type='submit']");
    const status = form.querySelector("[data-account-save-status]");
    const ownerTargets = [...form.querySelectorAll("[data-account-owners] option:checked")].map((option) => option.value);
    const payload = {
      label: form.querySelector("[data-account-label]")?.value || "",
      owner_targets: ownerTargets,
      active: Boolean(form.querySelector("[data-account-active]")?.checked),
    };
    this._message = "";
    const globalStatus = this.shadowRoot.querySelector(".status-message");
    if (globalStatus) globalStatus.textContent = "";
    if (button) button.disabled = true;
    if (status) status.textContent = "Änderungen werden gespeichert …";
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${ACCOUNTS_URL}/${encodeURIComponent(form.dataset.accountId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Das Konto konnte nicht gespeichert werden.");
      if (status) status.textContent = "Konto gespeichert. Kontenliste wird aktualisiert …";
      const accountsResponse = await fetchWithHomeAssistantAuth(this._hass, ACCOUNTS_URL);
      if (!accountsResponse.ok) throw new Error("Das Konto wurde gespeichert, konnte aber nicht neu geladen werden.");
      this._accounts = (await accountsResponse.json()).accounts || [];
      this._message = `${payload.label.trim() || "Konto"} wurde gespeichert.`;
      this._render();
    } catch (error) {
      if (status) status.textContent = error.message || "Das Konto konnte nicht gespeichert werden.";
      if (button) button.disabled = false;
    }
  }

  _updateAccountOwnerStatus(event) {
    const select = event.currentTarget;
    const status = select.closest("form")?.querySelector("[data-account-owner-status]");
    if (!status) return;
    const ownerTargets = [...select.selectedOptions].map((option) => option.value);
    status.textContent = accountOwnerStatus(ownerTargets);
    status.classList.toggle("account-owner-status--missing", !ownerTargets.length);
  }

  async _handleAssignment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const targets = [...form.querySelectorAll("[data-targets] option:checked")].map((option) => option.value);
    const area = form.querySelector("[data-area]")?.value || null;
    if (!targets.length) {
      this._message = "Bitte mindestens ein Zuordnungsziel auswählen.";
      this._render();
      return;
    }
    const button = form.querySelector("[type='submit']");
    if (button) button.disabled = true;
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${REVIEW_URL.replace("/unresolved", "")}/${encodeURIComponent(form.dataset.bookingId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets, area }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Zuordnung fehlgeschlagen");
      this._message = "Buchung zugeordnet und aus der Prüfliste entfernt.";
      await this._loadReviewData();
      await this._loadOverview();
    } catch (error) {
      this._message = error.message || "Zuordnung fehlgeschlagen.";
      this._render();
    }
  }

  async _handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      await this._handleExcelPreview(file);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    this._message = "Import wird geprüft …";
    this._render();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, IMPORT_URL, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Import fehlgeschlagen");
      this._message = `${result.format}: ${result.accepted} Buchungen übernommen, ${result.duplicates} Duplikate übersprungen.`;
      await this._loadOverview();
      await this._openReview();
    } catch (error) {
      this._message = error.message || "Import fehlgeschlagen.";
      this._render();
    }
  }

  async _handleExcelPreview(file) {
    const form = new FormData();
    form.append("file", file);
    this._message = "Excel-Datei wird geprüft …";
    this._render();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, EXCEL_PREVIEW_URL, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Excel-Import fehlgeschlagen");
      this._excelPreview = {
        ...result,
        suggestions: (result.suggestions || []).map((suggestion) => ({ ...suggestion, selected: true })),
      };
      this._message = "Vorschau bereit. Prüfe die markierten Planposten vor der Übernahme.";
      this._render();
    } catch (error) {
      this._message = error.message || "Excel-Import fehlgeschlagen.";
      this._render();
    }
  }

  _excelFieldValue(suggestion, field) {
    return suggestion[field] ?? "";
  }

  _updateExcelField(event) {
    const input = event.currentTarget;
    const suggestion = this._excelPreview?.suggestions.find((item) => item.id === input.dataset.suggestionId);
    if (!suggestion) return;
    suggestion[input.dataset.field] = input.value || null;
    if (input.dataset.field === "direction") {
      suggestion.direction = input.value;
    }
  }

  _updateExcelSelection(event) {
    const input = event.currentTarget;
    const suggestion = this._excelPreview?.suggestions.find((item) => item.id === input.dataset.suggestionId);
    if (!suggestion) return;
    suggestion.selected = input.checked;
    this._updateExcelSummary();
  }

  _updateExcelSummary() {
    const summary = this.shadowRoot.querySelector("[data-excel-summary]");
    if (!summary || !this._excelPreview) return;
    const selected = selectedSuggestionSummary(this._excelPreview.suggestions);
    summary.innerHTML = `<strong>${selected.count} ausgewählt</strong><span>${formatEuro(selected.amount)} Planvolumen</span><span>${this._excelPreview.suggestions.length - selected.count} abgewählt</span>`;
  }

  async _confirmExcelImport() {
    if (!this._excelPreview) return;
    const selected = this._excelPreview.suggestions.filter((suggestion) => suggestion.selected);
    if (!selected.length) {
      this._message = "Bitte mindestens einen Planposten auswählen.";
      this._render();
      return;
    }
    const button = this.shadowRoot.querySelector("[data-excel-confirm]");
    if (button) button.disabled = true;
    const overrides = Object.fromEntries(selected.map((suggestion) => [suggestion.id, {
      direction: suggestion.direction,
      category: suggestion.category,
      area: suggestion.area,
      project: suggestion.project,
      person_hint: suggestion.person_hint,
    }]));
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, EXCEL_CONFIRM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview_id: this._excelPreview.preview_id,
          selected_ids: selected.map((suggestion) => suggestion.id),
          overrides,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Excel-Import konnte nicht bestätigt werden");
      this._excelPreview = null;
      this._message = `${result.accepted} Planposten übernommen, ${result.skipped} abgewählt.`;
      await this._loadOverview();
      this._render();
    } catch (error) {
      this._message = error.message || "Excel-Import konnte nicht bestätigt werden.";
      this._render();
    }
  }

  _discardExcelPreview() {
    this._excelPreview = null;
    this._message = "Excel-Vorschau verworfen. Es wurden keine Planposten gespeichert.";
    this._render();
  }

  _shiftMonth(delta) {
    this._month = new Date(this._month.getFullYear(), this._month.getMonth() + delta, 1);
    this._loadOverview();
  }

  _render() {
    const template = this._view === "review"
      ? this._reviewTemplate()
      : this._view === "accounts"
        ? this._accountsTemplate()
        : this._overviewTemplate();
    this.shadowRoot.innerHTML = `<style>${styles}</style>${template}`;
    this._bindEvents();
  }

  _bindEvents() {
    this.shadowRoot.querySelector("[data-action='previous-month']")?.addEventListener("click", () => this._shiftMonth(-1));
    this.shadowRoot.querySelector("[data-action='next-month']")?.addEventListener("click", () => this._shiftMonth(1));
    this.shadowRoot.querySelectorAll("[data-action='review']").forEach((button) => button.addEventListener("click", () => this._openReview()));
    this.shadowRoot.querySelector("[data-action='back']")?.addEventListener("click", () => { this._view = "overview"; this._render(); this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true }); });
    this.shadowRoot.querySelector("[data-import]")?.addEventListener("change", (event) => this._handleImport(event));
    this.shadowRoot.querySelector("[data-excel-confirm]")?.addEventListener("click", () => this._confirmExcelImport());
    this.shadowRoot.querySelector("[data-excel-discard]")?.addEventListener("click", () => this._discardExcelPreview());
    this.shadowRoot.querySelectorAll("[data-excel-select]").forEach((input) => input.addEventListener("change", (event) => this._updateExcelSelection(event)));
    this.shadowRoot.querySelectorAll("[data-excel-field]").forEach((input) => input.addEventListener("change", (event) => this._updateExcelField(event)));
    this.shadowRoot.querySelectorAll("[data-assignment-form]").forEach((form) => form.addEventListener("submit", (event) => this._handleAssignment(event)));
    this.shadowRoot.querySelectorAll("[data-account-form]").forEach((form) => form.addEventListener("submit", (event) => this._handleAccountSave(event)));
    this.shadowRoot.querySelectorAll("[data-account-owners]").forEach((select) => select.addEventListener("change", (event) => this._updateAccountOwnerStatus(event)));
    this.shadowRoot.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.nav === "review") this._openReview();
      else if (button.dataset.nav === "accounts") this._openAccounts();
      else if (button.dataset.nav !== "overview") this._message = `${button.textContent.trim()} ist für die nächste Ausbaustufe vorbereitet.`;
      if (!["review", "accounts"].includes(button.dataset.nav)) this._render();
    }));
  }

  _navTemplate() {
    const items = [
      ["overview", "overview", "Übersicht"],
      ["energy", "energy", "Energie"],
      ["planner", "planner", "Finanzplaner"],
      ["calendar", "calendar", "Kalender"],
      ["tasks", "tasks", "Aufgaben"],
      ["household", "household", "Haushalt"],
      ["people", "people", "Personen"],
      ["accounts", "settings", "Konten"],
    ];
    return items.map(([id, iconName, label]) => {
      const target = id === "planner" ? "overview" : id;
      const current = (this._view === "overview" && id === "planner") || this._view === id;
      return `<button class="nav-item" data-nav="${target}"${current ? ' aria-current="page"' : ""} type="button">${icon(iconName, 22)}<span>${label}</span></button>`;
    }).join("");
  }

  _shellTemplate(content) {
    return `<div class="app-shell">
      <aside class="rail" aria-label="Finanzplaner-Navigation">
        <a class="rail-brand" href="${homeAssistantPath(window.location.href)}">${icon("home", 18)}<span>Home Assistant</span><span class="brand-arrow">${icon("chevronRight", 18)}</span></a>
        <nav class="rail-nav" aria-label="Bereiche">${this._navTemplate()}</nav>
        <div class="rail-footer"><button class="household-switcher" type="button">${icon("household", 21)}<span>Gemeinsamer Haushalt</span>${icon("chevronRight", 16)}</button><p>Zu Hause leben. Besser planen.</p></div>
      </aside>
      ${content}
    </div>`;
  }

  _toolbarTemplate() {
    return `<header class="toolbar">
      <div class="product-lockup"><h1>Finanzplaner</h1><span class="demo-chip">DEMO</span><p>Gemeinsam. Überblick. Handeln.</p></div>
      <div class="toolbar-actions">
        <div class="month-control" aria-label="Monat auswählen"><button type="button" data-action="previous-month" aria-label="Vorheriger Monat">${icon("chevronLeft", 20)}</button><span class="month-label">${monthLabel(this._month)} ${icon("calendarSmall", 16)}</span><button type="button" data-action="next-month" aria-label="Nächster Monat">${icon("chevronRight", 20)}</button></div>
        <button class="review-pill" type="button" data-action="review">${icon("warning", 17)}<span>Buchungen prüfen</span><span class="count">${escapeHtml(this._data.unresolved_count)}</span></button>
        <button class="icon-button" type="button" aria-label="Einstellungen">${icon("settings", 21)}</button>
      </div>
    </header>`;
  }

  _overviewTemplate() {
    const data = dataWithDefaults(this._data);
    const variance = Number(data.variance || 0);
    const household = data.household || demoHousehold;
    const last = data.last_unresolved;
    const content = `<main class="main" id="content" tabindex="-1">
      <a class="skip-link visually-hidden" href="#overview">Zum Inhalt springen</a>
      ${this._toolbarTemplate()}
      <div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div>
      <section class="hero" id="overview" aria-labelledby="overview-title">
        <div class="heading-line"><h2 id="overview-title">Planung · Prognose · Ist</h2><p>${monthLabel(this._month)} · Alle Beträge in Euro</p></div>
        <div class="metric-grid">
          <article class="metric" data-reveal style="--reveal-order: 1"><p class="metric-label">Planung</p><p class="metric-value">${formatEuro(data.plan)}</p><p class="metric-caption">geplantes Ergebnis</p></article>
          <article class="metric metric--forecast" data-reveal style="--reveal-order: 2"><p class="metric-label">Prognose</p><p class="metric-value">${formatEuro(data.forecast)}</p><p class="metric-caption">erwartetes Ergebnis</p></article>
          <article class="metric" data-reveal style="--reveal-order: 3"><p class="metric-label">Ist</p><p class="metric-value">${formatEuro(data.actual)}</p><p class="metric-caption">bisheriges Ergebnis</p></article>
          <article class="metric metric--variance" data-reveal style="--reveal-order: 4"><p class="metric-label">Abweichung <span class="visually-hidden">Prognose gegenüber Planung</span></p><p class="metric-value">${formatEuro(variance)}</p><p class="metric-caption">${percentBelowPlan(variance, data.plan)} unter Plan</p></article>
          <p class="summary-sentence" data-reveal style="--reveal-order: 5"><strong>Kurz gesagt:</strong> Wir liegen voraussichtlich <strong>${formatEuro(Math.abs(variance))}</strong> unter Plan. Bitte größere Ausgaben im Blick behalten.</p>
        </div>
      </section>
      <div class="workspace">
        <section class="surface trend-card" data-reveal style="--reveal-order: 6" aria-labelledby="trend-heading"><div class="section-heading"><h3 id="trend-heading">Monatsverlauf</h3><p>Einnahmen und Ausgaben kumuliert · ${monthLabel(this._month)}</p></div><div class="chart-wrap">${chartMarkup(data.trend)}${trendTable(data.trend)}</div><div class="chart-legend" aria-hidden="true"><span class="legend-item"><i class="legend-line legend-line--plan"></i>Planung (kumuliert)</span><span class="legend-item"><i class="legend-line legend-line--forecast"></i>Prognose (kumuliert)</span><span class="legend-item"><i class="legend-line"></i>Ist (kumuliert)</span><span class="legend-item"><i class="legend-dot legend-dot--plan"></i>Geplante Zahlung</span><span class="legend-item"><i class="legend-dot"></i>Gebuchte Zahlung</span></div></section>
        <aside class="surface review-card" data-reveal style="--reveal-order: 7" aria-labelledby="review-heading"><h3 class="review-heading" id="review-heading"><span class="warning-badge">${icon("warning", 18)}</span>Ungeklärte Buchungen</h3><p class="review-count">${escapeHtml(data.unresolved_count)}</p><p class="review-label">Buchungen in Prüfung</p><button class="review-action" type="button" data-action="review">Buchungen prüfen ${icon("arrowRight", 19)}</button><div class="review-amount"><p class="review-amount-label">Offener Betrag</p><p class="review-amount-value">${formatEuro(data.unresolved_total)}</p><p class="review-amount-note">Die zur Klärung nicht einberechneten Beträge.</p></div>${last ? `<div class="last-review">${icon("file", 19)}<span>Letzte ungeklärte Buchung<br><strong>${formatDate(last.date || last.booking_date)} · ${formatEuro(last.amount)}</strong></span></div>` : ""}</aside>
      </div>
      <div class="bottom-grid">
        <section class="surface bottom-card" aria-labelledby="household-heading" data-reveal style="--reveal-order: 8"><h3 id="household-heading">Haushaltsübersicht</h3><p class="subline">${monthLabel(this._month)}</p><div class="metric-strip"><div class="mini-metric mini-metric--positive"><span class="mini-metric-icon">${icon("income", 25)}</span><p class="mini-metric-label">Einnahmen</p><p class="mini-metric-value">${formatEuro(household.income)}</p><p class="mini-metric-caption">92 % vom Plan</p></div><div class="mini-metric mini-metric--negative"><span class="mini-metric-icon">${icon("expense", 25)}</span><p class="mini-metric-label">Ausgaben</p><p class="mini-metric-value">${formatEuro(household.expenses)}</p><p class="mini-metric-caption">88 % vom Plan</p></div><div class="mini-metric mini-metric--negative"><span class="mini-metric-icon">${icon("savings", 25)}</span><p class="mini-metric-label">Rücklagen</p><p class="mini-metric-value">${formatEuro(household.savings)}</p><p class="mini-metric-caption">100 % vom Plan</p></div><div class="mini-metric mini-metric--available"><span class="mini-metric-icon">${icon("coins", 25)}</span><p class="mini-metric-label">Verfügbar</p><p class="mini-metric-value">${formatEuro(household.available)}</p><p class="mini-metric-caption">bisheriger Saldo</p></div></div></section>
        <section class="surface bottom-card" aria-labelledby="areas-heading" data-reveal style="--reveal-order: 9"><h3 id="areas-heading">Bereiche <span class="visually-hidden">Ist gegenüber Plan</span></h3><p class="subline">Ist vs. Plan</p><div class="bar-list">${data.areas.map((area, index) => `<div class="bar-row"><span>${escapeHtml(area.name)}</span><span class="bar-track"><span class="bar-fill ${index === 1 ? "bar-fill--cyan" : index === 2 ? "bar-fill--amber" : index === 3 ? "bar-fill--coral" : ""}" style="inline-size:${Math.max(10, Math.min(100, Math.abs(Number(area.value || 0)) / 1.5))}%"></span></span><span class="bar-value">${formatEuro(area.value)}</span></div>`).join("")}</div></section>
        <section class="surface bottom-card" aria-labelledby="categories-heading" data-reveal style="--reveal-order: 10"><h3 id="categories-heading">Top Kategorien <span class="visually-hidden">Ausgaben</span></h3><p class="subline">Ausgaben</p><ul class="category-list">${data.categories.map((category) => `<li class="category-item">${icon(category.icon || "overview", 17)}<span>${escapeHtml(category.name)}</span><span>${formatEuro(category.value)}</span></li>`).join("")}</ul></section>
      </div>
      <footer class="statusbar"><span>Datenstand: <strong>${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date())}</strong> · ${data.demo ? "Demo-Daten" : "lokale Daten"}</span><span>Fin Zuhause · Viele Bereiche · Fin Plan</span></footer>
    </main>`;
    return this._shellTemplate(content);
  }

  _personOptions(selectedTargets = []) {
    const selected = new Set(selectedTargets);
    return [
      `<option value="household"${selected.has("household") ? " selected" : ""}>Haushalt</option>`,
      ...this._persons.map((person) => `<option value="${escapeHtml(person.entity_id)}"${selected.has(person.entity_id) ? " selected" : ""}>${escapeHtml(person.name || person.entity_id)}</option>`),
    ].join("");
  }

  _accountsTemplate() {
    const accountList = this._accountsLoading
      ? `<div class="empty-state">Konten werden geladen …</div>`
      : this._accountsLoadFailed
        ? `<div class="empty-state">Konten stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : this._accounts.length
      ? `<ul class="account-list" aria-label="Konten">${this._accounts.map((account, index) => {
        const ownerTargets = Array.isArray(account.owner_targets) ? account.owner_targets : [];
        const ownerStatus = accountOwnerStatus(ownerTargets);
        const labelId = `account-label-${index}`;
        const ownersId = `account-owners-${index}`;
        const ownerStatusId = `account-owner-status-${index}`;
        const activeId = `account-active-${index}`;
        const saveStatusId = `account-save-status-${index}`;
        const maskedReference = account.iban_masked || account.account_reference || "Keine maskierte Kontoreferenz verfügbar";
        return `<li><form class="surface account-card" method="post" data-account-form data-account-id="${escapeHtml(account.id)}" aria-labelledby="account-heading-${index}">
          <div class="account-card-header"><h3 id="account-heading-${index}">${escapeHtml(account.label || "Konto")}</h3><p class="account-reference">${escapeHtml(maskedReference)}</p></div>
          <label class="account-field" for="${labelId}">Kontoname<input id="${labelId}" name="label" data-account-label type="text" value="${escapeHtml(account.label || "")}" autocomplete="off" required></label>
          <fieldset class="account-owners"><legend>Kontoinhaber</legend><label class="visually-hidden" for="${ownersId}">Kontoinhaber für ${escapeHtml(account.label || "Konto")} auswählen</label><select id="${ownersId}" name="owner_targets" data-account-owners multiple size="4" aria-describedby="${ownerStatusId}">${this._personOptions(ownerTargets)}</select><p class="account-owner-status${ownerTargets.length ? "" : " account-owner-status--missing"}" id="${ownerStatusId}" data-account-owner-status>${escapeHtml(ownerStatus)}</p></fieldset>
          <label class="account-toggle" for="${activeId}"><input id="${activeId}" name="active" data-account-active type="checkbox"${account.active === false ? "" : " checked"}>Konto aktiv <span class="visually-hidden">(deaktivieren archiviert das Konto)</span></label>
          <div class="account-card-actions"><p class="account-save-status" id="${saveStatusId}" data-account-save-status aria-live="polite"></p><button class="account-save" type="submit" aria-describedby="${saveStatusId}">Änderungen speichern</button></div>
        </form></li>`;
      }).join("")}</ul>`
        : `<div class="empty-state">Keine Konten verfügbar. Importiere zuerst eine Bankdatei über „Buchungen prüfen“.</div>`;
    const content = `<main class="main" id="content" tabindex="-1"><div class="accounts-view"><div class="accounts-view-header"><div><h2>Konten verwalten</h2><p>Vergib verständliche Namen, ordne Kontoinhaber zu und archiviere nicht mehr verwendete Konten. Kontodaten werden ausschließlich maskiert angezeigt.</p></div><div class="accounts-actions"><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button><button class="review-action" type="button" data-action="review">Buchungen prüfen ${icon("arrowRight", 18)}</button></div></div><div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div>${accountList}</div></main>`;
    return this._shellTemplate(content);
  }

  _excelPreviewTemplate() {
    const preview = this._excelPreview;
    if (!preview) return "";
    const selected = selectedSuggestionSummary(preview.suggestions);
    const warningCounts = preview.warnings.reduce((counts, warning) => {
      counts[warning.code] = (counts[warning.code] || 0) + 1;
      return counts;
    }, {});
    const warningLabels = {
      formula_value: "Formelwert",
      derived_column: "abgeleitete Spalte",
      historical_value: "historischer Wert",
      empty_calculation_row: "Berechnungszeile",
      comparison_table_diff: "EMX-Vergleich",
      unmapped_category: "ungeklärte Kategorie",
      missing_sheet: "fehlendes optionales Blatt",
    };
    const directionOptions = (value) => [
      ["income", "Einnahme"],
      ["expense", "Ausgabe"],
      ["saving", "Rücklage"],
    ].map(([optionValue, label]) => `<option value="${optionValue}"${value === optionValue ? " selected" : ""}>${label}</option>`).join("");
    const areaOptions = (value) => [
      ["", "Kein Bereich"],
      ["Haushalt", "Haushalt"],
      ["Hunde", "Hunde"],
      ["Urlaub", "Urlaub"],
      ["PV-Anlage", "PV-Anlage"],
    ].map(([optionValue, label]) => `<option value="${optionValue}"${value === optionValue ? " selected" : ""}>${label}</option>`).join("");
    const warningBadges = (warnings) => (warnings || []).map((warning) => `<span class="excel-badge" title="${escapeHtml(warningLabels[warning] || warning)}">${escapeHtml(warningLabels[warning] || warning)}</span>`).join("");
    return `<section class="surface excel-review" aria-labelledby="excel-review-heading">
      <div class="excel-review-header"><div><h3 id="excel-review-heading">Excel-Vorschau</h3><p>Prüfe die Zuordnungen. Erst die Übernahme schreibt Planposten in deinen Finanzplan.</p></div><span class="excel-badge">${escapeHtml(preview.preview_id.slice(0, 8))}</span></div>
      <div class="excel-summary" data-excel-summary aria-live="polite"><strong>${selected.count} ausgewählt</strong><span>${formatEuro(selected.amount)} Planvolumen</span><span>${preview.suggestions.length - selected.count} abgewählt</span></div>
      <div class="excel-warning-summary"><p><strong>${preview.warnings.length} Prüfhinweise</strong> · ${preview.historical_rows} historische Zeilen · ${preview.skipped_rows} übersprungene Zeilen</p><ul>${Object.entries(warningCounts).map(([code, count]) => `<li>${count}× ${escapeHtml(warningLabels[code] || code)}</li>`).join("") || "<li>Keine zusätzlichen Hinweise</li>"}</ul></div>
      <ul class="excel-suggestion-list" aria-label="Excel-Planposten">${preview.suggestions.map((suggestion) => `<li class="excel-suggestion-row">
        <label class="excel-select"><input type="checkbox" data-excel-select data-suggestion-id="${escapeHtml(suggestion.id)}"${suggestion.selected ? " checked" : ""} aria-label="${escapeHtml(suggestion.name)} übernehmen"></label>
        <div class="excel-suggestion-content"><div class="excel-suggestion-heading"><strong>${escapeHtml(suggestion.name)}</strong><span class="excel-suggestion-amount">${formatEuro(suggestion.amount)}</span></div>
          <div class="excel-suggestion-meta"><span>${escapeHtml(suggestion.direction)} · alle ${escapeHtml(suggestion.frequency_months)} Monate</span><span>${escapeHtml(suggestion.source_sheet)} · Zeile ${escapeHtml(suggestion.source_row)}</span><span>${escapeHtml((suggestion.source_columns || []).join(", "))}</span>${warningBadges(suggestion.warnings)}</div>
          <div class="excel-fields">
            <label class="excel-field">Richtung<select data-excel-field data-field="direction" data-suggestion-id="${escapeHtml(suggestion.id)}">${directionOptions(this._excelFieldValue(suggestion, "direction"))}</select></label>
            <label class="excel-field">Kategorie<input data-excel-field data-field="category" data-suggestion-id="${escapeHtml(suggestion.id)}" value="${escapeHtml(this._excelFieldValue(suggestion, "category"))}"></label>
            <label class="excel-field">Bereich<select data-excel-field data-field="area" data-suggestion-id="${escapeHtml(suggestion.id)}">${areaOptions(this._excelFieldValue(suggestion, "area"))}</select></label>
            <label class="excel-field">Projekt<input data-excel-field data-field="project" data-suggestion-id="${escapeHtml(suggestion.id)}" value="${escapeHtml(this._excelFieldValue(suggestion, "project"))}"></label>
            <label class="excel-field">Personenhinweis<input data-excel-field data-field="person_hint" data-suggestion-id="${escapeHtml(suggestion.id)}" value="${escapeHtml(this._excelFieldValue(suggestion, "person_hint"))}"></label>
          </div>
        </div>
      </li>`).join("")}</ul>
      <div class="excel-actions"><button class="excel-discard" type="button" data-excel-discard>Vorschau verwerfen</button><button class="excel-confirm" type="button" data-excel-confirm${selected.count ? "" : " disabled"}>Planposten übernehmen ${icon("check", 17)}</button></div>
    </section>`;
  }

  _reviewTemplate() {
    const content = `<main class="main" id="content" tabindex="-1"><div class="review-view"><div class="review-view-header"><div><h2>Ungeklärte Buchungen</h2><p>Ordne jede Buchung einer Person, dem Haushalt oder dem Bereich Hunde zu. Mehrere Ziele teilen den Betrag centgenau.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div><form class="import-strip"><div><h3>Bank- oder Exceldatei importieren</h3><p>MT940 oder CAMT.053 für Buchungen · .xlsx für Planposten, jeweils lokal geprüft.</p></div><label class="file-input">Datei auswählen<input data-import type="file" accept=".xlsx,.sta,.mt940,.txt,.xml,.camt,.camt053,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/xml,text/plain"></label></form>${this._excelPreview ? this._excelPreviewTemplate() : ""}${this._bookings.length ? `<ul class="booking-list" aria-label="Ungeklärte Buchungen">${this._bookings.map((booking) => `<li><form class="booking-row" data-assignment-form data-booking-id="${escapeHtml(booking.id)}"><time class="booking-date" datetime="${escapeHtml(booking.booking_date)}">${formatDate(booking.booking_date)}</time><span class="booking-purpose">${escapeHtml(booking.purpose || booking.counterparty || "Ohne Verwendungszweck")}</span><span class="booking-account">${escapeHtml(booking.account || "Konto nicht bekannt")}</span><span class="booking-amount">${formatEuro(booking.amount)}</span><div class="booking-assignment"><label class="assignment-field">Zuordnung <select data-targets multiple size="2" aria-label="Ziele für Buchung auswählen">${this._personOptions()}</select></label><label class="assignment-field">Bereich <select data-area aria-label="Bereich für Buchung auswählen"><option value="">Kein Bereich</option><option value="Hunde">Hunde</option></select></label><button class="assign-button" type="submit">Zuordnen ${icon("check", 17)}</button></div></form></li>`).join("")}</ul>` : `<div class="empty-state">Noch keine importierten Buchungen in der Prüfliste. Lade eine Bankdatei hoch oder importiere eine Excel-Vorlage.</div>`}</div></main>`;
    return this._shellTemplate(content);
  }
}

customElements.define("finanzplaner-panel", FinanzplanerPanel);
