"""Constants for the Finanzplaner Home Assistant integration."""

DOMAIN = "finanzplaner"
STORAGE_VERSION = 2
STORAGE_KEY = f"{DOMAIN}.data"
PANEL_URL = DOMAIN
PLATFORMS = ["sensor"]

CONF_HOUSEHOLD_NAME = "household_name"
DEFAULT_HOUSEHOLD_NAME = "Gemeinsamer Haushalt"


def panel_static_path(version: str) -> str:
    """Return a release-scoped URL root for cached panel modules."""

    return f"/api/{DOMAIN}/static/{version}"
