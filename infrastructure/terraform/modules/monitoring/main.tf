locals {
  name = "alia-${var.environment}"
}

# ── SNS Topic for Alerts ───────────────────────────────────────────────────────
resource "aws_sns_topic" "alerts" {
  name         = "${local.name}-alerts"
  display_name = "RALD ALIA Alerts — ${var.environment}"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── CloudWatch Dashboard ───────────────────────────────────────────────────────
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name}-dashboard"

  dashboard_body = jsonencode({
    widgets = concat(
      # Service health widgets
      [for svc in var.services : {
        type   = "metric"
        width  = 6
        height = 4
        properties = {
          title  = "${svc} — CPU & Memory"
          region = var.aws_region
          metrics = [
            ["AWS/ECS", "CPUUtilization",    "ClusterName", var.ecs_cluster_name, "ServiceName", "${local.name}-${svc}"],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", "${local.name}-${svc}"],
          ]
          period = 60
          stat   = "Average"
        }
      }],
      # ALB metrics
      [{
        type   = "metric"
        width  = 12
        height = 4
        properties = {
          title  = "ALB — Request Rate & Latency"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount",       "LoadBalancer", var.alb_arn_suffix, { stat = "Sum" }],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p95" }],
            ["AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", color = "#d62728" }],
          ]
          period = 60
        }
      }],
      # RDS metrics
      [{
        type   = "metric"
        width  = 12
        height = 4
        properties = {
          title  = "RDS — CPU & Connections"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "CPUUtilization",      "DBInstanceIdentifier", var.rds_instance_id],
            ["AWS/RDS", "DatabaseConnections",  "DBInstanceIdentifier", var.rds_instance_id],
            ["AWS/RDS", "FreeableMemory",       "DBInstanceIdentifier", var.rds_instance_id, { stat = "Average" }],
          ]
          period = 60
        }
      }],
      # Redis metrics
      [{
        type   = "metric"
        width  = 12
        height = 4
        properties = {
          title  = "Redis — Connections & Memory"
          region = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "CurrConnections",  "ReplicationGroupId", var.redis_cluster_id],
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "ReplicationGroupId", var.redis_cluster_id],
            ["AWS/ElastiCache", "CacheHits",        "ReplicationGroupId", var.redis_cluster_id, { stat = "Sum" }],
            ["AWS/ElastiCache", "CacheMisses",      "ReplicationGroupId", var.redis_cluster_id, { stat = "Sum" }],
          ]
          period = 60
        }
      }]
    )
  })
}

# ── ECS Service Alarms (per service) ──────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  for_each = toset(var.services)

  alarm_name          = "${local.name}-${each.value}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 120
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "${each.value} CPU > 85% for 4 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = "${local.name}-${each.value}"
  }
}

resource "aws_cloudwatch_metric_alarm" "memory_high" {
  for_each = toset(var.services)

  alarm_name          = "${local.name}-${each.value}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 120
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "${each.value} memory > 85% for 4 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = "${local.name}-${each.value}"
  }
}

# ── ALB Alarms ────────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "ALB 5xx errors > 10 in 1 minute"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_latency_p95" {
  alarm_name          = "${local.name}-alb-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  threshold           = 0.2
  alarm_description   = "P95 latency > 200ms (ALIA target is <200ms)"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
}

# ── RDS Alarms ────────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.name}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 120
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU > 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions          = { DBInstanceIdentifier = var.rds_instance_id }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${local.name}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 100
  alarm_description   = "RDS connections > 100"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions          = { DBInstanceIdentifier = var.rds_instance_id }
}
