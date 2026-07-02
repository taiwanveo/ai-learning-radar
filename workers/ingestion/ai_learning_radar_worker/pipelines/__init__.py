"""Ingestion pipeline entry points."""

from .daily_digest import DailyDigestPipeline, PipelineReport

__all__ = ["DailyDigestPipeline", "PipelineReport"]
