variable "project_id" {
  type = string
}

variable "secret_values" {
  type      = map(string)
  sensitive = true
}
