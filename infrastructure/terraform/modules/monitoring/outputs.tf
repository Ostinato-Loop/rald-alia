output "sns_alert_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  value = "https://console.aws.amazon.com/cloudwatch/home#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "otelcol_otlp_http_endpoint" {
  value       = "http://${local.otelcol_name}:4318"
  description = "OTLP HTTP endpoint for ALIA services (via Service Connect)"
}

output "otelcol_otlp_grpc_endpoint" {
  value       = "http://${local.otelcol_name}:4317"
  description = "OTLP gRPC endpoint for ALIA services (via Service Connect)"
}

output "otelcol_ecr_repository_url" {
  value       = aws_ecr_repository.otelcol.repository_url
  description = "ECR URL for custom collector image (if needed)"
}

output "otel_metrics_log_group" {
  value       = aws_cloudwatch_log_group.otel_metrics.name
  description = "CloudWatch log group receiving EMF metrics from the collector"
}
