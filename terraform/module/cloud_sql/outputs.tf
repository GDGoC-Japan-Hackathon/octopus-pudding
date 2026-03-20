output "instance_name" {
  value = google_sql_database_instance.this.name
}

output "connection_name" {
  value = google_sql_database_instance.this.connection_name
}

output "public_ip" {
  value = one([
    for ip in google_sql_database_instance.this.ip_address :
    ip.ip_address if ip.type == "PRIMARY"
  ])
}

output "db_name" {
  value = google_sql_database.app.name
}

output "db_user" {
  value = google_sql_user.app.name
}
