"""Pydantic schemas and response models for ForestGuard AI FastAPI Backend."""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class BaseEnvelope(BaseModel):
    """Standard envelope included in every API response."""
    model: str = Field(description="Name and version of served ML model")
    weather_source: Literal["live", "forecast", "cached", "none"] = Field(description="Weather data origin")
    generated_at: str = Field(description="ISO timestamp of payload generation")
    status: Literal["ok", "degraded", "error", "live", "cached", "not_configured"] = Field(
        description="Operational status"
    )
    cache_age_hours: Optional[float] = Field(
        default=None, description="Age of the cached forecast in hours if cached data is served"
    )
    static_cache_age_hours: Optional[float] = Field(
        default=None, description="Age of the static cache file on disk in hours"
    )
    stale: bool = Field(
        default=False, description="True if cache is older than 24 hours or past dates were expired"
    )


class HealthResponse(BaseEnvelope):
    """Health check response."""
    status: Literal["ok", "degraded", "error"] = Field(description="System health status: ok, degraded, or error")
    model_name: str
    model_loaded: bool
    weather_source: Literal["live", "cached", "none"] = Field(description="Current weather source status")
    cache_state: Dict[str, Any] = Field(description="Detailed cache telemetry and staleness indicators")


class ZoneDetail(BaseModel):
    """District zone detail including geographic boundary and lowland caveat."""
    name: str
    district: str
    centroid: List[float] = Field(description="[latitude, longitude]")
    elevation: float = Field(description="District elevation in meters")
    bbox: List[float] = Field(description="[min_lon, min_lat, max_lon, max_lat]")
    caveat: Optional[str] = Field(default=None, description="Caveat for agricultural lowland districts")
    geometry: Dict[str, Any] = Field(description="GeoJSON Polygon/MultiPolygon geometry")


class ZonesResponse(BaseEnvelope):
    """Response containing all 13 Uttarakhand district zones."""
    count: int
    zones: List[ZoneDetail]


class PredictRequest(BaseModel):
    """Request payload for /predict endpoint.
    Accepts either an explicit 33-feature dictionary OR raw weather history buffer records.
    """
    district: Optional[str] = Field(default="Nainital", description="District name")
    features: Optional[Dict[str, float]] = Field(default=None, description="Precomputed 33 feature values")
    history_records: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Past daily weather records (up to 90 days)"
    )
    today_record: Optional[Dict[str, Any]] = Field(default=None, description="Observation day weather record")


class KeyCondition(BaseModel):
    """Explainable physical condition indicator (heuristic, not model attribution)."""
    factor: str
    label: str
    value: float
    unit: str
    impact: Literal["high", "moderate", "low"]
    description: str


class PredictResponse(BaseEnvelope):
    """Prediction response for a single district."""
    district: str
    probability: float = Field(description="Predicted ignition probability for day t+1")
    risk_level: str = Field(description="Categorical risk tier: Low, Medium, High, Extreme")
    decision_threshold: float = Field(description="Operating decision threshold (tau*)")
    key_conditions: List[KeyCondition] = Field(
        description="Physical and meteorological conditions (heuristic, not model attribution)"
    )
    caveat: Optional[str] = Field(default=None, description="Caveat if agricultural lowland district")


class ForecastDay(BaseModel):
    """Daily forecast fire risk item.
    Crucial: risk_for_date corresponds to weather_date + 1 day.
    """
    weather_date: str = Field(description="Date when weather conditions are observed (day t)")
    risk_for_date: str = Field(description="Target date for which fire risk applies (day t+1)")
    lead_days: int = Field(description="Forecast lead time in days from current date")
    probability: float = Field(description="Predicted fire probability for risk_for_date")
    risk_level: str = Field(description="Low, Medium, High, or Extreme")
    key_inputs: Dict[str, float] = Field(description="Key daily weather and moisture measurements")
    reliability_note: Optional[str] = Field(
        default=None,
        description="Reliability note (numerical forecast uncertainty increases beyond 48 hours for days 3-7)",
    )
    expired: bool = Field(default=False, description="True if risk_for_date is in the past")


class DistrictForecast(BaseModel):
    """Forecast across upcoming days for a single district."""
    district: str
    caveat: Optional[str] = None
    mixed_agricultural: bool = Field(
        default=False, description="True for mixed agricultural lowland districts (Haridwar, Udham Singh Nagar)"
    )
    centroid: List[float]
    elevation: float
    forecast: List[ForecastDay]


class ForecastResponse(BaseEnvelope):
    """Multi-district forecast response for upcoming days."""
    days: int
    count: int
    districts: List[DistrictForecast]


class FireDetection(BaseModel):
    """Active fire detection record proxied from NASA FIRMS."""
    latitude: float
    longitude: float
    brightness: Optional[float] = None
    scan: Optional[float] = None
    track: Optional[float] = None
    acq_date: str
    acq_time: str
    satellite: Optional[str] = None
    confidence: Optional[str] = None
    version: Optional[str] = None
    bright_t31: Optional[float] = None
    bright_ti4: Optional[float] = None
    frp: Optional[float] = None
    daynight: Optional[str] = None


class FiresResponse(BaseEnvelope):
    """Active fires response from NASA FIRMS proxy."""
    hours: int
    count: int
    bbox: List[float]
    fires: List[FireDetection]


class ModelMetricsResponse(BaseEnvelope):
    """Metrics and evaluation bundle record."""
    model_name: str
    architecture: str
    selection_criterion: str
    validation_metrics: Dict[str, Any]
    risk_thresholds: Dict[str, Any]
    metrics_summary: Dict[str, Any]
    report_urls: Dict[str, str]
