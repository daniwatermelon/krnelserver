const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

const upload = multer({ dest: 'uploads/' });

// Inicializa el cliente de Vision
const client = new ImageAnnotatorClient({
  keyFilename: './krnel2-777-99566df6bf72.json'
});

app.post('/extract-text', upload.single('imageFile'), async (req, res) => {
  try {
      const [result] = await client.textDetection(req.file.path);
      const detections = result.textAnnotations;
      res.status(200).send(detections);
  } catch (error) {
      console.error('Error processing the image:', error);
      res.status(500).send('Error processing the image');
  }
});

app.post('/check-image', upload.single('imageFile'), async (req, res) => {
  try {
      const [result] = await client.safeSearchDetection(req.file.path);
      const detections = result.safeSearchAnnotation;
      res.status(200).send(detections);
  } catch (error) {
      console.error('Error processing the image:', error);
      res.status(500).send('Error processing the image');
  }
});

async function sendMail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'krnelpwa@gmail.com',
        pass: 'jqpe xkkm qiph xygw',
      },
    });

    const mailOptions = {
      from: 'krnelpwa@gmail.com',
      to,
      subject,
      text: 'Aquí está el código para que recuperes tu contraseña: ' + text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

async function sendMailChangeData(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'krnelpwa@gmail.com',
        pass: 'jqpe xkkm qiph xygw',
      },
    });

     const mailOptions = {
      from: 'krnelpwa@gmail.com',
      to,
      subject,
      text,  // Usa directamente el texto que llega desde el frontend
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/*app.post('/send-email-data', async (req, res) => {              
  const { to, subject } = req.body;
  try {
    const result = await sendMail(to, subject, datachanged);
    res.status(200).send('Email sent: ' + result.response);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

*/ 

async function sendMailRegister(to,) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'krnelpwa@gmail.com',
        pass: 'jqpe xkkm qiph xygw',
      },
    });

    const mailOptions = {
      from: 'krnelpwa@gmail.com',
      to,
      subject: 'Se ha registrado una nueva cuenta en nuestra aplicación',
      text: '¡Bienvenido a la app!  esperamos que tengas una experiencia muy divertida en Krnel, la nueva forma de aprender y divertirse :)',
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

async function sendMailChange(to, subject,) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'krnelpwa@gmail.com',
        pass: 'jqpe xkkm qiph xygw',
      },
    });

    const mailOptions = {
      from: 'krnelpwa@gmail.com',
      to,
      subject,
      text: 'El correo de tu cuenta ha cambiado, se usará el nuevo correo. ',
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

function generateCode() {
  verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  codeExpires = Date.now() + 10 * 60 * 1000; // 10 minutos a partir de ahora
  console.log('Generated new code:', verificationCode);
  setTimeout(() => {
    generateCode();
  }, 10 * 60 * 1000); // Regenera el código cada 10 minutos
}

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/send-change-data', async (req, res) => {
  const { to, subject, text } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).send('Información incompleta para enviar el correo.');
  }
  try {
    const result = await sendMailChangeData(to, subject, text);
    res.status(200).send('Correo enviado: ' + result.response);
  } catch (error) {
    res.status(500).send('Error enviando el correo: ' + error.toString());
  }
});

app.post('/send-email', async (req, res) => {
  const { to, subject } = req.body;
  try {
    const result = await sendMail(to, subject, verificationCode);
    res.status(200).send('Email sent: ' + result.response);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.post('/send-email-register', async (req, res) => {
  const { to } = req.body;
  try {
    const result = await sendMailRegister(to);
    res.status(200).send('Email sent: ' + result.response);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.post('/send-change-email', async (req, res) => {
  const { to, subject } = req.body;
  try {
    const result = await sendMailChange(to, subject);
    res.status(200).send('Email sent: ' + result.response);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.post('/verify-code', (req, res) => {
  const { code } = req.body;
  if (Date.now() > codeExpires) {
    res.status(400).send('Code has expired');
  } else if (code === verificationCode) {
    res.status(200).send('Code verified successfully');
  } else {
    res.status(400).send('Invalid code');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  generateCode(); // Genera el código inicial cuando el servidor inicia
}); 
