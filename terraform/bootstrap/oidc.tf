# GitHub's OIDC provider — the intermediate CA thumbprint below is the
# well-known, publicly documented value every AWS+GitHub OIDC setup
# uses (AWS also validates against its own trusted root bundle for
# this provider; the thumbprint is kept for backward compatibility
# with how the resource is defined).
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
  client_id_list = [
    "sts.amazonaws.com",
  ]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # One ref: pattern per allowed branch — a workflow_dispatch run's
    # own sub claim is "repo:OWNER/REPO:ref:refs/heads/BRANCH", so this
    # is what actually limits which branches can ever deploy, not just
    # which repository.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        for branch in var.github_allowed_branches :
        "repo:${var.github_repository}:ref:refs/heads/${branch}"
      ]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = var.role_name
  assume_role_policy = data.aws_iam_policy_document.github_trust.json
}

# Scoped to the specific services and, where the service actually
# supports it, the specific resource-name prefix this stack uses
# ("mortgage-agent-staging*") — not AdministratorAccess. Several AWS
# services (EC2 VPC networking, ELBv2, ECS RegisterTaskDefinition) have
# no resource-level IAM permissions for their create/describe actions
# at all; those are scoped by action only, which is the real, standard
# ceiling for this class of Terraform-driven infrastructure, not a
# shortcut taken here.
data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    sid    = "NetworkingUnscopable"
    effect = "Allow"
    actions = [
      "ec2:DescribeVpcs", "ec2:CreateVpc", "ec2:DeleteVpc", "ec2:ModifyVpcAttribute", "ec2:DescribeVpcAttribute",
      "ec2:DescribeSubnets", "ec2:CreateSubnet", "ec2:DeleteSubnet", "ec2:ModifySubnetAttribute",
      "ec2:DescribeInternetGateways", "ec2:CreateInternetGateway", "ec2:DeleteInternetGateway",
      "ec2:AttachInternetGateway", "ec2:DetachInternetGateway",
      "ec2:DescribeRouteTables", "ec2:CreateRouteTable", "ec2:DeleteRouteTable",
      "ec2:CreateRoute", "ec2:DeleteRoute", "ec2:AssociateRouteTable", "ec2:DisassociateRouteTable",
      "ec2:DescribeSecurityGroups", "ec2:DescribeSecurityGroupRules", "ec2:CreateSecurityGroup", "ec2:DeleteSecurityGroup",
      "ec2:AuthorizeSecurityGroupIngress", "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress",
      "ec2:DescribeAvailabilityZones", "ec2:DescribeAccountAttributes",
      "ec2:CreateTags", "ec2:DeleteTags", "ec2:DescribeTags",
      "ec2:DescribeNetworkInterfaces",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "LoadBalancerUnscopable"
    effect    = "Allow"
    actions   = ["elasticloadbalancing:*"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrRepository"
    effect = "Allow"
    actions = [
      "ecr:CreateRepository", "ecr:DeleteRepository", "ecr:DescribeRepositories",
      "ecr:SetRepositoryPolicy", "ecr:GetRepositoryPolicy", "ecr:TagResource",
      "ecr:ListTagsForResource",
      "ecr:PutLifecyclePolicy", "ecr:GetLifecyclePolicy", "ecr:DeleteLifecyclePolicy",
      "ecr:BatchDeleteImage", "ecr:ListImages", "ecr:DescribeImages",
      "ecr:BatchGetImage", "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer",
      "ecr:PutImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload",
    ]
    resources = ["arn:aws:ecr:*:${data.aws_caller_identity.current.account_id}:repository/mortgage-agent*"]
  }

  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcsCluster"
    effect = "Allow"
    actions = [
      "ecs:CreateCluster", "ecs:DeleteCluster", "ecs:DescribeClusters",
      "ecs:CreateService", "ecs:UpdateService", "ecs:DeleteService", "ecs:DescribeServices",
      "ecs:RunTask", "ecs:StopTask", "ecs:DescribeTasks", "ecs:ListTasks",
      "ecs:TagResource", "ecs:UntagResource", "ecs:ListTagsForResource",
    ]
    resources = [
      "arn:aws:ecs:*:${data.aws_caller_identity.current.account_id}:cluster/mortgage-agent-staging*",
      "arn:aws:ecs:*:${data.aws_caller_identity.current.account_id}:service/mortgage-agent-staging*/*",
      "arn:aws:ecs:*:${data.aws_caller_identity.current.account_id}:task/mortgage-agent-staging*/*",
      "arn:aws:ecs:*:${data.aws_caller_identity.current.account_id}:task-definition/mortgage-agent-staging*:*",
      # ecs:ListTasks checks against this resource type regardless of
      # launch type - Fargate has no real "container instances", but a
      # real AccessDeniedException from the failure-recovery drill
      # named this exact ARN pattern, so it's required anyway.
      "arn:aws:ecs:*:${data.aws_caller_identity.current.account_id}:container-instance/mortgage-agent-staging*/*",
    ]
  }

  statement {
    sid    = "EcsUnscopable"
    effect = "Allow"
    actions = [
      "ecs:RegisterTaskDefinition", "ecs:DeregisterTaskDefinition",
      "ecs:DescribeTaskDefinition", "ecs:ListTaskDefinitions",
      "ecs:ListClusters", "ecs:ListServices",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "Rds"
    effect = "Allow"
    actions = [
      "rds:CreateDBInstance", "rds:DeleteDBInstance", "rds:ModifyDBInstance",
      "rds:DescribeDBInstances", "rds:AddTagsToResource", "rds:ListTagsForResource",
      "rds:CreateDBSubnetGroup", "rds:DeleteDBSubnetGroup", "rds:DescribeDBSubnetGroups",
    ]
    resources = [
      "arn:aws:rds:*:${data.aws_caller_identity.current.account_id}:db:mortgage-agent-staging*",
      "arn:aws:rds:*:${data.aws_caller_identity.current.account_id}:subgrp:mortgage-agent-staging*",
    ]
  }

  # Backup/restore drill (staging-drill.yml): take a real snapshot of the
  # live instance, restore it into a separate, temporary instance, verify
  # it, then tear both down. RestoreDBInstanceFromDBSnapshot needs
  # permission on the source snapshot, the new instance it creates (the
  # db:mortgage-agent-staging* pattern above already covers a temporary
  # "mortgage-agent-staging-restore-drill" identifier), and - confirmed
  # by a real AccessDenied from the drill's first restore attempt - the
  # db subnet group it's restored into, since that's passed explicitly
  # via --db-subnet-group-name.
  statement {
    sid    = "RdsSnapshotDrill"
    effect = "Allow"
    actions = [
      "rds:CreateDBSnapshot", "rds:DeleteDBSnapshot", "rds:DescribeDBSnapshots",
      "rds:RestoreDBInstanceFromDBSnapshot",
    ]
    resources = [
      "arn:aws:rds:*:${data.aws_caller_identity.current.account_id}:db:mortgage-agent-staging*",
      "arn:aws:rds:*:${data.aws_caller_identity.current.account_id}:snapshot:mortgage-agent-staging*",
      "arn:aws:rds:*:${data.aws_caller_identity.current.account_id}:subgrp:mortgage-agent-staging*",
    ]
  }

  # The provider's own "wait until available" polling calls
  # DescribeDBInstances without a specific instance identifier (it
  # filters client-side), which IAM evaluates against the bare `db:*`
  # resource rather than the scoped ARN above - the same
  # no-identifier-in-the-request situation as LogsUnscopable.
  statement {
    sid       = "RdsDescribeUnscopable"
    effect    = "Allow"
    actions   = ["rds:DescribeDBInstances"]
    resources = ["*"]
  }

  statement {
    sid    = "SecretsManager"
    effect = "Allow"
    actions = [
      "secretsmanager:CreateSecret", "secretsmanager:DeleteSecret", "secretsmanager:UpdateSecret",
      "secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue", "secretsmanager:UpdateSecretVersionStage",
      "secretsmanager:DescribeSecret", "secretsmanager:TagResource", "secretsmanager:GetResourcePolicy",
    ]
    resources = ["arn:aws:secretsmanager:*:${data.aws_caller_identity.current.account_id}:secret:mortgage-agent-staging/*"]
  }

  statement {
    sid    = "IamForEcsTaskRoles"
    effect = "Allow"
    actions = [
      "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:TagRole", "iam:ListRoleTags",
      "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy",
      "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:ListAttachedRolePolicies",
      "iam:ListRolePolicies",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/mortgage-agent-staging-*"]
  }

  statement {
    sid       = "PassEcsTaskRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/mortgage-agent-staging-*"]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  statement {
    sid    = "LogsForEcs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup", "logs:DeleteLogGroup",
      "logs:PutRetentionPolicy", "logs:TagResource", "logs:ListTagsForResource",
    ]
    resources = ["arn:aws:logs:*:${data.aws_caller_identity.current.account_id}:log-group:/ecs/mortgage-agent-staging*"]
  }

  # DescribeLogGroups lists across the whole account/region in one call -
  # it takes no log group name as input, so CloudWatch Logs does not
  # support scoping it to a specific log-group ARN (the same "read/list
  # action with no resource to scope to" situation as NetworkingUnscopable
  # and EcsUnscopable above).
  statement {
    sid       = "LogsUnscopable"
    effect    = "Allow"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["*"]
  }

  # Cloud Map (used for Temporal's private-DNS service discovery, since a
  # Fargate task's own IP changes on every deploy/restart). Namespace and
  # service create/delete are async - the provider polls GetOperation to
  # know when they finish, and an operation ID isn't the same resource as
  # the namespace/service it acted on, so this is scoped by action only.
  statement {
    sid    = "ServiceDiscovery"
    effect = "Allow"
    actions = [
      "servicediscovery:CreatePrivateDnsNamespace", "servicediscovery:DeleteNamespace",
      "servicediscovery:GetNamespace", "servicediscovery:ListNamespaces",
      "servicediscovery:CreateService", "servicediscovery:UpdateService", "servicediscovery:DeleteService",
      "servicediscovery:GetService", "servicediscovery:ListServices",
      "servicediscovery:GetOperation",
      "servicediscovery:TagResource", "servicediscovery:UntagResource", "servicediscovery:ListTagsForResource",
    ]
    resources = ["*"]
  }

  # A Cloud Map *private DNS* namespace is backed by an actual Route 53
  # private hosted zone under the hood - creating one silently also
  # creates/manages a hosted zone, discovered only by the real
  # AccessDeniedException this caused. Route 53 hosted zones aren't
  # scoped to this stack's name (the zone ID is assigned by AWS, not
  # chosen), so this is Resource "*" the same way the other
  # no-resource-to-scope-to statements above are.
  statement {
    sid    = "Route53ForServiceDiscovery"
    effect = "Allow"
    actions = [
      "route53:CreateHostedZone", "route53:DeleteHostedZone", "route53:GetHostedZone",
      "route53:ListHostedZones", "route53:ListHostedZonesByName",
      "route53:ChangeResourceRecordSets", "route53:ListResourceRecordSets",
      "route53:GetChange", "route53:ChangeTagsForResource", "route53:ListTagsForResource",
    ]
    resources = ["*"]
  }

  # The browser demo is still AWS-only when no custom domain is purchased:
  # a private S3 origin serves the console through CloudFront's AWS-managed
  # HTTPS hostname, while HTTP API proxies the existing ECS control plane.
  # These create/list APIs have no practical resource ARN at creation time,
  # so they are scoped by service action and the staging module's fixed names.
  statement {
    sid    = "CloudFrontConsoleEdge"
    effect = "Allow"
    actions = [
      "cloudfront:CreateDistribution", "cloudfront:DeleteDistribution",
      "cloudfront:GetDistribution", "cloudfront:GetDistributionConfig",
      "cloudfront:UpdateDistribution", "cloudfront:CreateInvalidation",
      "cloudfront:ListDistributions", "cloudfront:ListCachePolicies",
      "cloudfront:GetCachePolicy",
      "cloudfront:CreateOriginAccessControl",
      "cloudfront:GetOriginAccessControl", "cloudfront:UpdateOriginAccessControl",
      "cloudfront:DeleteOriginAccessControl",
      "cloudfront:CreateOriginRequestPolicy", "cloudfront:GetOriginRequestPolicy",
      "cloudfront:UpdateOriginRequestPolicy", "cloudfront:DeleteOriginRequestPolicy",
      "cloudfront:ListOriginRequestPolicies",
      "cloudfront:TagResource", "cloudfront:UntagResource", "cloudfront:ListTagsForResource",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ApiGatewayConsoleEdge"
    effect = "Allow"
    actions = [
      "apigateway:GET", "apigateway:POST", "apigateway:PATCH", "apigateway:DELETE",
      "apigateway:PUT", "apigateway:TagResource", "apigateway:UntagResource",
    ]
    # API Gateway v2 creates an API and then applies default tags through its
    # separate `/tags/arn.../v2/apis/...` resource path. Keep both the v1/v2
    # API paths and that tag endpoint explicit instead of opening all API
    # Gateway resources to the deployment role.
    resources = [
      "arn:aws:apigateway:*::/apis*",
      "arn:aws:apigateway:*::/v2/apis*",
      "arn:aws:apigateway:*::/tags/*",
    ]
  }

  statement {
    sid    = "CognitoSyntheticDemo"
    effect = "Allow"
    actions = [
      "cognito-idp:CreateUserPool", "cognito-idp:DeleteUserPool", "cognito-idp:DescribeUserPool",
      "cognito-idp:UpdateUserPool", "cognito-idp:ListUserPools", "cognito-idp:TagResource",
      "cognito-idp:UntagResource", "cognito-idp:ListTagsForResource",
      "cognito-idp:CreateUserPoolClient", "cognito-idp:DeleteUserPoolClient",
      "cognito-idp:DescribeUserPoolClient", "cognito-idp:UpdateUserPoolClient",
      "cognito-idp:ListUserPoolClients", "cognito-idp:CreateUserPoolDomain",
      "cognito-idp:DeleteUserPoolDomain", "cognito-idp:DescribeUserPoolDomain",
      "cognito-idp:AdminCreateUser", "cognito-idp:AdminSetUserPassword",
      "cognito-idp:AdminDeleteUser", "cognito-idp:AdminGetUser", "cognito-idp:ListUsers",
      "cognito-idp:GetUserPoolMfaConfig", "cognito-idp:SetUserPoolMfaConfig",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ConsoleAssetBucket"
    effect = "Allow"
    actions = [
      "s3:CreateBucket", "s3:DeleteBucket", "s3:GetBucketLocation",
      "s3:GetBucketPolicy", "s3:PutBucketPolicy", "s3:DeleteBucketPolicy",
      "s3:GetBucketPublicAccessBlock", "s3:PutBucketPublicAccessBlock",
      "s3:GetBucketOwnershipControls", "s3:PutBucketOwnershipControls",
      "s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject",
      "s3:GetBucketTagging", "s3:PutBucketTagging",
      "s3:GetBucketAcl",
      # The AWS provider reads several optional bucket attributes (ACL, CORS,
      # lifecycle, website, and encryption) while reconciling one bucket.
      # Scope all of those read-only queries to this fixed private console
      # bucket instead of growing a cross-bucket permission one API at a time.
      "s3:Get*",
    ]
    resources = [
      "arn:aws:s3:::mortgage-agent-staging-console-${data.aws_caller_identity.current.account_id}",
      "arn:aws:s3:::mortgage-agent-staging-console-${data.aws_caller_identity.current.account_id}/*",
    ]
  }

  statement {
    sid       = "ConsoleAssetBucketCreate"
    effect    = "Allow"
    actions   = ["s3:CreateBucket"]
    resources = ["*"]
  }

  statement {
    sid    = "ApiGatewayLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup", "logs:DeleteLogGroup", "logs:PutRetentionPolicy",
      "logs:TagResource", "logs:ListTagsForResource",
    ]
    resources = ["arn:aws:logs:*:${data.aws_caller_identity.current.account_id}:log-group:/aws/apigateway/mortgage-agent-staging*"]
  }

  # API Gateway creates HTTP API access-log subscriptions through the
  # CloudWatch Logs delivery control plane. On the first delivery for a log
  # group, CloudWatch also writes a service resource policy. Those control-
  # plane calls do not accept a log-group ARN, so they must be action-scoped;
  # the stage itself remains limited to the mortgage-agent-staging API by
  # ApiGatewayConsoleEdge.
  statement {
    sid    = "ApiGatewayLogDelivery"
    effect = "Allow"
    actions = [
      "logs:CreateLogDelivery", "logs:GetLogDelivery", "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery", "logs:ListLogDeliveries",
      "logs:PutResourcePolicy", "logs:DescribeResourcePolicies",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "TerraformStateBucket"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
  }

  statement {
    sid       = "TerraformStateLock"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:DescribeTable"]
    resources = [aws_dynamodb_table.state_lock.arn]
  }

  statement {
    sid       = "Identity"
    effect    = "Allow"
    actions   = ["sts:GetCallerIdentity"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.role_name}-permissions"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_permissions.json
}
