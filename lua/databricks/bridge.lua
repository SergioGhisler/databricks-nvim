local config = require("databricks.config")

local M = {}

local function run_bridge(args)
  local script = config.options.bridge_script
  if not script or script == "" then
    error("databricks.nvim: bridge_script is not configured")
  end

  local cmd = { config.options.python, script }
  vim.list_extend(cmd, args)

  local out = vim.fn.system(cmd)
  if vim.v.shell_error ~= 0 then
    error("databricks.nvim bridge failed:\n" .. out)
  end

  local ok, decoded = pcall(vim.json.decode, out)
  if not ok then
    error("databricks.nvim: failed to parse bridge JSON\n" .. out)
  end

  return decoded
end

function M.catalogs()
  return run_bridge({ "catalogs" })
end

function M.schemas(catalog)
  return run_bridge({ "schemas", "--catalog", catalog })
end

function M.tables(catalog, schema)
  return run_bridge({ "tables", "--catalog", catalog, "--schema", schema })
end

function M.describe(catalog, schema, table)
  return run_bridge({ "describe", "--catalog", catalog, "--schema", schema, "--table", table })
end

return M
