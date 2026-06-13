variable "environment"       { type = string }
variable "aws_region"        { type = string }
variable "ecs_cluster_name"  { type = string }
variable "ecs_cluster_id"    { type = string }
variable "rds_instance_id"   { type = string }
variable "redis_cluster_id"  { type = string }
variable "alb_arn_suffix"    { type = string }
variable "alert_email"       { type = string }
variable "services"          { type = list(string) }
variable "vpc_id"            { type = string }
variable "vpc_cidr"          { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "service_connect_namespace" { type = string }

# OTEL Collector upstream (optional — Grafana Cloud, Honeycomb, etc.)
variable "otel_upstream_endpoint" {
  type    = string
  default = ""
  description = "OTLP HTTP endpoint for upstream trace/metric forwarding (leave empty to disable)"
}

variable "otel_upstream_token_arn" {
  type    = string
  default = ""
  description = "Secrets Manager ARN for OTEL upstream bearer token"
}
