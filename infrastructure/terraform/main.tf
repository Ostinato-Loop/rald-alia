terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket         = "rald-alia-terraform-state"
    key            = "alia/${var.environment}/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "rald-alia-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "rald-alia"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "LILCKY-STUDIO-LIMITED"
    }
  }
}

# ── VPC ────────────────────────────────────────────────────────────────────────
module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  aws_region          = var.aws_region
  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  public_subnets      = var.public_subnets
  private_subnets     = var.private_subnets
  isolated_subnets    = var.isolated_subnets
}

# ── Security ───────────────────────────────────────────────────────────────────
module "security" {
  source = "./modules/security"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  vpc_cidr    = var.vpc_cidr
}

# ── RDS PostgreSQL ─────────────────────────────────────────────────────────────
module "rds" {
  source = "./modules/rds"

  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  isolated_subnet_ids     = module.vpc.isolated_subnet_ids
  rds_security_group_id   = module.security.rds_security_group_id
  db_instance_class       = var.rds_instance_class
  db_allocated_storage    = var.rds_allocated_storage
  db_name                 = "raldalia"
  db_username             = "raldalia"
  multi_az                = var.rds_multi_az
  backup_retention_days   = var.rds_backup_retention
  deletion_protection     = var.environment == "production"
}

# ── ElastiCache Redis ──────────────────────────────────────────────────────────
module "redis" {
  source = "./modules/redis"

  environment               = var.environment
  vpc_id                    = module.vpc.vpc_id
  private_subnet_ids        = module.vpc.private_subnet_ids
  redis_security_group_id   = module.security.redis_security_group_id
  node_type                 = var.redis_node_type
  num_cache_nodes           = var.redis_num_nodes
  automatic_failover        = var.environment == "production"
}

# ── MSK Kafka ─────────────────────────────────────────────────────────────────
module "kafka" {
  source = "./modules/kafka"

  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  kafka_security_group_id = module.security.kafka_security_group_id
  kafka_version           = "3.6.0"
  broker_instance_type    = var.kafka_broker_type
  number_of_broker_nodes  = var.kafka_broker_count
  ebs_volume_size         = var.kafka_ebs_size
}

# ── ALB ────────────────────────────────────────────────────────────────────────
module "alb" {
  source = "./modules/alb"

  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  public_subnet_ids      = module.vpc.public_subnet_ids
  alb_security_group_id  = module.security.alb_security_group_id
  certificate_arn        = var.acm_certificate_arn
  waf_acl_arn            = module.security.waf_acl_arn
}

# ── ECS Fargate ────────────────────────────────────────────────────────────────
module "ecs" {
  source = "./modules/ecs"

  environment              = var.environment
  aws_region               = var.aws_region
  vpc_id                   = module.vpc.vpc_id
  private_subnet_ids       = module.vpc.private_subnet_ids
  ecs_security_group_id    = module.security.ecs_security_group_id
  alb_target_group_arns    = module.alb.target_group_arns
  alb_listener_arn         = module.alb.https_listener_arn

  ecr_registry             = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  image_tag                = var.image_tag

  database_url_secret_arn  = module.rds.database_url_secret_arn
  redis_url_secret_arn     = module.redis.redis_url_secret_arn
  kafka_brokers            = module.kafka.bootstrap_brokers
  secrets_arns             = module.security.app_secrets_arns
  ecs_execution_role_arn   = module.security.ecs_execution_role_arn
  ecs_task_role_arn        = module.security.ecs_task_role_arn

  services                 = var.ecs_services
  task_cpu                 = var.ecs_task_cpu
  task_memory              = var.ecs_task_memory
  desired_count            = var.ecs_desired_count
}

# ── Monitoring ────────────────────────────────────────────────────────────────
module "monitoring" {
  source = "./modules/monitoring"

  environment           = var.environment
  aws_region            = var.aws_region
  ecs_cluster_name      = module.ecs.cluster_name
  rds_instance_id       = module.rds.db_instance_id
  redis_cluster_id      = module.redis.cluster_id
  alb_arn_suffix        = module.alb.alb_arn_suffix
  alert_email           = var.alert_email
  services              = keys(var.ecs_services)
}

data "aws_caller_identity" "current" {}
