output "deploy_role_arn" {
  description = "Give this to whoever wires up .github/workflows/deploy-staging.yml — not a secret, just an identifier."
  value       = aws_iam_role.deploy.arn
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "state_bucket_name" {
  value = aws_s3_bucket.state.bucket
}

output "state_lock_table_name" {
  value = aws_dynamodb_table.state_lock.name
}

output "aws_region" {
  value = var.aws_region
}
