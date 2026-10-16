"""Deterministic purchasing rules.

Pure functions only: no I/O, no clock reads, no floats for money. Every input is
validated so unknown/zero/negative/NaN states propagate as explicit branches and
never as inf/NaN numbers or fabricated "healthy" states.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from enum import StrEnum

# Display scales for ratios/percentages (not money).
_RATIO_SCALE = Decimal("0.01")
_PERCENT_SCALE = Decimal("0.1")

# ponytail: small currency table; extend when more zero-/three-decimal currencies ship.
CURRENCY_SCALES: dict[str, int] = {
    "USD": 2,
    "EUR": 2,
    "GBP": 2,
    "IDR": 2,
    "JPY": 0,
    "BHD": 3,
    "KWD": 3,
    "TND": 3,
}


class RiskState(StrEnum):
    OUT_OF_STOCK = "outOfStock"
    AT_RISK = "atRisk"
    RUNNING_LOW = "runningLow"
    HEALTHY = "healthy"
    NO_RECENT_SALES = "noRecentSales"
    DATA_NEEDED = "dataNeeded"
    STALE = "stale"


class CalculationError(ValueError):
    """Invalid calculation input (non-finite, non-positive, wrong unit...)."""


def currency_scale(currency: str) -> Decimal:
    exponent = CURRENCY_SCALES.get(currency.upper(), 2)
    return Decimal(1).scaleb(-exponent)


def require_finite_nonnegative(value: Decimal, name: str) -> Decimal:
    if not isinstance(value, Decimal):
        raise CalculationError(f"{name} must be a Decimal")
    if not value.is_finite():
        raise CalculationError(f"{name} must be finite, got {value}")
    if value < 0:
        raise CalculationError(f"{name} must be non-negative, got {value}")
    return value


def quantize_money(value: Decimal, currency: str) -> Decimal:
    require_finite_nonnegative(value, "money")
    return value.quantize(currency_scale(currency), rounding=ROUND_HALF_UP)


def money_str(value: Decimal, currency: str) -> str:
    return str(quantize_money(value, currency))


def ratio(value: Decimal) -> Decimal:
    """Display precision for derived ratios: 2 dp HALF_UP, trailing zeros trimmed."""
    if not value.is_finite():
        raise CalculationError(f"ratio must be finite, got {value}")
    trimmed = value.quantize(_RATIO_SCALE, rounding=ROUND_HALF_UP).normalize()
    # normalize() can flip 30 into 3E+1; a serialized decimal must render as
    # digits (fixed-point), never exponent notation.
    return Decimal(format(trimmed, "f"))


def ratio_str(value: Decimal) -> str:
    """Serialize a derived ratio: 2 dp, trailing zeros trimmed (4 -> '4', 3.555 -> '3.56')."""
    return str(ratio(value))


def quantize_quantity(value: Decimal, precision: int) -> Decimal:
    """Base-unit quantity at the product's approved precision (0 -> integer each)."""
    require_finite_nonnegative(value, "quantity")
    if precision < 0:
        raise CalculationError("quantity precision must be >= 0")
    return value.quantize(Decimal(1).scaleb(-precision), rounding=ROUND_HALF_UP)


def average_daily_demand(total: Decimal, covered_days: int) -> Decimal:
    """Average base units per covered day. Verified zero is a real value, not an error."""
    require_finite_nonnegative(total, "sales total")
    if covered_days <= 0:
        raise CalculationError("covered_days must be positive")
    if total == 0:
        return Decimal(0)
    return total / Decimal(covered_days)


def cover_days(stock: Decimal, demand: Decimal) -> Decimal:
    """Days of stock at the current demand rate.

    Zero demand never divides: callers must branch on the verified-zero-sales
    state first, so inf/NaN is structurally impossible.
    """
    require_finite_nonnegative(stock, "stock")
    require_finite_nonnegative(demand, "demand")
    if demand == 0:
        raise CalculationError("demand is zero: use the noRecentSales branch, not a number")
    return stock / demand


def estimated_depletion_date(as_of: date, stock: Decimal, demand: Decimal) -> date:
    """Calendar date stock hits zero: as_of + ceil(cover) days; stock 0 depletes same day."""
    require_finite_nonnegative(stock, "stock")
    if stock == 0:
        return as_of
    cover = cover_days(stock, demand)
    days = int(cover.to_integral_value(rounding=ROUND_CEILING))
    return as_of + timedelta(days=days)


@dataclass(frozen=True)
class DeliveryEstimate:
    estimate_date: date
    # Calendar-derived estimates are never confirmed supplier slots (AI-CONTRACT/DATA-CONTRACTS).
    confirmed: bool
    reason: str


def delivery_estimate(
    order_date: date, lead_days: int, delivery_weekdays: Sequence[int] | None
) -> DeliveryEstimate:
    """Calendar-day lower-bound estimate; weekday-only calendars are respected in the reason."""
    if lead_days < 0:
        raise CalculationError("lead_days must be >= 0")
    if any(day < 0 or day > 6 for day in delivery_weekdays or []):
        raise CalculationError("delivery weekdays must be 0..6 (Mon..Sun)")
    estimate = order_date + timedelta(days=lead_days)
    bound = f"calendar lower bound: {lead_days} days from {order_date.isoformat()}"
    if delivery_weekdays is None:
        reason = (
            f"{bound}; supplier has no delivery calendar on record — unconfirmed estimate, "
            "not a supplier slot."
        )
    elif estimate.weekday() in delivery_weekdays:
        reason = f"{bound}; falls on a delivery day — unconfirmed estimate, not a supplier slot."
    else:
        shifted = estimate
        while shifted.weekday() not in delivery_weekdays:
            shifted += timedelta(days=1)
        reason = (
            f"{bound}; {estimate.isoformat()} is a {estimate.strftime('%A')}, outside the "
            f"supplier's delivery days (next possible day {shifted.isoformat()}) — "
            "unconfirmed estimate, not a supplier slot."
        )
    return DeliveryEstimate(estimate_date=estimate, confirmed=False, reason=reason)


def delivery_gap_days(cover: Decimal, lead_days: int) -> Decimal:
    """Lower-bound gap between stock cover and lead time; 0 when cover covers the lead."""
    require_finite_nonnegative(cover, "cover")
    if lead_days < 0:
        raise CalculationError("lead_days must be >= 0")
    gap = Decimal(lead_days) - cover
    return gap if gap > 0 else Decimal(0)


def raw_required(
    demand: Decimal, stock: Decimal, target_days: int, lead_days: int, safety_days: int
) -> Decimal:
    """max(0, d*(T+L+B) - S). T is additional post-arrival coverage (CALCULATION-RULES)."""
    require_finite_nonnegative(demand, "demand")
    require_finite_nonnegative(stock, "stock")
    if min(target_days, lead_days, safety_days) < 0:
        raise CalculationError("horizon days must be >= 0")
    gross = demand * Decimal(target_days + lead_days + safety_days)
    net = gross - stock
    return net if net > 0 else Decimal(0)


@dataclass(frozen=True)
class PackRounding:
    base_units: Decimal
    pack_count: int
    pack_size: int
    excess_units: Decimal  # rounded units above raw demand (the "why 7 extra?" answer)
    moq_applied: bool


def round_to_pack(raw: Decimal, pack_size: int, minimum_order_units: Decimal) -> PackRounding:
    """P x ceil(max(raw, MOQ)/P). Zero raw demand never triggers an MOQ purchase."""
    require_finite_nonnegative(raw, "raw demand")
    require_finite_nonnegative(minimum_order_units, "MOQ")
    if pack_size <= 0:
        raise CalculationError("pack_size must be positive")
    if raw == 0:
        return PackRounding(
            base_units=Decimal(0),
            pack_count=0,
            pack_size=pack_size,
            excess_units=Decimal(0),
            moq_applied=False,
        )
    required = max(raw, minimum_order_units)
    packs = int((required / Decimal(pack_size)).to_integral_value(rounding=ROUND_CEILING))
    units = Decimal(packs * pack_size)
    return PackRounding(
        base_units=units,
        pack_count=packs,
        pack_size=pack_size,
        excess_units=units - raw,
        moq_applied=required > raw,
    )


def line_total(units: Decimal, unit_cost: Decimal, currency: str) -> Decimal:
    """Exact money: units x unit cost, quantized to the currency scale (HALF_UP)."""
    require_finite_nonnegative(units, "units")
    require_finite_nonnegative(unit_cost, "unit cost")
    return quantize_money(units * unit_cost, currency)


def totals_by_currency(lines: Sequence[tuple[str, Decimal]]) -> dict[str, Decimal]:
    """Sum per ISO currency. Currencies are never merged into one number."""
    totals: dict[str, Decimal] = {}
    for currency, total in lines:
        require_finite_nonnegative(total, "line total")
        code = currency.upper()
        totals[code] = totals.get(code, Decimal(0)) + total
    return {code: quantize_money(total, code) for code, total in totals.items()}


def budget_remaining(budget: Decimal, total: Decimal, currency: str) -> Decimal:
    require_finite_nonnegative(budget, "budget")
    require_finite_nonnegative(total, "total")
    return quantize_money(budget - total, currency)


def budget_utilization_percent(total: Decimal, budget: Decimal, currency: str) -> Decimal:
    """total/budget as a percentage, 1 dp. Budget 0 or missing is an error, never inf."""
    require_finite_nonnegative(total, "total")
    require_finite_nonnegative(budget, "budget")
    if budget == 0:
        raise CalculationError("budget is zero: utilization unavailable")
    percent = (total / budget) * Decimal(100)
    return percent.quantize(_PERCENT_SCALE, rounding=ROUND_HALF_UP)


def is_stale(last_source_date: date, today: date, freshness_days: int) -> bool:
    """Source data older than the freshness window needs revalidation."""
    if freshness_days < 0:
        raise CalculationError("freshness_days must be >= 0")
    return (today - last_source_date).days > freshness_days


def derive_risk_state(
    *,
    stock: Decimal | None,
    demand_kind: str,
    cover: Decimal | None,
    lead_days: int | None,
    target_days: int,
    stale: bool,
) -> RiskState:
    """Risk is business policy (T-10): unknown beats stale beats zero-sales beats cover.

    Order: unknown stock -> dataNeeded; stock 0 -> outOfStock (physical fact);
    missing sales -> dataNeeded; stale source -> stale; verified zero sales ->
    noRecentSales; cover below lead -> atRisk; below target+lead -> runningLow;
    else healthy. lead_days unknown also means dataNeeded (gap cannot be judged).
    """
    if stock is None:
        return RiskState.DATA_NEEDED
    if stock == 0:
        return RiskState.OUT_OF_STOCK
    if demand_kind == "missing":
        return RiskState.DATA_NEEDED
    if stale:
        return RiskState.STALE
    if demand_kind == "zeroVerified":
        return RiskState.NO_RECENT_SALES
    if cover is None:
        return RiskState.DATA_NEEDED
    if lead_days is None:
        return RiskState.DATA_NEEDED
    if cover < Decimal(lead_days):
        return RiskState.AT_RISK
    if cover < Decimal(target_days + lead_days):
        return RiskState.RUNNING_LOW
    return RiskState.HEALTHY


@dataclass(frozen=True)
class Suggestion:
    """Result of the deterministic restock formula for one product line."""

    demand: Decimal
    # None when demand is verified zero: no finite cover exists (never inf).
    cover: Decimal | None
    gross_target_units: Decimal
    raw_required_units: Decimal
    rounding: PackRounding
    total: Decimal


def suggest_order(
    *,
    demand: Decimal,
    stock: Decimal,
    target_days: int,
    lead_days: int,
    safety_days: int,
    pack_size: int,
    minimum_order_units: Decimal,
    unit_cost: Decimal,
    currency: str,
) -> Suggestion:
    """Full pipeline: cover -> gross target -> raw requirement -> pack/MOQ rounding -> total."""
    cover = cover_days(stock, demand) if demand > 0 else None
    gross = demand * Decimal(target_days + lead_days + safety_days)
    raw = raw_required(demand, stock, target_days, lead_days, safety_days)
    rounding = round_to_pack(raw, pack_size, minimum_order_units)
    total = line_total(rounding.base_units, unit_cost, currency)
    return Suggestion(
        demand=demand,
        cover=cover,
        gross_target_units=gross,
        raw_required_units=raw,
        rounding=rounding,
        total=total,
    )
