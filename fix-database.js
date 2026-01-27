/**
 * Script para solucionar el problema de migraciones y crear la tabla parking_snapshots
 */

const { Client } = require('pg');
require('dotenv').config();

async function fixDatabase() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('📡 Conectando a la base de datos...');
        await client.connect();
        console.log('✅ Conectado exitosamente');

        // 1. Registrar la primera migración
        console.log('\n1️⃣ Registrando migración CreateCameraAndParkingZoneTables...');
        await client.query(`
            INSERT INTO migrations (timestamp, name) 
            VALUES (1705385000000, 'CreateCameraAndParkingZoneTables1705385000000')
            ON CONFLICT DO NOTHING
        `);
        console.log('✅ Migración registrada');

        // 2. Crear tabla parking_snapshots
        console.log('\n2️⃣ Creando tabla parking_snapshots...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS parking_snapshots (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "cameraId" uuid,
                "totalSpaces" integer NOT NULL,
                "occupiedSpaces" integer NOT NULL,
                "freeSpaces" integer NOT NULL,
                "occupancyRate" decimal(5,2) NOT NULL,
                timestamp timestamp DEFAULT now() NOT NULL,
                metadata jsonb
            )
        `);
        console.log('✅ Tabla parking_snapshots creada');

        // 3. Crear foreign key
        console.log('\n3️⃣ Creando foreign key...');
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'fk_parking_snapshots_camera'
                ) THEN
                    ALTER TABLE parking_snapshots 
                    ADD CONSTRAINT fk_parking_snapshots_camera 
                    FOREIGN KEY ("cameraId") 
                    REFERENCES cameras(id) 
                    ON DELETE SET NULL;
                END IF;
            END $$;
        `);
        console.log('✅ Foreign key creada');

        // 4. Crear índices
        console.log('\n4️⃣ Creando índices...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS "IDX_PARKING_SNAPSHOTS_TIMESTAMP" 
            ON parking_snapshots(timestamp)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS "IDX_PARKING_SNAPSHOTS_CAMERA_TIMESTAMP" 
            ON parking_snapshots("cameraId", timestamp)
        `);
        console.log('✅ Índices creados');

        // 5. Registrar la nueva migración
        console.log('\n5️⃣ Registrando migración CreateParkingSnapshotsTable...');
        await client.query(`
            INSERT INTO migrations (timestamp, name) 
            VALUES (1737980000000, 'CreateParkingSnapshotsTable1737980000000')
            ON CONFLICT DO NOTHING
        `);
        console.log('✅ Migración registrada');

        // Verificar
        console.log('\n📊 Verificando migraciones registradas...');
        const result = await client.query('SELECT * FROM migrations ORDER BY timestamp');
        console.table(result.rows);

        console.log('\n✅ ¡Base de datos configurada exitosamente!');
        console.log('🎉 La tabla parking_snapshots está lista para usar\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

fixDatabase();
