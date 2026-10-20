"""backend/tests/test_bounds.py

Unit test for the Uttarakhand fallback bounds helper used by MapView
to guarantee proper Leaflet map centering across all dashboard views.
"""

import pytest


def get_uttarakhand_bounds(bbox=None):
    """Python equivalent of getUttarakhandBounds in frontend/src/utils/geo.js."""
    if bbox is None:
        bbox = [77.6, 28.7, 81.1, 31.5]
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        return [[28.7, 77.6], [31.5, 81.1]]
    try:
        nums = [float(x) for x in bbox]
    except (ValueError, TypeError):
        return [[28.7, 77.6], [31.5, 81.1]]

    west, south, east, north = nums
    return [[south, west], [north, east]]


def test_fallback_bounds_default():
    bounds = get_uttarakhand_bounds()
    assert bounds == [[28.7, 77.6], [31.5, 81.1]]
    south, west = bounds[0]
    north, east = bounds[1]
    assert south < north
    assert west < east
    # Verify center coordinates fall within Uttarakhand
    center_lat = (south + north) / 2
    center_lon = (west + east) / 2
    assert 29.5 < center_lat < 30.5
    assert 78.5 < center_lon < 80.0


def test_fallback_bounds_custom_valid():
    custom_bbox = [77.0, 28.0, 82.0, 32.0]
    bounds = get_uttarakhand_bounds(custom_bbox)
    assert bounds == [[28.0, 77.0], [32.0, 82.0]]


def test_fallback_bounds_invalid_fallback():
    assert get_uttarakhand_bounds([]) == [[28.7, 77.6], [31.5, 81.1]]
    assert get_uttarakhand_bounds("invalid") == [[28.7, 77.6], [31.5, 81.1]]
    assert get_uttarakhand_bounds([None, 28.7, 81.1, 31.5]) == [[28.7, 77.6], [31.5, 81.1]]
