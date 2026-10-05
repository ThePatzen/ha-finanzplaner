"""Regression coverage for non-blocking integration startup."""

import asyncio
import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from custom_components import finanzplaner
from custom_components.finanzplaner.const import DOMAIN, PLATFORMS


class IntegrationSetupTests(unittest.IsolatedAsyncioTestCase):
    async def test_setup_reads_manifest_outside_event_loop_and_registers_panel(self):
        manifest_path = Path(finanzplaner.__file__).with_name("manifest.json")
        version = json.loads(manifest_path.read_text(encoding="utf-8"))["version"]
        read_text = Path.read_text
        manifest_reads = []

        def guarded_read_text(path, *args, **kwargs):
            if path == manifest_path:
                try:
                    asyncio.get_running_loop()
                except RuntimeError:
                    pass
                else:
                    self.fail("Startup reads the manifest on the event loop")
                manifest_reads.append(path)
            return read_text(path, *args, **kwargs)

        class FakeStore:
            def __init__(self, hass, household_name):
                self.async_load = AsyncMock()

        class FakeCoordinator:
            def __init__(self, hass, store):
                self.store = store
                self.async_config_entry_first_refresh = AsyncMock()

        panel_calls = []
        frontend = ModuleType("homeassistant.components.frontend")
        frontend.async_register_built_in_panel = lambda hass, **kwargs: panel_calls.append(kwargs)
        components = ModuleType("homeassistant.components")
        components.frontend = frontend
        http = ModuleType("homeassistant.components.http")
        http.StaticPathConfig = lambda url, path, cache_headers: SimpleNamespace(
            url_path=url, path=path, cache_headers=cache_headers
        )
        coordinator_module = ModuleType("custom_components.finanzplaner.coordinator")
        coordinator_module.FinanzplanerCoordinator = FakeCoordinator
        storage_module = ModuleType("custom_components.finanzplaner.storage")
        storage_module.FinanceStore = FakeStore
        services_module = ModuleType("custom_components.finanzplaner.services")
        services_module.async_setup_services = AsyncMock()
        modules = {
            "homeassistant": ModuleType("homeassistant"),
            "homeassistant.components": components,
            "homeassistant.components.frontend": frontend,
            "homeassistant.components.http": http,
            "custom_components.finanzplaner.coordinator": coordinator_module,
            "custom_components.finanzplaner.storage": storage_module,
            "custom_components.finanzplaner.services": services_module,
        }
        hass = SimpleNamespace(
            data={DOMAIN: {}},
            async_add_executor_job=asyncio.to_thread,
            http=SimpleNamespace(async_register_static_paths=AsyncMock()),
            config_entries=SimpleNamespace(async_forward_entry_setups=AsyncMock()),
        )
        entry = SimpleNamespace(entry_id="test-entry", data={})

        with patch.dict(sys.modules, modules), patch.object(Path, "read_text", guarded_read_text):
            self.assertTrue(await finanzplaner.async_setup_entry(hass, entry))

        self.assertEqual(manifest_reads, [manifest_path])
        self.assertIn(entry.entry_id, hass.data[DOMAIN])
        hass.config_entries.async_forward_entry_setups.assert_awaited_once_with(entry, PLATFORMS)
        static_paths = hass.http.async_register_static_paths.call_args.args[0]
        self.assertEqual(static_paths[0].url_path, f"/api/finanzplaner/static/{version}")
        self.assertEqual(static_paths[0].path, str(manifest_path.parent / "frontend"))
        self.assertEqual(
            panel_calls[0]["config"]["_panel_custom"]["module_url"],
            f"/api/finanzplaner/static/{version}/panel.js",
        )
