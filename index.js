const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const {SpeechClient} = require('@google-cloud/speech');
const { getDocs, collection, updateDoc, doc, getFirestore } = require('firebase-admin/firestore'); // Ajusta esto según tu configuración de Firebase
const nodemailer = require('nodemailer');
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./krnel-77479-96824f74ae0e.json');
const upload = multer({ dest: 'uploads/' });



const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); 
const cron = require('node-cron');

const calculateAverageRating = async (exerciseId) => {
  try {
    let totalStars = 0;
    let count = 0;

    // Accede a todos los documentos de usuarios
    const usersRef = db.collection('usuario');
    const usersSnapshot = await usersRef.get();

    for (const userDoc of usersSnapshot.docs) {
      const ratingsRef = userDoc.ref.collection('community'); // Subcolección 'ratings' del usuario
      const ratingsSnapshot = await ratingsRef.where('IDEjercicio', '==', exerciseId).get();

      // Si no hay valoraciones para este ejercicio en este usuario, sigue con el siguiente
      if (ratingsSnapshot.empty) continue;

      // Suma las estrellas de todas las valoraciones de este ejercicio
      ratingsSnapshot.forEach(doc => {
        const rating = doc.data().starsRated;
        
        // Verifica si el rating es un número antes de sumarlo
        if (typeof rating === 'number' && !isNaN(rating)) {
          totalStars += rating;
          count++;
        } else {
          console.warn(`Valor inválido para starsRated en el documento: ${doc.id}`);
        }
      });
    }

    if (count === 0) {
      return 0;
    }

    return totalStars / count;
  } catch (error) {
    console.error("Error al calcular el promedio de las estrellas", error);
    return 0;
  }
};
//Every day query
cron.schedule('* */1 * * *', async () => {
  console.log('Ejecutando cron job para verificar y actualizar estrellas...');

  try {
    const communityCollection = db.collection('ejercicioscomunidad');
    const snapshot = await communityCollection.get();

    if (!snapshot.empty) {
      const now = new Date();

      for (const docSnap of snapshot.docs) {
        const exerciseData = docSnap.data();

        if (exerciseData.stars === 0 && exerciseData.dateRate) {
          const dateRate = new Date(exerciseData.dateRate);
          const minutesDiff = (now - dateRate) / (1000 * 60); // Diferencia en minutos

          if (minutesDiff >= 10080) {
            // Calcula el promedio de estrellas para este ejercicio
            const averageRating = await calculateAverageRating(docSnap.id);

            // Actualiza las estrellas con el promedio calculado
            const docRef = communityCollection.doc(docSnap.id);
            await docRef.update({ stars: averageRating });

            console.log(`Ejercicio con ID ${docSnap.id} actualizado: stars = ${averageRating}`);
          }
        }
      }
    } else {
      console.log('No se encontraron documentos en la colección.');
    }
  } catch (error) {
    console.error('Error al verificar y actualizar los ejercicios:', error);
  }
});

cron.schedule('0 0 * * *', async () => {
  try {
    const usersCollection = collection(db, 'usuarios');
    const usersSnapshot = await getDocs(usersCollection);

    const todayDate = new Date().toISOString().split('T')[0];

    usersSnapshot.forEach(async (userDoc) => {
      const userId = userDoc.id;
      const remindDocRef = doc(db, `usuarios/${userId}/config/remindDoc`);
      const remindDocSnap = await getDoc(remindDocRef);

      if (remindDocSnap.exists()) {
        // Extraer los arreglos `dates` y `answers` del documento remindDoc
        let { dates, answers } = remindDocSnap.data();

        if (dates && dates.length > 0 && answers && answers.length === dates.length) {
          const lastDate = dates[dates.length - 1];

          if (todayDate === lastDate) {
            // Contar los valores `true` en el array `answers`
            const trueCount = answers.filter(answer => answer === true).length;

            // Obtener el correo electrónico del usuario desde su documento principal
            const emailDocRef = doc(db, `usuarios/${userId}`);
            const emailDocSnap = await getDoc(emailDocRef);

            if (emailDocSnap.exists()) {
              const { email } = emailDocSnap.data(); // Asegúrate de que el campo `email` esté presente

              // Enviar correo según el conteo de `true` en `answers`
              if (trueCount > 5) {
                await sendMailChangeData(email, "¡Lo has hecho muy bien esta semana!", "Felicidades por ser tan consistente en el idioma");
              } else {
                await sendMailChangeData(email, "No te rindas, ¡tú puedes!", "Nunca dejes de practicar");
              }

              console.log(`El usuario ${userId} tiene ${trueCount} respuestas 'true'.`);

              // Calcular las nuevas fechas para la semana siguiente
              const nextWeekDates = dates.map((_, i) => {
                const nextDate = new Date(new Date(lastDate).getTime() + (i + 1) * 24 * 60 * 60 * 1000);
                return nextDate.toISOString().split('T')[0];
              });

              // Reiniciar el array `answers` con `false`
              const resetAnswers = Array(answers.length).fill(false);

              // Actualizar Firestore con los nuevos valores de `dates` y `answers`
              await updateDoc(remindDocRef, {
                dates: nextWeekDates,
                answers: resetAnswers
              });

              console.log(`Fechas y respuestas actualizadas para el usuario ${userId}`);
            } else {
              console.log(`El documento principal para el usuario ${userId} no contiene el campo de correo electrónico.`);
            }
          } else {
            console.log(`Hoy no es el último día en el arreglo de fechas para el usuario ${userId}`);
          }
        } else {
          console.log(`El array 'dates' o 'answers' está vacío o mal formateado para el usuario ${userId}`);
        }
      } else {
        console.log(`El documento 'remindDoc' no existe para el usuario ${userId}`);
      }
    });
  } catch (error) {
    console.error("Error al consultar los documentos de los usuarios:", error);
  }
});

//NOTIFICACIONES
cron.schedule('* * * * *', async () => {
  console.log('Ejecutando cron job para verificar notificaciones programadas...');

  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const notificationsRef = db.collection('notifications');
    const snapshot = await notificationsRef.get();

    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const notificationData = doc.data();

        const [scheduledHour, scheduledMinute] = notificationData.hour.split(':').map(Number);

        if (scheduledHour === currentHour && scheduledMinute === currentMinute) {
          await sendMailChangeData(notificationData.email, notificationData.subject, notificationData.text);
          console.log(`Correo enviado a ${notificationData.email} para la notificación programada.`);

          await notificationsRef.doc(doc.id).delete();
          console.log(`Documento con ID ${doc.id} eliminado después de enviar la notificación.`);
        }
      }
    } else {
      console.log('No se encontraron notificaciones programadas en este momento.');
    }
  } catch (error) {
    console.error('Error al verificar y enviar notificaciones programadas:', error);
  }
});








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

//seccion de speech to text
const speech = require('@google-cloud/speech');
const fs = require('fs');

process.env.GOOGLE_APLICATION_CREDENTIALS = 'krnel2-777-99566df6bf72.json';

async function transcribeAudio(audiofile){
  try {
      const speechClient = new speech.SpeechClient();

      const file = fs.readFileSync(audiofile);
      
      const audioBytes = file.toString('base64');

      const audio =  {
        content: audioBytes
      };

      const config = {
        encoding: 'LINEAR16', 
        sampleRateHertz: 44100,
        languageCode:'en-US'
      }

      return new Promise((resolve,reject) => {
        speechClient.recognize({audio,config})
        .then(data=>{
          resolve(data);
        })
        .catch(error=>{
          reject(error);
        })
    })
  } catch (error) {
      console.error('ERROR', error);
  }
}

(async ()=>{
  const data = await transcribeAudio('misericordia.ogg');
  console.log(data[0].results.map(r=>r.alternatives[0].transcript).join('\n'));
})()
// fin de seccion de speesh to text