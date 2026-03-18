terraform {
  backend "gcs" {}
}

module "backend_infra" {
  source = "../../"

  environment = "dev"
  project_id  = var.project_id
  region      = var.region
}

variable "project_id" {
  description = "GCP project ID for dev"
  type        = string
}

variable "region" {
  description = "Default GCP region for dev"
  type        = string
}

output "environment" {
  value = module.backend_infra.environment
}

output "project_id" {
  value = module.backend_infra.project_id
}

output "region" {
  value = module.backend_infra.region
}
