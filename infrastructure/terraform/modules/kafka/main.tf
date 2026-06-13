locals {
  name = "alia-${var.environment}"
}

resource "aws_msk_cluster" "main" {
  cluster_name           = "${local.name}-kafka"
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.number_of_broker_nodes

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.private_subnet_ids
    security_groups = [var.kafka_security_group_id]

    storage_info {
      ebs_storage_info {
        volume_size = var.ebs_volume_size
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS_PLAINTEXT"
      in_cluster    = true
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  open_monitoring {
    prometheus {
      jmx_exporter  { enabled_in_broker = true }
      node_exporter { enabled_in_broker = true }
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.kafka.name
      }
    }
  }

  tags = { Name = "${local.name}-kafka" }
}

resource "aws_msk_configuration" "main" {
  name              = "${local.name}-kafka-config"
  kafka_versions    = [var.kafka_version]
  server_properties = <<-EOF
    auto.create.topics.enable=true
    delete.topic.enable=true
    log.retention.hours=168
    log.segment.bytes=1073741824
    num.partitions=3
    default.replication.factor=3
    min.insync.replicas=2
    compression.type=lz4
    message.max.bytes=1048576
  EOF
}

resource "aws_cloudwatch_log_group" "kafka" {
  name              = "/aws/msk/${local.name}"
  retention_in_days = 14
}

# ── ALIA Kafka Topics ─────────────────────────────────────────────────────────
# Topics are auto-created in dev; in production create them explicitly
resource "aws_msk_topic" "topics" {
  for_each = var.environment == "production" ? toset([
    "alia.identity.created",
    "alia.identity.verified",
    "alia.identity.suspended",
    "alia.alias.created",
    "alia.alias.updated",
    "alia.alias.deleted",
    "alia.trust.score_changed",
    "alia.consent.granted",
    "alia.consent.revoked",
    "alia.resolution.completed",
    "alia.resolution.failed",
    "alia.fraud.flagged",
    "alia.audit.events",
    "alia.notification.send",
    "alia.kyc.upgraded",
    "alia.kyc.rejected",
    "alia.institution.approved",
    "alia.merchant.onboarded",
  ]) : toset([])

  cluster_arn        = aws_msk_cluster.main.arn
  topic_name         = each.value
  replication_factor = min(var.number_of_broker_nodes, 3)
  partition_count    = 3
  config = {
    "retention.ms"  = "604800000"
    "cleanup.policy" = "delete"
  }
}
