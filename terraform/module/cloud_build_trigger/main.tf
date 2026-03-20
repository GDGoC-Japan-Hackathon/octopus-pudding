resource "google_cloudbuild_trigger" "this" {
  project     = var.project_id
  name        = var.name
  description = var.description
  filename    = var.filename

  github {
    owner = var.github_owner
    name  = var.github_repo

    push {
      branch = var.github_branch_regex
    }
  }

  included_files = var.included_files
  substitutions  = var.substitutions
}
