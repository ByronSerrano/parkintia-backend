// Script para crear cámara de demostración
const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function createDemoCamera() {
  try {
    console.log('📹 Creando cámara de demostración...');
    
    const response = await axios.post(`${API_URL}/camera`, {
      name: 'Parking Sur',
      description: 'Zona C - Sur - Demo con parking1.mp4',
      videoFile: 'parking1.mp4',
      streamUrl: '',
      total_parking: 10,
      isActive: true
    });

    console.log('✅ Cámara creada exitosamente:');
    console.log('   ID:', response.data.id);
    console.log('   Nombre:', response.data.name);
    console.log('   Video:', response.data.videoFile);
    console.log('');
    console.log('📌 Próximos pasos:');
    console.log('1. Ve a http://localhost:3000/dashboard/cameras');
    console.log('2. Selecciona la cámara "Parking Sur"');
    console.log('3. Sube la imagen: python-detection-service/reference.jpg');
    console.log('4. Dibuja las zonas de parqueo');
    console.log('5. Cambia a "Vista en Vivo"');
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('❌ Error: Autenticación requerida');
      console.log('');
      console.log('Solución: Desactiva temporalmente el AuthGuard en camera.controller.ts');
      console.log('O crea la cámara desde la interfaz web: http://localhost:3000/dashboard/cameras');
    } else {
      console.error('❌ Error:', error.response?.data || error.message);
    }
  }
}

createDemoCamera();
