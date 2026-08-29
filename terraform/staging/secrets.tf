# Three real secrets, generated once and stored in Secrets Manager —
# never in Terraform state as plaintext beyond what the provider itself
# necessarily tracks, never as a plain ECS task-definition environment
# variable. See src/database/migrations/1787082648663-AppRuntimeRole.ts
# and src/config/env.validation.ts's own OUTBOX_SIGNING_SECRET comment
# for why the app refuses to run on demo defaults in a real deployment.

resource "random_password" "rds_master" {
  length  = 32
  special = false # RDS master passwords reject several special characters; alnum is plenty of entropy at this length.
}

resource "random_password" "app_role" {
  length  = 32
  special = false
}

resource "random_password" "outbox_signing_secret" {
  length  = 40
  special = false
}

resource "aws_secretsmanager_secret" "rds_master_password" {
  name = "mortgage-agent-staging/rds-master-password"
  # Secrets Manager's default delete is a soft delete with a recovery
  # window - a resource that gets replaced (tainted, or an attribute
  # change) tries to delete-then-recreate with the same name, and the
  # create half fails outright while the old one is still "pending
  # deletion". A synthetic staging secret has no real backup/restore
  # need of its own to protect against accidental deletion, so skip
  # the recovery window rather than risk this exact deadlock again.
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "rds_master_password" {
  secret_id     = aws_secretsmanager_secret.rds_master_password.id
  secret_string = random_password.rds_master.result
}

resource "aws_secretsmanager_secret" "app_role_password" {
  name                    = "mortgage-agent-staging/app-role-password"
  recovery_window_in_days = 0 # see rds_master_password above
}

resource "aws_secretsmanager_secret_version" "app_role_password" {
  secret_id     = aws_secretsmanager_secret.app_role_password.id
  secret_string = random_password.app_role.result
}

resource "aws_secretsmanager_secret" "outbox_signing_secret" {
  name                    = "mortgage-agent-staging/outbox-signing-secret"
  recovery_window_in_days = 0 # see rds_master_password above
}

resource "aws_secretsmanager_secret_version" "outbox_signing_secret" {
  secret_id     = aws_secretsmanager_secret.outbox_signing_secret.id
  secret_string = random_password.outbox_signing_secret.result
}

# ECS task-definition `secrets` can only inject a *whole* environment
# variable from one Secrets Manager value — there is no way to splice a
# bare password into the middle of a larger string at the ECS layer.
# So the full connection strings (password included) are their own
# secrets here, never assembled from a bare password inline in a plain
# `environment` entry, which would otherwise leave the master password
# readable in plaintext to anyone who can call ecs:DescribeTaskDefinition
# (a much wider audience than Secrets Manager's own access boundary).
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "mortgage-agent-staging/database-url"
  recovery_window_in_days = 0 # see rds_master_password above
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgres://mortgage:${random_password.rds_master.result}@${aws_db_instance.this.address}:5432/mortgage_agent"
}

resource "aws_secretsmanager_secret" "app_database_url" {
  name                    = "mortgage-agent-staging/app-database-url"
  recovery_window_in_days = 0 # see rds_master_password above
}

resource "aws_secretsmanager_secret_version" "app_database_url" {
  secret_id     = aws_secretsmanager_secret.app_database_url.id
  secret_string = "postgres://mortgage_app:${random_password.app_role.result}@${aws_db_instance.this.address}:5432/mortgage_agent"
}
