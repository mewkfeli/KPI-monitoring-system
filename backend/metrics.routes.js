// metrics.routes.js
import express from "express";
import { db } from "./db.js";

const router = express.Router();

// Все эндпоинты для метрик
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

    // Вставляем новую запись
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

// Получение данных за сегодня
router.get("/daily-metrics/today", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ message: "Отсутствует employee_id" });
  }

  // Используем точную дату в формате YYYY-MM-DD
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // "2025-12-19"

  console.log(`Поиск данных для employee_id: ${employee_id} на дату: ${todayStr}`);

  try {
    const [rows] = await db.query(
      `SELECT * FROM daily_metrics 
       WHERE employee_id = ? AND report_date = ?`,
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

// Получение истории за неделю
router.get("/daily-metrics/week", async (req, res) => {
  const { employee_id } = req.query;
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  try {
    const [rows] = await db.query(
      `SELECT * FROM daily_metrics WHERE employee_id = ? AND report_date BETWEEN ? AND ?`,
      [employee_id, weekAgo.toISOString().split("T")[0], today.toISOString().split("T")[0]]
    );

    res.json(rows);
  } catch (error) {
    console.error("Ошибка при получении данных за неделю:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

export default router;