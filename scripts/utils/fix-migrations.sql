-- Script para registrar las migraciones existentes y crear la tabla parking_snapshots

-- 1. Registrar la primera migración como ya ejecutada
INSERT INTO migrations (timestamp, name) 
VALUES (1705385000000, 'CreateCameraAndParkingZoneTables1705385000000')
ON CONFLICT DO NOTHING;

-- 2. Crear la tabla parking_snapshots
CREATE TABLE IF NOT EXISTS parking_snapshots (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "cameraId" uuid,
    "totalSpaces" integer NOT NULL,
    "occupiedSpaces" integer NOT NULL,
    "freeSpaces" integer NOT NULL,
    "occupancyRate" decimal(5,2) NOT NULL,
    timestamp timestamp DEFAULT now() NOT NULL,
    metadata jsonb,
    FOREIGN KEY ("cameraId") REFERENCES cameras(id) ON DELETE SET NULL
);

-- 3. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS "IDX_PARKING_SNAPSHOTS_TIMESTAMP" ON parking_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS "IDX_PARKING_SNAPSHOTS_CAMERA_TIMESTAMP" ON parking_snapshots("cameraId", timestamp);

-- 4. Registrar la nueva migración como ya ejecutada
INSERT INTO migrations (timestamp, name) 
VALUES (1737980000000, 'CreateParkingSnapshotsTable1737980000000')
ON CONFLICT DO NOTHING;

-- Verificar que todo se creó correctamente
SELECT 'Migraciones registradas:' as mensaje;
SELECT * FROM migrations ORDER BY timestamp;

SELECT 'Tabla parking_snapshots creada exitosamente' as mensaje;
SELECT table_name FROM information_schema.tables WHERE table_name = 'parking_snapshots';
