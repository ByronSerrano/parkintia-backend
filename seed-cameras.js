const API_URL = 'http://localhost:3001';

async function seedCameras() {
  try {
    console.log('🚀 Iniciando creación de cámaras...');

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
           console.log(`⚠️ La cámara "${cam.name}" ya existe.`);
        } else {
           const text = await response.text();
           console.error(`❌ Error creando "${cam.name}":`, response.status, text);
        }
      } catch (error) {
        console.error(`❌ Error de red creando "${cam.name}":`, error.message);
      }
    }

    console.log('\n✨ Proceso finalizado.');
    console.log('Ve a http://localhost:3000/dashboard/cameras para verlas.');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

seedCameras();