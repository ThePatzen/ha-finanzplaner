"""Home Assistant entry point for Finanzplaner."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .const import (
    CONF_HOUSEHOLD_NAME,
    DEFAULT_HOUSEHOLD_NAME,
    DOMAIN,
    PLATFORMS,
    panel_static_path,
)


def _integration_version() -> str:
    """Read the release version used to isolate frontend module caches."""

    manifest_path = Path(__file__).with_name("manifest.json")
    return json.loads(manifest_path.read_text(encoding="utf-8"))["version"]


async def async_setup(hass: Any, config: dict[str, Any]) -> bool:
    """Register the API views once; setup itself is completed by the config entry."""

    from .http import (
        AccountsView,
        AccountView,
        ApplyRulesView,
        BookingAllocationsView,
        CatalogEntriesView,
        CatalogEntryView,
        CatalogsView,
        BookingAssignmentView,
        BookingUnresolveView,
        ExcelConfirmView,
        ExcelPreviewView,
        FeedProfilePurchaseView,
        FeedProfileView,
        FeedProfilesView,
        ImportView,
        OverviewBreakdownView,
        OverviewView,
        PetView,
        PetsView,
        PlanItemView,
        PlanItemsView,
        PersonsView,
        RuleFromBookingView,
        RuleView,
        RulesView,
        ResolvedBookingsView,
        UnresolvedBookingsView,
    )

    hass.data.setdefault(DOMAIN, {})
    hass.http.register_view(OverviewView)
    hass.http.register_view(OverviewBreakdownView)
    hass.http.register_view(PlanItemsView)
    hass.http.register_view(PlanItemView)
    hass.http.register_view(PersonsView)
    hass.http.register_view(AccountsView)
    hass.http.register_view(AccountView)
    hass.http.register_view(PetsView)
    hass.http.register_view(PetView)
    hass.http.register_view(FeedProfilesView)
    hass.http.register_view(FeedProfileView)
    hass.http.register_view(FeedProfilePurchaseView)
    hass.http.register_view(CatalogsView)
    hass.http.register_view(CatalogEntriesView)
    hass.http.register_view(CatalogEntryView)
    hass.http.register_view(RulesView)
    hass.http.register_view(RuleView)
    hass.http.register_view(RuleFromBookingView)
    hass.http.register_view(UnresolvedBookingsView)
    hass.http.register_view(ResolvedBookingsView)
    hass.http.register_view(ApplyRulesView)
    hass.http.register_view(BookingAssignmentView)
    hass.http.register_view(BookingAllocationsView)
    hass.http.register_view(BookingUnresolveView)
    hass.http.register_view(ImportView)
    hass.http.register_view(ExcelPreviewView)
    hass.http.register_view(ExcelConfirmView)
    return True


async def async_setup_entry(hass: Any, entry: Any) -> bool:
    """Load the local store, coordinator, sensors and native panel."""

    from homeassistant.components import frontend
    from homeassistant.components.http import StaticPathConfig

    from .coordinator import FinanzplanerCoordinator
    from .storage import FinanceStore
    from .services import async_setup_services

    household_name = entry.data.get(CONF_HOUSEHOLD_NAME, DEFAULT_HOUSEHOLD_NAME)
    store = FinanceStore(hass, household_name)
    await store.async_load()
    coordinator = FinanzplanerCoordinator(hass, store)
    await coordinator.async_config_entry_first_refresh()
    hass.data[DOMAIN][entry.entry_id] = coordinator
    await async_setup_services(hass, entry.entry_id)

    static_dir = Path(__file__).parent / "frontend"
    static_url = panel_static_path(_integration_version())
    await hass.http.async_register_static_paths(
        [StaticPathConfig(static_url, str(static_dir), False)]
    )
    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Finanzplaner",
        sidebar_icon="mdi:chart-timeline-variant",
        frontend_url_path=DOMAIN,
        config={
            "_panel_custom": {
                "name": "finanzplaner-panel",
                "module_url": f"{static_url}/panel.js",
                "embed_iframe": False,
            }
        },
    )
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: Any, entry: Any) -> bool:
    """Unload the coordinator and platform entities."""

    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        from .services import async_unload_services

        await async_unload_services(hass)
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unloaded
