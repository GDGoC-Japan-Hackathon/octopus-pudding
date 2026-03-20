variable "project_id" {
  type = string
}

variable "name" {
  type = string
}

variable "description" {
  type    = string
  default = "Backend Cloud Build trigger"
}

variable "filename" {
  type    = string
  default = "backend/cloudbuild.yaml"
}

variable "github_owner" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "github_branch_regex" {
  type = string
}

variable "included_files" {
  type    = list(string)
  default = ["backend/**"]
}

variable "substitutions" {
  type    = map(string)
  default = {}
}
