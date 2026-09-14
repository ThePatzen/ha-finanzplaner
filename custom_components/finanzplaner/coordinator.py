"""Coordinator for locally persisted finance data."""

from __future__ import annotations

from datetime import date
from datetime import timedelta
import logging
from typing import Any

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DOMAIN
from .core import overview_values
from .storage import FinanceStore

_LOGGER = logging.getLogger(__name__)


class FinanzplanerCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Expose one consistent snapshot to sensors and the panel API."""

    def __init__(self, hass: Any, store: FinanceStore) -> None:
        self.store = store
        super().__init__(
            hass,
            logger=_LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=15),
        )

    async def _async_update_data(self) -> dict[str, Any]:
        data = await self.store.async_load()
        # Keep the derived values in the coordinator snapshot so sensors and
        # API consumers use the same calculation without persisting a cache.
        data["overview"] = overview_values(data, date.today().strftime("%Y-%m"))
        return data

    async def async_refresh_data(self) -> None:
        await self.async_request_refresh()
