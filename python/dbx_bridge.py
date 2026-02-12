#!/usr/bin/env python3
"""Bridge for nvim-databricks.

Outputs JSON to stdout.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict, is_dataclass
from enum import Enum
from typing import Any

import requests


def _to_jsonable(obj: Any) -> Any:
    if is_dataclass(obj):
        return asdict(obj)
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    if isinstance(obj, list):
        return [_to_jsonable(x) for x in obj]
    if isinstance(obj, tuple):
        return [_to_jsonable(x) for x in obj]
    if isinstance(obj, dict):
        return {str(k): _to_jsonable(v) for k, v in obj.items()}

    if isinstance(obj, Enum):
        return obj.value

    fn = getattr(obj, "as_dict", None)
    if callable(fn):
        return _to_jsonable(fn())

    return str(obj)


def _client(args: argparse.Namespace):
    try:
        from databricks.sdk import WorkspaceClient
    except Exception as e:
        print(json.dumps({"error": f"databricks-sdk import failed: {e}"}))
        sys.exit(2)

    kwargs: dict[str, Any] = {}
    if getattr(args, "profile", None):
        kwargs["profile"] = args.profile
    if getattr(args, "host", None):
        kwargs["host"] = args.host
    if getattr(args, "token", None):
        kwargs["token"] = args.token

    return WorkspaceClient(**kwargs)


def cmd_catalogs(args: argparse.Namespace) -> list[dict[str, Any]]:
    w = _client(args)
    out = []
    for c in w.catalogs.list():
        d = _to_jsonable(c)
        if isinstance(d, dict):
            out.append(
                {
                    "name": d.get("name"),
                    "comment": d.get("comment"),
                    "owner": d.get("owner"),
                    "catalog_type": d.get("catalog_type"),
                }
            )
    return sorted([x for x in out if x.get("name")], key=lambda x: x["name"])


def cmd_schemas(args: argparse.Namespace) -> list[dict[str, Any]]:
    w = _client(args)
    out = []
    for s in w.schemas.list(catalog_name=args.catalog):
        d = _to_jsonable(s)
        if isinstance(d, dict):
            out.append(
                {
                    "name": d.get("name"),
                    "full_name": d.get("full_name"),
                    "catalog_name": d.get("catalog_name"),
                    "comment": d.get("comment"),
                }
            )
    return sorted([x for x in out if x.get("name")], key=lambda x: x["name"])


def cmd_tables(args: argparse.Namespace) -> list[dict[str, Any]]:
    w = _client(args)
    out = []
    for t in w.tables.list(catalog_name=args.catalog, schema_name=args.schema):
        d = _to_jsonable(t)
        if isinstance(d, dict):
            out.append(
                {
                    "name": d.get("name"),
                    "full_name": d.get("full_name"),
                    "table_type": d.get("table_type"),
                    "data_source_format": d.get("data_source_format"),
                }
            )
    return sorted([x for x in out if x.get("name")], key=lambda x: x["name"])


def cmd_describe(args: argparse.Namespace) -> dict[str, Any]:
    w = _client(args)
    full_name = f"{args.catalog}.{args.schema}.{args.table}"
    t = w.tables.get(full_name=full_name)
    return _to_jsonable(t)


def _resolve_host_token(args: argparse.Namespace) -> tuple[str | None, str | None]:
    host = getattr(args, "host", None)
    token = getattr(args, "token", None)
    if host and token:
        return host.rstrip("/"), token

    try:
        w = _client(args)
        cfg = w.config
        host = host or getattr(cfg, "host", None)
        token = token or getattr(cfg, "token", None)
    except Exception:
        pass

    if host:
        host = host.rstrip("/")
    return host, token


def cmd_sample(args: argparse.Namespace) -> dict[str, Any]:
    host, token = _resolve_host_token(args)
    if not host or not token:
        raise ValueError("sample requires host+token auth (or profile that resolves to token)")
    if not args.warehouse_id:
        raise ValueError("sample requires --warehouse-id (configure workspace warehouse_id)")

    full_name = f"{args.catalog}.{args.schema}.{args.table}"
    limit = max(1, min(int(args.limit or 20), 200))
    statement = f"SELECT * FROM {full_name} LIMIT {limit}"

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    create_url = f"{host}/api/2.0/sql/statements"
    payload = {
        "warehouse_id": args.warehouse_id,
        "statement": statement,
        "wait_timeout": "30s",
        "disposition": "INLINE",
    }

    r = requests.post(create_url, headers=headers, json=payload, timeout=45)
    r.raise_for_status()
    data = r.json()

    status = ((data.get("status") or {}).get("state") or "").upper()
    stmt_id = data.get("statement_id")

    if status not in {"SUCCEEDED", "FAILED", "CANCELED", "CLOSED"} and stmt_id:
        poll_url = f"{host}/api/2.0/sql/statements/{stmt_id}"
        for _ in range(20):
            time.sleep(1)
            p = requests.get(poll_url, headers=headers, timeout=20)
            p.raise_for_status()
            data = p.json()
            status = ((data.get("status") or {}).get("state") or "").upper()
            if status in {"SUCCEEDED", "FAILED", "CANCELED", "CLOSED"}:
                break

    if status != "SUCCEEDED":
        return {
            "status": status or "UNKNOWN",
            "statement": statement,
            "error": ((data.get("status") or {}).get("error") or data.get("error") or data),
        }

    result = data.get("result") or {}
    schema = ((result.get("manifest") or {}).get("schema") or {}).get("columns") or []
    cols = [c.get("name") for c in schema if isinstance(c, dict)]
    rows = result.get("data_array") or []

    return {
        "status": status,
        "statement": statement,
        "columns": cols,
        "rows": rows,
        "row_count": len(rows),
    }


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="dbx_bridge.py")
    p.add_argument("--profile", default=None, help="Databricks SDK profile name")
    p.add_argument("--host", default=None, help="Databricks workspace host")
    p.add_argument("--token", default=None, help="Databricks PAT token")
    p.add_argument("--warehouse-id", default=None, help="Databricks SQL warehouse id")

    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("catalogs")

    s = sub.add_parser("schemas")
    s.add_argument("--catalog", required=True)

    t = sub.add_parser("tables")
    t.add_argument("--catalog", required=True)
    t.add_argument("--schema", required=True)

    d = sub.add_parser("describe")
    d.add_argument("--catalog", required=True)
    d.add_argument("--schema", required=True)
    d.add_argument("--table", required=True)

    sm = sub.add_parser("sample")
    sm.add_argument("--catalog", required=True)
    sm.add_argument("--schema", required=True)
    sm.add_argument("--table", required=True)
    sm.add_argument("--limit", type=int, default=20)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "catalogs":
            result = cmd_catalogs(args)
        elif args.command == "schemas":
            result = cmd_schemas(args)
        elif args.command == "tables":
            result = cmd_tables(args)
        elif args.command == "describe":
            result = cmd_describe(args)
        elif args.command == "sample":
            result = cmd_sample(args)
        else:
            raise ValueError(f"Unknown command: {args.command}")

        print(json.dumps(result, ensure_ascii=False, default=str))
        return 0
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
