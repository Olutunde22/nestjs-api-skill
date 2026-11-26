import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/configuration';

const logger = new Logger('DatabaseModule');

const describeUrl = (url: string): string => {
  try {
    const { hostname, port, pathname } = new URL(url);
    return `${hostname}:${port || '5432'}${pathname}`;
  } catch {
    return '<unparseable url>';
  }
};

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const url = config.get('databaseUrl', { infer: true });
        logger.log(`Connecting to ${describeUrl(url)}`);
        return {
          type: 'postgres' as const,
          url,
          autoLoadEntities: true,
          // LOAD-BEARING: never synchronize. Every environment gets its schema from migrations.
          synchronize: false,
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: true,
        };
      },
    }),
    // OPTIONAL (decision gate 8): a read-only source. Connect with a SELECT-only role, list its
    // entities explicitly, and never write through it.
    // TypeOrmModule.forRootAsync({ name: 'reporting', … , synchronize: false, migrationsRun: false }),
  ],
})
export class DatabaseModule {}
