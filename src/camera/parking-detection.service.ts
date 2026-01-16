import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParkingZone } from './entities/parking-zone.entity';
import { Camera } from './entities/camera.entity';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { DetectionResult, ParkingStatusSummary } from './interfaces/parking-detection.interface';

@Injectable()
export class ParkingDetectionService {
  private readonly logger = new Logger(ParkingDetectionService.name);
  private readonly pythonServiceUrl: string;

  constructor(
    @InjectRepository(ParkingZone)
    private parkingZoneRepository: Repository<ParkingZone>,
    @InjectRepository(Camera)
    private cameraRepository: Repository<Camera>,
    private configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get<string>('PYTHON_SERVICE_URL') || 'http://localhost:5000';
  }

  /**
   * Obtiene el estado de todos los espacios de una cámara
   */
  async getParkingStatus(cameraId: string): Promise<ParkingStatusSummary> {
    const camera = await this.cameraRepository.findOne({
      where: { id: cameraId },
      relations: ['parkingZones'],
    });

    if (!camera) {
      throw new Error('Camera not found');
    }

    const occupiedSpaces = camera.parkingZones.filter(zone => zone.isOccupied).length;
    const totalSpaces = camera.parkingZones.length;

    return {
      cameraId: camera.id,
      totalSpaces,
      occupiedSpaces,
      freeSpaces: totalSpaces - occupiedSpaces,
      spaces: camera.parkingZones.map(zone => ({
        id: zone.id,
        name: zone.name,
        spaceNumber: zone.spaceNumber,
        isOccupied: zone.isOccupied,
        coordinates: zone.coordinates,
        lastDetectionTime: zone.lastDetectionTime,
      })),
      lastUpdate: new Date(),
    };
  }

  /**
   * Procesa un frame de video y actualiza el estado de los espacios
   */
  async processFrame(cameraId: string, frameBuffer: Buffer): Promise<DetectionResult> {
    try {
      // Obtener las zonas de parking de esta cámara
      const zones = await this.parkingZoneRepository.find({
        where: { camera: { id: cameraId } },
      });

      if (zones.length === 0) {
        throw new Error('No parking zones defined for this camera');
      }

      // Enviar frame al servicio Python para detección YOLO
      const formData = new FormData();
      formData.append('frame', frameBuffer, 'frame.jpg');
      formData.append('zones', JSON.stringify(zones.map(z => ({
        id: z.id,
        spaceNumber: z.spaceNumber,
        coordinates: z.coordinates,
      }))));

      const response = await axios.post(
        `${this.pythonServiceUrl}/api/detect`,
        formData,
        {
          headers: formData.getHeaders(),
          responseType: 'json',
        }
      );

      const detectionData = response.data;

      // Actualizar estado de las zonas según la detección
      for (const zoneUpdate of detectionData.zones) {
        await this.parkingZoneRepository.update(
          { id: zoneUpdate.id },
          {
            isOccupied: zoneUpdate.isOccupied,
            lastDetectionTime: new Date(),
          }
        );
      }

      return {
        frame: Buffer.from(detectionData.annotatedFrame, 'base64'),
        occupiedSpaces: detectionData.occupiedSpaces,
        freeSpaces: detectionData.freeSpaces,
        detectedVehicles: detectionData.vehicles,
      };
    } catch (error) {
      this.logger.error(`Error processing frame: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inicia el stream de video procesado
   */
  async* streamProcessedVideo(cameraId: string, videoSource: string) {
    try {
      const response = await axios.post(
        `${this.pythonServiceUrl}/api/stream/start`,
        {
          cameraId,
          videoSource,
        },
        {
          responseType: 'stream',
        }
      );

      const stream = response.data;
      
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error(`Error streaming video: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sincroniza las zonas de parking con el servicio Python
   */
  async syncZonesWithPythonService(cameraId: string): Promise<void> {
    try {
      const zones = await this.parkingZoneRepository.find({
        where: { camera: { id: cameraId } },
      });

      await axios.post(`${this.pythonServiceUrl}/api/zones/sync`, {
        cameraId,
        zones: zones.map(z => ({
          id: z.id,
          spaceNumber: z.spaceNumber,
          name: z.name,
          coordinates: z.coordinates,
        })),
      });

      this.logger.log(`Synced ${zones.length} zones with Python service`);
    } catch (error) {
      this.logger.error(`Error syncing zones: ${error.message}`);
      throw error;
    }
  }
}
