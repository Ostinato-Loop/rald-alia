variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets (NAT, ALB)"
  type        = list(string)
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets (ECS, Redis, Kafka)"
  type        = list(string)
}

variable "isolated_subnets" {
  description = "CIDR blocks for isolated subnets (RDS — no internet access)"
  type        = list(string)
}

# ── RDS ──────────────────────────────────────────────────────────────────────

variable "rds_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = false
}

variable "rds_backup_retention" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

# ── Redis ────────────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 1
}

# ── Kafka (MSK) ──────────────────────────────────────────────────────────────

variable "kafka_broker_type" {
  description = "MSK broker instance type"
  type        = string
  default     = "kafka.t3.small"
}

variable "kafka_broker_count" {
  description = "Number of Kafka broker nodes (must be multiple of AZ count)"
  type        = number
  default     = 3
}

variable "kafka_ebs_size" {
  description = "EBS volume size per broker in GB"
  type        = number
  default     = 100
}

# ── ECS ──────────────────────────────────────────────────────────────────────

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "ecs_task_cpu" {
  description = "Default ECS task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "ecs_task_memory" {
  description = "Default ECS task memory in MB"
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Default desired task count per service"
  type        = number
  default     = 1
}

variable "ecs_services" {
  description = "Map of ECS service configurations"
  type = map(object({
    port          = number
    cpu           = optional(number)
    memory        = optional(number)
    desired_count = optional(number)
    health_check_path = string
    environment_extras = optional(map(string), {})
  }))
  default = {
    gateway              = { port = 3000, health_check_path = "/healthz" }
    identity-service     = { port = 3001, health_check_path = "/health" }
    alias-service        = { port = 3002, health_check_path = "/health" }
    directory-service    = { port = 3003, health_check_path = "/health" }
    resolution-engine    = { port = 3004, health_check_path = "/health" }
    routing-service      = { port = 3005, health_check_path = "/health" }
    fraud-service        = { port = 3006, health_check_path = "/health" }
    audit-service        = { port = 3007, health_check_path = "/health" }
    notification-service = { port = 3008, health_check_path = "/health" }
    governance-service   = { port = 3009, health_check_path = "/health" }
    consent-service      = { port = 3010, health_check_path = "/health" }
    trust-service        = { port = 3011, health_check_path = "/health" }
    merchant-service     = { port = 3012, health_check_path = "/health" }
    verification-service = { port = 3013, health_check_path = "/health" }
    institution-service  = { port = 3014, health_check_path = "/health" }
    registry-service     = { port = 3015, health_check_path = "/health" }
  }
}

# ── ALB / TLS ────────────────────────────────────────────────────────────────

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS (*.alia.rald.cloud)"
  type        = string
}

# ── Alerts ──────────────────────────────────────────────────────────────────

variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
  default     = "infra@rald.cloud"
}
