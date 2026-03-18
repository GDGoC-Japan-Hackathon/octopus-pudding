output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "project_id" {
  description = "GCP project id used by provider"
  value       = var.project_id
}

output "region" {
  description = "GCP region used by provider"
  value       = var.region
}
