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
  vim.bo[buf].filetype = "json"

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
  make_float(lines, title, opts)
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

return M
