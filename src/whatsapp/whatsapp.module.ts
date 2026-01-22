import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { Camera } from '../camera/entities/camera.entity';
import { ParkingZone } from '../camera/entities/parking-zone.entity';
import { ParkingDetectionService } from '../camera/parking-detection.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Camera, ParkingZone]),
    ChatbotModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, ParkingDetectionService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
