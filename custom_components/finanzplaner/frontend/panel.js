import { acceptSuggestionDraft, accountActiveStatus, accountOwnerStatus, addAllocationDraftRow, allocationErrorMessage, allocationRemaining, allocationSubmitState, bookingDetailRawJson, bookingDetailsRequestUrl, bookingGroups, bookingHistoryRequestUrl, bookingSelectionState, breakdownRequestUrl, comparisonDimensionLabel, comparisonEntries, conflictRuleIds, equalAllocationDraft, fetchWithHomeAssistantAuth, formatEuro, homeAssistantPath, planItemFrequencyLabel, planItemStatus, readApiResponse, removeAllocationDraftRow, repairTargetsPayload, reportRequestUrl, resolvedBookingSourceLabel, rulePayloadFromForm, ruleStatusLabel, selectedSuggestionSummary, trendSummary, updateAllocationDraftRow } from "./panel-utils.mjs";

const OVERVIEW_URL = "/api/finanzplaner/overview";
const BREAKDOWN_URL = "/api/finanzplaner/overview/breakdown";
const PLAN_ITEMS_URL = "/api/finanzplaner/plan-items";
const ACCOUNTS_URL = "/api/finanzplaner/accounts";
const PETS_URL = "/api/finanzplaner/pets";
const FEED_PROFILES_URL = "/api/finanzplaner/feed-profiles";
const CATALOGS_URL = "/api/finanzplaner/catalogs";
const PERSONS_URL = "/api/finanzplaner/persons";
const REVIEW_URL = "/api/finanzplaner/bookings/unresolved";
const RESOLVED_URL = "/api/finanzplaner/bookings/resolved";
const APPLY_RULES_URL = "/api/finanzplaner/bookings/apply-rules";
const RULES_URL = "/api/finanzplaner/rules";
const BOOKINGS_URL = "/api/finanzplaner/bookings";
const IMPORTS_URL = "/api/finanzplaner/imports";
const REPORT_URL = "/api/finanzplaner/report";
const BOOKING_EXPORT_URL = "/api/finanzplaner/bookings/export";
const IMPORT_URL = "/api/finanzplaner/import";
const EXCEL_PREVIEW_URL = "/api/finanzplaner/excel/preview";
const EXCEL_CONFIRM_URL = "/api/finanzplaner/excel/confirm";
const PAPER_TEXTURE_PATH = "assets/plates/main-paper-sample.png";
const PAPER_TEXTURE_URL = new URL(PAPER_TEXTURE_PATH, import.meta.url).href;
const SECTION_VIEWS = ["energy", "calendar", "tasks", "household", "people"];
const SECTION_OVERVIEW_META = {
  energy: {
    title: "Energie",
    kicker: "Energie im Haushalt",
    description: "Behalte Strom- und Energieposten im Monatskontext und springe direkt in die Planung.",
  },
  calendar: {
    title: "Kalender",
    kicker: "Monatsrhythmus",
    description: "Lies den finanziellen Monatsverlauf an wenigen klaren Referenzpunkten.",
  },
  tasks: {
    title: "Aufgaben",
    kicker: "Nächste Entscheidungen",
    description: "Offene Buchungen und anstehende Futterkäufe an einem Ort bündeln.",
  },
  household: {
    title: "Haushalt",
    kicker: "Gemeinsamer Überblick",
    description: "Einnahmen, Ausgaben, Rücklagen und verfügbarer Betrag für den ausgewählten Monat.",
  },
  people: {
    title: "Personen",
    kicker: "Home-Assistant-Personen",
    description: "Die Personen, die für Kontoinhaber und Buchungsaufteilungen im Haushalt verfügbar sind.",
  },
};

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
  plus: "M12 5v14M5 12h14",
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
  button:has(> svg) { display: inline-flex; align-items: center; flex-direction: row; gap: 0.45rem; }
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
  .trend-card { --chart-aspect-ratio: 720 / 260; min-inline-size: 0; padding: 1.15rem 1.25rem 0.95rem; }
  .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  .section-heading h3 { margin: 0; font-family: var(--fp-display); font-size: 1.4rem; line-height: 1; letter-spacing: -0.025em; }
  .section-heading p { margin: 0; color: var(--fp-muted); font-size: 0.78rem; }
  .chart-wrap { position: relative; margin-block-start: 0.8rem; }
  .chart-wrap svg { display: block; inline-size: 100%; aspect-ratio: var(--chart-aspect-ratio); block-size: auto; overflow: visible; }
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
  .bar-row { display: grid; grid-template-columns: minmax(5.1rem, 0.65fr) minmax(0, 1fr) minmax(7.25rem, auto); align-items: center; gap: 0.55rem; color: var(--fp-muted); font-size: 0.72rem; }
  .bar-track { block-size: 0.48rem; overflow: hidden; background: #e4e6e4; }
  .bar-fill { display: block; block-size: 100%; min-inline-size: 0.35rem; background: var(--fp-navy); }
  .bar-fill--cyan { background: var(--fp-cyan); }
  .bar-fill--amber { background: var(--fp-amber); }
  .bar-fill--coral { background: var(--fp-coral); }
  .bar-value { display: grid; gap: 0.1rem; color: var(--fp-coral); font-family: var(--fp-data); text-align: end; white-space: nowrap; }
  .bar-value small, .category-values small { color: var(--fp-muted); font-family: var(--fp-body); font-size: 0.64rem; }
  .category-list { display: grid; gap: 0.38rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .category-item { display: grid; grid-template-columns: 1.3rem minmax(0, 1fr) auto; align-items: center; gap: 0.35rem; color: var(--fp-muted); font-size: 0.74rem; }
  .category-item svg { color: var(--fp-navy); }
  .category-values { display: grid; gap: 0.1rem; text-align: end; white-space: nowrap; }
  .category-values strong { color: var(--fp-ink); font-family: var(--fp-data); }

  .statusbar { display: flex; justify-content: space-between; gap: 1rem; margin-block-start: 1rem; color: var(--fp-muted); font-size: 0.7rem; }
  .statusbar span:last-child { text-align: end; }
  .statusbar strong { color: var(--fp-ink); font-weight: 700; }
  .feedback-presenter { position: fixed; inset: auto 1rem 1rem auto; z-index: 20; inline-size: min(28rem, calc(100vw - 2rem)); display: none; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 0.85rem; margin: 0; padding: 0.85rem 0.9rem 0.85rem 1rem; border: 1px solid var(--fp-navy); border-radius: 0.65rem; color: var(--fp-paper); background: var(--fp-navy); box-shadow: 0 0.9rem 2.4rem rgb(11 30 63 / 0.2); opacity: 0; transform: translateY(0.35rem); transition: opacity 180ms ease, transform 180ms ease, display 180ms allow-discrete; transition-behavior: allow-discrete; }
  .feedback-presenter--visible { display: grid; opacity: 1; transform: translateY(0); }
  .feedback-presenter-message { min-inline-size: 0; margin: 0; font-size: 0.82rem; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
  .feedback-presenter-close { min-inline-size: 2.25rem; min-block-size: 2.25rem; padding: 0.35rem 0.5rem; border: 1px solid rgb(247 247 244 / 0.42); border-radius: 0.4rem; color: var(--fp-paper); background: transparent; font-size: 0.72rem; font-weight: 800; white-space: nowrap; }
  .feedback-presenter-close:hover { border-color: var(--fp-paper); background: rgb(247 247 244 / 0.12); }
  .confirm-dialog { inline-size: min(32rem, calc(100vw - 2rem)); max-inline-size: none; margin: auto; padding: 0; border: 1px solid var(--fp-navy); border-radius: var(--fp-radius); color: var(--fp-ink); background: var(--fp-paper-strong); box-shadow: 0 1.1rem 3rem rgb(11 30 63 / 0.24); }
  .confirm-dialog::backdrop { background: rgb(11 30 63 / 0.52); }
  .confirm-dialog-content { display: grid; gap: 0.8rem; padding: 1.3rem; }
  .confirm-dialog h2 { margin: 0; font-family: var(--fp-display); font-size: 1.45rem; line-height: 1.05; }
  .confirm-dialog-message { margin: 0; color: var(--fp-muted); line-height: 1.5; overflow-wrap: anywhere; }
  .confirm-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.55rem; margin: 0.35rem 0 0; }
  .confirm-dialog-actions button { min-block-size: 2.75rem; padding: 0.55rem 0.85rem; border: 1px solid var(--fp-control-border); border-radius: 0.45rem; font-weight: 800; }
  .confirm-dialog-cancel { color: var(--fp-ink); background: var(--fp-paper-strong); }
  .confirm-dialog-cancel:hover { border-color: var(--fp-navy); background: var(--fp-cyan-soft); }
  .confirm-dialog-submit { border-color: var(--fp-navy) !important; color: var(--fp-paper); background: var(--fp-navy); }
  .confirm-dialog-submit:hover { background: var(--fp-navy-deep); }
  .booking-detail-dialog { inline-size: min(58rem, calc(100vw - 2rem)); max-inline-size: none; max-block-size: min(86dvh, 64rem); margin: auto; padding: 0; border: 1px solid var(--fp-navy); border-radius: var(--fp-radius); color: var(--fp-ink); background: var(--fp-paper-strong); box-shadow: 0 1.1rem 3rem rgb(11 30 63 / 0.24); }
  .booking-detail-dialog::backdrop { background: rgb(11 30 63 / 0.52); }
  .booking-detail-content { display: grid; gap: 1rem; max-block-size: min(86dvh, 64rem); overflow: auto; padding: clamp(1rem, 3vw, 1.6rem); }
  .booking-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .booking-detail-dialog h2, .booking-detail-dialog h3 { margin: 0; font-family: var(--fp-display); line-height: 1.1; }
  .booking-detail-dialog h2 { font-size: clamp(1.55rem, 3vw, 2.1rem); }
  .booking-detail-dialog h3 { font-size: 1.05rem; }
  .booking-detail-description, .booking-detail-status, .booking-detail-error { margin: 0.35rem 0 0; color: var(--fp-muted); line-height: 1.5; overflow-wrap: anywhere; }
  .booking-detail-error { padding: 0.8rem; border-inline-start: 0.25rem solid var(--fp-coral); color: var(--fp-ink); background: var(--fp-coral-soft); }
  .booking-detail-legacy { margin: 0; padding: 0.75rem; border: 1px solid var(--fp-line); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-amber-soft); line-height: 1.45; }
  .booking-detail-section { display: grid; gap: 0.65rem; padding-block-start: 0.8rem; border-block-start: 1px solid var(--fp-line); }
  .booking-detail-fields, .booking-detail-nested { display: grid; gap: 0.5rem; margin: 0; }
  .booking-detail-fields > div, .booking-detail-nested > div { display: grid; grid-template-columns: minmax(8rem, 0.42fr) minmax(0, 1fr); gap: 0.8rem; padding-block: 0.4rem; border-block-end: 1px solid rgb(214 219 220 / 0.7); }
  .booking-detail-fields dt, .booking-detail-nested dt { color: var(--fp-muted); font-size: 0.78rem; font-weight: 800; }
  .booking-detail-fields dd, .booking-detail-nested dd { min-inline-size: 0; margin: 0; overflow-wrap: anywhere; }
  .booking-detail-empty { color: var(--fp-muted); font-style: italic; }
  .booking-detail-list { display: grid; gap: 0.45rem; margin: 0; padding-inline-start: 1.2rem; }
  .booking-detail-list li { padding-inline-start: 0.2rem; }
  .booking-detail-key { display: block; margin-block-end: 0.2rem; color: var(--fp-muted); font-size: 0.73rem; font-weight: 800; }
  .booking-detail-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.55rem; }
  .booking-detail-actions button { min-block-size: 2.75rem; padding: 0.55rem 0.85rem; border: 1px solid var(--fp-control-border); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-weight: 800; }
  .booking-detail-actions button:hover { border-color: var(--fp-navy); background: var(--fp-cyan-soft); }
  .booking-detail-raw { max-block-size: 32rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--fp-data); font-size: 0.78rem; line-height: 1.55; }

  .review-view, .accounts-view, .plan-items-view, .pets-view, .feed-profiles-view, .catalogs-view { inline-size: 100%; padding-block: 1.8rem; }
  .resolved-view { inline-size: 100%; padding-block: 1.8rem; }
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
  .booking-account-groups { display: grid; gap: 1.15rem; margin-block-start: 1rem; }
  .booking-account-group { min-inline-size: 0; }
  .booking-account-group-heading { margin: 0; padding: 0.65rem 0.8rem; border-block-end: 1px solid var(--fp-line); color: var(--fp-navy); background: var(--fp-cyan-soft); font-family: var(--fp-display); font-size: 1rem; line-height: 1.1; }
  .booking-account-group-list { margin-block-start: 0.55rem; }
  .booking-selection-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem; margin-block-start: 1rem; padding: 0.65rem 0.8rem; border: 1px solid var(--fp-line); border-radius: 0.55rem; background: rgb(255 254 249 / 0.78); }
  .booking-selection-all, .booking-selection { min-block-size: 3rem; min-inline-size: 3rem; display: inline-flex; align-items: center; gap: 0.5rem; }
  .booking-selection-all { color: var(--fp-ink); font-size: 0.8rem; font-weight: 800; }
  .booking-selection-all input, .booking-selection input { inline-size: 1.2rem; block-size: 1.2rem; accent-color: var(--fp-cyan); }
  .booking-selection-summary { flex: 1 1 12rem; margin: 0; color: var(--fp-muted); font-size: 0.78rem; }
  .bulk-delete-button { min-block-size: 3rem; padding: 0.5rem 0.8rem; border: 1px solid var(--fp-coral); border-radius: 0.45rem; color: var(--fp-coral); background: var(--fp-paper-strong); font-size: 0.78rem; font-weight: 800; }
  .bulk-delete-button:hover:not(:disabled) { background: var(--fp-coral-soft); }
  .bulk-delete-button:disabled { cursor: not-allowed; opacity: 0.55; }
  .bulk-export-button { min-block-size: 3rem; padding: 0.5rem 0.8rem; border: 1px solid var(--fp-navy); border-radius: 0.45rem; color: var(--fp-navy); background: var(--fp-paper-strong); font-size: 0.78rem; font-weight: 800; }
  .bulk-export-button:hover:not(:disabled) { background: var(--fp-cyan-soft); }
  .bulk-export-button:disabled { cursor: not-allowed; opacity: 0.55; }
  .booking-row { display: grid; grid-template-columns: 3rem 7rem minmax(0, 1fr) auto auto; align-items: center; gap: 1rem; padding: 0.85rem 1rem; border: 1px solid var(--fp-line); border-radius: 0.65rem; background: rgb(255 254 249 / 0.86); }
  .booking-row:has([data-booking-select]:checked) { border-color: var(--fp-cyan); background: rgb(223 244 247 / 0.45); }
  .booking-date { color: var(--fp-muted); font-family: var(--fp-data); font-size: 0.75rem; }
  .booking-purpose { min-inline-size: 0; display: grid; gap: 0.2rem; }
  .booking-counterparty, .booking-sender, .booking-purpose-detail { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .booking-counterparty { font-weight: 700; }
  .booking-sender, .booking-purpose-detail { color: var(--fp-muted); font-size: 0.75rem; }
  .booking-account-inline { color: var(--fp-ink); font-weight: 800; }
  .booking-account { min-inline-size: 0; max-inline-size: 16rem; display: grid; gap: 0.18rem; color: var(--fp-ink); font-size: 0.75rem; line-height: 1.3; }
  .booking-account strong { overflow-wrap: anywhere; font-size: 0.78rem; font-weight: 800; }
  .booking-account-reference { color: var(--fp-muted); overflow-wrap: anywhere; }
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
  .account-save:disabled { cursor: not-allowed; opacity: 0.55; }
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
  .plan-item-save:disabled { cursor: not-allowed; opacity: 0.55; }
  .plan-item-new-row { display: flex; justify-content: flex-end; margin-block-start: 1rem; }
  .plan-item-help { max-inline-size: 70ch; margin: 0.8rem 0 0; color: var(--fp-muted); font-size: 0.78rem; line-height: 1.45; }
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
  .pet-save:disabled { cursor: not-allowed; opacity: 0.55; }
  .pet-archive { color: var(--fp-coral); background: var(--fp-paper-strong); }
  .pet-archive:hover { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
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
  .feed-profile-save:disabled, .feed-profile-purchase:disabled { cursor: not-allowed; opacity: 0.55; }
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
  .catalog-entry-form--category { grid-template-columns: minmax(0, 1fr) minmax(12rem, 0.8fr) auto; }
  .catalog-entry-form--archived { background: rgb(247 247 244 / 0.7); }
  .catalog-field { min-inline-size: 0; display: grid; gap: 0.25rem; color: var(--fp-muted); font-size: 0.7rem; font-weight: 800; }
  .catalog-field input, .catalog-field select { inline-size: 100%; min-block-size: 2.75rem; min-inline-size: 0; padding: 0.5rem 0.6rem; border: 1px solid var(--fp-control-border); border-radius: 0.4rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .catalog-field input:user-invalid, .catalog-field select:user-invalid { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .catalog-entry-actions { display: flex; align-items: center; gap: 0.35rem; }
  .catalog-entry-actions button { min-block-size: 2.75rem; padding: 0.5rem 0.65rem; border: 1px solid var(--fp-navy); border-radius: 0.4rem; color: var(--fp-paper); background: var(--fp-navy); font-size: 0.75rem; font-weight: 800; }
  .catalog-entry-actions button:hover { background: var(--fp-navy-deep); }
  .catalog-entry-actions .catalog-archive { color: var(--fp-coral); background: var(--fp-paper-strong); }
  .catalog-entry-actions .catalog-archive:hover { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .catalog-entry-actions .catalog-save:disabled { cursor: not-allowed; opacity: 0.55; }
  .catalog-entry-status { grid-column: 1 / -1; min-block-size: 1.1rem; margin: 0; color: var(--fp-muted); font-size: 0.7rem; overflow-wrap: anywhere; }
  .catalog-entry-status--error { color: var(--fp-coral); font-weight: 700; }
  .catalog-help { margin: 0; color: var(--fp-muted); font-size: 0.78rem; line-height: 1.45; }
  .catalog-overview { display: grid; gap: 0.9rem; margin-block-start: 1rem; }
  .catalog-kind-nav { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.3rem; border: 1px solid var(--fp-line); border-radius: 0.55rem; background: rgb(23 40 62 / 0.06); }
  .catalog-kind-nav button { min-block-size: 2.5rem; padding: 0.45rem 0.85rem; border: 1px solid transparent; border-radius: 0.4rem; color: var(--fp-muted); background: transparent; font-size: 0.8rem; font-weight: 800; }
  .catalog-kind-nav button:hover { color: var(--fp-ink); background: rgb(255 254 249 / 0.8); }
  .catalog-kind-nav button.catalog-kind-nav--active { border-color: var(--fp-navy); color: var(--fp-paper); background: var(--fp-navy); }
  .empty-state { margin-block-start: 1rem; padding: 2rem; border: 1px dashed var(--fp-line); color: var(--fp-muted); text-align: center; }
  .section-view { inline-size: 100%; padding-block: clamp(1.5rem, 3vw, 2.75rem); }
  .section-view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.25rem; }
  .section-view-header h2 { margin: 0; font-family: var(--fp-display); font-size: clamp(2rem, 3vw, 2.65rem); line-height: 1; letter-spacing: -0.03em; text-wrap: balance; }
  .section-kicker { margin: 0 0 0.45rem; color: var(--fp-cyan); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; }
  .section-view-header p:not(.section-kicker) { max-inline-size: 58rem; margin: 0.55rem 0 0; color: var(--fp-muted); line-height: 1.45; }
  .section-view-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.55rem; }
  .section-view-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-block-start: 1.35rem; }
  .section-card { min-inline-size: 0; padding: 1.1rem 1.2rem; }
  .section-card--wide { grid-column: span 2; }
  .section-card h3 { margin: 0; font-family: var(--fp-display); font-size: 1.35rem; line-height: 1.05; letter-spacing: -0.02em; }
  .section-card > p { margin: 0.45rem 0 0; color: var(--fp-muted); font-size: 0.8rem; line-height: 1.45; }
  .section-stat-label { margin: 0; color: var(--fp-muted); font-size: 0.75rem; font-weight: 800; }
  .section-stat-value { margin: 0.55rem 0 0; color: var(--fp-ink); font-family: var(--fp-data); font-size: clamp(1.55rem, 2.5vw, 2.2rem); font-weight: 700; letter-spacing: -0.065em; line-height: 1; white-space: nowrap; }
  .section-stat-value--positive { color: var(--fp-green); }
  .section-stat-value--negative { color: var(--fp-coral); }
  .section-stat-caption { margin: 0.45rem 0 0; color: var(--fp-muted); font-size: 0.75rem; line-height: 1.35; }
  .section-data-table-wrap { overflow-x: auto; margin-block-start: 0.9rem; border: 1px solid var(--fp-line); border-radius: 0.55rem; }
  .section-data-table { inline-size: 100%; min-inline-size: 32rem; border-collapse: collapse; }
  .section-data-table th, .section-data-table td { padding: 0.7rem 0.75rem; border-block-end: 1px solid var(--fp-line); text-align: start; }
  .section-data-table th { color: var(--fp-muted); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
  .section-data-table tbody th { color: var(--fp-ink); font-size: 0.82rem; letter-spacing: 0; text-transform: none; }
  .section-data-table tbody tr:last-child th, .section-data-table tbody tr:last-child td { border-block-end: 0; }
  .section-data-table .section-table-number { font-family: var(--fp-data); white-space: nowrap; }
  .section-data-table .section-table-muted { color: var(--fp-muted); }
  .comparison-section { margin-block-start: 1.2rem; }
  .comparison-section .section-actions { margin-block: 0.9rem; }
  .comparison-section .section-action { white-space: nowrap; }
  .comparison-section [aria-pressed="true"] { border-color: var(--fp-navy); color: var(--fp-paper); background: var(--fp-navy); }
  .comparison-section .section-action:disabled { opacity: 0.65; cursor: wait; }
  .comparison-section .section-data-table-wrap:focus-visible, .comparison-section h4:focus-visible { outline: 3px solid var(--fp-cyan); outline-offset: 3px; }
  .comparison-section th, .comparison-section td { overflow-wrap: anywhere; }
  .comparison-section th[scope="row"] { min-inline-size: 10rem; }
  .comparison-section td small { display: block; color: var(--fp-muted); font-family: var(--fp-body); }
  .comparison-details { margin-block-start: 1.2rem; padding-block-start: 1rem; border-block-start: 1px solid var(--fp-line); }
  .comparison-details h4 { margin: 0; font-size: 1rem; }
  .comparison-details caption { padding: 0.75rem; text-align: start; font-weight: 700; }
  .section-empty { display: grid; justify-items: start; gap: 0.75rem; margin-block-start: 0.9rem; padding: 1rem; border: 1px dashed var(--fp-line); color: var(--fp-muted); font-size: 0.82rem; line-height: 1.45; }
  .section-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-block-start: 1rem; }
  .section-action { min-block-size: 2.65rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; padding: 0.55rem 0.8rem; border: 1px solid var(--fp-control-border); border-radius: 0.5rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 0.78rem; font-weight: 800; }
  .section-action:hover { border-color: var(--fp-navy); background: var(--fp-cyan-soft); }
  .section-action--primary { border-color: var(--fp-navy); color: var(--fp-paper); background: var(--fp-navy); }
  .section-action--primary:hover { background: var(--fp-navy-deep); }
  .section-action--accent { border-color: var(--fp-amber); color: var(--fp-navy-deep); background: var(--fp-amber); }
  .section-action--accent:hover { background: #f0aa43; }
  .section-note { display: flex; align-items: flex-start; gap: 0.65rem; margin-block-start: 1rem; padding-block-start: 0.9rem; border-block-start: 1px solid var(--fp-line); color: var(--fp-muted); font-size: 0.78rem; line-height: 1.45; }
  .section-note svg { flex: 0 0 auto; color: var(--fp-cyan); }
  .section-person-list { display: grid; gap: 0.55rem; margin: 0.9rem 0 0; padding: 0; list-style: none; }
  .section-person { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--fp-line); background: rgb(255 254 249 / 0.75); }
  .section-person-name { min-inline-size: 0; overflow: hidden; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
  .section-person-id { color: var(--fp-muted); font-family: var(--fp-data); font-size: 0.68rem; overflow-wrap: anywhere; text-align: end; }
  .section-status { margin-block-start: 1rem; }
  .management-list-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-block-start: 1rem; }
  .management-list-toolbar p { margin: 0; color: var(--fp-muted); font-size: 0.8rem; }
  .management-toolbar-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; }
  .table-new-button, .table-edit-button, .management-editor-back { min-block-size: 2.75rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; border-radius: 0.45rem; font-size: 0.78rem; font-weight: 800; }
  .table-new-button { padding: 0.5rem 0.85rem; border: 1px solid var(--fp-navy); color: var(--fp-paper); background: var(--fp-navy); }
  .table-new-button:hover { background: var(--fp-navy-deep); }
  .table-edit-button { padding: 0.45rem 0.7rem; border: 1px solid var(--fp-navy); color: var(--fp-paper); background: var(--fp-navy); }
  .table-edit-button:hover { background: var(--fp-navy-deep); }
  .management-table-wrap { overflow-x: auto; margin-block-start: 1rem; border: 1px solid var(--fp-line); border-radius: var(--fp-radius); background: rgb(255 254 249 / 0.82); box-shadow: var(--fp-shadow); scrollbar-gutter: stable; }
  .management-table { inline-size: 100%; min-inline-size: 54rem; border-collapse: collapse; }
  .management-table caption { padding: 0; }
  .management-table th, .management-table td { padding: 0.85rem 1rem; border-block-end: 1px solid var(--fp-line); text-align: start; vertical-align: middle; }
  .management-table th { color: var(--fp-muted); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
  .management-table tbody th { color: var(--fp-ink); font-size: 0.92rem; letter-spacing: 0; text-transform: none; }
  .management-table tbody tr:last-child th, .management-table tbody tr:last-child td { border-block-end: 0; }
  .management-table tbody tr:hover { background: rgb(223 244 247 / 0.35); }
  .management-table .table-number { font-family: var(--fp-data); white-space: nowrap; }
  .management-table .table-actions { text-align: end; white-space: nowrap; }
  .management-table tbody td[data-table-secondary] { color: var(--fp-muted); }
  .management-editor { display: grid; gap: 0.8rem; margin-block-start: 1rem; }
  .management-editor-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .management-editor-header h3 { margin: 0; font-family: var(--fp-display); font-size: 1.35rem; line-height: 1; }
  .management-editor-header p { margin: 0.45rem 0 0; color: var(--fp-muted); font-size: 0.8rem; line-height: 1.4; }
  .management-editor-back { flex: 0 0 auto; padding: 0.5rem 0.75rem; border: 1px solid var(--fp-control-border); color: var(--fp-ink); background: var(--fp-paper-strong); }
  .management-editor-back:hover { border-color: var(--fp-navy); background: var(--fp-cyan-soft); }
  .management-editor > .catalog-entry-form { padding: 1.1rem; border: 1px solid var(--fp-line); border-radius: var(--fp-radius); background: rgb(255 254 249 / 0.82); box-shadow: var(--fp-shadow); }

  .rules-view button, .rules-view input, .rules-view select, .review-view button,
  .review-view input:not([type="checkbox"]), .review-view select, [data-nav="rules"] { min-block-size: 48px; min-inline-size: 48px; }
  .rail-nav [data-nav="rules"] span { display: inline; }
  .rule-form { display: grid; gap: 1.25rem; padding: 1.1rem; background: var(--fp-paper-strong); border: 1px solid var(--fp-line); border-radius: var(--fp-radius); }
  .rule-fieldset { min-inline-size: 0; margin: 0; padding: 0.8rem 0 0; border: 0; border-block-start: 1px solid var(--fp-line); }
  .rule-fieldset legend { padding-inline-end: 0.5rem; font-weight: 700; }
  .rule-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: 0.85rem; }
  .rule-field { display: grid; align-content: start; gap: 0.35rem; min-inline-size: 0; font-size: 0.85rem; }
  .rule-field label { font-weight: 700; }
  .rule-field input, .rule-field select { inline-size: 100%; padding: 0.5rem 0.6rem; border: 1px solid var(--fp-control-border); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-paper-strong); font-size: 1rem; }
  .rule-field [aria-invalid="true"] { border-color: var(--fp-coral); background: var(--fp-coral-soft); }
  .rule-field small, .rule-help { color: var(--fp-muted); line-height: 1.5; }
  .rule-error { margin: 0; color: var(--fp-ink); font-size: 0.85rem; font-weight: 700; overflow-wrap: anywhere; }
  .rule-error:empty { display: none; }
  .rule-allocation { margin-block-start: 1.1rem; }
  .rule-allocation > .rule-actions { margin-block-start: 0.75rem; }
  .rule-fieldset > .rule-error:not(:empty) { margin-block: 0.75rem; }
  .rule-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.65rem; }
  .rule-actions p { flex: 1 1 16rem; }
  .rules-view button:disabled, .review-view button:disabled { cursor: not-allowed; opacity: 0.55; }
  .rules-view .management-table-wrap:focus-visible { outline: 3px solid var(--fp-cyan); outline-offset: 3px; }
  .rules-view .management-table { min-inline-size: 58rem; }
  .rules-view .management-table td, .rules-view .management-table tbody th { min-inline-size: 9rem; max-inline-size: 24rem; overflow-wrap: anywhere; }
  .rules-view .management-table .table-number { min-inline-size: 6rem; }
  .rules-view .management-table ul { margin: 0; padding-inline-start: 1.1rem; }
  .rules-view .management-table .rule-account-group:hover { background: transparent; }
  .rules-view .management-table .rule-account-group th { padding-block: 0.7rem; border-block-start: 0.7rem solid var(--fp-paper); color: var(--fp-navy); background: var(--fp-cyan-soft); font-family: var(--fp-display); font-size: 0.85rem; letter-spacing: 0; text-transform: none; }
  .booking-rule-hint { grid-column: 1 / -1; padding: 0.8rem; background: var(--fp-cyan-soft); border-radius: 0.45rem; overflow-wrap: anywhere; }
  .booking-rule-hint--conflict { background: var(--fp-amber-soft); }
  .booking-rule-hint h3, .booking-rule-hint p { margin: 0 0 0.55rem; }
  .booking-rule-hint h3 { font-size: 1rem; }
  .booking-rule-hint ul { padding-inline-start: 1.2rem; }
  .review-view .allocation-status { flex-basis: auto; }
  .booking-history-filters { display: grid; gap: 1rem; margin-block-start: 1.25rem; padding: 1rem; border: 1px solid var(--fp-line); border-radius: var(--fp-radius); background: var(--fp-paper-strong); box-shadow: var(--fp-shadow); }
  .booking-history-filter-grid { display: grid; grid-template-columns: minmax(15rem, 2fr) repeat(5, minmax(8rem, 1fr)); gap: 0.75rem; }
  .booking-history-filter-field { display: grid; align-content: start; gap: 0.35rem; min-inline-size: 0; color: var(--fp-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase; }
  .booking-history-filter-field input, .booking-history-filter-field select { inline-size: 100%; min-block-size: 3rem; padding: 0.55rem 0.65rem; border: 1px solid var(--fp-control-border); border-radius: 0.45rem; color: var(--fp-ink); background: var(--fp-paper); font-size: 0.95rem; font-weight: 400; letter-spacing: 0; text-transform: none; }
  .booking-history-filter-field input:focus-visible, .booking-history-filter-field select:focus-visible { border-color: var(--fp-cyan); }
  .booking-history-filter-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.65rem; }
  .booking-result-count { margin: 1rem 0 0; color: var(--fp-muted); font-size: 0.82rem; font-weight: 700; }
  .booking-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem; margin-block-start: 1rem; padding-block: 0.85rem; border-block: 1px solid var(--fp-line); }
  .booking-pagination-status { min-inline-size: 8rem; color: var(--fp-muted); font-family: var(--fp-data); font-size: 0.78rem; text-align: center; }
  .booking-page-size { display: inline-flex; align-items: center; gap: 0.45rem; margin-inline-start: auto; color: var(--fp-muted); font-size: 0.78rem; font-weight: 700; }
  .booking-page-size select { min-block-size: 2.65rem; padding: 0.35rem 0.55rem; border: 1px solid var(--fp-control-border); border-radius: 0.4rem; color: var(--fp-ink); background: var(--fp-paper-strong); }
  .booking-pagination-total { color: var(--fp-muted); font-size: 0.78rem; }
  .resolved-view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .resolved-view h2 { margin: 0; font-family: var(--fp-display); font-size: clamp(2rem, 3vw, 2.65rem); line-height: 1; }
  .resolved-view-header p { max-inline-size: 55rem; margin: 0.5rem 0 0; color: var(--fp-muted); }
  .resolved-table-wrap { overflow-x: auto; margin-block-start: 1rem; border: 1px solid var(--fp-line); border-radius: var(--fp-radius); background: rgb(255 254 249 / 0.82); box-shadow: var(--fp-shadow); scrollbar-gutter: stable; }
  .resolved-table { inline-size: 100%; min-inline-size: 68rem; border-collapse: collapse; }
  .resolved-table caption { padding: 0; }
  .resolved-table th, .resolved-table td { padding: 0.85rem 1rem; border-block-end: 1px solid var(--fp-line); text-align: start; vertical-align: top; }
  .resolved-table th { color: var(--fp-muted); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
  .resolved-table tbody th { color: var(--fp-ink); font-size: 0.92rem; letter-spacing: 0; text-transform: none; }
  .resolved-table .booking-account-group-row:hover { background: transparent; }
  .resolved-table .booking-account-group-row th { padding-block: 0.7rem; border-block-start: 0.7rem solid var(--fp-paper); color: var(--fp-navy); background: var(--fp-cyan-soft); font-family: var(--fp-display); font-size: 0.85rem; letter-spacing: 0; text-transform: none; }
  .resolved-table tbody tr:last-child th, .resolved-table tbody tr:last-child td { border-block-end: 0; }
  .resolved-table tbody tr:hover { background: rgb(223 244 247 / 0.35); }
  .resolved-table .table-number { color: var(--fp-coral); font-family: var(--fp-data); font-weight: 700; white-space: nowrap; }
  .resolved-table .table-actions { text-align: end; white-space: nowrap; }
  .resolved-table .selection-column, .resolved-table .selection-cell { inline-size: 3rem; padding-inline: 0.5rem; text-align: center; }
  .resolved-table tbody tr:has([data-booking-select]:checked) { background: rgb(223 244 247 / 0.45); }
  .resolved-table p, .resolved-table ul { margin: 0; }
  .resolved-table ul { display: grid; gap: 0.25rem; padding-inline-start: 1.1rem; }
  .resolved-booking-date, .resolved-booking-sender, .resolved-booking-counterparty, .resolved-booking-purpose, .resolved-rule-reason { display: block; margin-block-start: 0.25rem; color: var(--fp-muted); font-size: 0.75rem; font-weight: 400; }
  .resolved-booking-counterparty { color: var(--fp-ink); font-size: 0.92rem; font-weight: 700; }
  .resolved-booking-purpose { overflow-wrap: anywhere; }
  .resolved-rule-source { color: var(--fp-ink); font-weight: 800; }
  .resolved-rule-source--manual { color: var(--fp-muted); }
  .resolved-rule-reason { max-inline-size: 24rem; overflow-wrap: anywhere; }
  .resolved-empty { margin-block-start: 1rem; }
  .confirmed-bookings { display: grid; gap: 0.65rem; padding: 0; list-style: none; }
  .confirmed-bookings li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.65rem; padding-block: 0.65rem; border-block-end: 1px solid var(--fp-line); }

  .visually-hidden { position: absolute !important; display: block !important; inline-size: 1px !important; block-size: 1px !important; margin: -1px !important; padding: 0 !important; overflow: hidden !important; border: 0 !important; clip: rect(0 0 0 0) !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
  .skip-link { inset: 0.75rem auto auto 0.75rem; z-index: 10; padding: 0.6rem 0.8rem; color: var(--fp-paper); background: var(--fp-navy); }
  .skip-link:focus-visible { position: fixed !important; inline-size: auto !important; block-size: auto !important; overflow: visible !important; clip-path: none !important; white-space: normal !important; }
  :where(a, button, input, select):focus-visible { outline: 3px solid var(--fp-cyan); outline-offset: 3px; }
  ::selection { color: var(--fp-paper); background: var(--fp-navy); }
  * { scrollbar-color: var(--fp-muted) var(--fp-paper); scrollbar-width: thin; }
  [data-reveal] { animation: reveal 700ms cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--reveal-order, 0) * 70ms); }
  @keyframes reveal { from { opacity: 0; transform: translateY(0.75rem); filter: blur(0.25rem); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
  @media (prefers-reduced-motion: reduce) { [data-reveal] { animation: none; } .nav-item, .month-control button, .icon-button, .feedback-presenter { transition: none; } }

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
    .section-view-grid { grid-template-columns: 1fr; }
    .section-card--wide { grid-column: auto; }
  }

  @media (max-width: 45rem) {
    .app-shell { display: block; }
    .rail { min-block-size: auto; position: sticky; inset-block-start: 0; z-index: 5; }
    .rail-brand { min-block-size: 3.5rem; padding-inline: 1rem; }
    .rail-nav { display: flex; gap: 0.25rem; overflow-x: auto; padding: 0.4rem 0.5rem; scrollbar-width: none; }
    .rail-nav::-webkit-scrollbar { display: none; }
    .nav-item { min-block-size: 2.5rem; flex: 0 0 auto; padding-inline: 0.7rem; }
    .nav-item[data-nav="rules"] { min-block-size: 48px; }
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
    .trend-card { --chart-aspect-ratio: 720 / 260; padding-inline: 0.75rem; }
    .section-heading { display: block; }
    .section-heading p { margin-block-start: 0.35rem; }
    .chart-legend { gap: 0.45rem 0.7rem; font-size: 0.68rem; }
    .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 1rem; }
    .statusbar { display: block; }
    .statusbar span { display: block; }
    .statusbar span:last-child { margin-block-start: 0.35rem; text-align: start; }
    .review-view-header, .resolved-view-header, .accounts-view-header, .plan-items-view-header, .pets-view-header, .feed-profiles-view-header, .catalogs-view-header, .section-view-header, .import-strip, .excel-review-header { display: block; }
    .back-button { margin-block-start: 1rem; }
    .section-view-actions { justify-content: flex-start; margin-block-start: 1rem; }
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
    .catalog-entry-form, .catalog-entry-form--category { grid-template-columns: 1fr; }
    .catalog-entry-actions { flex-direction: column; align-items: stretch; }
    .catalog-entry-actions button { inline-size: 100%; }
    .management-list-toolbar { align-items: stretch; flex-direction: column; }
    .catalog-kind-nav { overflow-x: auto; flex-wrap: nowrap; }
    .catalog-kind-nav button { flex: 0 0 auto; }
    .management-toolbar-actions { align-items: stretch; flex-direction: column; }
    .table-new-button, .management-editor-back { inline-size: 100%; }
    .management-table, .resolved-table { min-inline-size: 50rem; }
    .booking-history-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .booking-history-filter-field--search { grid-column: 1 / -1; }
    .booking-page-size { margin-inline-start: 0; }
    .management-editor-header { flex-direction: column; }
    .plan-item-new-row { display: block; }
    .file-input { max-inline-size: 100%; margin-block-start: 0.8rem; }
    .excel-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .booking-row { grid-template-columns: 3rem minmax(0, 1fr) auto; gap: 0.35rem 0.8rem; }
    .booking-selection { grid-column: 1; grid-row: 1 / span 3; justify-content: center; align-self: center; }
    .booking-date { grid-column: 2; grid-row: 1; }
    .booking-purpose { grid-column: 2; grid-row: 2; }
    .booking-account { grid-column: 2; grid-row: 3; }
    .booking-amount { grid-column: 3; grid-row: 1 / span 3; align-self: center; }
    .allocation-row { grid-template-columns: 1fr; }
    .allocation-actions { align-items: stretch; flex-direction: column; }
    .booking-history-filter-grid { grid-template-columns: 1fr; }
    .booking-history-filter-field--search { grid-column: auto; }
    .booking-history-filter-actions { align-items: stretch; flex-direction: column-reverse; }
    .booking-history-filter-actions button { inline-size: 100%; }
    .booking-pagination { align-items: stretch; }
    .booking-pagination-status { flex: 1 1 100%; order: -1; text-align: start; }
    .booking-page-size { justify-content: space-between; }
    .allocation-status, .allocation-add, .assign-button { inline-size: 100%; }
    .feedback-presenter { inset: auto 0.85rem 0.85rem; inline-size: auto; }
    .confirm-dialog { inline-size: calc(100vw - 1.7rem); }
    .confirm-dialog-actions { justify-content: stretch; }
    .confirm-dialog-actions button { flex: 1 1 9rem; }
    .booking-detail-dialog { inline-size: calc(100vw - 1.7rem); }
    .booking-detail-fields > div, .booking-detail-nested > div { grid-template-columns: 1fr; gap: 0.2rem; }
    .booking-detail-actions { justify-content: stretch; }
    .booking-detail-actions button { flex: 1 1 9rem; }
  }

  @media (forced-colors: active) {
    .surface, .month-control, .import-strip, .booking-row, .excel-suggestion-row, .account-card, .plan-item-card, .pet-card, .feed-profile-card, .feed-profile-forecast, .catalog-section, .catalog-entry-form, .section-card, .section-note, .allocation-field input, .allocation-field select, .allocation-remove, .plan-item-field input, .plan-item-field select, .pet-field input, .feed-profile-field input, .feed-profile-field select, .catalog-field input, .feedback-presenter { border: 1px solid CanvasText; box-shadow: none; }
    .feedback-presenter, .confirm-dialog, .booking-detail-dialog { color: CanvasText; background: Canvas; }
    .feedback-presenter-close { border-color: ButtonText; color: ButtonText; }
    .confirm-dialog { border-color: CanvasText; box-shadow: none; }
    .confirm-dialog::backdrop { background: CanvasText; opacity: 0.5; }
    .confirm-dialog-actions button { border-color: ButtonText; color: ButtonText; background: Canvas; }
    .confirm-dialog-submit { color: Canvas; background: ButtonText !important; }
    .booking-detail-dialog { border-color: CanvasText; box-shadow: none; }
    .booking-detail-dialog::backdrop { background: CanvasText; opacity: 0.5; }
    .booking-detail-actions button { border-color: ButtonText; color: ButtonText; background: Canvas; }
    .review-pill, .review-action, .file-input::file-selector-button { border: 1px solid ButtonText; }
    .bar-track { border: 1px solid CanvasText; }
  }
`;

const demoHousehold = {
  income: 5220,
  expenses: -1934.6,
  savings: -300,
  available: 3285.4,
  income_plan: 5650,
  expenses_plan: 2200,
  savings_plan: 300,
  available_plan: 3150,
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
    { name: "Haushalt", value: -120.5, actual: -120.5, plan: -150 },
    { name: "PV-Anlage", value: -45, actual: -45, plan: -60 },
    { name: "Hunde", value: -18.9, actual: -18.9, plan: -25 },
    { name: "Sonstiges", value: -72.2, actual: -72.2, plan: -80 },
  ],
  categories: [
    { name: "Lebensmittel", value: -612.4, actual: -612.4, plan: -700, icon: "cart" },
    { name: "Wohnen", value: -540, actual: -540, plan: -560, icon: "household" },
    { name: "Strom (inkl. PV)", value: -221.3, actual: -221.3, plan: -240, icon: "bolt" },
    { name: "Hunde", value: -183.9, actual: -183.9, plan: -200, icon: "paw" },
    { name: "Mobilität", value: -142.6, actual: -142.6, plan: -180, icon: "car" },
    { name: "Sonstiges", value: -234.4, actual: -234.4, plan: -260, icon: "tasks" },
  ],
  trend: {
    planned: [0, 380, 1000, 1600, 2200, 2800, 3400, 3900, 4500, 5200, 6000],
    forecast: [0, 420, 1100, 1800, 2500, 3000, 3500, 3900, 4300, 4600, 4900],
    actual: [0, 290, 690, 1020, 1430, 1710, 1980, 2300, 2400],
    max_value: 8000,
    min_value: 0,
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

function catalogKindSingularLabel(kind) {
  return {
    categories: "Kategorie",
    areas: "Bereich",
    projects: "Projekt",
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
  const values = series.flat().map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const min = Math.min(0, Number(trend.min_value ?? 0), ...values);
  const max = Math.max(0, Number(trend.max_value ?? 0), ...values);
  const range = Math.max(1, max - min);
  const count = Math.max(2, ...series.map((values) => values.length));
  const point = (value, index) => `${left + (index / (count - 1)) * plotWidth},${top + plotHeight - ((Number(value) - min) / range) * plotHeight}`;
  const points = (values) => values.map(point).join(" ");
  const todayIndex = Math.min(count - 1, Math.max(0, Number(trend.today_index || 0)));
  const todayX = left + (todayIndex / (count - 1)) * plotWidth;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = top + plotHeight - ratio * plotHeight;
    const label = Math.round(min + range * ratio).toLocaleString("de-DE");
    return `<line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"></line><text class="chart-axis-label" x="0" y="${y + 4}">${label}</text>`;
  }).join("");
  const dots = (values, className) => values.map((value, index) => `<circle class="chart-dot ${className}" cx="${point(value, index).split(",")[0]}" cy="${point(value, index).split(",")[1]}" r="${className.includes("planned") ? 3.2 : 4}"></circle>`).join("");
  return `<svg role="img" aria-labelledby="trend-title trend-description" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
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
  const demoComparison = (entries) => entries.map((entry) => {
    const plan = Number(entry.plan || 0);
    const actual = Number(entry.actual ?? entry.value ?? 0);
    return { key: `name:${entry.name}`, name: entry.name, plan, forecast: actual, actual,
      variance: actual - plan, forecast_variance: actual - plan,
      variance_percent: plan ? (actual - plan) / Math.abs(plan) * 100 : null };
  });
  return {
    ...fallbackOverview,
    ...data,
    household: liveData
      ? { income: 0, expenses: 0, savings: 0, available: 0, ...(data?.household || {}) }
      : { ...demoHousehold, ...(data?.household || {}) },
    trend: { ...fallbackOverview.trend, ...(data?.trend || {}) },
    areas: data?.areas?.length ? data.areas : liveData ? [] : fallbackOverview.areas,
    categories: data?.categories?.length ? data.categories : liveData ? [] : fallbackOverview.categories,
    comparison: data?.comparison ?? (liveData ? {} : {
      categories: demoComparison(data?.categories ?? fallbackOverview.categories),
      areas: demoComparison(data?.areas ?? fallbackOverview.areas),
      projects: [],
    }),
  };
}

function planShareCaption(value, plan, fallback) {
  const planned = Number(plan) || 0;
  if (!planned) return fallback;
  const share = Math.abs((Number(value) || 0) / planned) * 100;
  return `${share.toLocaleString("de-DE", { maximumFractionDigits: 0 })} % vom Plan`;
}

class FinanzplanerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._month = new Date();
    this._data = fallbackOverview;
    this._view = "overview";
    this._comparisonDimension = "categories";
    this._reportView = "month";
    this._report = null;
    this._reportLoading = false;
    this._reportLoadFailed = false;
    this._reportRequest = null;
    this._breakdownSelection = null;
    this._breakdown = null;
    this._breakdownLoading = false;
    this._breakdownError = "";
    this._overviewRequest = null;
    this._accounts = [];
    this._accountsLoading = false;
    this._accountsLoadFailed = false;
    this._planItems = [];
    this._planItemsLoading = false;
    this._planItemsLoadFailed = false;
    this._planItemDrafts = new Map();
    this._planItemSubmissions = new Set();
    this._planItemErrors = new Map();
    this._planItemEditorId = null;
    this._bookings = [];
    this._bookingTotal = 0;
    this._resolvedTotal = 0;
    this._bookingHistoryPage = { review: 0, resolved: 0 };
    this._bookingHistoryPageSize = { review: 25, resolved: 25 };
    this._bookingHistoryFilters = { q: "", from: "", to: "", status: "", account_id: "", target: "", category_id: "", area_id: "", project_id: "" };
    this._imports = [];
    this._importsLoading = false;
    this._reviewLoading = false;
    this._reviewLoadFailed = false;
    this._resolvedBookings = [];
    this._resolvedLoading = false;
    this._resolvedLoadFailed = false;
    this._bookingDetail = null;
    this._bookingDetailLoading = false;
    this._bookingDetailError = "";
    this._bookingDetailRawVisible = false;
    this._bookingDetailTrigger = null;
    this._bookingDetailRequest = null;
    this._bookingDetailId = null;
    this._selectedReviewBookings = new Set();
    this._selectedResolvedBookings = new Set();
    this._deletingBookings = false;
    this._exportingBookings = false;
    this._ruleApplying = false;
    this._unresolvingBookings = new Set();
    this._resolvedEditingBookings = new Set();
    this._resolvedEditTriggers = new Map();
    this._repairSubmitting = new Set();
    this._repairErrors = new Map();
    this._rules = [];
    this._rulesLoading = false;
    this._rulesLoadFailed = false;
    this._rulesRequest = null;
    this._ruleEditingId = null;
    this._ruleMessage = "";
    this._ruleDraft = null;
    this._ruleBaseline = null;
    this._ruleSourceBookingId = null;
    this._ruleSubmitting = false;
    this._ruleTouched = new Set();
    this._ruleSubmitAttempted = false;
    this._acceptedSuggestions = new Set();
    this._confirmedBookings = new Map();
    this._persons = [];
    this._allocationDrafts = new Map();
    this._allocationOriginalDrafts = new Map();
    this._allocationSubmissions = new Set();
    this._allocationErrors = new Map();
    this._accountDrafts = new Map();
    this._accountSubmissions = new Set();
    this._accountEditorId = null;
    this._pets = [];
    this._petsLoading = false;
    this._petsLoadFailed = false;
    this._petDrafts = new Map();
    this._petSubmissions = new Set();
    this._petErrors = new Map();
    this._petEditorId = null;
    this._feedProfiles = [];
    this._feedProfilesLoading = false;
    this._feedProfilesLoadFailed = false;
    this._feedProfileDrafts = new Map();
    this._feedProfileSubmissions = new Set();
    this._feedProfileErrors = new Map();
    this._feedProfileEditorId = null;
    this._catalogs = { categories: [], areas: [], projects: [] };
    this._catalogsLoading = false;
    this._catalogsLoadFailed = false;
    this._catalogDrafts = new Map();
    this._catalogSubmissions = new Set();
    this._catalogErrors = new Map();
    this._catalogOverviewKind = "categories";
    this._catalogEditor = null;
    this._excelPreview = null;
    this._sectionLoading = false;
    this._sectionLoadFailed = false;
    this._message = "";
    this._feedbackTimer = null;
    this._confirmDialogPromise = null;
    this._loading = false;
    this._handleBeforeUnload = (event) => {
      if (!this._hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
  }

  connectedCallback() {
    window.addEventListener("beforeunload", this._handleBeforeUnload);
    this._render();
    this._loadOverview();
    this._loadReport("month");
    this._loadRules().catch(() => {}).finally(() => {
      if (this.isConnected && ["rules", "review", "resolved"].includes(this._view)) this._render();
    });
  }

  disconnectedCallback() {
    window.removeEventListener("beforeunload", this._handleBeforeUnload);
    this._clearFeedbackTimer();
    this.shadowRoot.querySelector("[data-confirm-dialog]")?.close();
    this._bookingDetailRequest = null;
    this.shadowRoot.querySelector("[data-booking-detail-dialog]")?.close();
    this._clearBreakdown();
    this._overviewRequest = null;
  }

  set hass(value) {
    this._hass = value;
  }

  _monthValue() {
    return `${this._month.getFullYear()}-${String(this._month.getMonth() + 1).padStart(2, "0")}`;
  }

  async _loadOverview() {
    const request = { month: this._monthValue() };
    this._overviewRequest = request;
    this._loading = true;
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${OVERVIEW_URL}?month=${request.month}`);
      const result = await readApiResponse(response);
      if (this._overviewRequest !== request || this._monthValue() !== request.month) return;
      if (!response.ok) throw new Error(apiErrorMessage(result, `HTTP ${response.status}`));
      this._data = dataWithDefaults(result);
      this._message = "";
    } catch (error) {
      if (this._overviewRequest !== request || this._monthValue() !== request.month) return;
      this._data = dataWithDefaults(fallbackOverview);
      this._message = `Demo-Ansicht aktiv: ${error.message || "Die Finanzplaner-API ist noch nicht erreichbar."}`;
    } finally {
      if (this._overviewRequest === request && this._monthValue() === request.month) {
        this._loading = false;
        if (this.isConnected) this._render();
      }
    }
  }

  _clearBreakdown() {
    this._breakdownSelection = null;
    this._breakdown = null;
    this._breakdownLoading = false;
    this._breakdownError = "";
  }

  _setComparisonDimension(dimension) {
    if (!["categories", "areas", "projects"].includes(dimension)) return;
    this._comparisonDimension = dimension;
    this._clearBreakdown();
    this._render();
    this.shadowRoot.querySelector(`[data-comparison-dimension="${dimension}"]`)?.focus();
  }

  _closeBreakdown() {
    const key = this._breakdownSelection?.key;
    this._clearBreakdown();
    this._render();
    [...this.shadowRoot.querySelectorAll("[data-comparison-detail]")]
      .find((button) => button.dataset.comparisonDetail === key)?.focus();
  }

  _bookingDetailLabel(key) {
    const labels = { sender: "Absender", counterparty: "Zahlungsempfänger", recipient: "Empfänger", booking_accounts: "Konten der Buchung" };
    if (Object.hasOwn(labels, key)) return labels[key];
    return String(key).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  _reportRange(view) {
    const year = this._month.getFullYear();
    const month = this._month.getMonth();
    const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (view === "year" || view === "cashflow") return { from: `${year}-01-01`, to: `${year}-12-31` };
    return { from: `${year}-${String(month + 1).padStart(2, "0")}-01`, to: iso(new Date(year, month + 1, 0)) };
  }

  async _loadReport(view = this._reportView) {
    if (!["month", "year", "cashflow"].includes(view)) return;
    const range = this._reportRange(view);
    const request = { view, ...range };
    this._reportRequest = request;
    this._reportView = view;
    this._reportLoading = true;
    this._reportLoadFailed = false;
    this._report = null;
    if (this.isConnected) this._render();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, reportRequestUrl(REPORT_URL, range.from, range.to, view));
      const result = await readApiResponse(response);
      if (this._reportRequest !== request) return;
      if (!response.ok) throw new Error(apiErrorMessage(result, `HTTP ${response.status}`));
      this._report = result.report || null;
    } catch (error) {
      if (this._reportRequest !== request) return;
      this._reportLoadFailed = true;
      this._message = error.message || "Der Bericht konnte nicht geladen werden.";
    } finally {
      if (this._reportRequest === request) {
        this._reportLoading = false;
        if (this.isConnected) this._render();
      }
    }
  }

  _reportTemplate() {
    if (this._reportLoading) return `<section class="surface report-card" aria-live="polite"><h3>Bericht</h3><p class="empty-state" role="status">${this._reportView === "cashflow" ? "Cashflow" : this._reportView === "year" ? "Jahresbericht" : "Monatsbericht"} wird geladen …</p></section>`;
    if (this._reportLoadFailed) return `<section class="surface report-card" aria-live="assertive"><h3>Bericht</h3><p class="empty-state" role="alert">${escapeHtml(this._message || "Der Bericht konnte nicht geladen werden.")}</p><button class="table-edit-button" type="button" data-report-retry>Erneut laden</button></section>`;
    if (!this._report || (this._reportView === "cashflow" && !this._report.cashflow?.length)) return `<section class="surface report-card"><h3>Bericht</h3><p class="empty-state">Für diesen Zeitraum liegen noch keine Berichtsdaten vor.</p></section>`;
    if (this._reportView === "cashflow") {
      const rows = (this._report.cashflow || []).map((entry) => `<tr><th scope="row">${escapeHtml(entry.month)}</th><td class="table-number">${formatEuro(entry.income)}</td><td class="table-number">${formatEuro(entry.expenses)}</td><td class="table-number">${formatEuro(entry.savings)}</td><td class="table-number">${formatEuro(entry.actual)}</td></tr>`).join("");
      return `<section class="surface report-card" aria-labelledby="report-heading"><h3 id="report-heading">Cashflow</h3><div class="management-table-wrap" tabindex="0" role="region" aria-label="Cashflow, horizontal scrollbar"><table class="management-table"><caption class="visually-hidden">Monatlicher Cashflow</caption><thead><tr><th scope="col">Monat</th><th scope="col">Einnahmen</th><th scope="col">Ausgaben</th><th scope="col">Rücklagen</th><th scope="col">Ist</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }
    const rows = Object.entries(this._report).filter(([key]) => ["plan", "forecast", "actual", "variance", "unresolved_total"].includes(key));
    return `<section class="surface report-card" aria-labelledby="report-heading"><h3 id="report-heading">${this._reportView === "year" ? "Jahresbericht" : "Monatsbericht"}</h3><div class="management-table-wrap" tabindex="0" role="region" aria-label="Berichtswerte, horizontal scrollbar"><table class="management-table"><caption class="visually-hidden">Berichtswerte für den ausgewählten Zeitraum</caption><thead><tr><th scope="col">Wert</th><th scope="col">Betrag</th></tr></thead><tbody>${rows.map(([key, value]) => `<tr><th scope="row">${escapeHtml({ plan: "Plan", forecast: "Prognose", actual: "Ist", variance: "Abweichung", unresolved_total: "Offener Betrag" }[key] || key)}</th><td class="table-number">${formatEuro(value)}</td></tr>`).join("")}</tbody></table></div></section>`;
  }

  _bookingAccountInlineTemplate(accounts, side, className = "booking-account-inline") {
    const label = String(accounts?.[side]?.label || "").trim();
    return label ? ` <span class="${className}">(${escapeHtml(label)})</span>` : "";
  }

  _bookingAccountPairDetailsTemplate(accounts) {
    const sender = accounts?.sender;
    const recipient = accounts?.recipient;
    const value = (account) => {
      if (!account) return '<span class="booking-detail-empty">Nicht vorhanden</span>';
      const label = String(account.label || account.account_reference || "Nicht vorhanden");
      const reference = String(account.account_reference || "").trim();
      return `<strong>${escapeHtml(label)}</strong>${reference ? `<span class="booking-account-reference">Kontoreferenz: ${escapeHtml(reference)}</span>` : ""}`;
    };
    return `<dl class="booking-detail-fields"><div><dt>Absenderkonto</dt><dd>${value(sender)}</dd></div><div><dt>Empfängerkonto</dt><dd>${value(recipient)}</dd></div></dl>`;
  }

  _bookingDetailStatusLabel(status) {
    return ({ unresolved: "Manuelle Zuordnung erforderlich", suggested: "Regelvorschlag vorhanden", conflict: "Regelkonflikt", resolved: "Übernommen" })[status] || "Prüfung erforderlich";
  }

  _bookingDetailValueTemplate(value, path = "Buchungsfeld") {
    if (value === null || value === undefined || value === "") return '<span class="booking-detail-empty">Nicht vorhanden</span>';
    if (Array.isArray(value)) {
      return value.length ? '<ul class="booking-detail-list">' + value.map((item, index) => '<li><span class="booking-detail-key">' + escapeHtml(path + " " + (index + 1)) + '</span>' + this._bookingDetailValueTemplate(item, path) + '</li>').join("") + '</ul>' : '<span class="booking-detail-empty">Nicht vorhanden</span>';
    }
    if (typeof value === "object" && Object.keys(value).length === 0) return '<span class="booking-detail-empty">Nicht vorhanden</span>';
    if (typeof value === "object") return '<dl class="booking-detail-nested">' + Object.entries(value).map(([key, item]) => '<div><dt>' + escapeHtml(this._bookingDetailLabel(key)) + '</dt><dd>' + this._bookingDetailValueTemplate(item, key) + '</dd></div>').join("") + '</dl>';
    return '<span>' + escapeHtml(String(value)) + '</span>';
  }

  _bookingDetailFieldsTemplate(record) {
    const fields = Object.entries(record || {}).filter(([key]) => key !== "source_data");
    return fields.length ? '<dl class="booking-detail-fields">' + fields.map(([key, value]) => '<div><dt>' + escapeHtml(this._bookingDetailLabel(key)) + '</dt><dd>' + this._bookingDetailValueTemplate(value, key) + '</dd></div>').join("") + '</dl>' : '<span class="booking-detail-empty">Nicht vorhanden</span>';
  }

  _bookingDetailDialogTemplate() {
    if (this._bookingDetailLoading) return '<section class="booking-detail-section" aria-live="polite"><header class="booking-detail-header"><h2 id="booking-detail-title">Buchungsdetails</h2><button type="button" class="icon-button" data-booking-detail-close aria-label="Buchungsdetails schließen">Schließen</button></header><p id="booking-detail-description" class="booking-detail-status">Buchungsdetails werden geladen …</p></section>';
    if (this._bookingDetailError) return '<section class="booking-detail-section" aria-live="assertive"><div><h2 id="booking-detail-title">Buchungsdetails</h2><p id="booking-detail-description" class="booking-detail-error">' + escapeHtml(this._bookingDetailError) + '</p></div><div class="booking-detail-actions"><button type="button" data-booking-detail-close>Schließen</button></div></section>';
    if (!this._bookingDetail) return '<section class="booking-detail-section"><h2 id="booking-detail-title">Buchungsdetails</h2><p id="booking-detail-description" class="booking-detail-status">Keine Buchungsdetails vorhanden.</p><div class="booking-detail-actions"><button type="button" data-booking-detail-close>Schließen</button></div></section>';
    const { booking, account, details } = this._bookingDetail;
    const bookingFields = Object.fromEntries(Object.entries(booking || {}).filter(([key]) => key !== "booking_accounts"));
    const status = details?.status || booking?.status;
    const rawMarkup = this._bookingDetailRawVisible ? '<section class="booking-detail-section"><h3>Rohdaten</h3><pre class="booking-detail-raw" data-booking-raw></pre></section>' : '';
    const legacyNotice = this._bookingDetail.source_data == null
      ? '<p class="booking-detail-legacy" role="note">Für diese Buchung fehlen Quelldaten, weil sie aus einem alten Import stammt.</p>'
      : '';
    return `<header class="booking-detail-header"><div><h2 id="booking-detail-title">Buchungsdetails</h2><p id="booking-detail-description" class="booking-detail-description">${escapeHtml(String(booking?.counterparty || booking?.purpose || "Buchung"))}</p></div><button type="button" class="icon-button" data-booking-detail-close aria-label="Buchungsdetails schließen">Schließen</button></header>${legacyNotice}<section class="booking-detail-section"><h3>Buchung</h3>${this._bookingDetailFieldsTemplate(bookingFields)}</section>${booking?.booking_accounts ? `<section class="booking-detail-section"><h3>Konten der Buchung</h3>${this._bookingAccountPairDetailsTemplate(booking.booking_accounts)}</section>` : ""}<section class="booking-detail-section"><h3>Konto</h3>${this._bookingDetailFieldsTemplate(account)}</section><section class="booking-detail-section"><h3>Status und Zuordnung</h3><p class="booking-detail-status">${escapeHtml(this._bookingDetailStatusLabel(status))}</p>${this._bookingDetailFieldsTemplate(details)}</section>${rawMarkup}<div class="booking-detail-actions"><button type="button" data-booking-raw-toggle aria-pressed="${this._bookingDetailRawVisible ? "true" : "false"}">${this._bookingDetailRawVisible ? "Rohdaten ausblenden" : "Rohdaten anzeigen"}</button><button type="button" data-booking-detail-close>Schließen</button></div>`;
  }

  _renderBookingDetailDialog({ focusRawToggle = false } = {}) {
    const content = this.shadowRoot.querySelector("[data-booking-detail-content]");
    if (!content) return;
    content.innerHTML = this._bookingDetailDialogTemplate();
    const rawNode = content.querySelector("[data-booking-raw]");
    if (rawNode && this._bookingDetail) rawNode.textContent = bookingDetailRawJson(this._bookingDetail);
    if (focusRawToggle) content.querySelector("[data-booking-raw-toggle]")?.focus();
  }

  _closeBookingDetails() {
    const dialog = this.shadowRoot.querySelector("[data-booking-detail-dialog]");
    const trigger = this._bookingDetailTrigger;
    const bookingId = this._bookingDetailId || trigger?.dataset?.bookingDetails;
    this._bookingDetailRequest = null;
    this._bookingDetail = null;
    this._bookingDetailLoading = false;
    this._bookingDetailError = "";
    this._bookingDetailRawVisible = false;
    this._bookingDetailTrigger = null;
    this._bookingDetailId = null;
    if (dialog?.open) dialog.close();
    this._render();
    const focusTarget = trigger?.isConnected
      ? trigger
      : [...this.shadowRoot.querySelectorAll("[data-booking-details]")]
        .find((button) => button.dataset.bookingDetails === bookingId);
    focusTarget?.focus();
  }

  async _openBookingDetails(bookingId, trigger) {
    const dialog = this.shadowRoot.querySelector("[data-booking-detail-dialog]");
    if (!dialog || typeof dialog.showModal !== "function" || this._bookingDetailRequest) return;
    const request = {};
    this._bookingDetailRequest = request;
    this._bookingDetail = null;
    this._bookingDetailLoading = true;
    this._bookingDetailError = "";
    this._bookingDetailRawVisible = false;
    this._bookingDetailTrigger = trigger;
    this._bookingDetailId = String(bookingId);
    this._renderBookingDetailDialog();
    dialog.showModal();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, bookingDetailsRequestUrl(BOOKINGS_URL, bookingId));
      const result = await readApiResponse(response);
      if (this._bookingDetailRequest !== request) return;
      if (!response.ok) throw new Error(apiErrorMessage(result, "Die Buchungsdetails konnten nicht geladen werden."));
      this._bookingDetail = result;
    } catch (error) {
      if (this._bookingDetailRequest !== request) return;
      this._bookingDetailError = error.message || "Die Buchungsdetails konnten nicht geladen werden.";
    } finally {
      if (this._bookingDetailRequest === request) {
        this._bookingDetailLoading = false;
        this._renderBookingDetailDialog();
      }
    }
  }

  async _loadBreakdown(dimension, key) {
    if (this._view !== "overview" || this._loading || dimension !== this._comparisonDimension || this._data.demo !== false) return;
    const selection = { month: this._monthValue(), dimension, key };
    this._breakdownSelection = selection;
    this._breakdown = null;
    this._breakdownLoading = true;
    this._breakdownError = "";
    this._message = "";
    const current = () => this._view === "overview" && this._breakdownSelection === selection
      && this._monthValue() === selection.month && this._comparisonDimension === dimension;
    this._render();
    this.shadowRoot.querySelector("#comparison-details-heading")?.focus();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, breakdownRequestUrl(BREAKDOWN_URL, selection.month, dimension, key));
      const result = await readApiResponse(response);
      if (!current()) return;
      if (!response.ok) throw new Error(apiErrorMessage(result, `HTTP ${response.status}`));
      this._breakdown = result;
    } catch (error) {
      if (!current()) return;
      this._breakdownError = `Vergleich konnte nicht geladen werden: ${error.message || "Bitte erneut laden."}`;
      this._message = this._breakdownError;
    } finally {
      if (current()) {
        this._breakdownLoading = false;
        this._render();
      }
    }
  }

  async _openReview() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    if (this._bookingDetailRequest || this._bookingDetailTrigger) this._closeBookingDetails();
    this._view = "review";
    this._bookingHistoryFilters.status = "unresolved";
    this._message = "";
    this._selectedReviewBookings.clear();
    this._reviewLoading = true;
    this._reviewLoadFailed = false;
    this._render();
    this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true });
    try {
      await this._loadReviewData();
    } catch (error) {
      this._bookings = [];
      this._persons = [];
      this._message = error.message || "Die Prüfliste konnte nicht geladen werden.";
      this._reviewLoadFailed = true;
    }
    this._reviewLoading = false;
    this._render();
    this._focusContent();
  }

  async _openResolvedBookings() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    if (this._bookingDetailRequest || this._bookingDetailTrigger) this._closeBookingDetails();
    this._view = "resolved";
    this._bookingHistoryFilters.status = "resolved";
    this._message = "";
    this._selectedResolvedBookings.clear();
    this._resolvedLoading = true;
    this._resolvedLoadFailed = false;
    this._render();
    this._focusContent();
    try {
      await this._loadResolvedBookings();
    } catch (error) {
      this._resolvedBookings = [];
      this._message = error.message || "Die übernommenen Buchungen konnten nicht geladen werden.";
      this._resolvedLoadFailed = true;
    }
    this._resolvedLoading = false;
    this._render();
    this._focusContent();
  }

  async _applyRules() {
    if (this._ruleApplying) return;
    this._ruleApplying = true;
    this._message = "Regeln werden erneut angewendet …";
    this._render();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, APPLY_RULES_URL, { method: "POST" });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Die Regeln konnten nicht angewendet werden."));
      await this._loadReviewData();
      await this._loadOverview();
      this._message = `${result.applied || 0} übernommen, ${result.conflicts || 0} Regelkonflikte, ${result.unresolved || 0} weiterhin ungeklärt.`;
    } catch (error) {
      this._message = error.message || "Die Regeln konnten nicht erneut angewendet werden.";
    } finally {
      this._ruleApplying = false;
      this._render();
      this._focusContent();
    }
  }

  async _openSectionOverview(view) {
    if (!SECTION_VIEWS.includes(view) || !(await this._confirmDiscardUnsavedChanges())) return;
    this._view = view;
    this._message = "";
    this._sectionLoading = view === "people";
    this._sectionLoadFailed = false;
    this._render();
    this._focusContent();
    if (view !== "people") return;
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, PERSONS_URL);
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, `HTTP ${response.status}`));
      this._persons = Array.isArray(result.persons) ? result.persons : [];
    } catch (error) {
      if (this._view === view) {
        this._persons = [];
        this._sectionLoadFailed = true;
        this._message = error.message || "Personen konnten nicht geladen werden.";
      }
    } finally {
      if (this._view === view) {
        this._sectionLoading = false;
        this._render();
        this._focusContent();
      }
    }
  }

  async _loadRules({ fresh = false } = {}) {
    if (this._rulesRequest && !fresh) return this._rulesRequest;
    this._rulesLoading = true;
    this._rulesLoadFailed = false;
    const request = Promise.all([RULES_URL, ACCOUNTS_URL, PERSONS_URL, PETS_URL, CATALOGS_URL].map(async (url) => {
      const response = await fetchWithHomeAssistantAuth(this._hass, url);
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Regeln oder Zuordnungsziele konnten nicht geladen werden."));
      return result;
    }));
    this._rulesRequest = request;
    try {
      const results = await request;
      // A mutation's fresh read owns the snapshot, even if an older read finishes later.
      if (this._rulesRequest !== request) return;
      const [rules, accounts, persons, pets, catalogs] = results;
      this._rules = rules.rules || [];
      this._accounts = accounts.accounts || [];
      this._persons = persons.persons || [];
      this._pets = pets.pets || [];
      this._catalogs = catalogs.catalogs || { categories: [], areas: [], projects: [] };
    } catch (error) {
      if (this._rulesRequest !== request) return;
      this._rulesLoadFailed = true;
      this._ruleMessage = error.message || "Regeln konnten nicht geladen werden. Bitte erneut laden.";
      throw error;
    } finally {
      if (this._rulesRequest === request) {
        this._rulesLoading = false;
        this._rulesRequest = null;
      }
    }
  }

  async _openRules() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._view = "rules";
    this._resetRuleEditor();
    this._ruleMessage = "";
    const loading = this._loadRules();
    this._render();
    this._focusContent();
    try { await loading; } catch { /* The rules status contains the load error. */ }
    if (this._view === "rules") {
      this._render();
      this._focusContent();
    }
  }

  _resetRuleEditor() {
    this._ruleEditingId = null;
    this._ruleDraft = null;
    this._ruleBaseline = null;
    this._ruleSourceBookingId = null;
    this._ruleTouched.clear();
    this._ruleSubmitAttempted = false;
  }

  _ruleDraftFromRule(rule = {}) {
    return {
      label: rule.label || "", active: rule.active !== false,
      priority: String(rule.priority ?? 100), account_id: rule.account_id || "",
      counterparty: rule.counterparty || "", purpose_contains: rule.purpose_contains || "",
      direction: rule.direction || "", counterparty_account: rule.counterparty_account || "",
      amount_min: rule.amount_min == null ? "" : String(rule.amount_min),
      amount_max: rule.amount_max == null ? "" : String(rule.amount_max),
      allocations: (rule.allocations || [{ target: "household", share_percent: 100 }]).map((row) => ({
        target: row.target || "", share_percent: String(row.share_percent ?? ""),
        area_id: row.area_id || "", category_id: row.category_id || "",
        project_id: row.project_id || "", pet_id: row.pet_id || "",
      })),
    };
  }

  async _openRuleEditor(ruleId) {
    if (this._rulesLoading || this._rulesLoadFailed || !(await this._confirmDiscardUnsavedChanges())) return;
    const rule = this._rules.find((candidate) => String(candidate.id) === String(ruleId));
    if (ruleId !== "new" && !rule) return;
    this._resetRuleEditor();
    this._ruleEditingId = String(ruleId);
    this._ruleDraft = this._ruleDraftFromRule(rule);
    this._ruleBaseline = this._ruleDraftFromRule(rule);
    this._ruleMessage = "";
    this._render();
    this.shadowRoot.querySelector("#rule-label")?.focus();
  }

  async _closeRuleEditor() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._resetRuleEditor();
    this._ruleMessage = "";
    this._render();
    this._focusContent();
  }

  async _openRuleFromBooking(bookingId) {
    const booking = this._confirmedBookings.get(String(bookingId));
    if (!booking || booking.status !== "resolved" || !(await this._confirmDiscardUnsavedChanges())) return;
    await this._openRules();
    if (this._view !== "rules" || this._rulesLoadFailed) return;
    const total = Math.abs(Number(booking.amount));
    const allocations = booking.allocations.map((row) => ({ ...row, share_percent: Math.round(Number(row.amount) / total * 10000) / 100 }));
    if (allocations.length) {
      const assigned = allocations.reduce((sum, row) => sum + Math.round(row.share_percent * 100), 0);
      allocations[0].share_percent = (Math.round(allocations[0].share_percent * 100) + 10000 - assigned) / 100;
    }
    const counterparty = String(booking.counterparty || "").trim();
    const purpose = String(booking.purpose || "").trim();
    this._ruleEditingId = "new";
    this._ruleSourceBookingId = String(bookingId);
    this._ruleDraft = this._ruleDraftFromRule({
      label: counterparty || purpose.slice(0, 120) || "Buchungsregel", counterparty,
      account_id: booking.account_id, purpose_contains: purpose, allocations,
    });
    this._ruleBaseline = this._ruleDraftFromRule();
    this._ruleMessage = "Vorlage aus der bestätigten Buchung. Prüfe die Angaben und speichere die Regel ausdrücklich.";
    this._render();
    this.shadowRoot.querySelector("#rule-label")?.focus();
  }

  _ruleValidationErrors(draft) {
    const errors = {};
    for (const [key, label, maxLength] of [["label", "Regelname", 120], ["purpose_contains", "Verwendungszweckfilter", 160]]) {
      const text = String(draft[key] || "").trim().replace(/\s+/gu, " ");
      if (key === "label" && !text) errors[key] = `${label} fehlt.`;
      else if (text.length > maxLength) errors[key] = `Bitte höchstens ${maxLength} Zeichen eingeben.`;
    }
    const counterparty = String(draft.counterparty || "").trim().replace(/\s+/gu, " ");
    if (counterparty.length > 160) errors.counterparty = "Bitte höchstens 160 Zeichen eingeben.";
    const account = String(draft.account_id || "").trim();
    const purpose = String(draft.purpose_contains || "").trim().replace(/\s+/gu, " ");
    const direction = String(draft.direction || "");
    const counterpartyAccount = String(draft.counterparty_account || "").trim();
    const amountMin = draft.amount_min === "" ? null : Number(draft.amount_min);
    const amountMax = draft.amount_max === "" ? null : Number(draft.amount_max);
    if (!account && !counterparty && !purpose && !counterpartyAccount && !direction && amountMin == null && amountMax == null) errors.conditions = "Eine Regel benötigt mindestens eine Bedingung.";
    if (direction && !["income", "expense"].includes(direction)) errors.direction = "Bitte Einnahme oder Ausgabe wählen.";
    if (counterpartyAccount.length > 80) errors.counterparty_account = "Bitte höchstens 80 Zeichen eingeben.";
    if (amountMin != null && (!Number.isFinite(amountMin) || amountMin < 0)) errors.amount_min = "Bitte einen positiven Mindestbetrag eingeben.";
    if (amountMax != null && (!Number.isFinite(amountMax) || amountMax < 0)) errors.amount_max = "Bitte einen positiven Höchstbetrag eingeben.";
    if (amountMin != null && amountMax != null && amountMin > amountMax) errors.amount_max = "Der Höchstbetrag muss mindestens dem Mindestbetrag entsprechen.";
    const priority = Number(draft.priority);
    if (String(draft.priority).trim() === "" || !Number.isSafeInteger(priority) || priority < 0 || priority > 1000) errors.priority = "Bitte eine ganze Zahl von 0 bis 1000 eingeben.";
    if (draft.account_id && !this._accounts.some((account) => account.id === draft.account_id && account.active !== false)) errors.account_id = "Konto fehlt oder ist archiviert. Bitte ein aktives Konto oder alle Konten wählen.";
    const targets = new Set(["household", ...this._persons.map((person) => person.entity_id)]);
    const seen = new Set();
    let total = 0;
    draft.allocations.forEach((row, index) => {
      if (!targets.has(row.target)) errors[`${index}-target`] = "Person fehlt. Bitte ein verfügbares Ziel wählen.";
      else if (seen.has(row.target)) errors[`${index}-target`] = "Jedes Ziel darf nur einmal vorkommen.";
      seen.add(row.target);
      const share = Number(row.share_percent);
      if (!Number.isFinite(share) || share < 0.01 || share > 100 || Number(share.toFixed(2)) !== share) errors[`${index}-share_percent`] = "Bitte einen Anteil von 0,01 bis 100,00 mit höchstens zwei Nachkommastellen eingeben.";
      total += Math.round(share * 100);
      for (const [key, entries] of [
        ["area_id", this._catalogs.areas], ["category_id", this._catalogs.categories],
        ["project_id", this._catalogs.projects], ["pet_id", this._pets],
      ]) {
        if (row[key] && !(entries || []).some((entry) => entry.id === row[key] && entry.active !== false)) {
          errors[`${index}-${key}`] = "Eintrag fehlt oder ist archiviert. Bitte ersetzen oder die Zuordnung entfernen.";
        }
      }
    });
    if (!draft.allocations.length || total !== 10000) errors.allocations = "Die Anteile müssen zusammen 100 % ergeben.";
    return errors;
  }

  _ruleHasChanges() {
    return Boolean(this._ruleDraft) && !this._draftsEqual(this._ruleDraft, this._ruleBaseline);
  }

  _syncRuleFormState(form = this.shadowRoot.querySelector("[data-rule-form]")) {
    if (!form || !this._ruleDraft) return;
    const errors = this._ruleValidationErrors(this._ruleDraft);
    for (const input of form.querySelectorAll("[data-rule-field]")) {
      const key = input.dataset.ruleIndex === undefined ? input.dataset.ruleField : `${input.dataset.ruleIndex}-${input.dataset.ruleField}`;
      const error = errors[key] || (input.dataset.ruleField === "share_percent" ? errors.allocations : "") || "";
      input.setCustomValidity(error);
      const visible = Boolean(error) && (this._ruleSubmitAttempted || this._ruleTouched.has(key));
      input.setAttribute("aria-invalid", String(visible));
      const errorNode = form.querySelector(`[id="${input.id}-error"]`);
      if (errorNode) errorNode.textContent = visible ? `Fehler: ${error}` : "";
    }
    const total = this._ruleDraft.allocations.reduce((sum, row) => sum + Number(row.share_percent), 0);
    const summary = form.querySelector("[data-rule-share-summary]");
    if (summary) summary.textContent = `Anteilssumme: ${Number.isFinite(total) ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(total) : "—"} % von 100 %`;
    const allocationError = form.querySelector("#rule-allocations-error");
    if (allocationError) allocationError.textContent = (this._ruleSubmitAttempted || this._ruleTouched.size) && errors.allocations ? `Fehler: ${errors.allocations}` : "";
    const conditionsError = form.querySelector("[data-rule-conditions-error]");
    if (conditionsError) conditionsError.textContent = (this._ruleSubmitAttempted || this._ruleTouched.size) && errors.conditions ? `Fehler: ${errors.conditions}` : "";
    const submit = form.querySelector("[type='submit']");
    if (submit) submit.disabled = this._ruleSubmitting || !this._ruleHasChanges();
    const state = form.querySelector("[data-rule-save-state]");
    if (state) state.textContent = this._ruleSubmitting ? "Wird gespeichert …" : this._ruleSubmitAttempted && Object.keys(errors).length ? "Fehlerhaft – bitte die markierten Angaben prüfen." : this._ruleHasChanges() ? "Geändert – noch nicht gespeichert." : "Unverändert.";
  }

  _updateRuleField(event) {
    if (this._ruleSubmitting || !this._ruleDraft) return;
    const input = event.target;
    const field = input.dataset.ruleField;
    if (!field) return;
    const index = input.dataset.ruleIndex;
    const key = index === undefined ? field : `${index}-${field}`;
    if (index === undefined) this._ruleDraft[field] = field === "active" ? input.value === "true" : input.value;
    else this._ruleDraft.allocations[Number(index)][field] = input.value;
    if (event.type !== "input" || this._ruleSubmitAttempted) this._ruleTouched.add(key);
    if (event.type !== "focusout") {
      this._ruleMessage = "";
      this._syncFeedbackPresenter();
    }
    this._syncRuleFormState();
  }

  _changeRuleAllocation(index = null) {
    if (this._ruleSubmitting || !this._ruleDraft) return;
    if (index === null) this._ruleDraft.allocations.push({ target: "", share_percent: "", area_id: "", category_id: "", project_id: "", pet_id: "" });
    else this._ruleDraft.allocations.splice(index, 1);
    this._ruleTouched.clear();
    this._ruleTouched.add("allocations");
    this._render();
    this.shadowRoot.querySelector(index === null ? `#rule-${this._ruleDraft.allocations.length - 1}-target` : "[data-rule-add]")?.focus();
  }

  async _postRule(url, payload) {
    const response = await fetchWithHomeAssistantAuth(this._hass, url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(apiErrorMessage(result, "Die Regel konnte nicht gespeichert werden. Bitte erneut versuchen."));
    return result;
  }

  async _handleRuleSave(event) {
    event.preventDefault();
    if (this._ruleSubmitting || !this._ruleDraft || !this._ruleHasChanges()) return;
    this._ruleSubmitAttempted = true;
    const form = event.currentTarget;
    const errors = this._ruleValidationErrors(this._ruleDraft);
    this._syncRuleFormState(form);
    const invalidInput = [...form.querySelectorAll("[data-rule-field]")].find((input) => !input.validity.valid);
    if (Object.keys(errors).length || invalidInput) {
      this._ruleMessage = "Fehlerhaft: Bitte prüfe die markierten Felder und die Anteilssumme.";
      this._syncFeedbackPresenter();
      (invalidInput || (errors.conditions ? form.querySelector('[data-rule-field="counterparty"]') : null) || form.querySelector("[data-rule-add]"))?.focus();
      return;
    }
    const payload = rulePayloadFromForm(this._ruleDraft);
    payload.allocations = payload.allocations.map((row) => ({
      ...row, share_percent: Number(row.share_percent),
      area_id: row.area_id || null, category_id: row.category_id || null,
      project_id: row.project_id || null, pet_id: row.pet_id || null,
    }));
    const sourceBookingId = this._ruleSourceBookingId;
    this._ruleSubmitting = true;
    this._ruleMessage = "Regel wird gespeichert …";
    this._render();
    try {
      // The confirmed booking only prefills the draft. Validate the edited rule
      // on the server so repaired percentages and references can be saved.
      await this._postRule(this._ruleEditingId === "new" ? RULES_URL : `${RULES_URL}/${encodeURIComponent(this._ruleEditingId)}`, payload);
    } catch (error) {
      this._ruleSubmitting = false;
      this._ruleMessage = `Fehler beim Speichern: ${error.message}`;
      this._render();
      this._focusContent();
      return;
    }
    if (sourceBookingId) this._confirmedBookings.delete(sourceBookingId);
    this._resetRuleEditor();
    this._ruleMessage = "Regel gespeichert. Bestätigte Buchungen bleiben unverändert.";
    try { await this._loadRules({ fresh: true }); } catch {
      this._ruleMessage = "Regel gespeichert. Die Übersicht konnte danach nicht geladen werden. Bitte erneut laden.";
    }
    this._ruleSubmitting = false;
    this._render();
    this._focusContent();
  }

  async _deactivateRule(ruleId) {
    if (this._ruleSubmitting) return;
    const rule = this._rules.find((entry) => String(entry.id) === String(ruleId));
    if (!rule || rule.active === false) return;
    this._ruleSubmitting = true;
    this._ruleMessage = "Regel wird deaktiviert …";
    this._render();
    try {
      await this._postRule(`${RULES_URL}/${encodeURIComponent(ruleId)}`, { active: false });
    } catch (error) {
      this._ruleSubmitting = false;
      this._ruleMessage = `Deaktivieren fehlgeschlagen: ${error.message} Öffne „Bearbeiten“, um die Angaben zu prüfen.`;
      this._render();
      this._focusContent();
      return;
    }
    this._ruleMessage = "Regel deaktiviert. Bestätigte Buchungen bleiben unverändert.";
    try { await this._loadRules({ fresh: true }); } catch {
      this._ruleMessage = "Regel deaktiviert. Die Übersicht konnte danach nicht geladen werden. Bitte erneut laden.";
    }
    this._ruleSubmitting = false;
    this._render();
    this._focusContent();
  }

  _acceptSuggestion(bookingId) {
    const booking = this._bookings.find((entry) => String(entry.id) === String(bookingId));
    if (!booking || booking.status !== "suggested" || this._allocationSubmissions.has(String(bookingId))) return;
    const accepted = acceptSuggestionDraft(booking);
    if (!accepted.allocations.length) return;
    this._allocationDrafts.set(String(accepted.bookingId), accepted.allocations);
    this._acceptedSuggestions.add(String(accepted.bookingId));
    this._allocationErrors.delete(String(accepted.bookingId));
    this._render();
    const form = this._allocationForm(bookingId);
    const status = form?.querySelector("[data-allocation-status]");
    if (status) status.textContent = "Vorschlag im Entwurf übernommen. Bitte prüfen und mit „Aufteilung speichern“ bestätigen.";
    form?.querySelector("[data-allocation-field='target']")?.focus();
  }

  _accountDraftFromAccount(account) {
    return {
      label: account.label || "",
      bank: account.bank || "",
      iban: "",
      owner_targets: Array.isArray(account.owner_targets) ? [...account.owner_targets] : [],
      active: account.active !== false,
    };
  }

  async _loadReviewData() {
    const pageSize = this._bookingHistoryPageSize.review;
    const historyUrl = bookingHistoryRequestUrl(BOOKINGS_URL, {
      ...this._bookingHistoryFilters,
      status: "unresolved",
      limit: pageSize,
      offset: pageSize ? this._bookingHistoryPage.review * pageSize : 0,
    });
    const [bookingResponse, personsResponse, petsResponse, catalogsResponse, importsResponse] = await Promise.all([
      fetchWithHomeAssistantAuth(this._hass, historyUrl),
      fetchWithHomeAssistantAuth(this._hass, PERSONS_URL),
      fetchWithHomeAssistantAuth(this._hass, PETS_URL),
      fetchWithHomeAssistantAuth(this._hass, CATALOGS_URL),
      fetchWithHomeAssistantAuth(this._hass, IMPORTS_URL),
    ]);
    const [bookingResult, personsResult, petsResult, catalogsResult, importsResult] = await Promise.all([
      readApiResponse(bookingResponse),
      readApiResponse(personsResponse),
      readApiResponse(petsResponse),
      readApiResponse(catalogsResponse),
      readApiResponse(importsResponse),
    ]);
    if (!bookingResponse.ok || !petsResponse.ok || !catalogsResponse.ok || !importsResponse.ok) {
      const failedResult = !bookingResponse.ok ? bookingResult : !petsResponse.ok ? petsResult : !catalogsResponse.ok ? catalogsResult : importsResult;
      const failedResponse = !bookingResponse.ok ? bookingResponse : !petsResponse.ok ? petsResponse : !catalogsResponse.ok ? catalogsResponse : importsResponse;
      throw new Error(apiErrorMessage(failedResult, `HTTP ${failedResponse.status}`));
    }
    this._bookings = bookingResult.bookings || [];
    this._bookingTotal = Number.isFinite(Number(bookingResult.total)) ? Number(bookingResult.total) : this._bookings.length;
    this._imports = importsResult.imports || [];
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
        this._allocationOriginalDrafts.set(bookingId, storedAllocations.map((allocation) => ({ ...allocation })));
      } else if (!this._allocationOriginalDrafts.has(bookingId)) {
        this._allocationOriginalDrafts.set(bookingId, this._allocationDrafts.get(bookingId).map((allocation) => ({ ...allocation })));
      }
    }
    for (const bookingId of this._allocationDrafts.keys()) {
      if (!bookingIds.has(bookingId)) {
        this._allocationDrafts.delete(bookingId);
        this._allocationOriginalDrafts.delete(bookingId);
        this._allocationErrors.delete(bookingId);
        this._acceptedSuggestions.delete(bookingId);
      }
    }
    this._selectedReviewBookings = new Set(
      [...this._selectedReviewBookings].filter((bookingId) => bookingIds.has(bookingId)),
    );
    await this._loadRules().catch(() => {});
  }

  async _loadResolvedBookings() {
    const pageSize = this._bookingHistoryPageSize.resolved;
    const historyUrl = bookingHistoryRequestUrl(BOOKINGS_URL, {
      ...this._bookingHistoryFilters,
      status: "resolved",
      limit: pageSize,
      offset: pageSize ? this._bookingHistoryPage.resolved * pageSize : 0,
    });
    const response = await fetchWithHomeAssistantAuth(this._hass, historyUrl);
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(apiErrorMessage(result, `HTTP ${response.status}`));
    this._resolvedBookings = Array.isArray(result.bookings) ? result.bookings : [];
    this._resolvedTotal = Number.isFinite(Number(result.total)) ? Number(result.total) : this._resolvedBookings.length;
    const bookingIds = new Set(this._resolvedBookings.map((booking) => String(booking.id)));
    this._selectedResolvedBookings = new Set(
      [...this._selectedResolvedBookings].filter((bookingId) => bookingIds.has(bookingId)),
    );
  }

  async _reloadBookingHistoryView(view) {
    const resolved = view === "resolved";
    if (resolved) {
      this._resolvedLoading = true;
      this._resolvedLoadFailed = false;
    } else {
      this._reviewLoading = true;
      this._reviewLoadFailed = false;
    }
    this._render();
    try {
      if (resolved) await this._loadResolvedBookings();
      else await this._loadReviewData();
    } catch (error) {
      if (resolved) {
        this._resolvedBookings = [];
        this._resolvedLoadFailed = true;
      } else {
        this._bookings = [];
        this._reviewLoadFailed = true;
      }
      this._message = error.message || "Die Buchungshistorie konnte nicht geladen werden.";
    } finally {
      if (resolved) this._resolvedLoading = false;
      else this._reviewLoading = false;
      this._render();
    }
  }

  _bookingListForView(view) {
    return view === "resolved" ? this._resolvedBookings : this._bookings;
  }

  _bookingSelectionForView(view) {
    return view === "resolved" ? this._selectedResolvedBookings : this._selectedReviewBookings;
  }

  _syncBookingSelectionControls(view) {
    const bookings = this._bookingListForView(view);
    const selection = this._bookingSelectionForView(view);
    const state = bookingSelectionState(bookings, selection);
    this.shadowRoot.querySelectorAll(`[data-booking-select][data-booking-view="${view}"]`).forEach((input) => {
      input.checked = selection.has(String(input.dataset.bookingId));
    });
    const selectAll = this.shadowRoot.querySelector(`[data-booking-select-all][data-booking-view="${view}"]`);
    if (selectAll) {
      selectAll.checked = state.allSelected;
      selectAll.indeterminate = state.someSelected;
    }
    const summary = this.shadowRoot.querySelector(`[data-booking-selection-summary][data-booking-view="${view}"]`);
    if (summary) summary.textContent = `${state.selectedCount} von ${bookings.length} ausgewählt`;
    const deleteButton = this.shadowRoot.querySelector(`[data-delete-bookings][data-booking-view="${view}"]`);
    if (deleteButton) {
      deleteButton.disabled = state.selectedCount === 0 || this._deletingBookings;
      deleteButton.textContent = this._deletingBookings ? "Buchungen werden gelöscht …" : "Auswahl löschen";
    }
    const exportButton = this.shadowRoot.querySelector(`[data-export-bookings][data-booking-view="${view}"]`);
    if (exportButton) {
      exportButton.disabled = state.selectedCount === 0 || this._exportingBookings;
      exportButton.textContent = this._exportingBookings ? "Originaldaten werden exportiert …" : "Originaldaten exportieren";
    }
  }

  _updateBookingSelection(event) {
    const input = event.currentTarget;
    const view = input.dataset.bookingView;
    const selection = this._bookingSelectionForView(view);
    if (input.hasAttribute("data-booking-select-all")) {
      if (input.checked) this._bookingListForView(view).forEach((booking) => selection.add(String(booking.id)));
      else selection.clear();
    } else if (input.checked) {
      selection.add(String(input.dataset.bookingId));
    } else {
      selection.delete(String(input.dataset.bookingId));
    }
    this._syncBookingSelectionControls(view);
  }

  async _deleteSelectedBookings(view) {
    if (this._deletingBookings || !(await this._confirmDiscardUnsavedChanges())) return;
    const selection = this._bookingSelectionForView(view);
    const bookingIds = [...selection].filter((bookingId) =>
      this._bookingListForView(view).some((booking) => String(booking.id) === bookingId),
    );
    if (!bookingIds.length) return;
    const noun = bookingIds.length === 1 ? "Buchung" : "Buchungen";
    if (!(await this._requestConfirmation(`Möchtest du ${bookingIds.length} ${noun} dauerhaft löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`, {
      title: `${noun} löschen`,
      confirmLabel: "Dauerhaft löschen",
    }))) return;

    this._deletingBookings = true;
    this._message = `${bookingIds.length} ${noun} werden gelöscht …`;
    this._render();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, BOOKINGS_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_ids: bookingIds }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Die Buchungen konnten nicht gelöscht werden."));
      selection.clear();
      let refreshFailed = false;
      try {
        if (view === "resolved") await this._loadResolvedBookings();
        else await this._loadReviewData();
      } catch {
        refreshFailed = true;
        if (view === "resolved") this._resolvedLoadFailed = true;
        else this._reviewLoadFailed = true;
      }
      await this._loadOverview();
      const deleted = Number(result?.deleted) || bookingIds.length;
      const deletedNoun = deleted === 1 ? "Buchung" : "Buchungen";
      this._message = refreshFailed
        ? `${deleted} ${deletedNoun} gelöscht. Die Liste konnte danach nicht neu geladen werden.`
        : `${deleted} ${deletedNoun} dauerhaft gelöscht.`;
    } catch (error) {
      this._message = error.message || "Die Buchungen konnten nicht gelöscht werden.";
    } finally {
      this._deletingBookings = false;
      this._render();
      this._focusContent();
    }
  }

  async _exportSelectedBookings(view) {
    if (this._exportingBookings) return;
    const selection = this._bookingSelectionForView(view);
    const bookingIds = [...selection].filter((bookingId) =>
      this._bookingListForView(view).some((booking) => String(booking.id) === bookingId),
    );
    if (!bookingIds.length) return;

    this._exportingBookings = true;
    this._message = `${bookingIds.length === 1 ? "Originaldatei wird" : "Originaldateien werden"} exportiert …`;
    this._render();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, BOOKING_EXPORT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_ids: bookingIds }),
      });
      if (!response.ok) {
        const result = await readApiResponse(response);
        throw new Error(apiErrorMessage(result, "Die Originaldaten konnten nicht exportiert werden."));
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || "originale-buchungen";
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      this._message = `${bookingIds.length} ${bookingIds.length === 1 ? "Originaldatei" : "Originaldateien"} exportiert.`;
    } catch (error) {
      this._message = error.message || "Die Originaldaten konnten nicht exportiert werden.";
    } finally {
      this._exportingBookings = false;
      this._render();
      this._focusContent();
    }
  }

  async _openAccounts() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._view = "accounts";
    this._message = "";
    this._accountEditorId = null;
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
          this._accountDrafts.set(accountId, this._accountDraftFromAccount(account));
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
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._view = "pets";
    this._message = "";
    this._petEditorId = null;
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
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._view = "feed_profiles";
    this._message = "";
    this._feedProfileEditorId = null;
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
      parent_id: entry.parent_id || null,
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
      if (!this._catalogDrafts.has(newKey)) this._catalogDrafts.set(newKey, { label: "", active: true, parent_id: null });
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
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._view = "catalogs";
    this._message = "";
    this._catalogOverviewKind = "categories";
    this._catalogEditor = null;
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

  _selectCatalogKind(kind) {
    const allowedKinds = ["categories", "areas", "projects"];
    if (!allowedKinds.includes(String(kind))) return;
    this._catalogOverviewKind = String(kind);
    this._catalogEditor = null;
    this._message = "";
    this._render();
    this._focusContent();
  }

  _captureCatalogDraft(form) {
    return {
      label: form.querySelector("[data-catalog-field='label']")?.value || "",
      active: Boolean(form.querySelector("[data-catalog-field='active']")?.checked),
      parent_id: form.querySelector("[data-catalog-field='parent_id']")?.value || null,
    };
  }

  _updateCatalogDraft(event) {
    const form = event.currentTarget.closest("[data-catalog-form]");
    if (!form) return;
    const kind = String(form.dataset.catalogKind);
    const entryId = String(form.dataset.catalogId);
    const key = this._catalogKey(kind, entryId);
    const draft = this._captureCatalogDraft(form);
    const entry = this._catalogEntries(kind).find((candidate) => String(candidate.id) === entryId);
    const baseline = entryId === "new" ? { label: "", active: true, parent_id: null } : this._catalogDraftFromEntry(entry || {});
    this._catalogDrafts.set(key, draft);
    this._setSaveButtonState(form, !this._draftsEqual(draft, baseline), this._catalogSubmissions.has(key));
    this._catalogErrors.delete(key);
    const status = form.querySelector("[data-catalog-save-status]");
    status?.classList.remove("catalog-entry-status--error");
    if (status) status.textContent = "";
  }

  _catalogPayload(draft) {
    return { label: draft.label, active: draft.active !== false, parent_id: draft.parent_id || null };
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
    const entry = this._catalogEntries(kind).find((candidate) => String(candidate.id) === entryId);
    const baseline = entryId === "new" ? { label: "", active: true, parent_id: null } : this._catalogDraftFromEntry(entry || {});
    if (this._draftsEqual(draft, baseline)) return;
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
      this._catalogEditor = null;
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
    if (!entry || !(await this._requestConfirmation(`„${entry.label || "Eintrag"}“ archivieren?`, {
      title: `${catalogKindSingularLabel(kind)} archivieren`,
      confirmLabel: "Archivieren",
    }))) return;
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
      this._catalogEditor = null;
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
    const allEntries = this._catalogEntries(kind);
    const visibleIds = new Set(
      allEntries
        .filter((entry) => entry.active !== false || String(entry.label || "") === selected || String(entry.id || "") === selected)
        .map((entry) => String(entry.id)),
    );
    if (kind === "categories") {
      allEntries.forEach((entry) => {
        if (visibleIds.has(String(entry.id)) && entry.parent_id) visibleIds.add(String(entry.parent_id));
      });
    }
    const entries = allEntries
      .filter((entry) => visibleIds.has(String(entry.id)))
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "de"));
    const selectedEntry = entries.find((entry) => String(entry.id || "") === selected || String(entry.label || "") === selected);
    const selectedId = selectedEntry ? String(selectedEntry.id) : selected;
    const options = [`<option value=""${selected ? "" : " selected"}>${emptyLabel}</option>`];
    if (selected && !selectedEntry) {
      options.push(`<option value="" data-catalog-label="${escapeHtml(selected)}" selected>Nicht mehr verfügbar: ${escapeHtml(selected)}</option>`);
    }
    const entryById = new Map(allEntries.map((entry) => [String(entry.id), entry]));
    const topLevel = entries.filter((entry) => {
      const parent = entryById.get(String(entry.parent_id || ""));
      return kind !== "categories" || !entry.parent_id || !parent;
    });
    const orderedEntries = topLevel.flatMap((parent) => [
      parent,
      ...(kind === "categories"
        ? entries
          .filter((entry) => String(entry.parent_id || "") === String(parent.id))
          .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "de"))
        : []),
    ]);
    options.push(...orderedEntries.map((entry) => {
      const label = entry.active === false ? `${entry.label} (archiviert)` : entry.label;
      const displayLabel = kind === "categories" && entry.parent_id ? `Unterkategorie · ${label}` : label;
      return `<option value="${escapeHtml(entry.id)}" data-catalog-label="${escapeHtml(entry.label)}"${String(entry.id) === selectedId ? " selected" : ""}>${escapeHtml(displayLabel)}</option>`;
    }));
    return options.join("");
  }

  _catalogParentOptions(selectedParentId, entryId) {
    const selected = String(selectedParentId || "");
    const parents = this._catalogEntries("categories")
      .filter((entry) => String(entry.id) !== String(entryId) && !entry.parent_id)
      .filter((entry) => entry.active !== false || String(entry.id) === selected)
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "de"));
    return [
      `<option value=""${selected ? "" : " selected"}>Hauptkategorie</option>`,
      ...parents.map((entry) => `<option value="${escapeHtml(entry.id)}"${String(entry.id) === selected ? " selected" : ""}>${escapeHtml(entry.label)}</option>`),
    ].join("");
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
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._view = "plan_items";
    this._message = "";
    this._planItemEditorId = null;
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
    const item = this._planItems.find((candidate) => String(candidate.id) === itemId);
    const baseline = itemId === "new" ? this._newPlanItemDraft() : this._planItemDraftFromItem(item || {});
    this._planItemDrafts.set(itemId, draft);
    this._setSaveButtonState(form, !this._draftsEqual(draft, baseline), this._planItemSubmissions.has(itemId));
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
    const item = this._planItems.find((candidate) => String(candidate.id) === itemId);
    const baseline = itemId === "new" ? this._newPlanItemDraft() : this._planItemDraftFromItem(item || {});
    if (this._draftsEqual(draft, baseline)) return;
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
      this._planItemEditorId = null;
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
    if (!item || !(await this._requestConfirmation(`„${item.name || "Planposten"}“ archivieren?`, {
      title: "Planposten archivieren",
      confirmLabel: "Archivieren",
    }))) return;
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
      this._planItemEditorId = null;
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
    const draft = this._capturePetDraft(form);
    const pet = this._pets.find((candidate) => String(candidate.id) === petId);
    const baseline = petId === "new" ? this._newPetDraft() : this._petDraftFromPet(pet || {});
    this._petDrafts.set(petId, draft);
    this._setSaveButtonState(form, !this._draftsEqual(draft, baseline), this._petSubmissions.has(petId));
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
    const pet = this._pets.find((candidate) => String(candidate.id) === petId);
    const baseline = petId === "new" ? this._newPetDraft() : this._petDraftFromPet(pet || {});
    if (this._draftsEqual(draft, baseline)) return;
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
      this._petEditorId = null;
      this._message = petId === "new" ? "Tier angelegt." : "Tier gespeichert.";
      this._petSubmissions.delete(petId);
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
    if (!pet || !(await this._requestConfirmation(`„${pet.name || "Tier"}“ archivieren?`, {
      title: "Tier archivieren",
      confirmLabel: "Archivieren",
    }))) return;
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
      this._petEditorId = null;
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
    const draft = this._captureFeedProfileDraft(form);
    const profile = this._feedProfiles.find((candidate) => String(candidate.id) === profileId);
    const baseline = profileId === "new" ? this._newFeedProfileDraft() : this._feedProfileDraftFromProfile(profile || {});
    this._feedProfileDrafts.set(profileId, draft);
    this._setSaveButtonState(form, !this._draftsEqual(draft, baseline), this._feedProfileSubmissions.has(profileId));
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
    const profile = this._feedProfiles.find((candidate) => String(candidate.id) === profileId);
    const baseline = profileId === "new" ? this._newFeedProfileDraft() : this._feedProfileDraftFromProfile(profile || {});
    if (this._draftsEqual(draft, baseline)) return;
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
      this._feedProfileEditorId = null;
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
    if (!profile || !(await this._requestConfirmation(`„${profile.product || "Futterprofil"}“ archivieren?`, {
      title: "Futterprofil archivieren",
      confirmLabel: "Archivieren",
    }))) return;
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
      this._feedProfileEditorId = null;
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
    if (!profile || !(await this._requestConfirmation(`„${profile.product || "Futter"}“ für ${profile.pet_name || "das Tier"} als gekauft markieren?`, {
      title: "Futterkauf bestätigen",
      confirmLabel: "Kauf bestätigen",
    }))) return;
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
    if (this._accountSubmissions.has(accountId)) return;
    const button = form.querySelector("[type='submit']");
    const status = form.querySelector("[data-account-save-status]");
    const draft = this._captureAccountDraft(form);
    const account = this._accounts.find((candidate) => String(candidate.id) === accountId);
    const baseline = this._accountDraftFromAccount(account || {});
    if (this._draftsEqual(draft, baseline)) return;
    const payload = this._accountUpdatePayload(draft);
    this._accountSubmissions.add(accountId);
    this._accountDrafts.set(accountId, draft);
    this._message = "";
    this._syncFeedbackPresenter();
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
        this._accountDrafts.set(accountId, this._accountDraftFromAccount(savedAccount));
      }
      this._message = `${payload.label.trim() || "Konto"} wurde gespeichert.`;
      this._accountEditorId = null;
      this._render();
    } catch (error) {
      if (status) status.textContent = error.message || "Das Konto konnte nicht gespeichert werden.";
      this._setSaveButtonState(form, true);
    } finally {
      this._accountSubmissions.delete(accountId);
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
    if (!form) return;
    const accountId = String(form.dataset.accountId);
    const draft = this._captureAccountDraft(form);
    const account = this._accounts.find((candidate) => String(candidate.id) === accountId);
    this._accountDrafts.set(accountId, draft);
    this._setSaveButtonState(form, !this._draftsEqual(draft, this._accountDraftFromAccount(account || {})), this._accountSubmissions.has(accountId));
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

  _normalizedDraftValue(value, key = "") {
    if (Array.isArray(value)) {
      const normalized = value.map((item) => this._normalizedDraftValue(item, key));
      return key === "owner_targets" ? normalized.sort() : normalized;
    }
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((result, childKey) => {
        result[childKey] = this._normalizedDraftValue(value[childKey], childKey);
        return result;
      }, {});
    }
    if (["amount", "amount_input", "expected_cost", "expected_cost_input", "interval_weeks", "due_soon_days", "frequency_months", "due_day"].includes(key)) {
      const numericValue = Number(String(value ?? "").trim().replace(",", "."));
      return String(value ?? "").trim() === "" ? "" : Number.isFinite(numericValue) ? numericValue : String(value ?? "").trim();
    }
    return value == null ? "" : value;
  }

  _draftsEqual(left, right) {
    return JSON.stringify(this._normalizedDraftValue(left)) === JSON.stringify(this._normalizedDraftValue(right));
  }

  _setSaveButtonState(form, hasChanges, isSubmitting = false) {
    const button = form?.querySelector("[type='submit']");
    if (button) button.disabled = isSubmitting || !hasChanges;
  }

  _hasUnsavedChanges() {
    if (this._ruleHasChanges() || this._ruleSubmitting || this._acceptedSuggestions.size) return true;
    for (const [itemId, draft] of this._planItemDrafts) {
      const item = this._planItems.find((candidate) => String(candidate.id) === itemId);
      const baseline = itemId === "new" ? this._newPlanItemDraft() : this._planItemDraftFromItem(item || {});
      if (!this._draftsEqual(draft, baseline)) return true;
    }
    for (const [petId, draft] of this._petDrafts) {
      const pet = this._pets.find((candidate) => String(candidate.id) === petId);
      const baseline = petId === "new" ? this._newPetDraft() : this._petDraftFromPet(pet || {});
      if (!this._draftsEqual(draft, baseline)) return true;
    }
    for (const [profileId, draft] of this._feedProfileDrafts) {
      const profile = this._feedProfiles.find((candidate) => String(candidate.id) === profileId);
      const baseline = profileId === "new" ? this._newFeedProfileDraft() : this._feedProfileDraftFromProfile(profile || {});
      if (!this._draftsEqual(draft, baseline)) return true;
    }
    for (const [key, draft] of this._catalogDrafts) {
      const separator = key.indexOf(":");
      const kind = key.slice(0, separator);
      const entryId = key.slice(separator + 1);
      const entry = this._catalogEntries(kind).find((candidate) => String(candidate.id) === entryId);
      const baseline = entryId === "new" ? { label: "", active: true, parent_id: null } : this._catalogDraftFromEntry(entry || {});
      if (!this._draftsEqual(draft, baseline)) return true;
    }
    for (const [accountId, draft] of this._accountDrafts) {
      const account = this._accounts.find((candidate) => String(candidate.id) === accountId);
      if (!this._draftsEqual(draft, this._accountDraftFromAccount(account || {}))) return true;
    }
    for (const [bookingId, draft] of this._allocationDrafts) {
      const baseline = this._allocationOriginalDrafts.get(bookingId);
      if (!baseline || !this._draftsEqual(draft, baseline)) return true;
    }
    return false;
  }

  _hasPendingSubmissions() {
    return this._deletingBookings || this._ruleSubmitting || this._planItemSubmissions.size > 0
      || this._petSubmissions.size > 0
      || this._feedProfileSubmissions.size > 0
      || this._catalogSubmissions.size > 0
      || this._accountSubmissions.size > 0
      || this._allocationSubmissions.size > 0;
  }

  _discardUnsavedChanges() {
    this._resetRuleEditor();
    this._acceptedSuggestions.clear();
    this._planItemDrafts.clear();
    this._petDrafts.clear();
    this._feedProfileDrafts.clear();
    this._catalogDrafts.clear();
    this._accountDrafts.clear();
    this._planItemErrors.clear();
    this._petErrors.clear();
    this._feedProfileErrors.clear();
    this._catalogErrors.clear();
    this._allocationErrors.clear();
    this._allocationDrafts.clear();
    for (const [bookingId, rows] of this._allocationOriginalDrafts) {
      this._allocationDrafts.set(bookingId, rows.map((row) => ({ ...row })));
    }
  }

  async _confirmDiscardUnsavedChanges() {
    if (this._hasPendingSubmissions()) {
      window.alert("Eine Änderung wird gerade gespeichert. Bitte warte, bis der Vorgang abgeschlossen ist.");
      return false;
    }
    if (!this._hasUnsavedChanges()) return true;
    if (!(await this._requestConfirmation("Es gibt ungespeicherte Änderungen. Möchtest du sie verwerfen?", {
      title: "Änderungen verwerfen",
      confirmLabel: "Änderungen verwerfen",
    }))) return false;
    this._discardUnsavedChanges();
    return true;
  }

  _focusContent() {
    this.shadowRoot.querySelector("#content")?.focus({ preventScroll: true });
  }

  async _navigateToOverview() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    if (this._view !== "overview") this._clearBreakdown();
    this._view = "overview";
    this._render();
    this._focusContent();
  }

  _openAccountEditor(accountId) {
    this._accountEditorId = String(accountId);
    this._message = "";
    this._render();
    this._focusContent();
  }

  async _closeAccountEditor() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._accountEditorId = null;
    this._render();
    this._focusContent();
  }

  _openPlanItemEditor(itemId) {
    this._planItemEditorId = String(itemId);
    this._message = "";
    this._render();
    this._focusContent();
  }

  async _closePlanItemEditor() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._planItemEditorId = null;
    this._render();
    this._focusContent();
  }

  _openPetEditor(petId) {
    this._petEditorId = String(petId);
    this._message = "";
    this._render();
    this._focusContent();
  }

  async _closePetEditor() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._petEditorId = null;
    this._render();
    this._focusContent();
  }

  _openFeedProfileEditor(profileId) {
    this._feedProfileEditorId = String(profileId);
    this._message = "";
    this._render();
    this._focusContent();
  }

  async _closeFeedProfileEditor() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._feedProfileEditorId = null;
    this._render();
    this._focusContent();
  }

  _openCatalogEditor(kind, entryId) {
    this._catalogEditor = { kind: String(kind), entryId: String(entryId) };
    this._message = "";
    this._render();
    this._focusContent();
  }

  async _closeCatalogEditor() {
    if (!(await this._confirmDiscardUnsavedChanges())) return;
    this._catalogEditor = null;
    this._render();
    this._focusContent();
  }

  _allocationForm(bookingId) {
    return [...this.shadowRoot.querySelectorAll("[data-assignment-form]")]
      .find((form) => form.dataset.bookingId === String(bookingId));
  }

  _updateAllocationSummary(form) {
    if (!form) return;
    const rows = this._allocationDrafts.get(form.dataset.bookingId) || [];
    const total = Number(form.dataset.bookingTotal) || 0;
    const submitting = this._allocationSubmissions.has(form.dataset.bookingId);
    const editor = form.querySelector(".allocation-editor");
    const accept = form.querySelector("[data-accept-suggestion]");
    if (editor) editor.disabled = submitting;
    if (accept) accept.disabled = submitting;
    const submitState = allocationSubmitState(total, rows, submitting);
    const { remaining } = submitState;
    const allocated = submitState.invalidAmount ? null : allocationRemaining(total, [{ amount: remaining }]);
    const remainingNode = form.querySelector("[data-allocation-remaining]");
    const allocatedNode = form.querySelector("[data-allocation-allocated]");
    const submit = form.querySelector("[type='submit']");
    const originalRows = this._allocationOriginalDrafts.get(form.dataset.bookingId);
    const hasChanges = this._acceptedSuggestions.has(form.dataset.bookingId) || Boolean(originalRows) && !this._draftsEqual(rows, originalRows);
    if (allocatedNode) allocatedNode.textContent = allocated === null ? "—" : formatEuro(allocated);
    if (remainingNode) {
      remainingNode.textContent = submitState.invalidAmount ? "—" : formatEuro(remaining);
      remainingNode.classList.toggle("allocation-summary--open", submitState.invalidAmount || remaining !== 0);
    }
    if (submit) {
      submit.disabled = submitState.disabled || !hasChanges;
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
    const originalRows = this._allocationOriginalDrafts.get(bookingId);
    const total = Number(form.dataset.bookingTotal) || 0;
    const submitState = allocationSubmitState(total, rows);
    const { remaining } = submitState;
    const status = form.querySelector("[data-allocation-status]");
    if (submitState.disabled || !originalRows || (!this._acceptedSuggestions.has(bookingId) && this._draftsEqual(rows, originalRows))) {
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
      const original = [...this._bookings, ...this._resolvedBookings].find((booking) => String(booking.id) === bookingId);
      const confirmed = result?.booking || { ...original, id: bookingId, amount: total, allocations };
      this._confirmedBookings.set(bookingId, { ...confirmed, status: "resolved", allocations: (confirmed.allocations || allocations).map((row) => ({ ...row })) });
    } catch (error) {
      this._allocationSubmissions.delete(bookingId);
      this._allocationErrors.set(bookingId, error.message || "Die Aufteilung konnte nicht gespeichert werden. Bitte versuche es erneut.");
      // Another booking's interaction may have replaced the form during this request.
      const currentForm = this._allocationForm(bookingId) || form;
      currentForm.removeAttribute("aria-busy");
      const currentStatus = currentForm.querySelector("[data-allocation-status]");
      if (currentStatus) currentStatus.textContent = this._allocationErrors.get(bookingId);
      this._updateAllocationSummary(currentForm);
      return;
    }
    this._allocationSubmissions.delete(bookingId);
    this._allocationErrors.delete(bookingId);
    this._allocationDrafts.delete(bookingId);
    this._allocationOriginalDrafts.delete(bookingId);
    this._acceptedSuggestions.delete(bookingId);
    const editingResolved = this._resolvedEditingBookings.has(bookingId);
    this._resolvedEditingBookings.delete(bookingId);
    if (!editingResolved) this._bookings = this._bookings.filter((booking) => String(booking.id) !== bookingId);
    this._message = "Buchung zugeordnet und aus der Prüfliste entfernt.";
    this._render();
    let reviewRefreshFailed = false;
    try {
      if (editingResolved) await this._loadResolvedBookings();
      else await this._loadReviewData();
    } catch {
      reviewRefreshFailed = true;
    }
    await this._loadOverview();
    this._message = reviewRefreshFailed
      ? "Buchung gespeichert. Die Prüfliste konnte danach nicht neu geladen werden."
      : "Buchung zugeordnet und aus der Prüfliste entfernt.";
    this._render();
    [...this.shadowRoot.querySelectorAll("[data-rule-from-booking]")].find((button) => button.dataset.ruleFromBooking === bookingId)?.focus();
  }

  async _repairMissingTarget(button) {
    const bookingId = String(button.dataset.repairBooking || "");
    const from = String(button.dataset.repairFrom || "");
    const container = button.closest("[data-target-repair-form]");
    const to = container?.querySelector("[data-repair-to]")?.value || "";
    if (!bookingId || !from || !to || to === from || this._repairSubmitting.has(bookingId)) return;
    this._repairSubmitting.add(bookingId);
    this._repairErrors.delete(bookingId);
    this._message = "Personenziel wird repariert …";
    this._render();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${BOOKINGS_URL}/${encodeURIComponent(bookingId)}/repair-targets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repairTargetsPayload([{ from, to }])),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Das Personenziel konnte nicht repariert werden."));
      if (result.booking) this._resolvedBookings = this._resolvedBookings.map((booking) => String(booking.id) === bookingId ? result.booking : booking);
      this._message = "Personenziel repariert. Betrag und fachliche Zuordnungen bleiben erhalten.";
    } catch (error) {
      this._repairErrors.set(bookingId, error.message || "Das Personenziel konnte nicht repariert werden.");
      this._message = this._repairErrors.get(bookingId);
    } finally {
      this._repairSubmitting.delete(bookingId);
      this._render();
    }
  }

  async _unresolveBooking(bookingId) {
    const id = String(bookingId);
    if (this._unresolvingBookings.has(id)) return;
    this._unresolvingBookings.add(id);
    this._message = "Zuordnung wird rückgängig gemacht …";
    this._render();
    try {
      const response = await fetchWithHomeAssistantAuth(this._hass, `${BOOKINGS_URL}/${encodeURIComponent(id)}/unresolve`, { method: "POST" });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Die Zuordnung konnte nicht rückgängig gemacht werden."));
      await this._loadResolvedBookings();
      await this._loadOverview();
      this._message = "Zuordnung rückgängig gemacht. Die Buchung liegt wieder in der Prüfliste.";
    } catch (error) {
      this._message = error.message || "Die Zuordnung konnte nicht rückgängig gemacht werden.";
    } finally {
      this._unresolvingBookings.delete(id);
      this._render();
      this._focusContent();
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
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(result, "Import fehlgeschlagen"));
      const fileFeedback = result.format === "ZIP" ? ` · ${result.files?.length || 0} Dateien geprüft` : "";
      const feedback = `${result.format}: ${result.accepted} Buchungen importiert, ${result.auto_assigned || 0} automatisch übernommen, ${result.duplicates} Duplikate übersprungen${fileFeedback}; ${result.new_accounts || 0} neue Konten, ${result.unconfigured_accounts || 0} ohne konfigurierte Inhaber.`;
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
      await this._loadOverview();
      this._message = `${result.accepted} Planposten übernommen, ${result.skipped} abgewählt.`;
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

  _clearFeedbackTimer() {
    if (this._feedbackTimer !== null) {
      window.clearTimeout(this._feedbackTimer);
      this._feedbackTimer = null;
    }
  }

  _activeFeedbackMessage() {
    return this._view === "rules" ? this._ruleMessage : this._message;
  }

  _supportsPopover(presenter) {
    return "popover" in HTMLElement.prototype && typeof presenter?.showPopover === "function";
  }

  _hideFeedbackPresenter(presenter) {
    if (!presenter) return;
    if (this._supportsPopover(presenter) && presenter.matches(":popover-open")) presenter.hidePopover();
    presenter.classList.remove("feedback-presenter--visible");
  }

  _dismissFeedback() {
    this._clearFeedbackTimer();
    const source = this._view === "rules" ? "_ruleMessage" : "_message";
    this[source] = "";
    this._hideFeedbackPresenter(this.shadowRoot.querySelector("[data-feedback-presenter]"));
  }

  _syncFeedbackPresenter() {
    this._clearFeedbackTimer();
    const presenter = this.shadowRoot.querySelector("[data-feedback-presenter]");
    if (!presenter) return;
    const message = this._activeFeedbackMessage();
    const messageNode = presenter.querySelector("[data-feedback-message]");
    if (messageNode) messageNode.textContent = message;
    if (!message) {
      this._hideFeedbackPresenter(presenter);
      return;
    }
    presenter.classList.add("feedback-presenter--visible");
    if (this._supportsPopover(presenter) && !presenter.matches(":popover-open")) presenter.showPopover();
    this._feedbackTimer = window.setTimeout(() => this._dismissFeedback(), 4200);
  }

  _requestConfirmation(message, { title = "Bestätigung erforderlich", confirmLabel = "Bestätigen" } = {}) {
    const dialog = this.shadowRoot.querySelector("[data-confirm-dialog]");
    if (!dialog || typeof dialog.showModal !== "function" || this._confirmDialogPromise) return Promise.resolve(false);
    const titleNode = dialog.querySelector("[data-confirm-title]");
    const messageNode = dialog.querySelector("[data-confirm-message]");
    const submitButton = dialog.querySelector("[data-confirm-submit]");
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
    if (submitButton) submitButton.textContent = confirmLabel;
    dialog.returnValue = "cancel";
    this._confirmDialogPromise = new Promise((resolve) => {
      const settle = () => {
        this._confirmDialogPromise = null;
        resolve(dialog.returnValue === "confirm");
      };
      dialog.addEventListener("close", settle, { once: true });
      try {
        dialog.showModal();
        dialog.querySelector("[data-confirm-cancel]")?.focus();
      } catch {
        dialog.removeEventListener("close", settle);
        this._confirmDialogPromise = null;
        resolve(false);
      }
    });
    return this._confirmDialogPromise;
  }

  _shiftMonth(delta) {
    this._month = new Date(this._month.getFullYear(), this._month.getMonth() + delta, 1);
    this._clearBreakdown();
    this._loadOverview();
    if (this._reportView) this._loadReport(this._reportView);
    this._render();
  }

  _render() {
    if (!['review', 'resolved'].includes(this._view) && (this._bookingDetailRequest || this._bookingDetailTrigger)) this._closeBookingDetails();
    const bookingDetailWasOpen = Boolean(
      this._bookingDetailRequest || this._bookingDetail || this._bookingDetailLoading
      || this._bookingDetailError || this._bookingDetailTrigger,
    );
    if (this._view !== "overview") this._clearBreakdown();
    const comparisonFocus = this.shadowRoot.activeElement;
    const comparisonFocusId = comparisonFocus?.closest(".comparison-section") ? comparisonFocus.id : null;
    const template = this._view === "review"
      ? this._reviewTemplate()
      : this._view === "resolved"
        ? this._resolvedBookingsTemplate()
      : this._view === "rules"
        ? this._rulesTemplate()
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
              : SECTION_VIEWS.includes(this._view)
                ? this._sectionOverviewTemplate(this._view)
              : this._overviewTemplate();
    this.shadowRoot.innerHTML = `<style>${styles}</style>${template}`;
    this._bindEvents();
    if (bookingDetailWasOpen) {
      const dialog = this.shadowRoot.querySelector("[data-booking-detail-dialog]");
      this._renderBookingDetailDialog();
      this._bookingDetailTrigger = [...this.shadowRoot.querySelectorAll("[data-booking-details]")]
        .find((button) => button.dataset.bookingDetails === this._bookingDetailId) || null;
      if (dialog && !dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    }
    if (this._view === "rules" && this._ruleEditingId) this._syncRuleFormState();
    this.shadowRoot.querySelectorAll("[data-assignment-form]").forEach((form) => this._updateAllocationSummary(form));
    if (["review", "resolved"].includes(this._view)) this._syncBookingSelectionControls(this._view);
    this._syncFeedbackPresenter();
    if (comparisonFocusId) this.shadowRoot.getElementById(comparisonFocusId)?.focus({ preventScroll: true });
  }

  _bindEvents() {
    this.shadowRoot.querySelectorAll("[data-comparison-dimension]").forEach((button) => button.addEventListener("click", () => this._setComparisonDimension(button.dataset.comparisonDimension)));
    this.shadowRoot.querySelectorAll("[data-comparison-detail]").forEach((button) => button.addEventListener("click", () => this._loadBreakdown(this._comparisonDimension, button.dataset.comparisonDetail)));
    this.shadowRoot.querySelector("[data-comparison-close]")?.addEventListener("click", () => this._closeBreakdown());
    this.shadowRoot.querySelector("[data-comparison-retry]")?.addEventListener("click", () => {
      const selection = this._breakdownSelection;
      if (selection) this._loadBreakdown(selection.dimension, selection.key);
    });
    this.shadowRoot.querySelector("[data-skip-link]")?.addEventListener("click", (event) => {
      event.preventDefault();
      this.shadowRoot.querySelector("#content")?.focus();
    });
    this.shadowRoot.querySelector("[data-feedback-close]")?.addEventListener("click", () => this._dismissFeedback());
    this.shadowRoot.querySelector("[data-action='previous-month']")?.addEventListener("click", () => this._shiftMonth(-1));
    this.shadowRoot.querySelector("[data-action='next-month']")?.addEventListener("click", () => this._shiftMonth(1));
    this.shadowRoot.querySelectorAll("[data-report-view]").forEach((button) => button.addEventListener("click", () => {
      this._loadReport(button.dataset.reportView).then(() => this.shadowRoot.querySelector(`[data-report-view="${button.dataset.reportView}"]`)?.focus());
    }));
    this.shadowRoot.querySelector("[data-report-retry]")?.addEventListener("click", () => this._loadReport(this._reportView));
    this.shadowRoot.querySelectorAll("[data-action='review']").forEach((button) => button.addEventListener("click", () => this._openReview()));
    this.shadowRoot.querySelectorAll("[data-action='resolved']").forEach((button) => button.addEventListener("click", () => this._openResolvedBookings()));
    this.shadowRoot.querySelectorAll("[data-action='apply-rules']").forEach((button) => button.addEventListener("click", () => this._applyRules()));
    this.shadowRoot.querySelectorAll("[data-action='rules']").forEach((button) => button.addEventListener("click", () => this._openRules()));
    this.shadowRoot.querySelectorAll("[data-open-rule-editor]").forEach((button) => button.addEventListener("click", () => this._openRuleEditor(button.dataset.openRuleEditor)));
    this.shadowRoot.querySelector("[data-close-rule-editor]")?.addEventListener("click", () => this._closeRuleEditor());
    this.shadowRoot.querySelectorAll("[data-deactivate-rule]").forEach((button) => button.addEventListener("click", () => this._deactivateRule(button.dataset.deactivateRule)));
    this.shadowRoot.querySelectorAll("[data-rule-from-booking]").forEach((button) => button.addEventListener("click", () => this._openRuleFromBooking(button.dataset.ruleFromBooking)));
    this.shadowRoot.querySelectorAll("[data-accept-suggestion]").forEach((button) => button.addEventListener("click", () => this._acceptSuggestion(button.dataset.acceptSuggestion)));
    this.shadowRoot.querySelectorAll("[data-unresolve-booking]").forEach((button) => button.addEventListener("click", () => this._unresolveBooking(button.dataset.unresolveBooking)));
    this.shadowRoot.querySelectorAll("[data-edit-resolved-booking]").forEach((button) => button.addEventListener("click", () => {
      this._resolvedEditTriggers.set(button.dataset.editResolvedBooking, button);
      this._openResolvedAllocationEditor(button.dataset.editResolvedBooking);
    }));
    this.shadowRoot.querySelectorAll("[data-cancel-resolved-edit]").forEach((button) => button.addEventListener("click", () => {
      const bookingId = button.dataset.cancelResolvedEdit;
      this._resolvedEditingBookings.delete(bookingId);
      this._render();
      (this.shadowRoot.querySelector(`[data-edit-resolved-booking="${CSS.escape(bookingId)}"]`) || this._resolvedEditTriggers.get(bookingId))?.focus();
      this._resolvedEditTriggers.delete(bookingId);
    }));
    this.shadowRoot.querySelectorAll("[data-repair-target]").forEach((button) => button.addEventListener("click", () => this._repairMissingTarget(button)));
    this.shadowRoot.querySelectorAll("[data-booking-details]").forEach((button) => button.addEventListener("click", () => this._openBookingDetails(button.dataset.bookingDetails, button)));
    const bookingDetailDialog = this.shadowRoot.querySelector("[data-booking-detail-dialog]");
    bookingDetailDialog?.addEventListener("click", (event) => {
      if (event.target.matches("[data-booking-raw-toggle]")) {
        this._bookingDetailRawVisible = !this._bookingDetailRawVisible;
        this._renderBookingDetailDialog({ focusRawToggle: true });
      }
      if (event.target.matches("[data-booking-detail-close]")) this._closeBookingDetails();
    });
    bookingDetailDialog?.addEventListener("close", () => {
      if (this._bookingDetailRequest || this._bookingDetail || this._bookingDetailLoading || this._bookingDetailError || this._bookingDetailTrigger) this._closeBookingDetails();
    });
    this.shadowRoot.querySelectorAll("[data-booking-select], [data-booking-select-all]").forEach((input) => input.addEventListener("change", (event) => this._updateBookingSelection(event)));
    this.shadowRoot.querySelector("[data-booking-history-filter]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      for (const input of event.currentTarget.querySelectorAll("[data-booking-filter]")) this._bookingHistoryFilters[input.dataset.bookingFilter] = input.value;
      this._bookingHistoryPage = { review: 0, resolved: 0 };
      if (this._bookingHistoryFilters.status === "resolved") this._openResolvedBookings();
      else this._openReview();
    });
    this.shadowRoot.querySelector("[data-booking-filter-reset]")?.addEventListener("click", () => {
      const view = this._view === "resolved" ? "resolved" : "review";
      this._bookingHistoryFilters = { q: "", from: "", to: "", status: view === "resolved" ? "resolved" : "unresolved", account_id: "", target: "", category_id: "", area_id: "", project_id: "" };
      this._bookingHistoryPage = { review: 0, resolved: 0 };
      if (view === "resolved") this._openResolvedBookings();
      else this._openReview();
    });
    this.shadowRoot.querySelectorAll("[data-booking-page-size]").forEach((select) => select.addEventListener("change", () => {
      const view = select.dataset.bookingView === "resolved" ? "resolved" : "review";
      this._bookingHistoryPageSize[view] = Number(select.value);
      this._bookingHistoryPage[view] = 0;
      this._reloadBookingHistoryView(view);
    }));
    this.shadowRoot.querySelectorAll("[data-booking-page]").forEach((button) => button.addEventListener("click", () => {
      const view = button.dataset.bookingView === "resolved" ? "resolved" : "review";
      const direction = button.dataset.bookingPage === "next" ? 1 : -1;
      const pageSize = this._bookingHistoryPageSize[view];
      if (pageSize === 0) return;
      const total = view === "resolved" ? this._resolvedTotal : this._bookingTotal;
      const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      this._bookingHistoryPage[view] = Math.min(lastPage, Math.max(0, this._bookingHistoryPage[view] + direction));
      this._reloadBookingHistoryView(view);
    }));
    this.shadowRoot.querySelectorAll("[data-export-bookings]").forEach((button) => button.addEventListener("click", () => this._exportSelectedBookings(button.dataset.bookingView)));
    this.shadowRoot.querySelectorAll("[data-delete-bookings]").forEach((button) => button.addEventListener("click", () => this._deleteSelectedBookings(button.dataset.bookingView)));
    const ruleForm = this.shadowRoot.querySelector("[data-rule-form]");
    ruleForm?.addEventListener("submit", (event) => this._handleRuleSave(event));
    for (const type of ["input", "change", "focusout"]) ruleForm?.addEventListener(type, (event) => this._updateRuleField(event));
    this.shadowRoot.querySelector("[data-rule-add]")?.addEventListener("click", () => this._changeRuleAllocation());
    this.shadowRoot.querySelectorAll("[data-rule-remove]").forEach((button) => button.addEventListener("click", () => this._changeRuleAllocation(Number(button.dataset.ruleRemove))));
    this.shadowRoot.querySelector("[data-action='accounts']")?.addEventListener("click", () => this._openAccounts());
    this.shadowRoot.querySelector("[data-action='back']")?.addEventListener("click", () => this._navigateToOverview());
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
    this.shadowRoot.querySelectorAll("[data-open-account-editor]").forEach((button) => button.addEventListener("click", () => this._openAccountEditor(button.dataset.accountId)));
    this.shadowRoot.querySelector("[data-close-account-editor]")?.addEventListener("click", () => this._closeAccountEditor());
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
    this.shadowRoot.querySelectorAll("[data-open-pet-editor]").forEach((button) => button.addEventListener("click", () => this._openPetEditor(button.dataset.petId)));
    this.shadowRoot.querySelector("[data-close-pet-editor]")?.addEventListener("click", () => this._closePetEditor());
    this.shadowRoot.querySelectorAll("[data-feed-profile-form]").forEach((form) => form.addEventListener("submit", (event) => this._handleFeedProfileSave(event)));
    this.shadowRoot.querySelectorAll("[data-feed-profile-field]").forEach((input) => {
      input.addEventListener("input", (event) => this._updateFeedProfileDraft(event));
      input.addEventListener("change", (event) => this._updateFeedProfileDraft(event));
    });
    this.shadowRoot.querySelectorAll("[data-feed-profile-archive]").forEach((button) => button.addEventListener("click", (event) => this._archiveFeedProfile(event)));
    this.shadowRoot.querySelectorAll("[data-feed-profile-purchase]").forEach((button) => button.addEventListener("click", (event) => this._confirmFeedPurchase(event)));
    this.shadowRoot.querySelectorAll("[data-open-feed-profile-editor]").forEach((button) => button.addEventListener("click", () => this._openFeedProfileEditor(button.dataset.feedProfileId)));
    this.shadowRoot.querySelector("[data-close-feed-profile-editor]")?.addEventListener("click", () => this._closeFeedProfileEditor());
    this.shadowRoot.querySelectorAll("[data-catalog-form]").forEach((form) => form.addEventListener("submit", (event) => this._handleCatalogSave(event)));
    this.shadowRoot.querySelectorAll("[data-catalog-field]").forEach((input) => {
      input.addEventListener("input", (event) => this._updateCatalogDraft(event));
      input.addEventListener("change", (event) => this._updateCatalogDraft(event));
    });
    this.shadowRoot.querySelectorAll("[data-catalog-archive]").forEach((button) => button.addEventListener("click", (event) => this._archiveCatalog(event)));
    this.shadowRoot.querySelectorAll("[data-open-catalog-editor]").forEach((button) => button.addEventListener("click", () => this._openCatalogEditor(button.dataset.catalogKind, button.dataset.catalogId)));
    this.shadowRoot.querySelectorAll("[data-catalog-kind-nav]").forEach((button) => button.addEventListener("click", () => this._selectCatalogKind(button.dataset.catalogKindNav)));
    this.shadowRoot.querySelector("[data-close-catalog-editor]")?.addEventListener("click", () => this._closeCatalogEditor());
    this.shadowRoot.querySelectorAll("[data-plan-item-form]").forEach((form) => form.addEventListener("submit", (event) => this._handlePlanItemSave(event)));
    this.shadowRoot.querySelectorAll("[data-plan-item-field]").forEach((input) => {
      input.addEventListener("input", (event) => this._updatePlanItemDraft(event));
      input.addEventListener("change", (event) => this._updatePlanItemDraft(event));
    });
    this.shadowRoot.querySelectorAll("[data-plan-item-archive]").forEach((button) => button.addEventListener("click", (event) => this._archivePlanItem(event)));
    this.shadowRoot.querySelectorAll("[data-open-plan-item-editor]").forEach((button) => button.addEventListener("click", () => this._openPlanItemEditor(button.dataset.planItemId)));
    this.shadowRoot.querySelector("[data-close-plan-item-editor]")?.addEventListener("click", () => this._closePlanItemEditor());
    this.shadowRoot.querySelector("[data-section-retry]")?.addEventListener("click", () => this._openSectionOverview(this._view));
    this.shadowRoot.querySelectorAll("[data-section-nav]").forEach((button) => button.addEventListener("click", () => {
      const target = button.dataset.sectionNav;
      if (target === "review") this._openReview();
      else if (target === "resolved") this._openResolvedBookings();
      else if (target === "plan_items") this._openPlanItems();
      else if (target === "accounts") this._openAccounts();
      else if (target === "pets") this._openPets();
      else if (target === "feed_profiles") this._openFeedProfiles();
      else if (target === "catalogs") this._openCatalogs();
      else if (target === "overview") this._navigateToOverview();
      else if (SECTION_VIEWS.includes(target)) this._openSectionOverview(target);
    }));
    this.shadowRoot.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.nav === "review") this._openReview();
      else if (button.dataset.nav === "resolved") this._openResolvedBookings();
      else if (button.dataset.nav === "plan_items") this._openPlanItems();
      else if (button.dataset.nav === "accounts") this._openAccounts();
      else if (button.dataset.nav === "pets") this._openPets();
      else if (button.dataset.nav === "feed_profiles") this._openFeedProfiles();
      else if (button.dataset.nav === "catalogs") this._openCatalogs();
      else if (button.dataset.nav === "rules") this._openRules();
      else if (button.dataset.nav === "overview") this._navigateToOverview();
      else if (SECTION_VIEWS.includes(button.dataset.nav)) this._openSectionOverview(button.dataset.nav);
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
      ["rules", "tasks", "Regeln"],
      ["resolved", "check", "Buchungen"],
    ];
    return items.map(([id, iconName, label]) => {
      const target = id === "planner" ? "plan_items" : id;
      const current = (this._view === "plan_items" && id === "planner") || this._view === id;
      return `<button class="nav-item" data-nav="${target}"${current ? ' aria-current="page"' : ""} type="button" aria-label="${escapeHtml(label)}">${icon(iconName, 22)}<span>${label}</span></button>`;
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
      <div id="feedback-presenter" class="feedback-presenter" data-feedback-presenter popover="manual" role="status" aria-live="polite" aria-atomic="true">
        <p class="feedback-presenter-message" data-feedback-message></p>
        <button class="feedback-presenter-close" type="button" data-feedback-close popovertarget="feedback-presenter" popovertargetaction="hide" aria-label="Meldung schließen">Schließen</button>
      </div>
      <dialog class="confirm-dialog" data-confirm-dialog closedby="closerequest" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <div class="confirm-dialog-content">
          <h2 id="confirm-dialog-title" data-confirm-title>Bestätigung erforderlich</h2>
          <p class="confirm-dialog-message" id="confirm-dialog-message" data-confirm-message></p>
          <form method="dialog" class="confirm-dialog-actions">
            <button class="confirm-dialog-cancel" type="submit" value="cancel" data-confirm-cancel>Abbrechen</button>
            <button class="confirm-dialog-submit" type="submit" value="confirm" data-confirm-submit>Bestätigen</button>
          </form>
        </div>
      </dialog>
      <dialog class="booking-detail-dialog" data-booking-detail-dialog closedby="closerequest" aria-labelledby="booking-detail-title" aria-describedby="booking-detail-description">
        <div class="booking-detail-content" data-booking-detail-content></div>
      </dialog>
    </div>`;
  }

  _toolbarTemplate() {
    return `<header class="toolbar">
      <div class="product-lockup"><h1>Finanzplaner</h1><span class="demo-chip">${this._data.demo === false ? "LIVE" : "DEMO"}</span><p>Gemeinsam. Überblick. Handeln.</p></div>
      <div class="toolbar-actions">
        <div class="month-control" aria-label="Monat auswählen"><button type="button" data-action="previous-month" aria-label="Vorheriger Monat">${icon("chevronLeft", 20)}</button><span class="month-label">${monthLabel(this._month)} ${icon("calendarSmall", 16)}</span><button type="button" data-action="next-month" aria-label="Nächster Monat">${icon("chevronRight", 20)}</button></div>
        <button class="review-pill" type="button" data-action="review">${icon("warning", 17)}<span>Buchungen prüfen</span><span class="count">${escapeHtml(this._data.unresolved_count)}</span></button>
        <button class="icon-button" type="button" data-action="accounts" aria-label="Konten verwalten">${icon("settings", 21)}</button>
      </div>
    </header>`;
  }

  _comparisonTemplate(data) {
    const dimension = this._comparisonDimension;
    const label = comparisonDimensionLabel(dimension);
    const entries = comparisonEntries(data.comparison, dimension);
    const rows = entries.map((entry, index) => {
      const variance = Number(entry.variance || 0);
      const status = variance > 0 ? "Ist über Plan" : variance < 0 ? "Ist unter Plan" : "Ist entspricht Plan";
      return `<tr><th scope="row">${escapeHtml(entry.name)}</th>
        <td class="section-table-number">${formatEuro(entry.plan)}</td>
        <td class="section-table-number">${formatEuro(entry.forecast)}</td>
        <td class="section-table-number">${formatEuro(entry.actual)}</td>
        <td class="section-table-number">${formatEuro(variance)}<small>${status}</small></td>
        <td><button class="section-action" id="comparison-detail-${index}" type="button" data-comparison-detail="${escapeHtml(entry.key)}" aria-label="Details für ${escapeHtml(entry.name)}" aria-controls="comparison-details" aria-expanded="${this._breakdownSelection?.key === entry.key}" ${data.demo || this._loading ? "disabled" : ""}>Details</button></td></tr>`;
    }).join("");
    return `<section class="surface section-card comparison-section" aria-labelledby="comparison-heading">
      <h3 id="comparison-heading">Budget-Ist-Vergleich</h3>
      <p>${monthLabel(this._month)} · Abweichung = Ist minus Plan. Positive Werte liegen über, negative unter dem geplanten Saldo.</p>
      ${data.demo ? `<p>Demo-Daten · Prognose entspricht hier dem Ist. Detailbuchungen sind in der Demo nicht verfügbar.</p>` : ""}
      <div class="section-actions" role="group" aria-label="Vergleich gruppieren nach">
        ${["categories", "areas", "projects"].map((kind) => `<button class="section-action" id="comparison-dimension-${kind}" type="button" data-comparison-dimension="${kind}" aria-pressed="${dimension === kind}">${comparisonDimensionLabel(kind)}</button>`).join("")}
      </div>
      ${this._loading ? `<p role="status" aria-live="polite">Vergleichswerte werden geladen …</p>` : rows ? `<div class="section-data-table-wrap" role="region" aria-label="${label} im Monatsvergleich" tabindex="0"><table class="section-data-table">
        <caption class="visually-hidden">${label} · ${monthLabel(this._month)} · Beträge in Euro</caption>
        <thead><tr><th scope="col">Bezeichnung</th><th scope="col">Plan</th><th scope="col">Prognose</th><th scope="col">Ist</th><th scope="col">Abweichung</th><th scope="col">Details</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : `<p class="empty-state" role="status" aria-live="polite">Keine Vergleichswerte für ${label} in diesem Monat. Werte erscheinen, sobald Planposten oder Buchungen vorhanden sind.</p>`}
      <div id="comparison-details">${this._breakdownTemplate(entries)}</div>
    </section>`;
  }

  _breakdownTemplate(entries) {
    const selection = this._breakdownSelection;
    if (!selection) return "";
    const details = this._breakdown;
    const name = details?.name ?? entries.find((entry) => entry.key === selection.key)?.name ?? "Vergleich";
    const status = this._breakdownLoading ? "Details werden geladen …" : this._breakdownError || "Details geladen.";
    const plans = (details?.plan_items || []).map((item) => `<tr><th scope="row">${escapeHtml(item.name)}</th>
      <td>${({ income: "Einnahme", expense: "Ausgabe", saving: "Rücklage" })[item.direction] || "Planposten"}</td>
      <td class="section-table-number">${formatEuro(item.amount)}</td><td>${escapeHtml(planItemFrequencyLabel(item.frequency_months))}</td></tr>`).join("");
    const bookings = (details?.bookings || []).map((booking) => `<tr><th scope="row">${escapeHtml(booking.counterparty || "Ohne Zahlungsempfänger")}</th>
      <td>${escapeHtml(formatDate(booking.booking_date))}</td><td>${escapeHtml(booking.purpose)}</td>
      <td class="section-table-number">${formatEuro(booking.matched_amount)}</td></tr>`).join("");
    return `<section class="comparison-details" aria-labelledby="comparison-details-heading">
      <h4 id="comparison-details-heading" tabindex="-1">${escapeHtml(name)} · ${monthLabel(this._month)}</h4>
      <p role="status" aria-live="polite" aria-atomic="true">${escapeHtml(status)}</p>
      <div class="section-actions"><button class="section-action" id="comparison-close" type="button" data-comparison-close>Vergleich schließen</button>
        <button class="section-action" id="comparison-retry" type="button" data-comparison-retry ${this._breakdownLoading ? "disabled" : ""}>Erneut laden</button></div>
      ${details ? `<p>Planposten zeigen den hinterlegten Betrag und Rhythmus. Buchungen zeigen nur den Anteil dieser Zuordnung. Futterprognosen können zusätzliche Prognosewerte liefern.</p>
        <div class="section-data-table-wrap" role="region" aria-label="Planposten für ${escapeHtml(name)}" tabindex="0"><table class="section-data-table"><caption>Planposten · ${escapeHtml(name)}</caption>
          <thead><tr><th scope="col">Bezeichnung</th><th scope="col">Richtung</th><th scope="col">Betrag</th><th scope="col">Rhythmus</th></tr></thead>
          <tbody>${plans || `<tr><td colspan="4">Keine Planposten für diese Zuordnung im ausgewählten Monat.</td></tr>`}</tbody></table></div>
        <div class="section-data-table-wrap" role="region" aria-label="Buchungen für ${escapeHtml(name)}" tabindex="0"><table class="section-data-table"><caption>Buchungen · ${escapeHtml(name)}</caption>
          <thead><tr><th scope="col">Zahlungsempfänger</th><th scope="col">Datum</th><th scope="col">Verwendungszweck</th><th scope="col">Zugeordneter Betrag</th></tr></thead>
          <tbody>${bookings || `<tr><td colspan="4">Keine Buchungen für diese Zuordnung im ausgewählten Monat.</td></tr>`}</tbody></table></div>` : ""}
    </section>`;
  }

  _overviewTemplate() {
    const data = dataWithDefaults(this._data);
    const variance = Number(data.variance || 0);
    const household = data.household || demoHousehold;
    const last = data.last_unresolved;
    const areaScale = Math.max(1, ...data.areas.flatMap((area) => [
      Math.abs(Number(area.actual ?? area.value ?? 0)),
      Math.abs(Number(area.plan ?? 0)),
    ]));
    const areaRows = data.areas.map((area, index) => {
      const actual = Number(area.actual ?? area.value ?? 0);
      const plan = Number(area.plan ?? 0);
      const width = Math.max(4, Math.min(100, Math.max(Math.abs(actual), Math.abs(plan)) / areaScale * 100));
      const label = `${area.name}: Ist ${formatEuro(actual)} · Plan ${formatEuro(plan)}`;
      return `<div class="bar-row" title="${escapeHtml(label)}"><span>${escapeHtml(area.name)}</span><span class="bar-track"><span class="bar-fill ${index === 1 ? "bar-fill--cyan" : index === 2 ? "bar-fill--amber" : index === 3 ? "bar-fill--coral" : ""}" style="inline-size:${width}%"></span></span><span class="bar-value"><strong>${formatEuro(actual)}</strong><small>Plan ${formatEuro(plan)}</small></span></div>`;
    }).join("");
    const categoryRows = data.categories.map((category) => {
      const actual = Number(category.actual ?? category.value ?? 0);
      const plan = Number(category.plan ?? 0);
      return `<li class="category-item">${icon(category.icon || "overview", 17)}<span>${escapeHtml(category.name)}</span><span class="category-values"><strong>${formatEuro(actual)}</strong><small>Plan ${formatEuro(plan)}</small></span></li>`;
    }).join("");
    const content = `<main class="main" id="content" tabindex="-1">
      ${this._toolbarTemplate()}
      <section class="hero" id="overview" aria-labelledby="overview-title">
        <div class="report-switcher" role="group" aria-label="Berichtszeitraum"><span>Bericht</span><button type="button" data-report-view="month" aria-pressed="${this._reportView === "month"}">Monat</button><button type="button" data-report-view="year" aria-pressed="${this._reportView === "year"}">Jahr</button><button type="button" data-report-view="cashflow" aria-pressed="${this._reportView === "cashflow"}">Cashflow</button></div>
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
      ${this._reportTemplate()}
      ${this._comparisonTemplate(data)}
      <div class="bottom-grid">
        <section class="surface bottom-card" aria-labelledby="household-heading" data-reveal style="--reveal-order: 8"><h3 id="household-heading">Haushaltsübersicht</h3><p class="subline">${monthLabel(this._month)}</p><div class="metric-strip"><div class="mini-metric mini-metric--positive"><span class="mini-metric-icon">${icon("income", 25)}</span><p class="mini-metric-label">Einnahmen</p><p class="mini-metric-value">${formatEuro(household.income)}</p><p class="mini-metric-caption">${planShareCaption(household.income, household.income_plan, "kein Planwert")}</p></div><div class="mini-metric mini-metric--negative"><span class="mini-metric-icon">${icon("expense", 25)}</span><p class="mini-metric-label">Ausgaben</p><p class="mini-metric-value">${formatEuro(household.expenses)}</p><p class="mini-metric-caption">${planShareCaption(household.expenses, household.expenses_plan, "kein Planwert")}</p></div><div class="mini-metric mini-metric--negative"><span class="mini-metric-icon">${icon("savings", 25)}</span><p class="mini-metric-label">Rücklagen</p><p class="mini-metric-value">${formatEuro(household.savings)}</p><p class="mini-metric-caption">${planShareCaption(household.savings, household.savings_plan, "kein Planwert")}</p></div><div class="mini-metric mini-metric--available"><span class="mini-metric-icon">${icon("coins", 25)}</span><p class="mini-metric-label">Verfügbar</p><p class="mini-metric-value">${formatEuro(household.available)}</p><p class="mini-metric-caption">bisheriger Saldo</p></div></div></section>
        <section class="surface bottom-card" aria-labelledby="areas-heading" data-reveal style="--reveal-order: 9"><h3 id="areas-heading">Bereiche <span class="visually-hidden">Ist gegenüber Plan</span></h3><p class="subline">Ist vs. Plan</p><div class="bar-list">${areaRows || `<p class="empty-state">Für diesen Monat sind noch keine Bereichswerte vorhanden.</p>`}</div></section>
        <section class="surface bottom-card" aria-labelledby="categories-heading" data-reveal style="--reveal-order: 10"><h3 id="categories-heading">Top Kategorien <span class="visually-hidden">Ausgaben</span></h3><p class="subline">Ist vs. Plan</p><ul class="category-list">${categoryRows || `<li class="empty-state">Für diesen Monat sind noch keine Kategorien vorhanden.</li>`}</ul></section>
      </div>
      <footer class="statusbar"><span>Datenstand: <strong>${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date())}</strong> · ${data.demo ? "Demo-Daten" : "lokale Daten"}</span><span>Fin Zuhause · Viele Bereiche · Fin Plan</span></footer>
    </main>`;
    return this._shellTemplate(content);
  }

  _sectionOverviewTemplate(view) {
    const meta = SECTION_OVERVIEW_META[view] || SECTION_OVERVIEW_META.household;
    const data = dataWithDefaults(this._data);
    const household = data.household || demoHousehold;
    const metricCard = (label, value, caption, tone = "") => `<article class="surface section-card"><p class="section-stat-label">${escapeHtml(label)}</p><p class="section-stat-value${tone ? ` section-stat-value--${tone}` : ""}">${value}</p><p class="section-stat-caption">${escapeHtml(caption)}</p></article>`;
    const actionButton = (target, label, iconName = "arrowRight", tone = "") => `<button class="section-action${tone ? ` section-action--${tone}` : ""}" type="button" data-section-nav="${escapeHtml(target)}">${escapeHtml(label)} ${icon(iconName, 17)}</button>`;
    let body;

    if (this._sectionLoading) {
      body = `<div class="empty-state section-status" role="status">Personen werden geladen …</div>`;
    } else if (this._sectionLoadFailed) {
      body = `<div class="empty-state section-status" role="alert">Personen stehen derzeit nicht zur Verfügung.<br><button class="section-action section-action--primary" type="button" data-section-retry>Erneut versuchen ${icon("arrowRight", 17)}</button></div>`;
    } else if (view === "energy") {
      const energyEntries = new Map();
      [...data.areas.map((entry) => ({ ...entry, kind: "Bereich" })), ...data.categories.map((entry) => ({ ...entry, kind: "Kategorie" }))]
        .filter((entry) => /energie|strom|pv|solar|photovoltaik|elektr/i.test(String(entry.name || "")))
        .forEach((entry) => energyEntries.set(`${entry.kind}:${entry.name}`, entry));
      const entries = [...energyEntries.values()];
      const energyActual = entries.reduce((sum, entry) => sum + Number(entry.actual ?? entry.value ?? 0), 0);
      const energyPlan = entries.reduce((sum, entry) => sum + Number(entry.plan ?? 0), 0);
      const energyRows = entries.map((entry) => `<tr><th scope="row">${escapeHtml(entry.name)}</th><td class="section-table-muted">${escapeHtml(entry.kind)}</td><td class="section-table-number">${formatEuro(entry.actual ?? entry.value ?? 0)}</td><td class="section-table-number">${formatEuro(entry.plan ?? 0)}</td></tr>`).join("");
      body = `<div class="section-view-grid">
        ${metricCard("Energie · Ist", formatEuro(energyActual), entries.length ? `${entries.length} erkannte Energieposten` : "Noch nicht klassifiziert", energyActual < 0 ? "negative" : "positive")}
        ${metricCard("Energie · Plan", formatEuro(energyPlan), entries.length ? "Planwert der erkannten Posten" : "Noch kein Planwert", energyPlan < 0 ? "negative" : "positive")}
        ${metricCard("Monatsergebnis", formatEuro(data.forecast), `${monthLabel(this._month)} · Prognose`, data.forecast < 0 ? "negative" : "positive")}
        <section class="surface section-card section-card--wide" aria-labelledby="energy-breakdown-heading"><h3 id="energy-breakdown-heading">Energieposten</h3><p>Bereiche und Kategorien mit Energiebezug aus der aktuellen Monatsauswertung.</p>${entries.length ? `<div class="section-data-table-wrap"><table class="section-data-table"><caption class="visually-hidden">Energieposten im Monatsvergleich</caption><thead><tr><th scope="col">Bezeichnung</th><th scope="col">Typ</th><th scope="col">Ist</th><th scope="col">Plan</th></tr></thead><tbody>${energyRows}</tbody></table></div>` : `<div class="section-empty">Noch keine Energieposten in der Auswertung gefunden. Ordne einen Planposten oder eine Buchung einer Kategorie bzw. einem Bereich wie Strom oder PV zu.${actionButton("plan_items", "Planposten öffnen", "arrowRight", "primary")}</div>`}</section>
        <section class="surface section-card" aria-labelledby="energy-next-heading"><h3 id="energy-next-heading">Weiter planen</h3><p>Die Detailzuordnung bleibt in den Planposten nachvollziehbar und änderbar.</p><div class="section-actions">${actionButton("plan_items", "Planposten öffnen", "arrowRight", "primary")}${actionButton("catalogs", "Stammdaten öffnen")}</div></section>
      </div>`;
    } else if (view === "calendar") {
      const trend = data.trend || {};
      const series = [trend.planned || [], trend.forecast || [], trend.actual || []];
      const count = Math.max(2, ...series.map((values) => values.length));
      const todayIndex = Math.min(count - 1, Math.max(0, Number(trend.today_index || 0)));
      const checkpoints = [...new Set([0, todayIndex, count - 1])];
      const checkpointLabel = (index) => index === todayIndex && trend.today_label ? `Heute · ${trend.today_label}` : index === 0 ? "Monatsbeginn" : index === count - 1 ? "Monatsende" : `Tag ${index + 1}`;
      const trendValue = (values, index) => Number.isFinite(Number(values[index])) ? formatEuro(values[index]) : "—";
      const calendarRows = checkpoints.map((index) => `<tr><th scope="row">${escapeHtml(checkpointLabel(index))}</th><td class="section-table-number">${trendValue(trend.planned || [], index)}</td><td class="section-table-number">${trendValue(trend.forecast || [], index)}</td><td class="section-table-number">${trendValue(trend.actual || [], index)}</td></tr>`).join("");
      body = `<div class="section-view-grid">
        ${metricCard("Planung", formatEuro(data.plan), "geplantes Monatsergebnis", data.plan < 0 ? "negative" : "positive")}
        ${metricCard("Prognose", formatEuro(data.forecast), "erwartetes Monatsergebnis", data.forecast < 0 ? "negative" : "positive")}
        ${metricCard("Ist", formatEuro(data.actual), "bisher gebuchtes Ergebnis", data.actual < 0 ? "negative" : "positive")}
        <section class="surface section-card section-card--wide" aria-labelledby="calendar-table-heading"><h3 id="calendar-table-heading">Monatskalender</h3><p>Finanzielle Referenzpunkte für ${monthLabel(this._month)} · kumulierte Werte in Euro.</p><div class="section-data-table-wrap"><table class="section-data-table"><caption class="visually-hidden">Kumulierte Werte im Monatsverlauf</caption><thead><tr><th scope="col">Referenzpunkt</th><th scope="col">Planung</th><th scope="col">Prognose</th><th scope="col">Ist</th></tr></thead><tbody>${calendarRows}</tbody></table></div></section>
        <section class="surface section-card" aria-labelledby="calendar-next-heading"><h3 id="calendar-next-heading">Termine vorbereiten</h3><p>Planposten bilden die wiederkehrenden und einmaligen Zahlungstermine für den Monatsverlauf.</p><div class="section-actions">${actionButton("plan_items", "Planposten öffnen", "arrowRight", "primary")}</div><div class="section-note">${icon("calendarSmall", 18)}<span>Die Ansicht zeigt derzeit finanzielle Monatsmarken. Ein eigener Ereigniskalender folgt, sobald dafür Daten im Finanzplaner vorhanden sind.</span></div></section>
      </div>`;
    } else if (view === "tasks") {
      const unresolvedCount = Number(data.unresolved_count) || 0;
      const feedForecast = Number(data.feed_forecast_total) || 0;
      body = `<div class="section-view-grid">
        ${metricCard("Offene Buchungen", escapeHtml(unresolvedCount), unresolvedCount ? "Prüfung erforderlich" : "Alles zugeordnet", unresolvedCount ? "negative" : "positive")}
        ${metricCard("Futterprognose", formatEuro(feedForecast), feedForecast ? "geplante Käufe im Monat" : "Keine Kaufprognose", feedForecast ? "negative" : "positive")}
        ${metricCard("Planabweichung", formatEuro(data.variance), "Prognose gegenüber Planung", data.variance < 0 ? "negative" : "positive")}
        <section class="surface section-card section-card--wide" aria-labelledby="tasks-next-heading"><h3 id="tasks-next-heading">Als Nächstes</h3><p>Die wichtigsten offenen Schritte für den ausgewählten Monat.</p><div class="section-actions">${actionButton("review", unresolvedCount ? "Buchungen prüfen" : "Prüfliste öffnen", "arrowRight", unresolvedCount ? "accent" : "primary")}${actionButton("feed_profiles", "Futterplanung öffnen", "cart")}</div><div class="section-note">${icon(unresolvedCount ? "warning" : "check", 18)}<span>${unresolvedCount ? `${unresolvedCount} Buchungen warten auf Ziel, Bereich, Kategorie oder Projekt.` : "Aktuell sind keine ungeklärten Buchungen gemeldet."}</span></div></section>
        <section class="surface section-card" aria-labelledby="tasks-context-heading"><h3 id="tasks-context-heading">Kontext</h3><p>Nach dem Erledigen einer Aufgabe aktualisiert sich die Monatsübersicht automatisch.</p><div class="section-actions">${actionButton("overview", "Zur Übersicht", "chevronLeft")}</div></section>
      </div>`;
    } else if (view === "household") {
      body = `<div class="section-view-grid">
        ${metricCard("Einnahmen", formatEuro(household.income), planShareCaption(household.income, household.income_plan, "kein Planwert"), "positive")}
        ${metricCard("Ausgaben", formatEuro(household.expenses), planShareCaption(household.expenses, household.expenses_plan, "kein Planwert"), "negative")}
        ${metricCard("Rücklagen", formatEuro(household.savings), planShareCaption(household.savings, household.savings_plan, "kein Planwert"), "negative")}
        ${metricCard("Verfügbar", formatEuro(household.available), "bisheriger Saldo", household.available < 0 ? "negative" : "positive")}
        <section class="surface section-card section-card--wide" aria-labelledby="household-plan-heading"><h3 id="household-plan-heading">Haushaltsplan</h3><p>Vergleich der Planwerte mit dem aktuellen Monatsstand für ${monthLabel(this._month)}.</p><div class="section-data-table-wrap"><table class="section-data-table"><caption class="visually-hidden">Haushaltswerte im Vergleich</caption><thead><tr><th scope="col">Wert</th><th scope="col">Ist</th><th scope="col">Plan</th></tr></thead><tbody><tr><th scope="row">Einnahmen</th><td class="section-table-number">${formatEuro(household.income)}</td><td class="section-table-number">${formatEuro(household.income_plan)}</td></tr><tr><th scope="row">Ausgaben</th><td class="section-table-number">${formatEuro(household.expenses)}</td><td class="section-table-number">${formatEuro(-Math.abs(Number(household.expenses_plan) || 0))}</td></tr><tr><th scope="row">Rücklagen</th><td class="section-table-number">${formatEuro(household.savings)}</td><td class="section-table-number">${formatEuro(-Math.abs(Number(household.savings_plan) || 0))}</td></tr><tr><th scope="row">Verfügbar</th><td class="section-table-number">${formatEuro(household.available)}</td><td class="section-table-number">${formatEuro(household.available_plan)}</td></tr></tbody></table></div></section>
        <section class="surface section-card" aria-labelledby="household-manage-heading"><h3 id="household-manage-heading">Verwalten</h3><p>Konten und Tierprofile liegen in eigenen, übersichtlichen Verwaltungsansichten.</p><div class="section-actions">${actionButton("accounts", "Konten öffnen", "settings", "primary")}${actionButton("pets", "Tiere öffnen", "paw")}</div></section>
      </div>`;
    } else {
      const people = Array.isArray(this._persons) ? this._persons : [];
      const personRows = people.map((person) => `<li class="section-person"><span class="section-person-name">${escapeHtml(person.name || person.entity_id || "Person")}</span><span class="section-person-id">${escapeHtml(person.entity_id || "")}</span></li>`).join("");
      body = `<div class="section-view-grid">
        ${metricCard("Verfügbare Personen", escapeHtml(people.length), people.length ? "Home-Assistant-Personen" : "Noch keine Personen gefunden", people.length ? "positive" : "negative")}
        ${metricCard("Buchungsziele", escapeHtml(people.length + 1), "inklusive gemeinsamer Haushalt", "positive")}
        ${metricCard("Aktueller Monat", escapeHtml(monthLabel(this._month)), "für Finanzzuordnungen verfügbar")}
        <section class="surface section-card section-card--wide" aria-labelledby="people-list-heading"><h3 id="people-list-heading">Personen im Haushalt</h3><p>Diese Liste stammt aus Home Assistant und steht für Kontoinhaber, Planungsziele und Buchungsaufteilungen zur Verfügung.</p>${personRows ? `<ul class="section-person-list">${personRows}</ul>` : `<div class="section-empty">Home Assistant liefert derzeit keine Personen für den Finanzplaner. Prüfe die Personeneinrichtung und öffne danach Konten oder die Prüfliste erneut.${actionButton("accounts", "Konten öffnen", "settings", "primary")}</div>`}</section>
        <section class="surface section-card" aria-labelledby="people-next-heading"><h3 id="people-next-heading">Personen verwenden</h3><p>Beim Prüfen einer Buchung oder Bearbeiten eines Kontos können Personen als Ziel ausgewählt werden.</p><div class="section-actions">${actionButton("review", "Buchungen prüfen", "arrowRight", "accent")}${actionButton("accounts", "Konten öffnen", "settings")}</div></section>
      </div>`;
    }

    const content = `<main class="main" id="content" tabindex="-1"><div class="section-view"><div class="section-view-header"><div><p class="section-kicker">${escapeHtml(meta.kicker)}</p><h2>${escapeHtml(meta.title)}</h2><p>${escapeHtml(meta.description)} · ${monthLabel(this._month)}</p></div><div class="section-view-actions"><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div></div>${body}</div></main>`;
    return this._shellTemplate(content);
  }

  _targetLabel(target, missingSuffix = "") {
    if (target === "household") return "Haushalt";
    const person = this._persons.find((entry) => entry.entity_id === target);
    return person ? person.name || person.entity_id : `${target || "Ziel"}${missingSuffix}`;
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
    const baseline = isNew ? this._newPlanItemDraft() : this._planItemDraftFromItem(item);
    const draft = this._planItemDrafts.get(itemId) || baseline;
    const hasChanges = !this._draftsEqual(draft, baseline);
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
      <div class="plan-item-card-actions"><label class="account-toggle" for="${fieldId("active")}"><input id="${fieldId("active")}" name="active" data-plan-item-field="active" type="checkbox"${active ? " checked" : ""}>Planposten aktiv</label><p class="plan-item-save-status${error ? " plan-item-save-status--error" : ""}" data-plan-item-save-status aria-live="polite">${escapeHtml(error)}</p>${!isNew && active ? `<button class="plan-item-archive" type="button" data-plan-item-archive data-plan-item-id="${escapeHtml(itemId)}">Archivieren</button>` : ""}<button class="plan-item-save" type="submit"${this._planItemSubmissions.has(itemId) || !hasChanges ? " disabled" : ""}>${isNew ? "Planposten anlegen" : "Änderungen speichern"} ${icon("check", 17)}</button></div>
    </form>`;
  }

  _planItemDirectionLabel(direction) {
    return {
      income: "Einnahme",
      expense: "Ausgabe",
      saving: "Rücklage",
    }[direction] || "Ausgabe";
  }

  _planItemTargetLabel(target) {
    if (!target) return "Kein festes Ziel";
    return this._targetLabel(target);
  }

  _planItemOverviewTemplate() {
    const activeCount = this._planItems.filter((item) => item.active !== false).length;
    const rows = this._planItems.map((item) => {
      const itemId = String(item.id);
      const name = item.name || "Planposten";
      return `<tr>
        <th scope="row">${escapeHtml(name)}</th>
        <td>${escapeHtml(this._planItemDirectionLabel(item.direction))}</td>
        <td class="table-number">${formatEuro(item.amount)}</td>
        <td>${escapeHtml(planItemFrequencyLabel(item.frequency_months))}</td>
        <td data-table-secondary>${escapeHtml(this._planItemTargetLabel(item.target))}</td>
        <td><span class="plan-item-status${item.active !== false ? "" : " plan-item-status--archived"}">${planItemStatus(item.active !== false)}</span></td>
        <td class="table-actions"><button class="table-edit-button" type="button" data-open-plan-item-editor data-plan-item-id="${escapeHtml(itemId)}" aria-label="${escapeHtml(name)} bearbeiten">Bearbeiten ${icon("chevronRight", 16)}</button></td>
      </tr>`;
    }).join("");
    return `<div class="management-list-toolbar"><p><strong>${activeCount}</strong> aktive Planposten</p><button class="table-new-button" type="button" data-open-plan-item-editor data-plan-item-id="new">Planposten anlegen ${icon("plus", 17)}</button></div>
      <div class="management-table-wrap"><table class="management-table"><caption class="visually-hidden">Planpostenübersicht</caption><thead><tr><th scope="col">Bezeichnung</th><th scope="col">Richtung</th><th scope="col">Betrag</th><th scope="col">Rhythmus</th><th scope="col">Ziel</th><th scope="col">Status</th><th scope="col" class="table-actions">Aktion</th></tr></thead><tbody>${rows || `<tr><td colspan="7">Noch keine Planposten angelegt.</td></tr>`}</tbody></table></div>`;
  }

  _planItemsTemplate() {
    const overview = this._planItemsLoading
      ? `<div class="empty-state">Planposten werden geladen …</div>`
      : this._planItemsLoadFailed
        ? `<div class="empty-state">Planposten stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : this._planItemEditorId
          ? (() => {
            const isNew = this._planItemEditorId === "new";
            const itemIndex = this._planItems.findIndex((item) => String(item.id) === this._planItemEditorId);
            const item = isNew ? {} : (this._planItems[itemIndex] || {});
            return `<section class="management-editor" aria-labelledby="plan-item-editor-heading"><div class="management-editor-header"><div><h3 id="plan-item-editor-heading">${isNew ? "Neuen Planposten anlegen" : "Planposten bearbeiten"}</h3><p>${isNew ? "Lege einen wiederkehrenden oder einmaligen Planposten an." : "Passe die Werte an und speichere die Änderungen."}</p></div><button class="management-editor-back" type="button" data-close-plan-item-editor>${icon("chevronLeft", 16)} Zur Übersicht</button></div>${this._planItemFormTemplate(item, isNew ? 0 : itemIndex + 1, isNew)}</section>`;
          })()
          : this._planItemOverviewTemplate();
    const activeCount = this._planItems.filter((item) => item.active !== false).length;
    const content = `<main class="main" id="content" tabindex="-1"><div class="plan-items-view"><div class="plan-items-view-header"><div><h2>Planposten verwalten</h2><p>Ersetze deine Excel-Planung Schritt für Schritt: Betrag, Richtung, Rhythmus, Fälligkeit und fachliche Zuordnung bleiben direkt bearbeitbar.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><p class="plan-item-help"><strong>${activeCount} aktive Planposten</strong> · Einnahmen werden positiv, Ausgaben und Rücklagen negativ in der Übersicht berücksichtigt. Archivierte Einträge bleiben erhalten und können wieder aktiviert werden.</p>${overview}</div></main>`;
    return this._shellTemplate(content);
  }

  _petOverviewTemplate() {
    const activeCount = this._pets.filter((pet) => pet.active !== false).length;
    const rows = this._pets.map((pet) => {
      const petId = String(pet.id);
      const name = pet.name || "Tier";
      return `<tr><th scope="row">${escapeHtml(name)}</th><td data-table-secondary>${escapeHtml(pet.pet_type || "Nicht angegeben")}</td><td><span class="plan-item-status${pet.active !== false ? "" : " plan-item-status--archived"}">${planItemStatus(pet.active !== false)}</span></td><td class="table-actions"><button class="table-edit-button" type="button" data-open-pet-editor data-pet-id="${escapeHtml(petId)}" aria-label="${escapeHtml(name)} bearbeiten">Bearbeiten ${icon("chevronRight", 16)}</button></td></tr>`;
    }).join("");
    return `<div class="management-list-toolbar"><p><strong>${activeCount}</strong> aktive Tiere</p><button class="table-new-button" type="button" data-open-pet-editor data-pet-id="new">Tier anlegen ${icon("plus", 17)}</button></div><div class="management-table-wrap"><table class="management-table"><caption class="visually-hidden">Tierübersicht</caption><thead><tr><th scope="col">Name</th><th scope="col">Tier-Typ</th><th scope="col">Status</th><th scope="col" class="table-actions">Aktion</th></tr></thead><tbody>${rows || `<tr><td colspan="4">Noch keine Tiere angelegt.</td></tr>`}</tbody></table></div>`;
  }

  _petsTemplate() {
    const overview = this._petsLoading
      ? `<div class="empty-state">Tiere werden geladen …</div>`
      : this._petsLoadFailed
        ? `<div class="empty-state">Tiere stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : this._petEditorId
          ? (() => {
            const isNew = this._petEditorId === "new";
            const petIndex = this._pets.findIndex((pet) => String(pet.id) === this._petEditorId);
            const pet = isNew ? {} : (this._pets[petIndex] || {});
            return `<section class="management-editor" aria-labelledby="pet-editor-heading"><div class="management-editor-header"><div><h3 id="pet-editor-heading">${isNew ? "Neues Tier anlegen" : "Tier bearbeiten"}</h3><p>${isNew ? "Lege ein Tierprofil für Futter und Zuordnungen an." : "Passe das Tierprofil an und speichere die Änderungen."}</p></div><button class="management-editor-back" type="button" data-close-pet-editor>${icon("chevronLeft", 16)} Zur Übersicht</button></div>${this._petFormTemplate(pet, isNew ? 0 : petIndex + 1, isNew)}</section>`;
          })()
          : this._petOverviewTemplate();
    const activeCount = this._pets.filter((pet) => pet.active !== false).length;
    const content = `<main class="main" id="content" tabindex="-1"><div class="pets-view"><div class="pets-view-header"><div><h2>Tiere verwalten</h2><p>Verwalte eigene Tierprofile für Futter und andere Zuordnungen. Tiere sind keine Home-Assistant-Personen; historische Buchungen behalten ihren damaligen Namen.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><p class="plan-item-help"><strong>${activeCount} aktive Tiere</strong> · Archivierte Profile bleiben für historische Zuordnungen auswählbar, aber nicht für neue Planposten.</p>${overview}</div></main>`;
    return this._shellTemplate(content);
  }

  _feedProfilePetOptions(selectedPetId) {
    const options = [`<option value=""${selectedPetId ? "" : " selected"}>Tier auswählen</option>`];
    options.push(this._petOptions(selectedPetId, { includeEmpty: false }));
    return options.join("");
  }

  _feedProfileFormTemplate(profile, index, isNew = false) {
    const profileId = isNew ? "new" : String(profile.id);
    const baseline = isNew ? this._newFeedProfileDraft() : this._feedProfileDraftFromProfile(profile);
    const draft = this._feedProfileDrafts.get(profileId) || baseline;
    const hasChanges = !this._draftsEqual(draft, baseline);
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
      <div class="feed-profile-card-actions"><label class="account-toggle" for="${fieldId("active")}"><input id="${fieldId("active")}" name="active" data-feed-profile-field="active" type="checkbox"${active ? " checked" : ""}>Futterprofil aktiv</label><p class="feed-profile-save-status${error ? " feed-profile-save-status--error" : ""}" data-feed-profile-save-status aria-live="polite">${escapeHtml(error)}</p>${!isNew && active ? `<button class="feed-profile-purchase" type="button" data-feed-profile-purchase data-feed-profile-id="${escapeHtml(profileId)}">Kauf heute bestätigen</button><button class="feed-profile-archive" type="button" data-feed-profile-archive data-feed-profile-id="${escapeHtml(profileId)}">Archivieren</button>` : ""}<button class="feed-profile-save" type="submit"${this._feedProfileSubmissions.has(profileId) || !hasChanges ? " disabled" : ""}>${isNew ? "Futterprofil anlegen" : "Änderungen speichern"} ${icon("check", 17)}</button></div>
    </form>`;
  }

  _feedProfileOverviewTemplate() {
    const activeCount = this._feedProfiles.filter((profile) => profile.active !== false).length;
    const rows = this._feedProfiles.map((profile) => {
      const profileId = String(profile.id);
      const product = profile.product || "Futterprofil";
      const status = profile.active === false ? "archived" : (profile.status || "planned");
      const statusClass = status === "due_soon" ? " feed-status--due-soon" : status === "due" ? " feed-status--due" : status === "overdue" ? " feed-status--overdue" : status === "archived" ? " feed-status--archived" : "";
      return `<tr><th scope="row">${escapeHtml(profile.pet_name || "Tier nicht zugeordnet")}</th><td>${escapeHtml(product)}</td><td data-table-secondary>${escapeHtml(profile.package_unit || "Nicht angegeben")}</td><td class="table-number">${formatEuro(profile.expected_cost)}</td><td>${formatDate(profile.next_purchase_date)}</td><td><span class="feed-status${statusClass}">${status === "archived" ? "Archiviert" : escapeHtml(feedStatusLabel(status))}</span></td><td class="table-actions"><button class="table-edit-button" type="button" data-open-feed-profile-editor data-feed-profile-id="${escapeHtml(profileId)}" aria-label="${escapeHtml(product)} für ${escapeHtml(profile.pet_name || "Tier")} bearbeiten">Bearbeiten ${icon("chevronRight", 16)}</button></td></tr>`;
    }).join("");
    return `<div class="management-list-toolbar"><p><strong>${activeCount}</strong> aktive Futterprofile</p><button class="table-new-button" type="button" data-open-feed-profile-editor data-feed-profile-id="new">Futterprofil anlegen ${icon("plus", 17)}</button></div><div class="management-table-wrap"><table class="management-table"><caption class="visually-hidden">Futterprofilübersicht</caption><thead><tr><th scope="col">Tier</th><th scope="col">Produkt</th><th scope="col">Verpackung</th><th scope="col">Kosten</th><th scope="col">Nächster Kauf</th><th scope="col">Status</th><th scope="col" class="table-actions">Aktion</th></tr></thead><tbody>${rows || `<tr><td colspan="7">Noch keine Futterprofile angelegt.</td></tr>`}</tbody></table></div>`;
  }

  _feedProfilesTemplate() {
    const overview = this._feedProfilesLoading
      ? `<div class="empty-state">Futterprofile werden geladen …</div>`
      : this._feedProfilesLoadFailed
        ? `<div class="empty-state">Futterprofile stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : this._feedProfileEditorId
          ? (() => {
            const isNew = this._feedProfileEditorId === "new";
            const profileIndex = this._feedProfiles.findIndex((profile) => String(profile.id) === this._feedProfileEditorId);
            const profile = isNew ? {} : (this._feedProfiles[profileIndex] || {});
            return `<section class="management-editor" aria-labelledby="feed-profile-editor-heading"><div class="management-editor-header"><div><h3 id="feed-profile-editor-heading">${isNew ? "Neues Futterprofil anlegen" : "Futterprofil bearbeiten"}</h3><p>${isNew ? "Lege Verpackung, Kosten und Verbrauch für ein Tier an." : "Passe die Futterdaten an und speichere die Änderungen."}</p></div><button class="management-editor-back" type="button" data-close-feed-profile-editor>${icon("chevronLeft", 16)} Zur Übersicht</button></div>${this._feedProfileFormTemplate(profile, isNew ? 0 : profileIndex + 1, isNew)}</section>`;
          })()
          : this._feedProfileOverviewTemplate();
    const activeCount = this._feedProfiles.filter((profile) => profile.active !== false).length;
    const content = `<main class="main" id="content" tabindex="-1"><div class="feed-profiles-view"><div class="feed-profiles-view-header"><div><h2>Futter planen</h2><p>Hinterlege Verpackung, Kosten und Verbrauch pro Tier. Bestätigte Käufe verschieben die nächste Schätzung; es wird keine Buchung automatisch angelegt.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><p class="plan-item-help"><strong>${activeCount} aktive Futterprofile</strong> · Ein manuelles Intervall überschreibt den Durchschnitt aus bestätigten Käufen. Das voraussichtliche Kaufdatum wird als einzelnes Ereignis in der Prognose berücksichtigt.</p>${overview}</div></main>`;
    return this._shellTemplate(content);
  }

  _catalogEntryFormTemplate(kind, entry, index, isNew = false) {
    const entryId = isNew ? "new" : String(entry.id);
    const key = this._catalogKey(kind, entryId);
    const baseline = isNew ? { label: "", active: true, parent_id: null } : this._catalogDraftFromEntry(entry);
    const draft = this._catalogDrafts.get(key) || baseline;
    const hasChanges = !this._draftsEqual(draft, baseline);
    const active = draft.active !== false;
    const fieldId = `catalog-${kind}-label-${isNew ? "new" : index}`;
    const statusId = `catalog-${kind}-status-${isNew ? "new" : index}`;
    const error = this._catalogErrors.get(key) || "";
    const action = isNew
      ? `${CATALOGS_URL}/${kind}`
      : `${CATALOGS_URL}/${kind}/${encodeURIComponent(entryId)}`;
    const parentField = kind === "categories"
      ? `<label class="catalog-field catalog-field--parent" for="${fieldId}-parent"><span>Übergeordnete Kategorie</span><select id="${fieldId}-parent" name="parent_id" data-catalog-field="parent_id">${this._catalogParentOptions(draft.parent_id, entryId)}</select></label>`
      : "";
    return `<form class="catalog-entry-form${kind === "categories" ? " catalog-entry-form--category" : ""}${active ? "" : " catalog-entry-form--archived"}" action="${escapeHtml(action)}" method="post" data-catalog-form data-catalog-kind="${escapeHtml(kind)}" data-catalog-id="${escapeHtml(entryId)}" aria-labelledby="${fieldId}-heading"${this._catalogSubmissions.has(key) ? " aria-busy=\"true\"" : ""}>
      <label class="catalog-field" for="${fieldId}"><span id="${fieldId}-heading">Bezeichnung</span><input id="${fieldId}" name="label" data-catalog-field="label" type="text" value="${escapeHtml(draft.label || "")}" maxlength="120" autocomplete="off" required></label>${parentField}
      <div class="catalog-entry-actions"><label class="account-toggle" for="${fieldId}-active"><input id="${fieldId}-active" name="active" data-catalog-field="active" type="checkbox"${active ? " checked" : ""}>Aktiv</label>${!isNew && active ? `<button class="catalog-archive" type="button" data-catalog-archive data-catalog-kind="${escapeHtml(kind)}" data-catalog-id="${escapeHtml(entryId)}">Archivieren</button>` : ""}<button class="catalog-save" type="submit"${this._catalogSubmissions.has(key) || !hasChanges ? " disabled" : ""}>${isNew ? "Anlegen" : "Speichern"}</button></div>
      <p class="catalog-entry-status${error ? " catalog-entry-status--error" : ""}" id="${statusId}" data-catalog-save-status aria-live="polite">${escapeHtml(error)}</p>
    </form>`;
  }

  _catalogOverviewTemplate() {
    const kinds = ["categories", "areas", "projects"];
    const kind = kinds.includes(this._catalogOverviewKind) ? this._catalogOverviewKind : kinds[0];
    const entries = this._catalogEntries(kind).slice().sort((left, right) => {
      if (kind !== "categories") return String(left.label || "").localeCompare(String(right.label || ""), "de");
      const leftParent = left.parent_id ? this._catalogEntries(kind).find((entry) => String(entry.id) === String(left.parent_id)) : null;
      const rightParent = right.parent_id ? this._catalogEntries(kind).find((entry) => String(entry.id) === String(right.parent_id)) : null;
      return String(leftParent?.label || left.label || "").localeCompare(String(rightParent?.label || right.label || ""), "de")
        || (leftParent ? 1 : 0) - (rightParent ? 1 : 0)
        || String(left.label || "").localeCompare(String(right.label || ""), "de");
    });
    const rows = entries.map((entry) => {
      const entryId = String(entry.id);
      const label = entry.label || "Stammdateneintrag";
      const visibleLabel = kind === "categories" && entry.parent_id ? `Unterkategorie · ${label}` : label;
      return `<tr><th scope="row">${escapeHtml(visibleLabel)}</th><td><span class="plan-item-status${entry.active !== false ? "" : " plan-item-status--archived"}">${planItemStatus(entry.active !== false)}</span></td><td class="table-actions"><button class="table-edit-button" type="button" data-open-catalog-editor data-catalog-kind="${escapeHtml(kind)}" data-catalog-id="${escapeHtml(entryId)}" aria-label="${escapeHtml(label)} bearbeiten">Bearbeiten ${icon("chevronRight", 16)}</button></td></tr>`;
    }).join("");
    const activeCount = entries.filter((entry) => entry.active !== false).length;
    const navigation = kinds.map((candidate) => `<button id="catalog-kind-nav-${candidate}" class="catalog-kind-nav${candidate === kind ? " catalog-kind-nav--active" : ""}" type="button" role="tab" aria-selected="${candidate === kind ? "true" : "false"}" aria-controls="catalog-overview-panel" data-catalog-kind-nav="${candidate}">${catalogKindLabel(candidate)}</button>`).join("");
    return `<section class="catalog-overview" id="catalog-overview-panel" aria-labelledby="catalog-kind-nav-${kind}"><div class="catalog-kind-nav" role="tablist" aria-label="Stammdatentyp auswählen">${navigation}</div><div class="management-list-toolbar"><p><strong>${activeCount}</strong> aktive ${catalogKindLabel(kind).toLowerCase()}</p><button class="table-new-button" type="button" data-open-catalog-editor data-catalog-kind="${escapeHtml(kind)}" data-catalog-id="new">${catalogKindSingularLabel(kind)} anlegen ${icon("plus", 17)}</button></div><div class="management-table-wrap"><table class="management-table"><caption class="visually-hidden">${catalogKindLabel(kind)}übersicht</caption><thead><tr><th scope="col">Bezeichnung</th><th scope="col">Status</th><th scope="col" class="table-actions">Aktion</th></tr></thead><tbody>${rows || `<tr><td colspan="3">Noch keine ${catalogKindLabel(kind).toLowerCase()} angelegt.</td></tr>`}</tbody></table></div></section>`;
  }

  _catalogsTemplate() {
    const editor = this._catalogEditor
      ? (() => {
        const { kind, entryId } = this._catalogEditor;
        const isNew = entryId === "new";
        const entryIndex = this._catalogEntries(kind).findIndex((entry) => String(entry.id) === entryId);
        const entry = isNew ? {} : (this._catalogEntries(kind)[entryIndex] || {});
        return `<section class="management-editor" aria-labelledby="catalog-editor-heading"><div class="management-editor-header"><div><h3 id="catalog-editor-heading">${isNew ? `${catalogKindLabel(kind)} anlegen` : `${catalogKindLabel(kind)} bearbeiten`}</h3><p>${isNew ? "Lege einen neuen Stammdateneintrag an." : "Passe die Bezeichnung oder den Status an."}</p></div><button class="management-editor-back" type="button" data-close-catalog-editor>${icon("chevronLeft", 16)} Zur Übersicht</button></div>${this._catalogEntryFormTemplate(kind, entry, isNew ? 0 : entryIndex + 1, isNew)}</section>`;
      })()
      : this._catalogOverviewTemplate();
    const content = this._catalogsLoading
      ? `<main class="main" id="content" tabindex="-1"><div class="catalogs-view"><div class="empty-state">Stammdaten werden geladen …</div></div></main>`
      : this._catalogsLoadFailed
      ? `<main class="main" id="content" tabindex="-1"><div class="catalogs-view"><div class="empty-state">Stammdaten stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div></div></main>`
        : `<main class="main" id="content" tabindex="-1"><div class="catalogs-view"><div class="catalogs-view-header"><div><h2>Stammdaten</h2><p>Verwalte die Begriffe, mit denen du Planposten und Buchungen einheitlich ordnest. Beim Umbenennen werden bestehende Zuordnungen automatisch mitgeführt.</p></div><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div><p class="catalog-help">Archivierte Einträge bleiben in historischen Buchungen sichtbar und können wieder aktiviert werden. Neue Freitextwerte aus Importen werden als Stammdaten ergänzt.</p>${editor}</div></main>`;
    return this._shellTemplate(content);
  }

  _petFormTemplate(pet, index, isNew = false) {
    const petId = isNew ? "new" : String(pet.id);
    const baseline = isNew ? this._newPetDraft() : this._petDraftFromPet(pet);
    const draft = this._petDrafts.get(petId) || baseline;
    const hasChanges = !this._draftsEqual(draft, baseline);
    const active = draft.active !== false;
    const title = isNew ? "Neues Tier anlegen" : (draft.name || "Tier");
    const fieldId = (field) => `pet-${field}-${isNew ? "new" : index}`;
    const error = this._petErrors.get(petId) || "";
    const action = isNew ? PETS_URL : `${PETS_URL}/${encodeURIComponent(petId)}`;
    return `<form class="surface pet-card${active ? "" : " pet-card--archived"}" action="${escapeHtml(action)}" method="post" data-pet-form data-pet-id="${escapeHtml(petId)}" aria-labelledby="${fieldId("heading")}"${this._petSubmissions.has(petId) ? " aria-busy=\"true\"" : ""}>
      <div class="pet-card-header"><h3 id="${fieldId("heading")}">${escapeHtml(title)}</h3><span class="plan-item-status${active ? "" : " plan-item-status--archived"}">${planItemStatus(active)}</span><p>${isNew ? "Manuell angelegt" : "Tierprofil"}</p></div>
      <label class="pet-field" for="${fieldId("name")}">Name<input id="${fieldId("name")}" name="name" data-pet-field="name" type="text" value="${escapeHtml(draft.name || "")}" maxlength="80" autocomplete="off" required></label>
      <label class="pet-field" for="${fieldId("pet_type")}">Tier-Typ (optional)<input id="${fieldId("pet_type")}" name="pet_type" data-pet-field="pet_type" type="text" value="${escapeHtml(draft.pet_type || "")}" maxlength="60" autocomplete="off" placeholder="z. B. Hund, Katze"></label>
      <div class="pet-card-actions"><label class="account-toggle" for="${fieldId("active")}"><input id="${fieldId("active")}" name="active" data-pet-field="active" type="checkbox"${active ? " checked" : ""}>Tierprofil aktiv</label><p class="pet-save-status${error ? " pet-save-status--error" : ""}" data-pet-save-status aria-live="polite">${escapeHtml(error)}</p>${!isNew && active ? `<button class="pet-archive" type="button" data-pet-archive data-pet-id="${escapeHtml(petId)}">Archivieren</button>` : ""}<button class="pet-save" type="submit"${this._petSubmissions.has(petId) || !hasChanges ? " disabled" : ""}>${isNew ? "Tier anlegen" : "Änderungen speichern"} ${icon("check", 17)}</button></div>
    </form>`;
  }

  _accountFormTemplate(account, index) {
    const accountId = String(account.id);
    const baseline = this._accountDraftFromAccount(account);
    const draft = this._accountDrafts.get(accountId) || baseline;
    const hasChanges = !this._draftsEqual(draft, baseline);
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
    return `<form class="surface account-card" method="post" data-account-form data-account-id="${escapeHtml(account.id)}" aria-labelledby="account-heading-${index}">
      <div class="account-card-header"><h3 id="account-heading-${index}">${escapeHtml(accountLabel)}</h3><p class="account-reference">${escapeHtml(maskedReference)}</p></div>
      <label class="account-field" for="${labelId}">Kontoname<input id="${labelId}" name="label" data-account-label type="text" value="${escapeHtml(draft.label || "")}" autocomplete="off" required></label>
      <label class="account-field" for="${bankId}">Bank<input id="${bankId}" name="bank" data-account-bank type="text" value="${escapeHtml(draft.bank || "")}" autocomplete="organization" placeholder="z. B. Erste Bank"></label>
      <label class="account-field" for="${ibanId}">IBAN<input id="${ibanId}" name="iban" data-account-iban type="text" value="${escapeHtml(draft.iban || "")}" autocomplete="off" inputmode="text" aria-describedby="${ibanHintId}" placeholder="Nur zum Ändern eingeben"><small id="${ibanHintId}">${account.iban_masked ? `Gespeichert: ${escapeHtml(account.iban_masked)} · leer lassen, wenn sie unverändert bleiben soll.` : "Leer lassen, wenn noch keine IBAN hinterlegt werden soll."}</small></label>
      <fieldset class="account-owners"><legend>Kontoinhaber</legend><label class="visually-hidden" for="${ownersId}">Kontoinhaber für ${escapeHtml(accountLabel)} auswählen</label><select id="${ownersId}" name="owner_targets" data-account-owners multiple size="4" aria-describedby="${ownerStatusId}">${this._personOptions(ownerTargets)}</select><p class="account-owner-status${ownerTargets.length ? "" : " account-owner-status--missing"}" id="${ownerStatusId}" data-account-owner-status>${escapeHtml(ownerStatus)}</p></fieldset>
      <div class="account-toggle"><label for="${activeId}"><input id="${activeId}" name="active" data-account-active type="checkbox"${active ? " checked" : ""}>Konto aktiv <span class="visually-hidden">(deaktivieren archiviert das Konto)</span></label><span class="account-active-status${active ? "" : " account-active-status--archived"}" data-account-active-status aria-hidden="true">${accountActiveStatus(active)}</span></div>
      <div class="account-card-actions"><p class="account-save-status" id="${saveStatusId}" data-account-save-status aria-live="polite"></p><button class="account-save" type="submit"${this._accountSubmissions.has(accountId) || !hasChanges ? " disabled" : ""} aria-label="Änderungen für ${escapeHtml(accountLabel)} (${escapeHtml(maskedReference)}) speichern" aria-describedby="${saveStatusId}">Änderungen speichern ${icon("check", 17)}</button></div>
    </form>`;
  }

  _accountOverviewTemplate() {
    const rows = this._accounts.map((account) => {
      const accountId = String(account.id);
      const draft = this._accountDrafts.get(accountId) || {};
      const label = draft.label || account.label || "Konto";
      const bank = draft.bank || account.bank || "Nicht angegeben";
      const ownerTargets = Array.isArray(draft.owner_targets) ? draft.owner_targets : (Array.isArray(account.owner_targets) ? account.owner_targets : []);
      const owners = ownerTargets.map((target) => this._targetLabel(target)).join(", ") || "Nicht zugeordnet";
      const maskedReference = account.iban_masked || account.account_reference || "Nicht verfügbar";
      const active = draft.active !== false && account.active !== false;
      return `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(bank)}</td><td class="table-number">${escapeHtml(maskedReference)}</td><td data-table-secondary>${escapeHtml(owners)}</td><td><span class="plan-item-status${active ? "" : " plan-item-status--archived"}">${accountActiveStatus(active)}</span></td><td class="table-actions"><button class="table-edit-button" type="button" data-open-account-editor data-account-id="${escapeHtml(accountId)}" aria-label="${escapeHtml(label)} bearbeiten">Bearbeiten ${icon("chevronRight", 16)}</button></td></tr>`;
    }).join("");
    return `<div class="management-table-wrap"><table class="management-table"><caption class="visually-hidden">Kontenübersicht</caption><thead><tr><th scope="col">Kontoname</th><th scope="col">Bank</th><th scope="col">Kontoreferenz</th><th scope="col">Kontoinhaber</th><th scope="col">Status</th><th scope="col" class="table-actions">Aktion</th></tr></thead><tbody>${rows || `<tr><td colspan="6">Keine Konten verfügbar. Importiere zuerst eine Bankdatei über „Buchungen prüfen“.</td></tr>`}</tbody></table></div>`;
  }

  _accountsTemplate() {
    const accountList = this._accountsLoading
      ? `<div class="empty-state">Konten werden geladen …</div>`
      : this._accountsLoadFailed
        ? `<div class="empty-state">Konten stehen derzeit nicht zur Verfügung. Bitte versuche es später erneut.</div>`
        : this._accountEditorId
          ? (() => {
            const accountIndex = this._accounts.findIndex((account) => String(account.id) === this._accountEditorId);
            const account = this._accounts[accountIndex];
            if (!account) return this._accountOverviewTemplate();
            return `<section class="management-editor" aria-labelledby="account-editor-heading"><div class="management-editor-header"><div><h3 id="account-editor-heading">Konto bearbeiten</h3><p>Ändere Name, Bank, Kontoinhaber oder den aktiven Status.</p></div><button class="management-editor-back" type="button" data-close-account-editor>${icon("chevronLeft", 16)} Zur Übersicht</button></div>${this._accountFormTemplate(account, accountIndex + 1)}</section>`;
          })()
          : this._accountOverviewTemplate();
    const content = `<main class="main" id="content" tabindex="-1"><div class="accounts-view"><div class="accounts-view-header"><div><h2>Konten verwalten</h2><p>Vergib verständliche Namen, ordne Kontoinhaber zu und archiviere nicht mehr verwendete Konten. Kontodaten werden ausschließlich maskiert angezeigt.</p></div><div class="accounts-actions"><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button><button class="review-action" type="button" data-action="review">Buchungen prüfen ${icon("arrowRight", 18)}</button></div></div>${accountList}</div></main>`;
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

  _ruleReferenceOptions(entries, selected, emptyLabel) {
    const current = (entries || []).find((entry) => entry.id === selected);
    const options = [`<option value=""${selected ? "" : " selected"}>${escapeHtml(emptyLabel)}</option>`];
    if (selected && (!current || current.active === false)) {
      options.push(`<option value="${escapeHtml(selected)}" selected disabled>${escapeHtml(current?.label || current?.name || selected)} (${current ? "archiviert" : "fehlt"}) – bitte ersetzen</option>`);
    }
    const activeEntries = (entries || []).filter((entry) => entry.active !== false);
    const entryById = new Map(activeEntries.map((entry) => [String(entry.id), entry]));
    const topLevel = activeEntries.filter((entry) => !entry.parent_id || !entryById.has(String(entry.parent_id)));
    const orderedEntries = topLevel.flatMap((parent) => [
      parent,
      ...activeEntries
        .filter((entry) => String(entry.parent_id || "") === String(parent.id))
        .sort((left, right) => String(left.label || "").localeCompare(String(right.label || ""), "de")),
    ]);
    options.push(...orderedEntries.map((entry) => {
      const label = entry.label || entry.name || entry.id;
      const displayLabel = entry.parent_id ? `Unterkategorie · ${label}` : label;
      return `<option value="${escapeHtml(entry.id)}"${selected === entry.id ? " selected" : ""}>${escapeHtml(displayLabel)}</option>`;
    }));
    return options.join("");
  }

  _ruleFieldTemplate(field, label, value, { index, options, type = "text", constraints = "", help = "" } = {}) {
    const key = index === undefined ? field : `${index}-${field}`;
    const id = `rule-${key}`;
    const attributes = `id="${id}" name="${index === undefined ? field : `allocations[${index}][${field}]`}" data-rule-field="${field}"${index === undefined ? "" : ` data-rule-index="${index}"`} aria-describedby="${id}-error${help ? ` ${id}-help` : ""}" aria-errormessage="${id}-error" ${constraints}`;
    return `<div class="rule-field"><label for="${id}">${escapeHtml(label)}</label>${options === undefined
      ? `<input ${attributes} type="${type}" value="${escapeHtml(value)}">`
      : `<select ${attributes}>${options}</select>`}${help ? `<small id="${id}-help">${escapeHtml(help)}</small>` : ""}<p class="rule-error" id="${id}-error"></p></div>`;
  }

  _ruleFormTemplate() {
    const draft = this._ruleDraft;
    const disabled = this._ruleSubmitting ? " disabled" : "";
    const field = (key, label, options = {}) => this._ruleFieldTemplate(key, label, draft[key], options);
    const allocations = draft.allocations.map((row, index) => {
      const rowField = (key, label, options = {}) => this._ruleFieldTemplate(key, label, row[key], { index, ...options });
      return `<fieldset class="rule-fieldset rule-allocation"><legend>Aufteilung ${index + 1}</legend><div class="rule-fields">
        ${rowField("target", "Ziel", { options: this._allocationTargetOptions(row.target), constraints: "required" })}
        ${rowField("share_percent", "Anteil in Prozent", { type: "number", constraints: 'required min="0.01" max="100" step="0.01" inputmode="decimal"', help: "0,01 bis 100,00 mit höchstens zwei Nachkommastellen." })}
        ${rowField("category_id", "Kategorie (optional)", { options: this._ruleReferenceOptions(this._catalogs.categories, row.category_id, "Keine Kategorie") })}
        ${rowField("area_id", "Bereich (optional)", { options: this._ruleReferenceOptions(this._catalogs.areas, row.area_id, "Kein Bereich") })}
        ${rowField("project_id", "Projekt (optional)", { options: this._ruleReferenceOptions(this._catalogs.projects, row.project_id, "Kein Projekt") })}
        ${rowField("pet_id", "Tier (optional)", { options: this._ruleReferenceOptions(this._pets, row.pet_id, "Kein Tier") })}
      </div><div class="rule-actions"><button class="table-edit-button" type="button" data-rule-remove="${index}" aria-label="Aufteilung ${index + 1} entfernen"${disabled}>Entfernen</button></div></fieldset>`;
    }).join("");
    return `<section class="management-editor" aria-labelledby="rule-editor-heading"><div class="management-editor-header"><div><h3 id="rule-editor-heading">${this._ruleEditingId === "new" ? "Regel anlegen" : "Regel bearbeiten"}</h3><p>Vorschläge gelten für offene Buchungen. Bestätigte Aufteilungen bleiben erhalten.</p></div><button class="management-editor-back" type="button" data-close-rule-editor${disabled}>${icon("chevronLeft", 16)} Zur Regelübersicht</button></div>
      <form class="rule-form" data-rule-form method="post" novalidate aria-labelledby="rule-editor-heading" aria-busy="${this._ruleSubmitting}">
        <fieldset class="rule-fieldset"${disabled}><legend>Regel</legend><div class="rule-fields">
          ${field("label", "Regelname", { constraints: 'required maxlength="120"' })}
          ${this._ruleEditingId !== "new" ? field("active", "Status", { options: `<option value="true"${draft.active ? " selected" : ""}>Aktiv</option><option value="false"${draft.active ? "" : " selected"}>Deaktiviert</option>` }) : ""}
        </div></fieldset>
        <fieldset class="rule-fieldset" aria-describedby="rule-conditions-error"${disabled}><legend>Bedingungen</legend><p class="rule-help">Der Zahlungsempfänger ist optional. Lege mindestens ein Konto oder einen Verwendungszweckfilter fest, wenn kein Zahlungsempfänger bekannt ist.</p><div class="rule-fields">
          ${field("account_id", "Konto", { options: this._ruleReferenceOptions(this._accounts, draft.account_id, "Alle Konten"), help: "Ein Konto begrenzt die Regel auf diese Zahlungsquelle." })}
          ${field("counterparty", "Zahlungsempfänger (optional)", { constraints: 'maxlength="160"', help: "Wird der Zahlungsempfänger weggelassen, matcht die Regel über die übrigen Bedingungen." })}
          ${field("purpose_contains", "Verwendungszweck enthält (optional)", { constraints: 'maxlength="160"', help: "Leer lassen, wenn die Regel für jeden Verwendungszweck gelten soll." })}
          ${field("direction", "Richtung (optional)", { options: '<option value="">Alle Richtungen</option><option value="income">Einnahme</option><option value="expense">Ausgabe</option>' })}
          ${field("counterparty_account", "Gegenparteikonto (maskiert, optional)", { constraints: 'maxlength="80"', help: "Nur die maskierte Kontoreferenz wird angezeigt." })}
          ${field("amount_min", "Mindestbetrag (optional)", { type: "number", constraints: 'min="0" step="0.01" inputmode="decimal"' })}
          ${field("amount_max", "Höchstbetrag (optional)", { type: "number", constraints: 'min="0" step="0.01" inputmode="decimal"' })}
          ${field("priority", "Priorität", { type: "number", constraints: 'required min="0" max="1000" step="1"', help: "0 bis 1000; eine höhere Zahl hat Vorrang. Gleiche Priorität kann einen Regelkonflikt ergeben." })}
        </div><p class="rule-error" data-rule-conditions-error id="rule-conditions-error" aria-live="polite"></p></fieldset>
        <fieldset class="rule-fieldset" aria-describedby="rule-share-summary rule-allocations-error"${disabled}><legend>Aufteilungsvorlage</legend>
          <p class="rule-help">Jedes Ziel einmal wählen. Alle Anteile müssen zusammen 100 % ergeben. Es stehen aktive Stammdaten und Tiere zur Auswahl.</p>
          ${allocations}
          <p id="rule-share-summary" data-rule-share-summary aria-live="polite"></p><p class="rule-error" id="rule-allocations-error" aria-live="polite"></p>
          <button class="table-edit-button" type="button" data-rule-add${disabled}>Aufteilung hinzufügen</button>
        </fieldset>
        <div class="rule-actions"><p data-rule-save-state aria-live="polite"></p><button class="account-save" type="submit"${this._ruleSubmitting || !this._ruleHasChanges() ? " disabled" : ""}>${this._ruleSubmitting ? "Wird gespeichert …" : "Regel speichern"} ${icon("check", 17)}</button></div>
      </form></section>`;
  }

  _ruleTargetLabel(target) {
    return this._targetLabel(target, " (Person fehlt)");
  }

  _ruleAllocationLabel(row, percentage = false) {
    const labels = [this._ruleTargetLabel(row.target), percentage ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(Number(row.share_percent))} %` : formatEuro(row.amount)];
    for (const [key, entries, snapshot] of [
      ["category_id", this._catalogs.categories, row.category], ["area_id", this._catalogs.areas, row.area],
      ["project_id", this._catalogs.projects, row.project], ["pet_id", this._pets, row.pet_name],
    ]) {
      if (!row[key] && !snapshot) continue;
      const entry = (entries || []).find((candidate) => candidate.id === row[key]);
      labels.push(entry ? `${entry.label || entry.name}${entry.active === false ? " (archiviert)" : ""}` : `${snapshot || row[key]}${row[key] ? " (fehlt)" : ""}`);
    }
    return labels.join(" · ");
  }

  _rulesOverviewTemplate() {
    const disabled = this._ruleSubmitting ? " disabled" : "";
    const accountLabelForRule = (rule) => {
      const account = this._accounts.find((entry) => entry.id === rule.account_id);
      return !rule.account_id ? "Alle Konten" : account ? `${account.label || account.iban_masked || account.id}${account.active === false ? " (archiviert)" : ""}` : `${rule.account_id} (Konto fehlt)`;
    };
    const compareLabels = (left, right) => String(left || "").localeCompare(String(right || ""), "de-DE", { sensitivity: "base" });
    const compareRules = (left, right) => {
      const priorityDifference = Number(right.priority ?? 0) - Number(left.priority ?? 0);
      return priorityDifference || compareLabels(left.label, right.label) || compareLabels(left.id, right.id);
    };
    const groups = new Map();
    this._rules.forEach((rule) => {
      const key = rule.account_id || "";
      if (!groups.has(key)) groups.set(key, { key, label: accountLabelForRule(rule), rules: [] });
      groups.get(key).rules.push(rule);
    });
    const groupsMarkup = [...groups.values()]
      .sort((left, right) => compareLabels(left.label, right.label) || compareLabels(left.key, right.key))
      .map((group) => {
        const rows = [...group.rules].sort(compareRules).map((rule) => {
          const invalid = Object.keys(this._ruleValidationErrors(this._ruleDraftFromRule(rule))).length > 0;
          return `<tr><th scope="row">${escapeHtml(rule.label)}</th><td>${rule.active === false ? "Deaktiviert" : "Aktiv"}${invalid ? " · Angaben prüfen" : ""}</td><td class="table-number">${escapeHtml(rule.priority)}</td><td>${escapeHtml(rule.counterparty)}${rule.purpose_contains ? `<p>Verwendungszweck enthält: ${escapeHtml(rule.purpose_contains)}</p>` : ""}</td><td><ul>${(rule.allocations || []).map((row) => `<li>${escapeHtml(this._ruleAllocationLabel(row, true))}</li>`).join("")}</ul></td><td class="table-actions"><button class="table-edit-button" type="button" data-open-rule-editor="${escapeHtml(rule.id)}" aria-label="Regel ${escapeHtml(rule.label)} bearbeiten"${disabled}>Bearbeiten</button> <button class="table-edit-button" type="button" data-deactivate-rule="${escapeHtml(rule.id)}" aria-label="Regel ${escapeHtml(rule.label)} deaktivieren"${this._ruleSubmitting || rule.active === false ? " disabled" : ""}>Deaktivieren</button></td></tr>`;
        }).join("");
        return `<tbody><tr class="rule-account-group"><th scope="rowgroup" colspan="6">${escapeHtml(group.label)}</th></tr>${rows}</tbody>`;
      }).join("");
    const body = groupsMarkup || `<tbody><tr><td colspan="6">Noch keine Regeln angelegt. Mit „Regel anlegen“ legst du Bedingungen und eine Aufteilungsvorlage für künftige Vorschläge fest.</td></tr></tbody>`;
    return `<div class="management-list-toolbar"><p>${this._rules.filter((rule) => rule.active !== false).length} aktive Regeln · Deaktivierte Regeln bleiben erhalten.</p><button class="table-new-button" type="button" data-open-rule-editor="new"${disabled}>Regel anlegen ${icon("plus", 17)}</button></div>
      <div class="management-table-wrap" tabindex="0" role="region" aria-label="Regelübersicht, horizontal scrollbar"><table class="management-table"><caption class="visually-hidden">Regeln für Buchungsvorschläge</caption><thead><tr><th scope="col">Regelname</th><th scope="col">Status</th><th scope="col">Priorität</th><th scope="col">Zahlungsempfänger</th><th scope="col">Aufteilung</th><th scope="col">Aktionen</th></tr></thead>${body}</table></div>`;
  }

  _openResolvedAllocationEditor(bookingId) {
    const id = String(bookingId);
    const booking = this._resolvedBookings.find((item) => String(item.id) === id);
    if (!booking) return;
    this._resolvedEditingBookings.add(id);
    const rows = (booking.allocations || []).map((row) => ({ ...row, amount_input: Number(row.amount).toFixed(2) }));
    this._allocationDrafts.set(id, rows);
    this._allocationOriginalDrafts.set(id, rows.map((row) => ({ ...row })));
    this._render();
    this._allocationForm(id)?.querySelector('[data-allocation-index="0"][data-allocation-field="target"]')?.focus();
  }

  _rulesTemplate() {
    const body = this._rulesLoading ? `<p class="empty-state" role="status">Regeln und Zuordnungsziele werden geladen …</p>`
      : this._rulesLoadFailed ? `<div class="empty-state"><p>Die Regelübersicht ist derzeit nicht verfügbar.</p><button class="table-edit-button" type="button" data-action="rules">Erneut laden</button></div>`
        : this._ruleEditingId ? this._ruleFormTemplate() : this._rulesOverviewTemplate();
    return this._shellTemplate(`<main class="main" id="content" tabindex="-1"><div class="accounts-view rules-view"><div class="accounts-view-header"><div><h2>Regeln</h2><p>Verwalte Vorschläge für Buchungsaufteilungen. Du bestätigst jede Aufteilung in der Prüfliste.</p></div><div class="accounts-actions"><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button><button class="review-action" type="button" data-action="review">Buchungen prüfen ${icon("arrowRight", 18)}</button></div></div>${body}</div></main>`);
  }

  _bookingRuleHintTemplate(booking, index) {
    if (booking.status === "resolved") return "";
    const status = ruleStatusLabel(booking.status);
    const heading = `booking-rule-${index}`;
    if (booking.status === "suggested" && booking.suggestion) {
      const suggestion = booking.suggestion;
      return `<section class="booking-rule-hint" aria-labelledby="${heading}"><h3 id="${heading}">${escapeHtml(status)}: ${escapeHtml(suggestion.rule_label || suggestion.rule_id)}</h3><p>${escapeHtml(suggestion.reason || "Passende Regel gefunden.")}</p><ul>${(suggestion.allocations || []).map((row) => `<li>${escapeHtml(this._ruleAllocationLabel(row))}</li>`).join("")}</ul><p>Die Übernahme füllt nur den Entwurf. Erst „Aufteilung speichern“ bestätigt die Buchung.</p><button class="table-edit-button" type="button" data-accept-suggestion="${escapeHtml(booking.id)}"${this._allocationSubmissions.has(String(booking.id)) || !suggestion.allocations?.length ? " disabled" : ""}>Vorschlag übernehmen</button></section>`;
    }
    if (booking.status === "conflict") {
      const rules = conflictRuleIds(booking).map((id) => this._rules.find((rule) => rule.id === id)?.label || `Regel ${id}`);
      return `<section class="booking-rule-hint booking-rule-hint--conflict" aria-labelledby="${heading}"><h3 id="${heading}">${escapeHtml(status)}</h3><p>Mehrere Regeln mit gleicher Priorität passen. Prüfe die Regeln oder teile diese Buchung manuell auf.</p><ul>${rules.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}</ul><button class="table-edit-button" type="button" data-action="rules">Regeln verwalten</button></section>`;
    }
    return `<section class="booking-rule-hint" aria-labelledby="${heading}"><h3 id="${heading}">${escapeHtml(status)}</h3><p>${escapeHtml(booking.reason || "Bitte die Aufteilung manuell prüfen.")}</p><button class="table-edit-button" type="button" data-action="rules">Regeln verwalten</button></section>`;
  }

  _confirmedBookingsTemplate() {
    if (!this._confirmedBookings.size) return "";
    return `<section aria-labelledby="confirmed-bookings-heading"><h3 id="confirmed-bookings-heading">Aufteilung gespeichert</h3><p>Du kannst aus einer bestätigten Aufteilung eine Regel vorbereiten.</p><ul class="confirmed-bookings">${[...this._confirmedBookings.values()].map((booking) => `<li><span>${escapeHtml(booking.counterparty || booking.purpose || "Buchung")} · ${formatEuro(booking.amount)}</span><button class="table-edit-button" type="button" data-rule-from-booking="${escapeHtml(booking.id)}" aria-label="${escapeHtml(booking.counterparty || "Buchung")} als Regel speichern">Als Regel speichern</button></li>`).join("")}</ul></section>`;
  }

  _allocationTargetOptions(selectedTarget) {
    return [
      `<option value=""${selectedTarget ? "" : " selected"}>Ziel auswählen</option>`,
      `<option value="household"${selectedTarget === "household" ? " selected" : ""}>Haushalt</option>`,
      ...(selectedTarget && selectedTarget !== "household" && !this._persons.some((person) => person.entity_id === selectedTarget)
        ? [`<option value="${escapeHtml(selectedTarget)}" selected disabled>${escapeHtml(selectedTarget)} (Person fehlt) – bitte ersetzen</option>`] : []),
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
    return `<fieldset class="allocation-editor" aria-describedby="${summaryId} ${statusId}"${this._allocationSubmissions.has(bookingId) ? " disabled" : ""}>
      <legend>Aufteilung</legend>
      <ul class="allocation-list" aria-label="Aufteilungszeilen">${rowMarkup}</ul>
      <p class="allocation-summary" id="${summaryId}" aria-live="polite"><span>Gesamt <strong>${formatEuro(total)}</strong></span><span>Zugeordnet <strong data-allocation-allocated>${allocated === null ? "—" : formatEuro(allocated)}</strong></span><span>Verbleibend <strong data-allocation-remaining class="${submitState.invalidAmount || remaining !== 0 ? "allocation-summary--open" : ""}">${submitState.invalidAmount ? "—" : formatEuro(remaining)}</strong></span></p>
      <div class="allocation-actions"><p class="allocation-status" id="${statusId}" data-allocation-status aria-live="polite">${escapeHtml(this._allocationErrors.get(bookingId) || "")}</p><button class="allocation-add" type="button" data-allocation-add aria-label="Zeile für ${escapeHtml(purpose)} hinzufügen">Zeile hinzufügen</button><button class="assign-button" type="submit" aria-label="Aufteilung für ${escapeHtml(purpose)} speichern"${submitState.disabled ? " disabled" : ""}>Aufteilung speichern ${icon("check", 17)}</button></div>
    </fieldset>`;
  }

  _bookingSelectionToolbar(view, bookings, listId) {
    const state = bookingSelectionState(bookings, this._bookingSelectionForView(view));
    const label = view === "resolved" ? "übernommene Buchungen" : "ungeklärte Buchungen";
    return `<div class="booking-selection-toolbar" data-booking-selection-toolbar data-booking-view="${view}">
      <label class="booking-selection-all" for="${view}-select-all"><input id="${view}-select-all" name="select_all_${view}_bookings" type="checkbox" data-booking-select-all data-booking-view="${view}" aria-controls="${listId}"${state.allSelected ? " checked" : ""}><span>Alle auswählen</span></label>
      <p class="booking-selection-summary" data-booking-selection-summary data-booking-view="${view}" aria-live="polite">${state.selectedCount} von ${bookings.length} ausgewählt</p>
      <button class="bulk-export-button" type="button" data-export-bookings data-booking-view="${view}"${state.selectedCount ? "" : " disabled"}>Originaldaten exportieren</button>
      <button class="bulk-delete-button" type="button" data-delete-bookings data-booking-view="${view}"${state.selectedCount ? "" : " disabled"}>Auswahl löschen</button>
      <span class="visually-hidden">in ${label}</span>
    </div>`;
  }

  _bookingHistoryFilterTemplate(view) {
    const status = view === "resolved" ? "resolved" : "unresolved";
    const accounts = Array.isArray(this._accounts) ? this._accounts : [];
    return `<form class="booking-history-filters" data-booking-history-filter aria-label="Buchungshistorie filtern"><div class="booking-history-filter-grid"><label class="booking-history-filter-field booking-history-filter-field--search" for="booking-filter-q-${view}"><span>Suche</span><input id="booking-filter-q-${view}" data-booking-filter="q" type="search" value="${escapeHtml(this._bookingHistoryFilters.q)}" placeholder="Gegenpartei, Verwendungszweck …"></label><label class="booking-history-filter-field" for="booking-filter-from-${view}"><span>Von</span><input id="booking-filter-from-${view}" data-booking-filter="from" type="date" value="${escapeHtml(this._bookingHistoryFilters.from)}"></label><label class="booking-history-filter-field" for="booking-filter-to-${view}"><span>Bis</span><input id="booking-filter-to-${view}" data-booking-filter="to" type="date" value="${escapeHtml(this._bookingHistoryFilters.to)}"></label><label class="booking-history-filter-field" for="booking-filter-status-${view}"><span>Status</span><select id="booking-filter-status-${view}" data-booking-filter="status"><option value="unresolved"${status === "unresolved" ? " selected" : ""}>Ungeklärt</option><option value="resolved"${status === "resolved" ? " selected" : ""}>Übernommen</option></select></label><label class="booking-history-filter-field" for="booking-filter-account-${view}"><span>Konto</span><select id="booking-filter-account-${view}" data-booking-filter="account_id"><option value="">Alle Konten</option>${accounts.map((account) => `<option value="${escapeHtml(account.id)}"${this._bookingHistoryFilters.account_id === account.id ? " selected" : ""}>${escapeHtml(account.label || account.id)}</option>`).join("")}</select></label><label class="booking-history-filter-field" for="booking-filter-category-${view}"><span>Kategorie</span><select id="booking-filter-category-${view}" data-booking-filter="category_id">${this._catalogOptions("categories", this._bookingHistoryFilters.category_id, "Alle Kategorien")}</select></label></div><div class="booking-history-filter-actions"><button class="table-edit-button" type="button" data-booking-filter-reset>Zurücksetzen</button><button class="table-new-button" type="submit">Filter anwenden</button></div></form>`;
  }

  _bookingResultCountTemplate(view) {
    const loading = view === "resolved" ? this._resolvedLoading : this._reviewLoading;
    const failed = view === "resolved" ? this._resolvedLoadFailed : this._reviewLoadFailed;
    if (loading || failed) return "";
    const total = view === "resolved" ? this._resolvedTotal : this._bookingTotal;
    const pageSize = this._bookingHistoryPageSize[view];
    const page = this._bookingHistoryPage[view];
    if (!total) return `<p class="booking-result-count" role="status">Keine Buchungen gefunden</p>`;
    const first = pageSize === 0 ? 1 : page * pageSize + 1;
    const last = pageSize === 0 ? total : Math.min(total, (page + 1) * pageSize);
    return `<p class="booking-result-count" role="status">${first}–${last} von ${total} Buchungen</p>`;
  }

  _bookingPaginationTemplate(view) {
    const loading = view === "resolved" ? this._resolvedLoading : this._reviewLoading;
    const failed = view === "resolved" ? this._resolvedLoadFailed : this._reviewLoadFailed;
    if (loading || failed) return "";
    const total = view === "resolved" ? this._resolvedTotal : this._bookingTotal;
    const page = this._bookingHistoryPage[view];
    const pageSize = this._bookingHistoryPageSize[view];
    const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const allSelected = pageSize === 0 ? " selected" : "";
    return `<nav class="booking-pagination" aria-label="Buchungsseiten"><button class="table-edit-button" type="button" data-booking-page="previous" data-booking-view="${view}" aria-label="Vorherige Seite"${page === 0 || pageSize === 0 ? " disabled" : ""}>Zurück</button><span class="booking-pagination-status" aria-live="polite">Seite ${page + 1} von ${pageCount}</span><button class="table-edit-button" type="button" data-booking-page="next" data-booking-view="${view}" aria-label="Nächste Seite"${pageSize === 0 || page >= pageCount - 1 ? " disabled" : ""}>Weiter</button><label class="booking-page-size" for="booking-page-size-${view}"><span>Seitengröße</span><select id="booking-page-size-${view}" data-booking-page-size data-booking-view="${view}" aria-label="Seitengröße"><option value="25"${pageSize === 25 ? " selected" : ""}>25</option><option value="50"${pageSize === 50 ? " selected" : ""}>50</option><option value="100"${pageSize === 100 ? " selected" : ""}>100</option><option value="0"${allSelected}>Alle</option></select></label><span class="booking-pagination-total">${total} gesamt</span></nav>`;
  }

  _resolvedBookingsTemplate() {
    const groupsMarkup = bookingGroups(this._resolvedBookings, this._accounts).map((group) => {
      const rows = group.bookings.map((booking) => {
      const bookingId = String(booking.id);
      const selectionId = `resolved-booking-select-${bookingId}`;
      const selected = this._selectedResolvedBookings.has(bookingId);
      const sender = String(booking.sender || "").trim();
      const counterparty = String(booking.counterparty || "").trim();
      const purpose = String(booking.purpose || "").trim();
      const senderAccountMarkup = this._bookingAccountInlineTemplate(booking.booking_accounts, "sender");
      const recipientAccountMarkup = this._bookingAccountInlineTemplate(booking.booking_accounts, "recipient");
      const matchedRule = booking.matched_rule;
      const source = resolvedBookingSourceLabel(booking);
      const sourceClass = matchedRule ? "" : " resolved-rule-source--manual";
      const allocations = Array.isArray(booking.allocations) && booking.allocations.length
        ? `<ul>${booking.allocations.map((row) => `<li>${escapeHtml(this._ruleAllocationLabel(row))}${row.target_status === "missing" ? `<span class="booking-detail-empty">Person fehlt</span><div class="target-repair-form" data-target-repair-form><label for="repair-${escapeHtml(bookingId)}-${escapeHtml(row.target)}">Ersatzziel<select id="repair-${escapeHtml(bookingId)}-${escapeHtml(row.target)}" data-repair-to required>${this._personOptions()}</select></label><button class="table-edit-button" type="button" data-repair-target data-repair-booking="${escapeHtml(bookingId)}" data-repair-from="${escapeHtml(row.target)}"${this._repairSubmitting.has(bookingId) ? " disabled" : ""}>${this._repairSubmitting.has(bookingId) ? "Wird repariert …" : "Personenziel reparieren"}</button>${this._repairErrors.get(bookingId) ? `<p class="booking-detail-error" role="alert">${escapeHtml(this._repairErrors.get(bookingId))}</p>` : ""}</div>` : ""}</li>`).join("")}</ul>`
        : "Keine Aufteilung gespeichert";
      const resolvedEditor = this._resolvedEditingBookings.has(bookingId)
        ? `<form data-assignment-form data-booking-id="${escapeHtml(bookingId)}" data-booking-total="${Math.abs(Number(booking.amount) || 0)}">${this._allocationEditorTemplate(booking, `resolved-${bookingId}`)}<button type="button" class="table-edit-button" data-cancel-resolved-edit="${escapeHtml(bookingId)}">Abbrechen</button></form>`
        : "";
      return `<tr>
        <td class="selection-cell"><label class="booking-selection" for="${escapeHtml(selectionId)}"><input id="${escapeHtml(selectionId)}" name="selected_bookings" value="${escapeHtml(bookingId)}" type="checkbox" data-booking-select data-booking-view="resolved" data-booking-id="${escapeHtml(bookingId)}"${selected ? " checked" : ""}><span class="visually-hidden">${escapeHtml(counterparty || "Buchung")} auswählen</span></label></td>
        <th scope="row"><span class="resolved-booking-sender">Absender: ${escapeHtml(sender || "Nicht vorhanden")}${senderAccountMarkup}</span><span class="resolved-booking-counterparty">Zahlungsempfänger: ${escapeHtml(counterparty || "Nicht vorhanden")}${recipientAccountMarkup}</span><span class="resolved-booking-date">${escapeHtml(formatDate(booking.booking_date))}</span></th>
        <td><span class="resolved-booking-purpose">${escapeHtml(purpose || "Kein Verwendungszweck")}</span></td>
        <td class="table-number">${formatEuro(booking.amount)}</td>
        <td>${allocations}${resolvedEditor}</td>
        <td><span class="resolved-rule-source${sourceClass}">${escapeHtml(source)}</span>${matchedRule?.reason ? `<span class="resolved-rule-reason">${escapeHtml(matchedRule.reason)}</span>` : ""}</td>
        <td class="table-actions"><button class="table-edit-button" type="button" data-booking-details="${escapeHtml(bookingId)}" aria-label="Details für ${escapeHtml(counterparty || "Buchung")} anzeigen">Details</button><button class="table-edit-button" type="button" data-edit-resolved-booking="${escapeHtml(bookingId)}">Bearbeiten</button><button class="table-edit-button" type="button" data-unresolve-booking="${escapeHtml(bookingId)}"${this._unresolvingBookings.has(bookingId) ? " disabled" : ""}>${this._unresolvingBookings.has(bookingId) ? "Wird geändert …" : "Zuordnung rückgängig"}</button></td>
      </tr>`;
      }).join("");
      return `<tbody><tr class="booking-account-group-row"><th scope="rowgroup" colspan="7">${escapeHtml(group.label)}</th></tr>${rows}</tbody>`;
    }).join("");
    const body = this._resolvedLoading
        ? `<p class="empty-state" role="status">Übernommene Buchungen werden geladen …</p>`
      : this._resolvedLoadFailed
        ? `<div class="empty-state"><p>Die übernommenen Buchungen konnten nicht geladen werden.</p><button class="table-edit-button" type="button" data-action="resolved">Erneut laden</button></div>`
        : this._resolvedBookings.length
          ? `${this._bookingSelectionToolbar("resolved", this._resolvedBookings, "resolved-bookings")}<div class="resolved-table-wrap" tabindex="0" role="region" aria-label="Übernommene Buchungen, horizontal scrollbar"><table id="resolved-bookings" class="resolved-table"><caption class="visually-hidden">Übernommene Buchungen</caption><thead><tr><th scope="col" class="selection-column"><span class="visually-hidden">Auswahl</span></th><th scope="col">Buchung</th><th scope="col">Verwendungszweck</th><th scope="col">Betrag</th><th scope="col">Aufteilung</th><th scope="col">Zuordnungsquelle</th><th scope="col">Aktion</th></tr></thead>${groupsMarkup}</table></div>`
          : `<div class="empty-state resolved-empty">Noch keine Buchungen übernommen. Bestätigte manuelle Aufteilungen und automatische Regelübernahmen erscheinen hier.</div>`;
    const filterStrip = this._bookingHistoryFilterTemplate("resolved");
    const content = `<main class="main" id="content" tabindex="-1"><div class="resolved-view"><div class="resolved-view-header"><div><h2>Übernommene Buchungen</h2><p>Alle bestätigten Buchungen an einem Ort. Regelübernahmen zeigen die verwendete Regel und ihren Treffergrund; manuelle Zuordnungen bleiben als solche gekennzeichnet.</p></div><div class="accounts-actions"><button class="table-edit-button" type="button" data-action="review">Buchungen prüfen ${icon("arrowRight", 18)}</button><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div></div>${filterStrip}${this._bookingResultCountTemplate("resolved")}${body}${this._bookingPaginationTemplate("resolved")}</div></main>`;
    return this._shellTemplate(content);
  }

  _reviewTemplate() {
    const filterStrip = this._bookingHistoryFilterTemplate("review");
    const importHistory = `<section class="import-history" aria-labelledby="import-history-heading"><h3 id="import-history-heading">Importhistorie</h3>${this._imports.length ? `<div class="management-table-wrap" tabindex="0" role="region" aria-label="Importhistorie, horizontal scrollbar"><table class="management-table"><caption class="visually-hidden">Importhistorie ohne Quelldateien</caption><thead><tr><th scope="col">Datei</th><th scope="col">Format</th><th scope="col">Zeitpunkt</th><th scope="col">Buchungen</th><th scope="col">Duplikate</th></tr></thead><tbody>${this._imports.map((item) => `<tr><th scope="row">${escapeHtml(item.filename || "Import")}</th><td>${escapeHtml(item.format || "—")}</td><td>${escapeHtml(item.imported_at || "—")}</td><td class="table-number">${escapeHtml(item.accepted_count ?? 0)}</td><td class="table-number">${escapeHtml(item.duplicate_count ?? 0)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty-state">Noch keine Importläufe vorhanden.</p>`}</section>`;
    const bookingCount = this._bookingResultCountTemplate("review");
    let bookingIndex = 0;
    const bookingGroupsMarkup = bookingGroups(this._bookings, this._accounts).map((group, groupIndex) => {
      const headingId = `review-account-group-${groupIndex}`;
      const rows = group.bookings.map((booking) => {
        const index = bookingIndex++;
        const total = Math.abs(Number(booking.amount) || 0);
        const bookingId = String(booking.id);
        const selectionId = `review-booking-select-${bookingId}`;
        const selected = this._selectedReviewBookings.has(bookingId);
        const sender = String(booking.sender || "").trim();
        const counterparty = String(booking.counterparty || "").trim();
        const purpose = String(booking.purpose || "").trim();
        const accountLabel = String(booking.account_label || "").trim();
        const accountReference = String(booking.account_reference || booking.account || "").trim();
        const senderMarkup = `<span class="booking-sender">Absender: ${escapeHtml(sender || "Nicht vorhanden")}${this._bookingAccountInlineTemplate(booking.booking_accounts, "sender")}</span>`;
        const counterpartyMarkup = counterparty
          ? `Zahlungsempfänger: ${escapeHtml(counterparty)}${this._bookingAccountInlineTemplate(booking.booking_accounts, "recipient")}`
          : "Zahlungsempfänger nicht erkannt";
        const purposeMarkup = purpose ? `<span class="booking-purpose-detail">Verwendungszweck: ${escapeHtml(purpose)}</span>` : "";
        const accountMarkup = accountLabel
          ? `<strong>Erkanntes Konto: ${escapeHtml(accountLabel)}</strong>${accountReference ? `<span class="booking-account-reference">Kontoreferenz: ${escapeHtml(accountReference)}</span>` : ""}`
          : `<strong>Erkanntes Konto: ${escapeHtml(accountReference || "nicht zugeordnet")}</strong>`;
        return `<li><form class="booking-row${selected ? " booking-row--selected" : ""}" data-assignment-form data-booking-id="${escapeHtml(booking.id)}" data-booking-total="${total}"><label class="booking-selection" for="${escapeHtml(selectionId)}"><input id="${escapeHtml(selectionId)}" name="selected_bookings" value="${escapeHtml(bookingId)}" type="checkbox" data-booking-select data-booking-view="review" data-booking-id="${escapeHtml(bookingId)}"${selected ? " checked" : ""}><span class="visually-hidden">${escapeHtml(counterparty || "Buchung")} auswählen</span></label><time class="booking-date" datetime="${escapeHtml(booking.booking_date)}">${formatDate(booking.booking_date)}</time><span class="booking-purpose">${senderMarkup}<span class="booking-counterparty">${counterpartyMarkup}</span>${purposeMarkup}</span><span class="booking-account">${accountMarkup}</span><span class="booking-amount">${formatEuro(booking.amount)}</span><button class="table-edit-button" type="button" data-booking-details="${escapeHtml(bookingId)}" aria-label="Details für ${escapeHtml(counterparty || "Buchung")} anzeigen">Details</button>${this._bookingRuleHintTemplate(booking, index)}${this._allocationEditorTemplate(booking, index)}</form></li>`;
      }).join("");
      return `<section class="booking-account-group" aria-labelledby="${headingId}"><h3 class="booking-account-group-heading" id="${headingId}">${escapeHtml(group.label)}</h3><ul class="booking-list booking-account-group-list" aria-label="${escapeHtml(group.label)}">${rows}</ul></section>`;
    }).join("");
    const bookingList = this._reviewLoading ? `<p class="empty-state" role="status">Buchungen werden geladen …</p>`
      : this._reviewLoadFailed ? `<div class="empty-state"><p>Die Prüfliste konnte nicht geladen werden.</p><button class="table-edit-button" type="button" data-action="review">Erneut laden</button></div>`
        : this._bookings.length ? `${this._bookingSelectionToolbar("review", this._bookings, "review-bookings")}<div id="review-bookings" class="booking-account-groups" aria-label="Ungeklärte Buchungen">${bookingGroupsMarkup}</div>` : `<div class="empty-state">Keine offenen Buchungen in der Prüfliste. Weitere Buchungen kannst du aus einer Bankdatei importieren.</div>`;
    const content = `<main class="main" id="content" tabindex="-1"><div class="review-view"><div class="review-view-header"><div><h2>Buchungshistorie</h2><p>Historische und ungeklärte Buchungen filtern, prüfen und nachvollziehbar zuordnen.</p></div><div class="accounts-actions"><button class="table-new-button" type="button" data-action="apply-rules"${this._ruleApplying ? " disabled" : ""}>${this._ruleApplying ? "Regeln werden angewendet …" : "Regeln erneut anwenden"}</button><button class="table-edit-button" type="button" data-action="resolved">Übernommene Buchungen ${icon("arrowRight", 18)}</button><button class="table-edit-button" type="button" data-action="rules">Regeln verwalten</button><button class="back-button" type="button" data-action="back">${icon("chevronLeft", 18)} Zur Übersicht</button></div></div>${filterStrip}${bookingCount}${this._rulesLoadFailed ? `<p role="status">Regeln konnten nicht geladen werden. Die manuelle Aufteilung ist weiterhin möglich. Über „Regeln verwalten“ kannst du erneut laden.</p>` : ""}${this._confirmedBookingsTemplate()}<form class="import-strip"><div><h3>Bank- oder Exceldatei importieren</h3><p>MT940 oder CAMT.053 einzeln oder als ZIP mit mehreren Buchungsdateien · .xlsx für Planposten, jeweils lokal geprüft.</p></div><label class="file-input">Datei auswählen<input data-import type="file" accept=".xlsx,.zip,.sta,.mt940,.txt,.xml,.camt,.camt053,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/xml,text/plain"></label></form>${this._excelPreview ? this._excelPreviewTemplate() : ""}${bookingList}${this._bookingPaginationTemplate("review")}${importHistory}</div></main>`;
    return this._shellTemplate(content);
  }
}

customElements.define("finanzplaner-panel", FinanzplanerPanel);
