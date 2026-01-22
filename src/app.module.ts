import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
        { path: 'chatbot/message', method: RequestMethod.POST },
        { path: 'chatbot/business-info', method: RequestMethod.GET },
        { path: 'chatbot/health', method: RequestMethod.GET },
        { path: 'camera/all-data', method: RequestMethod.GET },
        { path: 'camera/total-space', method: RequestMethod.GET },
        // Permitir acceso sin auth para desarrollo del sistema de parking
        { path: 'camera', method: RequestMethod.ALL },
        { path: 'camera/:id', method: RequestMethod.ALL },
        { path: 'camera/:cameraId/parking-zones', method: RequestMethod.ALL },
        { path: 'camera/parking-zones', method: RequestMethod.ALL },
        { path: 'camera/parking-zones/:zoneId', method: RequestMethod.ALL },
        { path: 'camera/parking-zones/bulk', method: RequestMethod.ALL },
        { path: 'camera/:cameraId/parking-zones/all', method: RequestMethod.ALL },
        { path: 'camera/:cameraId/parking-status', method: RequestMethod.ALL },
        { path: 'camera/:cameraId/process-frame', method: RequestMethod.ALL },
        { path: 'camera/:cameraId/stream', method: RequestMethod.ALL },
        // WhatsApp endpoints sin autenticación
        { path: 'whatsapp/status', method: RequestMethod.GET },
        { path: 'whatsapp/send', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
