import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ParkingZone } from './parking-zone.entity';

@Entity('cameras')
@Unique(['name'])
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  streamUrl: string;

  @Column({ nullable: true })
  videoFile: string;

  @Column({
    default: 0
  })
  total_parking: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ParkingZone, parkingZone => parkingZone.camera)
  parkingZones: ParkingZone[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
