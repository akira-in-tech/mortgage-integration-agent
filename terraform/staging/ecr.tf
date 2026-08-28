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
