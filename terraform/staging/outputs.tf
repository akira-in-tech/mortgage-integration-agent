output "alb_dns_name" {
  description = "http://<this>/health/ready should return 200 once a deploy finishes — the real verification step, not just a clean `terraform apply`."
  value       = aws_lb.this.dns_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ollama_ecr_repository_url" {
  description = "Private ECR repository containing the immutable Qwen/Ollama inference image."
  value       = aws_ecr_repository.ollama.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "migrate_task_definition_arn" {
  description = "Passed to `aws ecs run-task` by the deploy workflow."
  value       = aws_ecs_task_definition.migrate.arn
}

output "rds_endpoint" {
  value = aws_db_instance.this.address
}

# The four outputs below exist for .github/workflows/staging-drill.yml's
# backup/restore drill: it runs plain `aws` CLI calls directly in the
# GitHub Actions job (not Terraform local-exec), so it needs these
# identifiers surfaced the same way the deploy workflow already gets
# ecs_cluster_name/migrate_task_definition_arn above, rather than trying
# to re-derive a security group's real name from its `name_prefix`.
output "app_security_group_id" {
  description = "Security group the api/worker/temporal tasks run in - also what the drill's one-off verification task uses so it can reach the restored RDS instance."
  value       = aws_security_group.app.id
}

output "rds_security_group_id" {
  description = "Attached to the backup/restore drill's temporary restored instance, so only the app security group (not the whole VPC) can reach it - same boundary the real instance has."
  value       = aws_security_group.rds.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "console_url" {
  description = "Public AWS-managed HTTPS URL for the synthetic operations console."
  value       = "https://${aws_cloudfront_distribution.console.domain_name}"
}

output "console_bucket_name" {
  description = "Private console-asset bucket populated only by the staging CI workflow."
  value       = aws_s3_bucket.console.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.console.id
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.console.id
}

output "rds_db_subnet_group_name" {
  value = aws_db_subnet_group.this.name
}
