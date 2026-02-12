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

local function split_args(s)
  return vim.split(s or "", "%s+", { trimempty = true })
end

local function profile_names()
  local names = vim.tbl_keys(config.get_profiles())
  table.sort(names)
  return names
end

local function cmd_profiles()
  local profiles = config.get_profiles()
  local active = config.get_active_profile_name()
  local rows = {}

  for name, p in pairs(profiles) do
    local mark = (name == active) and "*" or " "
    table.insert(rows, string.format("%s %s  host=%s sdk_profile=%s", mark, name, p.host or "-", p.sdk_profile or "-"))
  end

  table.sort(rows)
  if #rows == 0 then
    notify("No workspaces configured. Use :DbxWorkspaceLogin", vim.log.levels.WARN)
    return
  end

  ui.show_json("Databricks Workspaces", rows, config.options.ui)
end

local function cmd_profile_add(args)
  if #args < 2 then
    notify("Usage: :DbxProfileAdd <name> <host> [token] [sdk_profile]", vim.log.levels.WARN)
    return
  end

  local name = args[1]
  local host = args[2]
  local token = args[3]
  local sdk_profile = args[4]

  if not token or token == "" then
    token = vim.fn.inputsecret("Databricks token (optional): ")
  end

  config.add_profile(name, {
    host = host,
    token = token,
    sdk_profile = sdk_profile,
  })
  notify("Saved workspace: " .. name)
end

local function cmd_workspace_login(args)
  local name = args[1] or ""
  local host = args[2] or ""
  local token = args[3] or ""
  local sdk_profile = args[4] or ""

  if name == "" then
    name = vim.fn.input("Workspace name: ")
  end
  if name == "" then
    notify("Workspace name is required", vim.log.levels.WARN)
    return
  end

  if host == "" then
    host = vim.fn.input("Workspace host URL: ")
  end
  if host == "" then
    notify("Workspace host is required", vim.log.levels.WARN)
    return
  end

  if token == "" then
    token = vim.fn.inputsecret("Workspace token (optional): ")
  end

  if sdk_profile == "" then
    sdk_profile = vim.fn.input("SDK profile name (optional): ")
  end

  config.add_profile(name, {
    host = host,
    token = token,
    sdk_profile = sdk_profile,
  })
  config.use_profile(name)
  notify("Workspace saved and selected: " .. name)
end

local function cmd_profile_use(name)
  if not name or name == "" then
    local names = profile_names()
    if #names == 0 then
      notify("No workspaces configured. Use :DbxWorkspaceLogin", vim.log.levels.WARN)
      return
    end

    ui.select(names, function(item)
      return item
    end, function(choice)
      config.use_profile(choice)
      notify("Active workspace: " .. choice)
    end, "Select Databricks workspace")
    return
  end

  if config.use_profile(name) then
    notify("Active workspace: " .. name)
  else
    notify("Workspace not found: " .. name, vim.log.levels.ERROR)
  end
end

local function cmd_profile_remove(name)
  if not name or name == "" then
    local names = profile_names()
    if #names == 0 then
      notify("No workspaces to delete", vim.log.levels.WARN)
      return
    end

    ui.select(names, function(item)
      return item
    end, function(choice)
      local ok = config.remove_profile(choice)
      if ok then
        notify("Removed workspace: " .. choice)
      else
        notify("Workspace not found: " .. choice, vim.log.levels.ERROR)
      end
    end, "Delete Databricks workspace")
    return
  end

  local ok = config.remove_profile(name)
  if ok then
    notify("Removed workspace: " .. name)
  else
    notify("Workspace not found: " .. name, vim.log.levels.ERROR)
  end
end

local function cmd_workspace_ui()
  ui.workspace_overlay({
    profiles = config.get_profiles(),
    active = config.get_active_profile_name(),
  }, config.options.ui, {
    use = function(name)
      config.use_profile(name)
      notify("Active workspace: " .. name)
    end,
    delete = function(name)
      local ok = config.remove_profile(name)
      if ok then
        notify("Removed workspace: " .. name)
      else
        notify("Workspace not found: " .. name, vim.log.levels.ERROR)
      end
    end,
    add = function()
      cmd_workspace_login({})
    end,
  })
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
    local args = split_args(opts.args)
    cmd_tables(args[1] or "", args[2] or "")
  end, { nargs = "*" })

  vim.api.nvim_create_user_command("DbxDescribe", function(opts)
    local args = split_args(opts.args)
    cmd_describe(args[1] or "", args[2] or "", args[3] or "")
  end, { nargs = "*" })

  -- Profile commands (kept for compatibility)
  vim.api.nvim_create_user_command("DbxProfiles", function()
    cmd_profiles()
  end, {})

  vim.api.nvim_create_user_command("DbxProfileAdd", function(opts)
    cmd_profile_add(split_args(opts.args))
  end, { nargs = "+" })

  vim.api.nvim_create_user_command("DbxProfileUse", function(opts)
    cmd_profile_use(opts.args)
  end, { nargs = "?", complete = profile_names })

  vim.api.nvim_create_user_command("DbxProfileRemove", function(opts)
    cmd_profile_remove(opts.args)
  end, { nargs = "?", complete = profile_names })

  -- Workspace aliases (preferred UX)
  vim.api.nvim_create_user_command("DbxWorkspaces", function()
    cmd_profiles()
  end, {})

  vim.api.nvim_create_user_command("DbxWorkspaceLogin", function(opts)
    cmd_workspace_login(split_args(opts.args))
  end, { nargs = "*" })

  vim.api.nvim_create_user_command("DbxWorkspaceUse", function(opts)
    cmd_profile_use(opts.args)
  end, { nargs = "?", complete = profile_names })

  vim.api.nvim_create_user_command("DbxWorkspaceDelete", function(opts)
    cmd_profile_remove(opts.args)
  end, { nargs = "?", complete = profile_names })

  vim.api.nvim_create_user_command("DbxWorkspaceUI", function()
    cmd_workspace_ui()
  end, {})

  vim.api.nvim_create_user_command("DbxUI", function()
    cmd_workspace_ui()
  end, {})
end

function M.setup(opts)
  config.setup(opts)
  create_commands()
end

return M
