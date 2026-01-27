import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataBaseConfig } from './config/database.config';
import { CameraModule } from './camera/camera.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async () => ({
        ...dataBaseConfig,
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    CameraModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'user', method: RequestMethod.POST },
        { path: 'user/:id', method: RequestMethod.GET },
        { path: 'user/stats', method: RequestMethod.GET },
        { path: 'chatbot/message', method: RequestMethod.POST },
        { path: 'chatbot/business-info', method: RequestMethod.GET },
        { path: 'chatbot/health', method: RequestMethod.GET },
        { path: 'cameras/all-data', method: RequestMethod.GET },
        { path: 'cameras/total-space', method: RequestMethod.GET },
        { path: 'cameras/stats/global', method: RequestMethod.GET },
        // Permitir acceso sin auth para desarrollo del sistema de parking
        { path: 'cameras', method: RequestMethod.ALL },
        { path: 'cameras/:id', method: RequestMethod.ALL },
        { path: 'cameras/:cameraId/parking-zones', method: RequestMethod.ALL },
        { path: 'cameras/parking-zones', method: RequestMethod.ALL },
        { path: 'cameras/parking-zones/:zoneId', method: RequestMethod.ALL },
        { path: 'cameras/parking-zones/bulk', method: RequestMethod.ALL },
        { path: 'cameras/:cameraId/parking-zones/all', method: RequestMethod.ALL },
        { path: 'cameras/:cameraId/parking-status', method: RequestMethod.ALL },
        { path: 'cameras/:cameraId/process-frame', method: RequestMethod.ALL },
        { path: 'cameras/:cameraId/stream', method: RequestMethod.ALL },
        { path: 'cameras/parking-status-live', method: RequestMethod.ALL },
        { path: 'cameras/video-control', method: RequestMethod.ALL },
        { path: 'cameras/video-feed', method: RequestMethod.ALL },
        { path: 'cameras/zones/default', method: RequestMethod.ALL },
        // WhatsApp endpoints sin autenticación
        { path: 'whatsapp/status', method: RequestMethod.GET },
        { path: 'whatsapp/send', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
