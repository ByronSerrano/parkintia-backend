import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  WAMessage,
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import P from 'pino';
import * as path from 'path';
import { ChatbotService } from '../chatbot/chatbot.service';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private sock: WASocket;
  private readonly logger = new Logger(WhatsAppService.name);
  private isReady = false;

  constructor(
    private readonly chatbotService: ChatbotService,
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

      // text = text.trim(); // No hacemos lowerCase aquí para dejar que ChatbotService decida

      this.logger.log(`Mensaje recibido de ${from}: ${text}`);

      // Delegar la lógica al ChatbotService
      const response = await this.chatbotService.sendMessage({
        message: text,
        userId: from, // Usamos el JID de WhatsApp como ID de usuario
        context: 'whatsapp'
      });

      // Enviar la respuesta generada
      await this.sendTextMessage(from, response.message);

    } catch (error) {
      this.logger.error('Error al procesar mensaje:', error);
    }
  }

  private async sendTextMessage(to: string, text: string) {
    try {
      // Esperar un poco para simular escritura y evitar bloqueos
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      await this.sock.sendMessage(to, { text });
      this.logger.log(`Mensaje enviado a ${to}`);
    } catch (error) {
      this.logger.error('Error al enviar mensaje:', error);
      throw error;
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
