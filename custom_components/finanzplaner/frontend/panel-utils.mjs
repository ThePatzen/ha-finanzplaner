const euroNumber = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEuro(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? "−" : "";
  return `${sign}${euroNumber.format(Math.abs(amount))} €`;
}

export function comparisonDimensionLabel(dimension) {
  return ({ categories: "Kategorien", areas: "Bereiche", projects: "Projekte" })[dimension] || "Kategorien";
}

export function comparisonEntries(comparison, dimension) {
  return Array.isArray(comparison?.[dimension]) ? comparison[dimension] : [];
}

export function overviewRequestUrl(baseUrl, month, categoryGrouping = "structure") {
  const query = `month=${encodeURIComponent(month)}`;
  return `${String(baseUrl).replace(/\/$/, "")}?${categoryGrouping === "name" ? `${query}&category_grouping=name` : query}`;
}

export function breakdownRequestUrl(baseUrl, month, dimension, key, categoryGrouping = "structure") {
  const query = `month=${encodeURIComponent(month)}&dimension=${encodeURIComponent(dimension)}&key=${encodeURIComponent(key)}`;
  return `${String(baseUrl).replace(/\/$/, "")}?${dimension === "categories" && categoryGrouping === "name" ? `${query}&category_grouping=name` : query}`;
}

export function bookingDetailsRequestUrl(baseUrl, bookingId) {
  return String(baseUrl).replace(/\/$/, "") + "/" + encodeURIComponent(String(bookingId)) + "/details";
}

export function bookingHistoryRequestUrl(baseUrl, filters = {}) {
  const order = ["q", "from", "to", "status", "account_id", "target", "category_id", "area_id", "project_id", "limit", "offset"];
  const params = new URLSearchParams();
  order.forEach((key) => {
    const value = filters?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") params.set(key, String(value).trim());
  });
  const query = params.toString();
  return `${String(baseUrl).replace(/\/$/, "")}${query ? `?${query}` : ""}`;
}

export function bookingGroups(bookings = [], accounts = []) {
  const accountLabels = new Map(
    accounts
      .filter((account) => account?.id !== undefined && account?.id !== null)
      .map((account) => [String(account.id), String(account.label || account.name || "").trim()]),
  );
  const groups = new Map();

  bookings.forEach((booking) => {
    const accountKey = String(
      booking?.account_id || booking?.account_reference || booking?.account || "unassigned",
    );
    const label = String(
      booking?.account_label
        || accountLabels.get(String(booking?.account_id))
        || booking?.account_reference
        || booking?.account
        || "Konto nicht zugeordnet",
    ).trim() || "Konto nicht zugeordnet";
    if (!groups.has(accountKey)) groups.set(accountKey, { key: accountKey, label, bookings: [] });
    groups.get(accountKey).bookings.push(booking);
  });

  return [...groups.values()].sort(
    (left, right) => left.label.localeCompare(right.label, "de", { sensitivity: "base" })
      || left.key.localeCompare(right.key),
  );
}

export function reportRequestUrl(baseUrl, from, to, view = "month") {
  const params = new URLSearchParams({ from: String(from), to: String(to), view: String(view) });
  return `${String(baseUrl).replace(/\/$/, "")}?${params.toString()}`;
}

export function reportRangeLabel(view, from, to) {
  const start = new Date(`${from}T00:00:00`);
  if (view === "year") return `Jahr ${start.getFullYear()}`;
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(start);
}

export function repairTargetsPayload(repairs = []) {
  return { repairs: repairs.map(({ from, to }) => ({ from: String(from || ""), to: String(to || "") })) };
}

export function bookingDetailRawJson(detail) {
  return JSON.stringify(detail, null, 2);
}

export function trendSummary(trend) {
  const last = (key) => Number(trend?.[key]?.at(-1) || 0);
  const todayIndex = Number(trend?.today_index ?? 0);
  const periods = Math.max(
    trend?.planned?.length || 0,
    trend?.forecast?.length || 0,
    trend?.actual?.length || 0,
  );
  const todayText = todayIndex >= periods - 1 ? "am Ende des Zeitraums" : `bei Tag ${todayIndex + 1}`;
  return `Plan ${formatEuro(last("planned"))}, Prognose ${formatEuro(last("forecast"))}, Ist ${formatEuro(last("actual"))}; Heute ${todayText}.`;
}

export function homeAssistantPath(currentHref, panelPath = "/finanzplaner") {
  const url = new URL(currentHref);
  const normalizedPanel = `/${panelPath.replace(/^\/+|\/+$/g, "")}`;
  const panelPattern = new RegExp(`${normalizedPanel}/?$`);
  return url.pathname.replace(panelPattern, "/") || "/";
}

export function selectedSuggestionSummary(suggestions = []) {
  return suggestions.reduce(
    (summary, suggestion) => {
      if (!suggestion?.selected) return summary;
      summary.count += 1;
      summary.amount += Number(suggestion.amount) || 0;
      return summary;
    },
    { count: 0, amount: 0 },
  );
}

export function bookingSelectionState(bookings = [], selectedIds = []) {
  const selected = new Set([...selectedIds].map((id) => String(id)));
  const selectedCount = bookings.reduce(
    (count, booking) => count + (selected.has(String(booking?.id)) ? 1 : 0),
    0,
  );
  return {
    selectedCount,
    allSelected: bookings.length > 0 && selectedCount === bookings.length,
    someSelected: selectedCount > 0 && selectedCount < bookings.length,
  };
}

export function suggestionDraft(booking) {
  return booking?.status === "suggested"
    ? (booking.suggestion?.allocations || []).map((row) => ({ ...row }))
    : [];
}

export function ruleStatusLabel(status) {
  const labels = {
    unresolved: "Manuelle Zuordnung erforderlich",
    suggested: "Regelvorschlag",
    conflict: "Regelkonflikt",
    duplicate: "Duplikat prüfen",
  };
  return Object.hasOwn(labels, status) ? labels[status] : "Prüfung erforderlich";
}

export function resolvedBookingSourceLabel(booking) {
  const matchedRule = booking?.matched_rule;
  if (matchedRule?.rule_label) return `Automatisch über Regel „${matchedRule.rule_label}“`;
  if (matchedRule?.rule_id) return "Automatisch über Regel";
  return "Manuell zugeordnet";
}

export function acceptSuggestionDraft(booking) {
  return { bookingId: booking.id, allocations: suggestionDraft(booking) };
}

export function rulePayloadFromForm(form) {
  return {
    label: form.label.trim(),
    active: Boolean(form.active),
    priority: Number(form.priority),
    account_id: form.account_id || null,
    counterparty: form.counterparty.trim(),
    purpose_contains: form.purpose_contains.trim() || null,
    direction: form.direction || null,
    counterparty_account: form.counterparty_account?.trim() || null,
    amount_min: form.amount_min === "" || form.amount_min == null ? null : Number(form.amount_min),
    amount_max: form.amount_max === "" || form.amount_max == null ? null : Number(form.amount_max),
    allocations: form.allocations.map((row) => ({ ...row })),
  };
}

export function conflictRuleIds(booking) {
  return booking?.status === "conflict"
    ? (booking.conflicts || []).map((ruleId) => ruleId)
    : [];
}

export function ruleConflictIds(rule) {
  return Array.isArray(rule?.conflict_rule_ids)
    ? rule.conflict_rule_ids.map((ruleId) => ruleId)
    : [];
}

export async function readApiResponse(response) {
  const contentType = response.headers?.get?.("Content-Type") || "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json" ? response.json() : response.text();
}

function euroToCents(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function equalAllocationDraft(total, targets = []) {
  if (!targets.length) return [];
  const totalCents = Math.abs(euroToCents(total));
  const centsPerTarget = Math.floor(totalCents / targets.length);
  const remainder = totalCents - (centsPerTarget * targets.length);
  return targets.map((target, index) => ({
    target,
    amount: (centsPerTarget + (index < remainder ? 1 : 0)) / 100,
    area: null,
    category: null,
    project: null,
  }));
}

export function allocationRemaining(total, allocations = []) {
  const allocatedCents = allocations.reduce(
    (sum, allocation) => sum + euroToCents(allocation?.amount),
    0,
  );
  return (Math.abs(euroToCents(total)) - allocatedCents) / 100;
}

export function addAllocationDraftRow(total, allocations = []) {
  return equalAllocationDraft(
    total,
    [...allocations.map((row) => row.target || ""), ""],
  ).map((row, index) => {
    const current = allocations[index];
    return current ? {
      ...row,
      area: current.area ?? null,
      category: current.category ?? null,
      project: current.project ?? null,
      ...(Object.hasOwn(current, "pet_id") ? { pet_id: current.pet_id ?? null } : {}),
      ...(Object.hasOwn(current, "area_id") ? { area_id: current.area_id ?? null } : {}),
      ...(Object.hasOwn(current, "category_id") ? { category_id: current.category_id ?? null } : {}),
      ...(Object.hasOwn(current, "project_id") ? { project_id: current.project_id ?? null } : {}),
      ...(current && Object.hasOwn(current, "amount_input")
        ? { amount_input: current.amount_input }
        : {}),
    } : row;
  });
}

export function updateAllocationDraftRow(allocations = [], index, field, value) {
  return allocations.map((row, rowIndex) => {
    if (rowIndex !== index) return { ...row };
    if (field === "amount") {
      const amount = Number(String(value).trim().replace(",", "."));
      return {
        ...row,
        amount: Number.isFinite(amount) ? amount : 0,
        amount_input: String(value).trim(),
      };
    }
    return { ...row, [field]: value || null };
  });
}

export function removeAllocationDraftRow(allocations = [], index) {
  return allocations.filter((row, rowIndex) => rowIndex !== index).map((row) => ({ ...row }));
}

export function allocationSubmitState(total, allocations = [], submitting = false) {
  const remaining = allocationRemaining(total, allocations);
  const missingTarget = !allocations.length || allocations.some((row) => !row.target);
  const invalidAmount = allocations.some((row) => {
    const value = row?.amount_input ?? row?.amount;
    const amount = Number(String(value ?? "").trim().replace(",", "."));
    return !Number.isFinite(amount)
      || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7;
  });
  return {
    missingTarget,
    invalidAmount,
    remaining,
    disabled: missingTarget || invalidAmount || remaining !== 0 || submitting,
  };
}

export function allocationErrorMessage(response, body) {
  const fallback = response.status === 400
    ? "Die Aufteilung wurde nicht akzeptiert. Bitte prüfe Ziele und Centbeträge."
    : "Die Aufteilung konnte nicht gespeichert werden. Bitte versuche es erneut.";
  if (typeof body === "string") return body || fallback;
  return typeof body?.message === "string" && body.message ? body.message : fallback;
}

export function accountOwnerStatus(ownerTargets = []) {
  if (!ownerTargets.length) return "Inhaber noch nicht konfiguriert";
  return `${ownerTargets.length} Kontoinhaber`;
}

export function accountActiveStatus(active) {
  return active ? "Aktiv" : "Archiviert";
}

export function planItemFrequencyLabel(frequency) {
  const labels = {
    1: "monatlich",
    2: "alle 2 Monate",
    3: "vierteljährlich",
    6: "halbjährlich",
    12: "jährlich",
  };
  return labels[frequency] || "einmalig";
}

export function planItemStatus(active) {
  return active ? "Aktiv" : "Archiviert";
}

export function fetchWithHomeAssistantAuth(hass, path, options = {}) {
  if (typeof hass?.fetchWithAuth !== "function") {
    throw new Error("Die Home-Assistant-Anmeldung ist noch nicht bereit.");
  }
  return hass.fetchWithAuth(path, options);
}
