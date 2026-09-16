import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  assert.match(panelSource, /data-action="accounts" aria-label="Konten verwalten"/);
});

test("exposes authenticated pet profile management and pet-aware assignment fields", () => {
  assert.match(panelSource, /const PETS_URL = "\/api\/finanzplaner\/pets"/);
  assert.match(panelSource, /\["pets", "paw", "Tiere"\]/);
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
  assert.match(panelSource, /\["catalogs", "tags", "Stammdaten"\]/);
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
  assert.match(panelSource, /<caption class="visually-hidden">Stammdatenübersicht<\/caption>/);
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
