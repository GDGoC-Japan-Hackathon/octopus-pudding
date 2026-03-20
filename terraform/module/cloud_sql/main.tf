resource "google_sql_database_instance" "this" {
  project             = var.project_id
  region              = var.region
  name                = var.instance_name
  database_version    = var.database_version
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    disk_type         = var.disk_type
    disk_size         = var.disk_size_gb

    backup_configuration {
      enabled = true
    }

    ip_configuration {
      ipv4_enabled = true

      authorized_networks {
        name  = "dev-open"
        value = var.authorized_cidr
      }
    }
  }
}

resource "google_sql_database" "app" {
  project  = var.project_id
  name     = var.db_name
  instance = google_sql_database_instance.this.name
}

resource "google_sql_user" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.this.name
  name     = var.db_user
  password = var.db_password
}
