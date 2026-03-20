variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "instance_name" {
  type = string
}

variable "database_version" {
  type    = string
  default = "POSTGRES_15"
}

variable "tier" {
  type    = string
  default = "db-f1-micro"
}

variable "disk_type" {
  type    = string
  default = "PD_SSD"
}

variable "disk_size_gb" {
  type    = number
  default = 20
}

variable "availability_type" {
  type    = string
  default = "ZONAL"
}

variable "authorized_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

variable "db_name" {
  type = string
}

variable "db_user" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "deletion_protection" {
  type    = bool
  default = false
}
