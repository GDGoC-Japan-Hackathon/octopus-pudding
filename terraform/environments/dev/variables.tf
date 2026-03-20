variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Default GCP region"
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. dev, prod)"
  type        = string
}

variable "artifact_registry_repository" {
  description = "Artifact Registry repository id"
  type        = string
}

variable "cloud_run_service_name" {
  description = "Cloud Run service name"
  type        = string
}

variable "cloud_run_service_account_id" {
  description = "Service account id for Cloud Run runtime"
  type        = string
}

variable "cloud_run_allow_unauthenticated" {
  description = "Allow unauthenticated invocation"
  type        = bool
  default     = true
}

variable "cloud_run_deletion_protection" {
  description = "Enable deletion protection for Cloud Run service"
  type        = bool
  default     = false
}

variable "cloudbuild_trigger_name" {
  description = "Cloud Build trigger name"
  type        = string
}

variable "cloudbuild_filename" {
  description = "Path to cloudbuild yaml from repository root"
  type        = string
  default     = "backend/cloudbuild.yaml"
}

variable "cloudbuild_included_files" {
  description = "Included file patterns for trigger"
  type        = list(string)
  default     = ["backend/**"]
}

variable "cloudbuild_image" {
  description = "Image name used in Artifact Registry"
  type        = string
  default     = "api"
}

variable "github_owner" {
  description = "GitHub owner"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

variable "github_branch_regex" {
  description = "Branch regex for Cloud Build trigger"
  type        = string
  default     = "^main$"
}

variable "cloud_sql_instance_name" {
  description = "Cloud SQL instance name"
  type        = string
}

variable "cloud_sql_database_version" {
  description = "Cloud SQL database version"
  type        = string
  default     = "POSTGRES_15"
}

variable "cloud_sql_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "cloud_sql_disk_size_gb" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 20
}

variable "cloud_sql_availability_type" {
  description = "Cloud SQL availability type"
  type        = string
  default     = "ZONAL"
}

variable "cloud_sql_authorized_cidr" {
  description = "Authorized CIDR for Cloud SQL public IP"
  type        = string
  default     = "0.0.0.0/0"
}

variable "cloud_sql_db_name" {
  description = "Application database name"
  type        = string
}

variable "cloud_sql_db_user" {
  description = "Application database user"
  type        = string
}

variable "cloud_sql_db_user_password" {
  description = "Application database user password"
  type        = string
  sensitive   = true
}

variable "cloud_sql_deletion_protection" {
  description = "Enable deletion protection for Cloud SQL instance"
  type        = bool
  default     = false
}

variable "secret_name_database_url" {
  description = "Secret name for DATABASE_URL"
  type        = string
  default     = "backend-database-url"
}

variable "secret_name_debug" {
  description = "Secret name for DEBUG"
  type        = string
  default     = "backend-debug"
}

variable "secret_name_firebase_project_id" {
  description = "Secret name for FIREBASE_PROJECT_ID"
  type        = string
  default     = "backend-firebase-project-id"
}

variable "secret_name_gcs_bucket_name" {
  description = "Secret name for GCS_BUCKET_NAME"
  type        = string
  default     = "backend-gcs-bucket-name"
}

variable "secret_name_google_places_api_key" {
  description = "Secret name for GOOGLE_PLACES_API_KEY"
  type        = string
  default     = "backend-google-places-api-key"
}

variable "secret_name_google_places_endpoint" {
  description = "Secret name for GOOGLE_PLACES_ENDPOINT"
  type        = string
  default     = "backend-google-places-endpoint"
}

variable "secret_name_google_places_language_code" {
  description = "Secret name for GOOGLE_PLACES_LANGUAGE_CODE"
  type        = string
  default     = "backend-google-places-language-code"
}

variable "secret_name_google_places_region_code" {
  description = "Secret name for GOOGLE_PLACES_REGION_CODE"
  type        = string
  default     = "backend-google-places-region-code"
}

variable "secret_name_gemini_api_key" {
  description = "Secret name for GEMINI_API_KEY"
  type        = string
  default     = "backend-gemini-api-key"
}

variable "secret_name_gemini_api_base_url" {
  description = "Secret name for GEMINI_API_BASE_URL"
  type        = string
  default     = "backend-gemini-api-base-url"
}

variable "secret_name_gemini_model" {
  description = "Secret name for GEMINI_MODEL"
  type        = string
  default     = "backend-gemini-model"
}

variable "secret_debug" {
  description = "Value for DEBUG secret"
  type        = string
  default     = "false"
}

variable "secret_firebase_project_id" {
  description = "Value for FIREBASE_PROJECT_ID secret"
  type        = string
}

variable "secret_gcs_bucket_name" {
  description = "Value for GCS_BUCKET_NAME secret"
  type        = string
}

variable "secret_google_places_api_key" {
  description = "Value for GOOGLE_PLACES_API_KEY secret"
  type        = string
  sensitive   = true
}

variable "secret_google_places_endpoint" {
  description = "Value for GOOGLE_PLACES_ENDPOINT secret"
  type        = string
  default     = "https://places.googleapis.com/v1/places:searchText"
}

variable "secret_google_places_language_code" {
  description = "Value for GOOGLE_PLACES_LANGUAGE_CODE secret"
  type        = string
  default     = "ja"
}

variable "secret_google_places_region_code" {
  description = "Value for GOOGLE_PLACES_REGION_CODE secret"
  type        = string
  default     = "JP"
}

variable "secret_gemini_api_key" {
  description = "Value for GEMINI_API_KEY secret"
  type        = string
  sensitive   = true
}

variable "secret_gemini_api_base_url" {
  description = "Value for GEMINI_API_BASE_URL secret"
  type        = string
  default     = "https://generativelanguage.googleapis.com/v1beta"
}

variable "secret_gemini_model" {
  description = "Value for GEMINI_MODEL secret"
  type        = string
  default     = "gemini-2.5-flash"
}
