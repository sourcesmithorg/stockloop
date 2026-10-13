# Deterministic purchasing rules

Status: **PROPOSED policy, not implemented logic**. The fixture arithmetic below is verified. The owner must approve the production formula, demand window, sales coverage, calendar interpretation and constraints before a local agent makes these rules authoritative.

## Separation of meanings

Observed values: stock snapshot, recorded sales, validated supplier cost/pack/MOQ.
Derived values: average demand, cover, target requirement, rounded suggestion, subtotal.
Policy values: demand window, target/safety horizon, ordering cadence, priority thresholds, budget treatment.
Unresolved values: missing history, unconfirmed delivery calendar, excluded shipping/tax.

Render these categories separately. AI explanations do not change their authority.

## Proposed simple baseline formula

Let `d` be average base units sold per covered day, `S` known stock, `L` approved lead-time days, `T` target coverage days, `B` safety days, `P` pack size and `M` minimum order units.

```text
coverDays = S / d                         only when d > 0 and stock/history are valid
rawRequired = max(0, d × (T + L + B) - S)
if rawRequired == 0:
  suggestedUnits = 0                     do not buy solely because an MOQ exists
else:
  suggestedUnits = P × ceil(max(rawRequired, M) / P)
packs = suggestedUnits / P
lineTotal = exactMoney(suggestedUnits × unitCostPerBaseUnit)
```

This is intentionally simple and matches the oat-milk fixture. It may double-count horizon under a different definition of target coverage. Therefore define T as additional post-arrival coverage for this candidate formula, or choose another formula explicitly. Do not quietly change interpretation across screens.

Before calculation: validate d/S/P/M/cost precision, units, currency and lead-time semantics. If d is unavailable, output `estimateUnavailable`. If d is verified zero, output `noRecentSales`, not infinity. Negative/nonfinite values fail validation. Stock below zero, returns and unit conversions need approved policy.

## Fixture arithmetic, not a complete demand model

Oat milk: S=12, d=4, T=7, L=5, B=2, P=12, M=24.

Gross target: 4 × (7+5+2) = 56. Raw requirement: 56−12 = 44. Rounded purchase: 12 × ceil(max(44,24)/12) = 48 units = four cases. Cost: 48 × USD 2.50 = USD 120. Cover: 12/4 = three days.

Oat-milk chart: 13 daily values `[3,4,2,5,4,6,4,3,5,4,3,5,4]`, total 52, average 4. The tiny sample CSV is not the full chart dataset.

Other fixture lines are author-written values, not proven outputs of one global formula: rice 30 at 4.00=120, noodles 96 at 0.75=72, water 48 at 1.50=72. The local agent must not invent formula derivations for those rows. Preserve them as test fixtures or generate complete inputs under the approved model.

## Lead time and delivery gaps

A calendar-only lower-bound estimate can compare stock cover with lead time. It does not determine a confirmed delivery date. Supplier weekdays, cutoffs, holidays, business-day conventions and store timezone must be applied under an approved calendar policy.

Oct 13, 2026 + five calendar days = Sunday Oct 18. Freshfield's regular delivery window is Monday–Friday. The fixture says unconfirmed; actual gap may exceed two days. Ordering extra cannot make goods arrive earlier. Never label a calendar estimate “earliest regular delivery” until availability/calendar logic supports it.

Proposed gap branches: finite lower-bound gap; confirmed-calendar gap; unavailable estimate. Label which one the UI shows.

## Pack and MOQ

Units versus packs must remain visible. If raw demand=17, pack=12 and MOQ=24, suggested quantity=24, packs=2, extra above raw demand=7. The UI explains rounding and price impact. If demand=0, do not create a 24-unit order automatically.

Edited quantities either must be pack multiples or trigger an explicit rounding confirmation under D-11. Never silently round the owner's input after they approve it. Supplier minimum order value and per-SKU MOQ are different constraints; do not conflate them.

## Budget and currencies

USD fixture: total384, budget500, remaining116, utilization76.8%. Freshfield240 plus DailyGoods144 equals384. Shipping/tax are outside the fixture total, not zero-cost components.

For a shortage, show selected total, budget, shortfall, excluded items and risk that remains. Do not silently discard products to make the budget look satisfied. Deterministic optimization is a separate approved feature.

Keep budget totals by currency. USD120 plus EUR100 is not220 in any trusted budget. Conversion requires source/rate/time/rounding and policy; until then block or review currencies separately. Currency preference changes must never relabel old amounts.

## Rounding and precision

Use exact decimals or validated currency-aware minor units. Calculate per approved price/base-unit precision, then round according to the accepted document policy. Sum line values consistently; display values cannot disagree with exported values. Avoid binary floating-point artifacts. Zero-, two- and three-decimal currencies need test fixtures.

## Approval and recalculation

Any relevant quantity, cost, pack, supplier, budget, source or policy change creates a new plan version and revalidates constraints. It makes affected approvals stale. Recomputed totals are trusted only once calculation is valid. A pending or failed calculation cannot inherit old eligibility.

## Required tests

T-11 through T-15 and T-19/T-21 cover zero/missing demand, calendar gaps, pack/MOQ, exact totals, mixed currencies and invalidated approvals. Add boundary/property tests for nonnegative outputs, pack divisibility, currency separation and unknown propagation. Policy-specific expected values must be recorded when D-06–D-12 are resolved.
