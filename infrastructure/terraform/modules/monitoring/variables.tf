variable "environment"      { type = string }
variable "aws_region"      { type = string }
variable "ecs_cluster_name"{ type = string }
variable "rds_instance_id" { type = string }
variable "redis_cluster_id"{ type = string }
variable "alb_arn_suffix"  { type = string }
variable "alert_email"     { type = string }
variable "services"        { type = list(string) }
