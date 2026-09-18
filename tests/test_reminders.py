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


def _load_sensor_module():
    class SensorEntity:
        pass

    class SensorDeviceClass:
        DATE = "date"

    class CoordinatorEntity:
        @classmethod
        def __class_getitem__(cls, _item):
            return cls

        def __init__(self, coordinator):
            self.coordinator = coordinator

    fake_sensor = types.ModuleType("homeassistant.components.sensor")
    fake_sensor.SensorDeviceClass = SensorDeviceClass
    fake_sensor.SensorEntity = SensorEntity
    fake_const = types.ModuleType("homeassistant.const")
    fake_const.CURRENCY_EURO = "€"
    fake_update_coordinator = types.ModuleType(
        "homeassistant.helpers.update_coordinator"
    )
    fake_update_coordinator.CoordinatorEntity = CoordinatorEntity
    fake_coordinator = types.ModuleType("custom_components.finanzplaner.coordinator")
    fake_coordinator.FinanzplanerCoordinator = type("FakeCoordinator", (), {})
    modules = {
        "homeassistant.components.sensor": fake_sensor,
        "homeassistant.const": fake_const,
        "homeassistant.helpers.update_coordinator": fake_update_coordinator,
        "custom_components.finanzplaner.coordinator": fake_coordinator,
    }
    with patch.dict(sys.modules, modules):
        sys.modules.pop("custom_components.finanzplaner.sensor", None)
        return importlib.import_module("custom_components.finanzplaner.sensor")


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


class FinanceSensorContractTests(unittest.TestCase):
    def test_finance_sensor_exposes_report_metrics(self):
        module = _load_sensor_module()

        self.assertGreaterEqual(
            {key for key, _, _ in module.SENSORS},
            {
                "planned_income",
                "planned_expenses",
                "planned_savings",
                "forecast",
                "unresolved_amount",
                "household_balance",
                "next_major_payment",
            },
        )

    def test_finance_sensor_reads_report_metric_from_coordinator_overview(self):
        module = _load_sensor_module()
        from custom_components.finanzplaner.core import overview_values

        coordinator = SimpleNamespace(
            data={
                "overview": overview_values(
                    {
                        "plan_items": [
                            {"direction": "income", "amount": 1200, "due_date": "2026-09-30"},
                            {"direction": "expense", "amount": 300, "due_date": "2026-09-05"},
                            {"direction": "saving", "amount": 100, "due_date": "2026-09-10"},
                        ],
                        "bookings": [
                            {"booking_date": "2026-09-03", "amount": 800, "status": "resolved"},
                            {"booking_date": "2026-09-04", "amount": -25, "status": "unresolved"},
                        ],
                    },
                    "2026-09",
                )
            }
        )

        income = module.FinanceSensor(coordinator, "entry", "planned_income", "", "€")
        expenses = module.FinanceSensor(coordinator, "entry", "planned_expenses", "", "€")
        savings = module.FinanceSensor(coordinator, "entry", "planned_savings", "", "€")
        forecast = module.FinanceSensor(coordinator, "entry", "forecast", "", "€")
        unresolved = module.FinanceSensor(coordinator, "entry", "unresolved_amount", "", "€")
        balance = module.FinanceSensor(coordinator, "entry", "household_balance", "", "€")
        payment = module.FinanceSensor(coordinator, "entry", "next_major_payment", "", "")

        self.assertEqual(income.native_value, 1200.0)
        self.assertEqual(expenses.native_value, 300.0)
        self.assertEqual(savings.native_value, 100.0)
        self.assertEqual(forecast.native_value, 1575.0)
        self.assertEqual(unresolved.native_value, 25.0)
        self.assertEqual(balance.native_value, 775.0)
        self.assertEqual(payment.native_value, "2026-09-30")
        self.assertEqual(payment._attr_device_class, module.SensorDeviceClass.DATE)


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
