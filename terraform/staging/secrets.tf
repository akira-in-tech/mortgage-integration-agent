# Runtime secrets, generated once and stored in Secrets Manager —
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

resource "random_id" "provider_data_key" {
  byte_length = 32
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

resource "aws_secretsmanager_secret" "provider_data_encryption_keys" {
  name                    = "mortgage-agent-staging/provider-data-encryption-keys"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "provider_data_encryption_keys" {
  secret_id     = aws_secretsmanager_secret.provider_data_encryption_keys.id
  secret_string = "staging-v1:${random_id.provider_data_key.hex}"
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
  secret_id = aws_secretsmanager_secret.database_url.id
  # RDS's default parameter group enforces rds.force_ssl - an
  # unencrypted connection is refused outright ("no pg_hba.conf entry
  # ... no encryption"), confirmed by a real failed migration run.
  # sslmode=require was the first fix tried, but this pg version treats
  # require/prefer/verify-ca as aliases for verify-full (a documented,
  # deliberate security hardening in pg-connection-string) - full chain
  # verification then failed against RDS's own AWS-issued certificate
  # ("self-signed certificate in certificate chain", also confirmed by
  # a real failed run). no-verify is pg-connection-string's distinct,
  # explicitly-supported mode for "encrypt, don't verify the chain" -
  # standard for this kind of managed database and adequate for a
  # synthetic staging environment with no real borrower data.
  secret_string = "postgres://mortgage:${random_password.rds_master.result}@${aws_db_instance.this.address}:5432/mortgage_agent?sslmode=no-verify"
}

resource "aws_secretsmanager_secret" "app_database_url" {
  name                    = "mortgage-agent-staging/app-database-url"
  recovery_window_in_days = 0 # see rds_master_password above
}

resource "aws_secretsmanager_secret_version" "app_database_url" {
  secret_id     = aws_secretsmanager_secret.app_database_url.id
  secret_string = "postgres://mortgage_app:${random_password.app_role.result}@${aws_db_instance.this.address}:5432/mortgage_agent?sslmode=no-verify" # see database_url above
}

resource "aws_secretsmanager_secret" "oidc_client_secret" {
  name                    = "mortgage-agent-staging/oidc-client-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "oidc_client_secret" {
  secret_id     = aws_secretsmanager_secret.oidc_client_secret.id
  secret_string = aws_cognito_user_pool_client.console.client_secret
}

resource "aws_secretsmanager_secret" "oidc_session_encryption_keys" {
  name                    = "mortgage-agent-staging/oidc-session-encryption-keys"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "oidc_session_encryption_keys" {
  secret_id     = aws_secretsmanager_secret.oidc_session_encryption_keys.id
  secret_string = "staging-v1:${random_id.oidc_session_key.hex}"
}

# The synthetic reviewer's password is a one-time walkthrough credential.
# Keep it in Secrets Manager, never in a Terraform output or CI log, so a
# human operator can retrieve it under their AWS identity without turning a
# simulated account into a repository secret.
resource "aws_secretsmanager_secret" "synthetic_reviewer_password" {
  name                    = "mortgage-agent-staging/synthetic-reviewer-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "synthetic_reviewer_password" {
  secret_id     = aws_secretsmanager_secret.synthetic_reviewer_password.id
  secret_string = random_password.cognito_demo_password.result
}
