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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
  
  // Проверяем наличие данных
  if (!username || !password) {
    console.log('Missing username or password');
    return res.status(400).json({ message: "Логин и пароль обязательны" });
  }
  
  try {
    const [rows] = await db.query(
      "SELECT employee_id, username, password_hash, first_name, last_name, role, group_id, avatar_url FROM employees WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      console.log('User not found:', username);
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const user = rows[0];
    
    // Проверяем наличие password_hash
    if (!user.password_hash) {
      console.log('No password_hash for user:', username);
      return res.status(401).json({ message: "Ошибка авторизации. Обратитесь к администратору." });
    }
    
    console.log('Comparing password for user:', username);
    console.log('Password hash exists:', !!user.password_hash);
    
    // Сравниваем пароль
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

router.post("/register", async (req, res) => {
  const { username, password, first_name, last_name, middle_name, group_id } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO employees 
       (username, password_hash, first_name, last_name, middle_name, group_id, role, status, hire_date)
       VALUES (?, ?, ?, ?, ?, ?, 'Сотрудник', 'Активен', CURDATE())`,
      [username, hash, first_name, last_name, middle_name || null, group_id]
    );

    res.json({ success: true, message: "Пользователь создан" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Имя пользователя уже существует" });
    }
    console.error("Ошибка регистрации:", error);
    res.status(500).json({ success: false, message: "Ошибка сервера" });
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

router.get("/daily-metrics/today", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const [rows] = await db.query(
      `SELECT * FROM daily_metrics 
       WHERE employee_id = ? AND DATE(report_date) = ?`,
      [employee_id, today]
    );
    res.json(rows);
  } catch (error) {
    console.error("Ошибка при получении данных за сегодня:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.get("/daily-metrics/week", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует айди сотрудника" });
  }

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  try {
    const [rows] = await db.query(
      `SELECT * FROM daily_metrics 
       WHERE employee_id = ? AND DATE(report_date) BETWEEN ? AND ?
       ORDER BY report_date DESC`,
      [employee_id, weekAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]]
    );
    res.json(rows);
  } catch (error) {
    console.error("Ошибка при получении данных за неделю:", error);
    res.status(500).json({ message: "Ошибка сервера" });
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

router.get("/dashboard-stats", async (req, res) => {
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
        AVG(CASE WHEN total_feedbacks > 0 THEN (positive_feedbacks / total_feedbacks) * 100 ELSE 0 END) as avg_csat,
        AVG(CASE WHEN work_minutes > 0 THEN (processed_requests / (work_minutes / 60)) ELSE 0 END) as avg_contacts_per_hour,
        AVG(CASE WHEN total_requests > 0 THEN (first_contact_resolved / total_requests) * 100 ELSE 0 END) as avg_fcr,
        SUM(work_minutes) / 60 as total_hours,
        AVG(processed_requests) as avg_requests_per_day
      FROM daily_metrics 
      WHERE employee_id = ?`,
      [employee_id]
    );

    const result = stats[0] || {};
    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = parseFloat(result[key]) || 0;
      }
    });

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

export default router;