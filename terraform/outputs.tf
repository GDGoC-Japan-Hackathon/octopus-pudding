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

output "artifact_registry_repository_url" {
  description = "Artifact Registry repository URL"
  value       = module.artifact_registry.repository_url
}

output "cloud_run_service_url" {
  description = "Cloud Run service URL"
  value       = module.cloud_run.service_url
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name"
  value       = module.cloud_sql.connection_name
}

output "cloud_sql_public_ip" {
  description = "Cloud SQL public IP"
  value       = module.cloud_sql.public_ip
}

output "cloud_build_trigger_id" {
  description = "Cloud Build trigger id"
  value       = module.cloud_build_trigger.trigger_id
}
