# ALB (public) -> App (api/worker/temporal, only from ALB or each
# other) -> RDS (only from App). Nothing reaches RDS or Temporal's
# 7233 from the internet; only port 80 on the ALB is public.

resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "Public HTTP, no ACM certificate yet, see README"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

## M7-075: every one of this security group's rules lives in a standalone
## aws_security_group_rule resource, deliberately -- none are declared
## inline on the aws_security_group block below. A real, live, twice-
## repeated incident (2026-09-03) traced back to exactly the anti-pattern
## this avoids: this resource used to declare its port-3000 ingress and
## its egress inline while app_internal (below) was a *separate* rule
## resource on the same security group. Terraform's AWS provider treats a
## security group's own inline ingress/egress blocks as the complete,
## authoritative rule set for that direction -- so *any* unrelated
## in-place update to this resource (a tag, a description, anything)
## silently revoked app_internal, since it wasn't part of that inline
## list. That reached production twice: the first time was worked around
## by re-applying (restoring the rule, not the cause); the second time it
## took the live API down for real (ECS killed every task once
## /health/ready's own real Temporal check -- see
## src/health/health.controller.ts -- correctly started reporting the
## resulting unreachable Temporal). Never mix inline and standalone rules
## on one security group; every rule here is standalone so no future
## unrelated change to this resource can ever silently drop another one.
resource "aws_security_group" "app" {
  name_prefix = "${local.name}-app-"
  vpc_id      = aws_vpc.this.id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "app_ingress_from_alb" {
  type                     = "ingress"
  description              = "API port, from the ALB only"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.app.id
  source_security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "app_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.app.id
}

# Self-referencing rule so api/worker can each reach temporal's 7233
# and vice versa, without a public entry point of its own — all three
# services share this one security group.
resource "aws_security_group_rule" "app_internal" {
  type              = "ingress"
  from_port         = 0
  to_port           = 65535
  protocol          = "tcp"
  security_group_id = aws_security_group.app.id
  self              = true
}

# Qwen's Ollama endpoint is a private, worker-only dependency. It has no
# public listener and accepts traffic solely from the application task group.
resource "aws_security_group" "inference" {
  name_prefix = "${local.name}-inference-"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Ollama inference, from API/worker tasks only"
    from_port       = 11434
    to_port         = 11434
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name}-rds-"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Postgres, from the app security group only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}
