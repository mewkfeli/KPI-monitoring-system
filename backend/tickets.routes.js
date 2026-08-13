// backend/tickets.routes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';
import { NotificationService } from './notification.service.js';
import { QuotaService } from './quota.service.js';

const router = express.Router();

// ============ НАСТРОЙКА MULTER ДЛЯ ФАЙЛОВ ============
const ticketUploadDir = './uploads/tickets/';
if (!fs.existsSync(ticketUploadDir)) {
  fs.mkdirSync(ticketUploadDir, { recursive: true });
}

const ticketStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ticketUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ticket-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadTicketFile = multer({ 
  storage: ticketStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла'));
    }
  }
});

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

const isClient = async (req, res, next) => {
  const user_id = req.headers['user-id'] || req.query.user_id || req.body.user_id;
  
  if (!user_id) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  
  try {
    const [rows] = await db.query(
      'SELECT role FROM employees WHERE employee_id = ? AND status = "Активен"',
      [user_id]
    );
    
    if (rows.length === 0 || rows[0].role !== 'Клиент') {
      return res.status(403).json({ error: 'Доступ только для клиентов' });
    }
    
    req.user_id = parseInt(user_id);
    next();
  } catch (error) {
    console.error('Client auth error:', error);
    res.status(500).json({ error: 'Ошибка проверки прав' });
  }
};

const isOperator = async (req, res, next) => {
  const user_id = req.headers['user-id'] || req.query.user_id || req.body.user_id;
  
  console.log("🔍 isOperator проверка, user_id:", user_id);  // 👈 ДОБАВЬТЕ ДЛЯ ОТЛАДКИ
  
  if (!user_id) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  
  try {
    const [rows] = await db.query(
      `SELECT role, group_id FROM employees 
       WHERE employee_id = ? AND status = "Активен" 
       AND role IN ('Сотрудник', 'Руководитель группы', 'Руководитель отдела', 'Администратор')`,
      [user_id]
    );
    
    if (rows.length === 0) {
      return res.status(403).json({ error: 'Доступ только для операторов' });
    }
    
    req.user_id = parseInt(user_id);
    req.user_group_id = rows[0].group_id;
    req.user_role = rows[0].role;
    next();
  } catch (error) {
    console.error('Operator auth error:', error);
    res.status(500).json({ error: 'Ошибка проверки прав' });
  }
};

const generateTicketNumber = async () => {
  const [result] = await db.query(`SELECT MAX(ticket_id) as max_id FROM tickets`);
  const nextId = (result[0].max_id || 0) + 1;
  
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `TKT-${year}${month}${day}-${String(nextId).padStart(4, '0')}`;
};

// ============ КЛИЕНТСКИЕ ЭНДПОИНТЫ ============


router.post('/tickets', isClient, async (req, res) => {
  const { subject, description, category, priority = 'medium', user_id } = req.body;
  
  if (!subject || !description) {
    return res.status(400).json({ error: 'Тема и описание обязательны' });
  }
  
  try {
    const ticketNumber = await generateTicketNumber();
    
    let assignedGroupId = null;
    
    // Определяем группу по категории (как и было)
    switch (category) {
      case 'Техническая проблема':
        const [techGroup] = await db.query(
          `SELECT group_id FROM work_groups WHERE group_id IN (5, 6) ORDER BY group_id LIMIT 1`
        );
        assignedGroupId = techGroup[0]?.group_id;
        break;
      case 'Сложный случай':
        const [complexGroup] = await db.query(
          `SELECT group_id FROM work_groups WHERE group_id = 3`
        );
        assignedGroupId = complexGroup[0]?.group_id;
        break;
      case 'Вопрос':
      case 'Жалоба':
      case 'Предложение':
      default:
        const [supportGroup] = await db.query(
          `SELECT group_id FROM work_groups WHERE group_id IN (1, 2, 4, 10) ORDER BY RAND() LIMIT 1`
        );
        assignedGroupId = supportGroup[0]?.group_id;
        break;
    }
    
    if (!assignedGroupId) {
      const [defaultGroup] = await db.query(
        `SELECT group_id FROM work_groups WHERE is_default_for_tickets = 1 LIMIT 1`
      );
      assignedGroupId = defaultGroup[0]?.group_id || 1;
    }
    
    // 👇 ИЗМЕНЕНИЕ: НЕ назначаем оператора автоматически
    // Оператор остаётся NULL - заявка в очереди
    let operatorId = null;
    let initialStatus = 'new';  // 👈 статус "Новое", а не "in_progress"
    
    console.log("📊 Создано обращение в группу:", assignedGroupId, "Статус: new (ожидает оператора)");
    
    // Получаем название группы
    const [groupInfo] = await db.query(
      `SELECT group_name FROM work_groups WHERE group_id = ?`,
      [assignedGroupId]
    );
    const groupName = groupInfo[0]?.group_name || 'Общая поддержка';
    
    // Создаём обращение БЕЗ назначения оператора
    const [result] = await db.query(
      `INSERT INTO tickets (ticket_number, client_id, operator_id, subject, description, category, priority, group_id, status, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', 'web', NOW())`,
      [ticketNumber, user_id || req.user_id, null, subject, description, category, priority, assignedGroupId]
    );
    
    // Уведомляем ВСЕХ операторов группы о новом обращении
    const [operators] = await db.query(
      `SELECT employee_id FROM employees 
       WHERE group_id = ? 
         AND role = 'Сотрудник' 
         AND status = 'Активен'`,
      [assignedGroupId]
    );
    
    for (const op of operators) {
      await NotificationService.createNotification(
        op.employee_id,
        '📋 Новое обращение в очереди',
        `Появилось новое обращение #${ticketNumber} (${groupName}) в вашей группе: ${subject}`,
        'info',
        'ticket',
        result.insertId
      );
    }
    
    // Уведомляем клиента
    await NotificationService.createNotification(
      user_id || req.user_id,
      '✅ Обращение создано',
      `Ваше обращение #${ticketNumber} создано и отправлено в очередь. Оператор скоро свяжется с вами.`,
      'success',
      'ticket',
      result.insertId
    );
    
    res.json({ 
      success: true, 
      ticket_id: result.insertId, 
      ticket_number: ticketNumber,
      assigned_group: groupName,
      status: 'new'
    });
  } catch (error) {
    console.error('Ошибка создания обращения:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/my-tickets', isClient, async (req, res) => {
  const { user_id, status, limit = 50 } = req.query;
  
  let query = `
    SELECT t.*,
           CONCAT(e.first_name, ' ', e.last_name) as operator_name,
           wg.group_name as assigned_group
    FROM tickets t
    LEFT JOIN employees e ON t.operator_id = e.employee_id
    LEFT JOIN work_groups wg ON t.group_id = wg.group_id
    WHERE t.client_id = ?
  `;
  const params = [user_id || req.user_id];
  
  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY t.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const [rows] = await db.query(query, params);
  res.json(rows);
});

router.get('/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const user_id = req.headers['user-id'] || req.query.user_id;
  
  if (!user_id) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  
  try {
    const [ticket] = await db.query(
      `SELECT t.*,
              CONCAT(c.first_name, ' ', c.last_name) as client_name,
              CONCAT(o.first_name, ' ', o.last_name) as operator_name,
              c.avatar_url as client_avatar,
              o.avatar_url as operator_avatar,
              wg.group_name as assigned_group
       FROM tickets t
       JOIN employees c ON t.client_id = c.employee_id
       LEFT JOIN employees o ON t.operator_id = o.employee_id
       LEFT JOIN work_groups wg ON t.group_id = wg.group_id
       WHERE t.ticket_id = ?`,
      [id]
    );
    
    if (ticket.length === 0) {
      return res.status(404).json({ error: 'Обращение не найдено' });
    }
    
    const [comments] = await db.query(
      `SELECT tc.*, 
              CONCAT(e.first_name, ' ', e.last_name) as user_name,
              e.avatar_url,
              e.role
       FROM ticket_comments tc
       JOIN employees e ON tc.user_id = e.employee_id
       WHERE tc.ticket_id = ?
       ORDER BY tc.created_at ASC`,
      [id]
    );
    
    const [attachments] = await db.query(
      `SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at DESC`,
      [id]
    );
    
    res.json({ ...ticket[0], comments, attachments });
  } catch (error) {
    console.error('Ошибка получения обращения:', error);
    res.status(500).json({ error: error.message });
  }
});

// Загрузка файла к обращению
router.post('/tickets/:id/attachments', uploadTicketFile.single('file'), async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  
  try {
    const fileUrl = `/uploads/tickets/${req.file.filename}`;
    
    await db.query(
      `INSERT INTO ticket_attachments (ticket_id, user_id, file_name, file_url, file_size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, user_id, req.file.originalname, fileUrl, req.file.size, req.file.mimetype]
    );
    
    res.json({ 
      success: true, 
      file_url: fileUrl, 
      file_name: req.file.originalname 
    });
  } catch (error) {
    console.error('Ошибка загрузки файла:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить файлы обращения
router.get('/tickets/:id/attachments', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [attachments] = await db.query(
      `SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at DESC`,
      [id]
    );
    res.json(attachments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Добавить комментарий
router.post('/tickets/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { message, user_id } = req.body;
  
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }
  
  try {
    const [ticket] = await db.query(
      `SELECT ticket_number, client_id, operator_id, status, priority, created_at FROM tickets WHERE ticket_id = ?`,
      [id]
    );
    
    if (ticket.length === 0) {
      return res.status(404).json({ error: 'Обращение не найдено' });
    }
    
    const [user] = await db.query(`SELECT role FROM employees WHERE employee_id = ?`, [user_id]);
    const isClientUser = user[0]?.role === 'Клиент';
    
    await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, message, created_at)
       VALUES (?, ?, ?, NOW())`,
      [id, user_id, message.trim()]
    );
    
    // 👇 ЕСЛИ ЭТО ПЕРВЫЙ ОТВЕТ ОПЕРАТОРА (НЕ КЛИЕНТА)
    if (!isClientUser && !ticket[0].first_response_at) {
      const firstResponseTime = Math.floor((new Date() - new Date(ticket[0].created_at)) / 60000);
      
      let slaMinutes = 240;
      switch (ticket[0].priority) {
        case 'urgent': slaMinutes = 15; break;
        case 'high': slaMinutes = 60; break;
        case 'medium': slaMinutes = 240; break;
        case 'low': slaMinutes = 1440; break;
      }
      
      const slaDeadline = new Date(new Date(ticket[0].created_at).getTime() + slaMinutes * 60000);
      let slaStatus = 'ok';
      if (firstResponseTime > slaMinutes) slaStatus = 'overdue';
      else if (firstResponseTime > slaMinutes * 0.8) slaStatus = 'warning';
      
      await db.query(
        `UPDATE tickets 
         SET status = 'in_progress', 
             first_response_at = NOW(),
             first_response_time_minutes = ?,
             sla_status = ?,
             sla_deadline = ?
         WHERE ticket_id = ? AND first_response_at IS NULL`,
        [firstResponseTime, slaStatus, slaDeadline, id]
      );
    }
    
    if (isClientUser && ticket[0].operator_id) {
      await NotificationService.createNotification(
        ticket[0].operator_id,
        '💬 Новое сообщение от клиента',
        `Клиент ответил в обращении #${ticket[0].ticket_number}`,
        'info',
        'ticket',
        parseInt(id)
      );
    } else if (!isClientUser && ticket[0].client_id) {
      await NotificationService.createNotification(
        ticket[0].client_id,
        '💬 Новый ответ оператора',
        `Поступил новый ответ по обращению #${ticket[0].ticket_number}`,
        'info',
        'ticket',
        parseInt(id)
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка добавления комментария:', error);
    res.status(500).json({ error: error.message });
  }
});

// Закрыть обращение с оценкой (клиент)
router.put('/tickets/:id/close', isClient, async (req, res) => {
  const { id } = req.params;
  const { rating, comment, user_id } = req.body;
  
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
  }
  
  try {
    const [ticket] = await db.query(
      `SELECT ticket_number, operator_id, client_id FROM tickets WHERE ticket_id = ? AND client_id = ?`,
      [id, user_id || req.user_id]
    );
    
    if (ticket.length === 0) {
      return res.status(404).json({ error: 'Обращение не найдено' });
    }
    
  await db.query(
    `UPDATE tickets 
     SET status = 'resolved', 
         closed_at = NOW(),
         satisfaction_rating = ?,
         satisfaction_comment = ?
     WHERE ticket_id = ?`,
    [rating, comment || null, id]
  );
    
    if (ticket[0].operator_id) {
      const ratingText = rating >= 4 ? 'положительную' : rating === 3 ? 'нейтральную' : 'отрицательную';
      await NotificationService.createNotification(
        ticket[0].operator_id,
        '⭐ Получена оценка',
        `Клиент поставил ${ratingText} оценку (${rating}/5) по обращению #${ticket[0].ticket_number}`,
        rating >= 4 ? 'success' : rating === 3 ? 'info' : 'warning',
        'ticket',
        parseInt(id)
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка закрытия обращения:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ОПЕРАТОРСКИЕ ЭНДПОИНТЫ ============

router.get('/operator/tickets', isOperator, async (req, res) => {
  const { status, limit = 100, user_id, search, group_id, start_date, end_date, date_type = 'created' } = req.query;
  const userId = user_id || req.user_id;
  const userGroupId = req.user_group_id;
  const userRole = req.user_role;
  
  console.log('📊 Параметры запроса:', { status, limit, userId, search, group_id, start_date, end_date, date_type });
  
  let query = `
    SELECT t.*,
           CONCAT(c.first_name, ' ', c.last_name) as client_name,
           c.avatar_url as client_avatar,
           CONCAT(op.first_name, ' ', op.last_name) as operator_name,
           wg.group_name as assigned_group
    FROM tickets t
    JOIN employees c ON t.client_id = c.employee_id
    LEFT JOIN employees op ON t.operator_id = op.employee_id
    LEFT JOIN work_groups wg ON t.group_id = wg.group_id
    WHERE 1=1
  `;
  const params = [];
  
  // Фильтр по оператору (если передан конкретный оператор)
  if (req.query.operator_id) {
    query += ` AND t.operator_id = ?`;
    params.push(req.query.operator_id);
  }
  
  // Фильтр по группе
  if (userRole === 'Сотрудник') {
    query += ` AND t.group_id = ?`;
    params.push(userGroupId);
  } else if (group_id) {
    const groupIds = group_id.split(',');
    const placeholders = groupIds.map(() => '?').join(',');
    query += ` AND t.group_id IN (${placeholders})`;
    params.push(...groupIds);
  }
  
  // 👇👇👇 ФИЛЬТРАЦИЯ ПО ДАТАМ С ВЫБОРОМ ТИПА 👇👇👇
  if (start_date && end_date) {
    if (date_type === 'closed') {
      // По дате закрытия/решения
      query += ` AND DATE(COALESCE(t.closed_at, t.resolved_at)) BETWEEN ? AND ?`;
    } else {
      // По дате создания (по умолчанию)
      query += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
    }
    params.push(start_date, end_date);
    console.log(`📅 Фильтр по датам (${date_type === 'closed' ? 'закрытия' : 'создания'}):`, start_date, '-', end_date);
  }
  
  // Фильтр по статусу
  if (status === 'my_active') {
    query += ` AND t.operator_id = ? AND t.status IN ('in_progress', 'waiting')`;
    params.push(userId);
  } else if (status === 'my_closed') {
    query += ` AND t.operator_id = ? AND t.status IN ('closed', 'resolved')`;
    params.push(userId);
  } else if (status === 'new') {
    query += ` AND t.status = 'new' AND t.operator_id IS NULL`;
  } else if (status === 'all') {
    // Без фильтра по статусу
  }
  
  // Поиск
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    query += ` AND (t.ticket_number LIKE ? OR c.last_name LIKE ? OR c.first_name LIKE ? OR t.subject LIKE ?)`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  // Сортировка
  query += ` ORDER BY 
    CASE t.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    t.created_at ASC
    LIMIT ?`;
  params.push(parseInt(limit));
  
  console.log('📡 SQL Query:', query);
  console.log('📡 Params:', params);
  
  const [rows] = await db.query(query, params);
  res.json(rows);
});

// Взять обращение в работу

router.put('/tickets/:id/take', isOperator, async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    const userId = user_id || req.user_id;
    
    try {
        // Проверяем норму по ЗАКРЫТЫМ обращениям
        const quotaCheck = await QuotaService.canTakeTicket(userId);
        
        if (!quotaCheck.allowed) {
            return res.status(429).json({ 
                error: quotaCheck.reason,
                quota: {
                    current: quotaCheck.currentCount,
                    target: quotaCheck.dailyTarget,
                    remaining: quotaCheck.remaining
                }
            });
        }
        
        // Получаем информацию об обращении
        const [ticket] = await db.query(
            `SELECT ticket_number, client_id, status, operator_id 
             FROM tickets WHERE ticket_id = ?`,
            [id]
        );
        
        if (ticket.length === 0) {
            return res.status(404).json({ error: 'Обращение не найдено' });
        }
        
        // Проверка: если обращение уже назначено другому оператору
        if (ticket[0].operator_id && ticket[0].operator_id !== userId) {
            const [currentOperator] = await db.query(
                `SELECT CONCAT(first_name, ' ', last_name) as name FROM employees WHERE employee_id = ?`,
                [ticket[0].operator_id]
            );
            return res.status(400).json({ 
                error: `Обращение уже взято в работу оператором ${currentOperator[0]?.name || 'другим оператором'}`
            });
        }
        
        // Если обращение уже закреплено за этим оператором - просто подтверждаем
        if (ticket[0].operator_id === userId) {
            return res.json({ 
                success: true, 
                message: 'Вы уже работаете с этим обращением',
                quota: {
                    current: quotaCheck.currentCount,
                    target: quotaCheck.dailyTarget,
                    remaining: quotaCheck.remaining
                }
            });
        }
        
        // Берём обращение (НЕ увеличиваем счётчик нормы!)
        await db.query(
            `UPDATE tickets 
             SET operator_id = ?, 
                 status = 'in_progress',
                 first_response_at = COALESCE(first_response_at, NOW())
             WHERE ticket_id = ? AND (operator_id IS NULL OR operator_id = ?)`,
            [userId, id, userId]
        );
        
        // Получаем обновлённую информацию о норме
        const quotaDate = QuotaService.getCurrentQuotaDate();
const newCount = await QuotaService.getClosedCountByDate(userId, quotaDate);
        
        // Уведомляем клиента
        await NotificationService.createNotification(
            ticket[0].client_id,
            '👨‍💼 Обращение взято в работу',
            `Ваше обращение #${ticket[0].ticket_number} принято в работу оператором`,
            'info',
            'ticket',
            parseInt(id)
        );
        
        // Отправляем событие через сокет
        const io = req.app.get('io');
        const [operatorInfo] = await db.query(
            `SELECT first_name, last_name FROM employees WHERE employee_id = ?`,
            [userId]
        );
        
        if (io) {
            io.emit('ticket_taken', { 
                ticket_id: parseInt(id), 
                operator_name: `${operatorInfo[0].first_name} ${operatorInfo[0].last_name}` 
            });
        }
        
        const response = { 
            success: true, 
            message: 'Обращение взято в работу',
            quota: {
                current: newCount,
                target: quotaCheck.dailyTarget,
                remaining: Math.max(0, quotaCheck.dailyTarget - newCount)
            }
        };
        
        if (quotaCheck.remaining <= 3 && quotaCheck.remaining > 0) {
            response.warning = `⚠️ Осталось ${quotaCheck.remaining} обращений до выполнения нормы!`;
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('Ошибка взятия обращения:', error);
        res.status(500).json({ error: error.message });
    }
});

// backend/tickets.routes.js

router.put('/tickets/:id/resolve', isOperator, async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    const userId = user_id || req.user_id;
    
    try {
        const [ticket] = await db.query(
            `SELECT ticket_number, client_id, operator_id, created_at FROM tickets WHERE ticket_id = ?`,
            [id]
        );
        
        if (ticket.length === 0) {
            return res.status(404).json({ error: 'Обращение не найдено' });
        }
        
        if (ticket[0].operator_id !== userId) {
            return res.status(403).json({ error: 'Вы не ведёте это обращение' });
        }
        
        const resolutionTime = Math.floor((new Date() - new Date(ticket[0].created_at)) / 60000);
        
        await db.query(
            `UPDATE tickets 
             SET status = 'resolved',
                 resolved_at = NOW(),
                 resolution_time_minutes = ?,
                 is_first_contact_resolved = (SELECT COUNT(*) = 0 FROM ticket_transfers WHERE ticket_id = ?)
             WHERE ticket_id = ?`,
            [resolutionTime, id, id]
        );
        
        // 👇 ОЧИЩАЕМ КЭШ ПОСЛЕ ОБНОВЛЕНИЯ
        QuotaService.clearQuotaCacheForEmployee(userId);
        
        // 👇 ПОЛУЧАЕМ СВЕЖИЕ ДАННЫЕ
        const quotaDate = QuotaService.getCurrentQuotaDate();
        const [countResult] = await db.query(
            `SELECT COUNT(*) as count 
             FROM tickets 
             WHERE operator_id = ? 
               AND status IN ('closed', 'resolved')
               AND DATE(COALESCE(closed_at, resolved_at)) = ?`,
            [userId, quotaDate]
        );
        
        const newCount = countResult[0]?.count || 0;
        const dailyTarget = await QuotaService.getDynamicDailyTarget(userId);
        
        // Уведомляем клиента
        await NotificationService.createNotification(
            ticket[0].client_id,
            '✅ Обращение решено',
            `Ваше обращение #${ticket[0].ticket_number} решено. Пожалуйста, оцените качество обслуживания.`,
            'success',
            'ticket',
            parseInt(id)
        );
        
        const io = req.app.get('io');
        if (io) {
            io.emit('ticket_resolved', { 
                ticket_id: parseInt(id), 
                operator_id: userId
            });
        }
        
        const remaining = Math.max(0, dailyTarget - newCount);
        const isQuotaCompleted = newCount >= dailyTarget;
        
        res.json({ 
            success: true,
            message: `Обращение решено. Осталось ${remaining} обращений до выполнения нормы.`,
            quota: {
                current: newCount,
                target: dailyTarget,
                remaining: remaining,
                isCompleted: isQuotaCompleted
            }
        });
        
    } catch (error) {
        console.error('Ошибка отметки решения:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/tickets/:id/transfer', isOperator, async (req, res) => {
  const { id } = req.params;
  const { to_operator_id, reason, user_id } = req.body;
  const userId = user_id || req.user_id;
  
  if (!to_operator_id) {
    return res.status(400).json({ error: 'Укажите оператора для передачи' });
  }
  
  try {
    const [ticket] = await db.query(
      `SELECT ticket_number, client_id, operator_id FROM tickets WHERE ticket_id = ?`,
      [id]
    );
    
    if (ticket.length === 0) {
      return res.status(404).json({ error: 'Обращение не найдено' });
    }
    
    if (ticket[0].operator_id !== userId) {
      return res.status(403).json({ error: 'Вы не ведёте это обращение' });
    }
    
    await db.query(
      `INSERT INTO ticket_transfers (ticket_id, from_operator_id, to_operator_id, reason)
       VALUES (?, ?, ?, ?)`,
      [id, userId, to_operator_id, reason || null]
    );
    
    await db.query(`UPDATE tickets SET operator_id = ? WHERE ticket_id = ?`, [to_operator_id, id]);
    
    const [operatorInfo] = await db.query(
      `SELECT first_name, last_name FROM employees WHERE employee_id = ?`,
      [userId]
    );
    
    await NotificationService.createNotification(
      to_operator_id,
      '📨 Вам передано обращение',
      `${operatorInfo[0].first_name} ${operatorInfo[0].last_name} передал(а) вам обращение #${ticket[0].ticket_number}`,
      'info',
      'ticket',
      parseInt(id)
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка передачи обращения:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/operator/stats', isOperator, async (req, res) => {
  const { user_id } = req.query;
  const userId = user_id || req.user_id;
  
  try {
    const [stats] = await db.query(
      `SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
        AVG(CASE WHEN satisfaction_rating IS NOT NULL THEN satisfaction_rating ELSE NULL END) as avg_rating,
        AVG(CASE WHEN resolution_time_minutes IS NOT NULL THEN resolution_time_minutes ELSE NULL END) as avg_resolution_minutes,
        AVG(CASE WHEN first_response_time_minutes IS NOT NULL THEN first_response_time_minutes ELSE NULL END) as avg_first_response
      FROM tickets
      WHERE operator_id = ?`,
      [userId]
    );
    
    res.json(stats[0] || { total_tickets: 0 });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.json({ total_tickets: 0 });
  }
});

// ============ ШАБЛОНЫ ОТВЕТОВ ============

// Получить шаблоны ответов
router.get('/templates', isOperator, async (req, res) => {
  const { user_id } = req.query;
  
  try {
    const [templates] = await db.query(
      `SELECT * FROM response_templates 
       WHERE created_by = ? OR is_global = 1
       ORDER BY is_global DESC, title ASC`,
      [user_id || req.user_id]
    );
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать шаблон
router.post('/templates', isOperator, async (req, res) => {
  const { title, content, category, is_global, user_id } = req.body;
  
  try {
    const [result] = await db.query(
      `INSERT INTO response_templates (title, content, category, created_by, is_global)
       VALUES (?, ?, ?, ?, ?)`,
      [title, content, category, user_id || req.user_id, is_global ? 1 : 0]
    );
    res.json({ success: true, template_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удалить шаблон
router.delete('/templates/:id', isOperator, async (req, res) => {
  const { id } = req.params;
  
  try {
    await db.query(`DELETE FROM response_templates WHERE template_id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.put('/tickets/:id/cancel', isClient, async (req, res) => {
  const { id } = req.params;
  const { reason, user_id } = req.body;
  
  try {
    const [ticket] = await db.query(
      `SELECT ticket_number, operator_id, client_id, status 
       FROM tickets WHERE ticket_id = ? AND client_id = ?`,
      [id, user_id || req.user_id]
    );
    
    if (ticket.length === 0) {
      return res.status(404).json({ error: 'Обращение не найдено' });
    }
    
    // Проверяем, можно ли отменить (только new или in_progress)
    if (ticket[0].status !== 'new' && ticket[0].status !== 'in_progress') {
      return res.status(400).json({ error: 'Нельзя отменить обращение на этом этапе' });
    }
    
    await db.query(
      `UPDATE tickets 
       SET status = 'cancelled', 
           cancelled_at = NOW(),
           cancellation_reason = ?
       WHERE ticket_id = ?`,
      [reason || null, id]
    );
    
    // Уведомляем оператора (если был назначен)
    if (ticket[0].operator_id) {
      await NotificationService.createNotification(
        ticket[0].operator_id,
        '❌ Обращение отменено',
        `Клиент отменил обращение #${ticket[0].ticket_number}${reason ? `\nПричина: ${reason}` : ''}`,
        'warning',
        'ticket',
        parseInt(id)
      );
    }
    
    res.json({ success: true, message: 'Обращение отменено' });
  } catch (error) {
    console.error('Ошибка отмены обращения:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============ РЕЙТИНГ ОПЕРАТОРОВ ============

// Получить рейтинг операторов (для клиентов)
router.get("/operators/rating", async (req, res) => {
  try {
    const [operators] = await db.query(
      `SELECT 
         e.employee_id,
         e.first_name,
         e.last_name,
         e.avatar_url,
         e.role,
         COUNT(t.ticket_id) as total_tickets,
         COUNT(CASE WHEN t.satisfaction_rating IS NOT NULL THEN 1 END) as rated_tickets,
         ROUND(AVG(CASE WHEN t.satisfaction_rating IS NOT NULL THEN t.satisfaction_rating END), 1) as avg_rating
       FROM employees e
       LEFT JOIN tickets t ON e.employee_id = t.operator_id AND t.status = 'closed'
       WHERE e.role IN ('Сотрудник', 'Руководитель группы', 'Руководитель отдела')
         AND e.status = 'Активен'
       GROUP BY e.employee_id
       HAVING total_tickets > 0
       ORDER BY avg_rating DESC`,
      []
    );

    const formattedOperators = operators.map(op => ({
      employee_id: op.employee_id,
      full_name: `${op.last_name} ${op.first_name}`,
      avatar_url: op.avatar_url,
      role: op.role,
      total_tickets: parseInt(op.total_tickets) || 0,
      rated_tickets: parseInt(op.rated_tickets) || 0,
      avg_rating: op.avg_rating ? parseFloat(op.avg_rating) : 0,
    }));

    res.json(formattedOperators);
  } catch (error) {
    console.error("Ошибка получения рейтинга операторов:", error);
    res.status(500).json({ error: error.message });
  }
});

// Получить конкретного оператора с отзывами
router.get("/operators/:id/rating", async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log(`📊 Запрос оператора ${id} с отзывами`);
    
    // Получаем информацию об операторе (все обращения, где он был оператором)
    const [operator] = await db.query(
      `SELECT 
         e.employee_id,
         e.first_name,
         e.last_name,
         e.avatar_url,
         e.role,
         COUNT(t.ticket_id) as total_tickets,
         ROUND(COALESCE(AVG(CASE WHEN t.satisfaction_rating IS NOT NULL THEN t.satisfaction_rating END), 0), 1) as avg_rating
       FROM employees e
       LEFT JOIN tickets t ON e.employee_id = t.operator_id
       WHERE e.employee_id = ?
       GROUP BY e.employee_id`,
      [id]
    );

    if (operator.length === 0) {
      return res.status(404).json({ error: "Оператор не найден" });
    }

    // Получаем отзывы - БЕЗ ФИЛЬТРА ПО СТАТУСУ
    const [reviews] = await db.query(
      `SELECT 
         ticket_id,
         ticket_number,
         satisfaction_rating as rating,
         IFNULL(satisfaction_comment, '') as comment,
         created_at as date,
         subject
       FROM tickets
       WHERE operator_id = ? 
         AND satisfaction_rating IS NOT NULL
         AND satisfaction_rating BETWEEN 1 AND 5
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    );

    console.log(`📊 Найдено отзывов для оператора ${id}:`, reviews.length);
    console.log(`📊 Первый отзыв:`, reviews[0]);

    res.json({
      employee_id: operator[0].employee_id,
      full_name: `${operator[0].last_name} ${operator[0].first_name}`,
      avatar_url: operator[0].avatar_url,
      role: operator[0].role,
      total_tickets: parseInt(operator[0].total_tickets) || 0,
      avg_rating: parseFloat(operator[0].avg_rating) || 0,
      reviews: reviews.map(r => ({
        rating: r.rating,
        comment: r.comment || '',
        date: r.date,
        ticket_number: r.ticket_number,
        subject: r.subject
      }))
    });
  } catch (error) {
    console.error("Ошибка получения оператора:", error);
    res.status(500).json({ error: error.message });
  }
});
// ============ ПОИСК ПОХОЖИХ ОБРАЩЕНИЙ ДЛЯ ПОДСКАЗОК ============

// Поиск похожих обращений клиента по теме
router.get("/similar-tickets", isClient, async (req, res) => {
  const { user_id, query, limit = 5 } = req.query;
  
  if (!query || query.length < 2) {
    return res.json([]);
  }
  
  try {
    // Ищем похожие обращения по теме или описанию
    const [similarTickets] = await db.query(
      `SELECT 
         ticket_id,
         ticket_number,
         subject,
         description,
         status,
         category,
         created_at,
         MATCH(subject, description) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
       FROM tickets 
       WHERE client_id = ? 
         AND (subject LIKE ? OR description LIKE ?)
         AND status IN ('closed', 'resolved')
       ORDER BY 
         CASE 
           WHEN subject LIKE ? THEN 3
           WHEN description LIKE ? THEN 2
           ELSE 1
         END DESC,
         created_at DESC
       LIMIT ?`,
      [
        `%${query}%`,
        user_id,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        parseInt(limit)
      ]
    );
    
    // Если есть полнотекстовый индекс, используем его
    let tickets = similarTickets;
    
    // Если нет результатов, ищем по ключевым словам
    if (tickets.length === 0 && query.length > 3) {
      const keywords = query.split(' ').slice(0, 3);
      let keywordConditions = [];
      for (const kw of keywords) {
        if (kw.length > 2) {
          keywordConditions.push(`(subject LIKE '%${kw}%' OR description LIKE '%${kw}%')`);
        }
      }
      
      if (keywordConditions.length > 0) {
        const [keywordTickets] = await db.query(
          `SELECT 
             ticket_id,
             ticket_number,
             subject,
             description,
             status,
             category,
             created_at
           FROM tickets 
           WHERE client_id = ? 
             AND (${keywordConditions.join(' OR ')})
             AND status IN ('closed', 'resolved')
           ORDER BY created_at DESC
           LIMIT ?`,
          [user_id, parseInt(limit)]
        );
        tickets = keywordTickets;
      }
    }
    
    // Форматируем результат
    const suggestions = tickets.map(t => ({
      type: 'ticket',
      id: t.ticket_id,
      title: t.subject,
      description: t.description,
      category: t.category,
      status: t.status,
      date: t.created_at,
      relevance: t.relevance || 0
    }));
    
    res.json(suggestions);
  } catch (error) {
    console.error("Ошибка поиска похожих обращений:", error);
    res.status(500).json({ error: error.message });
  }
});

// Поиск по базе знаний (Knowledge Base)
router.get("/knowledge-search", async (req, res) => {
  const { query, limit = 5 } = req.query;
  
  if (!query || query.length < 2) {
    return res.json([]);
  }
  
  try {
    // Временно используем статические статьи из базы знаний
    // Позже можно добавить таблицу knowledge_articles
    const knowledgeArticles = [
      { id: 1, title: "Как оформить возврат товара", keywords: ["возврат", "товар", "оформить"], content: "Для оформления возврата перейдите в раздел Мои заказы..." },
      { id: 2, title: "Как изменить способ доставки", keywords: ["доставка", "изменить", "способ"], content: "Изменить способ доставки можно до отправки заказа..." },
      { id: 3, title: "Проблемы с оплатой заказа", keywords: ["оплата", "карта", "не проходит"], content: "Если оплата не проходит, проверьте баланс карты..." },
      { id: 4, title: "Как связаться с продавцом", keywords: ["продавец", "связаться", "написать"], content: "На странице товара есть кнопка Связаться с продавцом..." },
      { id: 5, title: "Что делать, если заказ не пришёл", keywords: ["заказ", "не пришёл", "доставка"], content: "Если заказ не пришёл в срок, обратитесь в поддержку..." },
      { id: 6, title: "Как отменить заказ", keywords: ["отменить", "заказ", "отмена"], content: "Отменить заказ можно в разделе Мои заказы..." },
      { id: 7, title: "Промокоды и скидки", keywords: ["промокод", "скидка", "акция"], content: "Введите промокод в корзине перед оформлением заказа..." }
    ];
    
    const lowerQuery = query.toLowerCase();
    const matches = knowledgeArticles
      .filter(article => 
        article.title.toLowerCase().includes(lowerQuery) ||
        article.keywords.some(kw => lowerQuery.includes(kw))
      )
      .slice(0, limit)
      .map(article => ({
        type: 'knowledge',
        id: article.id,
        title: article.title,
        description: article.content.substring(0, 150) + '...'
      }));
    
    res.json(matches);
  } catch (error) {
    console.error("Ошибка поиска в базе знаний:", error);
    res.json([]);
  }
});
// ============ ЗАПРОС ПОМОЩИ КОЛЛЕГЕ ============

// Получить список операторов группы для запроса помощи
router.get("/operators/help-list", isOperator, async (req, res) => {
  const userId = req.user_id;
  const userGroupId = req.user_group_id;
  
  console.log("📊 Запрос списка операторов для помощи, group_id:", userGroupId);
  
  try {
    const [operators] = await db.query(
      `SELECT 
         e.employee_id,
         e.first_name,
         e.last_name,
         e.avatar_url,
         e.role
       FROM employees e
       WHERE e.group_id = ? 
         AND e.employee_id != ?
         AND e.status = 'Активен'
         AND e.role IN ('Сотрудник', 'Руководитель группы', 'Руководитель отдела')
       ORDER BY 
         CASE e.role 
           WHEN 'Руководитель отдела' THEN 1
           WHEN 'Руководитель группы' THEN 2
           ELSE 3
         END,
         e.last_name`,
      [userGroupId, userId]
    );
    
    console.log("📊 Найдено операторов:", operators.length);
    res.json(operators);
  } catch (error) {
    console.error("Ошибка получения списка операторов:", error);
    res.status(500).json({ error: error.message });
  }
});

// Отправить запрос помощи коллеге
router.post("/tickets/:id/request-help", isOperator, async (req, res) => {
  const { id } = req.params;
  const { to_operator_id, message } = req.body;
  const from_operator_id = req.user_id;
  
  if (!to_operator_id || !message || !message.trim()) {
    return res.status(400).json({ error: "Укажите коллегу и напишите вопрос" });
  }
  
  try {
    // Проверяем, что обращение принадлежит оператору
    const [ticket] = await db.query(
      `SELECT ticket_number, client_id, operator_id, subject FROM tickets WHERE ticket_id = ?`,
      [id]
    );
    
    if (ticket.length === 0) {
      return res.status(404).json({ error: "Обращение не найдено" });
    }
    
    if (ticket[0].operator_id !== from_operator_id) {
      return res.status(403).json({ error: "Вы не ведёте это обращение" });
    }
    
    // Создаем запрос помощи
    const [result] = await db.query(
      `INSERT INTO help_requests (ticket_id, from_operator_id, to_operator_id, message, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [id, from_operator_id, to_operator_id, message.trim()]
    );
    
    // Добавляем внутренний комментарий (виден только операторам)
    const internalComment = `🆘 ЗАПРОС ПОМОЩИ: ${message.trim()}`;
    
    // Получаем информацию об отправителе
    const [senderInfo] = await db.query(
      `SELECT first_name, last_name FROM employees WHERE employee_id = ?`,
      [from_operator_id]
    );
    const senderName = `${senderInfo[0].first_name} ${senderInfo[0].last_name}`;
    
    // Добавляем внутренний комментарий в ticket_comments
    await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, message, is_internal, created_at)
       VALUES (?, ?, CONCAT('🆘 [ЗАПРОС ПОМОЩИ от ', ?, ']: ', ?), 1, NOW())`,
      [id, from_operator_id, senderName, message.trim()]
    );
    
    // Уведомляем коллегу
    await NotificationService.createNotification(
      to_operator_id,
      "🆘 Запрос помощи",
      `${senderName} запрашивает помощь по обращению #${ticket[0].ticket_number}: ${message.trim().substring(0, 100)}`,
      "warning",
      "ticket",
      parseInt(id)
    );
    
    res.json({ 
      success: true, 
      message: "Запрос помощи отправлен",
      request_id: result.insertId
    });
  } catch (error) {
    console.error("Ошибка отправки запроса помощи:", error);
    res.status(500).json({ error: error.message });
  }
});

// Ответить на запрос помощи
router.post("/help-requests/:id/respond", isOperator, async (req, res) => {
  const { id } = req.params;
  const { response } = req.body;
  const operator_id = req.user_id;
  
  if (!response || !response.trim()) {
    return res.status(400).json({ error: "Введите ответ" });
  }
  
  try {
    // Получаем информацию о запросе
    const [request] = await db.query(
      `SELECT hr.*, t.ticket_number, t.operator_id 
       FROM help_requests hr
       JOIN tickets t ON hr.ticket_id = t.ticket_id
       WHERE hr.request_id = ?`,
      [id]
    );
    
    if (request.length === 0) {
      return res.status(404).json({ error: "Запрос не найден" });
    }
    
    if (request[0].to_operator_id !== operator_id) {
      return res.status(403).json({ error: "Этот запрос не для вас" });
    }
    
    // Обновляем запрос
    await db.query(
      `UPDATE help_requests 
       SET status = 'responded', 
           response = ?,
           responded_at = NOW()
       WHERE request_id = ?`,
      [response.trim(), id]
    );
    
    // Добавляем внутренний комментарий
    const [responderInfo] = await db.query(
      `SELECT first_name, last_name FROM employees WHERE employee_id = ?`,
      [operator_id]
    );
    const responderName = `${responderInfo[0].first_name} ${responderInfo[0].last_name}`;
    
    await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, message, is_internal, created_at)
       VALUES (?, ?, CONCAT('💬 [ОТВЕТ НА ЗАПРОС от ', ?, ']: ', ?), 1, NOW())`,
      [request[0].ticket_id, operator_id, responderName, response.trim()]
    );
    
    // Уведомляем запросившего
    await NotificationService.createNotification(
      request[0].from_operator_id,
      "💬 Ответ на запрос помощи",
      `${responderName} ответил на ваш запрос по обращению #${request[0].ticket_number}: ${response.trim().substring(0, 100)}`,
      "info",
      "ticket",
      request[0].ticket_id
    );
    
    res.json({ success: true, message: "Ответ отправлен" });
  } catch (error) {
    console.error("Ошибка ответа на запрос:", error);
    res.status(500).json({ error: error.message });
  }
});

// Получить активные запросы помощи для оператора
router.get("/help-requests/pending", isOperator, async (req, res) => {
  const operator_id = req.user_id;
  
  try {
    const [requests] = await db.query(
      `SELECT hr.*, 
              t.ticket_number,
              t.subject,
              CONCAT(e.first_name, ' ', e.last_name) as from_operator_name
       FROM help_requests hr
       JOIN tickets t ON hr.ticket_id = t.ticket_id
       JOIN employees e ON hr.from_operator_id = e.employee_id
       WHERE hr.to_operator_id = ? AND hr.status = 'pending'
       ORDER BY hr.created_at DESC`,
      [operator_id]
    );
    
    res.json(requests);
  } catch (error) {
    console.error("Ошибка получения запросов помощи:", error);
    res.status(500).json({ error: error.message });
  }
});
// ============ ПОЛУЧЕНИЕ ОБРАЩЕНИЙ СОТРУДНИКА ДЛЯ РУКОВОДИТЕЛЯ ============

// Получить обращения конкретного сотрудника (для руководителя)
router.get('/employee-tickets/:employeeId', isOperator, async (req, res) => {
  const { employeeId } = req.params;
  const { start_date, end_date, user_id } = req.query;
  const leaderId = user_id || req.user_id;
  const leaderRole = req.user_role;
  const leaderGroupId = req.user_group_id;
  
  try {
    // Проверяем, что руководитель имеет доступ к этому сотруднику
    const [employee] = await db.query(
      `SELECT group_id, role FROM employees WHERE employee_id = ?`,
      [employeeId]
    );
    
    if (employee.length === 0) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }
    
    let hasAccess = false;
    
    if (leaderRole === 'Администратор') {
      hasAccess = true;
    } else if (leaderRole === 'Руководитель отдела') {
      // Проверяем, что сотрудник в отделе руководителя
      const [deptCheck] = await db.query(
        `SELECT d.department_id 
         FROM work_groups wg
         JOIN departments d ON wg.department_id = d.department_id
         JOIN employees e ON e.group_id = wg.group_id
         JOIN employees leader ON leader.group_id = wg.group_id
         WHERE e.employee_id = ? AND leader.employee_id = ? AND leader.role = 'Руководитель отдела'`,
        [employeeId, leaderId]
      );
      hasAccess = deptCheck.length > 0;
    } else if (leaderRole === 'Руководитель группы') {
      // Проверяем, что сотрудник в той же группе
      hasAccess = employee[0].group_id === leaderGroupId;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Нет доступа к этому сотруднику' });
    }
    
    // Получаем обращения сотрудника
    let query = `
      SELECT t.*,
             CONCAT(c.first_name, ' ', c.last_name) as client_name,
             CONCAT(op.first_name, ' ', op.last_name) as operator_name
      FROM tickets t
      JOIN employees c ON t.client_id = c.employee_id
      LEFT JOIN employees op ON t.operator_id = op.employee_id
      WHERE t.operator_id = ?
    `;
    const params = [employeeId];

    
    query += ` ORDER BY t.created_at DESC LIMIT 200`;
    
    const [rows] = await db.query(query, params);
    res.json(rows);
    
  } catch (error) {
    console.error('Ошибка получения обращений сотрудника:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ КАЛЕНДАРЬ ОПЕРАТОРА ============

// Получить список смен
router.get("/shifts", isOperator, async (req, res) => {
  try {
    const [shifts] = await db.query(`SELECT * FROM work_shifts ORDER BY shift_id`);
    res.json(shifts);
  } catch (error) {
    console.error("Ошибка получения смен:", error);
    res.status(500).json({ error: error.message });
  }
});
// Получить всех операторов группы для календаря
router.get("/schedule/operators", isOperator, async (req, res) => {
  const userId = req.user_id;
  const userRole = req.user_role;
  const userGroupId = req.user_group_id;
  
  try {
    let query = `
      SELECT employee_id, first_name, last_name, role, avatar_url
      FROM employees
      WHERE status = 'Активен'
    `;
    let params = [];
    
    if (userRole !== 'Администратор') {
      query += ` AND group_id = ?`;
      params.push(userGroupId);
    }
    
    query += ` ORDER BY last_name, first_name`;
    
    const [operators] = await db.query(query, params);
    res.json(operators);
  } catch (error) {
    console.error("Ошибка получения операторов:", error);
    res.status(500).json({ error: error.message });
  }
});
// Получить расписание оператора на месяц
// Получить расписание оператора на месяц
router.get("/schedule/:operatorId", isOperator, async (req, res) => {
  const { operatorId } = req.params;
  const { year, month } = req.query;
  const userId = req.user_id;
  const userRole = req.user_role;
  
  console.log("📊 schedule запрос:", { operatorId, year, month });
  
  // Проверка прав
  if (parseInt(operatorId) !== userId && 
      userRole !== 'Руководитель группы' && 
      userRole !== 'Руководитель отдела' && 
      userRole !== 'Администратор') {
    return res.status(403).json({ error: "Нет доступа" });
  }
  
  try {
    let targetYear, targetMonth;
    
    if (!year || !month) {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    } else {
      targetYear = parseInt(year);
      targetMonth = parseInt(month);
    }
    
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    console.log("📊 Диапазон дат:", startDate, "-", endDate);
    console.log("🔍 SQL запрос:", `
  SELECT 
    os.schedule_id,
    os.operator_id,
    os.shift_id,
    DATE(os.schedule_date) as schedule_date,
    os.status,
    ws.shift_name,
    ws.start_time,
    ws.end_time,
    ws.color
  FROM operator_schedule os
  JOIN work_shifts ws ON os.shift_id = ws.shift_id
  WHERE os.operator_id = ${operatorId}
    AND DATE(os.schedule_date) BETWEEN '${startDate}' AND '${endDate}'
`);
    // 👇 ИСПРАВЛЕНИЕ: используем DATE(schedule_date) для сравнения
    const [rows] = await db.query(
      `SELECT 
         os.schedule_id,
         os.operator_id,
         os.shift_id,
         DATE(os.schedule_date) as schedule_date,
         os.status,
         ws.shift_name,
         ws.start_time,
         ws.end_time,
         ws.color
       FROM operator_schedule os
       JOIN work_shifts ws ON os.shift_id = ws.shift_id
       WHERE os.operator_id = ? 
         AND DATE(os.schedule_date) BETWEEN ? AND ?`,
      [operatorId, startDate, endDate]
    );
    
    console.log("📊 Найдено записей в расписании:", rows.length);
    if (rows.length > 0) {
      console.log("📊 Все даты:", rows.map(r => r.schedule_date));
    }
    
    // Форматируем ответ
    const schedule = rows.map(row => ({
      schedule_id: row.schedule_id,
      operator_id: row.operator_id,
      shift_id: row.shift_id,
      schedule_date: row.schedule_date,
      status: row.status,
      shift_name: row.shift_name,
      start_time: row.start_time,
      end_time: row.end_time,
      color: row.color
    }));
    
    res.json({ schedule, vacations: [] });
    
  } catch (error) {
    console.error("❌ Ошибка получения расписания:", error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить расписание (для руководителя)
router.put("/schedule", isOperator, async (req, res) => {
  const { operator_id, schedule_date, shift_id, status } = req.body;
  const userId = req.user_id;
  const userRole = req.user_role;
  
  console.log("📅 Запрос на назначение смены:", { operator_id, schedule_date, shift_id, status });
  
  // Проверка прав
  if (userRole !== 'Руководитель группы' && 
      userRole !== 'Руководитель отдела' && 
      userRole !== 'Администратор') {
    return res.status(403).json({ error: "Нет прав" });
  }
  
  if (!operator_id || !schedule_date || !shift_id) {
    return res.status(400).json({ error: "Не указаны обязательные параметры" });
  }
  
  try {
    // Проверяем, существует ли сотрудник
    const [employee] = await db.query(
      `SELECT employee_id FROM employees WHERE employee_id = ?`,
      [operator_id]
    );
    
    if (employee.length === 0) {
      return res.status(404).json({ error: "Сотрудник не найден" });
    }
    
    // Проверяем, существует ли смена
    const [shift] = await db.query(
      `SELECT shift_id, shift_name FROM work_shifts WHERE shift_id = ?`,
      [shift_id]
    );
    
    if (shift.length === 0) {
      return res.status(404).json({ error: "Смена не найдена" });
    }
    
    // 👇 ИСПРАВЛЕНИЕ: преобразуем строку в объект Date и берем только дату
    const dateOnly = new Date(schedule_date);
    const formattedDate = `${dateOnly.getFullYear()}-${String(dateOnly.getMonth() + 1).padStart(2, '0')}-${String(dateOnly.getDate()).padStart(2, '0')}`;
    
    console.log("📅 Сохраняем дату:", schedule_date, "→", formattedDate);
    
    // Вставляем или обновляем расписание
    const [result] = await db.query(
      `INSERT INTO operator_schedule (operator_id, schedule_date, shift_id, status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         shift_id = VALUES(shift_id), 
         status = VALUES(status),
         updated_at = NOW()`,
      [operator_id, formattedDate, shift_id, status || 'working']
    );
    
    console.log("✅ Смена назначена, результат:", result);
    
    res.json({ 
      success: true, 
      message: `Смена "${shift[0].shift_name}" назначена`,
      shift_id: shift_id
    });
    
  } catch (error) {
    console.error("❌ Ошибка обновления расписания:", error);
    res.status(500).json({ error: error.message });
  }
});
// Получить общую статистику для дашборда чата
router.get("/dashboard-stats", isOperator, async (req, res) => {
  const userGroupId = req.user_group_id;
  
  try {
    // Количество онлайн операторов (активные сессии)
    // Пока заглушка - позже можно связать с active_sessions таблицей
    const onlineOperators = 4;
    
    // Среднее время ответа за последние 7 дней
    const [avgResponse] = await db.query(
      `SELECT AVG(first_response_time_minutes) as avg_time 
       FROM tickets 
       WHERE group_id = ? 
         AND first_response_time_minutes IS NOT NULL
         AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userGroupId]
    );
    
    const avgResponseTime = avgResponse[0]?.avg_time 
      ? `${Math.floor(avgResponse[0].avg_time / 60)}м ${Math.floor(avgResponse[0].avg_time % 60)}с`
      : "—";
    
    // Количество необработанных сообщений (тикеты в статусе new)
    const [queueResult] = await db.query(
      `SELECT COUNT(*) as count 
       FROM tickets 
       WHERE group_id = ? AND status = 'new'`,
      [userGroupId]
    );
    
    const queueMessages = queueResult[0]?.count || 0;
    
    // Статус
    let responseStatus = "Отлично!";
    if (queueMessages > 5) responseStatus = "Есть очередь";
    else if (queueMessages > 0) responseStatus = "Небольшая очередь";
    
    res.json({
      onlineOperators,
      avgResponseTime,
      queueMessages,
      responseStatus
    });
  } catch (error) {
    console.error("Ошибка получения статистики:", error);
    res.json({
      onlineOperators: 4,
      avgResponseTime: "1м 15с",
      queueMessages: 0,
      responseStatus: "Отлично!"
    });
  }
});
// ВРЕМЕННЫЙ ЭНДПОИНТ ДЛЯ ОТЛАДКИ - УДАЛИТЬ ПОТОМ
router.get("/debug-schedule/:operatorId", async (req, res) => {
  const { operatorId } = req.params;
  
  try {
    // 1. Все записи для оператора
    const [allRecords] = await db.query(
      `SELECT * FROM operator_schedule WHERE operator_id = ?`,
      [operatorId]
    );
    
    // 2. Записи с DATE() за май
    const [dateRecords] = await db.query(
      `SELECT 
         schedule_id,
         operator_id,
         schedule_date,
         DATE(schedule_date) as date_only,
         shift_id
       FROM operator_schedule 
       WHERE operator_id = ? 
         AND DATE(schedule_date) BETWEEN '2026-05-01' AND '2026-05-31'`,
      [operatorId]
    );
    
    res.json({
      all_records: allRecords,
      date_records: dateRecords,
      count_all: allRecords.length,
      count_date: dateRecords.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ============ ДНЕВНАЯ НОРМА ============

// Получить текущую информацию о норме для сотрудника
router.get('/quota/my', async (req, res) => {
    const { user_id } = req.query;
    
    if (!user_id) {
        return res.status(400).json({ error: 'Не указан ID сотрудника' });
    }
    
    try {
      console.log('📅 Текущая дата для нормы:', QuotaService.getCurrentQuotaDate());
        const quotaInfo = await QuotaService.getQuotaInfo(parseInt(user_id));
        res.json(quotaInfo);
    } catch (error) {
        console.error('Ошибка получения нормы:', error);
        res.status(500).json({ error: error.message });
    }
});
// Получить обращения сотрудника с фильтрацией по датам (для руководителя)
router.get('/employee-tickets-filtered/:employeeId', isOperator, async (req, res) => {
  const { employeeId } = req.params;
  const { start_date, end_date, user_id, status, limit = 200 } = req.query;
  const leaderId = user_id || req.user_id;
  const leaderRole = req.user_role;
  const leaderGroupId = req.user_group_id;
  
  console.log('📊 ЗАПРОС обращений сотрудника с фильтрацией:', { 
    employeeId, 
    start_date, 
    end_date,
    status,
    leaderRole 
  });
  
  try {
    // 1. Проверяем, что сотрудник существует
    const [employee] = await db.query(
      `SELECT group_id, role, last_name, first_name FROM employees WHERE employee_id = ?`,
      [employeeId]
    );
    
    if (employee.length === 0) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }
    
    // 2. Проверяем права доступа руководителя
    let hasAccess = false;
    
    if (leaderRole === 'Администратор') {
      hasAccess = true;
    } else if (leaderRole === 'Руководитель отдела') {
      const [deptCheck] = await db.query(
        `SELECT d.department_id 
         FROM work_groups wg
         JOIN departments d ON wg.department_id = d.department_id
         JOIN employees e ON e.group_id = wg.group_id
         JOIN employees leader ON leader.group_id = wg.group_id
         WHERE e.employee_id = ? AND leader.employee_id = ? AND leader.role = 'Руководитель отдела'`,
        [employeeId, leaderId]
      );
      hasAccess = deptCheck.length > 0;
    } else if (leaderRole === 'Руководитель группы') {
      hasAccess = employee[0].group_id === leaderGroupId;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Нет доступа к этому сотруднику' });
    }
    
    // 3. Строим запрос с фильтрацией
    let query = `
      SELECT 
        t.ticket_id,
        t.ticket_number,
        t.subject,
        t.description,
        t.status,
        t.priority,
        t.category,
        t.created_at,
        t.closed_at,
        t.resolved_at,
        t.satisfaction_rating,
        t.satisfaction_comment,
        t.resolution_time_minutes,
        t.first_response_time_minutes,
        t.is_first_contact_resolved,
        CONCAT(c.first_name, ' ', c.last_name) as client_name,
        c.avatar_url as client_avatar,
        CONCAT(op.first_name, ' ', op.last_name) as operator_name
      FROM tickets t
      JOIN employees c ON t.client_id = c.employee_id
      LEFT JOIN employees op ON t.operator_id = op.employee_id
      WHERE t.operator_id = ?
    `;
    
    const params = [employeeId];
    
    // Фильтр по дате создания
    if (start_date && end_date) {
      query += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
      console.log(`📅 Фильтр по датам создания: ${start_date} - ${end_date}`);
    }
    
    // Фильтр по статусу
    if (status && status !== 'all') {
      if (status === 'closed_resolved') {
        query += ` AND t.status IN ('closed', 'resolved')`;
      } else {
        query += ` AND t.status = ?`;
        params.push(status);
      }
    }
    
    // Сортировка и лимит
    query += ` ORDER BY t.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    console.log('📡 SQL:', query);
    console.log('📡 Params:', params);
    
    const [rows] = await db.query(query, params);
    
    // 4. Дополнительно получаем статистику за период
    let statsQuery = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN t.status IN ('closed', 'resolved') THEN 1 END) as closed_count,
        AVG(CASE WHEN t.satisfaction_rating IS NOT NULL THEN t.satisfaction_rating END) as avg_rating,
        AVG(CASE WHEN t.resolution_time_minutes IS NOT NULL THEN t.resolution_time_minutes END) as avg_resolution_time,
        AVG(CASE WHEN t.first_response_time_minutes IS NOT NULL THEN t.first_response_time_minutes END) as avg_first_response,
        SUM(CASE WHEN t.is_first_contact_resolved = 1 THEN 1 ELSE 0 END) as fcr_count
      FROM tickets t
      WHERE t.operator_id = ?
    `;
    
    const statsParams = [employeeId];
    
    if (start_date && end_date) {
      statsQuery += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
      statsParams.push(start_date, end_date);
    }
    
    const [stats] = await db.query(statsQuery, statsParams);
    
    console.log(`✅ Найдено обращений: ${rows.length}`);
    
    res.json({
      tickets: rows,
      stats: {
        total_tickets: stats[0]?.total_tickets || 0,
        closed_count: stats[0]?.closed_count || 0,
        avg_rating: stats[0]?.avg_rating ? parseFloat(stats[0].avg_rating).toFixed(1) : 0,
        avg_resolution_time: stats[0]?.avg_resolution_time ? Math.floor(stats[0].avg_resolution_time / 60) : 0,
        avg_first_response: stats[0]?.avg_first_response ? Math.floor(stats[0].avg_first_response) : 0,
        fcr_rate: stats[0]?.total_tickets > 0 
          ? ((stats[0].fcr_count / stats[0].total_tickets) * 100).toFixed(1) 
          : 0
      },
      employee_info: {
        employee_id: employee[0].employee_id,
        last_name: employee[0].last_name,
        first_name: employee[0].first_name,
        role: employee[0].role
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения обращений сотрудника:', error);
    res.status(500).json({ error: error.message });
  }
});
// Получить обращения сотрудника, ЗАКРЫТЫЕ ИЛИ РЕШЁННЫЕ за период
router.get('/employee-tickets-closed/:employeeId', isOperator, async (req, res) => {
  const { employeeId } = req.params;
  const { start_date, end_date, user_id } = req.query;
  const leaderId = user_id || req.user_id;
  const leaderRole = req.user_role;
  const leaderGroupId = req.user_group_id;
  
  console.log('📊 Запрос ЗАКРЫТЫХ/РЕШЁННЫХ обращений сотрудника:', { employeeId, start_date, end_date });
  
  try {
    // Проверка прав доступа
    const [employee] = await db.query(
      `SELECT group_id, role FROM employees WHERE employee_id = ?`,
      [employeeId]
    );
    
    if (employee.length === 0) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }
    
    let hasAccess = false;
    if (leaderRole === 'Администратор') {
      hasAccess = true;
    } else if (leaderRole === 'Руководитель отдела') {
      const [deptCheck] = await db.query(
        `SELECT d.department_id 
         FROM work_groups wg
         JOIN departments d ON wg.department_id = d.department_id
         JOIN employees e ON e.group_id = wg.group_id
         WHERE e.employee_id = ? AND ? IN (SELECT employee_id FROM employees WHERE group_id = wg.group_id AND role = 'Руководитель отдела')`,
        [employeeId, leaderId]
      );
      hasAccess = deptCheck.length > 0;
    } else if (leaderRole === 'Руководитель группы') {
      hasAccess = employee[0].group_id === leaderGroupId;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Нет доступа к этому сотруднику' });
    }
    
    // 👇 СЧИТАЕМ ТИКЕТЫ СО СТАТУСАМИ 'closed' ИЛИ 'resolved'
    let query = `
      SELECT 
        t.ticket_id,
        t.ticket_number,
        t.subject,
        t.description,
        t.status,
        t.priority,
        t.category,
        t.created_at,
        t.closed_at,
        t.resolved_at,
        t.satisfaction_rating,
        t.satisfaction_comment,
        t.resolution_time_minutes,
        t.first_response_time_minutes,
        t.is_first_contact_resolved,
        CONCAT(c.first_name, ' ', c.last_name) as client_name,
        c.avatar_url as client_avatar
      FROM tickets t
      JOIN employees c ON t.client_id = c.employee_id
      WHERE t.operator_id = ?
        AND t.status IN ('closed', 'resolved')
        AND DATE(COALESCE(t.closed_at, t.resolved_at)) BETWEEN ? AND ?
      ORDER BY t.created_at DESC
    `;
    
    const params = [employeeId];
    let start = start_date;
    let end = end_date;
    
    // Если даты не указаны, берём сегодня
    if (!start_date || !end_date) {
      const today = new Date().toISOString().split('T')[0];
      start = today;
      end = today;
    }
    
    params.push(start, end);
    
    console.log('📡 SQL:', query);
    console.log('📡 Params:', params);
    
    const [rows] = await db.query(query, params);
    
    // Считаем статистику
    const totalTickets = rows.length;
    
    // Средняя оценка (только где есть оценка)
    const ratedTickets = rows.filter(t => t.satisfaction_rating && t.satisfaction_rating > 0);
    const avgRating = ratedTickets.length > 0
      ? ratedTickets.reduce((sum, t) => sum + t.satisfaction_rating, 0) / ratedTickets.length
      : 0;
    
    // Среднее время решения (в минутах, переводим в часы для отображения)
    const ticketsWithResolution = rows.filter(t => t.resolution_time_minutes && t.resolution_time_minutes > 0);
    const avgResolutionTime = ticketsWithResolution.length > 0
      ? ticketsWithResolution.reduce((sum, t) => sum + t.resolution_time_minutes, 0) / ticketsWithResolution.length
      : 0;
    
    // FCR (решение с первого контакта)
    const fcrCount = rows.filter(t => t.is_first_contact_resolved === 1).length;
    const fcrRate = totalTickets > 0 ? (fcrCount / totalTickets * 100).toFixed(1) : 0;
    
    // Среднее время первого ответа
    const ticketsWithFirstResponse = rows.filter(t => t.first_response_time_minutes && t.first_response_time_minutes > 0);
    const avgFirstResponse = ticketsWithFirstResponse.length > 0
      ? ticketsWithFirstResponse.reduce((sum, t) => sum + t.first_response_time_minutes, 0) / ticketsWithFirstResponse.length
      : 0;
    
    console.log(`📊 Найдено обращений: ${totalTickets}, сортировка: новые сверху`);
    
    res.json({
      tickets: rows,
      stats: {
        total_tickets: totalTickets,
        avg_rating: avgRating.toFixed(1),
        avg_resolution_time: Math.floor(avgResolutionTime / 60),
        avg_first_response: Math.floor(avgFirstResponse),
        fcr_rate: fcrRate
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения обращений сотрудника:', error);
    res.status(500).json({ error: error.message });
  }
});
export default router;