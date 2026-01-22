import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'Número de WhatsApp del destinatario (con código de país)',
    example: '593978946772',
  })
  @IsNotEmpty()
  @IsString()
  to: string;

  @ApiProperty({
    description: 'Mensaje a enviar',
    example: 'Hola, este es un mensaje de prueba del bot de Parking IA',
  })
  @IsNotEmpty()
  @IsString()
  message: string;
}
