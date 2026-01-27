import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Camera } from './camera.entity';

@Entity('parking_snapshots')
@Index(['timestamp'])
@Index(['cameraId', 'timestamp'])
export class ParkingSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  cameraId: string;

  @ManyToOne(() => Camera, { nullable: true, onDelete: 'SET NULL' })
  camera: Camera;

  @Column()
  totalSpaces: number;

  @Column()
  occupiedSpaces: number;

  @Column()
  freeSpaces: number;

  @Column('decimal', { precision: 5, scale: 2 })
  occupancyRate: number;

  @CreateDateColumn()
  @Index()
  timestamp: Date;

  // Metadata adicional para análisis
  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    hourOfDay?: number;
    dayOfWeek?: number;
    isWeekend?: boolean;
  };
}
