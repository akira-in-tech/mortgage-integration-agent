# The ALB stays HTTP-only inside the AWS edge. CloudFront owns the browser's
# public TLS endpoint with its AWS-managed certificate, while API Gateway's
# generated header prevents the ALB DNS name from becoming a second public
# application origin. This remains synthetic staging infrastructure.

resource "aws_lb" "this" {
  name               = local.name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name}-api"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip" # Fargate awsvpc mode registers task ENIs directly, not instances.

  health_check {
    path                = "/health/ready"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
    matcher             = "200"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    # Only the API Gateway integration may forward application requests.
    # The public health rule below remains intentionally narrow so the CI
    # deployment check does not need a browser credential.
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      status_code  = "403"
      message_body = "{\"message\":\"Edge gateway required\"}"
    }
  }
}

resource "aws_lb_listener_rule" "health" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
  condition {
    path_pattern {
      values = ["/health/*"]
    }
  }
}

resource "aws_lb_listener_rule" "edge" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
  condition {
    http_header {
      http_header_name = "x-mortgage-edge-origin"
      values           = [random_password.edge_origin.result]
    }
  }
}
