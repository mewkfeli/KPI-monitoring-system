// backend/chat.routes.js
import express from "express";
import { db } from "./db.js";

const router = express.Router();

// Получить группу пользователя
router.get("/my-group", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ error: "Не указан ID сотрудника" });
  }

  try {
    const [rows] = await db.query(
      `SELECT e.group_id, wg.group_name 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       WHERE e.employee_id = ? AND e.status = 'Активен'`,
      [employee_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Сотрудник не найден" });
    }

    const [members] = await db.query(
      `SELECT employee_id, last_name, first_name, role, status 
       FROM employees 
       WHERE group_id = ? AND status = 'Активен'
       ORDER BY role, last_name`,
      [rows[0].group_id]
    );

    res.json({
      group_id: rows[0].group_id,
      group_name: rows[0].group_name,
      members,
    });
  } catch (error) {
    console.error("Ошибка получения группы:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получить историю сообщений
router.get("/history", async (req, res) => {
  const { group_id, limit = 100 } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: "Не указан ID группы" });
  }

  try {
    const [rows] = await db.query(
      `SELECT 
         cm.message_id,
         cm.group_id,
         cm.sender_id,
         cm.message,
         cm.created_at,
         e.last_name,
         e.first_name,
         e.middle_name,
         e.role
       FROM chat_messages cm
       JOIN employees e ON cm.sender_id = e.employee_id
       WHERE cm.group_id = ?
       ORDER BY cm.created_at ASC
       LIMIT ?`,
      [group_id, parseInt(limit)]
    );
    
    const messages = rows.map(row => ({
      message_id: row.message_id,
      sender_id: row.sender_id,
      sender_name: `${row.first_name} ${row.last_name}`,
      sender_role: row.role,
      message: row.message,
      created_at: row.created_at,
      status: 'sent', // Добавляем статус "отправлено" для старых сообщений
      read_count: 0,
    }));
    
    res.json(messages);
  } catch (error) {
    console.error("Ошибка получения истории:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Непрочитанные сообщения
router.get("/unread", async (req, res) => {
  const { user_id, group_id } = req.query;

  if (!user_id || !group_id) {
    return res.status(400).json({ error: "Не указаны обязательные параметры" });
  }

  try {
    const [result] = await db.query(
      `SELECT COUNT(*) as unread_count
       FROM chat_messages cm
       LEFT JOIN chat_read_receipts crr ON cm.message_id = crr.message_id AND crr.user_id = ?
       WHERE cm.group_id = ? 
         AND cm.sender_id != ?
         AND crr.receipt_id IS NULL`,
      [user_id, group_id, user_id]
    );
    
    res.json({ unread_count: result[0].unread_count });
  } catch (error) {
    console.error("Ошибка подсчета непрочитанных:", error);
    res.json({ unread_count: 0 });
  }
});

export default router;