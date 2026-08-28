# Run this module yourself, from your own machine, with your own AWS
# credentials — never through an agent, never with credentials pasted
# into a chat. It creates exactly two things GitHub Actions needs to
# deploy terraform/staging/ without ever holding a long-lived AWS
# access key:
#   1. A GitHub OIDC identity provider + an IAM role CI can assume,
#      scoped to this one repository and its named branches.
#   2. An S3 bucket + DynamoDB table for terraform/staging/'s own
#      remote state, so repeated `terraform apply` runs from CI don't
#      race each other or lose state between runs.
#
# After applying, hand over only the outputs (role ARN, account id,
# state bucket name) — none of them are secrets, they're identifiers.
# See README.md in this directory for exact commands.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Deliberately local state for the bootstrap module itself — it
  # creates the remote-state backend that terraform/staging/ uses, so
  # it can't depend on that backend already existing. Keep the
  # resulting terraform.tfstate file private; it is not committed
  # (see .gitignore).
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
