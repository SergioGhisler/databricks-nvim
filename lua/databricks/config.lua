local M = {}

M.defaults = {
  python = "python3",
  bridge_script = nil,
  ui = {
    border = "rounded",
    width = 0.7,
    height = 0.6,
  },
}

M.options = vim.deepcopy(M.defaults)

function M.setup(opts)
  M.options = vim.tbl_deep_extend("force", vim.deepcopy(M.defaults), opts or {})
  return M.options
end

return M
