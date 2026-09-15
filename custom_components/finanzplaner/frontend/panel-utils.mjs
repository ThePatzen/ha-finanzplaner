const euroNumber = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEuro(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? "−" : "";
  return `${sign}${euroNumber.format(Math.abs(amount))} €`;
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

export function fetchWithHomeAssistantAuth(hass, path, options = {}) {
  if (typeof hass?.fetchWithAuth !== "function") {
    throw new Error("Die Home-Assistant-Anmeldung ist noch nicht bereit.");
  }
  return hass.fetchWithAuth(path, options);
}
