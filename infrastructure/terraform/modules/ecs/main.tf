locals {
  name = "alia-${var.environment}"
}

# ── ECS Cluster ────────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = local.name

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = local.name }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 70
    capacity_provider = "FARGATE"
  }
  default_capacity_provider_strategy {
    weight            = 30
    capacity_provider = "FARGATE_SPOT"
  }
}

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/aws/ecs/${local.name}/exec"
  retention_in_days = 7
}

# ── ECR Repositories ──────────────────────────────────────────────────────────
resource "aws_ecr_repository" "services" {
  for_each = var.services

  name                 = "rald-alia/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = var.environment != "production"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Name = "rald-alia/${each.key}" }
}

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = var.services
  repository = aws_ecr_repository.services[each.key].name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ── CloudWatch Log Groups per Service ─────────────────────────────────────────
resource "aws_cloudwatch_log_group" "services" {
  for_each          = var.services
  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = 30
}

# ── Task Definitions ──────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "services" {
  for_each = var.services

  family                   = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = coalesce(each.value.cpu, var.task_cpu)
  memory                   = coalesce(each.value.memory, var.task_memory)
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([{
    name      = each.key
    image     = "${var.ecr_registry}/rald-alia/${each.key}:${var.image_tag}"
    essential = true

    portMappings = [{
      containerPort = each.value.port
      protocol      = "tcp"
    }]

    environment = concat([
      { name = "NODE_ENV",     value = var.environment == "dev" ? "development" : "production" },
      { name = "PORT",         value = tostring(each.value.port) },
      { name = "KAFKA_BROKERS",value = var.kafka_brokers },
      { name = "LOG_LEVEL",    value = var.environment == "production" ? "info" : "debug" },
    ], [for k, v in each.value.environment_extras : { name = k, value = v }])

    secrets = [
      { name = "DATABASE_URL",          valueFrom = var.database_url_secret_arn },
      { name = "REDIS_URL",             valueFrom = var.redis_url_secret_arn },
      { name = "JWT_SECRET",            valueFrom = var.secrets_arns.jwt_secret },
      { name = "MACHINE_JWT_SECRET",    valueFrom = var.secrets_arns.machine_jwt_secret },
      { name = "CREDENTIAL_SIGNING_KEY",valueFrom = var.secrets_arns.credential_signing_key },
      { name = "RESEND_API_KEY",        valueFrom = var.secrets_arns.resend_api_key },
      { name = "TERMII_API_KEY",        valueFrom = var.secrets_arns.termii_api_key },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services[each.key].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = each.key
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:${each.value.port}${each.value.health_check_path} || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = { Name = "${local.name}-${each.key}" }
}

# ── ECS Services ──────────────────────────────────────────────────────────────
resource "aws_ecs_service" "services" {
  for_each = var.services

  name            = "${local.name}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = coalesce(each.value.desired_count, var.desired_count)
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = contains(["gateway", "identity-service", "resolution-engine", "directory-service"], each.key) ? [1] : []
    content {
      target_group_arn = var.alb_target_group_arns[each.key]
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  deployment_configuration {
    minimum_healthy_percent = 50
    maximum_percent         = 200

    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }
  }

  enable_execute_command = true

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = { Name = "${local.name}-${each.key}" }
  depends_on = [aws_ecs_cluster.main]
}

# ── Auto Scaling ──────────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "services" {
  for_each = var.environment == "production" ? var.services : {}

  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.services[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each = var.environment == "production" ? var.services : {}

  name               = "${local.name}-${each.key}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
