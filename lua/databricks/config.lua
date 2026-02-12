local M = {}

M.defaults = {
  python = "python3",
  bridge_script = nil,
  profile = nil,
  uv = {
    enabled = false,
    with = { "databricks-sdk" },
  },
  ui = {
    border = "rounded",
    width = 0.7,
    height = 0.6,
  },
}

M.options = vim.deepcopy(M.defaults)
M.state = {
  profiles = {},
  active_profile = nil,
}

local function state_file()
  return vim.fn.stdpath("data") .. "/databricks/profiles.json"
end

local function ensure_dir()
  vim.fn.mkdir(vim.fn.stdpath("data") .. "/databricks", "p")
end

local function save_state()
  ensure_dir()
  local path = state_file()
  local payload = {
    profiles = M.state.profiles,
    active_profile = M.state.active_profile,
  }
  vim.fn.writefile({ vim.json.encode(payload) }, path)
end

function M.load_state()
  local path = state_file()
  if vim.fn.filereadable(path) == 0 then
    return
  end

  local lines = vim.fn.readfile(path)
  if not lines or #lines == 0 then
    return
  end

  local ok, decoded = pcall(vim.json.decode, table.concat(lines, "\n"))
  if not ok or type(decoded) ~= "table" then
    return
  end

  M.state.profiles = decoded.profiles or {}
  M.state.active_profile = decoded.active_profile
end

function M.setup(opts)
  M.options = vim.tbl_deep_extend("force", vim.deepcopy(M.defaults), opts or {})
  M.load_state()

  if M.options.profile and M.options.profile ~= "" then
    M.state.active_profile = M.options.profile
  end

  return M.options
end

function M.get_profiles()
  return M.state.profiles
end

function M.get_active_profile_name()
  return M.state.active_profile
end

function M.get_active_profile()
  local name = M.state.active_profile
  if not name then
    return nil
  end
  return M.state.profiles[name]
end

function M.add_profile(name, cfg)
  M.state.profiles[name] = {
    host = cfg.host,
    token = cfg.token,
    sdk_profile = cfg.sdk_profile,
  }
  if not M.state.active_profile then
    M.state.active_profile = name
  end
  save_state()
end

function M.use_profile(name)
  if not M.state.profiles[name] then
    return false
  end
  M.state.active_profile = name
  save_state()
  return true
end

function M.remove_profile(name)
  if not M.state.profiles[name] then
    return false
  end

  M.state.profiles[name] = nil
  if M.state.active_profile == name then
    M.state.active_profile = nil
    for k, _ in pairs(M.state.profiles) do
      M.state.active_profile = k
      break
    end
  end
  save_state()
  return true
end

function M.resolve_auth_args()
  local p = M.get_active_profile()
  if not p then
    return {}
  end

  local out = {}
  if p.sdk_profile and p.sdk_profile ~= "" then
    table.insert(out, "--profile")
    table.insert(out, p.sdk_profile)
  end
  if p.host and p.host ~= "" then
    table.insert(out, "--host")
    table.insert(out, p.host)
  end
  if p.token and p.token ~= "" then
    table.insert(out, "--token")
    table.insert(out, p.token)
  end
  return out
end

return M
