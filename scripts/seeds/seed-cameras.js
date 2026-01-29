const API_URL = 'http://127.0.0.1:3001';

async function seedCameras() {
  try {
    console.log('🚀 Iniciando creación de cámaras...');

    // 1. Obtener y BORRAR cámaras existentes
    let existingCameras = [];
    try {
        const getResponse = await fetch(`${API_URL}/cameras`);
        if (getResponse.ok) {
            existingCameras = await getResponse.json();
            
            // Borrar todas las cámaras existentes
            for (const existing of existingCameras) {
                console.log(`🗑️ Eliminando cámara existente: "${existing.name}" (ID: ${existing.id})...`);
                await fetch(`${API_URL}/cameras/${existing.id}`, { method: 'DELETE' });
            }
            // Limpiar lista local
            existingCameras = []; 
        } else {
            console.warn('⚠️ No se pudieron obtener las cámaras existentes. Asumiendo vacío.');
        }
    } catch (e) {
        console.warn('⚠️ Error conectando para verificar cámaras. Asumiendo vacío.');
    }

    const cameras = [
      {
        name: 'Cámara IP 01',
        description: 'Cámara de Entrada - 01',
        videoFile: 'cam-01',
        streamUrl: 'http://192.168.0.114/ISAPI/Streaming/channels/101/picture',
        total_parking: 0,
        isActive: true
      },
      {
        name: 'Cámara IP 08',
        description: 'Cámara de Salida - 08',
        videoFile: 'cam-08',
        streamUrl: 'http://192.168.0.114/ISAPI/Streaming/channels/801/picture',
        total_parking: 0,
        isActive: true
      }
    ];

    for (const cam of cameras) {
      try {
        const existing = existingCameras.find(c => c.name === cam.name);

        if (existing) {
            console.log(`🔄 Actualizando "${cam.name}"...`);
            const updateResponse = await fetch(`${API_URL}/cameras/${existing.id}`, {
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
            const response = await fetch(`${API_URL}/cameras`, {
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
        console.error(`❌ Error de red procesando "${cam.name}":`, error);
      }
    }

    console.log('\n✨ Proceso finalizado.');
    console.log('Ve a http://localhost:3000/dashboard/cameras para verlas.');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

seedCameras();