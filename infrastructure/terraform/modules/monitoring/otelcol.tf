# infrastructure/terraform/modules/monitoring/otelcol.tf
# RALD ALIA — OpenTelemetry Collector ECS Service
# Fargate task: 0.25 vCPU / 512MB — dedicated collector per environment
# All 19 ALIA services send OTLP to this collector's private ALB target.

locals {
  otelcol_image = "otel/opentelemetry-collector-contrib:0.105.0"
  otelcol_name  = "${local.name}-otel-collector"
}

# ── ECR repo for custom collector config ──────────────────────────────────────
resource "aws_ecr_repository" "otelcol" {
  name                 = "rald-alia/otel-collector"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

# ── CloudWatch log group ──────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "otelcol" {
  name              = "/alia/${var.environment}/otel-collector"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "otel_metrics" {
  name              = "/alia/otel/metrics"
  retention_in_days = 30
}

# ── IAM role for collector task ───────────────────────────────────────────────
resource "aws_iam_role" "otelcol_task" {
  name = "${local.otelcol_name}-task-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "otelcol_task" {
  name = "${local.otelcol_name}-policy"
  role = aws_iam_role.otelcol_task.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      # X-Ray write
      {
        Effect   = "Allow"
        Action   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets"]
        Resource = "*"
      },
      # CloudWatch EMF metrics
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/alia/*"
      },
    ]
  })
}

resource "aws_iam_role" "otelcol_execution" {
  name = "${local.otelcol_name}-execution-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "otelcol_execution" {
  role       = aws_iam_role.otelcol_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── ECS Task Definition ───────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "otelcol" {
  family                   = local.otelcol_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  task_role_arn            = aws_iam_role.otelcol_task.arn
  execution_role_arn       = aws_iam_role.otelcol_execution.arn

  container_definitions = jsonencode([{
    name      = "otel-collector"
    image     = local.otelcol_image
    essential = true

    portMappings = [
      { containerPort = 4317, protocol = "tcp", name = "otlp-grpc" },
      { containerPort = 4318, protocol = "tcp", name = "otlp-http" },
      { containerPort = 13133, protocol = "tcp", name = "health"   },
      { containerPort = 8888,  protocol = "tcp", name = "metrics"  },
    ]

    command = ["--config=/etc/otelcol/config.yaml"]

    environment = [
      { name = "AWS_REGION",              value = var.aws_region },
      { name = "OTEL_UPSTREAM_ENDPOINT",  value = var.otel_upstream_endpoint },
    ]

    secrets = [
      { name = "OTEL_UPSTREAM_TOKEN", valueFrom = var.otel_upstream_token_arn },
    ]

    mountPoints = [{
      sourceVolume  = "otelcol-config"
      containerPath = "/etc/otelcol"
      readOnly      = true
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.otelcol.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "otelcol"
      }
    }

    healthCheck = {
      command     = ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:13133/"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }
  }])

  volume {
    name = "otelcol-config"
  }
}

# ── ECS Service ───────────────────────────────────────────────────────────────
resource "aws_ecs_service" "otelcol" {
  name            = local.otelcol_name
  cluster         = var.ecs_cluster_id
  task_definition = aws_ecs_task_definition.otelcol.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.otelcol.id]
    assign_public_ip = false
  }

  service_connect_configuration {
    enabled   = true
    namespace = var.service_connect_namespace
    service {
      port_name      = "otlp-http"
      client_alias { port = 4318 }
    }
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# ── Security group ─────────────────────────────────────────────────────────────
resource "aws_security_group" "otelcol" {
  name   = "${local.otelcol_name}-sg"
  vpc_id = var.vpc_id

  ingress {
    description = "OTLP gRPC from ALIA services"
    from_port   = 4317
    to_port     = 4317
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "OTLP HTTP from ALIA services"
    from_port   = 4318
    to_port     = 4318
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "Health check"
    from_port   = 13133
    to_port     = 13133
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.otelcol_name}-sg" }
}

# ── CloudWatch alarm: collector task count ─────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "otelcol_running" {
  alarm_name          = "${local.otelcol_name}-not-running"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "OTEL Collector has 0 running tasks — traces and metrics are being lost"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = local.otelcol_name
  }
}
