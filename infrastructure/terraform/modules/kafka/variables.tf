variable "environment"             { type = string }
variable "vpc_id"                  { type = string }
variable "private_subnet_ids"      { type = list(string) }
variable "kafka_security_group_id" { type = string }
variable "kafka_version"           { type = string }
variable "broker_instance_type"    { type = string }
variable "number_of_broker_nodes"  { type = number }
variable "ebs_volume_size"         { type = number }
