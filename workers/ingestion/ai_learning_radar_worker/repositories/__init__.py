"""Persistence adapters used by ingestion pipelines."""

from .postgres import PostgresRepository

__all__ = ["PostgresRepository"]
