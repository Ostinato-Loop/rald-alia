variable "environment"           { type = string }
variable "aws_region"           { type = string }
variable "vpc_id"               { type = string }
variable "private_subnet_ids"   { type = list(string) }
variable "ecs_security_group_id"{ type = string }
variable "alb_target_group_arns"{ type = map(string) }
variable "alb_listener_arn"     { type = string }
variable "ecr_registry"         { type = string }
variable "image_tag"            { type = string }
variable "database_url_secret_arn"{ type = string }
variable "redis_url_secret_arn" { type = string }
variable "kafka_brokers"        { type = string }
variable "secrets_arns"         { type = map(string) }
variable "task_cpu"             { type = number }
variable "task_memory"          { type = number }
variable "desired_count"        { type = number }
variable "ecs_execution_role_arn"{ type = string }
variable "ecs_task_role_arn"    { type = string }
variable "services" {
  type = map(object({
    port              = number
    cpu               = optional(number)
    memory            = optional(number)
    desired_count     = optional(number)
    health_check_path = string
    environment_extras = optional(map(string), {})
  }))
}
