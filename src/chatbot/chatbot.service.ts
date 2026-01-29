import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { ChatMessageDto, ChatResponseDto } from './dto/chat-message.dto';
import { CameraService } from '../camera/camera.service';

enum ChatState {
  MAIN_MENU = 'MAIN_MENU',
  MEDICAL_MENU = 'MEDICAL_MENU',
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
        const currentMenu = session.state === ChatState.MAIN_MENU ? this.getMainMenuText() : this.getMedicalMenuText();
        responseText = `A su servicio. ¿Desea realizar alguna otra consulta?\n\n${currentMenu}`;
        // No cambiamos el estado, nos quedamos donde estábamos
        return this.generateResponse(responseText, session.state);
      }

      // Máquina de estados
      switch (session.state) {
        case ChatState.MAIN_MENU:
          // Variaciones extendidas para MedicalPluss
          if (
            cleanMessage === '1' || 
            cleanMessage.startsWith('1.') || 
            cleanMessage.includes('medical') || 
            cleanMessage.includes('plus') || 
            cleanMessage.includes('clinica') ||
            cleanMessage.includes('uno')
          ) {
            responseText = this.getMedicalMenuText();
            nextState = ChatState.MEDICAL_MENU;
          } else {
            // Mensaje de error profesional para menú principal
            responseText = `*Opción no válida.*\n\nEl comando ingresado no ha sido reconocido. Por favor seleccione una de las opciones disponibles:\n\n1. MedicalPluss`;
          }
          break;

        case ChatState.MEDICAL_MENU:
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
            responseText += `\n\n¿Desea realizar alguna otra consulta?\n${this.getMedicalMenuText()}`;
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
            responseText = `*Soporte Técnico*\n\nPara reportar inconvenientes o solicitar asistencia, por favor comuníquese a través del siguiente canal:\n\nTeléfono: +593 987156456\n\nSeleccione una opción para continuar:\n${this.getMedicalMenuText()}`;
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
            responseText = `*Opción no válida.*\n\nPor favor intente con una de las opciones disponibles:\n\n1. Consultar disponibilidad de estacionamiento\n2. Soporte y reportes\n0. Regresar al menú principal`;
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
      return this.generateResponse('Ha ocurrido un error interno en el sistema. Por favor, intente nuevamente más tarde.', 'error');
    }
  }

  private getMainMenuText(): string {
    return `*Sistema de Gestión de Estacionamiento*\n\nBienvenido. Por favor seleccione el área que desea consultar:\n\n1. MedicalPluss`;
  }

  private getMedicalMenuText(): string {
    return `*Menú - MedicalPluss*\n\nSeleccione una opción:\n\n1. Consultar disponibilidad de estacionamiento\n2. Soporte y reportes\n0. Regresar al menú principal`;
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

      return `*Reporte de Disponibilidad*\n\nEspacios Ocupados: ${totalOccupied}\nEspacios Disponibles: ${totalFree}\nCapacidad Total: ${totalSpaces}\nTasa de Ocupación: ${occupancyRate}%`;

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
