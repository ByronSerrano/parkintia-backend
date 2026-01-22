import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  WAMessage,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import P from 'pino';
import { ParkingDetectionService } from '../camera/parking-detection.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Camera } from '../camera/entities/camera.entity';
import { Repository } from 'typeorm';
import * as path from 'path';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private sock: WASocket;
  private readonly logger = new Logger(WhatsAppService.name);
  private isReady = false;

  constructor(
    private readonly parkingDetectionService: ParkingDetectionService,
    @InjectRepository(Camera)
    private readonly cameraRepository: Repository<Camera>,
  ) {}

  async onModuleInit() {
    await this.initializeWhatsApp();
  }

  private async initializeWhatsApp() {
    this.logger.log('Inicializando WhatsApp Bot con Baileys...');

    const authFolder = path.join(process.cwd(), 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    this.sock = makeWASocket({
      auth: state,
      logger: P({ level: 'silent' }),
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.logger.log('📱 Escanea este código QR con WhatsApp:');
        this.logger.log('=========================================');
        qrcode.generate(qr, { small: true });
        this.logger.log('=========================================');
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        this.logger.warn(
          `❌ Conexión cerrada. Reconectando: ${shouldReconnect}`,
        );

        if (shouldReconnect) {
          setTimeout(() => {
            this.initializeWhatsApp();
          }, 3000);
        } else {
          this.logger.warn('⚠️ Sesión cerrada. Necesitas volver a autenticar.');
        }
        this.isReady = false;
      } else if (connection === 'open') {
        this.isReady = true;
        this.logger.log('✅ WhatsApp Bot conectado exitosamente con Baileys!');
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        await this.handleMessage(m);
      }
    });
  }

  private async handleMessage(m: WAMessage) {
    try {
      if (!m.message || m.key.fromMe) return;

      const from = m.key.remoteJid;
      if (!from) return;

      const messageType = Object.keys(m.message)[0];
      
      let text = '';
      
      if (messageType === 'conversation' && m.message.conversation) {
        text = m.message.conversation;
      } else if (messageType === 'extendedTextMessage' && m.message.extendedTextMessage?.text) {
        text = m.message.extendedTextMessage.text;
      }

      if (!text) return;

      text = text.toLowerCase().trim();

      this.logger.log(`Mensaje recibido de ${from}: ${text}`);

      if (text === 'hola' || text === 'menu') {
        await this.sendWelcomeMessage(from);
      } else if (text === 'espacios') {
        await this.sendParkingStatus(from);
      } else if (text === 'camaras') {
        await this.sendCamerasList(from);
      } else if (text.startsWith('camara')) {
        const parts = text.split(' ');
        if (parts.length === 2 && !isNaN(Number(parts[1]))) {
          const cameraNumber = Number(parts[1]);
          await this.sendSpecificCameraStatus(from, cameraNumber);
        } else {
          const responseText =
            '❌ Por favor usa el formato: "camara [número]"\n\nEjemplo: camara 1';
          await this.sendTextMessage(from, responseText);
        }
      } else if (text === 'ayuda') {
        await this.sendWelcomeMessage(from);
      }
    } catch (error) {
      this.logger.error('Error al procesar mensaje:', error);
    }
  }

  private async sendTextMessage(to: string, text: string) {
    try {
      // Esperar 2 segundos antes de enviar para evitar bloqueos
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      await this.sock.sendMessage(to, { text });
      this.logger.log(`Mensaje enviado a ${to}`);
    } catch (error) {
      this.logger.error('Error al enviar mensaje:', error);
      throw error;
    }
  }

  private async sendWelcomeMessage(to: string) {
    const welcomeText = `
🅿️ *Bienvenido al Sistema de Gestión de Parqueadero*

📱 Comandos disponibles:

• *espacios* - Ver estado de todos los espacios
• *camaras* - Ver lista de cámaras
• *camara [número]* - Ver espacios de una cámara específica
• *ayuda* - Ver este menú

¡Escribe un comando para comenzar!
    `.trim();

    try {
      await this.sendTextMessage(to, welcomeText);
    } catch (error) {
      this.logger.error('Error al enviar mensaje de bienvenida:', error);
      throw error;
    }
  }

  private async sendParkingStatus(to: string) {
    try {
      const cameras = await this.cameraRepository.find({
        relations: ['parkingZones'],
      });

      if (cameras.length === 0) {
        const responseText = '❌ No hay cámaras configuradas en el sistema.';
        await this.sendTextMessage(to, responseText);
        return;
      }

      let totalSpaces = 0;
      let occupiedSpaces = 0;

      cameras.forEach((camera) => {
        totalSpaces += camera.parkingZones.length;
        occupiedSpaces += camera.parkingZones.filter(
          (zone) => zone.isOccupied,
        ).length;
      });

      const availableSpaces = totalSpaces - occupiedSpaces;

      const statusText = `
🅿️ *Estado del Parqueadero*

📊 Resumen General:
• Total de espacios: ${totalSpaces}
• Espacios ocupados: ${occupiedSpaces} 🔴
• Espacios disponibles: ${availableSpaces} 🟢

${cameras
  .map(
    (camera) => `
📹 *${camera.name}*
${camera.parkingZones
  .map((zone) => `  Espacio ${zone.spaceNumber}: ${zone.isOccupied ? '🔴 Ocupado' : '🟢 Libre'}`)
  .join('\n')}
`,
  )
  .join('\n')}

Usa "camara [número]" para ver una cámara específica.
      `.trim();

      await this.sendTextMessage(to, statusText);
    } catch (error) {
      this.logger.error('Error al enviar estado de parqueadero:', error);
      const errorText =
        '❌ Hubo un error al obtener el estado del parqueadero. Por favor intenta de nuevo.';
      await this.sendTextMessage(to, errorText);
    }
  }

  private async sendCamerasList(to: string) {
    try {
      const cameras = await this.cameraRepository.find({
        relations: ['parkingZones'],
      });

      if (cameras.length === 0) {
        const responseText = '❌ No hay cámaras configuradas en el sistema.';
        await this.sendTextMessage(to, responseText);
        return;
      }

      const camerasText = `
📹 *Lista de Cámaras*

${cameras
  .map((camera, index) => {
    const totalSpaces = camera.parkingZones.length;
    const occupiedSpaces = camera.parkingZones.filter((zone) => zone.isOccupied)
      .length;
    const availableSpaces = totalSpaces - occupiedSpaces;

    return `
${index + 1}. *${camera.name}*
   ${camera.description || 'Sin descripción'}
   Total: ${totalSpaces} | Ocupados: ${occupiedSpaces} 🔴 | Libres: ${availableSpaces} 🟢
`;
  })
  .join('\n')}

Usa "camara [número]" para ver detalles de una cámara.
      `.trim();

      await this.sendTextMessage(to, camerasText);
    } catch (error) {
      this.logger.error('Error al enviar lista de cámaras:', error);
      const errorText =
        '❌ Hubo un error al obtener las cámaras. Por favor intenta de nuevo.';
      await this.sendTextMessage(to, errorText);
    }
  }

  private async sendSpecificCameraStatus(to: string, cameraNumber: number) {
    try {
      const cameras = await this.cameraRepository.find({
        relations: ['parkingZones'],
      });

      if (cameraNumber < 1 || cameraNumber > cameras.length) {
        const responseText = `❌ Cámara no encontrada. Usa "camaras" para ver la lista disponible (1-${cameras.length}).`;
        await this.sendTextMessage(to, responseText);
        return;
      }

      const camera = cameras[cameraNumber - 1];
      const totalSpaces = camera.parkingZones.length;
      const occupiedSpaces = camera.parkingZones.filter((zone) => zone.isOccupied)
        .length;
      const availableSpaces = totalSpaces - occupiedSpaces;

      const cameraText = `
📹 *${camera.name}*
${camera.description || 'Sin descripción'}

📊 Estado:
• Total de espacios: ${totalSpaces}
• Espacios ocupados: ${occupiedSpaces} 🔴
• Espacios disponibles: ${availableSpaces} 🟢

📋 Detalle de espacios:
${camera.parkingZones
  .map((zone) => {
    const status = zone.isOccupied ? '🔴 Ocupado' : '🟢 Libre';
    const lastUpdate = zone.lastDetectionTime
      ? new Date(zone.lastDetectionTime).toLocaleString('es-EC', {
          timeZone: 'America/Guayaquil',
        })
      : 'Sin actualización';
    return `  Espacio ${zone.spaceNumber}: ${status}\n  Última actualización: ${lastUpdate}`;
  })
  .join('\n\n')}
      `.trim();

      await this.sendTextMessage(to, cameraText);
    } catch (error) {
      this.logger.error('Error al enviar estado de cámara:', error);
      const errorText =
        '❌ Hubo un error al obtener la información de la cámara. Por favor intenta de nuevo.';
      await this.sendTextMessage(to, errorText);
    }
  }

  getStatus() {
    return {
      ready: this.isReady,
      message: this.isReady
        ? 'WhatsApp Bot está conectado y listo'
        : 'WhatsApp Bot no está conectado',
    };
  }

  async sendMessage(to: string, message: string) {
    if (!this.isReady) {
      throw new Error('WhatsApp Bot no está listo');
    }

    try {
      await this.sendTextMessage(to, message);
      return { success: true, message: 'Mensaje enviado correctamente' };
    } catch (error) {
      this.logger.error('Error al enviar mensaje:', error);
      throw error;
    }
  }
}
