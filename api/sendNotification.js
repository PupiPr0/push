const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.post('/api/sendNotification', async (req, res) => {
    const { title, body, token } = req.body;

    if (!title || !body || !token) {
        return res.status(400).json({ message: 'Missing title, body, or token' });
    }

    const fcmUrl = 'https://fcm.googleapis.com/v1/projects/dkont-9f30d/messages:send';
    const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT); // Получаем учетные данные из переменных окружения

    try {
        // Получаем токен доступа
        const tokenResponse = await axios.post(serviceAccount.token_uri, null, {
            params: {
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: await createJWT(serviceAccount),
            },
        });

        const accessToken = tokenResponse.data.access_token;

        // Отправляем уведомление
        const notificationPayload = {
            message: {
                token: token,
                notification: {
                    title: title,
                    body: body,
                },
            },
        };

        await axios.post(fcmUrl, notificationPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        return res.status(200).json({ message: 'Notification sent successfully!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error sending notification', error: error.message });
    }
});

// Функция для создания JWT
async function createJWT(serviceAccount) {
    const header = {
        alg: 'RS256',
        typ: 'JWT',
    };

    const claimSet = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: serviceAccount.token_uri,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 час
        iat: Math.floor(Date.now() / 1000),
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=+$/, '');
    const encodedClaimSet = Buffer.from(JSON.stringify(claimSet)).toString('base64').replace(/=+$/, '');

    const signature = await sign(`${encodedHeader}.${encodedClaimSet}`, serviceAccount.private_key);
    return `${encodedHeader}.${encodedClaimSet}.${signature}`;
}

// Функция для подписи JWT
async function sign(data, privateKey) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(privateKey, 'base64');
}

// Экспортируем обработчик для Vercel
module.exports = app;
