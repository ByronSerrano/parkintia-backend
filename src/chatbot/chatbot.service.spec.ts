import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';
import { ConfigService } from '@nestjs/config';
import { CameraService } from '../camera/camera.service';
import { DataSource } from 'typeorm';
import axios from 'axios';

// Mock de Axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChatbotService (Prueba de Caja Blanca)', () => {
  let service: ChatbotService;
  let cameraService: CameraService;

  const mockCameraService = {
    findAll: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:5000'),
  };

  const mockDataSource = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        { provide: CameraService, useValue: mockCameraService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
    cameraService = module.get<CameraService>(CameraService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Debe ejecutar el camino crítico: Inicio -> Menú Maqueta -> Consulta Parking', async () => {
    const userId = 'tesis_tester_01';

    // --- PASO 1: Inicio de Sesión (Ruta de Inicialización) ---
    // Input: "Hola" -> Esperado: Crear sesión y devolver Menú Principal
    const response1 = await service.sendMessage({ message: 'Hola', userId });
    
    expect(response1.context).toBe('main-menu');
    expect(response1.message).toContain('Sistema de Gestión de Estacionamiento');
    // Verificación de Caja Blanca: Comprobamos que el estado interno cambió
    // (Accedemos a la propiedad privada usando 'any' solo para testing de caja blanca)
    const session1 = (service as any).userSessions.get(userId);
    expect(session1.state).toBe('MAIN_MENU');

    // --- PASO 2: Transición de Estado (Ruta de Decisión Switch/Case) ---
    // Input: "1" -> Esperado: Cambiar estado a MAQUETA_MENU
    const response2 = await service.sendMessage({ message: '1', userId });

    expect(response2.context).toBe('MAQUETA_MENU');
    expect(response2.message).toContain('Menú - Maqueta de Prueba');
    
    const session2 = (service as any).userSessions.get(userId);
    expect(session2.state).toBe('MAQUETA_MENU');

    // --- PASO 3: Lógica de Negocio y Llamada Externa (Ruta de Integración) ---
    // Configurar Mocks para simular datos internos
    mockCameraService.findAll.mockResolvedValue([
      { id: 'cam1', name: 'Cam Test', total_parking: 10, streamUrl: 'cam-01' }
    ]);
    
    // Mockear respuesta del servicio de Python
    mockedAxios.get.mockResolvedValue({
      data: { totalSpaces: 10, occupiedSpaces: 4, freeSpaces: 6 }
    });

    // Input: "1" (estando en Maqueta Menu) -> Esperado: Calcular estadísticas
    const response3 = await service.sendMessage({ message: '1', userId });

    // Verificaciones
    expect(mockCameraService.findAll).toHaveBeenCalled(); // Se llamó a la DB
    expect(mockedAxios.get).toHaveBeenCalled(); // Se llamó a la API Python
    expect(response3.message).toContain('Reporte de Disponibilidad');
    expect(response3.message).toContain('Espacios Ocupados: 4');
    expect(response3.message).toContain('Tasa de Ocupación: 40.0%');
  });
});
