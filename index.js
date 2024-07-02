const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

let verificationCode = '';
let codeExpires = null;

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

function generateCode() {
  verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  codeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes from now
  console.log('Generated new code:', verificationCode);
  setTimeout(() => {
    generateCode();
  }, 10 * 60 * 1000); // Regenerate code after 10 minutes
}

app.get('/', (req, res) => {
  res.send('Hello World!');
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
  generateCode(); // Generate the initial code when the server starts
});
