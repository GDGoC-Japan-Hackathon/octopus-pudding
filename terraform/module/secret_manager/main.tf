locals {
  secret_keys = nonsensitive(toset(keys(var.secret_values)))
}

resource "google_secret_manager_secret" "this" {
  for_each = local.secret_keys

  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "initial" {
  for_each = google_secret_manager_secret.this

  secret      = each.value.id
  secret_data = var.secret_values[each.key]
}
