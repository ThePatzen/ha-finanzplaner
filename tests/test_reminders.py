import asyncio
import importlib
import sys
import types
import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from custom_components.finanzplaner.const import DOMAIN, SERVICE_CONFIRM_FEED_PURCHASE


def _load_binary_sensor_module():
    class BinarySensorEntity:
        pass

    class BinarySensorDeviceClass:
        PROBLEM = "problem"

    class CoordinatorEntity:
        @classmethod
        def __class_getitem__(cls, _item):
            return cls

        def __init__(self, coordinator):
            self.coordinator = coordinator

    class FakeCoordinator:
        pass

    fake_binary_sensor = types.ModuleType("homeassistant.components.binary_sensor")
    fake_binary_sensor.BinarySensorDeviceClass = BinarySensorDeviceClass
    fake_binary_sensor.BinarySensorEntity = BinarySensorEntity
    fake_components = types.ModuleType("homeassistant.components")
    fake_homeassistant = types.ModuleType("homeassistant")
    fake_helpers = types.ModuleType("homeassistant.helpers")
    fake_update_coordinator = types.ModuleType(
        "homeassistant.helpers.update_coordinator"
    )
    fake_update_coordinator.CoordinatorEntity = CoordinatorEntity
    fake_coordinator = types.ModuleType("custom_components.finanzplaner.coordinator")
    fake_coordinator.FinanzplanerCoordinator = FakeCoordinator
    modules = {
        "homeassistant": fake_homeassistant,
        "homeassistant.components": fake_components,
        "homeassistant.components.binary_sensor": fake_binary_sensor,
        "homeassistant.helpers": fake_helpers,
        "homeassistant.helpers.update_coordinator": fake_update_coordinator,
        "custom_components.finanzplaner.coordinator": fake_coordinator,
    }
    with patch.dict(sys.modules, modules):
        sys.modules.pop("custom_components.finanzplaner.binary_sensor", None)
        module = importlib.import_module("custom_components.finanzplaner.binary_sensor")
    return module


def _load_services_module():
    fake_voluptuous = types.ModuleType("voluptuous")
    fake_voluptuous.Required = lambda key: key
    fake_voluptuous.Optional = lambda key: key
    fake_voluptuous.Schema = lambda schema: schema

    class HomeAssistantError(Exception):
        pass

    fake_exceptions = types.ModuleType("homeassistant.exceptions")
    fake_exceptions.HomeAssistantError = HomeAssistantError
    fake_helpers = types.ModuleType("homeassistant.helpers")
    fake_config_validation = types.ModuleType(
        "homeassistant.helpers.config_validation"
    )
    fake_config_validation.string = "string"
    fake_homeassistant = types.ModuleType("homeassistant")
    modules = {
        "voluptuous": fake_voluptuous,
        "homeassistant": fake_homeassistant,
        "homeassistant.exceptions": fake_exceptions,
        "homeassistant.helpers": fake_helpers,
        "homeassistant.helpers.config_validation": fake_config_validation,
    }
    with patch.dict(sys.modules, modules):
        sys.modules.pop("custom_components.finanzplaner.services", None)
        module = importlib.import_module("custom_components.finanzplaner.services")
    return module, HomeAssistantError


class ReminderEntityTests(unittest.TestCase):
    def test_binary_sensor_is_on_for_due_active_profiles_only(self):
        module = _load_binary_sensor_module()
        today = date.today()
        coordinator = SimpleNamespace(
            data={
                "feed_profiles": [
                    {
                        "id": "feed-profile-fio",
                        "pet_name": "Fio",
                        "product": "Trockenfutter",
                        "expected_cost": 42.0,
                        "last_purchase_date": (today - timedelta(days=7)).isoformat(),
                        "interval_weeks": 1,
                        "due_soon_days": 14,
                        "active": True,
                    },
                    {
                        "id": "feed-profile-archived",
                        "last_purchase_date": (today - timedelta(days=7)).isoformat(),
                        "interval_weeks": 1,
                        "active": False,
                    },
                ]
            }
        )

        sensor = module.FeedPurchaseDueSensor(coordinator, "entry")

        self.assertTrue(sensor.is_on)
        self.assertEqual(sensor.extra_state_attributes["due_profile_ids"], ["feed-profile-fio"])
        self.assertEqual(sensor.extra_state_attributes["due_profile_count"], 1)
        self.assertEqual(sensor.extra_state_attributes["next_purchase_date"], today.isoformat())


class ReminderServiceTests(unittest.TestCase):
    def test_confirm_purchase_service_records_purchase_and_refreshes(self):
        module, home_assistant_error = _load_services_module()

        class FakeServices:
            def __init__(self):
                self.registered = {}
                self.removed = []

            def has_service(self, domain, service):
                return (domain, service) in self.registered

            def async_register(self, domain, service, handler, schema=None):
                self.registered[(domain, service)] = handler

            def async_remove(self, domain, service):
                self.removed.append((domain, service))
                self.registered.pop((domain, service), None)

        profile = {
            "id": "feed-profile-fio",
            "active": True,
            "purchase_dates": [],
        }
        refreshes = []

        async def async_refresh_data():
            refreshes.append(True)

        coordinator = SimpleNamespace(
            store=SimpleNamespace(data={"feed_profiles": [profile]}, async_save=lambda: None),
            async_refresh_data=async_refresh_data,
        )

        async def async_save():
            refreshes.append("saved")

        coordinator.store.async_save = async_save
        services = FakeServices()
        hass = SimpleNamespace(
            data={DOMAIN: {"entry": coordinator}},
            services=services,
        )

        asyncio.run(module.async_setup_services(hass, "entry"))
        handler = services.registered[(DOMAIN, SERVICE_CONFIRM_FEED_PURCHASE)]
        asyncio.run(
            handler(
                SimpleNamespace(
                    data={
                        "feed_profile_id": profile["id"],
                        "purchase_date": date.today().isoformat(),
                    }
                )
            )
        )

        self.assertEqual(profile["last_purchase_date"], date.today().isoformat())
        self.assertEqual(profile["purchase_dates"], [date.today().isoformat()])
        self.assertEqual(refreshes, ["saved", True])
        asyncio.run(module.async_unload_services(hass))
        self.assertEqual(services.removed, [(DOMAIN, SERVICE_CONFIRM_FEED_PURCHASE)])

        with self.assertRaises(home_assistant_error):
            asyncio.run(
                handler(
                    SimpleNamespace(
                        data={
                            "feed_profile_id": "unknown",
                            "purchase_date": date.today().isoformat(),
                        }
                    )
                )
            )
