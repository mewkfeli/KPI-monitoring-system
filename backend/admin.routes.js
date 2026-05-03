// backend/admin.routes.js
import express from 'express';
import bcrypt from 'bcrypt';
import { db } from './db.js';

const router = express.Router();

// Middleware для проверки прав администратора
const isAdmin = async (req, res, next) => {
  const admin_id = req.headers['x-admin-id'] || req.query.admin_id || req.body.admin_id;
  
  if (!admin_id) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  
  try {
    const [rows] = await db.query(
      'SELECT role FROM employees WHERE employee_id = ? AND status = "Активен"',
      [admin_id]
    );
    
    if (rows.length === 0 || rows[0].role !== 'Администратор') {
      return res.status(403).json({ error: 'Нет прав доступа' });
    }
    
    req.admin_id = parseInt(admin_id);
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Ошибка проверки прав' });
  }
};

// ============ УПРАВЛЕНИЕ СОТРУДНИКАМИ ============

// Получить всех сотрудников с фильтрацией
router.get('/employees', isAdmin, async (req, res) => {
  const { group_id, role, status, search, department_id } = req.query;
  
  let query = `
    SELECT 
      e.employee_id, e.username, e.last_name, e.first_name, e.middle_name,
      e.role, e.status, e.hire_date, e.avatar_url, e.group_id,
      wg.group_name, d.department_id, d.department_name, ad.direction_name
    FROM employees e
    LEFT JOIN work_groups wg ON e.group_id = wg.group_id
    LEFT JOIN departments d ON wg.department_id = d.department_id
    LEFT JOIN activity_directions ad ON d.direction_id = ad.direction_id
    WHERE 1=1
  `;
  const params = [];
  
  if (group_id) {
    query += ' AND e.group_id = ?';
    params.push(group_id);
  }
  if (department_id) {
    query += ' AND d.department_id = ?';
    params.push(department_id);
  }
  if (role) {
    query += ' AND e.role = ?';
    params.push(role);
  }
  if (status) {
    query += ' AND e.status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (e.last_name LIKE ? OR e.first_name LIKE ? OR e.username LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY e.last_name, e.first_name';
  
  const [rows] = await db.query(query, params);
  res.json(rows);
});

// Получить одного сотрудника
router.get('/employees/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  
  const [rows] = await db.query(
    `SELECT e.*, wg.group_name, d.department_name 
     FROM employees e
     LEFT JOIN work_groups wg ON e.group_id = wg.group_id
     LEFT JOIN departments d ON wg.department_id = d.department_id
     WHERE e.employee_id = ?`,
    [id]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Сотрудник не найден' });
  }
  
  res.json(rows[0]);
});

// Изменить роль сотрудника
router.put('/employees/:id/role', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, admin_id } = req.body;
  
  const validRoles = ['Сотрудник', 'Руководитель группы', 'Руководитель отдела'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Некорректная роль' });
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // Получаем старую роль
    const [oldData] = await connection.query(
      'SELECT role FROM employees WHERE employee_id = ?',
      [id]
    );
    
    if (oldData.length === 0) {
      throw new Error('Сотрудник не найден');
    }
    
    // Обновляем роль
    await connection.query(
      'UPDATE employees SET role = ? WHERE employee_id = ?',
      [role, id]
    );
    
    // Логируем действие
    await connection.query(
      `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, old_value, new_value)
       VALUES (?, 'change_role', 'employee', ?, ?, ?)`,
      [admin_id || req.admin_id, id, oldData[0].role, role]
    );
    
    await connection.commit();
    res.json({ success: true, message: 'Роль изменена' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Перевести сотрудника в другую группу
router.put('/employees/:id/group', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { group_id, admin_id } = req.body;
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const [oldData] = await connection.query(
      'SELECT group_id FROM employees WHERE employee_id = ?',
      [id]
    );
    
    await connection.query(
      'UPDATE employees SET group_id = ? WHERE employee_id = ?',
      [group_id, id]
    );
    
    await connection.query(
      `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, old_value, new_value)
       VALUES (?, 'change_group', 'employee', ?, ?, ?)`,
      [admin_id || req.admin_id, id, oldData[0]?.group_id || 'NULL', group_id]
    );
    
    await connection.commit();
    res.json({ success: true, message: 'Группа изменена' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Сброс пароля
router.post('/employees/:id/reset-password', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.body;
  
  const newPassword = Math.random().toString(36).slice(-8);
  const hash = await bcrypt.hash(newPassword, 10);
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    await connection.query(
      'UPDATE employees SET password_hash = ? WHERE employee_id = ?',
      [hash, id]
    );
    
    await connection.query(
      `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, new_value)
       VALUES (?, 'reset_password', 'employee', ?, ?)`,
      [admin_id || req.admin_id, id, newPassword]
    );
    
    await connection.commit();
    res.json({ success: true, new_password: newPassword });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Обновить статус сотрудника (активен/уволен)
router.put('/employees/:id/status', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, admin_id } = req.body;
  
  const validStatuses = ['Активен', 'Уволен', 'В отпуске'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const [oldData] = await connection.query(
      'SELECT status FROM employees WHERE employee_id = ?',
      [id]
    );
    
    await connection.query(
      'UPDATE employees SET status = ? WHERE employee_id = ?',
      [status, id]
    );
    
    await connection.query(
      `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, old_value, new_value)
       VALUES (?, 'change_status', 'employee', ?, ?, ?)`,
      [admin_id || req.admin_id, id, oldData[0].status, status]
    );
    
    await connection.commit();
    res.json({ success: true, message: 'Статус изменен' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Редактировать профиль сотрудника
router.put('/employees/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { last_name, first_name, middle_name, username, admin_id } = req.body;
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const [oldData] = await connection.query(
      'SELECT last_name, first_name, middle_name, username FROM employees WHERE employee_id = ?',
      [id]
    );
    
    await connection.query(
      `UPDATE employees 
       SET last_name = ?, first_name = ?, middle_name = ?, username = ?
       WHERE employee_id = ?`,
      [last_name, first_name, middle_name || null, username, id]
    );
    
    await connection.query(
      `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, old_value, new_value)
       VALUES (?, 'edit_profile', 'employee', ?, ?, ?)`,
      [admin_id || req.admin_id, id, JSON.stringify(oldData[0]), JSON.stringify({ last_name, first_name, middle_name, username })]
    );
    
    await connection.commit();
    res.json({ success: true, message: 'Профиль обновлен' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ============ УПРАВЛЕНИЕ ГРУППАМИ ============

// Получить все группы
router.get('/groups', isAdmin, async (req, res) => {
  const [rows] = await db.query(
    `SELECT wg.*, d.department_name, ad.direction_name
     FROM work_groups wg
     LEFT JOIN departments d ON wg.department_id = d.department_id
     LEFT JOIN activity_directions ad ON d.direction_id = ad.direction_id
     ORDER BY ad.direction_name, d.department_name, wg.group_name`
  );
  res.json(rows);
});

// Создать группу
router.post('/groups', isAdmin, async (req, res) => {
  const { group_name, department_id, admin_id } = req.body;
  
  if (!group_name || !department_id) {
    return res.status(400).json({ error: 'Название группы и ID отдела обязательны' });
  }
  
  const [result] = await db.query(
    'INSERT INTO work_groups (group_name, department_id) VALUES (?, ?)',
    [group_name, department_id]
  );
  
  await db.query(
    `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, new_value)
     VALUES (?, 'create_group', 'group', ?, ?)`,
    [admin_id || req.admin_id, result.insertId, group_name]
  );
  
  res.json({ success: true, group_id: result.insertId });
});

// Редактировать группу
router.put('/groups/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { group_name, department_id, admin_id } = req.body;
  
  const [oldData] = await db.query(
    'SELECT group_name, department_id FROM work_groups WHERE group_id = ?',
    [id]
  );
  
  await db.query(
    'UPDATE work_groups SET group_name = ?, department_id = ? WHERE group_id = ?',
    [group_name, department_id, id]
  );
  
  await db.query(
    `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, old_value, new_value)
     VALUES (?, 'edit_group', 'group', ?, ?, ?)`,
    [admin_id || req.admin_id, id, JSON.stringify(oldData[0]), JSON.stringify({ group_name, department_id })]
  );
  
  res.json({ success: true });
});

// Удалить группу
router.delete('/groups/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.body;
  
  // Проверяем, есть ли сотрудники в группе
  const [employees] = await db.query(
    'SELECT COUNT(*) as count FROM employees WHERE group_id = ?',
    [id]
  );
  
  if (employees[0].count > 0) {
    return res.status(400).json({ error: 'Невозможно удалить группу с сотрудниками' });
  }
  
  await db.query('DELETE FROM work_groups WHERE group_id = ?', [id]);
  
  await db.query(
    `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id)
     VALUES (?, 'delete_group', 'group', ?)`,
    [admin_id || req.admin_id, id]
  );
  
  res.json({ success: true });
});

// ============ УПРАВЛЕНИЕ ОТДЕЛАМИ ============

// Получить все отделы
router.get('/departments', isAdmin, async (req, res) => {
  const [rows] = await db.query(
    `SELECT d.*, ad.direction_name
     FROM departments d
     LEFT JOIN activity_directions ad ON d.direction_id = ad.direction_id
     ORDER BY ad.direction_name, d.department_name`
  );
  res.json(rows);
});

// Создать отдел
router.post('/departments', isAdmin, async (req, res) => {
  const { department_name, direction_id, admin_id } = req.body;
  
  const [result] = await db.query(
    'INSERT INTO departments (department_name, direction_id) VALUES (?, ?)',
    [department_name, direction_id]
  );
  
  await db.query(
    `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, new_value)
     VALUES (?, 'create_department', 'department', ?, ?)`,
    [admin_id || req.admin_id, result.insertId, department_name]
  );
  
  res.json({ success: true, department_id: result.insertId });
});

// ============ СТАТИСТИКА ============

// Общая статистика для админа
router.get('/stats', isAdmin, async (req, res) => {
  const [totalEmployees] = await db.query('SELECT COUNT(*) as count FROM employees WHERE status = "Активен"');
  const [totalGroups] = await db.query('SELECT COUNT(*) as count FROM work_groups');
  const [totalDepartments] = await db.query('SELECT COUNT(*) as count FROM departments');
  const [avgCsat] = await db.query(`
    SELECT AVG(CASE WHEN total_feedbacks > 0 THEN (positive_feedbacks / total_feedbacks) * 100 ELSE 0 END) as avg_csat
    FROM daily_metrics WHERE verification_status = 'Одобрено'
  `);
  
  res.json({
    total_employees: totalEmployees[0].count,
    total_groups: totalGroups[0].count,
    total_departments: totalDepartments[0].count,
    avg_csat: avgCsat[0].avg_csat ? Number(avgCsat[0].avg_csat).toFixed(1) : 0
  });
});

// Логи действий администратора
router.get('/logs', isAdmin, async (req, res) => {
  const { limit = 100 } = req.query;
  
  const [rows] = await db.query(
    `SELECT al.*, 
            CONCAT(e.first_name, ' ', e.last_name) as admin_name
     FROM admin_logs al
     JOIN employees e ON al.admin_id = e.employee_id
     ORDER BY al.created_at DESC
     LIMIT ?`,
    [parseInt(limit)]
  );
  
  res.json(rows);
});

// ============ KPI НОРМЫ ============

// Получить KPI нормы
router.get('/kpi-targets', isAdmin, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM kpi_targets ORDER BY metric_name');
  res.json(rows);
});

// Обновить KPI норму
router.put('/kpi-targets/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { target_value, admin_id } = req.body;
  
  await db.query(
    'UPDATE kpi_targets SET target_value = ?, updated_by = ? WHERE target_id = ?',
    [target_value, admin_id || req.admin_id, id]
  );
  
  res.json({ success: true });
});

export default router;