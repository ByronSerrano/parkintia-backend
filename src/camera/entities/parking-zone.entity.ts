import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Camera } from './camera.entity';

@Entity('parking_zones')
export class ParkingZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  spaceNumber: number;

  // Coordenadas del polígono que define el espacio de parqueo
  // Array de puntos [{x: number, y: number}, ...]
  @Column('simple-json')
  coordinates: Array<{ x: number; y: number }>;

  @Column({ default: false })
  isOccupied: boolean;

  @Column({ nullable: true })
  lastDetectionTime: Date;

  @ManyToOne(() => Camera, camera => camera.parkingZones)
  camera: Camera;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
