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

test("distributes equal allocations in cents with the remainder in the first row", () => {
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
});

test("labels an account without owners as not configured", () => {
  assert.equal(utils.accountOwnerStatus([]), "Inhaber noch nicht konfiguriert");
  assert.equal(utils.accountOwnerStatus(["person.alex", "person.sam"]), "2 Kontoinhaber");
});

test("labels the visible account lifecycle state", () => {
  assert.equal(utils.accountActiveStatus(true), "Aktiv");
  assert.equal(utils.accountActiveStatus(false), "Archiviert");
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
  assert.match(panelSource, /aria-label="Änderungen für \$\{escapeHtml\(accountLabel\)\} speichern"/);
  assert.match(panelSource, /data-account-active-status/);
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
