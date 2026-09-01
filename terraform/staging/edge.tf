# AWS-only browser edge: CloudFront owns the public HTTPS origin and sends
# dynamic API requests through an HTTP API. The public ALB is retained for the
# small Fargate stack, but accepts application traffic only when API Gateway
# adds the unguessable origin header below.

resource "random_password" "edge_origin" {
  length  = 48
  special = false
}

resource "random_password" "cognito_demo_password" {
  length  = 32
  special = true
}

resource "random_id" "oidc_session_key" {
  byte_length = 32
}

resource "aws_s3_bucket" "console" {
  bucket = "${local.name}-console-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "console" {
  bucket                  = aws_s3_bucket.console.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "console" {
  bucket = aws_s3_bucket.console.id
  rule { object_ownership = "BucketOwnerEnforced" }
}

resource "aws_cloudfront_origin_access_control" "console" {
  name                              = "${local.name}-console"
  description                       = "CloudFront-only access to the staging console assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudwatch_log_group" "edge_api" {
  name              = "/aws/apigateway/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_apigatewayv2_api" "edge" {
  name          = "${local.name}-edge"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "app" {
  api_id                 = aws_apigatewayv2_api.edge.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://${aws_lb.this.dns_name}"
  payload_format_version = "1.0"
  timeout_milliseconds   = 29000

  # HTTP API transformations use append/overwrite/remove keys. This header
  # is independent of browser credentials and exists only to prevent callers
  # from bypassing the HTTPS edge through the ALB's public DNS name.
  request_parameters = {
    "overwrite:header.x-mortgage-edge-origin" = random_password.edge_origin.result
  }
}

resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.edge.id
  route_key = "ANY /v1/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.app.id}"
}

resource "aws_apigatewayv2_route" "graphql" {
  api_id    = aws_apigatewayv2_api.edge.id
  route_key = "ANY /graphql"
  target    = "integrations/${aws_apigatewayv2_integration.app.id}"
}

# Deployment verification uses the same public HTTPS edge as the browser, so
# readiness must be routable through API Gateway as well as the ALB. The app's
# health endpoints expose no tenant or borrower data; authenticated business
# routes remain limited to the /v1 and /graphql routes above.
resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.edge.id
  route_key = "ANY /health/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.app.id}"
}

resource "aws_apigatewayv2_stage" "edge" {
  api_id      = aws_apigatewayv2_api.edge.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.edge_api.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      requestTime    = "$context.requestTime"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      integrationErr = "$context.integrationErrorMessage"
    })
  }
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "${local.name}-api-viewer-request"
  comment = "Forward browser session cookies, CSRF, tenant context, and query strings to the API edge"

  cookies_config { cookie_behavior = "all" }
  headers_config {
    header_behavior = "allExcept"
    headers { items = ["host"] }
  }
  query_strings_config { query_string_behavior = "all" }
}

resource "aws_cloudfront_distribution" "console" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name} synthetic operations console"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  wait_for_deployment = true

  origin {
    domain_name              = aws_s3_bucket.console.bucket_regional_domain_name
    origin_id                = "console-assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.console.id
  }

  origin {
    domain_name = trimprefix(aws_apigatewayv2_api.edge.api_endpoint, "https://")
    origin_id   = "api-edge"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "console-assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["HEAD", "GET", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  ordered_cache_behavior {
    path_pattern             = "/v1/*"
    target_origin_id         = "api-edge"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }

  ordered_cache_behavior {
    path_pattern           = "/graphql"
    target_origin_id       = "api-edge"
    viewer_protocol_policy = "https-only"
    # CloudFront supports only its three documented method sets. GraphQL needs
    # POST, so it must use the full mutating set; application routes and the
    # authenticated API layer remain the authority for accepted operations.
    allowed_methods          = ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }

  ordered_cache_behavior {
    path_pattern             = "/health/*"
    target_origin_id         = "api-edge"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["HEAD", "GET", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_s3_bucket_policy" "console" {
  bucket = aws_s3_bucket.console.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.console.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.console.arn }
      }
    }]
  })
}

resource "aws_cognito_user_pool" "console" {
  name                = "${local.name}-console"
  deletion_protection = "INACTIVE"
  mfa_configuration   = "OFF"
  username_configuration { case_sensitive = false }
  admin_create_user_config { allow_admin_create_user_only = true }

  password_policy {
    minimum_length                   = 16
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 1
  }
}

resource "aws_cognito_user_pool_domain" "console" {
  domain       = "mortgage-agent-staging-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.console.id
}

resource "aws_cognito_user_pool_client" "console" {
  name                                 = "${local.name}-console"
  user_pool_id                         = aws_cognito_user_pool.console.id
  generate_secret                      = true
  prevent_user_existence_errors        = "ENABLED"
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls = [
    "https://${aws_cloudfront_distribution.console.domain_name}/v1/auth/session/callback",
  ]
  logout_urls = ["https://${aws_cloudfront_distribution.console.domain_name}/"]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 1
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

resource "aws_cognito_user" "synthetic_reviewer" {
  user_pool_id = aws_cognito_user_pool.console.id
  username     = "synthetic-reviewer"
  password     = random_password.cognito_demo_password.result
}
