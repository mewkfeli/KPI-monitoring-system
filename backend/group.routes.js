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

    // Получаем всех сотрудников группы
    const [employees] = await db.query(
      `SELECT employee_id, last_name, first_name, middle_name, role, status, hire_date
       FROM employees 
       WHERE group_id = ? AND status != 'Уволен'
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
         dm.record_id,
         dm.employee_id,
         dm.report_date,
         dm.processed_requests,
         dm.work_minutes,
         dm.positive_feedbacks,
         dm.total_feedbacks,
         dm.first_contact_resolved,
         dm.total_requests,
         dm.quality_score,
         dm.checked_requests,
         dm.verification_status,
         dm.reviewer_comment,
         CASE 
           WHEN dm.total_feedbacks > 0 THEN ROUND((dm.positive_feedbacks / dm.total_feedbacks) * 100, 2)
           ELSE 0 
         END as csat_percentage,
         CASE 
           WHEN dm.total_requests > 0 THEN ROUND((dm.first_contact_resolved / dm.total_requests) * 100, 2)
           ELSE 0 
         END as fcr_percentage,
         CASE 
           WHEN dm.work_minutes > 0 THEN ROUND(dm.processed_requests / (dm.work_minutes / 60), 2)
           ELSE 0 
         END as productivity,
         CASE 
           WHEN dm.checked_requests > 0 THEN ROUND(dm.quality_score / dm.checked_requests, 2)
           ELSE 0 
         END as avg_quality
       FROM daily_metrics dm
       WHERE dm.report_date = ? 
         AND dm.employee_id IN (
           SELECT employee_id 
           FROM employees 
           WHERE group_id = ?
         )
       ORDER BY dm.employee_id`,
      [today, groupId]
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
  const { group_id, period = 'week', limit = 50 } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: "Не указан ID группы" });
  }

  // Определяем период
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
    // Получаем агрегированные данные по сотрудникам группы
    const [rows] = await db.query(`
      SELECT 
        e.employee_id,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.role,
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
      WHERE e.group_id = ? AND e.status = 'Активен' ${dateCondition}
      GROUP BY e.employee_id, e.last_name, e.first_name, e.middle_name, e.role
      ORDER BY csat DESC
      LIMIT ?
    `, [group_id, parseInt(limit)]);

    // Добавляем места
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

// Получить рейтинг по всем группам отдела (для руководителя отдела)
router.get("/leaderboard/department", async (req, res) => {
  const { department_id, period = 'week', limit = 100 } = req.query;

  if (!department_id) {
    return res.status(400).json({ error: "Не указан ID отдела" });
  }

  const today = new Date();
  let dateCondition = '';
  
  if (period === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    dateCondition = `AND dm.report_date >= '${weekAgo.toISOString().split('T')[0]}'`;
  } else if (period === 'month') {
    const monthAgo = new Date(today);
    monthAgo.setMonth(today.getMonth() - 1);
    dateCondition = `AND dm.report_date >= '${monthAgo.toISOString().split('T')[0]}'`;
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        e.employee_id,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.role,
        wg.group_name,
        SUM(dm.processed_requests) as total_requests,
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
      WHERE wg.department_id = ? AND e.status = 'Активен' ${dateCondition}
      GROUP BY e.employee_id, e.last_name, e.first_name, e.middle_name, e.role, wg.group_name
      ORDER BY csat DESC
      LIMIT ?
    `, [department_id, parseInt(limit)]);

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      ...row,
      full_name: `${row.last_name} ${row.first_name} ${row.middle_name || ''}`.trim(),
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error("Ошибка получения рейтинга отдела:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;