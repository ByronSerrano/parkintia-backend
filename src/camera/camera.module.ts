import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CameraService } from './camera.service';
import { CameraController } from './camera.controller';
import { ParkingDetectionService } from './parking-detection.service';
import { Camera } from './entities/camera.entity';
import { ParkingZone } from './entities/parking-zone.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Camera, ParkingZone]),
    ConfigModule,
  ],
  controllers: [CameraController],
  providers: [CameraService, ParkingDetectionService],
  exports: [CameraService, ParkingDetectionService],
})
export class CameraModule {}
