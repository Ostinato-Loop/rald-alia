#!/usr/bin/env bash
# RALD ALIA — One-time Terraform state bootstrap
# Creates S3 bucket + DynamoDB table for remote state.
# Run ONCE per AWS account before any terraform apply.
#
# Prerequisites:
#   - AWS CLI configured with AdministratorAccess or targeted IAM policy
#   - Terraform >=1.7 installed
#
# Usage:
#   export AWS_REGION=eu-west-1
#   bash scripts/bootstrap-terraform.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-west-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RALD ALIA — Terraform Bootstrap"
echo "  Account: ${ACCOUNT_ID}"
echo "  Region:  ${AWS_REGION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd infrastructure/terraform/bootstrap

echo "[1/3] terraform init..."
terraform init

echo "[2/3] terraform plan..."
terraform plan -var="aws_region=${AWS_REGION}" -out=bootstrap.tfplan

echo "[3/3] terraform apply..."
terraform apply bootstrap.tfplan

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Bootstrap complete. State bucket created:"
echo "  s3://rald-alia-terraform-state"
echo "  DynamoDB: rald-alia-terraform-locks"
echo ""
echo "Next — deploy dev environment:"
echo "  cd infrastructure/terraform/environments/dev"
echo "  cp terraform.tfvars.example terraform.tfvars"
echo "  # Edit terraform.tfvars: set account_id and certificate_arn"
echo "  terraform init"
echo "  terraform apply"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
