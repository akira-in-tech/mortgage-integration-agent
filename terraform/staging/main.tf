# The actual staging stack — applied only from GitHub Actions
# (.github/workflows/deploy-staging.yml), authenticated via the OIDC
# role terraform/bootstrap/ created. Never apply this from a local
# machine with a personal AWS credential; it would diverge from the
# state CI tracks.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  # Real values (bucket, region, dynamodb_table) come from backend.hcl,
  # generated from terraform/bootstrap's own outputs — see
  # backend.hcl.example. `terraform init -backend-config=backend.hcl`.
  backend "s3" {
    key = "staging/terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "mortgage-integration-agent"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "mortgage-agent-staging"
}
