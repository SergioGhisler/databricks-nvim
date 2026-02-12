local config = require("databricks.config")
local bridge = require("databricks.bridge")
local ui = require("databricks.ui")

local M = {}

local state = {
  last_catalog = nil,
  last_schema = nil,
}

local function notify(msg, level)
  vim.notify(msg, level or vim.log.levels.INFO, { title = "databricks.nvim" })
end

local function cmd_catalogs()
  local ok, catalogs = pcall(bridge.catalogs)
  if not ok then
    notify(catalogs, vim.log.levels.ERROR)
    return
  end
  if #catalogs == 0 then
    notify("No catalogs found")
    return
  end

  ui.select(catalogs, function(item)
    return item.name
  end, function(choice)
    state.last_catalog = choice.name
    notify("Selected catalog: " .. choice.name)
  end, "Databricks catalogs")
end

local function cmd_schemas(catalog)
  catalog = catalog ~= "" and catalog or state.last_catalog
  if not catalog then
    notify("Provide catalog: :DbxSchemas <catalog>", vim.log.levels.WARN)
    return
  end

  local ok, schemas = pcall(bridge.schemas, catalog)
  if not ok then
    notify(schemas, vim.log.levels.ERROR)
    return
  end

  ui.select(schemas, function(item)
    return item.name
  end, function(choice)
    state.last_catalog = catalog
    state.last_schema = choice.name
    notify(string.format("Selected schema: %s.%s", catalog, choice.name))
  end, "Schemas in " .. catalog)
end

local function cmd_tables(catalog, schema)
  catalog = catalog ~= "" and catalog or state.last_catalog
  schema = schema ~= "" and schema or state.last_schema

  if not catalog or not schema then
    notify("Provide catalog + schema: :DbxTables <catalog> <schema>", vim.log.levels.WARN)
    return
  end

  local ok, tables = pcall(bridge.tables, catalog, schema)
  if not ok then
    notify(tables, vim.log.levels.ERROR)
    return
  end

  ui.select(tables, function(item)
    return item.name
  end, function(choice)
    notify(string.format("Selected table: %s.%s.%s", catalog, schema, choice.name))
  end, string.format("Tables in %s.%s", catalog, schema))
end

local function cmd_describe(catalog, schema, tbl)
  if catalog == "" then
    catalog = state.last_catalog
  end
  if schema == "" then
    schema = state.last_schema
  end

  if not catalog or not schema or tbl == "" then
    notify("Usage: :DbxDescribe <catalog> <schema> <table>", vim.log.levels.WARN)
    return
  end

  local ok, payload = pcall(bridge.describe, catalog, schema, tbl)
  if not ok then
    notify(payload, vim.log.levels.ERROR)
    return
  end

  ui.show_json(string.format("%s.%s.%s", catalog, schema, tbl), payload, config.options.ui)
end

local function create_commands()
  vim.api.nvim_create_user_command("DbxCatalogs", function()
    cmd_catalogs()
  end, {})

  vim.api.nvim_create_user_command("DbxSchemas", function(opts)
    cmd_schemas(opts.args)
  end, { nargs = "?" })

  vim.api.nvim_create_user_command("DbxTables", function(opts)
    local args = vim.split(opts.args or "", "%s+", { trimempty = true })
    cmd_tables(args[1] or "", args[2] or "")
  end, { nargs = "*" })

  vim.api.nvim_create_user_command("DbxDescribe", function(opts)
    local args = vim.split(opts.args or "", "%s+", { trimempty = true })
    cmd_describe(args[1] or "", args[2] or "", args[3] or "")
  end, { nargs = "*" })
end

function M.setup(opts)
  config.setup(opts)
  create_commands()
end

return M
