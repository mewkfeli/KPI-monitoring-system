import express from "express";
import bcrypt from "bcrypt";
import { db } from "./db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const [rows] = await db.query(
    "SELECT * FROM employees WHERE username = ?",
    [username]
  );

  if (rows.length === 0) {
    return res.status(401).json({ message: "Неверный логин или пароль" });
  }

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    return res.status(401).json({ message: "Неверный логин или пароль" });
  }

  res.json({
    employee_id: user.employee_id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    group_id: user.group_id,
  });
});
router.post("/register", async (req, res) => {
  const { username, password, first_name, last_name, group_id } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await db.query(
    `INSERT INTO employees 
     (username, password_hash, first_name, last_name, group_id)
     VALUES (?, ?, ?, ?, ?)`,
    [username, hash, first_name, last_name, group_id]
  );

  res.json({ message: "Пользователь создан" });
});

// Добавление данных за день
router.post("/daily-metrics", async (req, res) => {
  const {
    employee_id,
    report_date,
    processed_requests,
    work_minutes,
    positive_feedbacks,
    total_feedbacks,
    first_contact_resolved,
    total_requests,
    quality_score,
    checked_requests,
  } = req.body;

  try {
    // Проверяем, есть ли уже запись на эту дату для этого сотрудника
    const [existing] = await db.query(
      `SELECT * FROM daily_metrics 
       WHERE employee_id = ? AND report_date = ?`,
      [employee_id, report_date]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        message: "Данные за эту дату уже введены" 
      });
    }

    // Вставляем новую запись с default значениями для новых полей
    await db.query(
      `INSERT INTO daily_metrics (
        employee_id, report_date, processed_requests, work_minutes, 
        positive_feedbacks, total_feedbacks, first_contact_resolved, 
        total_requests, quality_score, checked_requests,
        verification_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ожидание', NOW(), NOW())`,
      [
        employee_id,
        report_date,
        processed_requests || 0,
        work_minutes || 0,
        positive_feedbacks || 0,
        total_feedbacks || 0,
        first_contact_resolved || 0,
        total_requests || 0,
        quality_score || 0,
        checked_requests || 0,
      ]
    );

    res.status(201).json({ message: "Данные успешно добавлены" });
  } catch (error) {
    console.error("Ошибка при добавлении данных:", error);
    res.status(500).json({ 
      message: "Ошибка сервера", 
      error: error.message 
    });
  }
});

router.get("/daily-metrics/today", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  // Используем локальную дату, а не UTC
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = today.toISOString().split('T')[0]; // "2025-12-20"

  console.log(`Поиск данных для employee_id: ${employee_id} на дату: ${todayStr}`);
  console.log(`Текущее время сервера: ${now}`);
  console.log(`Локальная дата: ${todayStr}`);

  try {
    // Используем DATE() для сравнения только дат
    const [rows] = await db.query(
      `SELECT * FROM daily_metrics 
       WHERE employee_id = ? AND DATE(report_date) = ?`,
      [employee_id, todayStr]
    );

    console.log(`Найдено записей: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error("Ошибка при получении данных за сегодня:", error);
    res.status(500).json({ 
      message: "Ошибка сервера",
      error: error.message 
    });
  }
});
// Получение информации о сотруднике
router.get("/employee-info", async (req, res) => {
  const { employee_id } = req.query;

  try {
    const [rows] = await db.query(
      "SELECT employee_id, username, first_name, last_name, role, group_id FROM employees WHERE employee_id = ?",
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

router.get("/daily-metrics/week", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  // Форматируем даты как строки YYYY-MM-DD
  const todayStr = today.toISOString().split('T')[0];
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  console.log(`Поиск данных за неделю: с ${weekAgoStr} по ${todayStr}`);

  try {
    const [rows] = await db.query(
      `SELECT * FROM daily_metrics 
       WHERE employee_id = ? 
       AND DATE(report_date) BETWEEN ? AND ?
       ORDER BY report_date DESC`,
      [employee_id, weekAgoStr, todayStr]
    );

    console.log(`Найдено записей за неделю: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error("Ошибка при получении данных за неделю:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Получение списка групп для регистрации
router.get("/groups", async (req, res) => {
  try {
    console.log("Запрос списка групп из work_groups с departments...");
    
    const [rows] = await db.query(
      `SELECT 
        wg.group_id, 
        wg.group_name,
        d.department_id,
        d.department_name
      FROM work_groups wg 
      LEFT JOIN departments d ON wg.department_id = d.department_id
      ORDER BY d.department_name, wg.group_name`
    );
    
    console.log(`Найдено групп: ${rows.length}`);
    
    if (rows.length === 0) {
      console.log("Таблица work_groups пустая или нет связи с departments");
      
      // Попробуем получить просто группы без join
      const [simpleGroups] = await db.query(
        `SELECT group_id, group_name, department_id FROM work_groups ORDER BY group_name`
      );
      
      if (simpleGroups.length === 0) {
        console.log("Таблица work_groups пустая");
        
        // Добавим тестовую запись
        await db.query(
          `INSERT INTO work_groups (group_name, department_id) VALUES ('Основная группа', 1)`
        );
        
        const [newGroups] = await db.query(
          `SELECT 
            wg.group_id, 
            wg.group_name,
            d.department_name
          FROM work_groups wg 
          LEFT JOIN departments d ON wg.department_id = d.department_id`
        );
        
        return res.json(newGroups);
      }
  
    }
    
    res.json(rows);
    
  } catch (error) {
    console.error("Ошибка при получении групп:", error.message);
    console.error("SQL ошибка:", error.sqlMessage);
    
    try {
      // Проверим отдельно таблицы
      const [workGroupsCount] = await db.query("SELECT COUNT(*) as count FROM work_groups");
      const [departmentsCount] = await db.query("SELECT COUNT(*) as count FROM departments");
      
      console.log(`work_groups записей: ${workGroupsCount[0].count}`);
      console.log(`departments записей: ${departmentsCount[0].count}`);
      
      // Покажем структуру таблиц
      const [wgStructure] = await db.query("DESCRIBE work_groups");
      const [deptStructure] = await db.query("DESCRIBE departments");
      
      console.log("Структура work_groups:", wgStructure);
      console.log("Структура departments:", deptStructure);
      
    } catch (diagError) {
      console.error("Ошибка диагностики:", diagError);
    }
    
    // Возвращаем тестовые данные
    const testGroups = [
      { group_id: 1, group_name: "Техническая поддержка", department_name: "IT отдел" },
      { group_id: 2, group_name: "Продажи", department_name: "Коммерческий отдел" },
      { group_id: 3, group_name: "Клиентский сервис", department_name: "Сервисный центр" },
    ];
    
    res.json(testGroups);
  }
});

// Получение расширенной информации о профиле сотрудника
router.get("/profile", async (req, res) => {
  const { employee_id } = req.query;

  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  try {
    const [rows] = await db.query(
      `SELECT 
        e.employee_id,
        e.username,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.group_id,
        e.role,
        e.hire_date,
        e.status,
        wg.group_name,
        d.department_name
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

// Получение статистики сотрудника
router.get("/employee-stats", async (req, res) => {
  const { employee_id } = req.query;

  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  try {
    // Статистика из daily_metrics
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

    // Лучший день по производительности
    const [bestDay] = await db.query(
      `SELECT 
        report_date,
        processed_requests,
        quality_score
      FROM daily_metrics 
      WHERE employee_id = ? 
      ORDER BY processed_requests DESC 
      LIMIT 1`,
      [employee_id]
    );

    const result = {
      total_days: stats[0]?.total_days || 0,
      total_requests: stats[0]?.total_requests || 0,
      avg_quality: stats[0]?.avg_quality ? Number(stats[0].avg_quality).toFixed(1) : 0,
      avg_csat: stats[0]?.avg_csat ? Number(stats[0].avg_csat).toFixed(1) : 0,
      best_day: bestDay[0] || null
    };

    res.json(result);
  } catch (error) {
    console.error("Ошибка при получении статистики:", error);
    
    res.json({
      total_days: 0,
      total_requests: 0,
      avg_quality: 0,
      avg_csat: 0,
      best_day: null
    });
  }
});

// Статистика для дашборда
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

    const result = stats[0] || {
      total_days: 0,
      total_requests: 0,
      avg_quality: 0,
      avg_csat: 0,
      avg_contacts_per_hour: 0,
      avg_fcr: 0,
      total_hours: 0,
      avg_requests_per_day: 0
    };

    // Преобразуем строки в числа
    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = parseFloat(result[key]) || 0;
      }
    });

    console.log("Dashboard stats for employee", employee_id, ":", result);
    res.json(result);
    
  } catch (error) {
    console.error("Ошибка при получении статистики для дашборда:", error);
    
    // Возвращаем базовые данные при ошибке
    res.json({
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
});

// Последняя активность
router.get("/recent-activity", async (req, res) => {
  const { employee_id, limit = 5 } = req.query;

  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  try {
    const [activity] = await db.query(
      `SELECT 
        report_date,
        processed_requests,
        quality_score,
        verification_status
      FROM daily_metrics 
      WHERE employee_id = ?
      ORDER BY report_date DESC
      LIMIT ?`,
      [employee_id, parseInt(limit)]
    );

    console.log("Recent activity for employee", employee_id, ":", activity.length, "records");
    res.json(activity);
    
  } catch (error) {
    console.error("Ошибка при получении последней активности:", error);
    res.json([]);
  }
});
export default router;
