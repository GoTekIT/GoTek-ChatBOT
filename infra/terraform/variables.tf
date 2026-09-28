variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name (staging/production)"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Application identifier"
  type        = string
  default     = "gotek-chatbot"
}
