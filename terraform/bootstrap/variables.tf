variable "aws_region" {
  description = "AWS region the staging stack will live in. Bootstrap resources (IAM, the OIDC provider) are global, but the state bucket/lock table need one region."
  type        = string
  default     = "us-east-1"
}

variable "github_repository" {
  description = "GitHub repository in \"owner/name\" form, e.g. \"akira-in-tech/mortgage-integration-agent\". The IAM role's trust policy is scoped to exactly this repository."
  type        = string
}

variable "github_allowed_branches" {
  description = "Branches allowed to assume the deploy role via OIDC (workflow_dispatch runs on whatever branch it's dispatched against). Keep this list to branches that should ever be able to deploy."
  type        = list(string)
  default     = ["main", "project-bugfix-unit-tests"]
}

variable "state_bucket_name" {
  description = "Globally-unique S3 bucket name for terraform/staging/'s remote state. S3 bucket names are global across all AWS accounts, so this needs to be distinctive."
  type        = string
}

variable "role_name" {
  description = "Name of the IAM role GitHub Actions assumes to deploy the staging stack."
  type        = string
  default     = "mortgage-agent-staging-deploy"
}
