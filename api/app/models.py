"""SQLAlchemy ORM models. Every operational row is store-scoped; money is Numeric (never float)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Money: exact decimal, 4 dp storage headroom (currency scale applied at serialization).
MONEY = Numeric(18, 4)
# Quantities: base units may be fractional under an explicit precision policy.
QTY = Numeric(18, 3)


class Base(DeclarativeBase):
    pass


class Store(Base):
    __tablename__ = "store"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    default_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    # Data version, bumped on committed imports.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Purchase-order document sequence (last used number).
    document_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class PurchasingPolicy(Base):
    __tablename__ = "purchasing_policy"

    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), primary_key=True
    )
    demand_window_days: Mapped[int] = mapped_column(Integer, nullable=False)
    target_days: Mapped[int] = mapped_column(Integer, nullable=False)
    safety_days: Mapped[int] = mapped_column(Integer, nullable=False)
    # Snapshot/sales older than today - freshness_days is stale.
    freshness_days: Mapped[int] = mapped_column(Integer, nullable=False)
    policy_version: Mapped[str] = mapped_column(String(40), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class StoreBudget(Base):
    __tablename__ = "store_budget"

    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), primary_key=True
    )
    currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)


class User(Base):
    __tablename__ = "user"  # reserved word — SQLAlchemy quotes the identifier.

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Membership(Base):
    __tablename__ = "membership"
    __table_args__ = (UniqueConstraint("store_id", "user_id", name="uq_membership_store_user"),)

    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(24), nullable=False, default="viewer")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Preference(Base):
    __tablename__ = "preference"

    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str | None] = mapped_column(String(16), nullable=True)
    display_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    date_format: Mapped[str | None] = mapped_column(String(32), nullable=True)
    number_format: Mapped[str | None] = mapped_column(String(32), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Product(Base):
    __tablename__ = "product"
    __table_args__ = (UniqueConstraint("store_id", "sku", name="uq_product_store_sku"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="Uncategorized")
    base_unit: Mapped[str] = mapped_column(String(16), nullable=False, default="each")
    quantity_precision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")


class Supplier(Base):
    __tablename__ = "supplier"
    __table_args__ = (UniqueConstraint("store_id", "code", name="uq_supplier_store_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String(200))
    document_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    # Supplier-level default lead time (informational; line lead time lives on terms).
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    # IANA weekday numbers 0=Mon..6=Sun; null = no delivery calendar on record.
    delivery_days: Mapped[list[Any] | None] = mapped_column(JSON)
    last_verified_at: Mapped[date | None] = mapped_column(Date)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class ProductSupplierTerms(Base):
    __tablename__ = "product_supplier_terms"
    __table_args__ = (
        UniqueConstraint("product_id", "supplier_id", name="uq_terms_product_supplier"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    # Price per base unit in the supplier's document currency.
    unit_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    purchase_pack_units: Mapped[int] = mapped_column(Integer, nullable=False)
    minimum_order_units: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    lead_time_value: Mapped[int] = mapped_column(Integer, nullable=False)
    lead_time_unit: Mapped[str] = mapped_column(String(20), nullable=False, default="calendarDays")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class StockSnapshot(Base):
    __tablename__ = "stock_snapshot"
    __table_args__ = (
        CheckConstraint(
            "(quantity IS NOT NULL)::int + (unknown_reason IS NOT NULL)::int = 1",
            name="ck_stock_exactly_one_of_quantity_or_reason",
        ),
        CheckConstraint("quantity IS NULL OR quantity >= 0", name="ck_stock_nonnegative"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[Decimal | None] = mapped_column(QTY)
    unknown_reason: Mapped[str | None] = mapped_column(Text)
    base_unit: Mapped[str] = mapped_column(String(16), nullable=False, default="each")
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    import_id: Mapped[str | None] = mapped_column(String(36))
    source_version: Mapped[str] = mapped_column(String(40), nullable=False, default="v1")


class SalesRecord(Base):
    __tablename__ = "sales_record"
    __table_args__ = (
        UniqueConstraint("store_id", "product_id", "business_date", name="uq_sales_product_date"),
        CheckConstraint("quantity_sold >= 0", name="ck_sales_nonnegative"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True
    )
    business_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    quantity_sold: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    source_key: Mapped[str | None] = mapped_column(String(120))
    import_id: Mapped[str | None] = mapped_column(String(36))
    source_version: Mapped[str] = mapped_column(String(40), nullable=False, default="v1")


class ImportJob(Base):
    __tablename__ = "import_job"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset: Mapped[str] = mapped_column(String(24), nullable=False)
    filename: Mapped[str] = mapped_column(String(260), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    source_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(16), nullable=False, default="v1")
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    commit_policy: Mapped[str] = mapped_column(String(24), nullable=False, default="atomic")
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    warning_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rejected_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mapping: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    # Normalized committable rows (valid + warning), [{row, productId, ...}].
    parsed_rows: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    resulting_version: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Commit outcome, stored so a replayed commit returns the original result.
    applied_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ImportIssue(Base):
    __tablename__ = "import_issue"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    import_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("import_job.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # null rowNumber = header-level issue.
    row_number: Mapped[int | None] = mapped_column(Integer)
    field: Mapped[str | None] = mapped_column(String(80))
    issue_code: Mapped[str] = mapped_column(String(60), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    value_preview: Mapped[str | None] = mapped_column(String(120))
    expected_format: Mapped[str | None] = mapped_column(String(160))
    correction_hint: Mapped[str | None] = mapped_column(String(240))


class Plan(Base):
    __tablename__ = "plan"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Calculation state is separate from review state (DATA-CONTRACTS).
    calculation_status: Mapped[str] = mapped_column(String(16), nullable=False, default="valid")
    review_status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    policy_version: Mapped[str] = mapped_column(String(40), nullable=False)
    source_versions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    explanation_source: Mapped[str] = mapped_column(
        String(24), nullable=False, default="rule-based"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    lines: Mapped[list[PlanLine]] = relationship(
        "PlanLine", order_by="PlanLine.position", lazy="selectin"
    )


class PlanLine(Base):
    __tablename__ = "plan_line"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("plan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    selected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    original_suggested_base_units: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    edited_base_units: Mapped[Decimal | None] = mapped_column(QTY)
    purchase_pack_units: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    # Cached snapshot; recomputed by trusted code on every recalculation.
    line_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    terms_version: Mapped[int] = mapped_column(Integer, nullable=False)
    rule_trace: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    constraint_results: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Approval(Base):
    __tablename__ = "approval"
    __table_args__ = (UniqueConstraint("plan_id", "plan_version", name="uq_approval_plan_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("plan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_version: Mapped[int] = mapped_column(Integer, nullable=False)
    content_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    source_versions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    terms_versions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    policy_version: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(80), nullable=False, default="owner")
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_warnings: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    # active: binds current plan version; stale: plan moved on; revoked: owner revoked.
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    revocation_reason: Mapped[str | None] = mapped_column(Text)


class PurchaseOrder(Base):
    __tablename__ = "purchase_order"
    __table_args__ = (
        UniqueConstraint("store_id", "display_number", name="uq_order_display_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    store_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    display_number: Mapped[str] = mapped_column(String(32), nullable=False)
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    # Immutable approved line snapshot (list of plain dicts).
    lines: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    item_subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    tax_treatment: Mapped[str] = mapped_column(String(24), nullable=False, default="excluded")
    shipping_treatment: Mapped[str] = mapped_column(String(24), nullable=False, default="excluded")
    approval_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("approval.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[str] = mapped_column(String(36), nullable=False)
    # approved: bound to an active approval; superseded: a newer approval exists; void: revoked.
    document_status: Mapped[str] = mapped_column(String(16), nullable=False, default="approved")
    supplier_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
