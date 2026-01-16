#!/bin/bash

echo "🎬 Inicializando Demo de Parking"
echo "================================"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="http://localhost:3001"

echo -e "${BLUE}📹 Verificando video de prueba...${NC}"
if [ ! -f "python-detection-service/parking1.mp4" ]; then
    echo -e "${RED}❌ No se encontró parking1.mp4${NC}"
    echo "Copiando desde presentacion..."
    cp ../presentacion/VisionComputerParking/parking1.mp4 python-detection-service/
    echo -e "${GREEN}✓ Video copiado${NC}"
else
    echo -e "${GREEN}✓ Video encontrado${NC}"
fi

echo ""
echo -e "${BLUE}🎥 Creando imagen de referencia...${NC}"
cd python-detection-service
if command -v ffmpeg &> /dev/null; then
    ffmpeg -i parking1.mp4 -ss 00:00:02 -frames:v 1 -q:v 2 reference.jpg -y 2>/dev/null
    echo -e "${GREEN}✓ Imagen de referencia creada: reference.jpg${NC}"
else
    echo -e "${RED}⚠ ffmpeg no instalado. Debes crear reference.jpg manualmente${NC}"
fi
cd ..

echo ""
echo -e "${BLUE}📊 Configuración del demo:${NC}"
echo "1. Accede a: http://localhost:3000/dashboard/cameras"
echo "2. Edita la cámara 'Parking Sur'"
echo "3. En 'Configuración de Video', ingresa:"
echo "   - Archivo de Video: parking1.mp4"
echo "4. Sube la imagen: python-detection-service/reference.jpg"
echo "5. Dibuja al menos 4-6 zonas de parqueo"
echo "6. Cambia a modo 'Vista en Vivo'"
echo ""
echo -e "${GREEN}✅ Preparación completada${NC}"
echo ""
echo "🔥 IMPORTANTE: La ruta del video debe ser exactamente: parking1.mp4"
