output "alb_security_group_id"   { value = aws_security_group.alb.id }
output "ecs_security_group_id"   { value = aws_security_group.ecs.id }
output "rds_security_group_id"   { value = aws_security_group.rds.id }
output "redis_security_group_id" { value = aws_security_group.redis.id }
output "kafka_security_group_id" { value = aws_security_group.kafka.id }
output "ecs_execution_role_arn"  { value = aws_iam_role.ecs_execution.arn }
output "ecs_task_role_arn"       { value = aws_iam_role.ecs_task.arn }
output "waf_acl_arn"             { value = aws_wafv2_web_acl.main.arn }
output "app_secrets_arns" {
  value = {
    jwt_secret            = aws_secretsmanager_secret.jwt_secret.arn
    machine_jwt_secret    = aws_secretsmanager_secret.machine_jwt_secret.arn
    credential_signing_key = aws_secretsmanager_secret.credential_signing_key.arn
    resend_api_key        = aws_secretsmanager_secret.resend_api_key.arn
    termii_api_key        = aws_secretsmanager_secret.termii_api_key.arn
  }
}
