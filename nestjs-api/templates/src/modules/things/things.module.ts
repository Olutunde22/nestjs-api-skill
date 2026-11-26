import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Thing } from './entities/thing.entity';
import { ThingsController } from './things.controller';
import { ThingsService } from './things.service';

@Module({
  imports: [TypeOrmModule.forFeature([Thing])],
  providers: [ThingsService],
  controllers: [ThingsController],
  exports: [ThingsService],
})
export class ThingsModule {}
