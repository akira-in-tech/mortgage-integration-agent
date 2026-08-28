resource "aws_db_subnet_group" "this" {
  name       = local.name
  subnet_ids = aws_subnet.public[*].id
}

resource "aws_db_instance" "this" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_allocated_storage_gb * 2
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "mortgage_agent"
  username = "mortgage"
  password = random_password.rds_master.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  # In a subnet with an internet route, but never assigned a public
  # IP or reachable except through its own security group — see
  # security-groups.tf.
  publicly_accessible = false

  backup_retention_period = 3
  skip_final_snapshot     = true # A synthetic staging database — real backup/restore evidence is a named next step, not this instance's own final snapshot.
  deletion_protection     = false

  tags = { Name = local.name }
}
