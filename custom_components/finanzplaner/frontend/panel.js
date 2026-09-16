import { accountActiveStatus, accountOwnerStatus, addAllocationDraftRow, allocationErrorMessage, allocationRemaining, allocationSubmitState, equalAllocationDraft, fetchWithHomeAssistantAuth, formatEuro, homeAssistantPath, planItemFrequencyLabel, planItemStatus, readApiResponse, removeAllocationDraftRow, selectedSuggestionSummary, trendSummary, updateAllocationDraftRow } from "./panel-utils.mjs";

const OVERVIEW_URL = "/api/finanzplaner/overview";
const PLAN_ITEMS_URL = "/api/finanzplaner/plan-items";
const ACCOUNTS_URL = "/api/finanzplaner/accounts";
const PETS_URL = "/api/finanzplaner/pets";
const FEED_PROFILES_URL = "/api/finanzplaner/feed-profiles";
const CATALOGS_URL = "/api/finanzplaner/catalogs";
const PERSONS_URL = "/api/finanzplaner/persons";
const REVIEW_URL = "/api/finanzplaner/bookings/unresolved";
const BOOKINGS_URL = "/api/finanzplaner/bookings";
const IMPORT_URL = "/api/finanzplaner/import";
const EXCEL_PREVIEW_URL = "/api/finanzplaner/excel/preview";
const EXCEL_CONFIRM_URL = "/api/finanzplaner/excel/confirm";
const PAPER_TEXTURE_PATH = "assets/plates/main-paper-sample.png";
const PAPER_TEXTURE_URL = new URL(PAPER_TEXTURE_PATH, import.meta.url).href;

function apiErrorMessage(body, fallback) {
  if (typeof body === "string") return body || fallback;
  return typeof body?.message === "string" && body.message ? body.message : fallback;
}

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
  tags: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11l9 9-7 7-9-9V5.5ZM7.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
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
    --fp-control-border: var(--fp-muted);
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
  .allocation-editor { grid-column: 1 / -1; min-inline-size: 0; margin: 0; padding: 0.85rem 0 0; border: 0; border-block-start: 1px solid var(--fp-line); }
  .allocation-editor legend { padding: 0; color: var(--fp-ink); font-size: 0.82rem; font-weight: 800; }
  .allocation-list { display: grid; gap: 0.65rem; margin: 0.7rem 0 0; padding: 0; list-style: none; }
  .allocation-row { min-inline-size: 0; display: grid; grid-template-columns: minmax(9rem, 1.2fr) minmax(7rem, 0.65fr) minmax(9rem, 1fr) minmax(7rem, 0.8fr) minmax(7rem, 1fr) minmax(7rem, 1fr) auto; align-items: end; gap: 0.55rem; }
  .allocation-field { min-inline-size: 0; display: grid; gap: 0.3rem; color: var(--fp-muted); font-size: 0.72rem; font-weight: 700; }
  .allocation-field input, .allocation-field select { min-inline-size: 0; inline-size: 100%; min-block-size: 2.5rem; padding: 0.4rem 0.5rem; border: 1px solid var(--fp-control-border); border-radius: 0.4rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .allocation-pet { min-inline-size: 0; }
  .allocation-remove { min-block-size: 2.5rem; padding: 0.4rem 0.65rem; border: 1px solid var(--fp-control-border); border-radius: 0.4rem; color: var(--fp-coral); background: var(--fp-paper-strong); font-size: 0.78rem; font-weight: 800; }
  .allocation-remove:hover { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .allocation-summary { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin: 0.8rem 0 0; padding: 0.65rem 0.75rem; border-radius: 0.45rem; color: var(--fp-muted); background: rgb(23 40 62 / 0.06); font-size: 0.78rem; }
  .allocation-summary strong { color: var(--fp-ink); font-family: var(--fp-data); }
  .allocation-summary [data-allocation-remaining].allocation-summary--open { color: var(--fp-coral); }
  .allocation-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.6rem; margin-block-start: 0.7rem; }
  .allocation-status { flex: 1 1 18rem; margin: 0; color: var(--fp-coral); font-size: 0.78rem; overflow-wrap: anywhere; }
  .allocation-add { min-block-size: 2.35rem; padding: 0.45rem 0.7rem; border: 1px solid var(--fp-navy); border-radius: 0.4rem; color: var(--fp-navy); background: var(--fp-paper-strong); font-size: 0.78rem; font-weight: 800; }
  .assign-button { min-block-size: 2.35rem; padding: 0.45rem 0.7rem; border: 1px solid var(--fp-navy); border-radius: 0.4rem; color: var(--fp-paper); background: var(--fp-navy); font-size: 0.78rem; font-weight: 800; }
  .assign-button:hover { background: var(--fp-navy-deep); }
  .assign-button:disabled { cursor: not-allowed; opacity: 0.55; }
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
  .account-field input, .account-owners select { inline-size: 100%; min-inline-size: 0; min-block-size: 2.75rem; padding: 0.5rem 0.6rem; border: 1px solid var(--fp-control-border); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .account-field small { color: var(--fp-muted); font-size: 0.72rem; font-weight: 400; line-height: 1.35; }
  .account-owners select { min-block-size: 7.4rem; }
  .account-owner-status { margin: 0; color: var(--fp-muted); font-size: 0.74rem; font-weight: 400; }
  .account-owner-status--missing { color: var(--fp-coral); font-weight: 700; }
  .account-toggle { min-block-size: 2.75rem; display: flex; align-items: center; gap: 0.6rem; color: var(--fp-ink); font-weight: 700; }
  .account-toggle label { display: flex; align-items: center; gap: 0.6rem; }
  .account-toggle input { inline-size: 1.2rem; block-size: 1.2rem; accent-color: var(--fp-cyan); }
  .account-active-status { color: var(--fp-muted); font-size: 0.78rem; font-weight: 800; }
  .account-active-status--archived { color: var(--fp-ink); }
  .account-card-actions { grid-column: 1 / -1; display: flex; align-items: center; justify-content: flex-end; gap: 0.8rem; padding-block-start: 0.75rem; border-block-start: 1px solid var(--fp-line); }
  .account-save-status { flex: 1; margin: 0; color: var(--fp-muted); font-size: 0.78rem; }
  .account-save { min-block-size: 2.75rem; padding: 0.5rem 0.85rem; border: 1px solid var(--fp-navy); border-radius: 0.45rem; color: var(--fp-paper); background: var(--fp-navy); font-weight: 800; }
  .account-save:hover { background: var(--fp-navy-deep); }
  .account-save:disabled { cursor: wait; opacity: 0.55; }
  .plan-items-view { max-inline-size: 76rem; padding-block: 1.8rem; }
  .plan-items-view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .plan-items-view h2 { margin: 0; font-family: var(--fp-display); font-size: clamp(2rem, 3vw, 2.65rem); line-height: 1; }
  .plan-items-view-header p { max-inline-size: 58rem; margin: 0.5rem 0 0; color: var(--fp-muted); }
  .plan-item-list { display: grid; gap: 1rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .plan-item-card { display: grid; gap: 1rem; padding: 1.1rem; }
  .plan-item-card--archived { background: rgb(247 247 244 / 0.7); }
  .plan-item-card-header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-block-end: 0.75rem; border-block-end: 1px solid var(--fp-line); }
  .plan-item-card-header h3 { min-inline-size: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; font-family: var(--fp-display); font-size: 1.3rem; line-height: 1; }
  .plan-item-card-header p { flex: 0 0 auto; margin: 0; color: var(--fp-muted); font-size: 0.76rem; }
  .plan-item-fields { display: grid; grid-template-columns: minmax(12rem, 1.5fr) repeat(4, minmax(8rem, 1fr)); gap: 0.75rem; }
  .plan-item-field { min-inline-size: 0; display: grid; align-content: start; gap: 0.3rem; color: var(--fp-muted); font-size: 0.75rem; font-weight: 700; }
  .plan-item-field--wide { grid-column: span 2; }
  .plan-item-field input, .plan-item-field select { inline-size: 100%; min-inline-size: 0; min-block-size: 2.75rem; padding: 0.5rem 0.6rem; border: 1px solid var(--fp-control-border); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .plan-item-field input:user-invalid, .plan-item-field select:user-invalid { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .plan-item-field small { color: var(--fp-muted); font-size: 0.7rem; font-weight: 400; line-height: 1.35; }
  .plan-item-target { grid-column: span 2; }
  .plan-item-schedule { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(5, minmax(8rem, 1fr)); gap: 0.75rem; margin: 0; padding: 0.85rem 0 0; border: 0; border-block-start: 1px solid var(--fp-line); }
  .plan-item-schedule legend { grid-column: 1 / -1; padding: 0; color: var(--fp-ink); font-size: 0.82rem; font-weight: 800; }
  .plan-item-status { display: inline-flex; align-items: center; min-block-size: 1.8rem; padding: 0.25rem 0.5rem; border-radius: 0.35rem; color: var(--fp-navy); background: var(--fp-cyan-soft); font-size: 0.72rem; font-weight: 800; }
  .plan-item-status--archived { color: var(--fp-ink); background: var(--fp-amber-soft); }
  .plan-item-card-actions { display: flex; align-items: center; gap: 0.8rem; padding-block-start: 0.75rem; border-block-start: 1px solid var(--fp-line); }
  .plan-item-save-status { flex: 1; min-block-size: 1.2rem; margin: 0; color: var(--fp-muted); font-size: 0.78rem; overflow-wrap: anywhere; }
  .plan-item-save-status--error { color: var(--fp-coral); font-weight: 700; }
  .plan-item-save, .plan-item-archive, .plan-item-new { min-block-size: 2.75rem; padding: 0.5rem 0.85rem; border: 1px solid var(--fp-navy); border-radius: 0.45rem; font-weight: 800; }
  .plan-item-save, .plan-item-new { color: var(--fp-paper); background: var(--fp-navy); }
  .plan-item-save:hover, .plan-item-new:hover { background: var(--fp-navy-deep); }
  .plan-item-archive { color: var(--fp-coral); background: var(--fp-paper-strong); }
  .plan-item-archive:hover { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .plan-item-save:disabled { cursor: wait; opacity: 0.55; }
  .plan-item-new-row { display: flex; justify-content: flex-end; margin-block-start: 1rem; }
  .plan-item-help { max-inline-size: 70ch; margin: 0.8rem 0 0; color: var(--fp-muted); font-size: 0.78rem; line-height: 1.45; }
  .pets-view { max-inline-size: 62rem; padding-block: 1.8rem; }
  .pets-view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .pets-view h2 { margin: 0; font-family: var(--fp-display); font-size: clamp(2rem, 3vw, 2.65rem); line-height: 1; }
  .pets-view-header p { max-inline-size: 48rem; margin: 0.5rem 0 0; color: var(--fp-muted); line-height: 1.45; }
  .pet-list { display: grid; gap: 1rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .pet-card { display: grid; grid-template-columns: minmax(12rem, 1fr) minmax(10rem, 0.75fr); gap: 1rem; padding: 1.1rem; }
  .pet-card--archived { background: rgb(247 247 244 / 0.7); }
  .pet-card-header { grid-column: 1 / -1; display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-block-end: 0.75rem; border-block-end: 1px solid var(--fp-line); }
  .pet-card-header h3 { min-inline-size: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; font-family: var(--fp-display); font-size: 1.3rem; line-height: 1; }
  .pet-card-header p { flex: 0 0 auto; margin: 0; color: var(--fp-muted); font-size: 0.76rem; }
  .pet-field { min-inline-size: 0; display: grid; align-content: start; gap: 0.35rem; color: var(--fp-muted); font-size: 0.78rem; font-weight: 700; }
  .pet-field input { inline-size: 100%; min-inline-size: 0; min-block-size: 2.75rem; padding: 0.5rem 0.6rem; border: 1px solid var(--fp-control-border); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .pet-card-actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 0.8rem; padding-block-start: 0.75rem; border-block-start: 1px solid var(--fp-line); }
  .pet-save-status { flex: 1; min-block-size: 1.2rem; margin: 0; color: var(--fp-muted); font-size: 0.78rem; overflow-wrap: anywhere; }
  .pet-save-status--error { color: var(--fp-coral); font-weight: 700; }
  .pet-save, .pet-archive { min-block-size: 2.75rem; padding: 0.5rem 0.85rem; border: 1px solid var(--fp-navy); border-radius: 0.45rem; font-weight: 800; }
  .pet-save { color: var(--fp-paper); background: var(--fp-navy); }
  .pet-save:hover { background: var(--fp-navy-deep); }
  .pet-save:disabled { cursor: wait; opacity: 0.55; }
  .pet-archive { color: var(--fp-coral); background: var(--fp-paper-strong); }
  .pet-archive:hover { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .feed-profiles-view { max-inline-size: 72rem; padding-block: 1.8rem; }
  .feed-profiles-view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .feed-profiles-view h2 { margin: 0; font-family: var(--fp-display); font-size: clamp(2rem, 3vw, 2.65rem); line-height: 1; }
  .feed-profiles-view-header p { max-inline-size: 56rem; margin: 0.5rem 0 0; color: var(--fp-muted); line-height: 1.45; }
  .feed-profile-list { display: grid; gap: 1rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .feed-profile-card { display: grid; gap: 1rem; padding: 1.1rem; }
  .feed-profile-card--archived { background: rgb(247 247 244 / 0.7); }
  .feed-profile-card-header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-block-end: 0.75rem; border-block-end: 1px solid var(--fp-line); }
  .feed-profile-card-header h3 { min-inline-size: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; font-family: var(--fp-display); font-size: 1.3rem; line-height: 1; }
  .feed-profile-card-header p { flex: 0 0 auto; margin: 0; color: var(--fp-muted); font-size: 0.76rem; }
  .feed-profile-fields { display: grid; grid-template-columns: minmax(12rem, 1.4fr) minmax(8rem, 0.8fr) repeat(3, minmax(8rem, 1fr)); gap: 0.75rem; }
  .feed-profile-field { min-inline-size: 0; display: grid; align-content: start; gap: 0.3rem; color: var(--fp-muted); font-size: 0.75rem; font-weight: 700; }
  .feed-profile-field input, .feed-profile-field select { inline-size: 100%; min-inline-size: 0; min-block-size: 2.75rem; padding: 0.5rem 0.6rem; border: 1px solid var(--fp-control-border); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .feed-profile-field input:user-invalid, .feed-profile-field select:user-invalid { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .feed-profile-field small { color: var(--fp-muted); font-size: 0.7rem; font-weight: 400; line-height: 1.35; }
  .feed-profile-help { margin: 0; color: var(--fp-muted); font-size: 0.78rem; line-height: 1.45; }
  .feed-profile-forecast { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem; padding: 0.85rem; border: 1px solid var(--fp-line); background: var(--fp-cyan-soft); }
  .feed-profile-forecast dl { display: contents; }
  .feed-profile-forecast dt { color: var(--fp-muted); font-size: 0.7rem; font-weight: 700; }
  .feed-profile-forecast dd { margin: 0.15rem 0 0; font-family: var(--fp-data); font-size: 0.9rem; font-weight: 700; }
  .feed-profile-forecast dd, .feed-profile-forecast dt { min-inline-size: 0; overflow-wrap: anywhere; }
  .feed-status { display: inline-flex; align-items: center; min-block-size: 1.8rem; padding: 0.25rem 0.5rem; border-radius: 0.35rem; color: var(--fp-navy); background: var(--fp-cyan-soft); font-size: 0.72rem; font-weight: 800; }
  .feed-status--due-soon, .feed-status--due { color: #754400; background: var(--fp-amber-soft); }
  .feed-status--overdue { color: #7c241a; background: var(--fp-coral-soft); }
  .feed-status--archived { color: var(--fp-ink); background: var(--fp-amber-soft); }
  .feed-profile-card-actions { display: flex; align-items: center; gap: 0.8rem; padding-block-start: 0.75rem; border-block-start: 1px solid var(--fp-line); }
  .feed-profile-save-status { flex: 1; min-block-size: 1.2rem; margin: 0; color: var(--fp-muted); font-size: 0.78rem; overflow-wrap: anywhere; }
  .feed-profile-save-status--error { color: var(--fp-coral); font-weight: 700; }
  .feed-profile-save, .feed-profile-archive, .feed-profile-purchase { min-block-size: 2.75rem; padding: 0.5rem 0.85rem; border: 1px solid var(--fp-navy); border-radius: 0.45rem; font-weight: 800; }
  .feed-profile-save, .feed-profile-purchase { color: var(--fp-paper); background: var(--fp-navy); }
  .feed-profile-save:hover, .feed-profile-purchase:hover { background: var(--fp-navy-deep); }
  .feed-profile-archive { color: var(--fp-coral); background: var(--fp-paper-strong); }
  .feed-profile-archive:hover { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .feed-profile-save:disabled, .feed-profile-purchase:disabled { cursor: wait; opacity: 0.55; }
  .catalogs-view { max-inline-size: 72rem; padding-block: 1.8rem; }
  .catalogs-view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .catalogs-view h2 { margin: 0; font-family: var(--fp-display); font-size: clamp(2rem, 3vw, 2.65rem); line-height: 1; }
  .catalogs-view-header p { max-inline-size: 56rem; margin: 0.5rem 0 0; color: var(--fp-muted); line-height: 1.45; }
  .catalogs-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-block-start: 1rem; }
  .catalog-section { min-inline-size: 0; display: grid; align-content: start; gap: 0.75rem; padding: 1rem; }
  .catalog-section-header { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; padding-block-end: 0.65rem; border-block-end: 1px solid var(--fp-line); }
  .catalog-section-header h3 { margin: 0; font-family: var(--fp-display); font-size: 1.35rem; line-height: 1; }
  .catalog-section-header span { color: var(--fp-muted); font-family: var(--fp-data); font-size: 0.72rem; }
  .catalog-entry-list { display: grid; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
  .catalog-entry-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 0.45rem; padding: 0.6rem; border: 1px solid var(--fp-line); background: rgb(255 254 249 / 0.72); }
  .catalog-entry-form--archived { background: rgb(247 247 244 / 0.7); }
  .catalog-field { min-inline-size: 0; display: grid; gap: 0.25rem; color: var(--fp-muted); font-size: 0.7rem; font-weight: 800; }
  .catalog-field input { inline-size: 100%; min-block-size: 2.75rem; min-inline-size: 0; padding: 0.5rem 0.6rem; border: 1px solid var(--fp-control-border); border-radius: 0.4rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .catalog-field input:user-invalid { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .catalog-entry-actions { display: flex; align-items: center; gap: 0.35rem; }
  .catalog-entry-actions button { min-block-size: 2.75rem; padding: 0.5rem 0.65rem; border: 1px solid var(--fp-navy); border-radius: 0.4rem; color: var(--fp-paper); background: var(--fp-navy); font-size: 0.75rem; font-weight: 800; }
  .catalog-entry-actions button:hover { background: var(--fp-navy-deep); }
  .catalog-entry-actions .catalog-archive { color: var(--fp-coral); background: var(--fp-paper-strong); }
  .catalog-entry-actions .catalog-archive:hover { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .catalog-entry-status { grid-column: 1 / -1; min-block-size: 1.1rem; margin: 0; color: var(--fp-muted); font-size: 0.7rem; overflow-wrap: anywhere; }
  .catalog-entry-status--error { color: var(--fp-coral); font-weight: 700; }
  .catalog-help { margin: 0; color: var(--fp-muted); font-size: 0.78rem; line-height: 1.45; }
  .empty-state { margin-block-start: 1rem; padding: 2rem; border: 1px dashed var(--fp-line); color: var(--fp-muted); text-align: center; }

  .visually-hidden { position: absolute !important; inline-size: 1px !important; block-size: 1px !important; overflow: hidden !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
  .skip-link { inset: 0.75rem auto auto 0.75rem; z-index: 10; padding: 0.6rem 0.8rem; color: var(--fp-paper); background: var(--fp-navy); }
  .skip-link:focus-visible { position: fixed !important; inline-size: auto !important; block-size: auto !important; overflow: visible !important; clip-path: none !important; white-space: normal !important; }
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
    .allocation-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .allocation-remove { inline-size: 100%; }
    .plan-item-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .plan-item-field--wide, .plan-item-target { grid-column: span 2; }
    .plan-item-schedule { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pet-card { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .feed-profile-fields, .feed-profile-forecast { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
    .review-view-header, .accounts-view-header, .plan-items-view-header, .pets-view-header, .feed-profiles-view-header, .catalogs-view-header, .import-strip, .excel-review-header { display: block; }
    .back-button { margin-block-start: 1rem; }
    .accounts-actions { margin-block-start: 1rem; }
    .account-card { grid-template-columns: 1fr; }
    .account-card-header, .account-card-actions { grid-column: 1; }
    .account-card-header, .account-card-actions { align-items: stretch; flex-direction: column; }
    .plan-item-card-header, .plan-item-card-actions { align-items: stretch; flex-direction: column; }
    .plan-item-fields, .plan-item-schedule { grid-template-columns: 1fr; }
    .plan-item-field--wide, .plan-item-target { grid-column: 1; }
    .plan-item-save, .plan-item-archive, .plan-item-new { inline-size: 100%; }
    .pet-card { grid-template-columns: 1fr; }
    .pet-card-actions { align-items: stretch; flex-direction: column; }
    .pet-save, .pet-archive { inline-size: 100%; }
    .feed-profile-fields, .feed-profile-forecast { grid-template-columns: 1fr; }
    .feed-profile-card-header, .feed-profile-card-actions { align-items: stretch; flex-direction: column; }
    .feed-profile-save, .feed-profile-archive, .feed-profile-purchase { inline-size: 100%; }
    .catalogs-grid { grid-template-columns: 1fr; }
    .catalog-entry-form { grid-template-columns: 1fr; }
    .catalog-entry-actions { flex-direction: column; align-items: stretch; }
    .catalog-entry-actions button { inline-size: 100%; }
    .plan-item-new-row { display: block; }
    .file-input { max-inline-size: 100%; margin-block-start: 0.8rem; }
    .excel-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .booking-row { grid-template-columns: 1fr auto; gap: 0.35rem 0.8rem; }
    .booking-date, .booking-account { grid-column: 1; }
    .booking-amount { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
    .allocation-row { grid-template-columns: 1fr; }
    .allocation-actions { align-items: stretch; flex-direction: column; }
    .allocation-status, .allocation-add, .assign-button { inline-size: 100%; }
  }

  @media (forced-colors: active) {
    .surface, .month-control, .import-strip, .booking-row, .excel-suggestion-row, .account-card, .plan-item-card, .pet-card, .feed-profile-card, .feed-profile-forecast, .catalog-section, .catalog-entry-form, .allocation-field input, .allocation-field select, .allocation-remove, .plan-item-field input, .plan-item-field select, .pet-field input, .feed-profile-field input, .feed-profile-field select, .catalog-field input { border: 1px solid CanvasText; box-shadow: none; }
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

function feedStatusLabel(status) {
  return {
    planned: "Geplant",
    due_soon: "Bald fällig",
    due: "Heute fällig",
    overdue: "Überfällig",
  }[status] || "Geplant";
}

function feedSourceLabel(source) {
  return {
    manual: "manuelles Intervall",
    average: "Durchschnitt bestätigter Käufe",
    none: "noch keine ausreichende Historie",
  }[source] || "noch keine ausreichende Historie";
}

function catalogKindLabel(kind) {
  return {
    categories: "Kategorien",
    areas: "Bereiche",
    projects: "Projekte",
  }[kind] || kind;
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
    this._planItems = [];
    this._planItemsLoading = false;
    this._planItemsLoadFailed = false;
    this._planItemDrafts = new Map();
    this._planItemSubmissions = new Set();
    this._planItemErrors = new Map();
    this._bookings = [];
    this._persons = [];
    this._allocationDrafts = new Map();
    this._allocationSubmissions = new Set();
    this._allocationErrors = new Map();
    this._accountDrafts = new Map();
    this._pets = [];
    this._petsLoading = false;
    this._petsLoadFailed = false;
    this._petDrafts = new Map();
    this._petSubmissions = new Set();
    this._petErrors = new Map();
    this._feedProfiles = [];
    this._feedProfilesLoading = false;
    this._feedProfilesLoadFailed = false;
    this._feedProfileDrafts = new Map();
    this._feedProfileSubmissions = new Set();
    this._feedProfileErrors = new Map();
    this._catalogs = { categories: [], areas: [], projects: [] };
    this._catalogsLoading = false;
    this._catalogsLoadFailed = false;
    this._catalogDrafts = new Map();
    this._catalogSubmissions = new Set();
    this._catalogErrors = new Map();
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
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, `HTTP ${response.status}`));
      this._data = dataWithDefaults(result);
      this._message = "";
    } catch (error) {
      this._data = dataWithDefaults(fallbackOverview);
      this._message = `Demo-Ansicht aktiv: ${error.message || "Die Finanzplaner-API ist noch nicht erreichbar."}`;
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
      this._message = error.message || "Die Prüfliste konnte nicht geladen werden.";
    }
    this._render();
  }

  async _loadReviewData() {
    const [bookingResponse, personsResponse, petsResponse, catalogsResponse] = await Promise.all([
      fetchWithHomeAssistantAuth(this._hass, REVIEW_URL),
      fetchWithHomeAssistantAuth(this._hass, PERSONS_URL),
      fetchWithHomeAssistantAuth(this._hass, PETS_URL),
      fetchWithHomeAssistantAuth(this._hass, CATALOGS_URL),
    ]);
    const [bookingResult, personsResult, petsResult, catalogsResult] = await Promise.all([
      readApiResponse(bookingResponse),
      readApiResponse(personsResponse),
      readApiResponse(petsResponse),
      readApiResponse(catalogsResponse),
    ]);
    if (!bookingResponse.ok || !petsResponse.ok || !catalogsResponse.ok) {
      const failedResult = !bookingResponse.ok ? bookingResult : !petsResponse.ok ? petsResult : catalogsResult;
      const failedResponse = !bookingResponse.ok ? bookingResponse : !petsResponse.ok ? petsResponse : catalogsResponse;
      throw new Error(apiErrorMessage(failedResult, `HTTP ${failedResponse.status}`));
    }
    this._bookings = bookingResult.bookings || [];
    this._persons = personsResponse.ok ? (personsResult.persons || []) : [];
    this._pets = petsResponse.ok ? (petsResult.pets || []) : [];
    this._catalogs = catalogsResult.catalogs || { categories: [], areas: [], projects: [] };
    const bookingIds = new Set(this._bookings.map((booking) => String(booking.id)));
    for (const booking of this._bookings) {
      const bookingId = String(booking.id);
      if (!this._allocationDrafts.has(bookingId)) {
        const storedAllocations = Array.isArray(booking.allocations) && booking.allocations.length
          ? booking.allocations.map((allocation) => ({
            target: allocation.target || "",
            amount: Number(allocation.amount) || 0,
            area: allocation.area || null,
            area_id: allocation.area_id || null,
            category: allocation.category || null,
            category_id: allocation.category_id || null,
            project: allocation.project || null,
            project_id: allocation.project_id || null,
            pet_id: allocation.pet_id || null,
          }))
          : equalAllocationDraft(booking.amount, ["household"]);
        this._allocationDrafts.set(bookingId, storedAllocations);
      }
    }
    for (const bookingId of this._allocationDrafts.keys()) {
      if (!bookingIds.has(bookingId)) {
        this._allocationDrafts.delete(bookingId);
        this._allocationErrors.delete(bookingId);
      }
    }
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
      const [accountsResult, personsResult] = await Promise.all([
        readApiResponse(accountsResponse),
        readApiResponse(personsResponse),
      ]);
      if (!accountsResponse.ok || !personsResponse.ok) {
        const failedResult = !accountsResponse.ok ? accountsResult : personsResult;
        throw new Error(apiErrorMessage(failedResult, "Konten oder Personen konnten nicht geladen werden."));
      }
      this._accounts = accountsResult.accounts || [];
      this._persons = personsResult.persons || [];
      const accountIds = new Set(this._accounts.map((account) => String(account.id)));
      for (const account of this._accounts) {
        const accountId = String(account.id);
        if (!this._accountDrafts.has(accountId)) {
          this._accountDrafts.set(accountId, {
            label: account.label || "",
            bank: account.bank || "",
            iban: "",
            owner_targets: Array.isArray(account.owner_targets) ? [...account.owner_targets] : [],
            active: account.active !== false,
          });
        }
      }
      for (const accountId of this._accountDrafts.keys()) {
        if (!accountIds.has(accountId)) this._accountDrafts.delete(accountId);
      }
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

  _newPetDraft() {
    return { name: "", pet_type: "", active: true };
  }

  _petDraftFromPet(pet) {
    return {
      name: pet.name || "",
      pet_type: pet.pet_type || "",
      active: pet.active !== false,
    };
  }

  async _loadPets() {
    const response = await fetchWithHomeAssistantAuth(this._hass, PETS_URL);
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(apiErrorMessage(result, `HTTP ${response.status}`));
    this._pets = Array.isArray(result.pets) ? result.pets : [];
    if (!this._petDrafts.has("new")) this._petDrafts.set("new", this._newPetDraft());
    const petIds = new Set(this._pets.map((pet) => String(pet.id)));
    for (const pet of this._pets) {
      const petId = String(pet.id);
      if (!this._petDrafts.has(petId)) this._petDrafts.set(petId, this._petDraftFromPet(pet));
    }
    for (const petId of this._petDrafts.keys()) {
      if (petId !== "new" && !petIds.has(petId)) this._petDrafts.delete(petId);
    }
  }

  async _openPets() {
    this._view = "pets";
    this._message = "";
    this._petsLoading = true;
    this._petsLoadFailed = false;
    this._render();
    this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true });
    try {
      await this._loadPets();
    } catch (error) {
      this._pets = [];
      this._petsLoadFailed = true;
      this._message = error.message || "Tiere konnten nicht geladen werden.";
    } finally {
      this._petsLoading = false;
    }
    this._render();
  }

  _newFeedProfileDraft() {
    return {
      pet_id: "",
      product: "",
      package_unit: "",
      expected_cost: "",
      expected_cost_input: "",
      interval_weeks: "",
      last_purchase_date: "",
      due_soon_days: 14,
      active: true,
    };
  }

  _feedProfileDraftFromProfile(profile) {
    const expectedCost = Number(profile.expected_cost);
    return {
      pet_id: profile.pet_id || "",
      product: profile.product || "",
      package_unit: profile.package_unit || "",
      expected_cost: Number.isFinite(expectedCost) ? expectedCost : "",
      expected_cost_input: Number.isFinite(expectedCost) ? expectedCost.toFixed(2) : "",
      interval_weeks: profile.interval_weeks ?? "",
      last_purchase_date: profile.last_purchase_date || "",
      due_soon_days: profile.due_soon_days ?? 14,
      active: profile.active !== false,
    };
  }

  async _loadFeedProfiles() {
    const [feedResponse, petsResponse] = await Promise.all([
      fetchWithHomeAssistantAuth(this._hass, FEED_PROFILES_URL),
      fetchWithHomeAssistantAuth(this._hass, PETS_URL),
    ]);
    const [feedResult, petsResult] = await Promise.all([
      readApiResponse(feedResponse),
      readApiResponse(petsResponse),
    ]);
    if (!feedResponse.ok || !petsResponse.ok) {
      const failedResult = !feedResponse.ok ? feedResult : petsResult;
      const failedResponse = !feedResponse.ok ? feedResponse : petsResponse;
      throw new Error(apiErrorMessage(failedResult, `HTTP ${failedResponse.status}`));
    }
    this._feedProfiles = Array.isArray(feedResult.feed_profiles) ? feedResult.feed_profiles : [];
    this._pets = Array.isArray(petsResult.pets) ? petsResult.pets : [];
    if (!this._feedProfileDrafts.has("new")) this._feedProfileDrafts.set("new", this._newFeedProfileDraft());
    const profileIds = new Set(this._feedProfiles.map((profile) => String(profile.id)));
    for (const profile of this._feedProfiles) {
      const profileId = String(profile.id);
      if (!this._feedProfileDrafts.has(profileId)) {
        this._feedProfileDrafts.set(profileId, this._feedProfileDraftFromProfile(profile));
      }
    }
    for (const profileId of this._feedProfileDrafts.keys()) {
      if (profileId !== "new" && !profileIds.has(profileId)) this._feedProfileDrafts.delete(profileId);
    }
  }

  async _openFeedProfiles() {
    this._view = "feed_profiles";
    this._message = "";
    this._feedProfilesLoading = true;
    this._feedProfilesLoadFailed = false;
    this._render();
    this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true });
    try {
      await this._loadFeedProfiles();
    } catch (error) {
      this._feedProfiles = [];
      this._pets = [];
      this._feedProfilesLoadFailed = true;
      this._message = error.message || "Futterprofile konnten nicht geladen werden.";
    } finally {
      this._feedProfilesLoading = false;
    }
    this._render();
  }

  _catalogEntries(kind) {
    const entries = this._catalogs?.[kind];
    return Array.isArray(entries) ? entries : [];
  }

  _catalogKey(kind, entryId) {
    return `${kind}:${entryId}`;
  }

  _catalogDraftFromEntry(entry) {
    return {
      label: entry.label || "",
      active: entry.active !== false,
    };
  }

  async _loadCatalogs() {
    const response = await fetchWithHomeAssistantAuth(this._hass, CATALOGS_URL);
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(apiErrorMessage(result, `HTTP ${response.status}`));
    const catalogs = result.catalogs || {};
    this._catalogs = {
      categories: Array.isArray(catalogs.categories) ? catalogs.categories : [],
      areas: Array.isArray(catalogs.areas) ? catalogs.areas : [],
      projects: Array.isArray(catalogs.projects) ? catalogs.projects : [],
    };
    for (const kind of ["categories", "areas", "projects"]) {
      const newKey = this._catalogKey(kind, "new");
      if (!this._catalogDrafts.has(newKey)) this._catalogDrafts.set(newKey, { label: "", active: true });
      for (const entry of this._catalogEntries(kind)) {
        const key = this._catalogKey(kind, String(entry.id));
        if (!this._catalogDrafts.has(key)) this._catalogDrafts.set(key, this._catalogDraftFromEntry(entry));
      }
    }
    const knownKeys = new Set(["categories", "areas", "projects"].flatMap((kind) => [
      this._catalogKey(kind, "new"),
      ...this._catalogEntries(kind).map((entry) => this._catalogKey(kind, String(entry.id))),
    ]));
    for (const key of this._catalogDrafts.keys()) {
      if (!knownKeys.has(key)) this._catalogDrafts.delete(key);
    }
  }

  async _openCatalogs() {
    this._view = "catalogs";
    this._message = "";
    this._catalogsLoading = true;
    this._catalogsLoadFailed = false;
    this._render();
    this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true });
    try {
      await this._loadCatalogs();
    } catch (error) {
      this._catalogs = { categories: [], areas: [], projects: [] };
      this._catalogsLoadFailed = true;
      this._message = error.message || "Stammdaten konnten nicht geladen werden.";
    } finally {
      this._catalogsLoading = false;
    }
    this._render();
  }

  _captureCatalogDraft(form) {
    return {
      label: form.querySelector("[data-catalog-field='label']")?.value || "",
      active: Boolean(form.querySelector("[data-catalog-field='active']")?.checked),
    };
  }

  _updateCatalogDraft(event) {
    const form = event.currentTarget.closest("[data-catalog-form]");
    if (!form) return;
    const key = this._catalogKey(form.dataset.catalogKind, form.dataset.catalogId);
    this._catalogDrafts.set(key, this._captureCatalogDraft(form));
    this._catalogErrors.delete(key);
    const status = form.querySelector("[data-catalog-save-status]");
    status?.classList.remove("catalog-entry-status--error");
    if (status) status.textContent = "";
  }

  _catalogPayload(draft) {
    return { label: draft.label, active: draft.active !== false };
  }

  async _handleCatalogSave(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const kind = String(form.dataset.catalogKind);
    const entryId = String(form.dataset.catalogId);
    const key = this._catalogKey(kind, entryId);
    if (this._catalogSubmissions.has(key)) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const draft = this._captureCatalogDraft(form);
    this._catalogDrafts.set(key, draft);
    const button = form.querySelector("[type='submit']");
    const status = form.querySelector("[data-catalog-save-status]");
    this._catalogSubmissions.add(key);
    form.setAttribute("aria-busy", "true");
    if (button) button.disabled = true;
    if (status) status.textContent = "Wird gespeichert …";
    const url = entryId === "new"
      ? `${CATALOGS_URL}/${encodeURIComponent(kind)}`
      : `${CATALOGS_URL}/${encodeURIComponent(kind)}/${encodeURIComponent(entryId)}`;
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this._catalogPayload(draft)),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Der Stammdateneintrag konnte nicht gespeichert werden."));
      this._catalogDrafts.delete(key);
      this._catalogErrors.delete(key);
      this._message = entryId === "new" ? `${draft.label.trim()} angelegt.` : `${draft.label.trim()} gespeichert.`;
      await this._loadCatalogs();
      this._render();
    } catch (error) {
      this._catalogErrors.set(key, error.message || "Der Stammdateneintrag konnte nicht gespeichert werden.");
      if (status) {
        status.textContent = this._catalogErrors.get(key);
        status.classList.add("catalog-entry-status--error");
      }
      if (button) button.disabled = false;
      form.removeAttribute("aria-busy");
    } finally {
      this._catalogSubmissions.delete(key);
    }
  }

  async _archiveCatalog(event) {
    const button = event.currentTarget;
    const kind = String(button.dataset.catalogKind);
    const entryId = String(button.dataset.catalogId);
    const entry = this._catalogEntries(kind).find((candidate) => String(candidate.id) === entryId);
    if (!entry || !window.confirm(`„${entry.label || "Eintrag"}“ archivieren?`)) return;
    const key = this._catalogKey(kind, entryId);
    if (this._catalogSubmissions.has(key)) return;
    const form = button.closest("[data-catalog-form]");
    const status = form?.querySelector("[data-catalog-save-status]");
    this._catalogSubmissions.add(key);
    button.disabled = true;
    if (status) status.textContent = "Wird archiviert …";
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${CATALOGS_URL}/${encodeURIComponent(kind)}/${encodeURIComponent(entryId)}`, { method: "DELETE" });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Der Stammdateneintrag konnte nicht archiviert werden."));
      this._catalogDrafts.delete(key);
      this._message = `${entry.label} archiviert. Bestehende Zuordnungen bleiben erhalten.`;
      await this._loadCatalogs();
      this._render();
    } catch (error) {
      if (status) {
        status.textContent = error.message || "Der Stammdateneintrag konnte nicht archiviert werden.";
        status.classList.add("catalog-entry-status--error");
      }
      button.disabled = false;
    } finally {
      this._catalogSubmissions.delete(key);
    }
  }

  _catalogOptions(kind, selectedLabel, emptyLabel = "Keine Auswahl") {
    const selected = String(selectedLabel || "");
    const entries = this._catalogEntries(kind)
      .filter((entry) => entry.active !== false || String(entry.label || "") === selected || String(entry.id || "") === selected)
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "de"));
    const selectedEntry = entries.find((entry) => String(entry.id || "") === selected || String(entry.label || "") === selected);
    const selectedId = selectedEntry ? String(selectedEntry.id) : selected;
    const options = [`<option value=""${selected ? "" : " selected"}>${emptyLabel}</option>`];
    if (selected && !selectedEntry) {
      options.push(`<option value="" data-catalog-label="${escapeHtml(selected)}" selected>Nicht mehr verfügbar: ${escapeHtml(selected)}</option>`);
    }
    options.push(...entries.map((entry) => {
      const label = entry.active === false ? `${entry.label} (archiviert)` : entry.label;
      return `<option value="${escapeHtml(entry.id)}" data-catalog-label="${escapeHtml(entry.label)}"${String(entry.id) === selectedId ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }));
    return options.join("");
  }

  _newPlanItemDraft() {
    return {
      name: "",
      direction: "expense",
      category: "",
      category_id: "",
      area: "",
      area_id: "",
      project: "",
      project_id: "",
      amount: "",
      amount_input: "",
      frequency_months: 1,
      due_day: "",
      due_date: "",
      start_date: "",
      end_date: "",
      target: "household",
      pet_id: "",
      active: true,
    };
  }

  _planItemDraftFromItem(item) {
    const numericAmount = Number(item.amount);
    return {
      name: item.name || "",
      direction: item.direction || (numericAmount >= 0 ? "income" : "expense"),
      category: item.category || "",
      category_id: item.category_id || "",
      area: item.area || "",
      area_id: item.area_id || "",
      project: item.project || "",
      project_id: item.project_id || "",
      amount: Math.abs(numericAmount) || 0,
      amount_input: Number.isFinite(numericAmount) ? Math.abs(numericAmount).toFixed(2) : "",
      frequency_months: item.frequency_months ?? 1,
      due_day: item.due_day ?? "",
      due_date: item.due_date || "",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      target: item.target || "",
      pet_id: item.pet_id || "",
      active: item.active !== false,
    };
  }

  async _loadPlanItems() {
    const [planResponse, personsResponse, petsResponse, catalogsResponse] = await Promise.all([
      fetchWithHomeAssistantAuth(this._hass, PLAN_ITEMS_URL),
      fetchWithHomeAssistantAuth(this._hass, PERSONS_URL),
      fetchWithHomeAssistantAuth(this._hass, PETS_URL),
      fetchWithHomeAssistantAuth(this._hass, CATALOGS_URL),
    ]);
    const [planResult, personsResult, petsResult, catalogsResult] = await Promise.all([
      readApiResponse(planResponse),
      readApiResponse(personsResponse),
      readApiResponse(petsResponse),
      readApiResponse(catalogsResponse),
    ]);
    if (!planResponse.ok || !personsResponse.ok || !petsResponse.ok || !catalogsResponse.ok) {
      const failedResult = !planResponse.ok ? planResult : !personsResponse.ok ? personsResult : !petsResponse.ok ? petsResult : catalogsResult;
      throw new Error(apiErrorMessage(failedResult, "Planposten, Personen oder Tiere konnten nicht geladen werden."));
    }
    this._planItems = Array.isArray(planResult.plan_items) ? planResult.plan_items : [];
    this._persons = Array.isArray(personsResult.persons) ? personsResult.persons : [];
    this._pets = Array.isArray(petsResult.pets) ? petsResult.pets : [];
    this._catalogs = catalogsResult.catalogs || { categories: [], areas: [], projects: [] };
    if (!this._planItemDrafts.has("new")) this._planItemDrafts.set("new", this._newPlanItemDraft());
    const itemIds = new Set(this._planItems.map((item) => String(item.id)));
    for (const item of this._planItems) {
      const itemId = String(item.id);
      if (!this._planItemDrafts.has(itemId)) {
        this._planItemDrafts.set(itemId, this._planItemDraftFromItem(item));
      }
    }
    for (const itemId of this._planItemDrafts.keys()) {
      if (itemId !== "new" && !itemIds.has(itemId)) this._planItemDrafts.delete(itemId);
    }
  }

  async _openPlanItems() {
    this._view = "plan_items";
    this._message = "";
    this._planItemsLoading = true;
    this._planItemsLoadFailed = false;
    this._render();
    this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true });
    try {
      await this._loadPlanItems();
    } catch (error) {
      this._planItems = [];
      this._persons = [];
      this._pets = [];
      this._planItemsLoadFailed = true;
      this._message = error.message || "Planposten konnten nicht geladen werden.";
    } finally {
      this._planItemsLoading = false;
    }
    this._render();
  }

  _capturePlanItemDraft(form) {
    const value = (field) => form.querySelector(`[data-plan-item-field="${field}"]`)?.value ?? "";
    const catalogValue = (field) => {
      const select = form.querySelector(`[data-plan-item-field="${field}"]`);
      const option = select?.selectedOptions?.[0];
      return {
        id: option?.value || "",
        label: option?.dataset.catalogLabel || "",
      };
    };
    const category = catalogValue("category");
    const area = catalogValue("area");
    const project = catalogValue("project");
    return {
      name: value("name"),
      direction: value("direction") || "expense",
      category: category.label,
      category_id: category.id,
      area: area.label,
      area_id: area.id,
      project: project.label,
      project_id: project.id,
      amount: value("amount"),
      amount_input: value("amount"),
      frequency_months: value("frequency_months") === "" ? null : Number(value("frequency_months")),
      due_day: value("due_day"),
      due_date: value("due_date"),
      start_date: value("start_date"),
      end_date: value("end_date"),
      target: value("target"),
      pet_id: value("pet_id"),
      active: Boolean(form.querySelector("[data-plan-item-field='active']")?.checked),
    };
  }

  _updatePlanItemDraft(event) {
    const form = event.currentTarget.closest("[data-plan-item-form]");
    if (!form) return;
    const itemId = String(form.dataset.planItemId);
    const draft = this._capturePlanItemDraft(form);
    this._planItemDrafts.set(itemId, draft);
    this._planItemErrors.delete(itemId);
    const status = form.querySelector("[data-plan-item-save-status]");
    status?.classList.remove("plan-item-save-status--error");
    if (status) status.textContent = "";
  }

  _planItemPayload(draft) {
    const optional = (value) => String(value ?? "").trim() || null;
    const frequency = draft.frequency_months === "" || draft.frequency_months == null
      ? null
      : Number(draft.frequency_months);
    const dueDay = String(draft.due_day ?? "").trim();
    return {
      name: draft.name,
      direction: draft.direction,
      category: optional(draft.category),
      category_id: optional(draft.category_id),
      area: optional(draft.area),
      area_id: optional(draft.area_id),
      project: optional(draft.project),
      project_id: optional(draft.project_id),
      amount: String(draft.amount_input ?? draft.amount ?? "").trim(),
      frequency_months: frequency,
      due_day: dueDay ? Number(dueDay) : null,
      due_date: optional(draft.due_date),
      start_date: optional(draft.start_date),
      end_date: optional(draft.end_date),
      target: optional(draft.target),
      pet_id: optional(draft.pet_id),
      active: draft.active !== false,
    };
  }

  async _handlePlanItemSave(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const itemId = String(form.dataset.planItemId);
    if (this._planItemSubmissions.has(itemId)) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const draft = this._capturePlanItemDraft(form);
    this._planItemDrafts.set(itemId, draft);
    const button = form.querySelector("[type='submit']");
    const status = form.querySelector("[data-plan-item-save-status]");
    const payload = this._planItemPayload(draft);
    const url = itemId === "new"
      ? PLAN_ITEMS_URL
      : `${PLAN_ITEMS_URL}/${encodeURIComponent(itemId)}`;
    this._planItemSubmissions.add(itemId);
    form.setAttribute("aria-busy", "true");
    if (button) button.disabled = true;
    if (status) status.textContent = "Planposten wird gespeichert …";
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Der Planposten konnte nicht gespeichert werden."));
      this._planItemDrafts.delete(itemId);
      this._planItemErrors.delete(itemId);
      this._message = itemId === "new" ? "Planposten angelegt." : "Planposten gespeichert.";
      await this._loadPlanItems();
      this._render();
    } catch (error) {
      this._planItemErrors.set(itemId, error.message || "Der Planposten konnte nicht gespeichert werden.");
      if (status) {
        status.textContent = this._planItemErrors.get(itemId);
        status.classList.add("plan-item-save-status--error");
      }
      if (button) button.disabled = false;
      form.removeAttribute("aria-busy");
    } finally {
      this._planItemSubmissions.delete(itemId);
    }
  }

  async _archivePlanItem(event) {
    const button = event.currentTarget;
    const itemId = String(button.dataset.planItemId);
    const item = this._planItems.find((candidate) => String(candidate.id) === itemId);
    if (!item || !window.confirm(`„${item.name || "Planposten"}“ archivieren?`)) return;
    if (this._planItemSubmissions.has(itemId)) return;
    const form = button.closest("[data-plan-item-form]");
    const status = form?.querySelector("[data-plan-item-save-status]");
    this._planItemSubmissions.add(itemId);
    button.disabled = true;
    if (status) status.textContent = "Planposten wird archiviert …";
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${PLAN_ITEMS_URL}/${encodeURIComponent(itemId)}`, { method: "DELETE" });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Der Planposten konnte nicht archiviert werden."));
      this._planItemDrafts.delete(itemId);
      this._message = "Planposten archiviert. Du kannst ihn über den Aktiv-Schalter wieder einschalten.";
      await this._loadPlanItems();
      this._render();
    } catch (error) {
      if (status) {
        status.textContent = error.message || "Der Planposten konnte nicht archiviert werden.";
        status.classList.add("plan-item-save-status--error");
      }
      button.disabled = false;
    } finally {
      this._planItemSubmissions.delete(itemId);
    }
  }

  _capturePetDraft(form) {
    const value = (field) => form.querySelector(`[data-pet-field="${field}"]`)?.value ?? "";
    return {
      name: value("name"),
      pet_type: value("pet_type"),
      active: Boolean(form.querySelector("[data-pet-field='active']")?.checked),
    };
  }

  _updatePetDraft(event) {
    const form = event.currentTarget.closest("[data-pet-form]");
    if (!form) return;
    const petId = String(form.dataset.petId);
    this._petDrafts.set(petId, this._capturePetDraft(form));
    this._petErrors.delete(petId);
    const status = form.querySelector("[data-pet-save-status]");
    status?.classList.remove("pet-save-status--error");
    if (status) status.textContent = "";
  }

  async _handlePetSave(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const petId = String(form.dataset.petId);
    if (this._petSubmissions.has(petId)) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const draft = this._capturePetDraft(form);
    this._petDrafts.set(petId, draft);
    const button = form.querySelector("[type='submit']");
    const status = form.querySelector("[data-pet-save-status]");
    this._petSubmissions.add(petId);
    form.setAttribute("aria-busy", "true");
    if (button) button.disabled = true;
    if (status) status.textContent = "Tier wird gespeichert …";
    const url = petId === "new" ? PETS_URL : `${PETS_URL}/${encodeURIComponent(petId)}`;
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Das Tier konnte nicht gespeichert werden."));
      this._petDrafts.delete(petId);
      this._petErrors.delete(petId);
      this._message = petId === "new" ? "Tier angelegt." : "Tier gespeichert.";
      await this._loadPets();
      this._render();
    } catch (error) {
      this._petErrors.set(petId, error.message || "Das Tier konnte nicht gespeichert werden.");
      if (status) {
        status.textContent = this._petErrors.get(petId);
        status.classList.add("pet-save-status--error");
      }
      if (button) button.disabled = false;
      form.removeAttribute("aria-busy");
    } finally {
      this._petSubmissions.delete(petId);
    }
  }

  async _archivePet(event) {
    const button = event.currentTarget;
    const petId = String(button.dataset.petId);
    const pet = this._pets.find((candidate) => String(candidate.id) === petId);
    if (!pet || !window.confirm(`„${pet.name || "Tier"}“ archivieren?`)) return;
    if (this._petSubmissions.has(petId)) return;
    const form = button.closest("[data-pet-form]");
    const status = form?.querySelector("[data-pet-save-status]");
    this._petSubmissions.add(petId);
    button.disabled = true;
    if (status) status.textContent = "Tier wird archiviert …";
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${PETS_URL}/${encodeURIComponent(petId)}`, { method: "DELETE" });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Das Tier konnte nicht archiviert werden."));
      this._petDrafts.delete(petId);
      this._message = "Tier archiviert. Historische Zuordnungen bleiben erhalten.";
      await this._loadPets();
      this._render();
    } catch (error) {
      if (status) {
        status.textContent = error.message || "Das Tier konnte nicht archiviert werden.";
        status.classList.add("pet-save-status--error");
      }
      button.disabled = false;
    } finally {
      this._petSubmissions.delete(petId);
    }
  }

  _captureFeedProfileDraft(form) {
    const value = (field) => form.querySelector(`[data-feed-profile-field="${field}"]`)?.value ?? "";
    return {
      pet_id: value("pet_id"),
      product: value("product"),
      package_unit: value("package_unit"),
      expected_cost: value("expected_cost"),
      expected_cost_input: value("expected_cost"),
      interval_weeks: value("interval_weeks"),
      last_purchase_date: value("last_purchase_date"),
      due_soon_days: value("due_soon_days") === "" ? 14 : Number(value("due_soon_days")),
      active: Boolean(form.querySelector("[data-feed-profile-field='active']")?.checked),
    };
  }

  _updateFeedProfileDraft(event) {
    const form = event.currentTarget.closest("[data-feed-profile-form]");
    if (!form) return;
    const profileId = String(form.dataset.feedProfileId);
    this._feedProfileDrafts.set(profileId, this._captureFeedProfileDraft(form));
    this._feedProfileErrors.delete(profileId);
    const status = form.querySelector("[data-feed-profile-save-status]");
    status?.classList.remove("feed-profile-save-status--error");
    if (status) status.textContent = "";
  }

  _feedProfilePayload(draft) {
    const optional = (value) => String(value ?? "").trim() || null;
    return {
      pet_id: optional(draft.pet_id),
      product: draft.product,
      package_unit: draft.package_unit,
      expected_cost: String(draft.expected_cost_input ?? draft.expected_cost ?? "").trim(),
      interval_weeks: optional(draft.interval_weeks),
      last_purchase_date: optional(draft.last_purchase_date),
      due_soon_days: Number(draft.due_soon_days),
      active: draft.active !== false,
    };
  }

  async _handleFeedProfileSave(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const profileId = String(form.dataset.feedProfileId);
    if (this._feedProfileSubmissions.has(profileId)) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const draft = this._captureFeedProfileDraft(form);
    this._feedProfileDrafts.set(profileId, draft);
    const button = form.querySelector("[type='submit']");
    const status = form.querySelector("[data-feed-profile-save-status]");
    this._feedProfileSubmissions.add(profileId);
    form.setAttribute("aria-busy", "true");
    if (button) button.disabled = true;
    if (status) status.textContent = "Futterprofil wird gespeichert …";
    const url = profileId === "new"
      ? FEED_PROFILES_URL
      : `${FEED_PROFILES_URL}/${encodeURIComponent(profileId)}`;
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this._feedProfilePayload(draft)),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Das Futterprofil konnte nicht gespeichert werden."));
      this._feedProfileDrafts.delete(profileId);
      this._feedProfileErrors.delete(profileId);
      this._message = profileId === "new" ? "Futterprofil angelegt." : "Futterprofil gespeichert.";
      await this._loadFeedProfiles();
      this._render();
    } catch (error) {
      this._feedProfileErrors.set(profileId, error.message || "Das Futterprofil konnte nicht gespeichert werden.");
      if (status) {
        status.textContent = this._feedProfileErrors.get(profileId);
        status.classList.add("feed-profile-save-status--error");
      }
      if (button) button.disabled = false;
      form.removeAttribute("aria-busy");
    } finally {
      this._feedProfileSubmissions.delete(profileId);
    }
  }

  async _archiveFeedProfile(event) {
    const button = event.currentTarget;
    const profileId = String(button.dataset.feedProfileId);
    const profile = this._feedProfiles.find((candidate) => String(candidate.id) === profileId);
    if (!profile || !window.confirm(`„${profile.product || "Futterprofil"}“ archivieren?`)) return;
    if (this._feedProfileSubmissions.has(profileId)) return;
    const form = button.closest("[data-feed-profile-form]");
    const status = form?.querySelector("[data-feed-profile-save-status]");
    this._feedProfileSubmissions.add(profileId);
    button.disabled = true;
    if (status) status.textContent = "Futterprofil wird archiviert …";
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${FEED_PROFILES_URL}/${encodeURIComponent(profileId)}`, { method: "DELETE" });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Das Futterprofil konnte nicht archiviert werden."));
      this._feedProfileDrafts.delete(profileId);
      this._message = "Futterprofil archiviert. Die Kaufhistorie bleibt erhalten.";
      await this._loadFeedProfiles();
      this._render();
    } catch (error) {
      if (status) {
        status.textContent = error.message || "Das Futterprofil konnte nicht archiviert werden.";
        status.classList.add("feed-profile-save-status--error");
      }
      button.disabled = false;
    } finally {
      this._feedProfileSubmissions.delete(profileId);
    }
  }

  _todayIsoDate() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  async _confirmFeedPurchase(event) {
    const button = event.currentTarget;
    const profileId = String(button.dataset.feedProfileId);
    const profile = this._feedProfiles.find((candidate) => String(candidate.id) === profileId);
    if (!profile || !window.confirm(`„${profile.product || "Futter"}“ für ${profile.pet_name || "das Tier"} als gekauft markieren?`)) return;
    if (this._feedProfileSubmissions.has(profileId)) return;
    const form = button.closest("[data-feed-profile-form]");
    const status = form?.querySelector("[data-feed-profile-save-status]");
    this._feedProfileSubmissions.add(profileId);
    button.disabled = true;
    if (status) status.textContent = "Kauf wird bestätigt …";
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${FEED_PROFILES_URL}/${encodeURIComponent(profileId)}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_date: this._todayIsoDate() }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Der Kauf konnte nicht bestätigt werden."));
      this._message = "Kauf bestätigt. Die nächste Futterprognose wurde neu berechnet.";
      await this._loadFeedProfiles();
      this._render();
    } catch (error) {
      if (status) {
        status.textContent = error.message || "Der Kauf konnte nicht bestätigt werden.";
        status.classList.add("feed-profile-save-status--error");
      }
      button.disabled = false;
    } finally {
      this._feedProfileSubmissions.delete(profileId);
    }
  }

  async _handleAccountSave(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const accountId = String(form.dataset.accountId);
    const button = form.querySelector("[type='submit']");
    const status = form.querySelector("[data-account-save-status]");
    const draft = this._captureAccountDraft(form);
    const payload = this._accountUpdatePayload(draft);
    this._accountDrafts.set(accountId, draft);
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
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Das Konto konnte nicht gespeichert werden."));
      if (status) status.textContent = "Konto gespeichert. Kontenliste wird aktualisiert …";
      const accountsResponse = await fetchWithHomeAssistantAuth(this._hass, ACCOUNTS_URL);
      const accountsResult = await readApiResponse(accountsResponse);
      if (!accountsResponse.ok) {
        throw new Error(apiErrorMessage(accountsResult, "Das Konto wurde gespeichert, konnte aber nicht neu geladen werden."));
      }
      this._accounts = accountsResult.accounts || [];
      const savedAccount = this._accounts.find((account) => String(account.id) === accountId);
      this._accountDrafts.delete(accountId);
      if (savedAccount) {
        this._accountDrafts.set(accountId, {
          label: savedAccount.label || "",
          bank: savedAccount.bank || "",
          iban: "",
          owner_targets: Array.isArray(savedAccount.owner_targets) ? [...savedAccount.owner_targets] : [],
          active: savedAccount.active !== false,
        });
      }
      this._message = `${payload.label.trim() || "Konto"} wurde gespeichert.`;
      this._render();
    } catch (error) {
      if (status) status.textContent = error.message || "Das Konto konnte nicht gespeichert werden.";
      if (button) button.disabled = false;
    }
  }

  _captureAccountDraft(form) {
    return {
      label: form.querySelector("[data-account-label]")?.value || "",
      bank: form.querySelector("[data-account-bank]")?.value || "",
      iban: form.querySelector("[data-account-iban]")?.value || "",
      owner_targets: [...form.querySelectorAll("[data-account-owners] option:checked")].map((option) => option.value),
      active: Boolean(form.querySelector("[data-account-active]")?.checked),
    };
  }

  _accountUpdatePayload(draft) {
    const payload = {
      label: draft.label,
      bank: draft.bank.trim(),
      owner_targets: [...draft.owner_targets],
      active: draft.active,
    };
    if (draft.iban.trim()) payload.iban = draft.iban.trim();
    return payload;
  }

  _updateAccountDraft(event) {
    const form = event.currentTarget.closest("[data-account-form]");
    if (form) this._accountDrafts.set(String(form.dataset.accountId), this._captureAccountDraft(form));
  }

  _updateAccountOwnerStatus(event) {
    const select = event.currentTarget;
    const status = select.closest("form")?.querySelector("[data-account-owner-status]");
    if (!status) return;
    const ownerTargets = [...select.selectedOptions].map((option) => option.value);
    status.textContent = accountOwnerStatus(ownerTargets);
    status.classList.toggle("account-owner-status--missing", !ownerTargets.length);
  }

  _updateAccountActiveStatus(event) {
    const input = event.currentTarget;
    const status = input.closest("form")?.querySelector("[data-account-active-status]");
    if (!status) return;
    status.textContent = accountActiveStatus(input.checked);
    status.classList.toggle("account-active-status--archived", !input.checked);
  }

  _allocationForm(bookingId) {
    return [...this.shadowRoot.querySelectorAll("[data-assignment-form]")]
      .find((form) => form.dataset.bookingId === String(bookingId));
  }

  _updateAllocationSummary(form) {
    if (!form) return;
    const rows = this._allocationDrafts.get(form.dataset.bookingId) || [];
    const total = Number(form.dataset.bookingTotal) || 0;
    const submitState = allocationSubmitState(total, rows, this._allocationSubmissions.has(form.dataset.bookingId));
    const { remaining } = submitState;
    const allocated = submitState.invalidAmount ? null : allocationRemaining(total, [{ amount: remaining }]);
    const remainingNode = form.querySelector("[data-allocation-remaining]");
    const allocatedNode = form.querySelector("[data-allocation-allocated]");
    const submit = form.querySelector("[type='submit']");
    if (allocatedNode) allocatedNode.textContent = allocated === null ? "—" : formatEuro(allocated);
    if (remainingNode) {
      remainingNode.textContent = submitState.invalidAmount ? "—" : formatEuro(remaining);
      remainingNode.classList.toggle("allocation-summary--open", submitState.invalidAmount || remaining !== 0);
    }
    if (submit) {
      submit.disabled = submitState.disabled;
    }
  }

  _updateAllocationField(event) {
    const input = event.currentTarget;
    const form = input.closest("[data-assignment-form]");
    const rows = this._allocationDrafts.get(form?.dataset.bookingId);
    const index = Number(input.dataset.allocationIndex);
    if (!form || !rows?.[index]) return;
    const field = input.dataset.allocationField;
    const catalogKind = { category: "categories", area: "areas", project: "projects" }[field];
    let updatedRows = updateAllocationDraftRow(
      rows,
      index,
      catalogKind ? `${field}_id` : field,
      input.value,
    );
    if (catalogKind && updatedRows[index]) {
      updatedRows[index][field] = input.selectedOptions?.[0]?.dataset.catalogLabel || null;
    }
    this._allocationDrafts.set(form.dataset.bookingId, updatedRows);
    this._allocationErrors.delete(form.dataset.bookingId);
    const status = form.querySelector("[data-allocation-status]");
    if (status) status.textContent = "";
    this._updateAllocationSummary(form);
  }

  _addAllocationRow(event) {
    const form = event.currentTarget.closest("[data-assignment-form]");
    if (!form) return;
    const bookingId = form.dataset.bookingId;
    const redistributed = addAllocationDraftRow(
      Number(form.dataset.bookingTotal) || 0,
      this._allocationDrafts.get(bookingId) || [],
    );
    this._allocationDrafts.set(bookingId, redistributed);
    this._allocationErrors.delete(bookingId);
    this._render();
    const updatedForm = this._allocationForm(bookingId);
    this._updateAllocationSummary(updatedForm);
    const status = updatedForm?.querySelector("[data-allocation-status]");
    if (status) status.textContent = "Zeile hinzugefügt. Die Beträge wurden gleichmäßig verteilt.";
    updatedForm?.querySelector(`[data-allocation-index="${redistributed.length - 1}"][data-allocation-field="target"]`)?.focus();
  }

  _removeAllocationRow(event) {
    const form = event.currentTarget.closest("[data-assignment-form]");
    if (!form) return;
    const bookingId = form.dataset.bookingId;
    const index = Number(event.currentTarget.dataset.allocationIndex);
    const rows = removeAllocationDraftRow(this._allocationDrafts.get(bookingId) || [], index);
    this._allocationDrafts.set(bookingId, rows);
    this._allocationErrors.delete(bookingId);
    this._render();
    const updatedForm = this._allocationForm(bookingId);
    this._updateAllocationSummary(updatedForm);
    const status = updatedForm?.querySelector("[data-allocation-status]");
    if (status) status.textContent = "Zeile entfernt. Prüfe den verbleibenden Betrag.";
    const focusIndex = Math.min(index, rows.length - 1);
    (focusIndex >= 0
      ? updatedForm?.querySelector(`[data-allocation-index="${focusIndex}"][data-allocation-remove]`)
      : updatedForm?.querySelector("[data-allocation-add]"))?.focus();
  }

  async _handleAssignment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const bookingId = String(form.dataset.bookingId);
    if (this._allocationSubmissions.has(bookingId)) return;
    const rows = this._allocationDrafts.get(bookingId) || [];
    const total = Number(form.dataset.bookingTotal) || 0;
    const submitState = allocationSubmitState(total, rows);
    const { remaining } = submitState;
    const status = form.querySelector("[data-allocation-status]");
    if (submitState.disabled) {
      if (status) status.textContent = submitState.invalidAmount
        ? "Bitte verwende Beträge mit höchstens zwei Nachkommastellen."
        : "Bitte wähle für jede Zeile ein Ziel und gleiche den verbleibenden Betrag centgenau aus.";
      this._updateAllocationSummary(form);
      return;
    }
    const allocations = rows.map((row) => ({
      target: row.target,
      amount: row.amount,
      area: row.area || null,
      area_id: row.area_id || null,
      category: row.category || null,
      category_id: row.category_id || null,
      project: row.project || null,
      project_id: row.project_id || null,
      pet_id: row.pet_id || null,
    }));
    this._allocationSubmissions.add(bookingId);
    form.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Aufteilung wird gespeichert …";
    this._updateAllocationSummary(form);
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${BOOKINGS_URL}/${encodeURIComponent(form.dataset.bookingId)}/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(allocationErrorMessage(response, result));
    } catch (error) {
      this._allocationSubmissions.delete(bookingId);
      this._allocationErrors.set(bookingId, error.message || "Die Aufteilung konnte nicht gespeichert werden. Bitte versuche es erneut.");
      form.removeAttribute("aria-busy");
      if (status) status.textContent = this._allocationErrors.get(bookingId);
      this._updateAllocationSummary(form);
      return;
    }
    this._allocationSubmissions.delete(bookingId);
    this._allocationErrors.delete(bookingId);
    this._allocationDrafts.delete(bookingId);
    this._bookings = this._bookings.filter((booking) => String(booking.id) !== bookingId);
    this._message = "Buchung zugeordnet und aus der Prüfliste entfernt.";
    this._render();
    let reviewRefreshFailed = false;
    try {
      await this._loadReviewData();
    } catch {
      reviewRefreshFailed = true;
    }
    await this._loadOverview();
    this._message = reviewRefreshFailed
      ? "Buchung gespeichert. Die Prüfliste konnte danach nicht neu geladen werden."
      : "Buchung zugeordnet und aus der Prüfliste entfernt.";
    this._render();
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
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Import fehlgeschlagen"));
      const feedback = `${result.format}: ${result.accepted} Buchungen übernommen, ${result.duplicates} Duplikate übersprungen; ${result.new_accounts || 0} neue Konten, ${result.unconfigured_accounts || 0} ohne konfigurierte Inhaber.`;
      await this._loadOverview();
      await this._openReview();
      this._message = feedback;
      this._render();
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
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Excel-Import fehlgeschlagen"));
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
    const catalogField = { category: "categories", area: "areas", project: "projects" }[input.dataset.field];
    suggestion[input.dataset.field] = catalogField
      ? (input.selectedOptions?.[0]?.dataset.catalogLabel || null)
      : (input.value || null);
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
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Excel-Import konnte nicht bestätigt werden"));
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
      : this._view === "plan_items"
        ? this._planItemsTemplate()
      : this._view === "pets"
          ? this._petsTemplate()
      : this._view === "feed_profiles"
            ? this._feedProfilesTemplate()
            : this._view === "catalogs"
              ? this._catalogsTemplate()
            : this._view === "accounts"
              ? this._accountsTemplate()
              : this._overviewTemplate();
    this.shadowRoot.innerHTML = `<style>${styles}</style>${template}`;
    this._bindEvents();
  }

  _bindEvents() {
    this.shadowRoot.querySelector("[data-skip-link]")?.addEventListener("click", (event) => {
      event.preventDefault();
      this.shadowRoot.querySelector("#content")?.focus();
    });
    this.shadowRoot.querySelector("[data-action='previous-month']")?.addEventListener("click", () => this._shiftMonth(-1));
    this.shadowRoot.querySelector("[data-action='next-month']")?.addEventListener("click", () => this._shiftMonth(1));
    this.shadowRoot.querySelectorAll("[data-action='review']").forEach((button) => button.addEventListener("click", () => this._openReview()));
    this.shadowRoot.querySelector("[data-action='accounts']")?.addEventListener("click", () => this._openAccounts());
    this.shadowRoot.querySelector("[data-action='back']")?.addEventListener("click", () => { this._view = "overview"; this._render(); this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true }); });
    this.shadowRoot.querySelector("[data-import]")?.addEventListener("change", (event) => this._handleImport(event));
    this.shadowRoot.querySelector("[data-excel-confirm]")?.addEventListener("click", () => this._confirmExcelImport());
    this.shadowRoot.querySelector("[data-excel-discard]")?.addEventListener("click", () => this._discardExcelPreview());
    this.shadowRoot.querySelectorAll("[data-excel-select]").forEach((input) => input.addEventListener("change", (event) => this._updateExcelSelection(event)));
    this.shadowRoot.querySelectorAll("[data-excel-field]").forEach((input) => input.addEventListener("change", (event) => this._updateExcelField(event)));
    this.shadowRoot.querySelectorAll("[data-assignment-form]").forEach((form) => form.addEventListener("submit", (event) => this._handleAssignment(event)));
    this.shadowRoot.querySelectorAll("[data-allocation-field]").forEach((input) => {
      input.addEventListener("input", (event) => this._updateAllocationField(event));
      input.addEventListener("change", (event) => this._updateAllocationField(event));
    });
    this.shadowRoot.querySelectorAll("[data-allocation-add]").forEach((button) => button.addEventListener("click", (event) => this._addAllocationRow(event)));
    this.shadowRoot.querySelectorAll("[data-allocation-remove]").forEach((button) => button.addEventListener("click", (event) => this._removeAllocationRow(event)));
    this.shadowRoot.querySelectorAll("[data-account-form]").forEach((form) => form.addEventListener("submit", (event) => this._handleAccountSave(event)));
    this.shadowRoot.querySelectorAll("[data-account-label], [data-account-bank], [data-account-iban]").forEach((input) => input.addEventListener("input", (event) => this._updateAccountDraft(event)));
    this.shadowRoot.querySelectorAll("[data-account-owners]").forEach((select) => select.addEventListener("change", (event) => { this._updateAccountDraft(event); this._updateAccountOwnerStatus(event); }));
    this.shadowRoot.querySelectorAll("[data-account-active]").forEach((input) => input.addEventListener("change", (event) => { this._updateAccountDraft(event); this._updateAccountActiveStatus(event); }));
    this.shadowRoot.querySelectorAll("[data-pet-form]").forEach((form) => form.addEventListener("submit", (event) => this._handlePetSave(event)));
    this.shadowRoot.querySelectorAll("[data-pet-field]").forEach((input) => {
      input.addEventListener("input", (event) => this._updatePetDraft(event));
      input.addEventListener("change", (event) => this._updatePetDraft(event));
    });
    this.shadowRoot.querySelectorAll("[data-pet-archive]").forEach((button) => button.addEventListener("click", (event) => this._archivePet(event)));
    this.shadowRoot.querySelectorAll("[data-feed-profile-form]").forEach((form) => form.addEventListener("submit", (event) => this._handleFeedProfileSave(event)));
    this.shadowRoot.querySelectorAll("[data-feed-profile-field]").forEach((input) => {
      input.addEventListener("input", (event) => this._updateFeedProfileDraft(event));
      input.addEventListener("change", (event) => this._updateFeedProfileDraft(event));
    });
    this.shadowRoot.querySelectorAll("[data-feed-profile-archive]").forEach((button) => button.addEventListener("click", (event) => this._archiveFeedProfile(event)));
    this.shadowRoot.querySelectorAll("[data-feed-profile-purchase]").forEach((button) => button.addEventListener("click", (event) => this._confirmFeedPurchase(event)));
    this.shadowRoot.querySelectorAll("[data-catalog-form]").forEach((form) => form.addEventListener("submit", (event) => this._handleCatalogSave(event)));
    this.shadowRoot.querySelectorAll("[data-catalog-field]").forEach((input) => {
      input.addEventListener("input", (event) => this._updateCatalogDraft(event));
      input.addEventListener("change", (event) => this._updateCatalogDraft(event));
    });
    this.shadowRoot.querySelectorAll("[data-catalog-archive]").forEach((button) => button.addEventListener("click", (event) => this._archiveCatalog(event)));
    this.shadowRoot.querySelectorAll("[data-plan-item-form]").forEach((form) => form.addEventListener("submit", (event) => this._handlePlanItemSave(event)));
    this.shadowRoot.querySelectorAll("[data-plan-item-field]").forEach((input) => {
      input.addEventListener("input", (event) => this._updatePlanItemDraft(event));
      input.addEventListener("change", (event) => this._updatePlanItemDraft(event));
    });
    this.shadowRoot.querySelectorAll("[data-plan-item-archive]").forEach((button) => button.addEventListener("click", (event) => this._archivePlanItem(event)));
    this.shadowRoot.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.nav === "review") this._openReview();
      else if (button.dataset.nav === "plan_items") this._openPlanItems();
      else if (button.dataset.nav === "accounts") this._openAccounts();
      else if (button.dataset.nav === "pets") this._openPets();
      else if (button.dataset.nav === "feed_profiles") this._openFeedProfiles();
      else if (button.dataset.nav === "catalogs") this._openCatalogs();
      else if (button.dataset.nav === "overview") this._view = "overview";
      else this._message = `${button.textContent.trim()} ist für die nächste Ausbaustufe vorbereitet.`;
      if (!["review", "accounts", "pets", "feed_profiles", "catalogs", "plan_items"].includes(button.dataset.nav)) this._render();
    }));
  }

  _navTemplate() {
    const items = [
      ["overview", "overview", "Übersicht"],
      ["energy", "energy", "Energie"],
      ["planner", "planner", "Planposten"],
      ["calendar", "calendar", "Kalender"],
      ["tasks", "tasks", "Aufgaben"],
      ["household", "household", "Haushalt"],
      ["people", "people", "Personen"],
      ["pets", "paw", "Tiere"],
      ["feed_profiles", "cart", "Futter"],
      ["catalogs", "tags", "Stammdaten"],
      ["accounts", "settings", "Konten"],
    ];
    return items.map(([id, iconName, label]) => {
      const target = id === "planner" ? "plan_items" : id;
      const current = (this._view === "plan_items" && id === "planner") || this._view === id;
      return `<button class="nav-item" data-nav="${target}"${current ? ' aria-current="page"' : ""} type="button">${icon(iconName, 22)}<span>${label}</span></button>`;
    }).join("");
  }

  _shellTemplate(content) {
    return `<div class="app-shell">
      <a class="skip-link visually-hidden" href="#content" data-skip-link>Zum Inhalt springen</a>
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
        <button class="icon-button" type="button" data-action="accounts" aria-label="Konten verwalten">${icon("settings", 21)}</button>
      </div>
    </header>`;
  }

  _overviewTemplate() {
    const data = dataWithDefaults(this._data);
    const variance = Number(data.variance || 0);
    const household = data.household || demoHousehold;
    const last = data.last_unresolved;
    const content = `<main class="main" id="content" tabindex="-1">
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

  _planItemFrequencyOptions(selectedFrequency) {
    return [
      ["", "Einmalig"],
      [1, "Monatlich"],
      [2, "Alle 2 Monate"],
      [3, "Vierteljährlich"],
      [6, "Halbjährlich"],
      [12, "Jährlich"],
    ].map(([value, label]) => `<option value="${value}"${String(selectedFrequency ?? "") === String(value) ? " selected" : ""}>${label}</option>`).join("");
  }

  _planItemTargetOptions(selectedTarget) {
    const targets = [
      ["", "Kein festes Ziel"],
      ["household", "Haushalt"],
      ...this._persons.map((person) => [person.entity_id, person.name || person.entity_id]),
    ];
    if (selectedTarget && !targets.some(([value]) => value === selectedTarget)) {
      targets.splice(2, 0, [selectedTarget, `Nicht mehr verfügbar: ${selectedTarget}`]);
    }
    return targets.map(([value, label]) => `<option value="${escapeHtml(value)}"${String(selectedTarget || "") === String(value) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }

  _petOptions(selectedPetId, { includeEmpty = true } = {}) {
    const options = includeEmpty ? [`<option value=""${selectedPetId ? "" : " selected"}>Kein Tier</option>`] : [];
    const pets = [...this._pets];
    if (selectedPetId && !pets.some((pet) => String(pet.id) === String(selectedPetId))) {
      pets.push({ id: selectedPetId, name: `Nicht mehr verfügbar: ${selectedPetId}`, active: false });
    }
    options.push(...pets.filter((pet) => pet.active !== false || String(pet.id) === String(selectedPetId)).map((pet) => {
      const label = pet.active === false ? `${pet.name || pet.id} (archiviert)` : (pet.name || pet.id);
      return `<option value="${escapeHtml(pet.id)}"${String(selectedPetId || "") === String(pet.id) ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }));
    return options.join("");
  }

  _planItemFormTemplate(item, index, isNew = false) {
    const itemId = isNew ? "new" : String(item.id);
    const draft = this._planItemDrafts.get(itemId)
      || (isNew ? this._newPlanItemDraft() : this._planItemDraftFromItem(item));
    const active = draft.active !== false;
    const title = isNew ? "Neuen Planposten anlegen" : (draft.name || "Planposten");
    const source = !isNew && item.source_sheet
      ? `${item.source_sheet} · Zeile ${item.source_row || "?"}`
      : "Manuell angelegt";
    const action = isNew
      ? PLAN_ITEMS_URL
      : `${PLAN_ITEMS_URL}/${encodeURIComponent(itemId)}`;
    const idPart = `${isNew ? "new" : index}`;
    const fieldId = (field) => `plan-item-${field}-${idPart}`;
    const error = this._planItemErrors.get(itemId) || "";
    return `<form class="surface plan-item-card${active ? "" : " plan-item-card--archived"}" action="${escapeHtml(action)}" method="post" data-plan-item-form data-plan-item-id="${escapeHtml(itemId)}" aria-labelledby="${fieldId("heading")}"${this._planItemSubmissions.has(itemId) ? " aria-busy=\"true\"" : ""}>
      <div class="plan-item-card-header"><h3 id="${fieldId("heading")}">${escapeHtml(title)}</h3><span class="plan-item-status${active ? "" : " plan-item-status--archived"}">${planItemStatus(active)}</span><p>${escapeHtml(`${source} · ${planItemFrequencyLabel(draft.frequency_months)}`)}</p></div>
      <div class="plan-item-fields">
        <label class="plan-item-field plan-item-field--wide" for="${fieldId("name")}">Bezeichnung<input id="${fieldId("name")}" name="name" data-plan-item-field="name" type="text" value="${escapeHtml(draft.name || "")}" maxlength="120" autocomplete="off" required></label>
        <label class="plan-item-field" for="${fieldId("direction")}">Richtung<select id="${fieldId("direction")}" name="direction" data-plan-item-field="direction" required><option value="income"${draft.direction === "income" ? " selected" : ""}>Einnahme</option><option value="expense"${draft.direction === "expense" ? " selected" : ""}>Ausgabe</option><option value="saving"${draft.direction === "saving" ? " selected" : ""}>Rücklage</option></select></label>
        <label class="plan-item-field" for="${fieldId("amount")}">Betrag pro Zahlung<input id="${fieldId("amount")}" name="amount" data-plan-item-field="amount" type="text" inputmode="decimal" value="${escapeHtml(draft.amount_input ?? draft.amount ?? "")}" placeholder="z. B. 125,50" aria-describedby="${fieldId("amount-help")}" required><small id="${fieldId("amount-help")}">Positive Eurobeträge, maximal 2 Nachkommastellen</small></label>
        <label class="plan-item-field" for="${fieldId("category")}">Kategorie<select id="${fieldId("category")}" name="category_id" data-plan-item-field="category">${this._catalogOptions("categories", draft.category_id || draft.category, "Keine Kategorie")}</select></label>
        <label class="plan-item-field" for="${fieldId("area")}">Bereich<select id="${fieldId("area")}" name="area_id" data-plan-item-field="area">${this._catalogOptions("areas", draft.area_id || draft.area, "Kein Bereich")}</select></label>
        <label class="plan-item-field" for="${fieldId("project")}">Projekt<select id="${fieldId("project")}" name="project_id" data-plan-item-field="project">${this._catalogOptions("projects", draft.project_id || draft.project, "Kein Projekt")}</select></label>
        <label class="plan-item-field plan-item-target" for="${fieldId("target")}">Planungsziel<select id="${fieldId("target")}" name="target" data-plan-item-field="target">${this._planItemTargetOptions(draft.target)}</select></label>
        <label class="plan-item-field plan-item-target" for="${fieldId("pet_id")}">Tier (optional)<select id="${fieldId("pet_id")}" name="pet_id" data-plan-item-field="pet_id">${this._petOptions(draft.pet_id)}</select><small>Bleibt unabhängig von Person oder Haushalt erhalten.</small></label>
      </div>
      <fieldset class="plan-item-schedule"><legend>Rhythmus und Gültigkeit</legend>
        <label class="plan-item-field" for="${fieldId("frequency_months")}">Rhythmus<select id="${fieldId("frequency_months")}" name="frequency_months" data-plan-item-field="frequency_months">${this._planItemFrequencyOptions(draft.frequency_months)}</select></label>
        <label class="plan-item-field" for="${fieldId("due_day")}">Fälligkeitstag<input id="${fieldId("due_day")}" name="due_day" data-plan-item-field="due_day" type="number" inputmode="numeric" min="1" max="31" step="1" value="${escapeHtml(draft.due_day ?? "")}" placeholder="z. B. 1"><small>Bei wiederkehrenden Zahlungen</small></label>
        <label class="plan-item-field" for="${fieldId("due_date")}">Fälligkeitsdatum<input id="${fieldId("due_date")}" name="due_date" data-plan-item-field="due_date" type="date" value="${escapeHtml(draft.due_date || "")}"><small>Für einmalige Zahlungen</small></label>
        <label class="plan-item-field" for="${fieldId("start_date")}">Gültig ab<input id="${fieldId("start_date")}" name="start_date" data-plan-item-field="start_date" type="date" value="${escapeHtml(draft.start_date || "")}"></label>
        <label class="plan-item-field" for="${fieldId("end_date")}">Gültig bis<input id="${fieldId("end_date")}" name="end_date" data-plan-item-field="end_date" type="date" value="${escapeHtml(draft.end_date || "")}"></label>
      </fieldset>
      <div class="plan-item-card-actions"><label class="account-toggle" for="${fieldId("active")}"><input id="${fieldId("active")}" name="active" data-plan-item-field="active" type="checkbox"${active ? " checked" : ""}>Planposten aktiv</label><p class="plan-item-save-status${error ? " plan-item-save-status--error" : ""}" data-plan-item-save-status aria-live="polite">${escapeHtml(error)}</p>${!isNew && active ? `<button class="plan-item-archive" type="button" data-plan-item-archive data-plan-item-id="${escapeHtml(itemId)}">Archivieren</button>` : ""}<button class="plan-item-save" type="submit"${this._planItemSubmissions.has(itemId) ? " disabled" : ""}>${isNew ? "Planposten anlegen" : "Änderungen speichern"} ${icon("check", 17)}</button></div>
    </form>`;
  }

  _planItemsTemplate() {
    const list = this._planItemsLoading
      ? `<div class="empty-state">Planposten werden geladen …</div>`
      : this._planItemsLoadFailed
        ? `<div class="empty-state">Planposten stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : `<ul class="plan-item-list" aria-label="Planposten"><li>${this._planItemFormTemplate({}, 0, true)}</li>${this._planItems.map((item, index) => `<li>${this._planItemFormTemplate(item, index + 1)}</li>`).join("")}</ul>`;
    const activeCount = this._planItems.filter((item) => item.active !== false).length;
    const content = `<main class="main" id="content" tabindex="-1"><div class="plan-items-view"><div class="plan-items-view-header"><div><h2>Planposten verwalten</h2><p>Ersetze deine Excel-Planung Schritt für Schritt: Betrag, Richtung, Rhythmus, Fälligkeit und fachliche Zuordnung bleiben direkt bearbeitbar.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div><p class="plan-item-help"><strong>${activeCount} aktive Planposten</strong> · Einnahmen werden positiv, Ausgaben und Rücklagen negativ in der Übersicht berücksichtigt. Archivierte Einträge bleiben erhalten und können wieder aktiviert werden.</p>${list}</div></main>`;
    return this._shellTemplate(content);
  }

  _petsTemplate() {
    const list = this._petsLoading
      ? `<div class="empty-state">Tiere werden geladen …</div>`
      : this._petsLoadFailed
        ? `<div class="empty-state">Tiere stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : `<ul class="pet-list" aria-label="Tiere"><li>${this._petFormTemplate({}, 0, true)}</li>${this._pets.map((pet, index) => `<li>${this._petFormTemplate(pet, index + 1)}</li>`).join("")}</ul>`;
    const activeCount = this._pets.filter((pet) => pet.active !== false).length;
    const content = `<main class="main" id="content" tabindex="-1"><div class="pets-view"><div class="pets-view-header"><div><h2>Tiere verwalten</h2><p>Verwalte eigene Tierprofile für Futter und andere Zuordnungen. Tiere sind keine Home-Assistant-Personen; historische Buchungen behalten ihren damaligen Namen.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div><p class="plan-item-help"><strong>${activeCount} aktive Tiere</strong> · Archivierte Profile bleiben für historische Zuordnungen auswählbar, aber nicht für neue Planposten.</p>${list}</div></main>`;
    return this._shellTemplate(content);
  }

  _feedProfilePetOptions(selectedPetId) {
    const options = [`<option value=""${selectedPetId ? "" : " selected"}>Tier auswählen</option>`];
    options.push(this._petOptions(selectedPetId, { includeEmpty: false }));
    return options.join("");
  }

  _feedProfileFormTemplate(profile, index, isNew = false) {
    const profileId = isNew ? "new" : String(profile.id);
    const draft = this._feedProfileDrafts.get(profileId)
      || (isNew ? this._newFeedProfileDraft() : this._feedProfileDraftFromProfile(profile));
    const active = draft.active !== false;
    const title = isNew
      ? "Neues Futterprofil anlegen"
      : `${draft.product || "Futterprofil"} · ${profile.pet_name || "Tier"}`;
    const fieldId = (field) => `feed-profile-${field}-${isNew ? "new" : index}`;
    const error = this._feedProfileErrors.get(profileId) || "";
    const action = isNew
      ? FEED_PROFILES_URL
      : `${FEED_PROFILES_URL}/${encodeURIComponent(profileId)}`;
    const status = isNew || !profile.status
      ? "planned"
      : profile.status;
    const interval = profile.effective_interval_weeks;
    const intervalText = interval ? `${Number(interval).toLocaleString("de-DE", { maximumFractionDigits: 2 })} Wochen` : "Noch offen";
    const forecast = !isNew ? `<section class="feed-profile-forecast" aria-label="Futterprognose">
      <dl><div><dt>Nächster Kauf</dt><dd>${formatDate(profile.next_purchase_date)}</dd></div><div><dt>Erwarteter Betrag</dt><dd>${formatEuro(profile.expected_cost)}</dd></div><div><dt>Wirksames Intervall</dt><dd>${intervalText}</dd></div><div><dt>Berechnungsgrund</dt><dd>${escapeHtml(feedSourceLabel(profile.interval_source))}</dd></div></dl>
    </section>` : `<p class="feed-profile-help">Nach dem Speichern erscheint hier der nächste voraussichtliche Kauf. Ein manueller Wert bleibt gegenüber dem Durchschnitt bestätigter Käufe führend.</p>`;
    return `<form class="surface feed-profile-card${active ? "" : " feed-profile-card--archived"}" action="${escapeHtml(action)}" method="post" data-feed-profile-form data-feed-profile-id="${escapeHtml(profileId)}" aria-labelledby="${fieldId("heading")}"${this._feedProfileSubmissions.has(profileId) ? " aria-busy=\"true\"" : ""}>
      <div class="feed-profile-card-header"><div><h3 id="${fieldId("heading")}">${escapeHtml(title)}</h3><p>${isNew ? "Manuell angelegt" : `${escapeHtml(profile.pet_name || "Tier")} · ${escapeHtml(profile.package_unit || "Verpackung")}`}</p></div><span class="feed-status feed-status--${escapeHtml(active ? status : "archived")}">${escapeHtml(active ? feedStatusLabel(status) : "Archiviert")}</span></div>
      <div class="feed-profile-fields">
        <label class="feed-profile-field" for="${fieldId("pet_id")}">Tier<select id="${fieldId("pet_id")}" name="pet_id" data-feed-profile-field="pet_id" required>${this._feedProfilePetOptions(draft.pet_id)}</select></label>
        <label class="feed-profile-field" for="${fieldId("product")}">Futter / Produkt<input id="${fieldId("product")}" name="product" data-feed-profile-field="product" type="text" value="${escapeHtml(draft.product || "")}" maxlength="120" autocomplete="off" required></label>
        <label class="feed-profile-field" for="${fieldId("package_unit")}">Verpackungseinheit<input id="${fieldId("package_unit")}" name="package_unit" data-feed-profile-field="package_unit" type="text" value="${escapeHtml(draft.package_unit || "")}" maxlength="80" autocomplete="off" placeholder="z. B. 1 Sack" required></label>
        <label class="feed-profile-field" for="${fieldId("expected_cost")}">Kosten pro Kauf<input id="${fieldId("expected_cost")}" name="expected_cost" data-feed-profile-field="expected_cost" type="text" inputmode="decimal" value="${escapeHtml(draft.expected_cost_input ?? draft.expected_cost ?? "")}" placeholder="z. B. 42,50" aria-describedby="${fieldId("cost-help")}" required><small id="${fieldId("cost-help")}">Positive Eurobeträge</small></label>
        <label class="feed-profile-field" for="${fieldId("interval_weeks")}">Intervall in Wochen<input id="${fieldId("interval_weeks")}" name="interval_weeks" data-feed-profile-field="interval_weeks" type="number" inputmode="decimal" min="0.01" max="520" step="0.01" value="${escapeHtml(draft.interval_weeks ?? "")}" placeholder="optional"><small>Leer = Durchschnitt aus Käufen</small></label>
        <label class="feed-profile-field" for="${fieldId("last_purchase_date")}">Letzter bestätigter Kauf<input id="${fieldId("last_purchase_date")}" name="last_purchase_date" data-feed-profile-field="last_purchase_date" type="date" value="${escapeHtml(draft.last_purchase_date || "")}"><small>Startpunkt der nächsten Schätzung</small></label>
        <label class="feed-profile-field" for="${fieldId("due_soon_days")}">Vorwarnung in Tagen<input id="${fieldId("due_soon_days")}" name="due_soon_days" data-feed-profile-field="due_soon_days" type="number" inputmode="numeric" min="0" max="90" step="1" value="${escapeHtml(draft.due_soon_days ?? 14)}"><small>0 = nur am Fälligkeitstag</small></label>
      </div>
      ${forecast}
      <div class="feed-profile-card-actions"><label class="account-toggle" for="${fieldId("active")}"><input id="${fieldId("active")}" name="active" data-feed-profile-field="active" type="checkbox"${active ? " checked" : ""}>Futterprofil aktiv</label><p class="feed-profile-save-status${error ? " feed-profile-save-status--error" : ""}" data-feed-profile-save-status aria-live="polite">${escapeHtml(error)}</p>${!isNew && active ? `<button class="feed-profile-purchase" type="button" data-feed-profile-purchase data-feed-profile-id="${escapeHtml(profileId)}">Kauf heute bestätigen</button><button class="feed-profile-archive" type="button" data-feed-profile-archive data-feed-profile-id="${escapeHtml(profileId)}">Archivieren</button>` : ""}<button class="feed-profile-save" type="submit"${this._feedProfileSubmissions.has(profileId) ? " disabled" : ""}>${isNew ? "Futterprofil anlegen" : "Änderungen speichern"} ${icon("check", 17)}</button></div>
    </form>`;
  }

  _feedProfilesTemplate() {
    const list = this._feedProfilesLoading
      ? `<div class="empty-state">Futterprofile werden geladen …</div>`
      : this._feedProfilesLoadFailed
        ? `<div class="empty-state">Futterprofile stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : `<ul class="feed-profile-list" aria-label="Futterprofile"><li>${this._feedProfileFormTemplate({}, 0, true)}</li>${this._feedProfiles.map((profile, index) => `<li>${this._feedProfileFormTemplate(profile, index + 1)}</li>`).join("")}</ul>`;
    const activeCount = this._feedProfiles.filter((profile) => profile.active !== false).length;
    const content = `<main class="main" id="content" tabindex="-1"><div class="feed-profiles-view"><div class="feed-profiles-view-header"><div><h2>Futter planen</h2><p>Hinterlege Verpackung, Kosten und Verbrauch pro Tier. Bestätigte Käufe verschieben die nächste Schätzung; es wird keine Buchung automatisch angelegt.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div><p class="plan-item-help"><strong>${activeCount} aktive Futterprofile</strong> · Ein manuelles Intervall überschreibt den Durchschnitt aus bestätigten Käufen. Das voraussichtliche Kaufdatum wird als einzelnes Ereignis in der Prognose berücksichtigt.</p>${list}</div></main>`;
    return this._shellTemplate(content);
  }

  _catalogEntryFormTemplate(kind, entry, index, isNew = false) {
    const entryId = isNew ? "new" : String(entry.id);
    const key = this._catalogKey(kind, entryId);
    const draft = this._catalogDrafts.get(key)
      || (isNew ? { label: "", active: true } : this._catalogDraftFromEntry(entry));
    const active = draft.active !== false;
    const fieldId = `catalog-${kind}-label-${isNew ? "new" : index}`;
    const statusId = `catalog-${kind}-status-${isNew ? "new" : index}`;
    const error = this._catalogErrors.get(key) || "";
    const action = isNew
      ? `${CATALOGS_URL}/${kind}`
      : `${CATALOGS_URL}/${kind}/${encodeURIComponent(entryId)}`;
    return `<form class="catalog-entry-form${active ? "" : " catalog-entry-form--archived"}" action="${escapeHtml(action)}" method="post" data-catalog-form data-catalog-kind="${escapeHtml(kind)}" data-catalog-id="${escapeHtml(entryId)}" aria-labelledby="${fieldId}-heading"${this._catalogSubmissions.has(key) ? " aria-busy=\"true\"" : ""}>
      <label class="catalog-field" for="${fieldId}"><span id="${fieldId}-heading">Bezeichnung</span><input id="${fieldId}" name="label" data-catalog-field="label" type="text" value="${escapeHtml(draft.label || "")}" maxlength="120" autocomplete="off" required></label>
      <div class="catalog-entry-actions"><label class="account-toggle" for="${fieldId}-active"><input id="${fieldId}-active" name="active" data-catalog-field="active" type="checkbox"${active ? " checked" : ""}>Aktiv</label>${!isNew && active ? `<button class="catalog-archive" type="button" data-catalog-archive data-catalog-kind="${escapeHtml(kind)}" data-catalog-id="${escapeHtml(entryId)}">Archivieren</button>` : ""}<button type="submit">${isNew ? "Anlegen" : "Speichern"}</button></div>
      <p class="catalog-entry-status${error ? " catalog-entry-status--error" : ""}" id="${statusId}" data-catalog-save-status aria-live="polite">${escapeHtml(error)}</p>
    </form>`;
  }

  _catalogsTemplate() {
    const kinds = ["categories", "areas", "projects"];
    const content = this._catalogsLoading
      ? `<main class="main" id="content" tabindex="-1"><div class="catalogs-view"><div class="empty-state">Stammdaten werden geladen …</div></div></main>`
      : this._catalogsLoadFailed
        ? `<main class="main" id="content" tabindex="-1"><div class="catalogs-view"><div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div><div class="empty-state">Stammdaten stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div></div></main>`
        : `<main class="main" id="content" tabindex="-1"><div class="catalogs-view"><div class="catalogs-view-header"><div><h2>Stammdaten</h2><p>Verwalte die Begriffe, mit denen du Planposten und Buchungen einheitlich ordnest. Beim Umbenennen werden bestehende Zuordnungen automatisch mitgeführt.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div><p class="catalog-help">Archivierte Einträge bleiben in historischen Buchungen sichtbar und können wieder aktiviert werden. Neue Freitextwerte aus Importen werden als Stammdaten ergänzt.</p><div class="catalogs-grid">${kinds.map((kind) => `<section class="surface catalog-section" aria-labelledby="catalog-${kind}-heading"><div class="catalog-section-header"><h3 id="catalog-${kind}-heading">${catalogKindLabel(kind)}</h3><span>${this._catalogEntries(kind).filter((entry) => entry.active !== false).length} aktiv</span></div><ul class="catalog-entry-list" aria-label="${catalogKindLabel(kind)}"><li>${this._catalogEntryFormTemplate(kind, {}, 0, true)}</li>${this._catalogEntries(kind).map((entry, index) => `<li>${this._catalogEntryFormTemplate(kind, entry, index + 1)}</li>`).join("")}</ul></section>`).join("")}</div></div></main>`;
    return this._shellTemplate(content);
  }

  _petFormTemplate(pet, index, isNew = false) {
    const petId = isNew ? "new" : String(pet.id);
    const draft = this._petDrafts.get(petId) || (isNew ? this._newPetDraft() : this._petDraftFromPet(pet));
    const active = draft.active !== false;
    const title = isNew ? "Neues Tier anlegen" : (draft.name || "Tier");
    const fieldId = (field) => `pet-${field}-${isNew ? "new" : index}`;
    const error = this._petErrors.get(petId) || "";
    const action = isNew ? PETS_URL : `${PETS_URL}/${encodeURIComponent(petId)}`;
    return `<form class="surface pet-card${active ? "" : " pet-card--archived"}" action="${escapeHtml(action)}" method="post" data-pet-form data-pet-id="${escapeHtml(petId)}" aria-labelledby="${fieldId("heading")}"${this._petSubmissions.has(petId) ? " aria-busy=\"true\"" : ""}>
      <div class="pet-card-header"><h3 id="${fieldId("heading")}">${escapeHtml(title)}</h3><span class="plan-item-status${active ? "" : " plan-item-status--archived"}">${planItemStatus(active)}</span><p>${isNew ? "Manuell angelegt" : "Tierprofil"}</p></div>
      <label class="pet-field" for="${fieldId("name")}">Name<input id="${fieldId("name")}" name="name" data-pet-field="name" type="text" value="${escapeHtml(draft.name || "")}" maxlength="80" autocomplete="off" required></label>
      <label class="pet-field" for="${fieldId("pet_type")}">Tier-Typ (optional)<input id="${fieldId("pet_type")}" name="pet_type" data-pet-field="pet_type" type="text" value="${escapeHtml(draft.pet_type || "")}" maxlength="60" autocomplete="off" placeholder="z. B. Hund, Katze"></label>
      <div class="pet-card-actions"><label class="account-toggle" for="${fieldId("active")}"><input id="${fieldId("active")}" name="active" data-pet-field="active" type="checkbox"${active ? " checked" : ""}>Tierprofil aktiv</label><p class="pet-save-status${error ? " pet-save-status--error" : ""}" data-pet-save-status aria-live="polite">${escapeHtml(error)}</p>${!isNew && active ? `<button class="pet-archive" type="button" data-pet-archive data-pet-id="${escapeHtml(petId)}">Archivieren</button>` : ""}<button class="pet-save" type="submit"${this._petSubmissions.has(petId) ? " disabled" : ""}>${isNew ? "Tier anlegen" : "Änderungen speichern"} ${icon("check", 17)}</button></div>
    </form>`;
  }

  _accountsTemplate() {
    const accountList = this._accountsLoading
      ? `<div class="empty-state">Konten werden geladen …</div>`
      : this._accountsLoadFailed
        ? `<div class="empty-state">Konten stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : this._accounts.length
      ? `<ul class="account-list" aria-label="Konten">${this._accounts.map((account, index) => {
        const accountId = String(account.id);
        const draft = this._accountDrafts.get(accountId) || {
          label: account.label || "",
          bank: account.bank || "",
          iban: "",
          owner_targets: Array.isArray(account.owner_targets) ? account.owner_targets : [],
          active: account.active !== false,
        };
        const ownerTargets = Array.isArray(draft.owner_targets) ? draft.owner_targets : [];
        const ownerStatus = accountOwnerStatus(ownerTargets);
        const labelId = `account-label-${index}`;
        const bankId = `account-bank-${index}`;
        const ibanId = `account-iban-${index}`;
        const ibanHintId = `account-iban-hint-${index}`;
        const ownersId = `account-owners-${index}`;
        const ownerStatusId = `account-owner-status-${index}`;
        const activeId = `account-active-${index}`;
        const saveStatusId = `account-save-status-${index}`;
        const accountLabel = draft.label || "Konto";
        const active = draft.active !== false;
        const maskedReference = account.iban_masked || account.account_reference || "Keine maskierte Kontoreferenz verfügbar";
        return `<li><form class="surface account-card" method="post" data-account-form data-account-id="${escapeHtml(account.id)}" aria-labelledby="account-heading-${index}">
          <div class="account-card-header"><h3 id="account-heading-${index}">${escapeHtml(accountLabel)}</h3><p class="account-reference">${escapeHtml(maskedReference)}</p></div>
          <label class="account-field" for="${labelId}">Kontoname<input id="${labelId}" name="label" data-account-label type="text" value="${escapeHtml(draft.label || "")}" autocomplete="off" required></label>
          <label class="account-field" for="${bankId}">Bank<input id="${bankId}" name="bank" data-account-bank type="text" value="${escapeHtml(draft.bank || "")}" autocomplete="organization" placeholder="z. B. Erste Bank"></label>
          <label class="account-field" for="${ibanId}">IBAN<input id="${ibanId}" name="iban" data-account-iban type="text" value="${escapeHtml(draft.iban || "")}" autocomplete="off" inputmode="text" aria-describedby="${ibanHintId}" placeholder="Nur zum Ändern eingeben"><small id="${ibanHintId}">${account.iban_masked ? `Gespeichert: ${escapeHtml(account.iban_masked)} · leer lassen, wenn sie unverändert bleiben soll.` : "Leer lassen, wenn noch keine IBAN hinterlegt werden soll."}</small></label>
          <fieldset class="account-owners"><legend>Kontoinhaber</legend><label class="visually-hidden" for="${ownersId}">Kontoinhaber für ${escapeHtml(accountLabel)} auswählen</label><select id="${ownersId}" name="owner_targets" data-account-owners multiple size="4" aria-describedby="${ownerStatusId}">${this._personOptions(ownerTargets)}</select><p class="account-owner-status${ownerTargets.length ? "" : " account-owner-status--missing"}" id="${ownerStatusId}" data-account-owner-status>${escapeHtml(ownerStatus)}</p></fieldset>
          <div class="account-toggle"><label for="${activeId}"><input id="${activeId}" name="active" data-account-active type="checkbox"${active ? " checked" : ""}>Konto aktiv <span class="visually-hidden">(deaktivieren archiviert das Konto)</span></label><span class="account-active-status${active ? "" : " account-active-status--archived"}" data-account-active-status aria-hidden="true">${accountActiveStatus(active)}</span></div>
          <div class="account-card-actions"><p class="account-save-status" id="${saveStatusId}" data-account-save-status aria-live="polite"></p><button class="account-save" type="submit" aria-label="Änderungen für ${escapeHtml(accountLabel)} (${escapeHtml(maskedReference)}) speichern" aria-describedby="${saveStatusId}">Änderungen speichern</button></div>
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
            <label class="excel-field">Kategorie<select data-excel-field data-field="category" data-suggestion-id="${escapeHtml(suggestion.id)}">${this._catalogOptions("categories", this._excelFieldValue(suggestion, "category"), "Keine Kategorie")}</select></label>
            <label class="excel-field">Bereich<select data-excel-field data-field="area" data-suggestion-id="${escapeHtml(suggestion.id)}">${this._catalogOptions("areas", this._excelFieldValue(suggestion, "area"), "Kein Bereich")}</select></label>
            <label class="excel-field">Projekt<select data-excel-field data-field="project" data-suggestion-id="${escapeHtml(suggestion.id)}">${this._catalogOptions("projects", this._excelFieldValue(suggestion, "project"), "Kein Projekt")}</select></label>
            <label class="excel-field">Personenhinweis<input data-excel-field data-field="person_hint" data-suggestion-id="${escapeHtml(suggestion.id)}" value="${escapeHtml(this._excelFieldValue(suggestion, "person_hint"))}"></label>
          </div>
        </div>
      </li>`).join("")}</ul>
      <div class="excel-actions"><button class="excel-discard" type="button" data-excel-discard>Vorschau verwerfen</button><button class="excel-confirm" type="button" data-excel-confirm${selected.count ? "" : " disabled"}>Planposten übernehmen ${icon("check", 17)}</button></div>
    </section>`;
  }

  _allocationTargetOptions(selectedTarget) {
    return [
      `<option value=""${selectedTarget ? "" : " selected"}>Ziel auswählen</option>`,
      `<option value="household"${selectedTarget === "household" ? " selected" : ""}>Haushalt</option>`,
      ...this._persons.map((person) => `<option value="${escapeHtml(person.entity_id)}"${selectedTarget === person.entity_id ? " selected" : ""}>${escapeHtml(person.name || person.entity_id)}</option>`),
    ].join("");
  }

  _allocationEditorTemplate(booking, bookingIndex) {
    const bookingId = String(booking.id);
    const rows = this._allocationDrafts.get(bookingId) || equalAllocationDraft(booking.amount, ["household"]);
    const total = Math.abs(Number(booking.amount) || 0);
    const submitState = allocationSubmitState(total, rows, this._allocationSubmissions.has(bookingId));
    const { remaining } = submitState;
    const allocated = submitState.invalidAmount ? null : allocationRemaining(total, [{ amount: remaining }]);
    const summaryId = `allocation-summary-${bookingIndex}`;
    const statusId = `allocation-status-${bookingIndex}`;
    const purpose = booking.purpose || booking.counterparty || "Buchung";
    const rowMarkup = rows.map((row, rowIndex) => {
      const targetId = `allocation-target-${bookingIndex}-${rowIndex}`;
      const amountId = `allocation-amount-${bookingIndex}-${rowIndex}`;
      const petId = `allocation-pet-${bookingIndex}-${rowIndex}`;
      const areaId = `allocation-area-${bookingIndex}-${rowIndex}`;
      const categoryId = `allocation-category-${bookingIndex}-${rowIndex}`;
      const projectId = `allocation-project-${bookingIndex}-${rowIndex}`;
      const amount = Number(row.amount);
      return `<li class="allocation-row">
        <label class="allocation-field" for="${targetId}">Ziel<select id="${targetId}" data-allocation-field="target" data-allocation-index="${rowIndex}" required>${this._allocationTargetOptions(row.target)}</select></label>
        <label class="allocation-field" for="${amountId}">Betrag in Euro<input id="${amountId}" data-allocation-field="amount" data-allocation-index="${rowIndex}" type="text" inputmode="decimal" value="${escapeHtml(row.amount_input ?? (Number.isFinite(amount) ? amount.toFixed(2) : ""))}" required></label>
        <label class="allocation-field allocation-pet" for="${petId}">Tier (optional)<select id="${petId}" data-allocation-field="pet_id" data-allocation-index="${rowIndex}">${this._petOptions(row.pet_id)}</select></label>
        <label class="allocation-field" for="${areaId}">Bereich<select id="${areaId}" data-allocation-field="area" data-allocation-index="${rowIndex}">${this._catalogOptions("areas", row.area_id || row.area, "Kein Bereich")}</select></label>
        <label class="allocation-field" for="${categoryId}">Kategorie (optional)<select id="${categoryId}" data-allocation-field="category" data-allocation-index="${rowIndex}">${this._catalogOptions("categories", row.category_id || row.category, "Keine Kategorie")}</select></label>
        <label class="allocation-field" for="${projectId}">Projekt (optional)<select id="${projectId}" data-allocation-field="project" data-allocation-index="${rowIndex}">${this._catalogOptions("projects", row.project_id || row.project, "Kein Projekt")}</select></label>
        <button class="allocation-remove" type="button" data-allocation-remove data-allocation-index="${rowIndex}" aria-label="Zeile ${rowIndex + 1} aus der Aufteilung für ${escapeHtml(purpose)} entfernen">Entfernen</button>
      </li>`;
    }).join("");
    return `<fieldset class="allocation-editor" aria-describedby="${summaryId} ${statusId}">
      <legend>Aufteilung</legend>
      <ul class="allocation-list" aria-label="Aufteilungszeilen">${rowMarkup}</ul>
      <p class="allocation-summary" id="${summaryId}" aria-live="polite"><span>Gesamt <strong>${formatEuro(total)}</strong></span><span>Zugeordnet <strong data-allocation-allocated>${allocated === null ? "—" : formatEuro(allocated)}</strong></span><span>Verbleibend <strong data-allocation-remaining class="${submitState.invalidAmount || remaining !== 0 ? "allocation-summary--open" : ""}">${submitState.invalidAmount ? "—" : formatEuro(remaining)}</strong></span></p>
      <div class="allocation-actions"><p class="allocation-status" id="${statusId}" data-allocation-status aria-live="polite">${escapeHtml(this._allocationErrors.get(bookingId) || "")}</p><button class="allocation-add" type="button" data-allocation-add aria-label="Zeile für ${escapeHtml(purpose)} hinzufügen">Zeile hinzufügen</button><button class="assign-button" type="submit" aria-label="Aufteilung für ${escapeHtml(purpose)} speichern"${submitState.disabled ? " disabled" : ""}>Aufteilung speichern ${icon("check", 17)}</button></div>
    </fieldset>`;
  }

  _reviewTemplate() {
    const content = `<main class="main" id="content" tabindex="-1"><div class="review-view"><div class="review-view-header"><div><h2>Ungeklärte Buchungen</h2><p>Ordne jede Buchung einer Person oder dem Haushalt zu und teile den Betrag bei Bedarf centgenau auf.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><div class="status-message" aria-live="polite">${escapeHtml(this._message)}</div><form class="import-strip"><div><h3>Bank- oder Exceldatei importieren</h3><p>MT940 oder CAMT.053 für Buchungen · .xlsx für Planposten, jeweils lokal geprüft.</p></div><label class="file-input">Datei auswählen<input data-import type="file" accept=".xlsx,.sta,.mt940,.txt,.xml,.camt,.camt053,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/xml,text/plain"></label></form>${this._excelPreview ? this._excelPreviewTemplate() : ""}${this._bookings.length ? `<ul class="booking-list" aria-label="Ungeklärte Buchungen">${this._bookings.map((booking, index) => {
      const total = Math.abs(Number(booking.amount) || 0);
      return `<li><form class="booking-row" data-assignment-form data-booking-id="${escapeHtml(booking.id)}" data-booking-total="${total}"><time class="booking-date" datetime="${escapeHtml(booking.booking_date)}">${formatDate(booking.booking_date)}</time><span class="booking-purpose">${escapeHtml(booking.purpose || booking.counterparty || "Ohne Verwendungszweck")}</span><span class="booking-account">${escapeHtml(booking.account || "Konto nicht bekannt")}</span><span class="booking-amount">${formatEuro(booking.amount)}</span>${this._allocationEditorTemplate(booking, index)}</form></li>`;
    }).join("")}</ul>` : `<div class="empty-state">Noch keine importierten Buchungen in der Prüfliste. Lade eine Bankdatei hoch oder importiere eine Excel-Vorlage.</div>`}</div></main>`;
    return this._shellTemplate(content);
  }
}

customElements.define("finanzplaner-panel", FinanzplanerPanel);
