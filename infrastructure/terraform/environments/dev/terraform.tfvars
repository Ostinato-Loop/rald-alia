environment = "dev"
aws_region  = "eu-west-1"

# Network
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
public_subnets     = ["10.0.1.0/24",  "10.0.2.0/24",  "10.0.3.0/24"]
private_subnets    = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
isolated_subnets   = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]

# RDS — smallest viable for dev
rds_instance_class    = "db.t3.micro"
rds_allocated_storage = 20
rds_multi_az          = false
rds_backup_retention  = 3

# Redis — single node for dev
redis_node_type = "cache.t3.micro"
redis_num_nodes = 1

# Kafka — minimal for dev
kafka_broker_type  = "kafka.t3.small"
kafka_broker_count = 3
kafka_ebs_size     = 20

# ECS — minimal footprint
ecs_task_cpu      = 256
ecs_task_memory   = 512
ecs_desired_count = 1
image_tag         = "latest"

# ACM — wildcard cert for *.alia.rald.cloud
acm_certificate_arn = "arn:aws:acm:eu-west-1:ACCOUNT_ID:certificate/CERT_ID"

alert_email = "infra@rald.cloud"
