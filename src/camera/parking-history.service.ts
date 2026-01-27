import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ParkingSnapshot } from './entities/parking-snapshot.entity';
import { Camera } from './entities/camera.entity';

@Injectable()
export class ParkingHistoryService {
  private readonly logger = new Logger(ParkingHistoryService.name);

  constructor(
    @InjectRepository(ParkingSnapshot)
    private snapshotRepository: Repository<ParkingSnapshot>,
    @InjectRepository(Camera)
    private cameraRepository: Repository<Camera>,
  ) {}

  /**
   * Guardar snapshot de ocupación actual
   */
  async saveSnapshot(
    cameraId: string | null,
    totalSpaces: number,
    occupiedSpaces: number,
  ): Promise<ParkingSnapshot> {
    const freeSpaces = totalSpaces - occupiedSpaces;
    const occupancyRate = totalSpaces > 0 ? (occupiedSpaces / totalSpaces) * 100 : 0;

    const now = new Date();
    const snapshot = this.snapshotRepository.create({
      cameraId: cameraId ?? undefined,
      totalSpaces,
      occupiedSpaces,
      freeSpaces,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      timestamp: now,
      metadata: {
        hourOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        isWeekend: now.getDay() === 0 || now.getDay() === 6,
      },
    });

    return await this.snapshotRepository.save(snapshot) as ParkingSnapshot;
  }

  /**
   * Guardar snapshots de todas las cámaras activas
   */
  async saveAllCamerasSnapshots(): Promise<void> {
    try {
      const cameras = await this.cameraRepository.find({
        where: { isActive: true },
        relations: ['parkingZones'],
      });

      const snapshots: ParkingSnapshot[] = [];

      // Snapshot global
      let globalTotal = 0;
      let globalOccupied = 0;

      for (const camera of cameras) {
        if (camera.parkingZones && camera.parkingZones.length > 0) {
          const totalSpaces = camera.parkingZones.length;
          const occupiedSpaces = camera.parkingZones.filter(zone => zone.isOccupied).length;

          globalTotal += totalSpaces;
          globalOccupied += occupiedSpaces;

          // Snapshot por cámara
          const cameraSnapshot = await this.saveSnapshot(camera.id, totalSpaces, occupiedSpaces);
          snapshots.push(cameraSnapshot);
        }
      }

      // Snapshot global (cameraId = null)
      if (globalTotal > 0) {
        const globalSnapshot = await this.saveSnapshot(null, globalTotal, globalOccupied);
        snapshots.push(globalSnapshot);
      }

      this.logger.log(`Guardados ${snapshots.length} snapshots de ocupación`);
    } catch (error) {
      this.logger.error(`Error guardando snapshots: ${error.message}`);
    }
  }

  /**
   * Cron job: Guardar snapshot cada 10 minutos
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleSnapshotCron() {
    this.logger.debug('Ejecutando tarea programada de snapshots');
    await this.saveAllCamerasSnapshots();
  }

  /**
   * Obtener histórico de ocupación
   */
  async getOccupancyHistory(
    cameraId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<ParkingSnapshot[]> {
    const query: any = {
      timestamp: Between(startDate, endDate),
    };

    if (cameraId !== null) {
      query.cameraId = cameraId;
    } else {
      // Para histórico global, solo snapshots sin cámara específica
      query.cameraId = null;
    }

    return await this.snapshotRepository.find({
      where: query,
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * Obtener promedios por hora del día
   */
  async getAverageOccupancyByHour(
    cameraId: string | null,
    days: number = 7,
  ): Promise<Array<{ hour: number; avgOccupancy: number; count: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await this.getOccupancyHistory(cameraId, startDate, new Date());

    // Agrupar por hora
    const hourlyData: Record<number, { total: number; count: number }> = {};

    for (let h = 0; h < 24; h++) {
      hourlyData[h] = { total: 0, count: 0 };
    }

    snapshots.forEach(snapshot => {
      const hour = snapshot.metadata?.hourOfDay ?? snapshot.timestamp.getHours();
      hourlyData[hour].total += snapshot.occupancyRate;
      hourlyData[hour].count += 1;
    });

    // Calcular promedios
    const result: Array<{ hour: number; avgOccupancy: number; count: number }> = [];
    for (let h = 0; h < 24; h++) {
      const avgOccupancy = hourlyData[h].count > 0
        ? Math.round((hourlyData[h].total / hourlyData[h].count) * 100) / 100
        : 0;

      result.push({
        hour: h,
        avgOccupancy,
        count: hourlyData[h].count,
      });
    }

    return result;
  }

  /**
   * Obtener estadísticas de un período
   */
  async getPeriodStatistics(
    cameraId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    avgOccupancy: number;
    maxOccupancy: number;
    minOccupancy: number;
    peakHour: number;
    totalSnapshots: number;
  }> {
    const snapshots = await this.getOccupancyHistory(cameraId, startDate, endDate);

    if (snapshots.length === 0) {
      return {
        avgOccupancy: 0,
        maxOccupancy: 0,
        minOccupancy: 0,
        peakHour: 0,
        totalSnapshots: 0,
      };
    }

    const occupancies = snapshots.map(s => s.occupancyRate);
    const avgOccupancy = occupancies.reduce((a, b) => a + b, 0) / occupancies.length;
    const maxOccupancy = Math.max(...occupancies);
    const minOccupancy = Math.min(...occupancies);

    // Encontrar hora pico
    const hourCounts: Record<number, number[]> = {};
    snapshots.forEach(s => {
      const hour = s.metadata?.hourOfDay ?? s.timestamp.getHours();
      if (!hourCounts[hour]) hourCounts[hour] = [];
      hourCounts[hour].push(s.occupancyRate);
    });

    let peakHour = 0;
    let maxAvgForHour = 0;
    Object.entries(hourCounts).forEach(([hour, rates]) => {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      if (avg > maxAvgForHour) {
        maxAvgForHour = avg;
        peakHour = parseInt(hour);
      }
    });

    return {
      avgOccupancy: Math.round(avgOccupancy * 100) / 100,
      maxOccupancy: Math.round(maxOccupancy * 100) / 100,
      minOccupancy: Math.round(minOccupancy * 100) / 100,
      peakHour,
      totalSnapshots: snapshots.length,
    };
  }

  /**
   * Limpiar snapshots antiguos (opcional, para no acumular demasiados datos)
   */
  async cleanOldSnapshots(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.snapshotRepository.delete({
      timestamp: LessThanOrEqual(cutoffDate),
    });

    const deletedCount = result.affected || 0;
    this.logger.log(`Eliminados ${deletedCount} snapshots antiguos`);
    return deletedCount;
  }
}
