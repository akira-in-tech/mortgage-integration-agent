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
      "ec2:DescribeSecurityGroups", "ec2:CreateSecurityGroup", "ec2:DeleteSecurityGroup",
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
      "ecr:BatchGetImage", "ecr:BatchCheckLayerAvailability",
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

  statement {
    sid    = "SecretsManager"
    effect = "Allow"
    actions = [
      "secretsmanager:CreateSecret", "secretsmanager:DeleteSecret", "secretsmanager:UpdateSecret",
      "secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue",
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
