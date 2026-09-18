import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const panelSource = await readFile(new URL("./panel.js", import.meta.url), "utf8");

let utils;
try {
  utils = await import("./panel-utils.mjs");
} catch (error) {
  assert.fail(`Panel utility module is required: ${error.message}`);
}

test("reads API responses according to their content type", async () => {
  const jsonResponse = new Response(JSON.stringify({ accepted: 2 }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  const textResponse = new Response("  Dienst nicht erreichbar\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

  assert.deepEqual(await utils.readApiResponse(jsonResponse), { accepted: 2 });
  assert.equal(await utils.readApiResponse(textResponse), "  Dienst nicht erreichbar\n");
});

test("bookingDetailsRequestUrl encodes the booking id", () => {
  assert.equal(
    utils.bookingDetailsRequestUrl("/api/finanzplaner/bookings", "booking/42"),
    "/api/finanzplaner/bookings/booking%2F42/details",
  );
});

test("groups booking rows by configured account label", () => {
  const groups = utils.bookingGroups([
    { id: "booking-2", account_id: "account-savings" },
    { id: "booking-1", account_id: "account-main" },
    { id: "booking-3", account_id: "account-savings" },
  ], [
    { id: "account-main", label: "Girokonto" },
    { id: "account-savings", label: "Tagesgeldkonto" },
  ]);

  assert.deepEqual(groups.map(({ label, bookings }) => [label, bookings.map(({ id }) => id)]), [
    ["Girokonto", ["booking-1"]],
    ["Tagesgeldkonto", ["booking-2", "booking-3"]],
  ]);
});

test("bookingDetailRawJson creates readable JSON without HTML interpretation", () => {
  const raw = utils.bookingDetailRawJson({ booking: { purpose: "<Bank> & Zusatz" } });
  assert.match(raw, /\n  "booking":/);
  assert.match(raw, /<Bank> & Zusatz/);
});

test("formats euro amounts with German separators and sign", () => {
  assert.equal(utils.formatEuro(3285.4), "3.285,40 €");
  assert.equal(utils.formatEuro(-278.64), "−278,64 €");
});

test("builds an accessible chart summary from trend values", () => {
  assert.equal(
    utils.trendSummary({
      planned: [0, 4200],
      forecast: [0, 3710],
      actual: [0, 3285.4],
      today_index: 1,
    }),
    "Plan 4.200,00 €, Prognose 3.710,00 €, Ist 3.285,40 €; Heute am Ende des Zeitraums.",
  );
});

test("keeps the monthly trend chart proportional in its responsive card", () => {
  assert.match(panelSource, /\.trend-card\s*\{[^}]*--chart-aspect-ratio:\s*720\s*\/\s*260/s);
  assert.match(panelSource, /\.chart-wrap svg\s*\{[^}]*display:\s*block[^}]*aspect-ratio:\s*var\(--chart-aspect-ratio\)[^}]*block-size:\s*auto/s);
  assert.match(panelSource, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(panelSource, /preserveAspectRatio="none"/);
});

test("keeps the accessible chart summary from spilling into the visible card", () => {
  assert.match(panelSource, /\.visually-hidden\s*\{[^}]*margin:\s*-1px[^}]*clip:\s*rect\(0\s+0\s+0\s+0\)/s);
});

test("supports one-level category parents in the editor and selectors", () => {
  assert.match(panelSource, /parent_id/);
  assert.match(panelSource, /Übergeordnete Kategorie/);
  assert.match(panelSource, /→/);
  assert.doesNotMatch(panelSource, /Unterkategorie ·/);
});

test("returns from a root-hosted panel to the HA base route", () => {
  assert.equal(
    utils.homeAssistantPath("https://ha.example/finanzplaner?view=review#booking"),
    "/",
  );
});

test("preserves an installation base path but removes panel state", () => {
  assert.equal(
    utils.homeAssistantPath("https://ha.example/homeassistant/finanzplaner/?view=review#booking"),
    "/homeassistant/",
  );
});

test("summarizes selected excel suggestions", () => {
  assert.deepEqual(
    utils.selectedSuggestionSummary([
      { selected: true, amount: 12.5 },
      { selected: false, amount: 9 },
      { selected: true, amount: 2.5 },
    ]),
    { count: 2, amount: 15 },
  );
});

test("suggestionDraft returns the server allocation rows", () => {
  const booking = {
    status: "suggested",
    suggestion: {
      rule_id: "rule-1",
      allocations: [{ target: "household", amount: 42.37 }],
    },
  };

  assert.deepEqual(utils.suggestionDraft(booking), [
    { target: "household", amount: 42.37 },
  ]);
});

test("suggestionDraft returns an empty list for unresolved bookings", () => {
  assert.deepEqual(utils.suggestionDraft({ status: "unresolved" }), []);
});

test("suggestionDraft copies server allocation rows", () => {
  const allocation = { target: "household", amount: 42.37 };
  const booking = {
    status: "suggested",
    suggestion: { allocations: [allocation] },
  };

  const draft = utils.suggestionDraft(booking);
  draft[0].amount = 10;

  assert.equal(allocation.amount, 42.37);
});

test("ruleStatusLabel explains conflict status", () => {
  assert.equal(utils.ruleStatusLabel("conflict"), "Regelkonflikt");
  assert.equal(utils.ruleStatusLabel("other"), "Prüfung erforderlich");
});

test("ruleStatusLabel falls back for prototype-key statuses", () => {
  for (const status of ["toString", "__proto__"]) {
    assert.equal(utils.ruleStatusLabel(status), "Prüfung erforderlich");
  }
});

test("labels resolved booking origins with the matching rule or manual assignment", () => {
  assert.equal(
    utils.resolvedBookingSourceLabel({ matched_rule: { rule_label: "Supermarkt" } }),
    "Automatisch über Regel „Supermarkt“",
  );
  assert.equal(utils.resolvedBookingSourceLabel({ matched_rule: { rule_id: "rule-1" }}), "Automatisch über Regel");
  assert.equal(utils.resolvedBookingSourceLabel({}), "Manuell zugeordnet");
});

test("rulePayloadFromForm trims text and keeps null filters", () => {
  assert.deepEqual(utils.rulePayloadFromForm({
    label: "  Supermarkt  ",
    active: true,
    priority: "20",
    account_id: "account-giro",
    counterparty: "  Supermarkt AG ",
    purpose_contains: "  ",
    allocations: [{ target: "household", share_percent: 100 }],
  }), {
    label: "Supermarkt",
    active: true,
    priority: 20,
    account_id: "account-giro",
    counterparty: "Supermarkt AG",
    purpose_contains: null,
    direction: null,
    counterparty_account: null,
    amount_min: null,
    amount_max: null,
    allocations: [{ target: "household", share_percent: 100 }],
  });
});

test("rulePayloadFromForm copies allocation rows", () => {
  const allocation = { target: "household", share_percent: 100 };
  const payload = utils.rulePayloadFromForm({
    label: "Supermarkt",
    active: true,
    priority: 20,
    account_id: null,
    counterparty: "Supermarkt AG",
    purpose_contains: "Einkauf",
    allocations: [allocation],
  });

  payload.allocations[0].share_percent = 50;

  assert.equal(allocation.share_percent, 100);
});

test("conflictRuleIds returns conflict ids and copies the source list", () => {
  const conflicts = ["rule-1", "rule-2"];
  const booking = { status: "conflict", conflicts };

  const ids = utils.conflictRuleIds(booking);
  ids.pop();

  assert.deepEqual(ids, ["rule-1"]);
  assert.deepEqual(conflicts, ["rule-1", "rule-2"]);
  assert.deepEqual(utils.conflictRuleIds({ status: "suggested", conflicts }), []);
});

test("distributes remainder cents one-by-one across the first rows", () => {
  assert.deepEqual(
    utils.equalAllocationDraft(100, ["person.alex", "person.sam", "household"]),
    [
      { target: "person.alex", amount: 33.34, area: null, category: null, project: null },
      { target: "person.sam", amount: 33.33, area: null, category: null, project: null },
      { target: "household", amount: 33.33, area: null, category: null, project: null },
    ],
  );
  assert.deepEqual(
    utils.equalAllocationDraft(-0.05, ["person.alex", "household"]),
    [
      { target: "person.alex", amount: 0.03, area: null, category: null, project: null },
      { target: "household", amount: 0.02, area: null, category: null, project: null },
    ],
  );
  assert.deepEqual(
    utils.equalAllocationDraft(0.05, ["person.alex", "person.sam", "household"]),
    [
      { target: "person.alex", amount: 0.02, area: null, category: null, project: null },
      { target: "person.sam", amount: 0.02, area: null, category: null, project: null },
      { target: "household", amount: 0.01, area: null, category: null, project: null },
    ],
  );
});

test("describes empty, partial, and complete booking selections", () => {
  const bookings = [{ id: "booking-1" }, { id: "booking-2" }, { id: "booking-3" }];

  assert.deepEqual(utils.bookingSelectionState(bookings, []), {
    selectedCount: 0,
    allSelected: false,
    someSelected: false,
  });
  assert.deepEqual(utils.bookingSelectionState(bookings, ["booking-1", "booking-2"]), {
    selectedCount: 2,
    allSelected: false,
    someSelected: true,
  });
  assert.deepEqual(utils.bookingSelectionState(bookings, ["booking-1", "booking-2", "booking-3"]), {
    selectedCount: 3,
    allSelected: true,
    someSelected: false,
  });
});

test("calculates the remaining allocation amount in cents", () => {
  assert.equal(
    utils.allocationRemaining(100, [{ amount: 60 }, { amount: 20 }]),
    20,
  );
  assert.equal(
    utils.allocationRemaining(0.3, [{ amount: 0.1 }, { amount: 0.2 }]),
    0,
  );
  assert.equal(utils.allocationRemaining(-100, [{ amount: 100 }]), 0);
});

test("adds a row, rebalances cents, and preserves manual row metadata", () => {
  assert.deepEqual(
    utils.addAllocationDraftRow(0.05, [
      { target: "person.alex", amount: 0.04, area: "Hunde", category: "Futter", project: "Welpe" },
      { target: "household", amount: 0.01, area: null, category: "Haushalt", project: null },
    ]),
    [
      { target: "person.alex", amount: 0.02, area: "Hunde", category: "Futter", project: "Welpe" },
      { target: "household", amount: 0.02, area: null, category: "Haushalt", project: null },
      { target: "", amount: 0.01, area: null, category: null, project: null },
    ],
  );
});

test("preserves a pet reference while adding an allocation row", () => {
  assert.deepEqual(
    utils.addAllocationDraftRow(42, [
      { target: "household", amount: 42, pet_id: "pet-fio", area: "Haustiere", category: "Futter", project: null },
    ]),
    [
      { target: "household", amount: 21, pet_id: "pet-fio", area: "Haustiere", category: "Futter", project: null },
      { target: "", amount: 21, area: null, category: null, project: null },
    ],
  );
});

test("updates and removes draft rows without mutating the existing draft", () => {
  const rows = [
    { target: "household", amount: 10, area: "Hunde", category: "Futter", project: "Welpe" },
    { target: "person.sam", amount: 5, area: null, category: null, project: null },
  ];

  const edited = utils.updateAllocationDraftRow(rows, 0, "amount", "9,50");
  assert.equal(edited[0].amount, 9.5);
  assert.equal(edited[0].category, "Futter");
  assert.equal(rows[0].amount, 10);
  assert.deepEqual(utils.removeAllocationDraftRow(edited, 1), [edited[0]]);
});

test("reports missing targets, remaining cents, and blocks a valid draft while submitting", () => {
  assert.deepEqual(
    utils.allocationSubmitState(10, [{ target: "", amount: 10 }]),
    { missingTarget: true, invalidAmount: false, remaining: 0, disabled: true },
  );
  assert.deepEqual(
    utils.allocationSubmitState(-10, [{ target: "household", amount: 9.99 }]),
    { missingTarget: false, invalidAmount: false, remaining: 0.01, disabled: true },
  );
  assert.deepEqual(
    utils.allocationSubmitState(10, [{ target: "household", amount: 10 }], true),
    { missingTarget: false, invalidAmount: false, remaining: 0, disabled: true },
  );
  assert.deepEqual(
    utils.allocationSubmitState(10, [{ target: "household", amount: 10 }]),
    { missingTarget: false, invalidAmount: false, remaining: 0, disabled: false },
  );
  assert.equal(
    utils.allocationSubmitState(10, [{ target: "household", amount: 10.004 }]).invalidAmount,
    true,
  );
  assert.equal(
    utils.allocationSubmitState(33.34, [{ target: "household", amount: 33.34 }]).invalidAmount,
    false,
  );
});

test("reads allocation errors from JSON messages and plain text", async () => {
  assert.equal(
    utils.allocationErrorMessage({ status: 400 }, { message: "Centbetrag stimmt nicht" }),
    "Centbetrag stimmt nicht",
  );
  assert.equal(
    utils.allocationErrorMessage({ status: 500 }, "Dienst vorübergehend nicht erreichbar"),
    "Dienst vorübergehend nicht erreichbar",
  );
  assert.equal(
    utils.allocationErrorMessage({ status: 400 }, ""),
    "Die Aufteilung wurde nicht akzeptiert. Bitte prüfe Ziele und Centbeträge.",
  );
});

test("labels an account without owners as not configured", () => {
  assert.equal(utils.accountOwnerStatus([]), "Inhaber noch nicht konfiguriert");
  assert.equal(utils.accountOwnerStatus(["person.alex", "person.sam"]), "2 Kontoinhaber");
});

test("labels the visible account lifecycle state", () => {
  assert.equal(utils.accountActiveStatus(true), "Aktiv");
  assert.equal(utils.accountActiveStatus(false), "Archiviert");
});

test("labels recurring and one-time plan item rhythms", () => {
  assert.equal(utils.planItemFrequencyLabel(1), "monatlich");
  assert.equal(utils.planItemFrequencyLabel(3), "vierteljährlich");
  assert.equal(utils.planItemFrequencyLabel(null), "einmalig");
  assert.equal(utils.planItemStatus(false), "Archiviert");
});

test("exposes the authenticated plan item editor routes and form states", () => {
  assert.match(panelSource, /const PLAN_ITEMS_URL = "\/api\/finanzplaner\/plan-items"/);
  assert.match(panelSource, /this\._openPlanItems\(\)/);
  assert.match(panelSource, /data-plan-item-form/);
  assert.match(panelSource, /data-plan-item-archive/);
  assert.match(panelSource, /method: "DELETE"/);
  assert.match(panelSource, /aria-busy/);
  assert.match(panelSource, /actionButton\("accounts", "Konten öffnen"/);
});

test("exposes authenticated pet profile management and pet-aware assignment fields", () => {
  assert.match(panelSource, /const PETS_URL = "\/api\/finanzplaner\/pets"/);
  assert.match(panelSource, /actionButton\("pets", "Tiere öffnen"/);
  assert.match(panelSource, /data-pet-form/);
  assert.match(panelSource, /data-pet-archive/);
  assert.match(panelSource, /data-plan-item-field="pet_id"/);
  assert.match(panelSource, /data-allocation-field="pet_id"/);
  assert.match(panelSource, /pet_id: row\.pet_id \|\| null/);
});

test("resets pet submission state before rerendering and keeps action icons inline", () => {
  assert.match(panelSource, /this\._petSubmissions\.delete\(petId\);\s*await this\._loadPets\(\);\s*this\._render\(\);/s);
  assert.match(panelSource, /button:has\(> svg\)\s*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*flex-direction:\s*row[^}]*gap:\s*0\.45rem/s);
});

test("lets management views and their headers use the available content width", () => {
  assert.match(panelSource, /\.review-view, \.accounts-view, \.plan-items-view, \.pets-view, \.feed-profiles-view, \.catalogs-view\s*\{[^}]*inline-size:\s*100%/s);
  assert.match(panelSource, /\.catalogs-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)/s);
  assert.match(panelSource, /\.catalogs-view-header\s*\{[^}]*justify-content:\s*space-between/s);
});

test("exposes feed profiles, forecast status, and purchase confirmation", () => {
  assert.match(panelSource, /const FEED_PROFILES_URL = "\/api\/finanzplaner\/feed-profiles"/);
  assert.match(panelSource, /\["feed_profiles", "cart", "Futter"\]/);
  assert.match(panelSource, /data-feed-profile-form/);
  assert.match(panelSource, /data-feed-profile-purchase/);
  assert.match(panelSource, /purchase_date: this\._todayIsoDate\(\)/);
  assert.match(panelSource, /data-feed-profile-field="interval_weeks"/);
  assert.match(panelSource, /data-feed-profile-field="due_soon_days"/);
});

test("exposes first-class catalog management and catalog-backed selectors", () => {
  assert.match(panelSource, /const CATALOGS_URL = "\/api\/finanzplaner\/catalogs"/);
  assert.match(panelSource, /actionButton\("catalogs", "Stammdaten öffnen"/);
  assert.match(panelSource, /data-catalog-form/);
  assert.match(panelSource, /data-catalog-archive/);
  assert.match(panelSource, /_catalogOptions\("categories"/);
  assert.match(panelSource, /_catalogOptions\("areas"/);
  assert.match(panelSource, /_catalogOptions\("projects"/);
});

test("starts every management area with a semantic overview table", () => {
  assert.match(panelSource, /class="management-table"/);
  assert.match(panelSource, /<caption class="visually-hidden">Planpostenübersicht<\/caption>/);
  assert.match(panelSource, /<caption class="visually-hidden">Tierübersicht<\/caption>/);
  assert.match(panelSource, /<caption class="visually-hidden">Futterprofilübersicht<\/caption>/);
  assert.match(panelSource, /\$\{catalogKindLabel\(kind\)\}übersicht/);
  assert.match(panelSource, /data-catalog-kind-nav/);
  assert.match(panelSource, /role="tablist"/);
  assert.match(panelSource, /_selectCatalogKind\(kind\)/);
  assert.match(panelSource, /<caption class="visually-hidden">Kontenübersicht<\/caption>/);
  for (const editor of [
    "plan-item",
    "pet",
    "feed-profile",
    "catalog",
    "account",
  ]) {
    assert.match(panelSource, new RegExp(`data-open-${editor}-editor`));
    assert.match(panelSource, new RegExp(`data-close-${editor}-editor`));
  }
  assert.match(panelSource, /this\._planItemEditorId = null/);
  assert.match(panelSource, /this\._petEditorId = null/);
  assert.match(panelSource, /this\._feedProfileEditorId = null/);
  assert.match(panelSource, /this\._catalogEditor = null/);
  assert.match(panelSource, /this\._accountEditorId = null/);
});

test("disables save actions until a draft differs from its loaded baseline", () => {
  assert.match(panelSource, /_draftsEqual\(draft, baseline\)/);
  assert.match(panelSource, /this\._setSaveButtonState\(form, !this\._draftsEqual\(draft, baseline\)/);
  assert.match(panelSource, /this\._accountSubmissions = new Set\(\)/);
  assert.match(panelSource, /submit\.disabled = submitState\.disabled \|\| !hasChanges/);
  assert.match(panelSource, /this\._allocationOriginalDrafts = new Map\(\)/);
});

test("renders live Plan/Ist detail values instead of demo-only placeholders", () => {
  assert.match(panelSource, /this\._data\.demo === false \? "LIVE" : "DEMO"/);
  assert.match(panelSource, /household\.income_plan/);
  assert.match(panelSource, /area\.actual \?\? area\.value/);
  assert.match(panelSource, /area\.plan \?\? 0/);
  assert.match(panelSource, /trend\.min_value/);
});

test("protects unsaved edits when leaving a view or closing the browser", () => {
  assert.match(panelSource, /_hasUnsavedChanges\(\)/);
  assert.match(panelSource, /_confirmDiscardUnsavedChanges\(\)/);
  assert.match(panelSource, /Es gibt ungespeicherte Änderungen\. Möchtest du sie verwerfen\?/);
  assert.match(panelSource, /_discardUnsavedChanges\(\)/);
  assert.match(panelSource, /window\.addEventListener\("beforeunload", this\._handleBeforeUnload\)/);
  assert.match(panelSource, /window\.removeEventListener\("beforeunload", this\._handleBeforeUnload\)/);
  assert.match(panelSource, /_navigateToOverview\(\)/);
});

test("uses an in-app dialog instead of native confirm prompts", () => {
  assert.doesNotMatch(panelSource, /window\.confirm\(/);
  assert.match(panelSource, /<dialog class="confirm-dialog" data-confirm-dialog/);
  assert.match(panelSource, /dialog\.showModal\(\)/);
  assert.match(panelSource, /<form method="dialog" class="confirm-dialog-actions">/);
  assert.match(panelSource, /data-confirm-cancel/);
  assert.match(panelSource, /data-confirm-submit/);
});

test("renders a skip link to focusable main content and reveals it on keyboard focus", () => {
  assert.match(panelSource, /class="skip-link visually-hidden" href="#content" data-skip-link/);
  assert.match(panelSource, /\.skip-link:focus-visible\s*\{[^}]*clip-path:\s*none\s*!important/s);
  assert.match(panelSource, /<main class="main" id="content" tabindex="-1">/);
  assert.match(panelSource, /querySelector\("\[data-skip-link\]"\).*addEventListener\("click"/);
});

test("uses a dedicated contrasting border token for account form controls", () => {
  assert.match(panelSource, /--fp-control-border:\s*var\(--fp-muted\)/);
  assert.match(panelSource, /\.account-field input, \.account-owners select\s*\{[^}]*border:\s*1px solid var\(--fp-control-border\)/s);
});

test("names each account save action and renders its lifecycle status", () => {
  assert.match(panelSource, /aria-label="Änderungen für \$\{escapeHtml\(accountLabel\)\} \(\$\{escapeHtml\(maskedReference\)\}\) speichern"/);
  assert.match(panelSource, /data-account-active-status/);
});

test("uses a transient presenter for global feedback and humanizes household targets", () => {
  assert.match(panelSource, /id="feedback-presenter"[^>]*popover="manual"/);
  assert.match(panelSource, /data-feedback-message/);
  assert.match(panelSource, /popovertarget="feedback-presenter" popovertargetaction="hide"/);
  assert.doesNotMatch(panelSource, /class="status-message"/);
  assert.match(panelSource, /_syncFeedbackPresenter\(\)/);
  assert.match(panelSource, /const owners = ownerTargets\.map\(\(target\) => this\._targetLabel\(target\)\)/);
  assert.match(panelSource, /if \(target === "household"\) return "Haushalt"/);
});

test("keeps allocation locks and account drafts outside the rendered form", () => {
  assert.match(panelSource, /this\._allocationSubmissions = new Set\(\)/);
  assert.match(panelSource, /this\._allocationSubmissions\.has\(bookingId\)/);
  assert.match(panelSource, /this\._accountDrafts = new Map\(\)/);
  assert.match(panelSource, /data-account-label.*addEventListener\("input"/s);
  assert.doesNotMatch(panelSource, /dataset\.submitting/);
});

test("renders bank and masked IBAN fields and keeps IBAN optional on submit", () => {
  assert.match(panelSource, /data-account-bank/);
  assert.match(panelSource, /data-account-iban/);
  assert.match(panelSource, /Gespeichert: \$\{escapeHtml\(account\.iban_masked\)\}/);
  assert.match(panelSource, /leer lassen, wenn sie unverändert bleiben soll/);
  assert.match(panelSource, /bank: account\.bank \|\| ""/);
  assert.match(panelSource, /iban: ""/);
  assert.match(panelSource, /if \(draft\.iban\.trim\(\)\) payload\.iban = draft\.iban\.trim\(\)/);
  assert.match(panelSource, /data-account-label\], \[data-account-bank\], \[data-account-iban\]/);
});

test("keeps import account counts in the review feedback after reload", () => {
  assert.match(panelSource, /result\.new_accounts \|\| 0/);
  assert.match(panelSource, /result\.unconfigured_accounts \|\| 0/);
  assert.match(panelSource, /this\._message = feedback/);
});

test("keeps the Excel confirmation feedback after refreshing the overview", () => {
  assert.match(panelSource, /this\._excelPreview = null;\s*await this\._loadOverview\(\);\s*this\._message = `\$\{result\.accepted\} Planposten übernommen, \$\{result\.skipped\} abgewählt\.`/s);
});

test("offers ZIP uploads for multiple bank statement files", () => {
  assert.match(panelSource, /\.zip/);
  assert.match(panelSource, /application\/zip/);
  assert.match(panelSource, /ZIP mit mehreren Buchungsdateien/);
  assert.match(panelSource, /result\.format === "ZIP"/);
  assert.match(panelSource, /result\.files\?\.length/);
});

test("provides overview pages for every prepared navigation section", () => {
  assert.match(panelSource, /const SECTION_VIEWS = \["energy", "calendar", "tasks", "household", "people"\]/);
  assert.match(panelSource, /else if \(SECTION_VIEWS\.includes\(button\.dataset\.nav\)\) this\._openSectionOverview\(button\.dataset\.nav\)/);
  assert.match(panelSource, /async _openSectionOverview\(view\)/);
  assert.match(panelSource, /_sectionOverviewTemplate\(this\._view\)/);
  assert.match(panelSource, /Energieposten/);
  assert.match(panelSource, /Monatskalender/);
  assert.match(panelSource, /Als Nächstes/);
  assert.match(panelSource, /Personen im Haushalt/);
  assert.doesNotMatch(panelSource, /für die nächste Ausbaustufe vorbereitet/);
});

test("mobile navigation groups work areas into seven primary destinations", () => {
  assert.match(panelSource, /\["overview", "overview", "Übersicht"\]/);
  assert.match(panelSource, /\["bookings", "file", "Buchungen"\]/);
  assert.match(panelSource, /\["planning", "planner", "Planen"\]/);
  assert.match(panelSource, /\["household", "household", "Haushalt"\]/);
  assert.match(panelSource, /\["calendar", "calendar", "Kalender"\]/);
  assert.match(panelSource, /\["feed_profiles", "cart", "Futter"\]/);
  assert.match(panelSource, /\["more", "more", "Mehr"\]/);
  assert.match(panelSource, /_moreNavTemplate\(\)/);
  assert.match(panelSource, /data-action="more"/);
  assert.match(panelSource, /data-nav="tasks"/);
  assert.match(panelSource, /data-nav="energy"/);
  assert.doesNotMatch(panelSource, /\["people", "people", "Personen"\]/);
  assert.doesNotMatch(panelSource, /\["pets", "paw", "Tiere"\]/);
  assert.doesNotMatch(panelSource, /\["catalogs", "tags", "Stammdaten"\]/);
  assert.doesNotMatch(panelSource, /\["accounts", "settings", "Konten"\]/);
  assert.match(panelSource, /actionButton\("people", "Personen öffnen"/);
  assert.match(panelSource, /actionButton\("catalogs", "Stammdaten öffnen"/);
});

test("acceptSuggestionDraft identifies the booking and copies allocations", () => {
  const booking = {
    id: "booking-1",
    status: "suggested",
    suggestion: { allocations: [{ target: "household", amount: 42.37 }] },
  };
  const result = utils.acceptSuggestionDraft(booking);
  assert.deepEqual(result, {
    bookingId: "booking-1",
    allocations: [{ target: "household", amount: 42.37 }],
  });
  result.allocations[0].amount = 10;
  assert.equal(booking.suggestion.allocations[0].amount, 42.37);
});

// Exercise panel behavior without claiming layout or browser rendering coverage.
function ruleTestPanel() {
  let Panel;
  const dialogNodes = new Map([
    ["[data-confirm-title]", { textContent: "" }],
    ["[data-confirm-message]", { textContent: "" }],
    ["[data-confirm-submit]", { textContent: "" }],
    ["[data-confirm-cancel]", { focus: () => {} }],
  ]);
  const confirmDialog = {
    returnValue: "cancel",
    addEventListener: (_type, listener) => { confirmDialog.closeListener = listener; },
    removeEventListener: () => { confirmDialog.closeListener = null; },
    querySelector: (selector) => dialogNodes.get(selector) || null,
    showModal: () => {
      confirmDialog.returnValue = "confirm";
      confirmDialog.closeListener?.();
    },
    close: () => {},
  };
  const root = {
    querySelector: (selector) => selector === "[data-confirm-dialog]" ? confirmDialog : null,
    querySelectorAll: () => [],
  };
  runInNewContext(panelSource
    .replace(/^import \{([^}]+)\} from "\.\/panel-utils.mjs";/, "const {$1} = utils;")
    .replaceAll("import.meta.url", JSON.stringify(new URL("./panel.js", import.meta.url).href)), {
    utils, URL, Intl, console,
    HTMLElement: class { attachShadow() { this.shadowRoot = root; } },
    customElements: { define: (_name, value) => { Panel = value; } },
    window: { alert: () => {}, location: { href: "https://ha.example/finanzplaner" } },
  });
  const panel = new Panel();
  panel._render = () => {};
  return panel;
}

test("rule overview groups by account and sorts by matching priority then label", () => {
  const panel = ruleTestPanel();
  panel._accounts = [
    { id: "account-giro", label: "Gemeinsames Girokonto", active: true },
    { id: "account-savings", label: "Rücklagen", active: true },
  ];
  const rule = (id, label, priority, account_id) => ({
    id, label, priority, account_id, active: true, counterparty: label,
    purpose_contains: "", allocations: [{ target: "household", share_percent: 100 }],
  });
  panel._rules = [
    rule("r-low", "Zahlung", 20, "account-giro"),
    rule("r-high-z", "Zoo", 100, "account-giro"),
    rule("r-high-a", "Apotheke", 100, "account-giro"),
    rule("r-savings", "Rücklage", 50, "account-savings"),
  ];

  const markup = panel._rulesOverviewTemplate();
  assert.doesNotMatch(markup, /<th scope="col">Konto<\/th>/);
  assert.match(markup, /<th scope="rowgroup" colspan="6">Gemeinsames Girokonto<\/th>/);
  assert.match(markup, /<th scope="rowgroup" colspan="6">Rücklagen<\/th>/);

  const giroGroupStart = markup.indexOf(">Gemeinsames Girokonto</th>");
  const giroGroupEnd = markup.indexOf("</tbody>", giroGroupStart);
  const giroMarkup = markup.slice(giroGroupStart, giroGroupEnd);
  assert.ok(giroMarkup.indexOf(">Apotheke</th>") < giroMarkup.indexOf(">Zoo</th>"));
  assert.ok(giroMarkup.indexOf(">Zoo</th>") < giroMarkup.indexOf(">Zahlung</th>"));
  assert.ok(markup.indexOf(">Gemeinsames Girokonto</th>") < markup.indexOf(">Rücklagen</th>"));
});

test("bookingHistoryRequestUrl serializes populated filters in deterministic order", () => {
  assert.equal(
    utils.bookingHistoryRequestUrl("/api/finanzplaner/bookings", {
      q: "rent", from: "2026-01-01", to: "2026-01-31", status: "resolved",
      account_id: "account-main", category_id: "cat-1", limit: 0, offset: 0,
    }),
    "/api/finanzplaner/bookings?q=rent&from=2026-01-01&to=2026-01-31&status=resolved&account_id=account-main&category_id=cat-1&limit=0&offset=0",
  );
});

test("reportRangeLabel and repairTargetsPayload keep report and repair contracts pure", () => {
  assert.equal(utils.reportRangeLabel("month", "2026-01-01", "2026-01-31"), "Januar 2026");
  assert.equal(utils.reportRangeLabel("year", "2026-01-01", "2026-12-31"), "Jahr 2026");
  assert.deepEqual(utils.repairTargetsPayload([{ from: "person.old", to: "person.new" }]), {
    repairs: [{ from: "person.old", to: "person.new" }],
  });
});

test("reportRequestUrl uses the API report contract and omits no range", () => {
  assert.equal(
    utils.reportRequestUrl("/api/finanzplaner/report", "2026-01-01", "2026-01-31", "month"),
    "/api/finanzplaner/report?from=2026-01-01&to=2026-01-31&view=month",
  );
});

test("review exposes rule reapplication and the resolved booking navigation", () => {
  assert.match(panelSource, /const APPLY_RULES_URL = "\/api\/finanzplaner\/bookings\/apply-rules"/);
  assert.match(panelSource, /const RESOLVED_URL = "\/api\/finanzplaner\/bookings\/resolved"/);
  assert.match(panelSource, /data-action="apply-rules"/);
  assert.match(panelSource, /\["resolved", "check", "Buchungen"\]/);
  assert.match(panelSource, /data-unresolve-booking=/);
  assert.match(panelSource, /data-booking-select-all/);
  assert.match(panelSource, /data-delete-bookings/);
  assert.match(panelSource, /<table[^>]*>.*Übernommene Buchungen/s);
});

test("deleting selected review bookings sends a bulk DELETE and refreshes the data", async () => {
  const panel = ruleTestPanel();
  panel._bookings = [{ id: "booking-1" }, { id: "booking-2" }];
  panel._selectedReviewBookings = new Set(["booking-1"]);
  panel._loadReviewData = async () => {};
  panel._loadOverview = async () => {};
  panel._hass = { fetchWithAuth: async (url, options) => {
    assert.equal(url, "/api/finanzplaner/bookings");
    assert.equal(options.method, "DELETE");
    assert.deepEqual(JSON.parse(options.body), { booking_ids: ["booking-1"] });
    return new Response(JSON.stringify({ deleted: 1 }), {
      headers: { "Content-Type": "application/json" },
    });
  } };

  await panel._deleteSelectedBookings("review");

  assert.equal(panel._selectedReviewBookings.size, 0);
});

test("deleting selected resolved bookings refreshes the resolved list", async () => {
  const panel = ruleTestPanel();
  panel._resolvedBookings = [{ id: "booking-resolved" }];
  panel._selectedResolvedBookings = new Set(["booking-resolved"]);
  let resolvedLoads = 0;
  panel._loadResolvedBookings = async () => { resolvedLoads += 1; };
  panel._loadOverview = async () => {};
  panel._hass = { fetchWithAuth: async () => new Response(JSON.stringify({ deleted: 1 }), {
    headers: { "Content-Type": "application/json" },
  }) };

  await panel._deleteSelectedBookings("resolved");

  assert.equal(resolvedLoads, 1);
  assert.equal(panel._selectedResolvedBookings.size, 0);
});

test("reapplying rules posts once and refreshes the review and overview", async () => {
  const panel = ruleTestPanel();
  let reviewLoads = 0;
  let overviewLoads = 0;
  const writes = [];
  panel._loadReviewData = async () => { reviewLoads += 1; };
  panel._loadOverview = async () => { overviewLoads += 1; };
  panel._hass = { fetchWithAuth: async (url, options) => {
    writes.push({ url, method: options.method });
    return new Response(JSON.stringify({ applied: 2, conflicts: 1, unresolved: 3 }), {
      headers: { "Content-Type": "application/json" },
    });
  } };

  await panel._applyRules();

  assert.deepEqual(writes, [{ url: "/api/finanzplaner/bookings/apply-rules", method: "POST" }]);
  assert.equal(reviewLoads, 1);
  assert.equal(overviewLoads, 1);
  assert.match(panel._message, /2 übernommen/);
});

test("undoing a resolved booking posts to the unresolve endpoint and refreshes the list", async () => {
  const panel = ruleTestPanel();
  let resolvedLoads = 0;
  const writes = [];
  panel._loadResolvedBookings = async () => { resolvedLoads += 1; };
  panel._loadOverview = async () => {};
  panel._hass = { fetchWithAuth: async (url, options) => {
    writes.push({ url, method: options.method });
    return new Response(JSON.stringify({ booking: { id: "b1", status: "unresolved" } }), {
      headers: { "Content-Type": "application/json" },
    });
  } };

  await panel._unresolveBooking("b1");

  assert.deepEqual(writes, [{ url: "/api/finanzplaner/bookings/b1/unresolve", method: "POST" }]);
  assert.equal(resolvedLoads, 1);
  assert.match(panel._message, /Prüfliste/);
});

test("comparison labels and entries select only the requested dimension", () => {
  assert.equal(utils.comparisonDimensionLabel("categories"), "Kategorien");
  assert.equal(utils.comparisonDimensionLabel("areas"), "Bereiche");
  assert.equal(utils.comparisonDimensionLabel("projects"), "Projekte");
  const entries = [{ key: "id:food", name: "Futter", plan: -50, actual: -30 }];
  assert.deepEqual(utils.comparisonEntries({ categories: entries }, "categories"), entries);
  assert.deepEqual(utils.comparisonEntries({ categories: entries }, "projects"), []);
  assert.deepEqual(utils.comparisonEntries(null, "categories"), []);
});

test("breakdown URL encodes each query value independently", () => {
  assert.equal(
    utils.overviewRequestUrl("/overview", "2026-09", "name"),
    "/overview?month=2026-09&category_grouping=name",
  );
  assert.equal(utils.breakdownRequestUrl("/api/finanzplaner/overview/breakdown", "2026-09", "categories", "name:Futter & Öl/+?#"),
    "/api/finanzplaner/overview/breakdown?month=2026-09&dimension=categories&key=name%3AFutter%20%26%20%C3%96l%2F%2B%3F%23");
  assert.equal(utils.breakdownRequestUrl("/breakdown", "2026&09", "areas/projects", "__unassigned__"),
    "/breakdown?month=2026%2609&dimension=areas%2Fprojects&key=__unassigned__");
  assert.equal(
    utils.breakdownRequestUrl("/breakdown", "2026-09", "categories", "category-name:gebühren", "name"),
    "/breakdown?month=2026-09&dimension=categories&key=category-name%3Ageb%C3%BChren&category_grouping=name",
  );
});

function comparisonTestPanel() {
  const panel = ruleTestPanel();
  panel._month = new Date(2026, 8, 1);
  panel._data = { demo: false, comparison: { categories: [
    { key: "id:food", name: "Futter <Bio>", plan: -50, forecast: -55, actual: -30, variance: 20, forecast_variance: -5, variance_percent: 40 },
  ], areas: [], projects: [] } };
  panel._render = () => { panel.markup = panel._overviewTemplate(); };
  return panel;
}

function breakdownResponse(overrides = {}) {
  return new Response(JSON.stringify({ month: "2026-09", dimension: "categories", key: "id:food", name: "Futter <Bio>",
    plan_items: [{ id: "p1", name: "Futterbudget", amount: 50, direction: "expense", frequency_months: 1, active: true }],
    bookings: [{ id: "b1", booking_date: "2026-09-10", counterparty: "Tierladen", purpose: "Futter <Bio>", amount: -90, matched_amount: -30 }],
    ...overrides,
  }), { headers: { "Content-Type": "application/json" } });
}

test("overview source includes comparison semantics, native controls and live status", () => {
  assert.match(panelSource, /Budget-Ist-Vergleich/);
  for (const label of ["Plan", "Prognose", "Ist", "Abweichung", "Details"]) {
    assert.ok(panelSource.includes(`<th scope="col">${label}`), `Missing ${label} column`);
  }
  assert.match(panelSource, /<button[^>]*type="button"[^>]*data-comparison-dimension/);
  assert.match(panelSource, /aria-pressed=/);
  assert.match(panelSource, /data-comparison-detail/);
  assert.doesNotMatch(panelSource, /Unterkategorie ·/);
  assert.match(panelSource, /data-comparison-grouping/);
  assert.match(panelSource, /aria-live="polite"/);
  const panel = comparisonTestPanel();
  const markup = panel._overviewTemplate();
  assert.equal((markup.match(/data-comparison-dimension=/g) || []).length, 3);
  assert.match(markup, /<caption[^>]*>[^<]*Kategorien/);
  assert.match(markup, /<th scope="row">Futter &lt;Bio&gt;<\/th>/);
  assert.match(markup, /Ist über Plan/);
  assert.ok(markup.indexOf("Budget-Ist-Vergleich") > markup.indexOf("Monatsverlauf"));
});

test("report switcher has an intentional active state and compact control styling", () => {
  assert.match(panelSource, /\.report-switcher\s*\{[^}]*display:\s*inline-flex/s);
  assert.match(panelSource, /\.report-switcher button\[aria-pressed="true"\][^{]*\{/);
  assert.match(panelSource, /data-report-view="month"/);
  assert.match(panelSource, /data-report-view="year"/);
  assert.match(panelSource, /data-report-view="cashflow"/);
});

test("category options render the full parent path", () => {
  const panel = comparisonTestPanel();
  panel._catalogs.categories = [
    { id: "house", label: "Haus", active: true, parent_id: null },
    { id: "fees", label: "Gebühren", active: true, parent_id: "house" },
  ];

  assert.match(panel._catalogOptions("categories", "fees"), /Haus → Gebühren/);
});

test("breakdown loads through HA auth and renders source tables and matched booking amount", async () => {
  const panel = comparisonTestPanel();
  let respond;
  panel._hass = { fetchWithAuth: (url) => {
    assert.equal(url, "/api/finanzplaner/overview/breakdown?month=2026-09&dimension=categories&key=id%3Afood");
    return new Promise((resolve) => { respond = resolve; });
  } };
  const pending = panel._loadBreakdown("categories", "id:food");
  assert.match(panel.markup, /Details werden geladen/);
  respond(breakdownResponse());
  await pending;
  assert.match(panel.markup, /<caption[^>]*>Planposten/);
  assert.match(panel.markup, /<caption[^>]*>Buchungen/);
  assert.match(panel.markup, /<th scope="row">Futterbudget<\/th>/);
  assert.match(panel.markup, /Tierladen/);
  assert.match(panel.markup, /−30,00 €/);
  assert.match(panel.markup, /Futter &lt;Bio&gt;/);
  assert.match(panel.markup, /Vergleich schließen/);
  assert.match(panel.markup, /Erneut laden/);
  assert.equal(panel._breakdownLoading, false);
});

test("name-grouped breakdown sends its mode and renders source category paths", async () => {
  const panel = comparisonTestPanel();
  panel._comparisonCategoryGrouping = "name";
  let respond;
  panel._hass = { fetchWithAuth: (url) => {
    assert.equal(url, "/api/finanzplaner/overview/breakdown?month=2026-09&dimension=categories&key=id%3Afood&category_grouping=name");
    return new Promise((resolve) => { respond = resolve; });
  } };
  const pending = panel._loadBreakdown("categories", "id:food");
  respond(breakdownResponse({ source_categories: [
    { key: "house-fees", name: "Haus → Gebühren" },
    { key: "bank-fees", name: "Bank → Gebühren" },
  ] }));
  await pending;
  assert.match(panel.markup, /Haus → Gebühren/);
  assert.match(panel.markup, /Bank → Gebühren/);
});

test("breakdown error uses feedback and offers retry; empty results explain both source lists", async () => {
  const panel = comparisonTestPanel();
  panel._hass = { fetchWithAuth: async () => new Response("Zugriff verweigert", { status: 403 }) };
  await panel._loadBreakdown("categories", "id:food");
  assert.match(panel._message, /Zugriff verweigert/);
  assert.match(panel.markup, /Erneut laden/);
  assert.equal(panel._breakdownLoading, false);
  panel._hass.fetchWithAuth = async () => breakdownResponse({ plan_items: [], bookings: [] });
  await panel._loadBreakdown("categories", "id:food");
  assert.match(panel.markup, /Keine Planposten/);
  assert.match(panel.markup, /Keine Buchungen/);
  assert.equal(panel._breakdownError, "");
});

test("opening breakdown focuses its heading without suppressing native scrolling", async () => {
  const panel = comparisonTestPanel();
  const focusOptions = [];
  panel.shadowRoot.querySelector = (selector) => selector === "#comparison-details-heading"
    ? { focus: (options) => focusOptions.push(options) } : null;
  panel._hass = { fetchWithAuth: async () => breakdownResponse() };
  await panel._loadBreakdown("categories", "id:food");
  assert.equal(focusOptions.length, 1);
  assert.notEqual(focusOptions[0]?.preventScroll, true);
});

test("new selection wins even if the previous breakdown finishes last", async () => {
  const panel = comparisonTestPanel();
  const responses = [];
  panel._hass = { fetchWithAuth: () => new Promise((resolve) => responses.push(resolve)) };
  const first = panel._loadBreakdown("categories", "id:food");
  const second = panel._loadBreakdown("categories", "id:other");
  responses[1](breakdownResponse({ key: "id:other", name: "Neu", bookings: [], plan_items: [] }));
  await second;
  responses[0](breakdownResponse());
  await first;
  assert.equal(panel._breakdown.key, "id:other");
  assert.doesNotMatch(panel.markup, /Tierladen/);
});

test("month, dimension, close and view changes discard pending breakdown responses", async () => {
  for (const change of [
    (panel) => { panel._loadOverview = async () => {}; panel._shiftMonth(1); },
    (panel) => panel._setComparisonDimension("projects"),
    (panel) => panel._closeBreakdown(),
    (panel) => { panel._view = "review"; },
  ]) {
    const panel = comparisonTestPanel();
    let respond;
    panel._hass = { fetchWithAuth: () => new Promise((resolve) => { respond = resolve; }) };
    const pending = panel._loadBreakdown("categories", "id:food");
    change(panel);
    respond(breakdownResponse());
    await pending;
    assert.equal(panel._breakdown, null);
    assert.equal(panel._message, "");
  }
});

test("a stale error cannot replace a successful retry for the same selection", async () => {
  const panel = comparisonTestPanel();
  const responses = [];
  panel._hass = { fetchWithAuth: () => new Promise((resolve, reject) => responses.push({ resolve, reject })) };
  const first = panel._loadBreakdown("categories", "id:food");
  const retry = panel._loadBreakdown("categories", "id:food");
  responses[1].resolve(breakdownResponse());
  await retry;
  responses[0].reject(new Error("Veralteter Fehler"));
  await first;
  assert.match(panel.markup, /Tierladen/);
  assert.equal(panel._breakdownError, "");
  assert.equal(panel._message, "");
});

test("loaded details clear on dimension and month changes", async () => {
  const panel = comparisonTestPanel();
  panel._hass = { fetchWithAuth: async () => breakdownResponse() };
  await panel._loadBreakdown("categories", "id:food");
  panel._setComparisonDimension("projects");
  assert.equal(panel._breakdown, null);
  assert.doesNotMatch(panel.markup, /Tierladen/);
  assert.match(panel.markup, /data-comparison-dimension="projects" aria-pressed="true"/);
  panel._setComparisonDimension("categories");
  await panel._loadBreakdown("categories", "id:food");
  panel._loadOverview = async () => {};
  panel._shiftMonth(1);
  assert.equal(panel._breakdown, null);
  assert.doesNotMatch(panel.markup, /Tierladen/);
});

test("month changes reload the active report and the overview", () => {
  const panel = comparisonTestPanel();
  panel._reportView = "year";
  const loads = [];
  panel._loadOverview = () => loads.push("overview");
  panel._loadReport = (view) => loads.push(`report:${view}`);

  panel._shiftMonth(1);

  assert.deepEqual(loads, ["overview", "report:year"]);
});

test("empty live comparison stays empty and demo data has an explicit projection", () => {
  const panel = comparisonTestPanel();
  panel._data = { demo: false };
  assert.match(panel._overviewTemplate(), /Keine Vergleichswerte/);
  panel._data = { demo: true };
  const markup = panel._overviewTemplate();
  assert.match(markup, /<th scope="row">Lebensmittel<\/th>/);
  assert.match(markup, /Demo-Daten/);
  assert.match(markup, /Detailbuchungen.*Demo/);
});

test("live empty data never inherits demo metrics or trend points", () => {
  const panel = comparisonTestPanel();
  panel._data = { demo: false, month: "2026-09" };
  const markup = panel._overviewTemplate();
  assert.doesNotMatch(markup, /4\.200,00 €/);
  assert.doesNotMatch(markup, /5\.220,00 €/);
  assert.doesNotMatch(markup, /Lebensmittel/);
  assert.match(markup, /Keine Vergleichswerte/);
});

test("overview API errors show a live error state instead of demo values", async () => {
  const panel = comparisonTestPanel();
  panel.isConnected = true;
  panel._render = () => { panel.markup = panel._overviewTemplate(); };
  panel._hass = { fetchWithAuth: async () => { throw new Error("API nicht erreichbar"); } };

  await panel._loadOverview();

  assert.equal(panel._data.demo, false);
  assert.equal(panel._overviewLoadFailed, true);
  assert.doesNotMatch(panel.markup, /Demo-Daten/);
  assert.match(panel.markup, /Live-Daten konnten nicht geladen werden/);
  assert.match(panel.markup, /API nicht erreichbar/);
});

test("overview ignores old month responses and requests the local calendar month", async () => {
  const panel = comparisonTestPanel();
  const responses = [];
  panel._hass = { fetchWithAuth: (url) => {
    responses.push({ url, resolve: null });
    return new Promise((resolve) => { responses.at(-1).resolve = resolve; });
  } };
  const first = panel._loadOverview();
  panel._month = new Date(2026, 9, 1);
  const second = panel._loadOverview();
  assert.equal(responses[0].url, "/api/finanzplaner/overview?month=2026-09");
  assert.equal(responses[1].url, "/api/finanzplaner/overview?month=2026-10");
  responses[1].resolve(new Response(JSON.stringify({ demo: false, month: "2026-10", actual: 20 }), { headers: { "Content-Type": "application/json" } }));
  await second;
  responses[0].resolve(new Response(JSON.stringify({ demo: false, month: "2026-09", actual: 10 }), { headers: { "Content-Type": "application/json" } }));
  await first;
  assert.equal(panel._data.month, "2026-10");
  assert.equal(panel._data.actual, 20);
});

function validRuleDraft() {
  return {
    label: "Lebensmittel", active: true, priority: "100", account_id: "",
    counterparty: "Laden", purpose_contains: "",
    allocations: [{ target: "household", share_percent: "100", area_id: "", category_id: "", project_id: "", pet_id: "" }],
  };
}

test("accepting a suggestion changes only its draft and permits explicit confirmation of identical rows", () => {
  const panel = ruleTestPanel();
  const booking = { id: "b1", status: "suggested", suggestion: { allocations: [{ target: "household", amount: 42.37 }] } };
  panel._bookings = [booking];
  panel._allocationOriginalDrafts.set("b1", [{ target: "household", amount: 42.37 }]);
  panel._hass = { fetchWithAuth: () => assert.fail("Accepting must not send a request") };
  panel._acceptSuggestion("b1");
  assert.deepEqual(panel._allocationDrafts.get("b1"), [{ target: "household", amount: 42.37 }]);
  assert.equal(panel._acceptedSuggestions.has("b1"), true);
  panel._allocationDrafts.get("b1")[0].amount = 10;
  assert.equal(booking.suggestion.allocations[0].amount, 42.37);
  assert.equal(booking.status, "suggested");
});

test("rule validation rejects bad shares, duplicate targets and unavailable references", () => {
  const panel = ruleTestPanel();
  const draft = validRuleDraft();
  assert.deepEqual(Object.keys(panel._ruleValidationErrors(draft)), []);
  draft.allocations[0].share_percent = "99.99";
  assert.ok(panel._ruleValidationErrors(draft).allocations);
  draft.allocations = [
    { target: "household", share_percent: "50", category_id: "archived" },
    { target: "household", share_percent: "50" },
    { target: "person.missing", share_percent: "0" },
  ];
  panel._catalogs.categories = [{ id: "archived", label: "Alt", active: false }];
  const errors = panel._ruleValidationErrors(draft);
  assert.ok(errors["0-category_id"]);
  assert.ok(errors["1-target"]);
  assert.ok(errors["2-target"]);
  assert.ok(errors["2-share_percent"]);
});

test("confirmed booking opens a prefilled rule with its purpose filter and no POST", async () => {
  const panel = ruleTestPanel();
  panel._confirmedBookings.set("b1", {
    id: "b1", status: "resolved", counterparty: "Laden", purpose: "Private Details",
    account_id: "a1", amount: -3, allocations: [
      { target: "household", amount: 1 }, { target: "person.anna", amount: 2 },
    ],
  });
  panel._hass = { fetchWithAuth: async (_url, options) => {
    assert.notEqual(options.method, "POST");
    return new Response(JSON.stringify({ rules: [], accounts: [], persons: [], pets: [], catalogs: {} }), { headers: { "Content-Type": "application/json" } });
  } };
  await panel._openRuleFromBooking("b1");
  assert.equal(panel._ruleDraft.purpose_contains, "Private Details");
  assert.equal(panel._ruleDraft.counterparty, "Laden");
  assert.equal(panel._ruleDraft.account_id, "a1");
  assert.deepEqual(Array.from(panel._ruleDraft.allocations, (row) => Number(row.share_percent)), [33.33, 66.67]);
  assert.equal(panel._ruleSourceBookingId, "b1");
});

test("confirmed booking keeps a missing counterparty empty and derives the rule label from its purpose", async () => {
  const panel = ruleTestPanel();
  panel._confirmedBookings.set("b-mt940", {
    id: "b-mt940", status: "resolved", counterparty: "",
    purpose: "Sparenzu POS 166,90 AT K1 05.06. 10:30",
    account_id: "a1", amount: -0.10,
    allocations: [{ target: "household", amount: 0.10 }],
  });
  panel._hass = { fetchWithAuth: async (_url, options) => {
    assert.notEqual(options.method, "POST");
    return new Response(JSON.stringify({ rules: [], accounts: [], persons: [], pets: [], catalogs: {} }), { headers: { "Content-Type": "application/json" } });
  } };
  await panel._openRuleFromBooking("b-mt940");
  assert.equal(panel._ruleDraft.counterparty, "");
  assert.equal(panel._ruleDraft.label, "Sparenzu POS 166,90 AT K1 05.06. 10:30");
  assert.doesNotMatch(panel._ruleFormTemplate(), /data-rule-field="counterparty"[^>]* required/);
});

test("review shows payment recipient separately from purpose", () => {
  const panel = ruleTestPanel();
  panel._bookings = [{
    id: "b-display", booking_date: "2026-06-08", counterparty: "Sparenzu",
    purpose: "POS 166,90 AT K1 05.06. 10:30", amount: -0.10, status: "unresolved",
    account_label: "Gemeinsames Girokonto", account_reference: "•••• 5678",
  }];
  const markup = panel._reviewTemplate();
  assert.match(markup, /Zahlungsempfänger:.*Sparenzu/);
  assert.match(markup, /Verwendungszweck:.*POS 166,90/);
  assert.match(markup, /Erkanntes Konto:.*Gemeinsames Girokonto/);
  assert.match(markup, /Kontoreferenz:.*•••• 5678/);

  panel._bookings[0].counterparty = "";
  panel._bookings[0].purpose = "Sparenzu POS 166,90 AT K1 05.06. 10:30";
  const missingCounterpartyMarkup = panel._reviewTemplate();
  assert.match(missingCounterpartyMarkup, /Zahlungsempfänger nicht erkannt/);
  assert.match(missingCounterpartyMarkup, /Verwendungszweck:.*Sparenzu POS 166,90/);
});

test("review places internal account labels beside sender and recipient without an account pair", () => {
  const panel = ruleTestPanel();
  panel._bookings = [{
    id: "b-internal-review", booking_date: "2026-06-08", sender: "Ing. David Egger",
    counterparty: "Isabella Egger", purpose: "Giro-Überweisung", amount: -100,
    status: "unresolved", account_label: "Haushaltsrücklagen", account_reference: "•••• 3157",
    booking_accounts: {
      sender: { label: "Girokonto", account_reference: "•••• 1234" },
      recipient: { label: "Haushaltsrücklagen", account_reference: "•••• 3157" },
    },
  }];

  const markup = panel._reviewTemplate();

  assert.match(markup, /Absender: Ing\. David Egger <span class="booking-account-inline">\(Girokonto\)<\/span>/);
  assert.match(markup, /Zahlungsempfänger: Isabella Egger <span class="booking-account-inline">\(Haushaltsrücklagen\)<\/span>/);
  assert.match(markup, /Erkanntes Konto: Haushaltsrücklagen/);
  assert.doesNotMatch(markup, /Konten:/);
});

test("resolved bookings place internal account labels beside sender and recipient without an account pair", () => {
  const panel = ruleTestPanel();
  panel._resolvedBookings = [{
    id: "b-internal-resolved", booking_date: "2026-06-08", sender: "Ing. David Egger",
    counterparty: "Isabella Egger", purpose: "Giro-Überweisung", amount: -100,
    status: "resolved",
    booking_accounts: {
      sender: { label: "Girokonto", account_reference: "•••• 1234" },
      recipient: { label: "Haushaltsrücklagen", account_reference: "•••• 3157" },
    },
  }];

  const markup = panel._resolvedBookingsTemplate();

  assert.match(markup, /Absender: Ing\. David Egger <span class="booking-account-inline">\(Girokonto\)<\/span>/);
  assert.match(markup, /Zahlungsempfänger: Isabella Egger <span class="booking-account-inline">\(Haushaltsrücklagen\)<\/span>/);
  assert.doesNotMatch(markup, /Konten:/);
});

test("saving a booking rule validates the edited payload and persists once and returns to the list", async () => {
  const panel = ruleTestPanel();
  panel._ruleDraft = validRuleDraft();
  panel._ruleEditingId = "new";
  panel._ruleSourceBookingId = "b1";
  const writes = [];
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  panel._hass = { fetchWithAuth: async (url, options) => {
    if (options.method === "POST") {
      writes.push({ url, body: JSON.parse(options.body) });
      await pending;
    }
    return new Response(JSON.stringify({ rule: { id: "r1" }, rules: [], accounts: [], persons: [], pets: [], catalogs: {} }), { headers: { "Content-Type": "application/json" } });
  } };
  const event = { preventDefault() {}, currentTarget: { querySelector: () => null, querySelectorAll: () => [] } };
  const first = panel._handleRuleSave(event);
  await panel._handleRuleSave(event);
  assert.equal(panel._ruleSubmitting, true);
  release();
  await first;
  assert.deepEqual(writes.map((write) => write.url), ["/api/finanzplaner/rules"]);
  assert.equal(writes[0].body.label, "Lebensmittel");
  assert.equal(writes[0].body.purpose_contains, null);
  assert.equal(writes[0].body.allocations[0].share_percent, 100);
  assert.equal(panel._ruleEditingId, null);
  assert.equal(panel._ruleSubmitting, false);
  assert.match(panel._ruleMessage, /gespeichert/);
});

test("rule validation enforces priority bounds", () => {
  const panel = ruleTestPanel();
  panel._persons = [{ entity_id: "person.anna" }];
  for (const priority of ["-1", "1001", "0.1", "", "Infinity"]) {
    const draft = { ...validRuleDraft(), priority };
    assert.ok(panel._ruleValidationErrors(draft).priority, `priority ${priority}`);
  }
  for (const priority of ["0", "1000"]) {
    assert.equal(panel._ruleValidationErrors({ ...validRuleDraft(), priority }).priority, undefined);
  }
});

test("rule validation enforces percentage bounds without rounding", async () => {
  const panel = ruleTestPanel();
  panel._persons = [{ entity_id: "person.anna" }];
  for (const shares of [["0.001", "99.999"], ["0.009", "99.991"], ["-0.01", "100.01"], ["0", "100"]]) {
    panel._ruleDraft = validRuleDraft();
    panel._ruleDraft.allocations = shares.map((share, index) => ({ target: index ? "person.anna" : "household", share_percent: share }));
    const errors = panel._ruleValidationErrors(panel._ruleDraft);
    assert.ok(errors["0-share_percent"], `shares ${shares}`);
    panel._hass = { fetchWithAuth: () => assert.fail("Invalid shares must not POST") };
    await panel._handleRuleSave({ preventDefault() {}, currentTarget: { querySelector: () => null, querySelectorAll: () => [] } });
    assert.match(panel._ruleMessage, /Fehlerhaft/);
  }
  for (const shares of [["0.01", "99.99"], ["33.33", "66.67"], ["1.13", "98.87"]]) {
    const draft = validRuleDraft();
    draft.allocations = shares.map((share, index) => ({ target: index ? "person.anna" : "household", share_percent: share }));
    assert.deepEqual(Object.keys(panel._ruleValidationErrors(draft)), []);
  }
});

test("rule validation allows a missing counterparty when another condition exists", () => {
  const panel = ruleTestPanel();
  const draft = validRuleDraft();
  draft.counterparty = "";
  draft.purpose_contains = "POS";
  assert.deepEqual(Object.keys(panel._ruleValidationErrors(draft)), []);
  draft.purpose_contains = "";
  assert.equal(panel._ruleValidationErrors(draft).conditions, "Eine Regel benötigt mindestens eine Bedingung.");
});

test("rule text validation uses 120 for labels and 160 for matching filters", () => {
  const panel = ruleTestPanel();
  for (const [field, limit] of [["label", 120], ["counterparty", 160], ["purpose_contains", 160]]) {
    const draft = validRuleDraft();
    draft[field] = "x".repeat(limit);
    assert.equal(panel._ruleValidationErrors(draft)[field], undefined, `${field} boundary`);
    draft[field] += "x";
    assert.ok(panel._ruleValidationErrors(draft)[field], `${field} overflow`);
  }
});

test("a booking template with invalid percentages and references can be repaired and explicitly saved", async () => {
  const panel = ruleTestPanel();
  const booking = {
    id: "b-repair", status: "resolved", counterparty: "Laden", purpose: "Private details",
    account_id: "archived-account", amount: -1000, allocations: [
      { target: "person.missing", amount: 0.01, category_id: "archived-category", pet_id: "missing-pet" },
      { target: "household", amount: 999.99 },
    ],
  };
  const before = structuredClone(booking);
  panel._confirmedBookings.set(booking.id, booking);
  const writes = [];
  panel._hass = { fetchWithAuth: async (url, options) => {
    if (options.method === "POST") {
      writes.push({ url, body: JSON.parse(options.body) });
      if (url.includes("from-booking")) return new Response("Originalvorlage ungültig", { status: 400 });
    }
    return new Response(JSON.stringify({ rule: { id: "r-repaired" }, rules: [], accounts: [], persons: [{ entity_id: "person.anna" }], pets: [], catalogs: {} }), { headers: { "Content-Type": "application/json" } });
  } };
  await panel._openRuleFromBooking(booking.id);
  assert.equal(writes.length, 0);
  assert.equal(panel._ruleDraft.allocations[0].share_percent, "0");
  assert.ok(panel._ruleValidationErrors(panel._ruleDraft).account_id);
  assert.ok(panel._ruleValidationErrors(panel._ruleDraft)["0-target"]);
  assert.ok(panel._ruleValidationErrors(panel._ruleDraft)["0-category_id"]);
  panel._ruleDraft.account_id = "";
  Object.assign(panel._ruleDraft.allocations[0], { target: "person.anna", share_percent: "0.01", category_id: "", pet_id: "" });
  panel._ruleDraft.allocations[1].share_percent = "99.99";
  panel._ruleDraft.purpose_contains = "Bewusst ergänzt";
  assert.equal(writes.length, 0, "editing must not save automatically");
  assert.deepEqual(Object.keys(panel._ruleValidationErrors(panel._ruleDraft)), []);
  await panel._handleRuleSave({ preventDefault() {}, currentTarget: { querySelector: () => null, querySelectorAll: () => [] } });
  assert.deepEqual(writes, [{ url: "/api/finanzplaner/rules", body: {
    label: "Laden", active: true, priority: 100, account_id: null, counterparty: "Laden", purpose_contains: "Bewusst ergänzt",
    allocations: [
      { target: "person.anna", share_percent: 0.01, category_id: null, area_id: null, project_id: null, pet_id: null },
      { target: "household", share_percent: 99.99, category_id: null, area_id: null, project_id: null, pet_id: null },
    ],
  } }]);
  assert.equal(panel._ruleEditingId, null);
  assert.match(panel._ruleMessage, /gespeichert/);
  assert.deepEqual(booking, before);
});

test("failed rule save retains edits and exposes server feedback", async () => {
  const panel = ruleTestPanel();
  panel._ruleDraft = validRuleDraft();
  panel._ruleEditingId = "new";
  panel._hass = { fetchWithAuth: async () => new Response("Kategorie ist archiviert", { status: 400 }) };
  await panel._handleRuleSave({ preventDefault() {}, currentTarget: { querySelector: () => null, querySelectorAll: () => [] } });
  assert.equal(panel._ruleDraft.label, "Lebensmittel");
  assert.equal(panel._ruleEditingId, "new");
  assert.equal(panel._ruleSubmitting, false);
  assert.match(panel._ruleMessage, /Kategorie ist archiviert/);
});

test("booking confirmation locks the editor and offers rule creation only after a successful response", async () => {
  const panel = ruleTestPanel();
  const rows = [{ target: "household", amount: 42.37 }];
  panel._bookings = [{ id: "b1", counterparty: "Laden", amount: -42.37, status: "suggested" }];
  panel._allocationDrafts.set("b1", rows);
  panel._allocationOriginalDrafts.set("b1", rows.map((row) => ({ ...row })));
  panel._acceptedSuggestions.add("b1");
  const editor = { disabled: false };
  const status = { textContent: "" };
  const form = {
    dataset: { bookingId: "b1", bookingTotal: "42.37" },
    querySelector: (selector) => selector === ".allocation-editor" ? editor : selector === "[data-allocation-status]" ? status : null,
    setAttribute() {}, removeAttribute() {},
  };
  let respond;
  panel._hass = { fetchWithAuth: () => new Promise((resolve) => { respond = resolve; }) };
  const request = panel._handleAssignment({ preventDefault() {}, currentTarget: form });
  assert.equal(panel._confirmedBookings.size, 0);
  const wasLocked = editor.disabled;
  respond(new Response("Aufteilung ungültig", { status: 400 }));
  await request;
  assert.equal(wasLocked, true);
  assert.equal(editor.disabled, false);
  assert.equal(panel._confirmedBookings.size, 0);
  assert.match(status.textContent, /Aufteilung ungültig/);
  panel._hass = { fetchWithAuth: async (url) => new Response(JSON.stringify(url.endsWith("/allocations")
    ? { booking: { id: "b1", status: "resolved", counterparty: "Laden", amount: -42.37, allocations: rows } }
    : { rules: [], bookings: [], persons: [], pets: [], accounts: [], catalogs: {} }), { headers: { "Content-Type": "application/json" } }) };
  await panel._handleAssignment({ preventDefault() {}, currentTarget: form });
  assert.equal(panel._confirmedBookings.get("b1").status, "resolved");
  assert.equal(panel._allocationDrafts.has("b1"), false);
  assert.equal(panel._acceptedSuggestions.has("b1"), false);
});

test("an invalid share total is associated with its percentage field after interaction", () => {
  const panel = ruleTestPanel();
  panel._ruleDraft = validRuleDraft();
  panel._ruleDraft.allocations[0].share_percent = "90";
  panel._ruleTouched.add("0-share_percent");
  const input = {
    id: "rule-0-share_percent", dataset: { ruleField: "share_percent", ruleIndex: "0" },
    setCustomValidity(value) { this.error = value; }, setAttribute(key, value) { this[key] = value; },
  };
  const error = { textContent: "" };
  panel._syncRuleFormState({
    querySelectorAll: () => [input],
    querySelector: (selector) => selector === '[id="rule-0-share_percent-error"]' ? error : null,
  });
  assert.match(input.error, /100/);
  assert.match(error.textContent, /100/);
  assert.equal(input["aria-invalid"], "true");
});

for (const failure of ["server", "network"]) {
  test(`a deferred ${failure} booking failure unlocks the current editor after another suggestion replaces it`, async () => {
    const panel = ruleTestPanel();
    const rows = [{ target: "household", amount: 42.37 }];
    panel._bookings = ["b1", "b2"].map((id) => ({
      id, amount: -42.37, status: "suggested", suggestion: { allocations: rows },
    }));
    for (const booking of panel._bookings) panel._allocationOriginalDrafts.set(booking.id, rows);
    let forms;
    panel._render = () => {
      // Minimal DOM boundary: rendering replaces nodes, just as shadowRoot.innerHTML does.
      forms = panel._bookings.map((booking) => {
        const nodes = new Map([
          [".allocation-editor", { disabled: false }],
          ["[data-accept-suggestion]", { disabled: false }],
          ["[type='submit']", { disabled: false }],
          ["[data-allocation-status]", { textContent: panel._allocationErrors.get(booking.id) || "" }],
        ]);
        const form = {
          dataset: { bookingId: booking.id, bookingTotal: "42.37" },
          querySelector: (selector) => nodes.get(selector),
          setAttribute(key, value) { this[key] = value; },
          removeAttribute(key) { delete this[key]; },
        };
        panel._updateAllocationSummary(form);
        return form;
      });
    };
    panel.shadowRoot.querySelectorAll = (selector) => selector === "[data-assignment-form]" ? forms : [];
    panel._acceptSuggestion("b1");
    const originalForm = panel._allocationForm("b1");
    const response = Promise.withResolvers();
    const writes = [];
    panel._hass = { fetchWithAuth: (url, options) => {
      writes.push({ url, method: options.method });
      return response.promise;
    } };
    const saving = panel._handleAssignment({ preventDefault() {}, currentTarget: originalForm });
    assert.equal(originalForm.querySelector(".allocation-editor").disabled, true);
    panel._acceptSuggestion("b2");
    const currentForm = panel._allocationForm("b1");
    assert.notEqual(currentForm, originalForm);
    assert.equal(currentForm.querySelector(".allocation-editor").disabled, true);
    await panel._handleAssignment({ preventDefault() {}, currentTarget: currentForm });
    if (failure === "server") response.resolve(new Response("Aufteilung ungültig", { status: 400 }));
    else response.reject(new Error("Verbindung unterbrochen"));
    await saving;
    const recovered = panel._allocationForm("b1");
    assert.equal(recovered.querySelector(".allocation-editor").disabled, false);
    assert.equal(recovered.querySelector("[type='submit']").disabled, false);
    assert.equal(recovered.querySelector("[data-accept-suggestion]").disabled, false);
    assert.notEqual(recovered["aria-busy"], "true");
    assert.match(recovered.querySelector("[data-allocation-status]").textContent,
      failure === "server" ? /Aufteilung ungültig/ : /Verbindung unterbrochen/);
    assert.deepEqual(panel._allocationDrafts.get("b2"), rows);
    assert.equal(panel._confirmedBookings.size, 0);
    assert.equal(panel._allocationSubmissions.size, 0);
    assert.deepEqual(writes, [{ url: "/api/finanzplaner/bookings/b1/allocations", method: "POST" }]);
  });
}

for (const mutation of ["create", "update", "deactivate"]) {
  for (const order of ["old first", "fresh first", "old error first", "old error last"]) {
    test(`rule ${mutation} refresh ignores an older deferred read (${order})`, async () => {
      const panel = ruleTestPanel();
      const oldRule = { ...validRuleDraft(), id: "r1", label: "Vorher" };
      const savedRule = { ...oldRule, label: "Nachher", active: mutation !== "deactivate" };
      const snapshot = (rules) => new Response(JSON.stringify({ rules }), { headers: { "Content-Type": "application/json" } });
      const oldResponse = Promise.withResolvers();
      const freshResponse = Promise.withResolvers();
      const writes = [];
      let reads = 0;
      panel._rules = [oldRule];
      panel._ruleEditingId = mutation === "create" ? "new" : "r1";
      panel._ruleDraft = validRuleDraft();
      panel._hass = { fetchWithAuth: (url, options) => {
        if (options.method === "POST") {
          writes.push({ url, body: JSON.parse(options.body) });
          return Promise.resolve(snapshot([savedRule]));
        }
        if (url === "/api/finanzplaner/rules") {
          reads += 1;
          return reads === 1 ? oldResponse.promise : freshResponse.promise;
        }
        return Promise.resolve(new Response("{}", { headers: { "Content-Type": "application/json" } }));
      } };
      const oldRead = panel._loadRules().catch(() => {});
      const saving = mutation === "deactivate" ? panel._deactivateRule("r1") : panel._handleRuleSave({
        preventDefault() {}, currentTarget: { querySelector: () => null, querySelectorAll: () => [] },
      });
      const finishOld = () => order.includes("error")
        ? oldResponse.reject(new Error("Veralteter Ladefehler")) : oldResponse.resolve(snapshot([oldRule]));
      try {
        await new Promise(setImmediate);
        assert.equal(reads, 2, "a successful mutation must start a fresh rules GET");
        if (order.endsWith("first") && order !== "fresh first") {
          finishOld();
          await oldRead;
          assert.equal(panel._rulesLoading, true, "the current refresh is still pending");
          assert.equal(panel._rulesLoadFailed, false);
          const sharedRead = panel._loadRules();
          assert.equal(reads, 2, "an obsolete request must not clear the current in-flight read");
          freshResponse.resolve(snapshot([savedRule]));
          await sharedRead;
        } else {
          freshResponse.resolve(snapshot([savedRule]));
          await saving;
          finishOld();
          await oldRead;
        }
        await saving;
        assert.deepEqual(panel._rules, [savedRule]);
        assert.equal(panel._rulesLoading, false);
        assert.equal(panel._rulesLoadFailed, false);
        assert.equal(panel._ruleSubmitting, false);
        assert.match(panel._ruleMessage, mutation === "deactivate" ? /deaktiviert/ : /gespeichert/);
        assert.doesNotMatch(panel._ruleMessage, /Ladefehler/);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].url, mutation === "create" ? "/api/finanzplaner/rules" : "/api/finanzplaner/rules/r1");
        if (mutation === "deactivate") assert.deepEqual(writes[0].body, { active: false });
      } finally {
        oldResponse.resolve(snapshot([oldRule]));
        freshResponse.resolve(snapshot([savedRule]));
        await Promise.allSettled([oldRead, saving]);
      }
    });
  }
}

test("leaving a field does not erase server feedback without editing", () => {
  const panel = ruleTestPanel();
  panel._ruleDraft = validRuleDraft();
  panel._ruleMessage = "Fehler beim Speichern: Kategorie ist archiviert";
  panel._updateRuleField({ type: "focusout", target: { dataset: { ruleField: "label" }, value: "Lebensmittel" } });
  assert.match(panel._ruleMessage, /Kategorie ist archiviert/);
});

test("uses the Home Assistant authenticated request method for protected panel APIs", async () => {
  const hass = {
    fetchWithAuth: async (path, options) => {
      if (path === "/api/finanzplaner/excel/preview" && options.method === "POST") {
        return { status: 200 };
      }
      return { status: 401 };
    },
  };

  const response = await utils.fetchWithHomeAssistantAuth(
    hass,
    "/api/finanzplaner/excel/preview",
    { method: "POST" },
  );

  assert.equal(response.status, 200);
});
