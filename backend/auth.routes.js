// backend/auth.routes.js
import express from "express";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { db } from "./db.js";
import { NotificationService } from "./notification.service.js";
import { KPICollector } from "./services/kpiCollector.service.js";
import { EmailService } from './email.service.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ============ PASSPORT GOOGLE STRATEGY ============

passport.serializeUser((user, done) => {
  done(null, user.employee_id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query(`SELECT * FROM employees WHERE employee_id = ?`, [id]);
    done(null, rows[0] || null);
  } catch (error) {
    done(error, null);
  }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:5000/api/auth/google/callback',
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value;
      
      // Парсим имя из разных источников
      let firstName = '';
      let lastName = '';
      let fullName = '';
      
      // Пробуем получить из name
      if (profile.name) {
        firstName = profile.name.givenName || '';
        lastName = profile.name.familyName || '';
        fullName = profile.name.displayName || '';
      }
      
      // Если нет givenName/familyName, пробуем парсить из displayName
      if ((!firstName || !lastName) && profile.displayName) {
        const nameParts = profile.displayName.split(' ');
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else {
          firstName = profile.displayName;
          lastName = '';
        }
      }
      
      // Если всё ещё нет - используем email
      if (!firstName && email) {
        const emailLocalPart = email.split('@')[0];
        firstName = emailLocalPart;
        lastName = '';
      }
      
      const avatarUrl = profile.photos?.[0]?.value;
      
      console.log('📊 Google profile данные:', { 
        googleId, 
        email, 
        firstName, 
        lastName,
        fullName,
        rawName: profile.displayName 
      });
      
      if (!email) {
        return done(new Error('Email не получен от Google'), null);
      }
      
      // Ищем пользователя по google_id или email
      const [existing] = await db.query(
        `SELECT * FROM employees WHERE google_id = ? OR username = ?`,
        [googleId, email]
      );
      
      let employee;
      
      if (existing.length > 0) {
        // Пользователь существует
        employee = existing[0];
        console.log('📊 Найден существующий пользователь:', employee.employee_id);
        
        // Обновляем данные если нужно (имя, фамилия, google_id, аватар)
        let needsUpdate = false;
        
        if (!employee.google_id) {
          await db.query(
            `UPDATE employees SET google_id = ? WHERE employee_id = ?`,
            [googleId, employee.employee_id]
          );
          needsUpdate = true;
        }
        
        if (employee.first_name !== firstName && firstName) {
          await db.query(
            `UPDATE employees SET first_name = ? WHERE employee_id = ?`,
            [firstName, employee.employee_id]
          );
          needsUpdate = true;
        }
        
        if (employee.last_name !== lastName && lastName) {
          await db.query(
            `UPDATE employees SET last_name = ? WHERE employee_id = ?`,
            [lastName, employee.employee_id]
          );
          needsUpdate = true;
        }
        
        if (avatarUrl && employee.avatar_url !== avatarUrl) {
          await db.query(
            `UPDATE employees SET avatar_url = ? WHERE employee_id = ?`,
            [avatarUrl, employee.employee_id]
          );
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          // Перезагружаем данные пользователя
          const [updated] = await db.query(
            `SELECT * FROM employees WHERE employee_id = ?`,
            [employee.employee_id]
          );
          employee = updated[0];
          console.log('📊 Данные пользователя обновлены');
        }
      } else {
        // Создаем нового пользователя
        console.log('📊 Создаем нового пользователя...');
        
        // Находим группу по умолчанию
        const [defaultGroup] = await db.query(
          `SELECT group_id FROM work_groups WHERE is_default_for_tickets = 1 LIMIT 1`
        );
        const groupId = defaultGroup[0]?.group_id || 1;
        
        // Если нет имени, используем часть email
        const finalFirstName = firstName || (email ? email.split('@')[0] : 'User');
        const finalLastName = lastName || '';
        
        const [result] = await db.query(
          `INSERT INTO employees 
           (username, password_hash, last_name, first_name, group_id, role, status, hire_date, google_id, avatar_url, email_verified)
           VALUES (?, '', ?, ?, ?, 'Клиент', 'Активен', CURDATE(), ?, ?, 1)`,
          [email, finalLastName, finalFirstName, groupId, googleId, avatarUrl || null]
        );
        
        const [newEmployee] = await db.query(
          `SELECT * FROM employees WHERE employee_id = ?`,
          [result.insertId]
        );
        employee = newEmployee[0];
        console.log('📊 Создан новый пользователь:', employee.employee_id, employee.first_name, employee.last_name);
      }
      
      return done(null, employee);
    } catch (error) {
      console.error('❌ Google auth error:', error);
      return done(error, null);
    }
  }
));

// ============= НАСТРОЙКА MULTER ДЛЯ АВАТАРОК =============
const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
  console.log('Создана папка для аватарок:', avatarsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения'));
    }
  }
});

// ============= АВТОРИЗАЦИЯ =============
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt for:', username);
  
  if (!username || !password) {
    return res.status(400).json({ message: "Логин и пароль обязательны" });
  }
  
  try {
    const [rows] = await db.query(
      "SELECT employee_id, username, password_hash, first_name, last_name, role, group_id, avatar_url, email_verified FROM employees WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const user = rows[0];
    
    if (!user.password_hash) {
      console.log('No password_hash for user:', username);
      return res.status(401).json({ message: "Ошибка авторизации. Обратитесь к администратору." });
    }
    
    console.log('Comparing password for user:', username);
    
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password_hash);
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      return res.status(500).json({ message: "Ошибка проверки пароля" });
    }
    
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('Wrong password for user:', username);
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    console.log('Login successful:', username);
    
    res.json({
      employee_id: user.employee_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      group_id: user.group_id,
      avatar_url: user.avatar_url,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ============ GOOGLE OAUTH ============

// Начало аутентификации через Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback после аутентификации
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:3000/login' }),
  (req, res) => {
    const user = req.user;
    console.log('✅ Google auth успешен, пользователь:', user.employee_id);
    
    // Перенаправляем на страницу callback с данными пользователя
    const redirectUrl = `http://localhost:3000/auth/callback?employee_id=${user.employee_id}&username=${encodeURIComponent(user.username)}&first_name=${encodeURIComponent(user.first_name)}&last_name=${encodeURIComponent(user.last_name)}&role=${user.role}&avatar_url=${encodeURIComponent(user.avatar_url || '')}`;
    
    console.log('📊 Перенаправление на:', redirectUrl);
    res.redirect(redirectUrl);
  }
);

// Получить текущего пользователя из сессии
router.get('/session/user', (req, res) => {
  if (req.user) {
    res.json({
      employee_id: req.user.employee_id,
      username: req.user.username,
      first_name: req.user.first_name,
      last_name: req.user.last_name,
      role: req.user.role,
      avatar_url: req.user.avatar_url,
    });
  } else {
    res.status(401).json({ error: 'Не авторизован' });
  }
});

// Выход из сессии
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) console.error(err);
    res.redirect('http://localhost:3000/login');
  });
});

// ============= РЕГИСТРАЦИЯ =============
router.post("/register", async (req, res) => {
  const { username, password, first_name, last_name, middle_name, group_id } = req.body;

  if (!username || !password || !first_name || !last_name || !group_id) {
    return res.status(400).json({ error: "Все поля обязательны" });
  }

  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  if (!emailRegex.test(username)) {
    return res.status(400).json({ error: "Введите корректный email" });
  }

  try {
    const [existing] = await db.query(
      "SELECT employee_id FROM employees WHERE username = ?",
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Email уже зарегистрирован" });
    }

    const hash = await bcrypt.hash(password, 10);
    const verificationCode = EmailService.generateVerificationCode();
    const codeExpires = new Date();
    codeExpires.setMinutes(codeExpires.getMinutes() + 15);

    const [result] = await db.query(
      `INSERT INTO employees 
       (username, password_hash, last_name, first_name, middle_name, group_id, role, status, hire_date, email_verified, verification_code, verification_code_expires)
       VALUES (?, ?, ?, ?, ?, ?, 'Сотрудник', 'Активен', CURDATE(), 0, ?, ?)`,
      [username, hash, last_name, first_name, middle_name || null, group_id, verificationCode, codeExpires]
    );

    const emailSent = await EmailService.sendVerificationCode(username, verificationCode);

    if (!emailSent) {
      await db.query("DELETE FROM employees WHERE employee_id = ?", [result.insertId]);
      return res.status(500).json({ error: "Не удалось отправить код подтверждения. Проверьте правильность email." });
    }

    console.log(`✅ Зарегистрирован новый сотрудник: ${username}, код отправлен`);

    res.json({ 
      success: true, 
      message: "Код подтверждения отправлен на email",
      employee_id: result.insertId,
      requires_verification: true
    });
  } catch (error) {
    console.error("Ошибка регистрации:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Шаг 2: Подтверждение email по коду
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: "Email и код обязательны" });
  }

  try {
    const [user] = await db.query(
      `SELECT employee_id, verification_code, verification_code_expires, email_verified 
       FROM employees 
       WHERE username = ?`,
      [email]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    if (user[0].email_verified === 1) {
      return res.status(400).json({ error: "Email уже подтверждён" });
    }

    if (user[0].verification_code !== code) {
      return res.status(400).json({ error: "Неверный код подтверждения" });
    }

    const now = new Date();
    const expires = new Date(user[0].verification_code_expires);
    if (now > expires) {
      return res.status(400).json({ error: "Код подтверждения истёк. Запросите новый." });
    }

    await db.query(
      `UPDATE employees 
       SET email_verified = 1, 
           verification_code = NULL, 
           verification_code_expires = NULL 
       WHERE employee_id = ?`,
      [user[0].employee_id]
    );

    const [userData] = await db.query(
      `SELECT first_name, last_name FROM employees WHERE employee_id = ?`,
      [user[0].employee_id]
    );
    await EmailService.sendWelcomeEmail(email, userData[0].first_name, userData[0].last_name);

    const [employee] = await db.query(
      `SELECT employee_id, username, first_name, last_name, role, group_id, avatar_url 
       FROM employees 
       WHERE employee_id = ?`,
      [user[0].employee_id]
    );

    res.json({
      success: true,
      message: "Email подтверждён",
      user: employee[0]
    });
  } catch (error) {
    console.error("Ошибка подтверждения email:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Повторная отправка кода
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;

  try {
    const [user] = await db.query(
      `SELECT employee_id, email_verified FROM employees WHERE username = ?`,
      [email]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    if (user[0].email_verified === 1) {
      return res.status(400).json({ error: "Email уже подтверждён" });
    }

    const newCode = EmailService.generateVerificationCode();
    const codeExpires = new Date();
    codeExpires.setMinutes(codeExpires.getMinutes() + 15);

    await db.query(
      `UPDATE employees 
       SET verification_code = ?, 
           verification_code_expires = ? 
       WHERE employee_id = ?`,
      [newCode, codeExpires, user[0].employee_id]
    );

    const emailSent = await EmailService.sendVerificationCode(email, newCode);

    if (!emailSent) {
      return res.status(500).json({ error: "Не удалось отправить код" });
    }

    res.json({ success: true, message: "Новый код отправлен" });
  } catch (error) {
    console.error("Ошибка повторной отправки:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= ЗАГРУЗКА АВАТАРКИ =============
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  console.log('=== UPLOAD AVATAR ===');
  console.log('File:', req.file);
  console.log('Body:', req.body);
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({ error: 'ID сотрудника не указан' });
    }
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    console.log('Avatar URL:', avatarUrl);
    
    const [result] = await db.query(
      'UPDATE employees SET avatar_url = ? WHERE employee_id = ?',
      [avatarUrl, employee_id]
    );
    console.log('DB Update result:', result);
    
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= УДАЛЕНИЕ АВАТАРКИ =============
router.delete('/avatar', async (req, res) => {
  const { employee_id } = req.body;
  
  try {
    const [rows] = await db.query(
      'SELECT avatar_url FROM employees WHERE employee_id = ?',
      [employee_id]
    );
    
    if (rows[0]?.avatar_url) {
      const oldPath = path.join(process.cwd(), rows[0].avatar_url);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    await db.query(
      'UPDATE employees SET avatar_url = NULL WHERE employee_id = ?',
      [employee_id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= ПОЛУЧЕНИЕ ДАННЫХ =============

router.get('/daily-metrics/today', async (req, res) => {
    const { employee_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    
    if (!employee_id) {
        return res.status(400).json({ error: 'Не указан ID сотрудника' });
    }
    
    try {
        // 👇 СЧИТАЕМ РЕАЛЬНО ЗАКРЫТЫЕ ЗА СЕГОДНЯ (из тикетов)
        const [closedTickets] = await db.query(
            `SELECT 
                COUNT(*) as closed_count,
                SUM(CASE WHEN satisfaction_rating IS NOT NULL THEN 1 ELSE 0 END) as feedbacks_count,
                SUM(CASE WHEN satisfaction_rating >= 4 THEN 1 ELSE 0 END) as positive_feedbacks,
                AVG(satisfaction_rating) as avg_rating,
                SUM(CASE WHEN is_first_contact_resolved = 1 THEN 1 ELSE 0 END) as fcr_count,
                SUM(CASE WHEN first_response_time_minutes IS NOT NULL THEN 1 ELSE 0 END) as has_first_response
             FROM tickets 
             WHERE operator_id = ? 
               AND status IN ('closed', 'resolved')
               AND DATE(COALESCE(closed_at, resolved_at)) = ?`,
            [employee_id, today]
        );
        
        // 👇 Проверяем, есть ли запись в daily_metrics (для статуса проверки)
        const [dailyRecord] = await db.query(
            `SELECT verification_status, reviewer_comment, quality_score, checked_requests
             FROM daily_metrics 
             WHERE employee_id = ? AND report_date = ?`,
            [employee_id, today]
        );
        
        const result = {
            employee_id: employee_id,
            report_date: today,
            processed_requests: closedTickets[0]?.closed_count || 0,  // 👈 РЕАЛЬНОЕ ЧИСЛО
            work_minutes: 480,  // 8 часов по умолчанию, или можно считать из смены
            positive_feedbacks: closedTickets[0]?.positive_feedbacks || 0,
            total_feedbacks: closedTickets[0]?.feedbacks_count || 0,
            first_contact_resolved: closedTickets[0]?.fcr_count || 0,
            total_requests: closedTickets[0]?.closed_count || 0,
            quality_score: dailyRecord[0]?.quality_score || 
                (closedTickets[0]?.avg_rating ? (closedTickets[0].avg_rating * 20).toFixed(1) : 0),
            checked_requests: dailyRecord[0]?.checked_requests || 0,
            verification_status: dailyRecord[0]?.verification_status || 'Ожидание',
            reviewer_comment: dailyRecord[0]?.reviewer_comment || null
        };
        
        console.log('📊 /daily-metrics/today для', employee_id, ':', result.processed_requests, 'закрытых');
        
        res.json([result]);
        
    } catch (error) {
        console.error('Ошибка получения today метрик:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/daily-metrics/week', async (req, res) => {
    const { employee_id } = req.query;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    try {
        // 👇 СЧИТАЕМ ЗАКРЫТЫЕ ЗА КАЖДЫЙ ДЕНЬ НЕДЕЛИ
        const [stats] = await db.query(
            `SELECT 
                DATE(COALESCE(closed_at, resolved_at)) as report_date,
                COUNT(*) as processed_requests,
                SUM(CASE WHEN satisfaction_rating IS NOT NULL THEN 1 ELSE 0 END) as total_feedbacks,
                SUM(CASE WHEN satisfaction_rating >= 4 THEN 1 ELSE 0 END) as positive_feedbacks,
                SUM(CASE WHEN is_first_contact_resolved = 1 THEN 1 ELSE 0 END) as first_contact_resolved,
                AVG(satisfaction_rating) as avg_quality
             FROM tickets 
             WHERE operator_id = ? 
               AND status IN ('closed', 'resolved')
               AND COALESCE(closed_at, resolved_at) >= ?
             GROUP BY DATE(COALESCE(closed_at, resolved_at))
             ORDER BY report_date DESC`,
            [employee_id, weekAgo]
        );
        
        // Добавляем статусы проверки из daily_metrics
        const result = [];
        for (const day of stats) {
            const [dailyRecord] = await db.query(
                `SELECT verification_status, quality_score, checked_requests
                 FROM daily_metrics 
                 WHERE employee_id = ? AND report_date = ?`,
                [employee_id, day.report_date]
            );
            
            result.push({
                ...day,
                work_minutes: 480,  // 8 часов
                total_requests: day.processed_requests,
                quality_score: dailyRecord[0]?.quality_score || 
                    (day.avg_quality ? (day.avg_quality * 20).toFixed(1) : 0),
                checked_requests: dailyRecord[0]?.checked_requests || 0,
                verification_status: dailyRecord[0]?.verification_status || 'Ожидание'
            });
        }
        
        console.log('📊 /daily-metrics/week:', result.length, 'дней');
        res.json(result);
        
    } catch (error) {
        console.error('Ошибка получения недельных метрик:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get("/employee-info", async (req, res) => {
  const { employee_id } = req.query;
  try {
    const [rows] = await db.query(
      "SELECT employee_id, username, first_name, last_name, role, group_id, avatar_url FROM employees WHERE employee_id = ?",
      [employee_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Сотрудник не найден" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Ошибка при получении информации о сотруднике:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.get("/groups", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT wg.group_id, wg.group_name, d.department_name
       FROM work_groups wg 
       LEFT JOIN departments d ON wg.department_id = d.department_id
       ORDER BY d.department_name, wg.group_name`
    );
    res.json(rows);
  } catch (error) {
    console.error("Ошибка при получении групп:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.get("/profile", async (req, res) => {
  const { employee_id } = req.query;
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  try {
    const [rows] = await db.query(
      `SELECT 
        e.employee_id, e.username, e.last_name, e.first_name, e.middle_name,
        e.group_id, e.role, e.hire_date, e.status, e.avatar_url,
        wg.group_name, d.department_name
      FROM employees e
      LEFT JOIN work_groups wg ON e.group_id = wg.group_id
      LEFT JOIN departments d ON wg.department_id = d.department_id
      WHERE e.employee_id = ?`,
      [employee_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Сотрудник не найден" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Ошибка при получении профиля:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.get("/employee-stats", async (req, res) => {
  const { employee_id } = req.query;
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  try {
    const [stats] = await db.query(
      `SELECT 
        COUNT(DISTINCT report_date) as total_days,
        SUM(processed_requests) as total_requests,
        AVG(quality_score) as avg_quality,
        AVG(CASE WHEN total_feedbacks > 0 THEN (positive_feedbacks / total_feedbacks) * 100 ELSE 0 END) as avg_csat
      FROM daily_metrics 
      WHERE employee_id = ?`,
      [employee_id]
    );

    const [bestDay] = await db.query(
      `SELECT report_date, processed_requests, quality_score
       FROM daily_metrics 
       WHERE employee_id = ? 
       ORDER BY processed_requests DESC 
       LIMIT 1`,
      [employee_id]
    );

    res.json({
      total_days: stats[0]?.total_days || 0,
      total_requests: stats[0]?.total_requests || 0,
      avg_quality: stats[0]?.avg_quality ? Number(stats[0].avg_quality).toFixed(1) : 0,
      avg_csat: stats[0]?.avg_csat ? Number(stats[0].avg_csat).toFixed(1) : 0,
      best_day: bestDay[0] || null
    });
  } catch (error) {
    console.error("Ошибка при получении статистики:", error);
    res.json({ total_days: 0, total_requests: 0, avg_quality: 0, avg_csat: 0, best_day: null });
  }
});

// backend/auth.routes.js

router.get("/dashboard-stats", async (req, res) => {
  const { employee_id, period = 'all' } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }
  
  // Проверяем, что сотрудник не руководитель
  const [userRole] = await db.query(
    `SELECT role FROM employees WHERE employee_id = ?`,
    [employee_id]
  );
  
  // Если это руководитель — возвращаем пустые данные
  if (userRole[0]?.role !== 'Сотрудник') {
    return res.json({ 
      total_days: 0, 
      total_requests: 0, 
      avg_quality: 0, 
      avg_csat: 0, 
      avg_contacts_per_hour: 0, 
      avg_fcr: 0, 
      total_hours: 0, 
      avg_requests_per_day: 0 
    });
  }
  try {
    let dateCondition = '';
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (period === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      dateCondition = `AND report_date >= '${weekAgoStr}'`;
      console.log(`📊 Week period: from ${weekAgoStr} to ${todayStr}`);
    } else if (period === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      const monthAgoStr = monthAgo.toISOString().split('T')[0];
      dateCondition = `AND report_date >= '${monthAgoStr}'`;
      console.log(`📊 Month period: from ${monthAgoStr} to ${todayStr}`);
    } else {
      console.log(`📊 All time period: no date filter`);
    }
    
    const query = `
      SELECT 
        COUNT(DISTINCT report_date) as total_days,
        SUM(processed_requests) as total_requests,
        AVG(quality_score) as avg_quality,
        AVG(CASE WHEN total_feedbacks > 0 THEN (positive_feedbacks / total_feedbacks) * 100 ELSE 0 END) as avg_csat,
        AVG(CASE WHEN work_minutes > 0 THEN (processed_requests / (work_minutes / 60)) ELSE 0 END) as avg_contacts_per_hour,
        AVG(CASE WHEN total_requests > 0 THEN (first_contact_resolved / total_requests) * 100 ELSE 0 END) as avg_fcr,
        SUM(work_minutes) / 60 as total_hours,
        AVG(processed_requests) as avg_requests_per_day
      FROM daily_metrics 
      WHERE employee_id = ? 
        AND verification_status = 'Одобрено'
        ${dateCondition}
    `;
    
    console.log(`📊 SQL Query: ${query}`);
    console.log(`📊 Params: [${employee_id}]`);
    
    const [stats] = await db.query(query, [employee_id]);

    const result = stats[0] || {};
    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = parseFloat(result[key]) || 0;
      }
      if (result[key] === null) result[key] = 0;
    });

    console.log(`📊 Result for period ${period}:`, result);
    
    res.json(result);
  } catch (error) {
    console.error("Ошибка при получении статистики для дашборда:", error);
    res.json({ total_days: 0, total_requests: 0, avg_quality: 0, avg_csat: 0, avg_contacts_per_hour: 0, avg_fcr: 0, total_hours: 0, avg_requests_per_day: 0 });
  }
});

router.get("/recent-activity", async (req, res) => {
  const { employee_id, limit = 5 } = req.query;
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  try {
    const [activity] = await db.query(
      `SELECT report_date, processed_requests, quality_score, verification_status
       FROM daily_metrics 
       WHERE employee_id = ?
       ORDER BY report_date DESC
       LIMIT ?`,
      [employee_id, parseInt(limit)]
    );
    res.json(activity);
  } catch (error) {
    console.error("Ошибка при получении последней активности:", error);
    res.json([]);
  }
});

// ============= УВЕДОМЛЕНИЯ =============
router.get("/notifications", async (req, res) => {
  const { user_id, limit = 20 } = req.query;
  if (!user_id) {
    return res.status(400).json({ message: "Отсутствует user_id" });
  }

  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [user_id, parseInt(limit)]
    );
    res.json(rows);
  } catch (error) {
    console.error("Ошибка получения уведомлений:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.put("/notifications/:id/read", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`UPDATE notifications SET is_read = 1 WHERE notification_id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка обновления уведомления:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.put("/notifications/read-all", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ message: "Отсутствует user_id" });
  }

  try {
    await db.query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [user_id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка обновления уведомлений:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.get("/notifications/unread-count", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ message: "Отсутствует user_id" });
  }

  try {
    const count = await NotificationService.getUnreadCount(parseInt(user_id));
    res.json({ unreadCount: count });
  } catch (error) {
    console.error("Ошибка получения количества уведомлений:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ============= ПОЛУЧЕНИЕ ВСЕХ СОТРУДНИКОВ ДЛЯ ПРИГЛАШЕНИЙ =============
router.get("/employees/all", async (req, res) => {
  const { user_id, search } = req.query;
  
  console.log('📋 Запрос списка сотрудников, user_id:', user_id);
  
  try {
    let query = `
      SELECT 
        employee_id, 
        first_name, 
        last_name, 
        middle_name, 
        role, 
        avatar_url,
        group_id
      FROM employees 
      WHERE status = 'Активен'
    `;
    const params = [];
    
    if (user_id) {
      query += ` AND employee_id != ?`;
      params.push(user_id);
    }
    
    if (search) {
      query += ` AND (first_name LIKE ? OR last_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY last_name, first_name LIMIT 100`;
    
    const [rows] = await db.query(query, params);
    
    const employees = rows.map(emp => ({
      employee_id: emp.employee_id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      middle_name: emp.middle_name,
      role: emp.role,
      avatar_url: emp.avatar_url,
      group_id: emp.group_id,
      full_name: `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim(),
      display_name: `${emp.last_name} ${emp.first_name} (${emp.role === 'Руководитель группы' ? 'Рук. группы' : emp.role === 'Руководитель отдела' ? 'Рук. отдела' : 'Сотр.'})`
    }));
    
    console.log(`📋 Найдено сотрудников: ${employees.length}`);
    res.json(employees);
    
  } catch (error) {
    console.error("Ошибка получения сотрудников:", error);
    res.status(500).json({ error: "Ошибка сервера", details: error.message });
  }
});

// Регистрация клиента (только email/почта)
router.post("/client/register", async (req, res) => {
  const { username, password, first_name, last_name } = req.body;

  if (!username || !password || !first_name || !last_name) {
    return res.status(400).json({ error: "Все поля обязательны" });
  }

  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  if (!emailRegex.test(username)) {
    return res.status(400).json({ error: "Введите корректный email" });
  }

  try {
    const [existing] = await db.query(
      "SELECT employee_id FROM employees WHERE username = ?",
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Email уже зарегистрирован" });
    }

    const hash = await bcrypt.hash(password, 10);
    const verificationCode = EmailService.generateVerificationCode();
    const codeExpires = new Date();
    codeExpires.setMinutes(codeExpires.getMinutes() + 15);

    const [group] = await db.query("SELECT group_id FROM work_groups LIMIT 1");
    const groupId = group[0]?.group_id || 1;

    const [result] = await db.query(
      `INSERT INTO employees 
       (username, password_hash, last_name, first_name, group_id, role, status, hire_date, email_verified, verification_code, verification_code_expires)
       VALUES (?, ?, ?, ?, ?, 'Клиент', 'Активен', CURDATE(), 0, ?, ?)`,
      [username, hash, last_name, first_name, groupId, verificationCode, codeExpires]
    );

    const emailSent = await EmailService.sendVerificationCode(username, verificationCode);

    if (!emailSent) {
      await db.query("DELETE FROM employees WHERE employee_id = ?", [result.insertId]);
      return res.status(500).json({ error: "Не удалось отправить код подтверждения" });
    }

    console.log(`✅ Зарегистрирован новый клиент: ${username}`);

    res.json({ 
      success: true, 
      message: "Код подтверждения отправлен на email",
      requires_verification: true,
      email: username
    });
  } catch (error) {
    console.error("Ошибка регистрации клиента:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});
// backend/auth.routes.js

// Получение истории за неделю с исключением дней отпуска
router.get("/daily-metrics/week-without-vacation", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  try {
    // Получаем дни отпуска сотрудника за этот период
    const [vacations] = await db.query(
      `SELECT start_date, end_date FROM vacations 
       WHERE employee_id = ? 
         AND status = 'active'
         AND start_date <= ? 
         AND end_date >= ?`,
      [employee_id, today.toISOString().split('T')[0], weekAgo.toISOString().split('T')[0]]
    );
    
    // Создаём Set дат, которые в отпуске
    const vacationDates = new Set();
    for (const vac of vacations) {
      let current = new Date(vac.start_date);
      const end = new Date(vac.end_date);
      while (current <= end) {
        vacationDates.add(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }
    
    // Получаем все данные за неделю
    const [rows] = await db.query(
      `SELECT * FROM daily_metrics 
       WHERE employee_id = ? AND report_date BETWEEN ? AND ?
       ORDER BY report_date DESC`,
      [employee_id, weekAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]]
    );
    
    // Фильтруем дни отпуска
    const filteredRows = rows.filter(row => !vacationDates.has(row.report_date.toISOString().split('T')[0]));
    
    res.json(filteredRows);
  } catch (error) {
    console.error("Ошибка при получении данных:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});
export default router;