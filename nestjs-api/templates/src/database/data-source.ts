import 'dotenv/config';
import { DataSource } from 'typeorm';

// For the TypeORM CLI (migration:generate / migration:run). Reads the same env as the app.
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
