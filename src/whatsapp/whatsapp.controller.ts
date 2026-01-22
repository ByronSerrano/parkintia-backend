import { Controller, Get, Post, Body, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('status')
  @ApiOperation({ summary: 'Obtener estado del bot de WhatsApp' })
  @ApiResponse({ status: 200, description: 'Estado del bot obtenido exitosamente' })
  getStatus() {
    const status = this.whatsappService.getStatus();
    return {
      success: true,
      data: status,
    };
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar mensaje de WhatsApp (uso administrativo)' })
  @ApiResponse({ status: 200, description: 'Mensaje enviado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al enviar mensaje' })
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    const { to, message } = sendMessageDto;
    
    const sent = await this.whatsappService.sendMessage(to, message);
    
    if (!sent) {
      throw new HttpException(
        'No se pudo enviar el mensaje. El bot puede no estar listo.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      success: true,
      message: 'Mensaje enviado exitosamente',
    };
  }
}
