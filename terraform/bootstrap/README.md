# Bootstrap — run this yourself, not through an agent

This module creates the two things `terraform/staging/` and
`.github/workflows/deploy-staging.yml` need before they can do
anything:

1. A GitHub OIDC identity provider + an IAM role, scoped to this one
   repository (`terraform/bootstrap/oidc.tf`'s own comments explain the
   exact permission scope — not `AdministratorAccess`).
2. An S3 bucket + DynamoDB table for `terraform/staging/`'s own remote
   state.

Run it with your own AWS credentials, on your own machine. Nothing
here should ever be pasted into a chat with an agent, and the agent
should never be given AWS access keys.

## Run it

```bash
cd terraform/bootstrap
terraform init

# state_bucket_name must be globally unique across all of AWS, not
# just your account — S3 bucket names are a single global namespace.
terraform apply \
  -var="github_repository=akira-in-tech/mortgage-integration-agent" \
  -var="state_bucket_name=mortgage-agent-tfstate-<pick-something-unique>"
```

Review the plan before typing `yes` — it should show exactly two IAM
resources, an OIDC provider, an S3 bucket, and a DynamoDB table. Nothing
else.

## After it applies

```bash
terraform output
```

Hand over these three outputs — none of them are secrets:

- `deploy_role_arn`
- `state_bucket_name`
- `account_id`

They go into `terraform/staging/backend.hcl` (the state backend config)
and into the GitHub Actions workflow's `role-to-assume` input. No AWS
credential of any kind needs to be shared past this point — every later
`terraform apply` for the actual staging stack happens through GitHub
Actions assuming this role via OIDC.

## Keep this state file private

`terraform.tfstate` in this directory is local (not remote — it can't
depend on the backend it's creating) and is gitignored. It contains no
secrets, but treat it the same way you'd treat any other Terraform
state: don't commit it, don't share it casually.
