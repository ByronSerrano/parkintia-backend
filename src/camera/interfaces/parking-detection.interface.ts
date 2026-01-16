export interface ParkingSpaceStatus {
  id: string;
  name: string;
  spaceNumber: number;
  isOccupied: boolean;
  coordinates: Array<{ x: number; y: number }>;
  lastDetectionTime?: Date;
}

export interface ParkingStatusSummary {
  cameraId: string;
  totalSpaces: number;
  occupiedSpaces: number;
  freeSpaces: number;
  spaces: ParkingSpaceStatus[];
  lastUpdate: Date;
}

export interface DetectionResult {
  frame: Buffer;
  occupiedSpaces: number;
  freeSpaces: number;
  detectedVehicles: Array<{
    class: string;
    confidence: number;
    bbox: { x1: number; y1: number; x2: number; y2: number };
    spaceNumber?: number;
  }>;
}
