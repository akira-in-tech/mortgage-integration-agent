variable "aws_region" {
  description = "Must match the region terraform/bootstrap/ used for the state bucket/lock table."
  type        = string
  default     = "us-east-1"
}

variable "image_tag" {
  description = "The container image tag to deploy — set by the GitHub Actions workflow to the commit SHA it just built and pushed. Never \"latest\": every deploy names the exact immutable artifact it runs."
  type        = string
}

variable "db_instance_class" {
  description = "Smallest practical instance for a synthetic staging database."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "fargate_cpu" {
  description = "vCPU units (256 = 0.25 vCPU) for each of the api/worker/temporal services — the smallest Fargate allows."
  type        = number
  default     = 256
}

variable "fargate_memory" {
  description = "MiB (512 = 0.5 GB) for each of the api/worker/temporal services."
  type        = number
  default     = 512
}

variable "ollama_fargate_cpu" {
  description = "CPU units for the private Qwen inference task. The model is isolated from the API and worker so model capacity can be tuned independently."
  type        = number
  default     = 4096
}

variable "ollama_fargate_memory" {
  description = "MiB for the private Qwen inference task; enough for the 9B quantized model and its bounded serving context."
  type        = number
  default     = 16384
}

variable "ollama_ephemeral_storage_gib" {
  description = "Fargate ephemeral storage for the preloaded Qwen image and bounded Ollama runtime cache."
  type        = number
  default     = 30
}

variable "log_retention_days" {
  type    = number
  default = 14
}
