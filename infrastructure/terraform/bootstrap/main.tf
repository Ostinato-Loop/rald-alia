# RALD ALIA — Terraform State Bootstrap
# Run ONCE before anything else:
#   cd alia-work/P1-terraform/bootstrap
#   terraform init && terraform apply
# This creates the S3 bucket + DynamoDB lock table used by all environments.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = "eu-west-1"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "rald-alia-terraform-state"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name    = "rald-alia-terraform-state"
    Purpose = "Terraform remote state"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "rald-alia-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name    = "rald-alia-terraform-locks"
    Purpose = "Terraform state locking"
  }
}

output "state_bucket" { value = aws_s3_bucket.terraform_state.bucket }
output "lock_table"   { value = aws_dynamodb_table.terraform_locks.name }
