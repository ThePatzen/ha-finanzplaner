"""Config flow for the Finanzplaner integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries

from .const import CONF_HOUSEHOLD_NAME, DEFAULT_HOUSEHOLD_NAME, DOMAIN


class FinanzplanerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up one local household workspace."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            await self.async_set_unique_id(DOMAIN)
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=user_input[CONF_HOUSEHOLD_NAME],
                data=user_input,
            )
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_HOUSEHOLD_NAME,
                        default=DEFAULT_HOUSEHOLD_NAME,
                    ): str,
                }
            ),
        )
