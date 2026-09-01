resource "aws_ecs_cluster" "this" {
  name = local.name
}

# Private DNS so api/worker can reach temporal by a stable name
# ("temporal.mortgage-agent-staging.local:7233") instead of a Fargate
# task's own ephemeral IP, which changes every deploy/restart.
resource "aws_service_discovery_private_dns_namespace" "this" {
  name = "${local.name}.local"
  vpc  = aws_vpc.this.id
}

resource "aws_service_discovery_service" "temporal" {
  name = "temporal"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.this.id
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  health_check_custom_config {
    failure_threshold = 1
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}-api"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}-worker"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "temporal" {
  name              = "/ecs/${local.name}-temporal"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/ecs/${local.name}-migrate"
  retention_in_days = var.log_retention_days
}

# --- Task execution role: what ECS itself needs to start a task
# (pull the image, write logs, read the secrets a task definition
# references) — distinct from a task role, which is what the
# *application code* would use for its own AWS API calls. This app
# makes none at runtime, so there is no separate task role.
data "aws_iam_policy_document" "execution_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.execution_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.rds_master_password.arn,
      aws_secretsmanager_secret.app_role_password.arn,
      aws_secretsmanager_secret.outbox_signing_secret.arn,
      aws_secretsmanager_secret.database_url.arn,
      aws_secretsmanager_secret.app_database_url.arn,
      aws_secretsmanager_secret.provider_data_encryption_keys.arn,
      aws_secretsmanager_secret.oidc_client_secret.arn,
      aws_secretsmanager_secret.oidc_session_encryption_keys.arn,
    ]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "${local.name}-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

locals {
  ecr_image    = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
  temporal_dns = "temporal.${aws_service_discovery_private_dns_namespace.this.name}"

  # DATABASE_URL is a real requirement of env.validation.ts in every
  # environment, but createTypeOrmOptions() swaps in APP_DATABASE_URL
  # for the actual connection whenever NODE_ENV is staging/production —
  # so the admin URL is still injected here (from Secrets Manager, never
  # plaintext) purely to satisfy that startup check, not because the app
  # connects with it.
  # All application processes require the database, signing, and provider-data
  # secrets. Only the browser-facing API is an OIDC relying party, so its
  # client/session secrets stay separate instead of making worker startup
  # depend on human-login configuration it never uses.
  app_secret_env = [
    { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
    { name = "APP_DATABASE_URL", valueFrom = aws_secretsmanager_secret.app_database_url.arn },
    { name = "OUTBOX_SIGNING_SECRET", valueFrom = aws_secretsmanager_secret.outbox_signing_secret.arn },
    { name = "PROVIDER_DATA_ENCRYPTION_KEYS", valueFrom = aws_secretsmanager_secret.provider_data_encryption_keys.arn },
  ]

  api_oidc_secret_env = [
    { name = "OIDC_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.oidc_client_secret.arn },
    { name = "OIDC_SESSION_ENCRYPTION_KEYS", valueFrom = aws_secretsmanager_secret.oidc_session_encryption_keys.arn },
  ]
}

# --- Temporal (self-hosted, same image and Postgres backend the local
# docker-compose stack already uses) ---
resource "aws_ecs_task_definition" "temporal" {
  family                   = "${local.name}-temporal"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name         = "temporal"
    image        = "temporalio/auto-setup:1.29.7"
    portMappings = [{ containerPort = 7233, protocol = "tcp" }]
    environment = [
      { name = "DB", value = "postgres12" },
      { name = "DB_PORT", value = "5432" },
      { name = "POSTGRES_USER", value = "mortgage" },
      { name = "POSTGRES_SEEDS", value = aws_db_instance.this.address },
      # RDS rejects plaintext PostgreSQL sessions. Temporal's auto-setup
      # utility and the running server use different TLS variable families,
      # so both are set explicitly. Host verification remains disabled only
      # because this synthetic stack does not mount the RDS CA bundle; the
      # connection is still encrypted in transit.
      { name = "POSTGRES_TLS_ENABLED", value = "true" },
      { name = "POSTGRES_TLS_DISABLE_HOST_VERIFICATION", value = "true" },
      { name = "SQL_TLS_ENABLED", value = "true" },
      { name = "SQL_HOST_VERIFICATION", value = "false" },
    ]
    secrets = [
      { name = "POSTGRES_PWD", valueFrom = aws_secretsmanager_secret.rds_master_password.arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.temporal.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "temporal"
      }
    }
  }])

  # Revisions are immutable, but a new one can coexist with the old one -
  # there's no real reason to deregister the old revision before the new
  # one exists. Also breaks a real dependency-graph "Cycle" error the
  # default destroy-then-create order produced together with
  # null_resource.migrate and the services that depend_on it below.
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_service" "temporal" {
  name            = "${local.name}-temporal"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.temporal.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  # A successful apply must mean the replacement task is actually stable,
  # not merely that ECS accepted its desired task-definition revision.
  wait_for_steady_state = true

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.temporal.arn
  }
}

# --- API ---
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name         = "api"
    image        = local.ecr_image
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV", value = "staging" },
      { name = "PORT", value = "3000" },
      { name = "DECISION_PROVIDER", value = "rules" },
      { name = "TEMPORAL_ADDRESS", value = "${local.temporal_dns}:7233" },
      # Cognito exposes its issuer hostname without a URI scheme. The
      # application validates OIDC issuers as HTTPS URLs before startup, so
      # construct the standards-compliant issuer instead of passing the bare
      # provider hostname into the task environment.
      { name = "OIDC_ISSUER_URL", value = "https://${aws_cognito_user_pool.console.endpoint}" },
      { name = "OIDC_AUDIENCE", value = aws_cognito_user_pool_client.console.id },
      { name = "OIDC_CLIENT_ID", value = aws_cognito_user_pool_client.console.id },
      { name = "OIDC_CALLBACK_URL", value = "https://${aws_cloudfront_distribution.console.domain_name}/v1/auth/session/callback" },
      { name = "CONSOLE_ORIGIN", value = "https://${aws_cloudfront_distribution.console.domain_name}" },
      { name = "CORS_ALLOWED_ORIGINS", value = "https://${aws_cloudfront_distribution.console.domain_name}" },
    ]
    secrets = [
      for e in concat(local.app_secret_env, local.api_oidc_secret_env) : { name = e.name, valueFrom = e.valueFrom }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])

  lifecycle {
    create_before_destroy = true # see aws_ecs_task_definition.temporal above
  }
}

resource "aws_ecs_service" "api" {
  name                  = "${local.name}-api"
  cluster               = aws_ecs_cluster.this.id
  task_definition       = aws_ecs_task_definition.api.arn
  desired_count         = 1
  launch_type           = "FARGATE"
  wait_for_steady_state = true
  depends_on = [
    aws_ecs_service.temporal,
    null_resource.migrate,
    null_resource.synthetic_demo_bootstrap,
  ]

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }
}

# --- Worker ---
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name    = "worker"
    image   = local.ecr_image
    command = ["node", "dist/worker"]
    environment = [
      { name = "NODE_ENV", value = "staging" },
      { name = "DECISION_PROVIDER", value = "rules" },
      { name = "TEMPORAL_ADDRESS", value = "${local.temporal_dns}:7233" },
    ]
    secrets = [
      for e in local.app_secret_env : { name = e.name, valueFrom = e.valueFrom }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])

  lifecycle {
    create_before_destroy = true # see aws_ecs_task_definition.temporal above
  }
}

resource "aws_ecs_service" "worker" {
  name                  = "${local.name}-worker"
  cluster               = aws_ecs_cluster.this.id
  task_definition       = aws_ecs_task_definition.worker.arn
  desired_count         = 1
  launch_type           = "FARGATE"
  wait_for_steady_state = true
  depends_on = [
    aws_ecs_service.temporal,
    null_resource.migrate,
    null_resource.synthetic_demo_bootstrap,
  ]

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }
}

# --- One-off migration task: registered here so its definition lives
# in version control like everything else, but never run as a
# `service` — the deploy workflow invokes it directly with
# `aws ecs run-task` and waits for it to exit before touching api/worker.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name  = "migrate"
    image = local.ecr_image
    # Not `npm run migration:run` - that script hardcodes `-d
    # src/database/data-source.ts` and runs through ts-node, and this
    # image's runtime stage has neither the raw src/ tree nor ts-node
    # (a dev dependency, excluded by `npm ci --omit=dev` in the
    # Dockerfile). data-source.ts's own entity/migration globs already
    # match compiled `.js` for exactly this case - just point the plain
    # typeorm CLI (a real production dependency) at the compiled file. The
    # rotation runs in the same blocking task after DDL and before API/worker
    # rollout, so legacy plaintext JSONB cannot reach the production-like
    # processes that deliberately reject it.
    command = ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js && node dist/rotate-sensitive-data-encryption.js"]
    # Real DDL rights — migrations run as the admin role, never the
    # restricted mortgage_app role AppRuntimeRole itself creates.
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "APP_DATABASE_ROLE_PASSWORD", valueFrom = aws_secretsmanager_secret.app_role_password.arn },
      { name = "PROVIDER_DATA_ENCRYPTION_KEYS", valueFrom = aws_secretsmanager_secret.provider_data_encryption_keys.arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.migrate.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "migrate"
      }
    }
  }])

  lifecycle {
    create_before_destroy = true # see aws_ecs_task_definition.temporal above
  }
}

# A one-off, idempotent staging-only task establishes the Cognito reviewer's
# application-side User/TenantMembership mapping. Cognito proves identity;
# this database membership remains the independent tenant authorization gate.
resource "aws_ecs_task_definition" "synthetic_demo_bootstrap" {
  family                   = "${local.name}-synthetic-demo-bootstrap"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name    = "synthetic-demo-bootstrap"
    image   = local.ecr_image
    command = ["node", "dist/bootstrap-synthetic-demo.js"]
    environment = [
      { name = "NODE_ENV", value = "staging" },
      { name = "SYNTHETIC_DEMO_BOOTSTRAP", value = "true" },
      { name = "DEMO_OIDC_SUBJECT", value = aws_cognito_user.synthetic_reviewer.sub },
      { name = "DEMO_OIDC_EMAIL", value = "synthetic-reviewer@example.invalid" },
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.migrate.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "synthetic-demo-bootstrap"
      }
    }
  }])

  lifecycle { create_before_destroy = true }
}

# Actually runs the migration task and blocks the rest of this apply
# until it exits — real ordering (schema migrated before api/worker
# ever see the new image), enforced by Terraform's own dependency
# graph via api/worker's `depends_on` below, not by a separate,
# easy-to-reorder step in the GitHub Actions workflow. Uses the same
# assumed-role credentials this whole `terraform apply` is already
# running with; the runner (GitHub Actions or a human with the same
# role) needs the AWS CLI, which every GitHub-hosted runner ships with.
resource "null_resource" "migrate" {
  triggers = {
    migrate_task_definition = aws_ecs_task_definition.migrate.arn
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      task_arn=$(aws ecs run-task \
        --cluster "${aws_ecs_cluster.this.name}" \
        --task-definition "${aws_ecs_task_definition.migrate.arn}" \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${join(",", aws_subnet.public[*].id)}],securityGroups=[${aws_security_group.app.id}],assignPublicIp=ENABLED}" \
        --region "${var.aws_region}" \
        --query 'tasks[0].taskArn' --output text)
      echo "Migration task: $task_arn"
      aws ecs wait tasks-stopped --cluster "${aws_ecs_cluster.this.name}" --tasks "$task_arn" --region "${var.aws_region}"
      exit_code=$(aws ecs describe-tasks --cluster "${aws_ecs_cluster.this.name}" --tasks "$task_arn" --region "${var.aws_region}" --query 'tasks[0].containers[0].exitCode' --output text)
      echo "Migration task exit code: $exit_code"
      if [ "$exit_code" != "0" ]; then
        echo "Migration failed - check CloudWatch Logs group ${aws_cloudwatch_log_group.migrate.name}" >&2
        exit 1
      fi
    EOT
  }

  lifecycle {
    create_before_destroy = true # see aws_ecs_task_definition.temporal above
  }
}

resource "null_resource" "synthetic_demo_bootstrap" {
  triggers = {
    task_definition = aws_ecs_task_definition.synthetic_demo_bootstrap.arn
    reviewer_sub    = aws_cognito_user.synthetic_reviewer.sub
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      task_arn=$(aws ecs run-task \
        --cluster "${aws_ecs_cluster.this.name}" \
        --task-definition "${aws_ecs_task_definition.synthetic_demo_bootstrap.arn}" \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${join(",", aws_subnet.public[*].id)}],securityGroups=[${aws_security_group.app.id}],assignPublicIp=ENABLED}" \
        --region "${var.aws_region}" \
        --query 'tasks[0].taskArn' --output text)
      aws ecs wait tasks-stopped --cluster "${aws_ecs_cluster.this.name}" --tasks "$task_arn" --region "${var.aws_region}"
      exit_code=$(aws ecs describe-tasks --cluster "${aws_ecs_cluster.this.name}" --tasks "$task_arn" --region "${var.aws_region}" --query 'tasks[0].containers[0].exitCode' --output text)
      test "$exit_code" = "0"
    EOT
  }
}
