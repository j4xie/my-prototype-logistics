"""Bronze adapter base types.

RawEvent + BronzeAdapter define the contract between "upstream format"
(Excel bytes / API JSON / webhook payload) and "unified stream that
Silver consumes". Silver normalizer does not know or care whether rows
came from an Excel column or an API response field — it sees
identically-shaped RawEvent objects.

Design principles:
- **Adapters are stateless** (except for the single upload_id they're
  processing). No shared mutable state between calls.
- **Adapters don't touch business tables**. Only emit RawEvent. Caller
  (Silver normalizer) decides where to write.
- **Errors don't crash the stream**. Adapters can yield a RawEvent with
  `parse_error=<msg>` and keep going. Normalizer decides whether to
  drop / quarantine / fail.
- **No in-memory accumulation**. Adapters MUST stream — no
  `df = pd.read_csv(big_file)` that loads 500MB.
- **Resource cleanup in finally**. Network adapters close HTTP sessions;
  file adapters close handles.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, Optional


@dataclass(frozen=True)
class SourceMeta:
    """Per-adapter metadata that flows with every event — used for
    provenance, audit, and field_registry lookup.

    source_type: "excel" / "meituan_api" / "dianping_scrape" / ...
    source_version: adapter-specific version; e.g. Excel uses the upload's
        declared template "qhj_2025_v1", API adapters use API version from
        response headers. field_registry keys on (source_type, source_version).
    source_id: stable identifier for this particular ingest run
        (upload_id for Excel, webhook delivery_id for API, batch_id for
        scheduled scrapes).
    """
    source_type: str
    source_version: str
    source_id: str


@dataclass(frozen=True)
class RawEvent:
    """One atomic unit of data from the upstream source.

    row_index: 0-based position within this ingest run. For Excel this is
        the row number after header. For streaming API this is the order
        events were received. Needed for stable sort + dedup.
    raw_data: dict of {raw_column_name: raw_value}. Values are primitive
        Python types (str/int/float/bool/None/datetime). No DataFrames,
        no Polars series. Silver normalizer will resolve raw_column_name
        via field_registry.
    source_meta: see SourceMeta above. Immutable per ingest run.
    factory_id: the tenant this event belongs to. Redundant with
        source_meta.source_id's tenant scope but carried explicitly so
        Silver can apply RLS without chasing source metadata.
    parse_error: Optional — set by adapter when it could read the row but
        encountered a parse error on a specific cell. Silver quarantines
        these; zero means the event is clean.
    """
    row_index: int
    raw_data: Dict[str, Any]
    source_meta: SourceMeta
    factory_id: str
    parse_error: Optional[str] = None


class BronzeAdapter(abc.ABC):
    """Contract every source adapter implements.

    Usage:
        adapter = ExcelAdapter(file_path=..., factory_id=..., upload_id=...)
        async for event in adapter.ingest():
            await silver_normalizer.consume(event)
    """

    @abc.abstractmethod
    async def ingest(self) -> AsyncIterator[RawEvent]:
        """Yield RawEvent objects until source is exhausted.

        Implementations MUST:
        - stream (no loading full source into memory)
        - clean up resources (files, HTTP sessions) in finally block
        - not block the event loop (use `async for`, `asyncio.to_thread`
          for sync libs like pandas, or chunked reads)

        Implementations MAY:
        - yield RawEvent with parse_error for per-row issues
        - raise for unrecoverable errors (file corrupt, auth failed, etc.)
          — caller catches and marks upload FAILED
        """
        raise NotImplementedError
        yield  # pragma: no cover — makes this a generator function signature-wise

    @abc.abstractmethod
    def describe(self) -> Dict[str, Any]:
        """Return a small dict describing this adapter's configuration
        for logging/debugging. Must not include secrets (API keys etc).
        """
        raise NotImplementedError
