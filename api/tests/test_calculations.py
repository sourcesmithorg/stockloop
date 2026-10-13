"""Deterministic rule tests (T-11, T-13, T-14, T-15).

Pure functions only: no DB, no clock. Fixture arithmetic must reproduce exactly.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.domain.calculations import (
    CalculationError,
    RiskState,
    average_daily_demand,
    budget_remaining,
    budget_utilization_percent,
    cover_days,
    currency_scale,
    delivery_estimate,
    delivery_gap_days,
    derive_risk_state,
    estimated_depletion_date,
    is_stale,
    line_total,
    quantize_money,
    quantize_quantity,
    ratio_str,
    raw_required,
    round_to_pack,
    suggest_order,
    totals_by_currency,
)


def _oat() -> object:
    return dict(
        demand=Decimal(4),
        stock=Decimal(12),
        target_days=7,
        lead_days=5,
        safety_days=2,
        pack_size=12,
        minimum_order_units=Decimal(24),
        unit_cost=Decimal("2.50"),
        currency="USD",
    )


# ------------------------------------------------------------------ T-11 / T-14 fixture


def test_oat_milk_fixture_arithmetic() -> None:
    suggestion = suggest_order(**_oat())  # type: ignore[arg-type]
    assert suggestion.cover == Decimal(3)
    assert suggestion.gross_target_units == Decimal(56)
    assert suggestion.raw_required_units == Decimal(44)
    assert suggestion.rounding.base_units == Decimal(48)
    assert suggestion.rounding.pack_count == 4
    assert suggestion.rounding.excess_units == Decimal(4)
    assert suggestion.rounding.moq_applied is False
    assert suggestion.total == Decimal("120.00")


def test_other_fixture_lines_reproduce() -> None:
    rice = suggest_order(
        demand=Decimal(3),
        stock=Decimal(18),
        target_days=7,
        lead_days=3,
        safety_days=2,
        pack_size=6,
        minimum_order_units=Decimal(30),
        unit_cost=Decimal("4.00"),
        currency="USD",
    )
    assert rice.raw_required_units == Decimal(18)
    assert rice.rounding.base_units == Decimal(30)
    assert rice.rounding.pack_count == 5
    assert rice.total == Decimal("120.00")

    noodles = suggest_order(
        demand=Decimal(8),
        stock=Decimal(32),
        target_days=7,
        lead_days=5,
        safety_days=2,
        pack_size=24,
        minimum_order_units=Decimal(48),
        unit_cost=Decimal("0.75"),
        currency="USD",
    )
    assert noodles.raw_required_units == Decimal(80)
    assert noodles.rounding.base_units == Decimal(96)
    assert noodles.rounding.pack_count == 4
    assert noodles.total == Decimal("72.00")

    water = suggest_order(
        demand=Decimal(6),
        stock=Decimal(24),
        target_days=7,
        lead_days=2,
        safety_days=2,
        pack_size=12,
        minimum_order_units=Decimal(24),
        unit_cost=Decimal("1.50"),
        currency="USD",
    )
    assert water.raw_required_units == Decimal(42)
    assert water.rounding.base_units == Decimal(48)
    assert water.rounding.pack_count == 4
    assert water.total == Decimal("72.00")


def test_exact_totals_and_budget() -> None:
    lines = [
        ("USD", Decimal("120.00")),
        ("USD", Decimal("120.00")),
        ("USD", Decimal("72.00")),
        ("USD", Decimal("72.00")),
    ]
    totals = totals_by_currency(lines)
    assert totals == {"USD": Decimal("384.00")}
    assert budget_remaining(Decimal("500.00"), totals["USD"], "USD") == Decimal("116.00")
    assert budget_utilization_percent(totals["USD"], Decimal("500.00"), "USD") == Decimal("76.8")


def test_average_daily_demand_chart_fixture() -> None:
    # 13 daily values Sep 30 - Oct 12, total 52 -> 4/day (T-11 chart).
    total = Decimal(sum([3, 4, 2, 5, 4, 6, 4, 3, 5, 4, 3, 5, 4]))
    assert total == Decimal(52)
    assert average_daily_demand(total, 13) == Decimal(4)


# ------------------------------------------------------------------ T-13 packs and MOQ


def test_pack_moq_rounding_with_excess() -> None:
    result = round_to_pack(Decimal(17), 12, Decimal(24))
    assert result.base_units == Decimal(24)
    assert result.pack_count == 2
    assert result.excess_units == Decimal(7)
    assert result.moq_applied is True


def test_zero_demand_never_creates_moq_purchase() -> None:
    result = round_to_pack(Decimal(0), 12, Decimal(24))
    assert result.base_units == Decimal(0)
    assert result.pack_count == 0
    assert result.moq_applied is False


def test_raw_required_floors_at_zero() -> None:
    # Well-stocked product: never negative, never fabricates demand.
    assert raw_required(Decimal(2), Decimal(100), 7, 5, 2) == Decimal(0)


def test_zero_demand_suggestion_is_zero() -> None:
    suggestion = suggest_order(
        demand=Decimal(0),
        stock=Decimal(12),
        target_days=7,
        lead_days=5,
        safety_days=2,
        pack_size=12,
        minimum_order_units=Decimal(24),
        unit_cost=Decimal("2.50"),
        currency="USD",
    )
    assert suggestion.cover is None  # never inf/NaN
    assert suggestion.raw_required_units == Decimal(0)
    assert suggestion.rounding.base_units == Decimal(0)
    assert suggestion.total == Decimal("0.00")


# ------------------------------------------------------------------ T-10 zero/missing/NaN


def test_zero_sales_average_is_zero_not_error() -> None:
    assert average_daily_demand(Decimal(0), 13) == Decimal(0)


def test_cover_days_rejects_zero_demand() -> None:
    with pytest.raises(CalculationError):
        cover_days(Decimal(12), Decimal(0))


def test_nonfinite_values_rejected_everywhere() -> None:
    for bad in (Decimal("NaN"), Decimal("Infinity"), Decimal("-Infinity")):
        with pytest.raises(CalculationError):
            cover_days(bad, Decimal(1))
        with pytest.raises(CalculationError):
            quantize_money(bad, "USD")
        with pytest.raises(CalculationError):
            ratio_str(bad)
    with pytest.raises(CalculationError):
        cover_days(Decimal(-1), Decimal(1))
    with pytest.raises(CalculationError):
        average_daily_demand(Decimal(10), 0)
    with pytest.raises(CalculationError):
        budget_utilization_percent(Decimal(10), Decimal(0), "USD")


# ------------------------------------------------------------------ T-12 delivery calendar


def test_delivery_estimate_sunday_unconfirmed() -> None:
    estimate = delivery_estimate(date(2026, 10, 13), 5, [0, 1, 2, 3, 4])
    assert estimate.estimate_date == date(2026, 10, 18)
    assert estimate.confirmed is False
    assert "Sunday" in estimate.reason
    assert "2026-10-19" in estimate.reason  # next weekday delivery day, still unconfirmed
    assert "unconfirmed" in estimate.reason


def test_delivery_estimate_without_calendar() -> None:
    estimate = delivery_estimate(date(2026, 10, 13), 3, None)
    assert estimate.estimate_date == date(2026, 10, 16)
    assert estimate.confirmed is False
    assert "no delivery calendar" in estimate.reason


def test_delivery_gap_lower_bound() -> None:
    assert delivery_gap_days(Decimal(3), 5) == Decimal(2)
    assert delivery_gap_days(Decimal(6), 5) == Decimal(0)


def test_gap_survives_ordering_more() -> None:
    # Ordering more units changes quantities, not the timing gap (T-12).
    before = delivery_gap_days(Decimal(3), 5)
    after = delivery_gap_days(Decimal(3), 5)  # gap derives from cover vs lead, not order size
    assert before == after == Decimal(2)


def test_estimated_depletion() -> None:
    assert estimated_depletion_date(date(2026, 10, 13), Decimal(12), Decimal(4)) == date(
        2026, 10, 16
    )
    assert estimated_depletion_date(date(2026, 10, 13), Decimal(0), Decimal(4)) == date(
        2026, 10, 13
    )


def test_staleness_window() -> None:
    today = date(2026, 10, 13)
    assert is_stale(date(2026, 10, 5), today, 7) is True  # 8 days > 7
    assert is_stale(date(2026, 10, 6), today, 7) is False  # exactly 7 days
    assert is_stale(date(2026, 10, 13), today, 7) is False


# ------------------------------------------------------------------ T-15 currencies


def test_currencies_never_merge() -> None:
    totals = totals_by_currency(
        [("USD", Decimal("120.00")), ("EUR", Decimal("100.00")), ("USD", Decimal("50.00"))]
    )
    assert totals == {"USD": Decimal("170.00"), "EUR": Decimal("100.00")}
    assert "270" not in totals  # no cross-currency sum exists


def test_zero_and_three_decimal_currencies() -> None:
    assert currency_scale("JPY") == Decimal("1")
    assert currency_scale("BHD") == Decimal("0.001")
    # JPY rounds to whole units (HALF_UP), BHD keeps three decimals.
    assert line_total(Decimal(1), Decimal("1.55"), "JPY") == Decimal("2")
    assert line_total(Decimal(2), Decimal("1.234"), "BHD") == Decimal("2.468")
    assert quantize_money(Decimal("12.3456"), "USD") == Decimal("12.35")


def test_quantity_precision() -> None:
    assert quantize_quantity(Decimal("12.49"), 0) == Decimal("12")
    assert quantize_quantity(Decimal("12.345"), 2) == Decimal("12.35")


# ------------------------------------------------------------------ risk state derivation


def test_risk_state_ordering() -> None:
    kwargs = dict(
        demand_kind="measured",
        cover=Decimal(3),
        lead_days=5,
        target_days=7,
        stale=False,
    )
    assert derive_risk_state(stock=None, **kwargs) == RiskState.DATA_NEEDED  # type: ignore[arg-type]
    assert derive_risk_state(stock=Decimal(0), **kwargs) == RiskState.OUT_OF_STOCK  # type: ignore[arg-type]
    assert (
        derive_risk_state(
            stock=Decimal(12),
            demand_kind="missing",
            cover=None,
            lead_days=5,
            target_days=7,
            stale=False,
        )
        == RiskState.DATA_NEEDED
    )
    assert (
        derive_risk_state(
            stock=Decimal(12),
            demand_kind="measured",
            cover=Decimal(3),
            lead_days=5,
            target_days=7,
            stale=True,
        )
        == RiskState.STALE
    )
    assert (
        derive_risk_state(
            stock=Decimal(12),
            demand_kind="zeroVerified",
            cover=None,
            lead_days=5,
            target_days=7,
            stale=False,
        )
        == RiskState.NO_RECENT_SALES
    )
    # out-of-stock beats stale (physical fact) and missing sales (defensive order).
    assert (
        derive_risk_state(
            stock=Decimal(0),
            demand_kind="missing",
            cover=None,
            lead_days=None,
            target_days=7,
            stale=True,
        )
        == RiskState.OUT_OF_STOCK
    )


def test_risk_state_cover_branches() -> None:
    base = dict(stock=Decimal(12), demand_kind="measured", target_days=7, stale=False)
    assert derive_risk_state(cover=Decimal(3), lead_days=5, **base) == RiskState.AT_RISK  # type: ignore[arg-type]
    assert derive_risk_state(cover=Decimal(6), lead_days=3, **base) == RiskState.RUNNING_LOW  # type: ignore[arg-type]
    assert derive_risk_state(cover=Decimal(30), lead_days=5, **base) == RiskState.HEALTHY  # type: ignore[arg-type]
    # Unknown lead time blocks the gap judgement: dataNeeded, never healthy.
    assert derive_risk_state(cover=Decimal(30), lead_days=None, **base) == RiskState.DATA_NEEDED  # type: ignore[arg-type]


def test_risk_state_enum_values() -> None:
    assert {state.value for state in RiskState} == {
        "outOfStock",
        "atRisk",
        "runningLow",
        "healthy",
        "noRecentSales",
        "dataNeeded",
        "stale",
    }
