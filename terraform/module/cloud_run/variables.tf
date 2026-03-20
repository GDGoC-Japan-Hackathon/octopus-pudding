variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "service_name" {
  type = string
}

variable "service_account_id" {
  type = string
}

variable "image_uri" {
  type = string
}

variable "allow_unauthenticated" {
  type    = bool
  default = true
}

variable "deletion_protection" {
  type    = bool
  default = false
}
