import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  const config = app.get(ConfigService<AppConfig, true>);
  app.enableShutdownHooks();

  if (config.get('docs', { infer: true }).enabled) {
    const document = new DocumentBuilder()
      .setTitle('Things API')
      .setDescription('Every response is wrapped in { success, data } or { success: false, statusCode, message }.')
      .setVersion(process.env.npm_package_version ?? '0.0.0')
      .addCookieAuth(config.get('cookies', { infer: true }).names.access)
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, document), {
      jsonDocumentUrl: 'docs/json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get('port', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`Listening on :${port} (docs at /docs)`);
}

void bootstrap();
