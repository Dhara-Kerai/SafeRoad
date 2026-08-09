import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set in backend/.env.test before running tests.');
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '').split('/')[0];
if (!databaseName.endsWith('_test')) {
  throw new Error('Refusing to run tests unless DATABASE_URL targets a database ending in "_test".');
}

process.env.NODE_ENV = 'test';
