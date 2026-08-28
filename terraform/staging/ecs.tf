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
  app_secret_env = [
    { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
    { name = "APP_DATABASE_URL", valueFrom = aws_secretsmanager_secret.app_database_url.arn },
    { name = "OUTBOX_SIGNING_SECRET", valueFrom = aws_secretsmanager_secret.outbox_signing_secret.arn },
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
}

resource "aws_ecs_service" "temporal" {
  name            = "${local.name}-temporal"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.temporal.arn
  desired_count   = 1
  launch_type     = "FARGATE"

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
    ]
    secrets = [
      for e in local.app_secret_env : { name = e.name, valueFrom = e.valueFrom }
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
}

resource "aws_ecs_service" "api" {
  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  depends_on      = [aws_ecs_service.temporal, null_resource.migrate]

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
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  depends_on      = [aws_ecs_service.temporal, null_resource.migrate]

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
    name    = "migrate"
    image   = local.ecr_image
    command = ["npm", "run", "migration:run"]
    # Real DDL rights — migrations run as the admin role, never the
    # restricted mortgage_app role AppRuntimeRole itself creates.
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "APP_DATABASE_ROLE_PASSWORD", valueFrom = aws_secretsmanager_secret.app_role_password.arn },
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
}
