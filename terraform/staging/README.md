# Staging — applied only from CI

This module is meant to run exclusively through
`.github/workflows/deploy-staging.yml`, which assumes the OIDC role
`terraform/bootstrap/` created — never from a local machine with a
personal credential. Its state lives in the S3 backend that
`terraform/bootstrap/` provisioned.

## Scope

- API (`main.ts`), Worker (`worker.ts`), and a self-hosted Temporal
  server — the same three processes `docker-compose.yml` runs locally,
  on the same RDS Postgres.
- CloudFront's AWS-managed `cloudfront.net` hostname provides the public
  HTTPS console. The S3 origin is private and readable only through CloudFront.
- Cognito is the real OIDC issuer. The API remains an OIDC relying party and
  stores provider tokens only in encrypted server-side sessions; the browser
  receives opaque HttpOnly cookies and a CSRF value.
- CloudFront proxies `/v1/*`, `/graphql`, and `/health/*` through HTTP API to
  the existing ECS API, preserving one browser origin without requiring a
  purchased domain. The ALB forwards application traffic only when API Gateway
  supplies its private edge-origin header; public health checks remain narrow.
- A staging-only task provisions one synthetic Cognito reviewer into the
  application's separate `users` and `tenant_memberships` authorization model.
  It neither creates real borrower identities nor relaxes tenant checks.
- Cognito's hosted UI allows public email-verified registration. On first
  callback, the API creates a separate empty tenant with a `PARTNER`
  membership; it never gives a new account access to the shared synthetic
  reviewer tenant or its cases. `REVIEWER` approvals still require explicit
  operator provisioning.

This is a persistent synthetic demo, not a production lending deployment. Do
not enter borrower data, rely on its policy simulations, or treat Cognito demo
access as an approval from a lender, provider, or regulator.

## What isn't here yet

The console build and CloudFront invalidation run through the same protected
GitHub OIDC deployment workflow as the infrastructure. A browser walkthrough
still requires explicit synthetic seed data and a human-controlled Cognito
login; no password is printed into CI logs or documentation.

## Applying a change locally (rare — normally CI does this)

```bash
cd terraform/staging
terraform init -backend-config=../bootstrap-backend-values.txt # or pass each -backend-config=key=value flag directly
terraform plan -var="image_tag=<a-real-tag-already-in-ecr>"
```

You'll need the same OIDC-assumed AWS session CI uses (e.g. via
`aws sts assume-role` locally with your own IAM permissions to assume
`terraform/bootstrap`'s deploy role) — this module has no independent
credential path of its own by design.
