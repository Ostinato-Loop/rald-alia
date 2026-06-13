environment = "staging"
aws_region  = "eu-west-1"

vpc_cidr           = "10.1.0.0/16"
availability_zones = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
public_subnets     = ["10.1.1.0/24",  "10.1.2.0/24",  "10.1.3.0/24"]
private_subnets    = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]
isolated_subnets   = ["10.1.21.0/24", "10.1.22.0/24", "10.1.23.0/24"]

rds_instance_class    = "db.t3.small"
rds_allocated_storage = 50
rds_multi_az          = false
rds_backup_retention  = 7

redis_node_type = "cache.t3.small"
redis_num_nodes = 2

kafka_broker_type  = "kafka.t3.small"
kafka_broker_count = 3
kafka_ebs_size     = 50

ecs_task_cpu      = 512
ecs_task_memory   = 1024
ecs_desired_count = 1
image_tag         = "latest"

acm_certificate_arn = "arn:aws:acm:eu-west-1:ACCOUNT_ID:certificate/CERT_ID"
alert_email         = "infra@rald.cloud"
