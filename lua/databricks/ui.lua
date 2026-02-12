local M = {}

local function float_dims(opts)
  opts = opts or {}
  local width = math.floor(vim.o.columns * (opts.width or 0.7))
  local height = math.floor(vim.o.lines * (opts.height or 0.6))
  local row = math.floor((vim.o.lines - height) / 2)
  local col = math.floor((vim.o.columns - width) / 2)
  return width, height, row, col
end

local function make_float(lines, title, opts)
  opts = opts or {}
  local width, height, row, col = float_dims(opts)

  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].bufhidden = "wipe"

  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = row,
    col = col,
    style = "minimal",
    border = opts.border or "rounded",
    title = title,
    title_pos = "center",
  })

  return buf, win
end

function M.select(items, label_fn, on_choice, prompt)
  vim.ui.select(items, {
    prompt = prompt,
    format_item = label_fn,
  }, function(choice)
    if choice then
      on_choice(choice)
    end
  end)
end

function M.show_json(title, obj, opts)
  local pretty = vim.inspect(obj)
  local lines = vim.split(pretty, "\n", { plain = true })
  local buf = make_float(lines, title, opts)
  vim.bo[buf].filetype = "lua"
end

function M.workspace_overlay(state, opts, handlers)
  local function build_lines()
    local lines = {
      "Databricks Workspaces",
      "",
      "[Enter] Use   [a] Add/Login   [d] Delete   [r] Refresh   [q] Close",
      "",
    }

    local names = vim.tbl_keys(state.profiles)
    table.sort(names)

    if #names == 0 then
      table.insert(lines, "(no workspaces yet — press 'a' to add one)")
      return lines, {}
    end

    local row_to_name = {}
    for _, name in ipairs(names) do
      local p = state.profiles[name]
      local mark = (name == state.active) and "●" or "○"
      table.insert(lines, string.format("%s %s  (%s)", mark, name, p.host or "no-host"))
      row_to_name[#lines] = name
    end

    return lines, row_to_name
  end

  local lines, row_to_name = build_lines()
  local buf, win = make_float(lines, "databricks.nvim", opts)
  vim.bo[buf].modifiable = false
  vim.bo[buf].filetype = "databricks"

  local function close()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end

  local function current_name()
    local row = vim.api.nvim_win_get_cursor(win)[1]
    return row_to_name[row]
  end

  local function refresh()
    lines, row_to_name = build_lines()
    vim.bo[buf].modifiable = true
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
    vim.bo[buf].modifiable = false
  end

  local function map(lhs, rhs)
    vim.keymap.set("n", lhs, rhs, { buffer = buf, nowait = true, silent = true })
  end

  map("q", close)
  map("<Esc>", close)
  map("r", refresh)
  map("<CR>", function()
    local name = current_name()
    if name then
      handlers.use(name)
      refresh()
    end
  end)
  map("d", function()
    local name = current_name()
    if name then
      handlers.delete(name)
      refresh()
    end
  end)
  map("a", function()
    handlers.add()
    refresh()
  end)
end

function M.explorer_overlay(opts, handlers)
  local nodes = {}
  local expanded = {}
  local row_map = {}

  local function key_for(kind, a, b, c)
    return table.concat({ kind or "", a or "", b or "", c or "" }, "|")
  end

  local function safe(fn, ...)
    local ok, data = pcall(fn, ...)
    if not ok then
      if handlers.on_error then
        handlers.on_error(data)
      end
      return nil
    end
    return data
  end

  local function ensure_catalogs()
    if #nodes > 0 then
      return
    end
    local catalogs = safe(handlers.list_catalogs)
    if not catalogs then
      return
    end
    nodes = {}
    for _, c in ipairs(catalogs) do
      table.insert(nodes, { kind = "catalog", name = c.name, children = nil })
    end
  end

  local function ensure_children(node)
    if node.children then
      return
    end

    if node.kind == "catalog" then
      local schemas = safe(handlers.list_schemas, node.name) or {}
      node.children = {}
      for _, s in ipairs(schemas) do
        table.insert(node.children, { kind = "schema", catalog = node.name, name = s.name, children = nil })
      end
      return
    end

    if node.kind == "schema" then
      local tables = safe(handlers.list_tables, node.catalog, node.name) or {}
      node.children = {}
      for _, t in ipairs(tables) do
        table.insert(node.children, { kind = "table", catalog = node.catalog, schema = node.name, name = t.name })
      end
    end
  end

  local function render_lines()
    ensure_catalogs()
    local lines = {
      "Databricks Explorer",
      "",
      "[Enter/l] expand-open  [h] collapse  [d] describe  [s] sample  [r] refresh  [q] close",
      "",
    }
    row_map = {}

    local function add_line(prefix, label, node)
      table.insert(lines, prefix .. label)
      row_map[#lines] = node
    end

    for _, c in ipairs(nodes) do
      local ck = key_for("catalog", c.name)
      local c_open = expanded[ck]
      add_line(c_open and "▾ " or "▸ ", c.name, c)
      if c_open then
        ensure_children(c)
        for _, s in ipairs(c.children or {}) do
          local sk = key_for("schema", s.catalog, s.name)
          local s_open = expanded[sk]
          add_line("  " .. (s_open and "▾ " or "▸ "), s.name, s)
          if s_open then
            ensure_children(s)
            for _, t in ipairs(s.children or {}) do
              add_line("    • ", t.name, t)
            end
          end
        end
      end
    end

    if #nodes == 0 then
      table.insert(lines, "(no catalogs found)")
    end

    return lines
  end

  local lines = render_lines()
  local buf, win = make_float(lines, "databricks.nvim explorer", opts)
  vim.bo[buf].modifiable = false
  vim.bo[buf].filetype = "databricks"

  local function refresh(reset)
    if reset then
      nodes = {}
    end
    lines = render_lines()
    vim.bo[buf].modifiable = true
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
    vim.bo[buf].modifiable = false
  end

  local function current_node()
    local row = vim.api.nvim_win_get_cursor(win)[1]
    return row_map[row]
  end

  local function close()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end

  local function open_or_expand()
    local node = current_node()
    if not node then
      return
    end
    if node.kind == "catalog" then
      local k = key_for("catalog", node.name)
      expanded[k] = not expanded[k]
      refresh(false)
      return
    end
    if node.kind == "schema" then
      local k = key_for("schema", node.catalog, node.name)
      expanded[k] = not expanded[k]
      refresh(false)
      return
    end
    if node.kind == "table" then
      local payload = safe(handlers.describe, node.catalog, node.schema, node.name)
      if payload then
        M.show_json(string.format("%s.%s.%s", node.catalog, node.schema, node.name), payload, opts)
      end
    end
  end

  local function collapse()
    local node = current_node()
    if not node then
      return
    end
    if node.kind == "schema" then
      expanded[key_for("schema", node.catalog, node.name)] = false
      refresh(false)
      return
    end
    if node.kind == "catalog" then
      expanded[key_for("catalog", node.name)] = false
      refresh(false)
    end
  end

  local function sample()
    local node = current_node()
    if not node or node.kind ~= "table" then
      if handlers.on_info then
        handlers.on_info("Select a table row to sample")
      end
      return
    end
    local payload = safe(handlers.sample, node.catalog, node.schema, node.name, 20)
    if payload then
      M.show_json(string.format("sample %s.%s.%s", node.catalog, node.schema, node.name), payload, opts)
    end
  end

  local function describe()
    local node = current_node()
    if not node or node.kind ~= "table" then
      if handlers.on_info then
        handlers.on_info("Select a table row to describe")
      end
      return
    end
    local payload = safe(handlers.describe, node.catalog, node.schema, node.name)
    if payload then
      M.show_json(string.format("%s.%s.%s", node.catalog, node.schema, node.name), payload, opts)
    end
  end

  local function map(lhs, rhs)
    vim.keymap.set("n", lhs, rhs, { buffer = buf, nowait = true, silent = true })
  end

  map("q", close)
  map("<Esc>", close)
  map("r", function()
    refresh(true)
  end)
  map("<CR>", open_or_expand)
  map("l", open_or_expand)
  map("h", collapse)
  map("d", describe)
  map("s", sample)
end

return M
