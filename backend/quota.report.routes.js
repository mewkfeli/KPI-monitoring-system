// backend/routes/quota.report.routes.js
import express from 'express';
import { db } from './db.js';
import XLSX from 'xlsx';
import { QuotaService } from './quota.service.js';
const router = express.Router();

// Middleware для проверки прав руководителя
const isLeader = async (req, res, next) => {
  const userId = req.headers['user-id'] || req.query.user_id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  
  try {
    const [rows] = await db.query(
      `SELECT role FROM employees WHERE employee_id = ? AND status = 'Активен'`,
      [userId]
    );
    
    if (rows.length === 0 || 
        (rows[0].role !== 'Руководитель группы' && 
         rows[0].role !== 'Руководитель отдела' && 
         rows[0].role !== 'Администратор')) {
      return res.status(403).json({ error: 'Нет прав доступа' });
    }
    
    req.userId = parseInt(userId);
    req.userRole = rows[0].role;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Ошибка проверки прав' });
  }
};

// Получить данные для отчёта по норме
// Получить данные для отчёта по норме
router.get('/quota-report-data', isLeader, async (req, res) => {
  const { group_id, month, year } = req.query;
  const userId = req.userId;
  const userRole = req.userRole;
  
  console.log('📊 Параметры запроса:', { group_id, month, year });
  
  // Проверяем, что месяц и год переданы
  if (!month || !year) {
    return res.status(400).json({ error: 'Не указан месяц или год' });
  }
  
  // Определяем рабочие дни в месяце
const getWorkingDays = (year, month) => {
  const date = new Date(year, month - 1, 1);
  let workingDays = 0;
  while (date.getMonth() === month - 1) {
    const dayOfWeek = date.getDay();
    // Пн=1, Вт=2, Ср=3, Чт=4, Пт=5, Сб=6, Вс=0
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    date.setDate(date.getDate() + 1);
  }
  return workingDays;
};
  const workingDays = getWorkingDays(parseInt(year), parseInt(month));
  const dailyNorm = 20;
  const monthlyNorm = dailyNorm * workingDays;
  
  try {
    let groupIds = [];
    
    if (group_id) {
      groupIds = [parseInt(group_id)];
    } else if (userRole === 'Руководитель отдела') {
      const [groups] = await db.query(
        `SELECT wg.group_id 
         FROM work_groups wg
         JOIN employees e ON e.group_id = wg.group_id
         WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
        [userId]
      );
      groupIds = groups.map(g => g.group_id);
    } else if (userRole === 'Руководитель группы') {
      const [group] = await db.query(
        `SELECT group_id FROM employees WHERE employee_id = ?`,
        [userId]
      );
      if (group.length > 0) groupIds = [group[0].group_id];
    }
    
    if (groupIds.length === 0) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }
    
    console.log('📊 Группы:', groupIds);
    console.log('📊 Месяц/год:', month, year);
    
    // Получаем данные по сотрудникам за ВЫБРАННЫЙ месяц
    const [employees] = await db.query(`
      SELECT 
        e.employee_id,
        e.last_name,
        e.first_name,
        e.middle_name,
        e.role,
        wg.group_name,
        COUNT(DISTINCT DATE(t.closed_at)) as work_days,
        COUNT(t.ticket_id) as closed_count,
        ROUND(AVG(t.satisfaction_rating), 1) as avg_rating,
        SUM(CASE WHEN t.satisfaction_rating >= 4 THEN 1 ELSE 0 END) as positive_reviews,
        COUNT(CASE WHEN t.satisfaction_rating IS NOT NULL THEN 1 END) as total_reviews
      FROM employees e
      JOIN work_groups wg ON e.group_id = wg.group_id
      LEFT JOIN tickets t ON e.employee_id = t.operator_id 
        AND t.status = 'closed'
        AND MONTH(t.closed_at) = ?
        AND YEAR(t.closed_at) = ?
      WHERE e.group_id IN (${groupIds.map(() => '?').join(',')})
        AND e.status = 'Активен'
        AND e.role = 'Сотрудник'
      GROUP BY e.employee_id
      ORDER BY closed_count DESC
    `, [parseInt(month), parseInt(year), ...groupIds]);
    
    console.log('📊 Найдено сотрудников:', employees.length);
    
    const reportData = employees.map(emp => {
  const closedCount = emp.closed_count || 0;
  const dailyNorm = 20;
  const monthlyNorm = dailyNorm * workingDays;  // workingDays теперь 20, а не 21
  
  // Расчёт процентов
  const monthlyProgressPercent = monthlyNorm > 0 ? (closedCount / monthlyNorm * 100).toFixed(1) : 0;
  const dailyProgressPercent = (closedCount / dailyNorm) * 100;
  
  const csat = emp.total_reviews > 0 
    ? (emp.positive_reviews / emp.total_reviews * 100).toFixed(1) 
    : 0;
  
  let status = '❌ Не выполнена';
  if (closedCount >= monthlyNorm) {
    status = '✅ Выполнена';
  } else if (closedCount >= monthlyNorm * 0.8) {
    status = '⚠️ Почти выполнена';
  }
  
  return {
    'ФИО': `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim(),
    'Группа': emp.group_name,
    'Рабочих дней': emp.work_days || 0,
    'Закрыто обращений': closedCount,
    'Норма за месяц': monthlyNorm,
    'Выполнение %': parseFloat(monthlyProgressPercent),
    'Дневная норма %': `${((closedCount / 20) * 100).toFixed(0)}%`,
    'Статус': status,
    'Средняя оценка': emp.avg_rating || 0,
    'CSAT %': parseFloat(csat)
  };
});
    
    const totalEmployees = reportData.length;
    const totalClosed = reportData.reduce((sum, e) => sum + e['Закрыто обращений'], 0);
    const avgQuotaPercent = totalEmployees > 0 
      ? (reportData.reduce((sum, e) => sum + e['Выполнение %'], 0) / totalEmployees).toFixed(1)
      : 0;
    const completedCount = reportData.filter(e => e['Закрыто обращений'] >= monthlyNorm).length;
    
    res.json({
      reportData,
      summary: {
        month: `${month}.${year}`,
        workingDays,
        dailyNorm,
        monthlyNorm,
        totalEmployees,
        totalClosed,
        avgQuotaPercent: parseFloat(avgQuotaPercent),
        completedCount,
        completionRate: totalEmployees > 0 ? (completedCount / totalEmployees * 100).toFixed(1) : 0
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения данных для отчёта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// Экспорт в Excel
router.get('/export-quota-report', isLeader, async (req, res) => {
  const { group_id, month, year } = req.query;
  const userId = req.userId;
  const userRole = req.userRole;
  
  const getWorkingDays = (year, month) => {
    const date = new Date(year, month - 1, 1);
    let workingDays = 0;
    while (date.getMonth() === month - 1) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      date.setDate(date.getDate() + 1);
    }
    return workingDays;
  };
  
  const workingDays = getWorkingDays(parseInt(year), parseInt(month));
  const dailyNorm = 20;
  const monthlyNorm = dailyNorm * workingDays;
  
  try {
    let groupIds = [];
    let groupName = 'Все группы';
    
    if (group_id) {
      groupIds = [parseInt(group_id)];
      const [group] = await db.query(`SELECT group_name FROM work_groups WHERE group_id = ?`, [group_id]);
      if (group.length > 0) groupName = group[0].group_name;
    } else if (userRole === 'Руководитель отдела') {
      const [groups] = await db.query(
        `SELECT wg.group_id, wg.group_name
         FROM work_groups wg
         JOIN employees e ON e.group_id = wg.group_id
         WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
        [userId]
      );
      groupIds = groups.map(g => g.group_id);
      groupName = 'Все группы отдела';
    } else if (userRole === 'Руководитель группы') {
      const [group] = await db.query(
        `SELECT group_id, wg.group_name
         FROM employees e
         JOIN work_groups wg ON e.group_id = wg.group_id
         WHERE e.employee_id = ?`,
        [userId]
      );
      if (group.length > 0) {
        groupIds = [group[0].group_id];
        groupName = group[0].group_name;
      }
    }
    
    if (groupIds.length === 0) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }
    
    const [employees] = await db.query(`
      SELECT 
        e.last_name,
        e.first_name,
        e.middle_name,
        wg.group_name,
        COUNT(DISTINCT DATE(t.closed_at)) as work_days,
        COUNT(t.ticket_id) as closed_count,
        ROUND(AVG(t.satisfaction_rating), 1) as avg_rating,
        SUM(CASE WHEN t.satisfaction_rating >= 4 THEN 1 ELSE 0 END) as positive_reviews,
        COUNT(CASE WHEN t.satisfaction_rating IS NOT NULL THEN 1 END) as total_reviews
      FROM employees e
      JOIN work_groups wg ON e.group_id = wg.group_id
      LEFT JOIN tickets t ON e.employee_id = t.operator_id 
        AND t.status = 'closed'
        AND MONTH(t.closed_at) = ?
        AND YEAR(t.closed_at) = ?
      WHERE e.group_id IN (${groupIds.map(() => '?').join(',')})
        AND e.status = 'Активен'
        AND e.role = 'Сотрудник'
      GROUP BY e.employee_id
      ORDER BY closed_count DESC
    `, [month, year, ...groupIds]);
    
    // Формируем Excel
    const excelData = employees.map(emp => {
      const closedCount = emp.closed_count || 0;
      const quotaPercent = monthlyNorm > 0 ? (closedCount / monthlyNorm * 100).toFixed(1) : 0;
      const csat = emp.total_reviews > 0 
        ? (emp.positive_reviews / emp.total_reviews * 100).toFixed(1) 
        : 0;
      
      let status = 'Не выполнена';
      if (closedCount >= monthlyNorm) status = 'Выполнена';
      else if (closedCount >= monthlyNorm * 0.8) status = 'Почти выполнена';
      
      return {
        'ФИО': `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim(),
        'Группа': emp.group_name,
        'Рабочих дней': emp.work_days || 0,
        'Закрыто обращений': closedCount,
        'Норма за месяц': monthlyNorm,
        'Выполнение %': parseFloat(quotaPercent),
        'Статус': status,
        'Средняя оценка': emp.avg_rating || 0,
        'CSAT %': parseFloat(csat)
      };
    });
    
    // Создаём Excel файл
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Настраиваем ширину колонок
    ws['!cols'] = [
      { wch: 30 }, // ФИО
      { wch: 20 }, // Группа
      { wch: 12 }, // Рабочих дней
      { wch: 16 }, // Закрыто обращений
      { wch: 14 }, // Норма за месяц
      { wch: 14 }, // Выполнение %
      { wch: 14 }, // Статус
      { wch: 14 }, // Средняя оценка
      { wch: 12 }  // CSAT %
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Отчёт по норме ${month}.${year}`);
    
    // Генерируем buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    // Отправляем файл
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=quota_report_${groupName}_${month}_${year}.xlsx`);
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Ошибка экспорта отчёта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// backend/quota.report.routes.js (добавьте новый эндпоинт)

// Получить динамические нормы для всех сотрудников группы
router.get('/quota/dynamic-group', isLeader, async (req, res) => {
  const { group_id } = req.query;
  const userId = req.userId;
  const userRole = req.userRole;
  
  try {
    let targetGroupId = group_id;
    
    // Если группа не указана, определяем по роли руководителя
    if (!targetGroupId) {
      if (userRole === 'Руководитель группы') {
        const [group] = await db.query(
          `SELECT group_id FROM employees WHERE employee_id = ?`,
          [userId]
        );
        targetGroupId = group[0]?.group_id;
      } else if (userRole === 'Руководитель отдела') {
        // Для руководителя отдела можно вернуть все группы
        const [groups] = await db.query(
          `SELECT wg.group_id 
           FROM work_groups wg
           JOIN employees e ON e.group_id = wg.group_id
           WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
          [userId]
        );
        // Возвращаем для всех групп
        const allStats = [];
        for (const g of groups) {
          const stats = await QuotaService.getGroupQuotaStats(g.group_id);
          allStats.push(...(stats?.employees || []));
        }
        return res.json({ employees: allStats, isMultipleGroups: true });
      }
    }
    
    if (!targetGroupId) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }
    
    const stats = await QuotaService.getGroupQuotaStats(targetGroupId);
    res.json(stats);
    
  } catch (error) {
    console.error('Ошибка получения динамических норм группы:', error);
    res.status(500).json({ error: error.message });
  }
});
// Получить динамические нормы для всех сотрудников группы
router.get('/quota/dynamic-group', isLeader, async (req, res) => {
  const { group_id } = req.query;
  const userId = req.userId;
  const userRole = req.userRole;
  
  try {
    let targetGroupId = group_id;
    
    // Если группа не указана, определяем по роли
    if (!targetGroupId) {
      if (userRole === 'Руководитель группы') {
        const [group] = await db.query(
          `SELECT group_id FROM employees WHERE employee_id = ?`,
          [userId]
        );
        targetGroupId = group[0]?.group_id;
      } else if (userRole === 'Руководитель отдела') {
        const [groups] = await db.query(
          `SELECT wg.group_id 
           FROM work_groups wg
           JOIN employees e ON e.group_id = wg.group_id
           WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
          [userId]
        );
        if (groups.length === 0) {
          return res.status(404).json({ error: 'Группы не найдены' });
        }
        // Для отдела возвращаем данные по всем группам
        const allStats = [];
        for (const g of groups) {
          const stats = await QuotaService.getGroupQuotaStats(g.group_id);
          if (stats) {
            allStats.push(...stats.employees);
          }
        }
        return res.json({ employees: allStats, isMultipleGroups: true });
      }
    }
    
    if (!targetGroupId) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }
    
    const stats = await QuotaService.getGroupQuotaStats(targetGroupId);
    res.json(stats);
    
  } catch (error) {
    console.error('Ошибка получения динамических норм группы:', error);
    res.status(500).json({ error: error.message });
  }
});
// Получить динамические нормы для группы за конкретную дату
router.get('/quota/dynamic-group-by-date', isLeader, async (req, res) => {
  const { group_id, date } = req.query;
  const userId = req.userId;
  const userRole = req.userRole;
  
  try {
    let targetGroupId = group_id;
    
    if (!targetGroupId) {
      if (userRole === 'Руководитель группы') {
        const [group] = await db.query(
          `SELECT group_id FROM employees WHERE employee_id = ?`,
          [userId]
        );
        targetGroupId = group[0]?.group_id;
      } else if (userRole === 'Руководитель отдела') {
        const [groups] = await db.query(
          `SELECT wg.group_id 
           FROM work_groups wg
           JOIN employees e ON e.group_id = wg.group_id
           WHERE e.employee_id = ? AND e.role = 'Руководитель отдела'`,
          [userId]
        );
        const allStats = [];
        for (const g of groups) {
          const stats = await QuotaService.getGroupQuotaStatsByDate(g.group_id, date);
          if (stats) {
            allStats.push(...stats.employees);
          }
        }
        return res.json({ employees: allStats, isMultipleGroups: true });
      }
    }
    
    if (!targetGroupId) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }
    
    const stats = await QuotaService.getGroupQuotaStatsByDate(targetGroupId, date);
    res.json(stats);
    
  } catch (error) {
    console.error('Ошибка получения динамических норм по дате:', error);
    res.status(500).json({ error: error.message });
  }
});
export default router;