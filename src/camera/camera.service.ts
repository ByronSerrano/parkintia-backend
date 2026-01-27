import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { CreateParkingZoneDto, UpdateParkingZoneDto, BulkCreateParkingZonesDto } from './dto/parking-zone.dto';
import { Camera } from './entities/camera.entity';
import { ParkingZone } from './entities/parking-zone.entity';
import { ParkingDetectionService } from './parking-detection.service';

@Injectable()
export class CameraService {
  constructor(
    @InjectRepository(Camera)
    private cameraRepository: Repository<Camera>,
    @InjectRepository(ParkingZone)
    private parkingZoneRepository: Repository<ParkingZone>,
    private parkingDetectionService: ParkingDetectionService,
  ) {}

  async create(createCameraDto: CreateCameraDto): Promise<Camera> {
    const camera = this.cameraRepository.create(createCameraDto);
    return await this.cameraRepository.save(camera);
  }

  async findAll(): Promise<Camera[]> {
    return await this.cameraRepository.find({
      relations: ['parkingZones'],
    });
  }

  async findOne(id: string): Promise<Camera> {
    const camera = await this.cameraRepository.findOne({
      where: { id },
      relations: ['parkingZones'],
    });

    if (!camera) {
      throw new NotFoundException(`Camera with ID ${id} not found`);
    }

    return camera;
  }

  async update(id: string, updateCameraDto: UpdateCameraDto): Promise<Camera> {
    const camera = await this.findOne(id);
    Object.assign(camera, updateCameraDto);
    return await this.cameraRepository.save(camera);
  }

  async remove(id: string): Promise<void> {
    const camera = await this.findOne(id);
    await this.cameraRepository.remove(camera);
  }

  // ========== PARKING ZONES ==========

  async createParkingZone(createParkingZoneDto: CreateParkingZoneDto): Promise<ParkingZone> {
    const camera = await this.findOne(createParkingZoneDto.cameraId);
    
    const parkingZone = this.parkingZoneRepository.create({
      ...createParkingZoneDto,
      camera,
    });

    const saved = await this.parkingZoneRepository.save(parkingZone);
    
    // Actualizar total de espacios en la cámara
    camera.total_parking = await this.parkingZoneRepository.count({
      where: { camera: { id: camera.id } },
    });
    await this.cameraRepository.save(camera);

    // Sincronizar con servicio Python
    await this.parkingDetectionService.syncZonesWithPythonService(camera.id);

    return saved;
  }

  async bulkCreateParkingZones(bulkDto: BulkCreateParkingZonesDto): Promise<ParkingZone[]> {
    const camera = await this.findOne(bulkDto.cameraId);
    
    const zones = bulkDto.zones.map(zone => 
      this.parkingZoneRepository.create({
        ...zone,
        camera,
      })
    );

    const saved = await this.parkingZoneRepository.save(zones);
    
    // Actualizar total de espacios en la cámara
    camera.total_parking = await this.parkingZoneRepository.count({
      where: { camera: { id: camera.id } },
    });
    await this.cameraRepository.save(camera);

    // Sincronizar con servicio Python
    await this.parkingDetectionService.syncZonesWithPythonService(camera.id);

    return saved;
  }

  async updateParkingZone(zoneId: string, updateDto: UpdateParkingZoneDto): Promise<ParkingZone> {
    const zone = await this.parkingZoneRepository.findOne({
      where: { id: zoneId },
      relations: ['camera'],
    });

    if (!zone) {
      throw new NotFoundException(`Parking zone with ID ${zoneId} not found`);
    }

    Object.assign(zone, updateDto);
    const updated = await this.parkingZoneRepository.save(zone);

    // Sincronizar con servicio Python
    await this.parkingDetectionService.syncZonesWithPythonService(zone.camera.id);

    return updated;
  }

  async deleteParkingZone(zoneId: string): Promise<void> {
    const zone = await this.parkingZoneRepository.findOne({
      where: { id: zoneId },
      relations: ['camera'],
    });

    if (!zone) {
      throw new NotFoundException(`Parking zone with ID ${zoneId} not found`);
    }

    const cameraId = zone.camera.id;
    await this.parkingZoneRepository.remove(zone);

    // Actualizar total de espacios en la cámara
    const camera = await this.findOne(cameraId);
    camera.total_parking = await this.parkingZoneRepository.count({
      where: { camera: { id: cameraId } },
    });
    await this.cameraRepository.save(camera);

    // Sincronizar con servicio Python
    await this.parkingDetectionService.syncZonesWithPythonService(cameraId);
  }

  async getParkingZonesByCamera(cameraId: string): Promise<ParkingZone[]> {
    return await this.parkingZoneRepository.find({
      where: { camera: { id: cameraId } },
      order: { spaceNumber: 'ASC' },
    });
  }

  async deleteAllZonesFromCamera(cameraId: string): Promise<void> {
    const camera = await this.findOne(cameraId);
    await this.parkingZoneRepository.delete({ camera: { id: cameraId } });
    
    camera.total_parking = 0;
    await this.cameraRepository.save(camera);

    // Sincronizar con servicio Python
    await this.parkingDetectionService.syncZonesWithPythonService(cameraId);
  }

  // ========== ESTADÍSTICAS GLOBALES ==========

  async getGlobalStats(): Promise<{
    totalSpaces: number;
    occupiedSpaces: number;
    freeSpaces: number;
    occupancyRate: number;
    totalCameras: number;
    activeCameras: number;
    camerasWithZones: number;
  }> {
    // Obtener todas las cámaras con sus zonas
    const cameras = await this.cameraRepository.find({
      relations: ['parkingZones'],
    });

    let totalSpaces = 0;
    let occupiedSpaces = 0;
    let activeCameras = 0;
    let camerasWithZones = 0;

    for (const camera of cameras) {
      if (camera.isActive) {
        activeCameras++;
      }

      if (camera.parkingZones && camera.parkingZones.length > 0) {
        camerasWithZones++;
        totalSpaces += camera.parkingZones.length;
        
        // Contar espacios ocupados
        const occupied = camera.parkingZones.filter(zone => zone.isOccupied).length;
        occupiedSpaces += occupied;
      }
    }

    const freeSpaces = totalSpaces - occupiedSpaces;
    const occupancyRate = totalSpaces > 0 ? (occupiedSpaces / totalSpaces) * 100 : 0;

    return {
      totalSpaces,
      occupiedSpaces,
      freeSpaces,
      occupancyRate: Math.round(occupancyRate * 100) / 100, // Redondear a 2 decimales
      totalCameras: cameras.length,
      activeCameras,
      camerasWithZones,
    };
  }
}
