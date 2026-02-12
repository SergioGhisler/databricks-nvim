local M = {}

local function make_float(lines, title, opts)
  opts = opts or {}
  local width = math.floor(vim.o.columns * (opts.width or 0.7))
  local height = math.floor(vim.o.lines * (opts.height or 0.6))
  local row = math.floor((vim.o.lines - height) / 2)
  local col = math.floor((vim.o.columns - width) / 2)

  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].filetype = "json"

  vim.api.nvim_open_win(buf, true, {
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
  local pretty = vim.json.encode(obj)
  local lines = vim.split(pretty, "\n", { plain = true })
  make_float(lines, title, opts)
end

return M
