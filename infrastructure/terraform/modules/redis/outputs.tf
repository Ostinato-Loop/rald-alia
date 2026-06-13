output "cluster_id"          { value = aws_elasticache_replication_group.main.id }
output "primary_endpoint"   { value = aws_elasticache_replication_group.main.primary_endpoint_address }
output "redis_url_secret_arn"{ value = aws_secretsmanager_secret.redis_url.arn }
