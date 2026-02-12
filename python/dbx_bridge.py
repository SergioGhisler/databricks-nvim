#!/usr/bin/env python3
"""Bridge for nvim-databricks.

Outputs JSON to stdout.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, is_dataclass
from typing import Any


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

    fn = getattr(obj, "as_dict", None)
    if callable(fn):
        return fn()

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


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="dbx_bridge.py")
    p.add_argument("--profile", default=None, help="Databricks SDK profile name")
    p.add_argument("--host", default=None, help="Databricks workspace host")
    p.add_argument("--token", default=None, help="Databricks PAT token")

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
        else:
            raise ValueError(f"Unknown command: {args.command}")

        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
