resource "aws_ecr_repository" "app" {
  name                 = "mortgage-agent"
  image_tag_mutability = "IMMUTABLE" # A pushed tag (the commit SHA) can never be silently repointed — the same real supply-chain reasoning M7-021 already applied to pinning GitHub Actions.

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the most recent 20 images; this is a staging repo, not a long-term artifact archive."
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

# The model image is distinct from the application image: Qwen's multi-GB
# artifact must not inflate API/worker rollout, pull, or rollback time.
resource "aws_ecr_repository" "ollama" {
  name                 = "mortgage-agent-ollama"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "ollama" {
  repository = aws_ecr_repository.ollama.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the most recent 5 Qwen images; each contains a multi-GB model artifact."
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}
