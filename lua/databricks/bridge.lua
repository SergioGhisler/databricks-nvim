local config = require("databricks.config")

local M = {}

local function build_runtime_cmd(script)
  local uv_enabled = config.options.uv and config.options.uv.enabled
  if config.options.python == "uv" then
    uv_enabled = true
  end

  if uv_enabled then
    local cmd = { "uv", "run" }
    local uv_with = (config.options.uv and config.options.uv.with) or { "databricks-sdk" }
    for _, pkg in ipairs(uv_with) do
      table.insert(cmd, "--with")
      table.insert(cmd, pkg)
    end
    table.insert(cmd, "python")
    table.insert(cmd, script)
    return cmd
  end

  return { config.options.python, script }
end

local function run_bridge(args)
  local script = config.options.bridge_script
  if not script or script == "" then
    error("databricks.nvim: bridge_script is not configured")
  end

  local cmd = build_runtime_cmd(script)
  vim.list_extend(cmd, config.resolve_auth_args())
  vim.list_extend(cmd, args)

  local out = vim.fn.system(cmd)
  if vim.v.shell_error ~= 0 then
    error("databricks.nvim bridge failed:\n" .. out)
  end

  local ok, decoded = pcall(vim.json.decode, out)
  if not ok then
    error("databricks.nvim: failed to parse bridge JSON\n" .. out)
  end

  if type(decoded) == "table" and decoded.error then
    error("databricks.nvim bridge error: " .. tostring(decoded.error))
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

function M.sample(catalog, schema, table, limit)
  local args = { "sample" }
  vim.list_extend(args, config.resolve_warehouse_arg())
  vim.list_extend(args, { "--catalog", catalog, "--schema", schema, "--table", table, "--limit", tostring(limit or 20) })
  return run_bridge(args)
end

return M
