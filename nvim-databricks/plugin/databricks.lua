if vim.g.loaded_databricks_nvim == 1 then
  return
end
vim.g.loaded_databricks_nvim = 1

-- Users should call require('databricks').setup({...}) from plugin manager config.
