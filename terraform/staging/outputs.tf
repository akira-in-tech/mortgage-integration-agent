output "alb_dns_name" {
  description = "http://<this>/health/ready should return 200 once a deploy finishes — the real verification step, not just a clean `terraform apply`."
  value       = aws_lb.this.dns_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
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
