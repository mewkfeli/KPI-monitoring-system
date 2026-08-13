// backend/services/kpiCollector.service.js
import { db } from '../db.js';
import { NotificationService } from '../notification.service.js';

export const KPICollector = {
  /**
   * Проверить, в отпуске ли сотрудник в указанную дату
   */
  async isOnVacation(employeeId, dateStr) {
    const [vacation] = await db.query(
      `SELECT * FROM vacations 
       WHERE employee_id = ? 
         AND status = 'active'
         AND start_date <= ? 
         AND end_date >= ?`,
      [employeeId, dateStr, dateStr]
    );
    return vacation.length > 0;
  },

  /**
   * Создать запись-заглушку для дня отпуска
   */
  async createVacationRecord(employeeId, dateStr) {
    const [existing] = await db.query(
      `SELECT record_id FROM daily_metrics 
       WHERE employee_id = ? AND report_date = ?`,
      [employeeId, dateStr]
    );
    
    if (existing.length === 0) {
      await db.query(
        `INSERT INTO daily_metrics 
         (employee_id, report_date, processed_requests, work_minutes, 
          positive_feedbacks, total_feedbacks, first_contact_resolved, 
          total_requests, quality_score, checked_requests, verification_status, reviewer_comment)
         VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 'Одобрено', 'Сотрудник в отпуске')`,
        [employeeId, dateStr]
      );
      console.log(`📝 Создана запись-заглушка для отпуска: ${employeeId} - ${dateStr}`);
    }
  },

  /**
   * Сбор KPI для всех операторов за указанную дату
   */
  async collectForAllEmployees(date) {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    console.log(`📊 Начинаем сбор KPI за ${dateStr}...`);
    
    try {
      // Получаем ТОЛЬКО СОТРУДНИКОВ (не руководителей)
      const [operators] = await db.query(
        `SELECT employee_id, last_name, first_name 
         FROM employees 
         WHERE role = 'Сотрудник'   -- ТОЛЬКО СОТРУДНИКИ
         AND status = 'Активен'`
      );
      
      console.log(`📊 Найдено сотрудников (не руководителей): ${operators.length}`);
      
      let successCount = 0;
      let errorCount = 0;
      let vacationCount = 0;
      
      for (const operator of operators) {
        try {
          // Проверяем, в отпуске ли сотрудник
          const isOnVacation = await this.isOnVacation(operator.employee_id, dateStr);
          
          if (isOnVacation) {
            console.log(`⚠️ Сотрудник ${operator.employee_id} в отпуске ${dateStr}, создаём заглушку`);
            await this.createVacationRecord(operator.employee_id, dateStr);
            vacationCount++;
            continue;
          }
          
          const result = await this.collectForEmployee(operator.employee_id, dateStr);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`❌ Ошибка сбора для сотрудника ${operator.employee_id}: ${result.error}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Ошибка сбора для сотрудника ${operator.employee_id}:`, error.message);
        }
      }
      
      console.log(`📊 Сбор KPI завершён. Успешно: ${successCount}, Отпуск: ${vacationCount}, Ошибок: ${errorCount}`);
      
    } catch (error) {
      console.error('❌ Ошибка сбора KPI:', error);
    }
  },
  
  /**
   * Сбор KPI для конкретного сотрудника за указанную дату
   */
  async collectForEmployee(employeeId, dateStr) {
    try {
      // 1. Получаем все обращения, закрытые оператором за эту дату
      const [closedTickets] = await db.query(
        `SELECT 
          t.ticket_id,
          t.closed_at,
          t.satisfaction_rating,
          t.resolution_time_minutes,
          t.is_first_contact_resolved,
          (SELECT COUNT(*) > 0 FROM ticket_transfers WHERE ticket_id = t.ticket_id) as was_transferred
         FROM tickets t
         WHERE t.operator_id = ? 
         AND DATE(t.closed_at) = ?
         AND t.status = 'closed'`,
        [employeeId, dateStr]
      );
      
      const ticketsCount = closedTickets.length;
      
      // 2. Считаем метрики
      let positiveFeedbacks = 0;
      let totalFeedbacks = 0;
      let firstContactResolved = 0;
      let totalResolutionMinutes = 0;
      let qualityScoreSum = 0;
      let checkedRequests = 0;
      
      for (const ticket of closedTickets) {
        if (ticket.satisfaction_rating) {
          totalFeedbacks++;
          if (ticket.satisfaction_rating >= 4) {
            positiveFeedbacks++;
          }
        }
        
        if (!ticket.was_transferred) {
          firstContactResolved++;
        }
        
        if (ticket.resolution_time_minutes) {
          totalResolutionMinutes += ticket.resolution_time_minutes;
        }
        
        if (ticket.satisfaction_rating) {
          qualityScoreSum += ticket.satisfaction_rating;
          checkedRequests++;
        } else {
          qualityScoreSum += 4;
          checkedRequests++;
        }
      }
      
      const avgQuality = checkedRequests > 0 ? qualityScoreSum / checkedRequests : 0;
      const csat = totalFeedbacks > 0 ? (positiveFeedbacks / totalFeedbacks) * 100 : 0;
      
      // 4. Проверяем, есть ли уже запись за эту дату
      const [existing] = await db.query(
        `SELECT record_id FROM daily_metrics 
         WHERE employee_id = ? AND report_date = ?`,
        [employeeId, dateStr]
      );
      
      if (existing.length > 0) {
        await db.query(
          `UPDATE daily_metrics 
           SET processed_requests = ?,
               work_minutes = ?,
               positive_feedbacks = ?,
               total_feedbacks = ?,
               first_contact_resolved = ?,
               total_requests = ?,
               quality_score = ?,
               checked_requests = ?,
               verification_status = 'Одобрено',
               updated_at = NOW()
           WHERE employee_id = ? AND report_date = ?`,
          [
            ticketsCount,
            totalResolutionMinutes,
            positiveFeedbacks,
            totalFeedbacks,
            firstContactResolved,
            ticketsCount,
            avgQuality,
            checkedRequests,
            employeeId,
            dateStr
          ]
        );
      } else {
        await db.query(
          `INSERT INTO daily_metrics 
           (employee_id, report_date, processed_requests, work_minutes, 
            positive_feedbacks, total_feedbacks, first_contact_resolved, 
            total_requests, quality_score, checked_requests, verification_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Одобрено')`,
          [
            employeeId, dateStr, ticketsCount, totalResolutionMinutes,
            positiveFeedbacks, totalFeedbacks, firstContactResolved,
            ticketsCount, avgQuality, checkedRequests
          ]
        );
      }
      
      await this.notifyManagerIfNeeded(employeeId, dateStr, ticketsCount, csat, avgQuality);
      
      return { success: true, ticketsCount, csat, avgQuality };
      
    } catch (error) {
      console.error(`❌ Ошибка сбора KPI для сотрудника ${employeeId}:`, error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Уведомление руководителя, если показатели ниже нормы
   */
  async notifyManagerIfNeeded(employeeId, dateStr, ticketsCount, csat, avgQuality) {
    // Проверяем, что сотрудник не руководитель
    const [employeeRole] = await db.query(
      `SELECT role FROM employees WHERE employee_id = ?`,
      [employeeId]
    );
    
    if (employeeRole[0]?.role !== 'Сотрудник') {
      return;
    }
    
    const [manager] = await db.query(
      `SELECT e2.employee_id 
       FROM employees e1
       JOIN employees e2 ON e1.group_id = e2.group_id
       WHERE e1.employee_id = ? 
         AND e2.role IN ('Руководитель группы', 'Руководитель отдела')
       LIMIT 1`,
      [employeeId]
    );
    
    if (manager.length === 0) return;
    
    const [employee] = await db.query(
      `SELECT last_name, first_name FROM employees WHERE employee_id = ?`,
      [employeeId]
    );
    
    const employeeName = `${employee[0].first_name} ${employee[0].last_name}`;
    const formattedDate = new Date(dateStr).toLocaleDateString('ru-RU');
    
    const [kpiTargets] = await db.query(`SELECT * FROM kpi_targets`);
    const csatTarget = kpiTargets.find(t => t.metric_name === 'csat')?.target_value || 85;
    const qualityTarget = kpiTargets.find(t => t.metric_name === 'quality_score')?.target_value || 4.5;
    
    let warnings = [];
    
    if (csat < csatTarget) {
      warnings.push(`CSAT (${csat.toFixed(1)}% < ${csatTarget}%)`);
    }
    if (avgQuality < qualityTarget) {
      warnings.push(`Качество (${avgQuality.toFixed(1)}/5 < ${qualityTarget}/5)`);
    }
    
    if (warnings.length > 0) {
      await NotificationService.createNotification(
        manager[0].employee_id,
        '⚠️ Отклонение KPI у сотрудника',
        `${employeeName} за ${formattedDate}:\nПоказатели ниже нормы:\n${warnings.join('\n')}`,
        'warning',
        'daily_metrics',
        null
      );
    }
  },
  
  /**
   * Сбор KPI за последние N дней
   */
  async collectForLastDays(days = 7) {
    const results = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      await this.collectForAllEmployees(date);
      results.push(date.toISOString().split('T')[0]);
    }
    return results;
  }
};

export default KPICollector;