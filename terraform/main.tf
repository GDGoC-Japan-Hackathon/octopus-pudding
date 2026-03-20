locals {
  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  secret_names = {
    DATABASE_URL                = var.secret_name_database_url
    DEBUG                       = var.secret_name_debug
    FIREBASE_PROJECT_ID         = var.secret_name_firebase_project_id
    GCS_BUCKET_NAME             = var.secret_name_gcs_bucket_name
    GOOGLE_PLACES_API_KEY       = var.secret_name_google_places_api_key
    GOOGLE_PLACES_ENDPOINT      = var.secret_name_google_places_endpoint
    GOOGLE_PLACES_LANGUAGE_CODE = var.secret_name_google_places_language_code
    GOOGLE_PLACES_REGION_CODE   = var.secret_name_google_places_region_code
    GEMINI_API_KEY              = var.secret_name_gemini_api_key
    GEMINI_API_BASE_URL         = var.secret_name_gemini_api_base_url
    GEMINI_MODEL                = var.secret_name_gemini_model
  }

  database_url = format(
    "postgresql+asyncpg://%s:%s@%s:5432/%s",
    var.cloud_sql_db_user,
    urlencode(var.cloud_sql_db_user_password),
    module.cloud_sql.public_ip,
    var.cloud_sql_db_name,
  )

  secret_values = {
    (local.secret_names.DATABASE_URL)                = local.database_url
    (local.secret_names.DEBUG)                       = var.secret_debug
    (local.secret_names.FIREBASE_PROJECT_ID)         = var.secret_firebase_project_id
    (local.secret_names.GCS_BUCKET_NAME)             = var.secret_gcs_bucket_name
    (local.secret_names.GOOGLE_PLACES_API_KEY)       = var.secret_google_places_api_key
    (local.secret_names.GOOGLE_PLACES_ENDPOINT)      = var.secret_google_places_endpoint
    (local.secret_names.GOOGLE_PLACES_LANGUAGE_CODE) = var.secret_google_places_language_code
    (local.secret_names.GOOGLE_PLACES_REGION_CODE)   = var.secret_google_places_region_code
    (local.secret_names.GEMINI_API_KEY)              = var.secret_gemini_api_key
    (local.secret_names.GEMINI_API_BASE_URL)         = var.secret_gemini_api_base_url
    (local.secret_names.GEMINI_MODEL)                = var.secret_gemini_model
  }
}

resource "google_project_service" "enabled" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

module "artifact_registry" {
  source = "./module/artifact_registry"

  project_id    = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repository
  description   = "Backend Docker images (${var.environment})"

  depends_on = [google_project_service.enabled]
}

module "cloud_sql" {
  source = "./module/cloud_sql"

  project_id          = var.project_id
  region              = var.region
  instance_name       = var.cloud_sql_instance_name
  database_version    = var.cloud_sql_database_version
  tier                = var.cloud_sql_tier
  disk_size_gb        = var.cloud_sql_disk_size_gb
  availability_type   = var.cloud_sql_availability_type
  authorized_cidr     = var.cloud_sql_authorized_cidr
  db_name             = var.cloud_sql_db_name
  db_user             = var.cloud_sql_db_user
  db_password         = var.cloud_sql_db_user_password
  deletion_protection = var.cloud_sql_deletion_protection

  depends_on = [google_project_service.enabled]
}

module "secret_manager" {
  source = "./module/secret_manager"

  project_id    = var.project_id
  secret_values = local.secret_values

  depends_on = [module.cloud_sql]
}

module "cloud_run" {
  source = "./module/cloud_run"

  project_id            = var.project_id
  region                = var.region
  service_name          = var.cloud_run_service_name
  service_account_id    = var.cloud_run_service_account_id
  image_uri             = "${module.artifact_registry.repository_url}/${var.cloudbuild_image}:latest"
  allow_unauthenticated = var.cloud_run_allow_unauthenticated
  deletion_protection   = var.cloud_run_deletion_protection

  depends_on = [module.secret_manager]
}

module "cloud_build_trigger" {
  source = "./module/cloud_build_trigger"

  project_id          = var.project_id
  name                = var.cloudbuild_trigger_name
  description         = "Backend Cloud Build trigger (${var.environment})"
  filename            = var.cloudbuild_filename
  github_owner        = var.github_owner
  github_repo         = var.github_repo
  github_branch_regex = var.github_branch_regex
  included_files      = var.cloudbuild_included_files

  substitutions = {
    _REGION                             = var.region
    _REPOSITORY                         = var.artifact_registry_repository
    _IMAGE                              = var.cloudbuild_image
    _SERVICE                            = var.cloud_run_service_name
    _SECRET_DATABASE_URL                = local.secret_names.DATABASE_URL
    _SECRET_DEBUG                       = local.secret_names.DEBUG
    _SECRET_FIREBASE_PROJECT_ID         = local.secret_names.FIREBASE_PROJECT_ID
    _SECRET_GCS_BUCKET_NAME             = local.secret_names.GCS_BUCKET_NAME
    _SECRET_GOOGLE_PLACES_API_KEY       = local.secret_names.GOOGLE_PLACES_API_KEY
    _SECRET_GOOGLE_PLACES_ENDPOINT      = local.secret_names.GOOGLE_PLACES_ENDPOINT
    _SECRET_GOOGLE_PLACES_LANGUAGE_CODE = local.secret_names.GOOGLE_PLACES_LANGUAGE_CODE
    _SECRET_GOOGLE_PLACES_REGION_CODE   = local.secret_names.GOOGLE_PLACES_REGION_CODE
    _SECRET_GEMINI_API_KEY              = local.secret_names.GEMINI_API_KEY
    _SECRET_GEMINI_API_BASE_URL         = local.secret_names.GEMINI_API_BASE_URL
    _SECRET_GEMINI_MODEL                = local.secret_names.GEMINI_MODEL
  }

  depends_on = [module.artifact_registry, module.secret_manager, module.cloud_run]
}
