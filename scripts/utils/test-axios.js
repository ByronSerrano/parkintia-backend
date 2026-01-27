const axios = require('axios');

async function testConnection() {
    const url = 'http://localhost:5000/api/video/feed?cameraId=default';
    console.log(`Testing connection to: ${url}`);
    try {
        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: 5000 
        });
        console.log('Response status:', response.status);
        console.log('Headers:', response.headers);
        
        response.data.on('data', (chunk) => {
            console.log('Received chunk of size:', chunk.length);
            // Destroy stream after first chunk to end test
            response.data.destroy();
        });

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
        }
    }
}

testConnection();