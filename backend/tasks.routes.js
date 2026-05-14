// backend/tasks.routes.js
import express from 'express';
import { db } from './db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Настройка multer для файлов
const uploadDir = './uploads/tasks/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'task-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Middleware проверки прав
const isLeader = async (req, res, next) => {
  const user_id = req.headers['user-id'] || req.query.user_id || req.body.user_id;
  const [user] = await db.query('SELECT role FROM employees WHERE employee_id = ?', [user_id]);
  if (user[0]?.role === 'Руководитель группы' || user[0]?.role === 'Руководитель отдела' || user[0]?.role === 'Администратор') {
    req.user_id = user_id;
    next();
  } else {
    res.status(403).json({ error: 'Нет прав' });
  }
};

// ============ ЗАДАЧИ ============

// Получить задачи (для сотрудника или руководителя)
router.get('/tasks', async (req, res) => {
  const { user_id, assigned_to, status, priority, view_type = 'list' } = req.query;
  
  let query = `
    SELECT t.*, 
           CONCAT(e1.last_name, ' ', e1.first_name) as assigned_to_name,
           CONCAT(e2.last_name, ' ', e2.first_name) as assigned_by_name,
           (SELECT COUNT(*) FROM task_comments WHERE task_id = t.task_id) as comments_count,
           (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.task_id) as attachments_count
    FROM tasks t
    JOIN employees e1 ON t.assigned_to = e1.employee_id
    JOIN employees e2 ON t.assigned_by = e2.employee_id
    WHERE 1=1
  `;
  const params = [];
  
  if (assigned_to) {
    query += ' AND t.assigned_to = ?';
    params.push(assigned_to);
  }
  
  // 👇 ИСПРАВЛЯЕМ: обрабатываем status как массив query параметров
  if (status) {
    // Если status приходит как строка с несколькими значениями через запятую
    const statuses = Array.isArray(status) ? status : status.split(',');
    const placeholders = statuses.map(() => '?').join(',');
    query += ` AND t.status IN (${placeholders})`;
    params.push(...statuses);
  }
  
  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }
  
  // Руководитель видит задачи своей группы
  if (req.query.is_leader === 'true' && user_id) {
    const [group] = await db.query('SELECT group_id FROM employees WHERE employee_id = ?', [user_id]);
    if (group[0]?.group_id) {
      query += ' AND t.assigned_to IN (SELECT employee_id FROM employees WHERE group_id = ?)';
      params.push(group[0].group_id);
    }
  }
  
  query += ' ORDER BY FIELD(t.priority, "urgent", "high", "medium", "low"), t.due_date ASC';
  
  console.log('SQL Query:', query);
  console.log('Params:', params);
  
  const [rows] = await db.query(query, params);
  res.json(rows);
});

// Получить задачу по ID
router.get('/tasks/:id', async (req, res) => {
  const [task] = await db.query(`
    SELECT t.*, 
           CONCAT(e1.last_name, ' ', e1.first_name) as assigned_to_name,
           CONCAT(e2.last_name, ' ', e2.first_name) as assigned_by_name
    FROM tasks t
    JOIN employees e1 ON t.assigned_to = e1.employee_id
    JOIN employees e2 ON t.assigned_by = e2.employee_id
    WHERE t.task_id = ?
  `, [req.params.id]);
  
  if (task.length === 0) return res.status(404).json({ error: 'Задача не найдена' });
  
  // Комментарии
  const [comments] = await db.query(`
    SELECT c.*, CONCAT(e.last_name, ' ', e.first_name) as user_name, e.avatar_url
    FROM task_comments c
    JOIN employees e ON c.user_id = e.employee_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `, [req.params.id]);
  
  // Вложения
  const [attachments] = await db.query('SELECT * FROM task_attachments WHERE task_id = ?', [req.params.id]);
  
  res.json({ ...task[0], comments, attachments });
});

// Создать задачу
router.post('/tasks', isLeader, async (req, res) => {
  const { title, description, assigned_to, priority, due_date, start_date, estimated_hours, category, tags } = req.body;
  
  let formattedDueDate = null;
  if (due_date) {
    const dateObj = new Date(due_date);
    formattedDueDate = dateObj.toISOString().split('T')[0];
  }
  
  const [result] = await db.query(`
    INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date, start_date, estimated_hours, category, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [title, description, assigned_to, req.user_id, priority || 'medium', formattedDueDate, start_date, estimated_hours, category, JSON.stringify(tags || [])]);
  
  // Получаем имя создателя
  const [creator] = await db.query(
    'SELECT first_name, last_name FROM employees WHERE employee_id = ?',
    [req.user_id]
  );
  const creatorName = creator[0] ? `${creator[0].first_name} ${creator[0].last_name}` : 'Руководитель';
  
  // Создаем уведомление для исполнителя
  const dueDateText = formattedDueDate ? `\n📅 Срок: ${new Date(formattedDueDate).toLocaleDateString('ru-RU')}` : '';
  const notificationMessage = `${creatorName} назначил(а) вам задачу: "${title}"${dueDateText}`;
  
  // Импортируем NotificationService
  const { NotificationService } = await import('./notification.service.js');
  await NotificationService.createNotification(
    assigned_to,
    '📋 Новая задача',
    notificationMessage,
    'info',
    'task',
    result.insertId
  );
  
  res.json({ success: true, task_id: result.insertId });
});

// Обновить задачу
router.put('/tasks/:id', async (req, res) => {
  const { title, description, status, priority, due_date, actual_hours, category, tags } = req.body;
  // Валидация статуса
  const validStatuses = ['todo', 'in_progress', 'review', 'done'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус задачи' });
  }
  console.log('Updating task:', req.params.id, req.body);
  
  try {
    // Проверяем, существует ли задача
    const [taskExists] = await db.query('SELECT * FROM tasks WHERE task_id = ?', [req.params.id]);
    if (taskExists.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    // Преобразуем дату в правильный формат
    let formattedDueDate = null;
    if (due_date) {
      const dateObj = new Date(due_date);
      if (!isNaN(dateObj.getTime())) {
        formattedDueDate = dateObj.toISOString().split('T')[0];
      }
    }
    
    // Обновляем только переданные поля
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (formattedDueDate !== null) {
      updates.push('due_date = ?');
      values.push(formattedDueDate);
    }
    if (actual_hours !== undefined) {
      updates.push('actual_hours = ?');
      values.push(actual_hours);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(tags));
    }
    
    const completed_at = status === 'done' ? new Date() : null;
    updates.push('completed_at = ?');
    values.push(completed_at);
    
    values.push(req.params.id);
    
    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE task_id = ?`;
    console.log('SQL Query:', query);
    console.log('Values:', values);
    
    await db.query(query, values);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить задачу
router.delete('/tasks/:id', isLeader, async (req, res) => {
  await db.query('DELETE FROM tasks WHERE task_id = ?', [req.params.id]);
  res.json({ success: true });
});

// ============ КОММЕНТАРИИ ============

router.post('/tasks/:id/comments', async (req, res) => {
  const { comment, user_id } = req.body;
  await db.query('INSERT INTO task_comments (task_id, user_id, comment) VALUES (?, ?, ?)', 
    [req.params.id, user_id, comment]);
  res.json({ success: true });
});

// ============ ВЛОЖЕНИЯ ============

router.post('/tasks/:id/attachments', upload.single('file'), async (req, res) => {
  const { uploaded_by } = req.body;
  const fileUrl = `/uploads/tasks/${req.file.filename}`;
  await db.query('INSERT INTO task_attachments (task_id, file_name, file_url, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, req.file.originalname, fileUrl, req.file.size, uploaded_by]);
  res.json({ success: true, file_url: fileUrl });
});

// ============ СТАТИСТИКА ============

router.get('/tasks-stats/:user_id', async (req, res) => {
  try {
    console.log('=== DEBUG TASKS STATS ===');
    console.log('User ID:', req.params.user_id);
    
    // Получаем сегодняшнюю дату в формате YYYY-MM-DD
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    console.log('Today:', todayStr);
    
    // Прямой SQL запрос с подробным логированием
    const [stats] = await db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'review' THEN 1 END) as review,
        COUNT(CASE WHEN status = 'done' THEN 1 END) as done,
        COUNT(CASE WHEN due_date IS NOT NULL AND due_date < ? AND status != 'done' THEN 1 END) as overdue,
        COUNT(CASE WHEN priority = 'urgent' AND status != 'done' THEN 1 END) as urgent
      FROM tasks 
      WHERE assigned_to = ?
    `, [todayStr, req.params.user_id]);
    
    console.log('Stats result:', stats[0]);
    
    // Дополнительно выведем все задачи пользователя для проверки
    const [allTasks] = await db.query(`
      SELECT task_id, title, due_date, status, 
             CASE WHEN due_date IS NOT NULL AND due_date < ? THEN 'OVERDUE' ELSE 'NOT OVERDUE' END as overdue_check
      FROM tasks 
      WHERE assigned_to = ?
    `, [todayStr, req.params.user_id]);
    
    console.log('All tasks with overdue check:', allTasks);
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.json({ todo: 0, in_progress: 0, review: 0, done: 0, overdue: 0, urgent: 0 });
  }
});

export default router;