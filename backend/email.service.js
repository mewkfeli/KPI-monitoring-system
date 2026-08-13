// backend/email.service.js
import nodemailer from 'nodemailer';

// Настройка транспорта для Яндекс Почты
const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true, // true для 465, false для других портов
  auth: {
    user: 'play-time-official@yandex.ru',
    pass: 'jsnhqmebuejvhsdz' // пароль приложения
  }
});

// Проверка подключения при старте
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Ошибка подключения к Яндекс Почте:', error);
  } else {
    console.log('✅ Подключение к Яндекс Почте установлено');
  }
});

export const EmailService = {
  // Генерация 6-значного кода
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Отправка кода подтверждения на email
  async sendVerificationCode(email, code) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">KPI Monitoring System</h1>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Здравствуйте!</p>
              <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Для завершения регистрации в системе мониторинга KPI введите следующий код подтверждения:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1890ff; background-color: #f0f7ff; padding: 15px 20px; border-radius: 8px; display: inline-block; font-family: monospace;">
                  ${code}
                </div>
              </div>
              <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Код действителен в течение <strong>15 минут</strong>.
              </p>
              <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Если вы не регистрировались в системе, просто проигнорируйте это письмо.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #999; text-align: center;">
                © 2024 KPI Monitoring System. Все права защищены.<br>
                Это автоматическое сообщение, отвечать на него не нужно.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Ваш код подтверждения: ${code}\nКод действителен 15 минут.\n\nЕсли вы не регистрировались в системе, просто проигнорируйте это письмо.`;

    try {
      const info = await transporter.sendMail({
        from: '"KPI Monitoring System" <play-time-official@yandex.ru>',
        to: email,
        subject: 'Подтверждение регистрации в KPI System',
        text,
        html
      });
      console.log(`✅ Email отправлен на ${email}:`, info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Ошибка отправки email:', error.message);
      return false;
    }
  },

  // Отправка приветственного письма после успешной регистрации
  async sendWelcomeEmail(email, firstName, lastName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Добро пожаловать!</h1>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Здравствуйте, <strong>${firstName} ${lastName}</strong>!
              </p>
              <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Вы успешно зарегистрировались в системе мониторинга KPI.
              </p>
              
              <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Чтобы начать работу, войдите в систему по ссылке ниже:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:5173/login" style="background-color: #1890ff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Войти в систему
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #999; text-align: center;">
                © 2024 KPI Monitoring System. Все права защищены.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: '"KPI Monitoring System" <play-time-official@yandex.ru>',
        to: email,
        subject: 'Добро пожаловать в KPI Monitoring System!',
        html
      });
      console.log(`✅ Приветственное письмо отправлено на ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Ошибка отправки приветственного письма:', error.message);
      return false;
    }
  },

  // Уведомление о новом ответе оператора
  async sendNewReplyNotification(email, ticketNumber, messagePreview, userName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #faad14 0%, #d48806 100%); padding: 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px;">💬 Новый ответ оператора</h1>
            </div>
            <div style="padding: 25px;">
              <p style="font-size: 14px; color: #333;">
                <strong>${userName}</strong> ответил(а) в вашем обращении <strong>#${ticketNumber}</strong>:
              </p>
              <div style="background-color: #f5f5f5; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 3px solid #faad14;">
                <p style="margin: 0; color: #333;">${messagePreview}</p>
              </div>
              <div style="text-align: center; margin: 25px 0;">
                <a href="http://localhost:5173/client" style="background-color: #1890ff; color: white; padding: 10px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Перейти к обращению
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 11px; color: #999; text-align: center;">
                Вы получили это письмо, так как зарегистрированы в системе KPI Monitoring System.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: '"KPI Monitoring System" <play-time-official@yandex.ru>',
        to: email,
        subject: `💬 Новый ответ в обращении #${ticketNumber}`,
        html
      });
      console.log(`✅ Уведомление о новом ответе отправлено на ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Ошибка отправки уведомления:', error.message);
      return false;
    }
  }
};

export default EmailService;