# databricks-nvim

Neovim plugin for Databricks workflows without leaving Neovim.

> Current stage: MVP+ (catalog/schema/table exploration + table describe + multi-workspace profiles)

---

## Features

- `:DbxCatalogs` → list Unity Catalog catalogs
- `:DbxSchemas [catalog]` → list schemas
- `:DbxTables [catalog] [schema]` → list tables
- `:DbxDescribe [catalog] [schema] [table]` → float with table metadata
- `:DbxProfileAdd / :DbxProfiles / :DbxProfileUse / :DbxProfileRemove`

All from Neovim commands/UI.

---

## Requirements

- Neovim `>= 0.9`
- Python `>= 3.10`
- [`uv`](https://docs.astral.sh/uv/) (recommended)
- [`databricks-sdk`](https://pypi.org/project/databricks-sdk/)

Install Python dependency with `uv`:

```bash
uv tool install --with databricks-sdk databricks-sdk
# OR project-local:
uv venv
uv pip install databricks-sdk
```

If you prefer pip:

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
      python = "python3", -- or path to uv-managed python
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

## Auth / Workspace configuration

You now have two ways:

### 1) Inside Neovim plugin (recommended for multi-workspace)

Add profiles:

```vim
:DbxProfileAdd dev https://adb-1234567890123456.7.azuredatabricks.net dapi_xxx
:DbxProfileAdd prod https://adb-9999999999999999.7.azuredatabricks.net dapi_yyy
```

Switch active workspace:

```vim
:DbxProfileUse dev
:DbxCatalogs
```

List/remove:

```vim
:DbxProfiles
:DbxProfileRemove prod
```

Profiles are saved at:

- `~/.local/share/nvim/databricks/profiles.json` (Linux)
- `~/Library/Application Support/nvim/databricks/profiles.json` (macOS)

> Note: tokens stored there are plaintext currently (MVP). Next step is keychain integration.

### 2) Environment variables (single workspace quickstart)

Put in your shell rc (`~/.zshrc`):

```bash
export DATABRICKS_HOST="https://<workspace>.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi..."
```

Then restart shell / Neovim.

---

## Commands

### Data exploration

- `:DbxCatalogs`
- `:DbxSchemas [catalog]`
- `:DbxTables [catalog] [schema]`
- `:DbxDescribe [catalog] [schema] [table]`

### Profile management

- `:DbxProfiles`
- `:DbxProfileAdd <name> <host> [token] [sdk_profile]`
- `:DbxProfileUse <name>`
- `:DbxProfileRemove <name>`

---

## Roadmap

- Workspace profile picker UI
- Query runner + preview UI
- Notebook/cell execution on configured compute
- Telescope integration
- Async bridge calls (non-blocking UX)
- OS keychain-backed secret storage

---

## Development

```bash
git clone git@github.com:SergioGhisler/databricks-nvim.git
cd databricks-nvim
```

Use local lazy.nvim plugin spec with `dir = "<repo-path>"` while iterating.
