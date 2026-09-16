"""Home Assistant services exposed by Finanzplaner."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, SERVICE_CONFIRM_FEED_PURCHASE
from .core import record_feed_profile_purchase


CONFIRM_FEED_PURCHASE_SCHEMA = vol.Schema(
    {
        vol.Required("feed_profile_id"): cv.string,
        vol.Optional("purchase_date"): cv.string,
    }
)


async def async_setup_services(hass: Any, entry_id: str) -> None:
    """Register services for the active config entry."""

    async def async_confirm_feed_purchase(call: Any) -> None:
        coordinator = hass.data.get(DOMAIN, {}).get(entry_id)
        if coordinator is None:
            raise HomeAssistantError("Finanzplaner ist nicht eingerichtet.")
        profile_id = call.data["feed_profile_id"]
        profiles = coordinator.store.data.get("feed_profiles", [])
        profile = next(
            (
                item
                for item in profiles
                if isinstance(item, dict) and item.get("id") == profile_id
            ),
            None,
        ) if isinstance(profiles, list) else None
        if profile is None:
            raise HomeAssistantError("Futterprofil nicht gefunden.")
        try:
            record_feed_profile_purchase(profile, call.data.get("purchase_date"))
        except ValueError as exc:
            raise HomeAssistantError(str(exc)) from exc
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()

    if not hass.services.has_service(DOMAIN, SERVICE_CONFIRM_FEED_PURCHASE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_CONFIRM_FEED_PURCHASE,
            async_confirm_feed_purchase,
            schema=CONFIRM_FEED_PURCHASE_SCHEMA,
        )


async def async_unload_services(hass: Any) -> None:
    """Remove services when the integration is unloaded."""

    if hass.services.has_service(DOMAIN, SERVICE_CONFIRM_FEED_PURCHASE):
        hass.services.async_remove(DOMAIN, SERVICE_CONFIRM_FEED_PURCHASE)
