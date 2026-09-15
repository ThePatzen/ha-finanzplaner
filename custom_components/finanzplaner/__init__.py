"""Home Assistant entry point for Finanzplaner."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .const import CONF_HOUSEHOLD_NAME, DEFAULT_HOUSEHOLD_NAME, DOMAIN, PLATFORMS


async def async_setup(hass: Any, config: dict[str, Any]) -> bool:
    """Register the API views once; setup itself is completed by the config entry."""

    from .http import (
        BookingAssignmentView,
        ExcelConfirmView,
        ExcelPreviewView,
        ImportView,
        OverviewView,
        PersonsView,
        UnresolvedBookingsView,
    )

    hass.data.setdefault(DOMAIN, {})
    hass.http.register_view(OverviewView)
    hass.http.register_view(PersonsView)
    hass.http.register_view(UnresolvedBookingsView)
    hass.http.register_view(BookingAssignmentView)
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

    household_name = entry.data.get(CONF_HOUSEHOLD_NAME, DEFAULT_HOUSEHOLD_NAME)
    store = FinanceStore(hass, household_name)
    await store.async_load()
    coordinator = FinanzplanerCoordinator(hass, store)
    await coordinator.async_config_entry_first_refresh()
    hass.data[DOMAIN][entry.entry_id] = coordinator

    static_dir = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/api/finanzplaner/static", str(static_dir), False)]
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
                "module_url": "/api/finanzplaner/static/panel.js",
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
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unloaded
