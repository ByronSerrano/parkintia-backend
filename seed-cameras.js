const API_URL = 'http://localhost:3001';

async function seedCameras() {
  try {
    console.log('🚀 Iniciando creación de cámaras...');

    // 1. Obtener cámaras existentes
    let existingCameras = [];
    try {
        const getResponse = await fetch(`${API_URL}/camera`);
        if (getResponse.ok) {
            existingCameras = await getResponse.json();
        } else {
            console.warn('⚠️ No se pudieron obtener las cámaras existentes. Asumiendo vacío.');
        }
    } catch (e) {
        console.warn('⚠️ Error conectando para verificar cámaras. Asumiendo vacío.');
    }

    const cameras = [
      {
        name: 'Cámara 08 (Principal)',
        description: 'Entrada Principal - Zona A',
        videoFile: 'stream',
        streamUrl: 'cam-08',
        total_parking: 10,
        isActive: true
      },
      {
        name: 'Cámara 01 (Secundaria)',
        description: 'Parqueadero Lateral - Zona B',
        videoFile: 'stream',
        streamUrl: 'cam-01',
        total_parking: 8,
        isActive: true
      }
    ];

    for (const cam of cameras) {
      try {
        const existing = existingCameras.find(c => c.name === cam.name);

        if (existing) {
            console.log(`🔄 Actualizando "${cam.name}"...`);
            const updateResponse = await fetch(`${API_URL}/camera/${existing.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cam)
            });

            if (updateResponse.ok) {
                console.log(`✅ Cámara actualizada: ${cam.name}`);
            } else {
                console.error(`❌ Error actualizando "${cam.name}":`, updateResponse.status);
            }
        } else {
            console.log(`✨ Creando "${cam.name}"...`);
            const response = await fetch(`${API_URL}/camera`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cam)
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Cámara creada: ${data.name} (ID: ${data.id})`);
            } else if (response.status === 409) {
               console.log(`⚠️ La cámara "${cam.name}" ya existe (conflicto reportado por backend).`);
            } else {
               const text = await response.text();
               console.error(`❌ Error creando "${cam.name}":`, response.status, text);
            }
        }
      } catch (error) {
        console.error(`❌ Error de red procesando "${cam.name}":`, error.message);
      }
    }

    console.log('\n✨ Proceso finalizado.');
    console.log('Ve a http://localhost:3000/dashboard/cameras para verlas.');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

seedCameras();