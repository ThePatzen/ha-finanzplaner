import test from "node:test";
import assert from "node:assert/strict";

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
