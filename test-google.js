require('dotenv').config();
const vision = require('@google-cloud/vision');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS não definido no .env');
  process.exit(1);
}

const client = new vision.ImageAnnotatorClient();

async function runTest() {
  try {
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8/5+hHgAGgwJ/lM3wWQAAAABJRU5ErkJggg==',
      'base64'
    );

    const [result] = await client.safeSearchDetection({ image: { content: buffer } });
    const annotation = result?.safeSearchAnnotation || {};

    console.log('Autenticação OK. Resposta recebida da Vision API.');
    console.log(JSON.stringify(annotation, null, 2));
  } catch (err) {
    console.error('Erro na Vision API:', err.message || err);
    process.exit(1);
  }
}

runTest();
