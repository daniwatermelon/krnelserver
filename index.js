const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());


async function sendMail(to, subject, text) {
  try {

    const transporter = nodemailer.createTransport({
        
     service: 'gmail',
      auth: {
        user: 'krnelpwa@gmail.com',
        pass: 'jqpe xkkm qiph xygw ',
      },
    });

    const mailOptions = {
      from: 'krnelpwa@gmail.com',
      to,
      subject,
      text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent:', result);
    return result;


  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;
  try {
    const result = await sendMail(to, subject, text);
    res.status(200).send('Email sent: ' + result.response);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
