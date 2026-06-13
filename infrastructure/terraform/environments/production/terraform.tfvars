environment = "production"
aws_region  = "eu-west-1"

vpc_cidr           = "10.2.0.0/16"
availability_zones = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
public_subnets     = ["10.2.1.0/24",  "10.2.2.0/24",  "10.2.3.0/24"]
private_subnets    = ["10.2.11.0/24", "10.2.12.0/24", "10.2.13.0/24"]
isolated_subnets   = ["10.2.21.0/24", "10.2.22.0/24", "10.2.23.0/24"]

# Production — properly sized
rds_instance_class    = "db.r6g.large"
rds_allocated_storage = 100
rds_multi_az          = true
rds_backup_retention  = 30

redis_node_type    = "cache.r6g.large"
redis_num_nodes    = 3

kafka_broker_type  = "kafka.m5.large"
kafka_broker_count = 3
kafka_ebs_size     = 500

ecs_task_cpu      = 1024
ecs_task_memory   = 2048
ecs_desired_count = 2
image_tag         = "latest"

acm_certificate_arn = "arn:aws:acm:eu-west-1:ACCOUNT_ID:certificate/CERT_ID"
alert_email         = "infra@rald.cloud"
