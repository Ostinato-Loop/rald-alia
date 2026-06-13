terraform {
  backend "s3" {
    bucket         = "rald-alia-terraform-state"
    key            = "alia/production/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "rald-alia-terraform-locks"
  }
}

module "alia" {
  source = "../../"

  environment            = "production"
  aws_region             = var.aws_region
  vpc_cidr               = var.vpc_cidr
  availability_zones     = var.availability_zones
  public_subnets         = var.public_subnets
  private_subnets        = var.private_subnets
  isolated_subnets       = var.isolated_subnets
  rds_instance_class     = var.rds_instance_class
  rds_allocated_storage  = var.rds_allocated_storage
  rds_multi_az           = var.rds_multi_az
  rds_backup_retention   = var.rds_backup_retention
  redis_node_type        = var.redis_node_type
  redis_num_nodes        = var.redis_num_nodes
  kafka_broker_type      = var.kafka_broker_type
  kafka_broker_count     = var.kafka_broker_count
  kafka_ebs_size         = var.kafka_ebs_size
  ecs_task_cpu           = var.ecs_task_cpu
  ecs_task_memory        = var.ecs_task_memory
  ecs_desired_count      = var.ecs_desired_count
  image_tag              = var.image_tag
  acm_certificate_arn    = var.acm_certificate_arn
  alert_email            = var.alert_email
}
