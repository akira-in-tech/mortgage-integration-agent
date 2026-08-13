import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { LoanApplication } from './entities/loan-application.entity';
import { CreateLoanApplications1710000000000 } from './migrations/1710000000000-create-loan-applications';

config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for migrations');
}

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [LoanApplication],
  migrations: [CreateLoanApplications1710000000000],
  synchronize: false,
});
