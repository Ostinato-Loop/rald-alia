locals {
  name = "alia-${var.environment}"
}

resource "aws_lb" "main" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "production"
  enable_http2               = true

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    enabled = true
  }

  tags = { Name = "${local.name}-alb" }
}

resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = var.waf_acl_arn
}

# ── S3 bucket for ALB access logs ─────────────────────────────────────────────
resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${local.name}-alb-access-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.environment != "production"
  tags          = { Name = "${local.name}-alb-logs" }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "expire-old-logs"
    status = "Enabled"
    filter { prefix = "" }
    expiration { days = 30 }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${data.aws_elb_service_account.main.id}:root" }
      Action    = "s3:PutObject"
      Resource  = "${aws_s3_bucket.alb_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
    }]
  })
}

# ── HTTP → HTTPS redirect ─────────────────────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ── HTTPS listener ────────────────────────────────────────────────────────────
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"error\":\"not_found\",\"service\":\"rald-alia\"}"
      status_code  = "404"
    }
  }
}

# ── Target Groups — one per ALIA service ──────────────────────────────────────
locals {
  service_ports = {
    gateway              = 3000
    identity-service     = 3001
    alias-service        = 3002
    directory-service    = 3003
    resolution-engine    = 3004
    routing-service      = 3005
    fraud-service        = 3006
    audit-service        = 3007
    notification-service = 3008
    governance-service   = 3009
    consent-service      = 3010
    trust-service        = 3011
    merchant-service     = 3012
    verification-service = 3013
    institution-service  = 3014
    registry-service     = 3015
  }
}

resource "aws_lb_target_group" "services" {
  for_each = local.service_ports

  name        = "${local.name}-${substr(each.key, 0, min(length(each.key), 20))}"
  port        = each.value
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = { Name = "${local.name}-${each.key}-tg" }
}

# ── Listener Rules — route by path prefix ─────────────────────────────────────
resource "aws_lb_listener_rule" "gateway" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["gateway"].arn
  }
  condition {
    path_pattern { values = ["/v1/*", "/healthz"] }
  }
}

data "aws_caller_identity" "current" {}
data "aws_elb_service_account" "main" {}
