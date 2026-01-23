import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { ChatMessageDto, ChatResponseDto } from './dto/chat-message.dto';
import { CameraService } from '../camera/camera.service';

enum ChatState {
  MAIN_MENU = 'MAIN_MENU',
  MAQUETA_MENU = 'MAQUETA_MENU',
}

interface UserSession {
  state: ChatState;
  lastActivity: Date;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private userSessions = new Map<string, UserSession>();
  private readonly pythonServiceUrl: string;

  constructor(
    private configService: ConfigService,
    private cameraService: CameraService,
    @InjectDataSource() private dataSource: DataSource,
  ) {
    // Usar 127.0.0.1 para asegurar compatibilidad local (Mac/Node 18+)
    this.pythonServiceUrl = this.configService.get<string>('PYTHON_SERVICE_URL') || 'http://127.0.0.1:5000';
  }

  async sendMessage(chatMessageDto: ChatMessageDto): Promise<ChatResponseDto> {
    try {
      const { message, userId } = chatMessageDto;
      // Normalizar input: quitar espacios, minusculas
      const cleanMessage = message.trim().toLowerCase(); 
      const userKey = userId || 'default_user';

      this.logger.log(`📩 Mensaje recibido de ${userKey}: "${cleanMessage}"`);

      // Recuperar o inicializar sesión
      let session = this.userSessions.get(userKey);
      
      // Si no existe sesión, la creamos y mostramos el menú principal inmediatamente
      if (!session) {
        this.logger.log(`🆕 Nueva sesión para ${userKey}`);
        session = { state: ChatState.MAIN_MENU, lastActivity: new Date() };
        this.userSessions.set(userKey, session);
        return this.generateResponse(this.getMainMenuText(), 'main-menu');
      }

      this.logger.log(`🔄 Estado actual: ${session.state}`);

      session.lastActivity = new Date();
      let responseText = '';
      let nextState = session.state;

      // 0. Verificar agradecimientos globales (intercepta antes de la máquina de estados)
      if (cleanMessage.includes('gracias') || cleanMessage.includes('agradecid') || cleanMessage.includes('thank')) {
        const currentMenu = session.state === ChatState.MAIN_MENU ? this.getMainMenuText() : this.getMaquetaMenuText();
        responseText = `¡De nada! Es un placer ayudarte. 😊\n\n¿Deseas consultar algo más?\n\n${currentMenu}`;
        // No cambiamos el estado, nos quedamos donde estábamos
        return this.generateResponse(responseText, session.state);
      }

      // Máquina de estados
      switch (session.state) {
        case ChatState.MAIN_MENU:
          // Variaciones extendidas para Maqueta de Prueba
          if (
            cleanMessage === '1' || 
            cleanMessage.startsWith('1.') || 
            cleanMessage.includes('maqueta') || 
            cleanMessage.includes('prueba') || 
            cleanMessage.includes('test') ||
            cleanMessage.includes('uno')
          ) {
            responseText = this.getMaquetaMenuText();
            nextState = ChatState.MAQUETA_MENU;
          } else {
            // Mensaje de error profesional para menú principal
            responseText = `❌ *Lo sentimos, opción incorrecta.*\n\nNo hemos podido reconocer tu comando. Por favor selecciona una opción válida:\n\n1. Maqueta de Prueba`;
          }
          break;

        case ChatState.MAQUETA_MENU:
          // Variaciones extendidas para Estacionamiento
          if (
            cleanMessage === '1' || 
            cleanMessage.startsWith('1.') || 
            cleanMessage.includes('estacionamiento') || 
            cleanMessage.includes('parqueo') || 
            cleanMessage.includes('lugar') || 
            cleanMessage.includes('disponibilidad') ||
            cleanMessage.includes('cupo') ||
            cleanMessage.includes('espacio')
          ) {
            // Consultar Estacionamiento
            this.logger.log('📊 Consultando estadísticas de estacionamiento...');
            responseText = await this.getParkingStatsText();
            // Mantenemos el estado para que pueda seguir consultando
            responseText += `\n\n¿Deseas consultar algo más?\n${this.getMaquetaMenuText()}`;
          } 
          // Variaciones extendidas para Ayuda/Reportar
          else if (
            cleanMessage === '2' || 
            cleanMessage.startsWith('2.') || 
            cleanMessage.includes('ayuda') || 
            cleanMessage.includes('reportar') || 
            cleanMessage.includes('soporte') ||
            cleanMessage.includes('problema') ||
            cleanMessage.includes('contacto') ||
            cleanMessage.includes('llamar')
          ) {
            // Ayuda / Reportar
            responseText = `ℹ️ *Reportar o Ayuda*\n\nSi necesitas asistencia técnica, reportar un problema o recibir más información, por favor comunícate directamente con nosotros:\n\n📞 *Contacto:* +593 987156456\n\nSelecciona una opción del menú para continuar:\n${this.getMaquetaMenuText()}`;
          } 
          // Variaciones extendidas para Regresar
          else if (
            cleanMessage === '0' || 
            cleanMessage.startsWith('0.') || 
            cleanMessage.includes('regresar') || 
            cleanMessage.includes('volver') ||
            cleanMessage.includes('atras') ||
            cleanMessage.includes('inicio') ||
            cleanMessage.includes('salir')
          ) {
            // Regresar (opción estándar)
            responseText = this.getMainMenuText();
            nextState = ChatState.MAIN_MENU;
          } else {
            // Mensaje de error profesional con opción de regresar
            responseText = `❌ *Lo sentimos, opción incorrecta.*\n\nPor favor intenta con una de las opciones disponibles:\n\n1. Estacionamiento\n2. Reportar o Ayuda\n0. Regresar al menú principal`;
          }
          break;

        default:
          session.state = ChatState.MAIN_MENU;
          responseText = this.getMainMenuText();
          break;
      }

      // Actualizar estado
      session.state = nextState;
      this.userSessions.set(userKey, session);
      this.logger.log(`➡️ Nuevo estado: ${nextState}`);

      return this.generateResponse(responseText, nextState);

    } catch (error) {
      this.logger.error('❌ Error procesando mensaje:', error);
      return this.generateResponse('Lo siento, ocurrió un error interno. Intenta nuevamente más tarde.', 'error');
    }
  }

  private getMainMenuText(): string {
    return `🚗 *Bienvenido a Parking IA*\n\nPor favor selecciona el lugar que deseas consultar:\n\n1. Maqueta de Prueba`;
  }

  private getMaquetaMenuText(): string {
    return `🏗️ *Menú Maqueta de Prueba*\n\n¿Qué deseas consultar?\n\n1. Estacionamiento (Ver disponibilidad)\n2. Reportar o Ayuda\n0. Regresar al menú principal`;
  }

  private async getParkingStatsText(): Promise<string> {
    try {
      // 1. Obtener todas las cámaras
      const cameras = await this.cameraService.findAll();
      this.logger.log(`📷 Cámaras encontradas en DB: ${cameras.length}`);
      
      if (!cameras || cameras.length === 0) {
        return '🚫 No hay cámaras configuradas en el sistema actualmente.';
      }

      let totalOccupied = 0;
      let totalFree = 0;
      let totalSpaces = 0;

      // 2. Consultar estado en vivo de cada cámara al servicio Python
      // Usamos Promise.all para hacerlo en paralelo
      const statusPromises = cameras.map(async (camera) => {
        try {
          // Priorizar streamUrl (ej: cam-08) si existe y no es "stream" genérico, sino usar ID
          const targetId = (camera.streamUrl && camera.streamUrl !== 'stream') ? camera.streamUrl : camera.id;
          
          this.logger.log(`🔎 Consultando Python para cámara: ${camera.name} (ID: ${targetId})`);
          
          const response = await axios.get(
            `${this.pythonServiceUrl}/api/parking/status?cameraId=${targetId}`
          );
          
          this.logger.log(`✅ Respuesta Python para ${targetId}: ${JSON.stringify(response.data)}`);
          return response.data;
        } catch (error) {
          this.logger.warn(`❌ Error obteniendo estado de cámara ${camera.name}: ${error.message}`);
          return null;
        }
      });

      const results = await Promise.all(statusPromises);

      // 3. Agregar resultados
      for (const stat of results) {
        if (stat) {
          totalOccupied += (stat.occupiedSpaces || 0);
          totalSpaces += (stat.totalSpaces || 0);
          // Calcular libres (total - ocupados)
          const free = (stat.totalSpaces || 0) - (stat.occupiedSpaces || 0);
          totalFree += free > 0 ? free : 0;
        }
      }

      this.logger.log(`∑ Totales: Ocupados=${totalOccupied}, Libres=${totalFree}, Total=${totalSpaces}`);

      // Si no pudimos obtener datos en vivo de ninguna, usar fallback de DB
      if (totalSpaces === 0 && cameras.length > 0) {
         this.logger.warn('⚠️ Usando fallback de base de datos porque Python devolvió 0 o falló.');
         totalSpaces = cameras.reduce((acc, c) => acc + c.total_parking, 0);
         totalFree = totalSpaces; // Asumir libres si no hay IA
      }

      const occupancyRate = totalSpaces > 0 ? ((totalOccupied / totalSpaces) * 100).toFixed(1) : '0.0';

      return `📊 *Estado del Estacionamiento*\n\n🚘 Ocupados: ${totalOccupied}\n✅ Disponibles: ${totalFree}\n🔢 Total Espacios: ${totalSpaces}\n📉 Ocupación: ${occupancyRate}%`;

    } catch (error) {
      this.logger.error('Error calculando estadísticas globales:', error);
      return '❌ Error obteniendo datos del estacionamiento en tiempo real.';
    }
  }

  private generateResponse(message: string, context: string): ChatResponseDto {
    return {
      message,
      timestamp: new Date(),
      context,
    };
  }

  // Métodos legacy para compatibilidad si algo los llama
  async getBusinessInfo(): Promise<any> {
    return {
      totalUsers: 0,
      recentActivity: 'N/A',
      features: [],
      targetMarkets: []
    };
  }
}
