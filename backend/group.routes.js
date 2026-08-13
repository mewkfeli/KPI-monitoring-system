import express from 'express';
import { db } from './db.js';
import { NotificationService } from './notification.service.js';

const router = express.Router();

// Получение группы руководителя
router.get('/my-group', async (req, res) => {
  try {
    const { employee_id } = req.query;
    
    if (!employee_id) {
      return res.status(400).json({ error: 'Не указан ID сотрудника' });
    }

    // Получаем информацию о группе руководителя
    const [leaderInfo] = await db.query(
      `SELECT g.group_id, g.group_name, d.department_name, ad.direction_name
       FROM employees e
       JOIN work_groups g ON e.group_id = g.group_id
       JOIN departments d ON g.department_id = d.department_id
       JOIN activity_directions ad ON d.direction_id = ad.direction_id
       WHERE e.employee_id = ? AND e.role IN ('Руководитель группы', 'Руководитель отдела')`,
      [employee_id]
    );

    if (leaderInfo.length === 0) {
      return res.status(403).json({ error: 'У вас нет прав руководителя' });
    }

    const groupId = leaderInfo[0].group_id;

    // Получаем всех СОТРУДНИКОВ группы (исключая руководителей)
    const [employees] = await db.query(
      `SELECT employee_id, last_name, first_name, middle_name, role, status, hire_date, avatar_url
       FROM employees 
       WHERE group_id = ? 
         AND status != 'Уволен'
         AND role = 'Сотрудник'  -- 👈 ТОЛЬКО СОТРУДНИКИ
       ORDER BY 
         CASE role 
           WHEN 'Руководитель группы' THEN 1
           WHEN 'Руководитель отдела' THEN 2
           ELSE 3 
         END,
         last_name, first_name`,
      [groupId]
    );

    // Получаем сегодняшние KPI для сотрудников группы
    const today = new Date().toISOString().split('T')[0];
const [todayKpi] = await db.query(
  `SELECT 
     dm.*,

     CONCAT(dm.positive_feedbacks, ' из ', dm.total_feedbacks) as rated_text,

     ROUND(
       CASE 
         WHEN dm.total_feedbacks > 0 
         THEN (dm.positive_feedbacks / dm.total_feedbacks) * 100 
         ELSE 0 
       END, 2
     ) as csat_percentage,

     ROUND(
       CASE 
         WHEN dm.total_requests > 0 
         THEN (dm.first_contact_resolved / dm.total_requests) * 100 
         ELSE 0 
       END, 2
     ) as fcr_percentage

   FROM daily_metrics dm
   WHERE dm.report_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     AND dm.employee_id IN (
       SELECT employee_id 
       FROM employees 
       WHERE group_id = ?
     )
   ORDER BY dm.report_date DESC, dm.employee_id`,
  [groupId]

);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log('Диапазон дат для CSAT:', sevenDaysAgo.toISOString().split('T')[0], 'до', today);
    console.log('Группа ID:', groupId);

    const [weeklyCsat] = await db.query(
      `SELECT 
         DATE(dm.report_date) as date,
         SUM(dm.total_feedbacks) as total_feedbacks_sum,
         SUM(dm.positive_feedbacks) as positive_feedbacks_sum,
         CASE 
           WHEN SUM(dm.total_feedbacks) > 0 
           THEN ROUND((SUM(dm.positive_feedbacks) / SUM(dm.total_feedbacks)) * 100, 2)
           ELSE 0 
         END as avg_csat,
         COUNT(DISTINCT dm.employee_id) as employee_count
       FROM daily_metrics dm
       JOIN employees e ON dm.employee_id = e.employee_id
       WHERE dm.report_date >= ? 
         AND dm.report_date <= ?
         AND e.group_id = ?
         AND dm.verification_status = 'Одобрено'
       GROUP BY DATE(dm.report_date)
       ORDER BY date`,
      [sevenDaysAgo.toISOString().split('T')[0], today, groupId]
    );

    console.log('Результаты weeklyCsat:', weeklyCsat);
    console.log('Количество дней с данными:', weeklyCsat.length);

    // Добавим ручной расчет для отладки
    if (weeklyCsat.length > 0) {
      weeklyCsat.forEach((day, index) => {
        console.log(`День ${index + 1}:`, {
          date: day.date,
          total_feedbacks_sum: day.total_feedbacks_sum,
          positive_feedbacks_sum: day.positive_feedbacks_sum,
          avg_csat: day.avg_csat,
          employee_count: day.employee_count,
          calculated: day.total_feedbacks_sum > 0 ? 
            (day.positive_feedbacks_sum / day.total_feedbacks_sum * 100).toFixed(2) : 0
        });
      });
    }

    // Получаем ожидающие проверки записи
    const [pendingReviews] = await db.query(
      `SELECT 
         dm.record_id,
         dm.employee_id,
         e.last_name,
         e.first_name,
         dm.report_date,
         dm.processed_requests,
         dm.work_minutes,
         dm.positive_feedbacks,
         dm.total_feedbacks,
         dm.first_contact_resolved,
         dm.total_requests,
         dm.quality_score,
         dm.checked_requests,
         CASE 
           WHEN dm.total_feedbacks > 0 THEN ROUND((dm.positive_feedbacks / dm.total_feedbacks) * 100, 2)
           ELSE 0 
         END as csat_percentage,
         CASE 
           WHEN dm.total_requests > 0 THEN ROUND((dm.first_contact_resolved / dm.total_requests) * 100, 2)
           ELSE 0 
         END as fcr_percentage
       FROM daily_metrics dm
       JOIN employees e ON dm.employee_id = e.employee_id
       WHERE dm.verification_status = 'Ожидание'
         AND e.group_id = ?
       ORDER BY dm.report_date DESC, e.last_name, e.first_name`,
      [groupId]
    );

    res.json({
      groupInfo: leaderInfo[0],
      employees,
      todayKpi,
      weeklyCsat,
      pendingReviews
    });

  } catch (error) {
    console.error('Ошибка получения данных группы:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Обновление статуса проверки
router.post('/review-metrics', async (req, res) => {
  try {
    const { record_id, verification_status, reviewer_comment, reviewer_id } = req.body;

    console.log('Получен запрос на проверку:', { record_id, verification_status, reviewer_comment, reviewer_id });

    if (!record_id || !verification_status || !reviewer_id) {
      return res.status(400).json({ 
        error: 'Не указаны обязательные параметры',
        details: `record_id: ${record_id}, verification_status: ${verification_status}, reviewer_id: ${reviewer_id}`
      });
    }

    // Сначала проверяем существование записи
    const [recordCheck] = await db.query(
      `SELECT dm.record_id, dm.employee_id, dm.report_date, dm.processed_requests, dm.work_minutes
       FROM daily_metrics dm 
       WHERE dm.record_id = ?`,
      [record_id]
    );

    if (recordCheck.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    const employeeId = recordCheck[0].employee_id;
    const reportDate = recordCheck[0].report_date;
    const formattedDate = new Date(reportDate).toLocaleDateString('ru-RU');

    // Проверяем, что reviewer является руководителем группы сотрудника
    const [reviewerCheck] = await db.query(
      `SELECT e1.employee_id as reviewer_id, e1.role as reviewer_role, e1.group_id as reviewer_group_id,
              e2.employee_id as target_id, e2.group_id as target_group_id,
              e2.first_name, e2.last_name
       FROM employees e1
       JOIN employees e2 ON e2.employee_id = ?
       WHERE e1.employee_id = ? 
AND e1.role = 'Руководитель группы'
         AND e1.group_id = e2.group_id`,
      [employeeId, reviewer_id]
    );

    console.log('Проверка прав руководителя:', reviewerCheck);

if (reviewerCheck.length === 0) {
  return res.status(403).json({ 
    error: 'У вас нет прав на проверку этой записи',
    details: 'Только руководители групп могут проверять данные'
  });
}

    // Получаем информацию о руководителе для уведомления
    const reviewerInfo = await NotificationService.getEmployeeInfo(reviewer_id);
    const reviewerName = reviewerInfo 
      ? `${reviewerInfo.first_name} ${reviewerInfo.last_name}`
      : 'Руководитель';

    // Обновляем статус проверки
    const updateQuery = `
      UPDATE daily_metrics 
      SET verification_status = ?, 
          reviewer_comment = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE record_id = ?
    `;
    
    console.log('Выполняем запрос:', updateQuery, [verification_status, reviewer_comment || null, record_id]);
    
    const [updateResult] = await db.query(
      updateQuery,
      [verification_status, reviewer_comment || null, record_id]
    );

    console.log('Результат обновления:', updateResult);

    // УВЕДОМЛЕНИЕ ДЛЯ СОТРУДНИКА
    const statusText = verification_status === 'Одобрено' ? 'одобрены' : 'отклонены';
    const statusIcon = verification_status === 'Одобрено' ? '✅' : '❌';
    const notificationType = verification_status === 'Одобрено' ? 'success' : 'error';
    
    let notificationMessage = `${statusIcon} Ваши рабочие показатели за ${formattedDate} ${statusText} руководителем ${reviewerName}.`;
    
    if (reviewer_comment) {
      notificationMessage += `\n\n📝 Комментарий: ${reviewer_comment}`;
    }
    
    // Добавляем информацию о показателях
    notificationMessage += `\n\n📊 Обработано запросов: ${recordCheck[0].processed_requests}`;
    notificationMessage += `\n⏱ Время работы: ${Math.floor(recordCheck[0].work_minutes / 60)}ч ${recordCheck[0].work_minutes % 60}мин`;
    
    console.log('Создаем уведомление для сотрудника:', employeeId, notificationMessage);
    
    await NotificationService.createNotification(
      employeeId,
      `${statusIcon} Данные ${statusText}`,
      notificationMessage,
      notificationType,
      'daily_metrics',
      record_id
    );

    // ДОПОЛНИТЕЛЬНО: если статус "Отклонено", отправляем уведомление другим руководителям
    if (verification_status === 'Отклонено') {
      const otherLeaders = await NotificationService.getGroupLeaders(employeeId);
      for (const leaderId of otherLeaders) {
        if (leaderId !== reviewer_id) {
          await NotificationService.createNotification(
            leaderId,
            "⚠️ Данные отклонены",
            `${reviewerName} отклонил(а) показатели сотрудника за ${formattedDate}. Причина: ${reviewer_comment || 'Не указана'}`,
            "warning",
            'daily_metrics',
            record_id
          );
        }
      }
    }

    res.json({ 
      success: true, 
      message: 'Статус проверки обновлен',
      data: {
        record_id,
        verification_status,
        updated: true
      }
    });

  } catch (error) {
    console.error('Ошибка обновления статуса проверки:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера', 
      details: error.message
    });
  }
});

// Получить рейтинг сотрудников группы
router.get("/leaderboard", async (req, res) => {
  const { group_id, employee_id, period = 'week', limit = 50 } = req.query;

  // Определяем group_id: либо из параметра, либо из группы руководителя
  let targetGroupId = group_id;
  
  if (!targetGroupId && employee_id) {
    // Если не передан group_id, пробуем получить группу текущего пользователя
    const [userGroup] = await db.query(
      `SELECT group_id, role FROM employees WHERE employee_id = ?`,
      [employee_id]
    );
    
    if (userGroup.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }
    
    // Если пользователь - руководитель группы, показываем его группу
    if (userGroup[0].role === 'Руководитель группы') {
      targetGroupId = userGroup[0].group_id;
    } else if (userGroup[0].role === 'Сотрудник') {
      // Сотрудник видит только свою группу
      targetGroupId = userGroup[0].group_id;
    } else {
      return res.status(403).json({ error: "Нет доступа к рейтингу" });
    }
  }

  if (!targetGroupId) {
    return res.status(400).json({ error: "Не указан ID группы" });
  }

  let dateCondition = '';
  const today = new Date();
  
  if (period === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    dateCondition = `AND dm.report_date >= '${weekAgo.toISOString().split('T')[0]}'`;
  } else if (period === 'month') {
    const monthAgo = new Date(today);
    monthAgo.setMonth(today.getMonth() - 1);
    dateCondition = `AND dm.report_date >= '${monthAgo.toISOString().split('T')[0]}'`;
  } else if (period === 'quarter') {
    const quarterAgo = new Date(today);
    quarterAgo.setMonth(today.getMonth() - 3);
    dateCondition = `AND dm.report_date >= '${quarterAgo.toISOString().split('T')[0]}'`;
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        e.employee_id,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.role,
        e.avatar_url,
        COUNT(DISTINCT dm.report_date) as work_days,
        SUM(dm.processed_requests) as total_requests,
        SUM(dm.work_minutes) as total_minutes,
        SUM(dm.positive_feedbacks) as total_positive,
        SUM(dm.total_feedbacks) as total_feedbacks,
        SUM(dm.first_contact_resolved) as total_fcr,
        SUM(dm.total_requests) as total_all_requests,
        AVG(dm.quality_score) as avg_quality,
        CASE 
          WHEN SUM(dm.total_feedbacks) > 0 
          THEN ROUND((SUM(dm.positive_feedbacks) / SUM(dm.total_feedbacks)) * 100, 2)
          ELSE 0 
        END as csat,
        CASE 
          WHEN SUM(dm.total_requests) > 0 
          THEN ROUND((SUM(dm.first_contact_resolved) / SUM(dm.total_requests)) * 100, 2)
          ELSE 0 
        END as fcr,
        CASE 
          WHEN SUM(dm.work_minutes) > 0 
          THEN ROUND(SUM(dm.processed_requests) / (SUM(dm.work_minutes) / 60), 2)
          ELSE 0 
        END as contacts_per_hour
      FROM employees e
      LEFT JOIN daily_metrics dm ON e.employee_id = dm.employee_id AND dm.verification_status = 'Одобрено'
      WHERE e.group_id = ? 
        AND e.status = 'Активен'
        AND e.role = 'Сотрудник'
        ${dateCondition}
      GROUP BY e.employee_id, e.last_name, e.first_name, e.middle_name, e.role
      ORDER BY csat DESC
      LIMIT ?
    `, [targetGroupId, parseInt(limit)]);

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      ...row,
      full_name: `${row.last_name} ${row.first_name} ${row.middle_name || ''}`.trim(),
      avg_quality: row.avg_quality ? parseFloat(row.avg_quality).toFixed(1) : 0,
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error("Ошибка получения рейтинга:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


// ============ УПРАВЛЕНИЕ ОТПУСКАМИ ============

// Отправить сотрудника в отпуск
router.post("/vacation/create", async (req, res) => {
  const { leader_id, employee_id, start_date, end_date } = req.body;

  if (!leader_id || !employee_id || !start_date || !end_date) {
    return res.status(400).json({ error: "Не указаны обязательные параметры" });
  }

  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // Проверяем, что руководитель имеет право управлять этим сотрудником
    const [leaderCheck] = await connection.query(
      `SELECT e1.employee_id, e1.group_id, e1.role
       FROM employees e1
       JOIN employees e2 ON e2.employee_id = ?
       WHERE e1.employee_id = ? 
         AND e1.role IN ('Руководитель группы', 'Руководитель отдела')
         AND (e1.group_id = e2.group_id OR e1.role = 'Руководитель отдела')
         AND e1.status = 'Активен'`,
      [employee_id, leader_id]
    );

    if (leaderCheck.length === 0) {
      await connection.rollback();
      return res.status(403).json({ error: "У вас нет прав для управления отпуском этого сотрудника" });
    }

    // Проверяем, что сотрудник активен
    const [employeeCheck] = await connection.query(
      `SELECT status, last_name, first_name, group_id FROM employees WHERE employee_id = ?`,
      [employee_id]
    );

    if (employeeCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Сотрудник не найден" });
    }

    if (employeeCheck[0].status === 'В отпуске') {
      await connection.rollback();
      return res.status(400).json({ error: "Сотрудник уже находится в отпуске" });
    }

    // ============ ПЕРЕНАЗНАЧЕНИЕ ЗАДАЧ ============
    
    // 1. Находим руководителя группы
    const [groupLeader] = await connection.query(
      `SELECT employee_id FROM employees 
       WHERE group_id = ? AND role = 'Руководитель группы' AND status = 'Активен'
       LIMIT 1`,
      [employeeCheck[0].group_id]
    );
    
    const reassignToId = groupLeader.length > 0 ? groupLeader[0].employee_id : leader_id;
    
    // 2. Получаем список активных задач сотрудника
    const [activeTasks] = await connection.query(
      `SELECT task_id, title FROM tasks 
       WHERE assigned_to = ? AND status IN ('todo', 'in_progress', 'review')`,
      [employee_id]
    );
    
    const reassignedTasks = [];
    
    // 3. Переназначаем каждую задачу (БЕЗ КОЛОНКИ comment)
    for (const task of activeTasks) {
      await connection.query(
        `UPDATE tasks 
         SET assigned_to = ?, 
             updated_at = NOW()
         WHERE task_id = ?`,
        [reassignToId, task.task_id]
      );
      reassignedTasks.push(task.title);
    }
    
    // 4. Создаем запись об отпуске
    await connection.query(
      `INSERT INTO vacations (employee_id, start_date, end_date, created_by) 
       VALUES (?, ?, ?, ?)`,
      [employee_id, start_date, end_date, leader_id]
    );

    // 5. Меняем статус сотрудника
    await connection.query(
      `UPDATE employees SET status = 'В отпуске' WHERE employee_id = ?`,
      [employee_id]
    );

    // Получаем информацию о руководителе
    const [leaderInfo] = await connection.query(
      `SELECT first_name, last_name FROM employees WHERE employee_id = ?`,
      [leader_id]
    );

    const leaderName = `${leaderInfo[0].first_name} ${leaderInfo[0].last_name}`;
    const startDateFormatted = new Date(start_date).toLocaleDateString('ru-RU');
    const endDateFormatted = new Date(end_date).toLocaleDateString('ru-RU');
    
    // 6. Формируем сообщение о переназначенных задачах
    let tasksMessage = '';
    if (reassignedTasks.length > 0) {
      tasksMessage = `\n\n📋 Переназначенные задачи (${reassignedTasks.length}):\n${reassignedTasks.map(t => `  • ${t}`).join('\n')}`;
    }

    // 7. Уведомление сотруднику
    const { NotificationService } = await import('./notification.service.js');
    
    await NotificationService.createNotification(
      employee_id,
      "🏖 Отправление в отпуск",
      `Вы отправлены в отпуск руководителем ${leaderName}.\n\n📅 Период: ${startDateFormatted} - ${endDateFormatted}\n\nВаши активные задачи переданы руководителю.${tasksMessage}\n\nХорошего отдыха!`,
      "info",
      "vacation",
      null
    );
    
    // 8. Уведомление руководителю (если были переназначены задачи)
    if (reassignedTasks.length > 0) {
      await NotificationService.createNotification(
        reassignToId,
        "📋 Задачи переназначены",
        `Сотрудник ${employeeCheck[0].last_name} ${employeeCheck[0].first_name} уходит в отпуск.\n\nЕго активные задачи (${reassignedTasks.length}) переназначены на вас:\n${reassignedTasks.map(t => `  • ${t}`).join('\n')}`,
        "warning",
        "vacation",
        null
      );
    }

    await connection.commit();
    
    let responseMessage = `${employeeCheck[0].last_name} ${employeeCheck[0].first_name} отправлен в отпуск с ${startDateFormatted} по ${endDateFormatted}`;
    if (reassignedTasks.length > 0) {
      responseMessage += `. Переназначено задач: ${reassignedTasks.length}`;
    }
    
    res.json({ 
      success: true, 
      message: responseMessage,
      reassigned_tasks_count: reassignedTasks.length
    });

  } catch (error) {
    await connection.rollback();
    console.error("Ошибка создания отпуска:", error);
    res.status(500).json({ error: "Ошибка сервера", details: error.message });
  } finally {
    connection.release();
  }
});

// Проверить активные задачи сотрудника (перед отправкой в отпуск)
router.get("/vacation/check-tasks", async (req, res) => {
  const { employee_id } = req.query;

  if (!employee_id) {
    return res.status(400).json({ error: "Не указан ID сотрудника" });
  }

  try {
    const [activeTasks] = await db.query(
      `SELECT task_id, title, status, priority, due_date 
       FROM tasks 
       WHERE assigned_to = ? AND status IN ('todo', 'in_progress', 'review')
       ORDER BY FIELD(priority, 'urgent', 'high', 'medium', 'low'), due_date ASC`,
      [employee_id]
    );

    res.json({ 
      has_active_tasks: activeTasks.length > 0,
      tasks: activeTasks,
      count: activeTasks.length
    });
  } catch (error) {
    console.error("Ошибка проверки задач:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Вернуть сотрудника из отпуска
router.post("/vacation/return", async (req, res) => {
  const { leader_id, employee_id } = req.body;

  if (!leader_id || !employee_id) {
    return res.status(400).json({ error: "Не указаны обязательные параметры" });
  }

  try {
    // Проверяем права
    const [leaderCheck] = await db.query(
      `SELECT e1.employee_id, e1.group_id
       FROM employees e1
       JOIN employees e2 ON e2.employee_id = ?
       WHERE e1.employee_id = ? 
         AND e1.role IN ('Руководитель группы', 'Руководитель отдела')
         AND (e1.group_id = e2.group_id OR e1.role = 'Руководитель отдела')
         AND e1.status = 'Активен'`,
      [employee_id, leader_id]
    );

    if (leaderCheck.length === 0) {
      return res.status(403).json({ error: "Нет прав" });
    }

    // Находим активный отпуск
    const [activeVacation] = await db.query(
      `SELECT vacation_id FROM vacations 
       WHERE employee_id = ? AND status = 'active'`,
      [employee_id]
    );

    if (activeVacation.length === 0) {
      return res.status(400).json({ error: "У сотрудника нет активного отпуска" });
    }

    // Завершаем отпуск
    await db.query(
      `UPDATE vacations SET status = 'completed' WHERE vacation_id = ?`,
      [activeVacation[0].vacation_id]
    );

    // Меняем статус сотрудника
    await db.query(
      `UPDATE employees SET status = 'Активен' WHERE employee_id = ?`,
      [employee_id]
    );

    // Уведомление
    await NotificationService.createNotification(
      employee_id,
      "🔄 Возвращение из отпуска",
      "Вы возвращены из отпуска. Добро пожаловать на работу!",
      "info",
      "vacation",
      null
    );

    res.json({ success: true, message: "Сотрудник возвращен из отпуска" });

  } catch (error) {
    console.error("Ошибка возврата из отпуска:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получить информацию об отпуске сотрудника
router.get("/vacation/status", async (req, res) => {
  const { employee_id } = req.query;

  try {
    const [vacation] = await db.query(
      `SELECT v.*, 
              creator.first_name as creator_first_name,
              creator.last_name as creator_last_name
       FROM vacations v
       JOIN employees creator ON v.created_by = creator.employee_id
       WHERE v.employee_id = ? AND v.status = 'active'
       ORDER BY v.created_at DESC 
       LIMIT 1`,
      [employee_id]
    );

    res.json(vacation[0] || null);
  } catch (error) {
    console.error("Ошибка получения статуса отпуска:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});
// ============ ДЛЯ РУКОВОДИТЕЛЯ ОТДЕЛА ============

// Получить все группы отдела для руководителя отдела
router.get("/department-groups", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ error: 'Не указан ID сотрудника' });
  }
  
  try {
    const [dept] = await db.query(
      `SELECT d.department_id 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       JOIN departments d ON wg.department_id = d.department_id
       WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
      [employee_id]
    );
    
    if (dept.length === 0) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    
    const [groups] = await db.query(
      `SELECT wg.group_id, wg.group_name, COUNT(e.employee_id) as employees_count
       FROM work_groups wg
       LEFT JOIN employees e ON wg.group_id = e.group_id 
         AND e.status = 'Активен'
         AND e.role = 'Сотрудник'
       WHERE wg.department_id = ?
       GROUP BY wg.group_id`,
      [dept[0].department_id]
    );
    
    console.log('📊 Группы отдела (активные сотрудники):', groups);
    
    res.json(groups);
  } catch (error) {
    console.error('Ошибка получения групп отдела:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить данные конкретной группы (для руководителя отдела)
router.get("/group-data", async (req, res) => {
  const { group_id, employee_id } = req.query;
  
  console.log('🔍 group-data запрос:', { group_id, employee_id });
  
  if (!group_id) {
    return res.status(400).json({ error: 'Не указан ID группы' });
  }
  
  try {
    // Проверяем, что руководитель отдела имеет доступ к этой группе
    const [access] = await db.query(
      `SELECT d.department_id 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       JOIN departments d ON wg.department_id = d.department_id
       JOIN work_groups wg2 ON wg2.department_id = d.department_id
       WHERE e.employee_id = ? 
         AND e.role = 'Руководитель отдела'
         AND wg2.group_id = ?`,
      [employee_id, group_id]
    );
    
    if (access.length === 0 && employee_id) {
      return res.status(403).json({ error: 'Нет доступа к этой группе' });
    }
    
    // Получаем информацию о группе
    const [groupInfo] = await db.query(
      `SELECT wg.group_id, wg.group_name, d.department_name, ad.direction_name
       FROM work_groups wg
       JOIN departments d ON wg.department_id = d.department_id
       JOIN activity_directions ad ON d.direction_id = ad.direction_id
       WHERE wg.group_id = ?`,
      [group_id]
    );
    
    if (groupInfo.length === 0) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }
    
    // 👇👇👇 ИСПРАВЛЕННЫЙ ЗАПРОС - УБРАЛИ УСЛОВИЕ status != 'В отпуске' 👇👇👇
    const [employees] = await db.query(
      `SELECT employee_id, last_name, first_name, middle_name, role, status, hire_date, avatar_url
       FROM employees 
       WHERE group_id = ? 
         AND status = 'Активен'
         AND role = 'Сотрудник'
       ORDER BY last_name, first_name`,
      [group_id]
    );
    
    console.log(`📊 Группа ${group_id}, найдено сотрудников:`, employees.length);
    console.log('📊 Список сотрудников:', employees.map(e => `${e.last_name} ${e.first_name} (${e.role})`));
    
    // Получаем сегодняшние KPI
    const today = new Date().toISOString().split('T')[0];
    
    // Получаем сегодняшние KPI (ТОЛЬКО ДЛЯ СОТРУДНИКОВ)
    const [todayKpi] = await db.query(
      `SELECT 
         dm.record_id, dm.employee_id, dm.report_date, dm.processed_requests,
         dm.work_minutes, dm.positive_feedbacks, dm.total_feedbacks,
         dm.first_contact_resolved, dm.total_requests, dm.quality_score,
         dm.checked_requests, dm.verification_status, dm.reviewer_comment,
         CASE 
           WHEN dm.total_feedbacks > 0 THEN ROUND((dm.positive_feedbacks / dm.total_feedbacks) * 100, 2)
           ELSE 0 
         END as csat_percentage,
         CASE 
           WHEN dm.total_requests > 0 THEN ROUND((dm.first_contact_resolved / dm.total_requests) * 100, 2)
           ELSE 0 
         END as fcr_percentage
       FROM daily_metrics dm
       WHERE dm.report_date = ? 
         AND dm.employee_id IN (
           SELECT employee_id 
           FROM employees 
           WHERE group_id = ? 
             AND role = 'Сотрудник'
         )`,
      [today, group_id]
    );
    
    // Получаем динамику CSAT за неделю
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const [weeklyCsat] = await db.query(
      `SELECT 
         DATE(dm.report_date) as date,
         SUM(dm.total_feedbacks) as total_feedbacks_sum,
         SUM(dm.positive_feedbacks) as positive_feedbacks_sum,
         CASE 
           WHEN SUM(dm.total_feedbacks) > 0 
           THEN ROUND((SUM(dm.positive_feedbacks) / SUM(dm.total_feedbacks)) * 100, 2)
           ELSE 0 
         END as avg_csat,
         COUNT(DISTINCT dm.employee_id) as employee_count
       FROM daily_metrics dm
       JOIN employees e ON dm.employee_id = e.employee_id
       WHERE dm.report_date >= ? 
         AND dm.report_date <= ?
         AND e.group_id = ?
         AND dm.verification_status = 'Одобрено'
       GROUP BY DATE(dm.report_date)
       ORDER BY date`,
      [sevenDaysAgo.toISOString().split('T')[0], today, group_id]
    );
    
    // Получаем ожидающие проверки записи
    const [pendingReviews] = await db.query(
      `SELECT 
         dm.record_id, dm.employee_id, e.last_name, e.first_name,
         dm.report_date, dm.processed_requests, dm.work_minutes,
         dm.positive_feedbacks, dm.total_feedbacks,
         dm.first_contact_resolved, dm.total_requests, dm.quality_score,
         dm.checked_requests,
         CASE 
           WHEN dm.total_feedbacks > 0 THEN ROUND((dm.positive_feedbacks / dm.total_feedbacks) * 100, 2)
           ELSE 0 
         END as csat_percentage,
         CASE 
           WHEN dm.total_requests > 0 THEN ROUND((dm.first_contact_resolved / dm.total_requests) * 100, 2)
           ELSE 0 
         END as fcr_percentage
       FROM daily_metrics dm
       JOIN employees e ON dm.employee_id = e.employee_id
       WHERE dm.verification_status = 'Ожидание'
         AND e.group_id = ?
       ORDER BY dm.report_date DESC, e.last_name, e.first_name`,
      [group_id]
    );
    
    res.json({
      groupInfo: groupInfo[0],
      employees,
      todayKpi,
      weeklyCsat,
      pendingReviews
    });
    
  } catch (error) {
    console.error('Ошибка получения данных группы:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Сравнение групп отдела
router.get("/groups-comparison", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ error: 'Не указан ID сотрудника' });
  }
  
  try {
    // Получаем отдел руководителя
    const [dept] = await db.query(
      `SELECT d.department_id 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       JOIN departments d ON wg.department_id = d.department_id
       WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
      [employee_id]
    );
    
    if (dept.length === 0) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    
    const [groups] = await db.query(
      `SELECT 
         wg.group_id,
         wg.group_name,
         ROUND(AVG(CASE WHEN dm.total_feedbacks > 0 THEN (dm.positive_feedbacks / dm.total_feedbacks) * 100 ELSE 0 END), 1) as avg_csat,
         ROUND(AVG(CASE WHEN dm.work_minutes > 0 THEN (dm.processed_requests / (dm.work_minutes / 60)) ELSE 0 END), 1) as avg_productivity,
         COUNT(DISTINCT e.employee_id) as employees_count,
         COALESCE(SUM(dm.processed_requests), 0) as total_requests
       FROM work_groups wg
       LEFT JOIN employees e ON wg.group_id = e.group_id AND e.status = 'Активен'
       LEFT JOIN daily_metrics dm ON e.employee_id = dm.employee_id AND dm.verification_status = 'Одобрено' AND dm.report_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       WHERE wg.department_id = ?
       GROUP BY wg.group_id
       ORDER BY avg_csat DESC`,
      [dept[0].department_id]
    );
    
    res.json(groups);
  } catch (error) {
    console.error('Ошибка сравнения групп:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Рейтинг групп отдела - ИСПРАВЛЕННАЯ ВЕРСИЯ
router.get("/groups-leaderboard", async (req, res) => {
  const { employee_id, period = 'week' } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ error: 'Не указан ID сотрудника' });
  }
  
  let dateCondition = '';
  if (period === 'week') {
    dateCondition = `AND dm.report_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
  } else if (period === 'month') {
    dateCondition = `AND dm.report_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
  } else if (period === 'quarter') {
    dateCondition = `AND dm.report_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`;
  }
  
  try {
    // Получаем отдел руководителя
    const [dept] = await db.query(
      `SELECT d.department_id 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       JOIN departments d ON wg.department_id = d.department_id
       WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
      [employee_id]
    );
    
    if (dept.length === 0) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    
    const [groups] = await db.query(`
      SELECT 
        wg.group_id,
        wg.group_name,
        COUNT(DISTINCT e.employee_id) as employees_count,
        COALESCE(SUM(dm.processed_requests), 0) as total_requests,
        -- 👇 ИСПРАВЛЕННЫЙ CSAT: считаем ТОЛЬКО по сотрудникам, у которых есть отзывы
        ROUND(
          CASE 
            WHEN SUM(dm.total_feedbacks) > 0 
            THEN (SUM(dm.positive_feedbacks) / SUM(dm.total_feedbacks)) * 100
            ELSE 0 
          END, 1
        ) as avg_csat,
        -- 👇 ИСПРАВЛЕННАЯ продуктивность
        ROUND(
          CASE 
            WHEN SUM(dm.work_minutes) > 0 
            THEN SUM(dm.processed_requests) / (SUM(dm.work_minutes) / 60)
            ELSE 0 
          END, 1
        ) as avg_productivity
      FROM work_groups wg
      LEFT JOIN employees e ON wg.group_id = e.group_id AND e.status = 'Активен'
      LEFT JOIN daily_metrics dm ON e.employee_id = dm.employee_id 
        AND dm.verification_status = 'Одобрено'
        ${dateCondition}
      WHERE wg.department_id = ?
      GROUP BY wg.group_id
      ORDER BY avg_csat DESC
    `, [dept[0].department_id]);
    
    const leaderboard = groups.map((group, index) => ({
      rank: index + 1,
      ...group
    }));
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Ошибка получения рейтинга групп:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// Получить сотрудников группы
router.get("/group-employees", async (req, res) => {
  const { group_id } = req.query;
  
  if (!group_id) {
    return res.status(400).json({ error: 'Не указан ID группы' });
  }
  
  try {
    const [employees] = await db.query(
      `SELECT employee_id, last_name, first_name, middle_name, role
       FROM employees
       WHERE group_id = ? 
         AND status = 'Активен'
         AND role = 'Сотрудник'
       ORDER BY last_name, first_name`,
      [group_id]
    );
    
    res.json(employees);
  } catch (error) {
    console.error('Ошибка получения сотрудников группы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// Получить KPI статистику для руководителя
router.get("/leader-kpi-stats", async (req, res) => {
  const { employee_id, period = 'month' } = req.query;
  
  try {
    // Получаем группы руководителя
    const [groups] = await db.query(
      `SELECT wg.group_id 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       WHERE e.employee_id = ? AND e.role IN ('Руководитель группы', 'Руководитель отдела')`,
      [employee_id]
    );
    
    const groupIds = groups.map(g => g.group_id);
    if (groupIds.length === 0) {
      return res.json({ avg_csat: 0, avg_fcr: 0, sla_rate: 0, avg_aht: 0 });
    }
    
    const dateCondition = period === 'month' ? `AND report_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)` : '';
    
    // Средние показатели
    const [stats] = await db.query(
      `SELECT 
         ROUND(AVG(CASE WHEN total_feedbacks > 0 THEN (positive_feedbacks / total_feedbacks) * 100 ELSE 0 END), 1) as avg_csat,
         ROUND(AVG(CASE WHEN total_requests > 0 THEN (first_contact_resolved / total_requests) * 100 ELSE 0 END), 1) as avg_fcr
       FROM daily_metrics dm
       JOIN employees e ON dm.employee_id = e.employee_id
       WHERE e.group_id IN (?) AND verification_status = 'Одобрено' ${dateCondition}`,
      [groupIds]
    );
    
    // SLA (доля обращений, обработанных вовремя)
    const [slaStats] = await db.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN sla_status = 'ok' THEN 1 ELSE 0 END) as on_time
       FROM tickets t
       WHERE t.group_id IN (?) AND t.status IN ('closed', 'resolved')`,
      [groupIds]
    );
    
    const slaRate = slaStats[0]?.total > 0 ? Math.round((slaStats[0].on_time / slaStats[0].total) * 100) : 0;
    
    // Недельный тренд
    const [weeklyTrend] = await db.query(
      `SELECT 
         DATE(report_date) as date,
         ROUND(AVG(CASE WHEN total_feedbacks > 0 THEN (positive_feedbacks / total_feedbacks) * 100 ELSE 0 END), 1) as csat,
         ROUND(AVG(CASE WHEN total_requests > 0 THEN (first_contact_resolved / total_requests) * 100 ELSE 0 END), 1) as fcr
       FROM daily_metrics dm
       JOIN employees e ON dm.employee_id = e.employee_id
       WHERE e.group_id IN (?) AND verification_status = 'Одобрено' AND report_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(report_date)`,
      [groupIds]
    );
    
    res.json({
      avg_csat: stats[0]?.avg_csat || 0,
      avg_fcr: stats[0]?.avg_fcr || 0,
      sla_rate: slaRate,
      avg_aht: stats[0]?.avg_aht || 0,
      weekly_trend: weeklyTrend,
      critical_events: [] // Можно доба позже
    });
  } catch (error) {
    console.error('Ошибка получения KPI статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// Получить всех сотрудников отдела (для руководителя отдела)
router.get("/department-employees", async (req, res) => {
  const { employee_id } = req.query;
  
  try {
    // Получаем отдел руководителя
    const [dept] = await db.query(
      `SELECT d.department_id 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       JOIN departments d ON wg.department_id = d.department_id
       WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
      [employee_id]
    );
    
    if (dept.length === 0) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    
    // Получаем ВСЕХ сотрудников отдела (без фильтра по статусу)
    const [employees] = await db.query(
      `SELECT e.employee_id, e.last_name, e.first_name, e.middle_name, e.role, e.status, e.avatar_url, wg.group_name
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       WHERE wg.department_id = ?
       ORDER BY 
         CASE e.role 
           WHEN 'Руководитель отдела' THEN 1
           WHEN 'Руководитель группы' THEN 2
           ELSE 3
         END,
         e.last_name`,
      [dept[0].department_id]
    );
    
    res.json(employees);
  } catch (error) {
    console.error('Ошибка получения сотрудников отдела:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// backend/group.routes.js - добавьте этот эндпоинт

// Проверка доступа руководителя к сотруднику
router.get('/employee-access', async (req, res) => {
  const { leader_id, employee_id } = req.query;
  
  try {
    const [leader] = await db.query(
      `SELECT role, group_id FROM employees WHERE employee_id = ?`,
      [leader_id]
    );
    
    const [employee] = await db.query(
      `SELECT group_id FROM employees WHERE employee_id = ?`,
      [employee_id]
    );
    
    if (leader.length === 0 || employee.length === 0) {
      return res.json({ hasAccess: false });
    }
    
    let hasAccess = false;
    
    if (leader[0].role === 'Администратор') {
      hasAccess = true;
    } else if (leader[0].role === 'Руководитель отдела') {
      // Проверка по отделу
      const [deptCheck] = await db.query(
        `SELECT d.department_id 
         FROM work_groups wg
         JOIN departments d ON wg.department_id = d.department_id
         WHERE wg.group_id IN (?, ?) 
         GROUP BY d.department_id
         HAVING COUNT(DISTINCT wg.group_id) = 2`,
        [leader[0].group_id, employee[0].group_id]
      );
      hasAccess = deptCheck.length > 0;
    } else if (leader[0].role === 'Руководитель группы') {
      hasAccess = leader[0].group_id === employee[0].group_id;
    }
    
    res.json({ hasAccess });
  } catch (error) {
    console.error('Ошибка проверки доступа:', error);
    res.json({ hasAccess: false });
  }
});
// Получить рейтинг сотрудников отдела (для руководителя отдела)
// Получить рейтинг сотрудников отдела (для руководителя отдела)
router.get("/leaderboard/department", async (req, res) => {
  const { employee_id, period = 'week', limit = 100 } = req.query;

  console.log('📊 Запрос рейтинга отдела:', { employee_id, period, limit });

  if (!employee_id) {
    return res.status(400).json({ error: "Не указан ID сотрудника" });
  }

  try {
    // Проверяем, что пользователь - руководитель отдела и получаем его department_id
    const [leader] = await db.query(
      `SELECT e.role, d.department_id 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       JOIN departments d ON wg.department_id = d.department_id
       WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
      [employee_id]
    );

    console.log('👤 Проверка роли:', leader[0]);

    if (leader.length === 0) {
      return res.status(403).json({ error: "Нет доступа. Только для руководителей отдела" });
    }

    const department_id = leader[0].department_id;
    console.log('📁 ID отдела:', department_id);

    let dateCondition = '';
    const today = new Date();
    
    if (period === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      dateCondition = `AND dm.report_date >= '${weekAgo.toISOString().split('T')[0]}'`;
    } else if (period === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      dateCondition = `AND dm.report_date >= '${monthAgo.toISOString().split('T')[0]}'`;
    } else if (period === 'quarter') {
      const quarterAgo = new Date(today);
      quarterAgo.setMonth(today.getMonth() - 3);
      dateCondition = `AND dm.report_date >= '${quarterAgo.toISOString().split('T')[0]}'`;
    }

    // Получаем ВСЕХ СОТРУДНИКОВ (не руководителей) из ВСЕХ групп отдела
    const [rows] = await db.query(`
      SELECT 
        e.employee_id,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.role,
        e.avatar_url,
        wg.group_name,
        COUNT(DISTINCT dm.report_date) as work_days,
        SUM(dm.processed_requests) as total_requests,
        SUM(dm.work_minutes) as total_minutes,
        SUM(dm.positive_feedbacks) as total_positive,
        SUM(dm.total_feedbacks) as total_feedbacks,
        SUM(dm.first_contact_resolved) as total_fcr,
        SUM(dm.total_requests) as total_all_requests,
        AVG(dm.quality_score) as avg_quality,
        CASE 
          WHEN SUM(dm.total_feedbacks) > 0 
          THEN ROUND((SUM(dm.positive_feedbacks) / SUM(dm.total_feedbacks)) * 100, 2)
          ELSE 0 
        END as csat,
        CASE 
          WHEN SUM(dm.total_requests) > 0 
          THEN ROUND((SUM(dm.first_contact_resolved) / SUM(dm.total_requests)) * 100, 2)
          ELSE 0 
        END as fcr,
        CASE 
          WHEN SUM(dm.work_minutes) > 0 
          THEN ROUND(SUM(dm.processed_requests) / (SUM(dm.work_minutes) / 60), 2)
          ELSE 0 
        END as contacts_per_hour
      FROM employees e
      JOIN work_groups wg ON e.group_id = wg.group_id
      LEFT JOIN daily_metrics dm ON e.employee_id = dm.employee_id AND dm.verification_status = 'Одобрено'
      WHERE wg.department_id = ?
        AND e.status = 'Активен'
        AND e.role = 'Сотрудник'  -- ТОЛЬКО СОТРУДНИКИ, не руководители
        ${dateCondition}
      GROUP BY e.employee_id, e.last_name, e.first_name, e.middle_name, e.role, wg.group_name
      ORDER BY csat DESC
      LIMIT ?
    `, [department_id, parseInt(limit)]);

    console.log(`✅ Найдено сотрудников: ${rows.length}`);

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      ...row,
      full_name: `${row.last_name} ${row.first_name} ${row.middle_name || ''}`.trim(),
      avg_quality: row.avg_quality ? parseFloat(row.avg_quality).toFixed(1) : 0,
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error("❌ Ошибка получения рейтинга отдела:", error);
    res.status(500).json({ error: "Ошибка сервера", details: error.message });
  }
});
// Получить рейтинг СОТРУДНИКОВ отдела (для руководителя отдела)
router.get("/leaderboard/department", async (req, res) => {
  const { employee_id, period = 'week', limit = 100 } = req.query;

  console.log('📊 Запрос рейтинга сотрудников отдела:', { employee_id, period, limit });

  if (!employee_id) {
    return res.status(400).json({ error: "Не указан ID сотрудника" });
  }

  try {
    // Проверяем, что пользователь - руководитель отдела и получаем его отдел
    const [leader] = await db.query(
      `SELECT e.role, d.department_id 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       JOIN departments d ON wg.department_id = d.department_id
       WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
      [employee_id]
    );

    console.log('👤 Проверка роли:', leader[0]);

    if (leader.length === 0) {
      return res.status(403).json({ error: "Нет доступа. Только для руководителей отдела" });
    }

    const department_id = leader[0].department_id;
    console.log('📁 ID отдела:', department_id);

    let dateCondition = '';
    const today = new Date();
    
    if (period === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      dateCondition = `AND dm.report_date >= '${weekAgo.toISOString().split('T')[0]}'`;
    } else if (period === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      dateCondition = `AND dm.report_date >= '${monthAgo.toISOString().split('T')[0]}'`;
    } else if (period === 'quarter') {
      const quarterAgo = new Date(today);
      quarterAgo.setMonth(today.getMonth() - 3);
      dateCondition = `AND dm.report_date >= '${quarterAgo.toISOString().split('T')[0]}'`;
    }

    // Получаем ВСЕХ СОТРУДНИКОВ отдела (только роль 'Сотрудник')
    const query = `
      SELECT 
        e.employee_id,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.role,
        e.avatar_url,
        wg.group_name,
        COUNT(DISTINCT dm.report_date) as work_days,
        COALESCE(SUM(dm.processed_requests), 0) as total_requests,
        COALESCE(SUM(dm.work_minutes), 0) as total_minutes,
        COALESCE(SUM(dm.positive_feedbacks), 0) as total_positive,
        COALESCE(SUM(dm.total_feedbacks), 0) as total_feedbacks,
        COALESCE(SUM(dm.first_contact_resolved), 0) as total_fcr,
        ROUND(AVG(dm.quality_score), 1) as avg_quality,
        CASE 
          WHEN COALESCE(SUM(dm.total_feedbacks), 0) > 0 
          THEN ROUND((COALESCE(SUM(dm.positive_feedbacks), 0) / COALESCE(SUM(dm.total_feedbacks), 0)) * 100, 1)
          ELSE 0 
        END as csat,
        CASE 
          WHEN COALESCE(SUM(dm.total_requests), 0) > 0 
          THEN ROUND((COALESCE(SUM(dm.first_contact_resolved), 0) / COALESCE(SUM(dm.total_requests), 0)) * 100, 1)
          ELSE 0 
        END as fcr,
        CASE 
          WHEN COALESCE(SUM(dm.work_minutes), 0) > 0 
          THEN ROUND(COALESCE(SUM(dm.processed_requests), 0) / (COALESCE(SUM(dm.work_minutes), 0) / 60), 1)
          ELSE 0 
        END as contacts_per_hour
      FROM employees e
      JOIN work_groups wg ON e.group_id = wg.group_id
      LEFT JOIN daily_metrics dm ON e.employee_id = dm.employee_id 
        AND dm.verification_status = 'Одобрено'
        ${dateCondition}
      WHERE wg.department_id = ?
        AND e.status = 'Активен'
        AND e.role = 'Сотрудник'
      GROUP BY e.employee_id, e.last_name, e.first_name, e.middle_name, e.role, wg.group_name
      ORDER BY csat DESC
      LIMIT ?
    `;

    console.log('🔍 SQL запрос:', query);
    console.log('📊 Параметры:', [department_id, parseInt(limit)]);

    const [rows] = await db.query(query, [department_id, parseInt(limit)]);

    console.log(`✅ Найдено сотрудников: ${rows.length}`);

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      ...row,
      full_name: `${row.last_name} ${row.first_name} ${row.middle_name || ''}`.trim(),
      avg_quality: row.avg_quality || 0,
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error("❌ Ошибка получения рейтинга сотрудников отдела:", error);
    res.status(500).json({ error: "Ошибка сервера", details: error.message });
  }
});
router.get("/debug-employees", async (req, res) => {
  const { group_id } = req.query;
  
  try {
    // Проверка 1: Все сотрудники группы (активные)
    const [allActive] = await db.query(
      `SELECT employee_id, last_name, first_name, role, status
       FROM employees 
       WHERE group_id = ? AND status = 'Активен'`,
      [group_id]
    );
    
    // Проверка 2: Только сотрудники (роль = 'Сотрудник')
    const [onlyEmployees] = await db.query(
      `SELECT employee_id, last_name, first_name, role, status
       FROM employees 
       WHERE group_id = ? AND status = 'Активен' AND role = 'Сотрудник'`,
      [group_id]
    );
    
    // Проверка 3: Что возвращает эндпоинт group-data
    const [groupDataResult] = await db.query(
      `SELECT employee_id, last_name, first_name, role, status
       FROM employees 
       WHERE group_id = ? 
         AND status = 'Активен'
         AND role = 'Сотрудник'
       ORDER BY last_name, first_name`,
      [group_id]
    );
    
    res.json({
      group_id,
      all_active_count: allActive.length,
      all_active: allActive,
      only_employees_count: onlyEmployees.length,
      only_employees: onlyEmployees,
      group_data_count: groupDataResult.length,
      group_data: groupDataResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Получить KPI для группы за конкретную дату
router.get("/group-kpi-by-date", async (req, res) => {
  const { group_id, date, employee_id } = req.query;
  
  if (!group_id || !date) {
    return res.status(400).json({ error: "Не указаны group_id или date" });
  }
  
  try {
    // Проверяем права доступа (если передан employee_id)
    if (employee_id) {
      const [access] = await db.query(
        `SELECT role, group_id FROM employees WHERE employee_id = ?`,
        [employee_id]
      );
      
      if (access.length > 0 && access[0].role !== 'Администратор') {
        // Проверяем, что пользователь имеет доступ к группе
        if (access[0].role === 'Руководитель отдела') {
          const [deptCheck] = await db.query(
            `SELECT d.department_id 
             FROM work_groups wg
             JOIN departments d ON wg.department_id = d.department_id
             JOIN employees e ON e.group_id = wg.group_id
             WHERE wg.group_id = ? AND e.employee_id = ?`,
            [group_id, employee_id]
          );
          if (deptCheck.length === 0) {
            return res.status(403).json({ error: "Нет доступа" });
          }
        } else if (access[0].group_id != group_id && access[0].role !== 'Администратор') {
          return res.status(403).json({ error: "Нет доступа" });
        }
      }
    }
    
    // Получаем KPI за указанную дату
    const [kpiData] = await db.query(
      `SELECT 
         dm.*,
         ROUND(CASE WHEN dm.total_feedbacks > 0 THEN (dm.positive_feedbacks / dm.total_feedbacks) * 100 ELSE 0 END, 1) as csat_percentage,
         ROUND(CASE WHEN dm.total_requests > 0 THEN (dm.first_contact_resolved / dm.total_requests) * 100 ELSE 0 END, 1) as fcr_percentage,
         ROUND(CASE WHEN dm.work_minutes > 0 THEN dm.processed_requests / (dm.work_minutes / 60) ELSE 0 END, 1) as productivity
       FROM daily_metrics dm
       WHERE dm.report_date = ? 
         AND dm.employee_id IN (SELECT employee_id FROM employees WHERE group_id = ? AND role = 'Сотрудник')
       ORDER BY dm.employee_id`,
      [date, group_id]
    );
    
    res.json(kpiData);
  } catch (error) {
    console.error("Ошибка получения KPI по дате:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});
// Получить KPI за сегодня из реальных обращений
// backend/group.routes.js - исправленный эндпоинт /today-kpi

router.get('/today-kpi', async (req, res) => {
    const { group_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log('📊 today-kpi запрос:', { group_id, targetDate });
    
    try {
        const [stats] = await db.query(
            `SELECT 
                e.employee_id,
                CONCAT(e.last_name, ' ', e.first_name) as employee_name,
                e.avatar_url,
                -- 👇 СЧИТАЕМ И closed, И resolved (ВСЕ обработанные)
                COUNT(CASE WHEN t.status IN ('closed', 'resolved') THEN 1 END) as closed_today,
                -- Количество оценок
                COUNT(CASE WHEN t.satisfaction_rating IS NOT NULL THEN 1 END) as reviews_count,
                -- CSAT
                CASE 
                    WHEN COUNT(CASE WHEN t.satisfaction_rating IS NOT NULL THEN 1 END) > 0
                    THEN ROUND(
                        SUM(CASE WHEN t.satisfaction_rating >= 4 THEN 1 ELSE 0 END) * 100.0 / 
                        COUNT(CASE WHEN t.satisfaction_rating IS NOT NULL THEN 1 END), 1
                    )
                    ELSE 0
                END as csat,
                -- FCR
                CASE 
                    WHEN COUNT(t.ticket_id) > 0
                    THEN ROUND(SUM(CASE WHEN t.is_first_contact_resolved = 1 THEN 1 ELSE 0 END) * 100.0 / 
                         COUNT(t.ticket_id), 1)
                    ELSE 0
                END as fcr,
                -- Средняя оценка
                ROUND(AVG(t.satisfaction_rating), 1) as avg_quality
             FROM employees e
             LEFT JOIN tickets t ON e.employee_id = t.operator_id
                AND t.status IN ('closed', 'resolved')
                AND DATE(COALESCE(t.closed_at, t.resolved_at)) = ?
             WHERE e.group_id = ? 
               AND e.role = 'Сотрудник'
               AND e.status = 'Активен'
             GROUP BY e.employee_id, e.last_name, e.first_name, e.avatar_url`,
            [targetDate, group_id]
        );
        
        const dailyNorm = 20;
        
        const result = stats.map(row => ({
            employee_id: row.employee_id,
            employee_name: row.employee_name,
            avatar_url: row.avatar_url,
            closed_today: row.closed_today || 0,
            avg_quality: row.avg_quality || 0,
            csat: row.csat || 0,
            csat_reviews_count: row.reviews_count || 0,
            fcr: row.fcr || 0,
            productivity: row.closed_today ? (row.closed_today / 8).toFixed(2) : 0,
            daily_norm: dailyNorm,
            daily_progress: `${row.closed_today || 0}/${dailyNorm}`
        }));
        
        console.log('📊 today-kpi результат:', result);
        res.json(result);
    } catch (error) {
        console.error('Ошибка today-kpi:', error);
        res.status(500).json({ error: error.message });
    }
});
export default router;