output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "ALB DNS name — point *.alia.rald.cloud CNAME here"
  value       = module.alb.alb_dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "ecr_urls" {
  description = "ECR image URLs per service"
  value       = module.ecs.ecr_urls
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "kafka_bootstrap_brokers" {
  description = "MSK Kafka bootstrap brokers"
  value       = module.kafka.bootstrap_brokers
  sensitive   = true
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = module.monitoring.dashboard_url
}

output "next_steps" {
  description = "Post-apply checklist"
  value       = <<-EOT
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    RALD ALIA — Infrastructure Applied. Next steps:
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    1. Set secrets in AWS Secrets Manager:
       aws secretsmanager put-secret-value \
         --secret-id alia-${var.environment}/jwt-secret \
         --secret-string "$(openssl rand -base64 64)"

       aws secretsmanager put-secret-value \
         --secret-id alia-${var.environment}/machine-jwt-secret \
         --secret-string "$(openssl rand -base64 64)"

       aws secretsmanager put-secret-value \
         --secret-id alia-${var.environment}/credential-signing-key \
         --secret-string "$(openssl rand -base64 64)"

    2. DNS: Point *.alia.rald.cloud → ${module.alb.alb_dns_name}

    3. Run migrations:
       aws ecs run-task --cluster ${module.ecs.cluster_name} \
         --task-definition alia-${var.environment}-db-migrate \
         --launch-type FARGATE \
         --network-configuration "..."

    4. Confirm email subscription for alarms (check inbox)

    5. Push Docker images to ECR and force new deployments

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EOT
}
