# databricks-nvim

Neovim plugin for Databricks workflows without leaving Neovim.

> Current stage: MVP (catalog/schema/table exploration + table describe)

---

## Features (MVP)

- `:DbxCatalogs` → list Unity Catalog catalogs
- `:DbxSchemas [catalog]` → list schemas
- `:DbxTables [catalog] [schema]` → list tables
- `:DbxDescribe [catalog] [schema] [table]` → float with table metadata

All powered from inside Neovim commands/UI.

---

## Requirements

- Neovim `>= 0.9`
- Python `>= 3.10`
- [`databricks-sdk`](https://pypi.org/project/databricks-sdk/)
- Databricks auth configured (`DATABRICKS_HOST` + `DATABRICKS_TOKEN`, or standard SDK auth chain)

Install Python dependency:

```bash
python3 -m pip install --user databricks-sdk
```

---

## Installation (lazy.nvim)

```lua
{
  "SergioGhisler/databricks-nvim",
  config = function()
    require("databricks").setup({
      python = "python3",
      bridge_script = vim.fn.stdpath("data") .. "/lazy/databricks-nvim/python/dbx_bridge.py",
      ui = {
        border = "rounded",
        width = 0.7,
        height = 0.6,
      },
    })
  end,
}
```

If you install to a custom path, set `bridge_script` accordingly.

---

## Databricks auth

Example with env vars:

```bash
export DATABRICKS_HOST="https://<workspace>.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi..."
```

Optional quick test:

```bash
python3 python/dbx_bridge.py catalogs
```

---

## Commands

- `:DbxCatalogs`
- `:DbxSchemas [catalog]`
- `:DbxTables [catalog] [schema]`
- `:DbxDescribe [catalog] [schema] [table]`

---

## Roadmap

- Workspace/profile switcher inside Neovim
- Query runner + preview UI
- Notebook/cell execution on configured compute
- Telescope integration
- Async bridge calls (non-blocking UX)

---

## Development

```bash
git clone git@github.com:SergioGhisler/databricks-nvim.git
cd databricks-nvim
```

Use local lazy.nvim plugin spec with `dir = "<repo-path>"` while iterating.
