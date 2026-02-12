# nvim-databricks

Neovim plugin to browse Databricks Unity Catalog objects from inside Neovim.

## Current features (MVP)

- `:DbxCatalogs` → list catalogs
- `:DbxSchemas [catalog]` → list schemas in catalog
- `:DbxTables [catalog] [schema]` → list tables in schema
- `:DbxDescribe [catalog] [schema] [table]` → show table metadata in a floating window

No terminal hopping required once configured.

## Requirements

- Neovim >= 0.9
- Python 3.10+
- `databricks-sdk` Python package installed
- Databricks auth configured (`DATABRICKS_HOST` + `DATABRICKS_TOKEN`, or standard Databricks CLI auth chain)

Install SDK:

```bash
python3 -m pip install databricks-sdk
```

## Install (lazy.nvim)

```lua
{
  dir = "/Users/Alyx/.openclaw/workspace/nvim-databricks",
  config = function()
    require("databricks").setup({
      python = "python3",
      bridge_script = "/Users/Alyx/.openclaw/workspace/nvim-databricks/python/dbx_bridge.py",
    })
  end,
}
```

## Auth

Any method supported by `databricks-sdk` should work. Easiest:

```bash
export DATABRICKS_HOST="https://<workspace>.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi..."
```

## Next roadmap

- Notebook/cell execution integration
- Query preview for selected table
- Telescope picker backend
- Async jobs for smoother UX
