const API_URL = 'http://localhost:3001';

async function seedZones() {
  try {
    console.log('🚀 Iniciando creación de zonas de parqueo...');

    // 1. Obtener cámaras existentes
    const getResponse = await fetch(`${API_URL}/camera`);
    if (!getResponse.ok) {
        throw new Error('No se pudieron obtener las cámaras.');
    }
    const cameras = await getResponse.json();

    const zonesData = {
        'Cámara 08 (Principal)': [
            { name: 'Espacio 1', spaceNumber: 1, coordinates: [{x: 52, y: 364}, {x: 30, y: 417}, {x: 73, y: 412}, {x: 88, y: 369}] },
            { name: 'Espacio 2', spaceNumber: 2, coordinates: [{x: 105, y: 353}, {x: 86, y: 428}, {x: 137, y: 427}, {x: 146, y: 358}] }
        ],
        'Cámara 01 (Secundaria)': [
            { name: 'Espacio 1', spaceNumber: 1, coordinates: [{x: 52, y: 364}, {x: 30, y: 417}, {x: 73, y: 412}, {x: 88, y: 369}] },
            { name: 'Espacio 2', spaceNumber: 2, coordinates: [{x: 105, y: 353}, {x: 86, y: 428}, {x: 137, y: 427}, {x: 146, y: 358}] }
        ]
    };

    for (const camera of cameras) {
        const defaultZones = zonesData[camera.name];
        if (defaultZones) {
            console.log(`📦 Creando zonas para ${camera.name}...`);
            
            // Verificar si ya tiene zonas
            if (camera.parkingZones && camera.parkingZones.length > 0) {
                console.log(`⚠️ ${camera.name} ya tiene zonas. Saltando.`);
                continue;
            }

            const response = await fetch(`${API_URL}/camera/parking-zones/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cameraId: camera.id,
                    zones: defaultZones
                })
            });

            if (response.ok) {
                console.log(`✅ Zonas creadas para ${camera.name}`);
            } else {
                console.error(`❌ Error creando zonas para ${camera.name}:`, response.status);
            }
        }
    }

    console.log('\n✨ Proceso de zonas finalizado.');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

seedZones();
