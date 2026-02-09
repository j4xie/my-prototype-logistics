"""
Global Configuration - Shared across all Python modules

This file provides a unified configuration interface for all Python services.
The actual settings are defined in smartbi/config.py for historical reasons,
but should be accessed through this module for cross-module usage.

Usage:
    from config import get_settings, Settings

    settings = get_settings()
    print(settings.llm_model)
"""
from __future__ import annotations

# Re-export all settings from smartbi.config
# This maintains backward compatibility while providing a clean global interface
from smartbi.config import Settings, get_settings

__all__ = ['Settings', 'get_settings']
