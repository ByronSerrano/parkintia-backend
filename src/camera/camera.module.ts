import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CameraService } from './camera.service';
import { CameraController } from './camera.controller';
import { ParkingDetectionService } from './parking-detection.service';
import { ParkingHistoryService } from './parking-history.service';
import { Camera } from './entities/camera.entity';
import { ParkingZone } from './entities/parking-zone.entity';
import { ParkingSnapshot } from './entities/parking-snapshot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Camera, ParkingZone, ParkingSnapshot]),
    ConfigModule,
  ],
  controllers: [CameraController],
  providers: [CameraService, ParkingDetectionService, ParkingHistoryService],
  exports: [CameraService, ParkingDetectionService, ParkingHistoryService],
})
export class CameraModule {}
