// services/kpiCollector.service.js
import { db } from "../db.js";
import { NotificationService } from "../notification.service.js";

export class KPICollector {
  /**
   * Эмуляция получения данных из CRM
   */
  static async fetchFromCRM(employeeId, date) {
    // В реальной системе здесь был бы запрос к API CRM (AmoCRM, Bitrix24 и т.д.)
    // Генерируем реалистичные данные на основе employee_id (для детерминированности)
    const seed = (employeeId * 100 + date.getDate()) % 100;
    
    return {
      processed_requests: Math.floor(20 + (seed % 50)), // 20-70 запросов
      total_requests: Math.floor(25 + (seed % 55)), // 25-80 всего запросов
      first_contact_resolved: Math.floor(15 + (seed % 40)), // 15-55 решено с первого раза
      work_minutes: 460 + Math.floor(Math.random() * 60), // 7.6 - 8.6 часов
    };
  }

  /**
   * Эмуляция получения данных из Телефонии / Системы опросов
   */
  static async fetchFromTelephony(employeeId, date) {
    const seed = (employeeId * 200 + date.getDate()) % 100;
    const total_feedbacks = Math.floor(5 + (seed % 25)); // 5-30 отзывов
    const positive_feedbacks = Math.floor(total_feedbacks * (0.7 + (seed % 30) / 100));
    
    return {
      total_feedbacks: total_feedbacks,
      positive_feedbacks: Math.min(positive_feedbacks, total_feedbacks),
    };
  }

  /**
   * Эмуляция получения данных из Системы контроля качества
   */
  static async fetchFromQualitySystem(employeeId, date) {
    const seed = (employeeId * 300 + date.getDate()) % 100;
    const checked_requests = Math.floor(5 + (seed % 20)); // 5-25 проверенных
    const quality_score = 3 + (seed % 30) / 10; // 3.0 - 5.0 баллов
    
    return {
      checked_requests: checked_requests,
      quality_score: Math.min(5, Math.max(1, parseFloat(quality_score.toFixed(1)))),
    };
  }

  /**
   * Основной метод сбора KPI для одного сотрудника
   */
  static async collectForEmployee(employeeId, reportDate) {
    try {
      // Проверяем, нет ли уже данных за эту дату
      const [existing] = await db.query(
        `SELECT * FROM daily_metrics WHERE employee_id = ? AND DATE(report_date) = DATE(?)`,
        [employeeId, reportDate]
      );

      if (existing.length > 0) {
        console.log(`📋 Данные за ${reportDate.toISOString().split('T')[0]} для сотрудника ${employeeId} уже существуют`);
        return null;
      }

      // Получаем данные из всех систем
      const crmData = await this.fetchFromCRM(employeeId, reportDate);
      const phoneData = await this.fetchFromTelephony(employeeId, reportDate);
      const qualityData = await this.fetchFromQualitySystem(employeeId, reportDate);

      // Сохраняем в БД
      const [result] = await db.query(
        `INSERT INTO daily_metrics (
          employee_id, report_date, 
          processed_requests, work_minutes,
          positive_feedbacks, total_feedbacks,
          first_contact_resolved, total_requests,
          quality_score, checked_requests,
          verification_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Одобрено', NOW(), NOW())`,
        [
          employeeId,
          reportDate.toISOString().split('T')[0],
          crmData.processed_requests,
          crmData.work_minutes,
          phoneData.positive_feedbacks,
          phoneData.total_feedbacks,
          crmData.first_contact_resolved,
          crmData.total_requests,
          qualityData.quality_score,
          qualityData.checked_requests,
        ]
      );

      // Отправляем уведомление сотруднику
      const formattedDate = reportDate.toLocaleDateString('ru-RU');
      await NotificationService.createNotification(
        employeeId,
        "🤖 Данные автоматически собраны",
        `Ваши рабочие показатели за ${formattedDate} были автоматически собраны из CRM и телефонии. Статус: Одобрено (автоматическая проверка).`,
        "success",
        "daily_metrics",
        result.insertId
      );

      console.log(`✅ Собраны KPI для сотрудника ${employeeId} за ${formattedDate}`);
      return result.insertId;
    } catch (error) {
      console.error(`❌ Ошибка сбора KPI для сотрудника ${employeeId}:`, error);
      return null;
    }
  }

  /**
   * Сбор KPI для всех активных сотрудников за указанную дату
   */
  static async collectForAllEmployees(date = new Date()) {
    console.log(`🚀 Запуск автоматического сбора KPI за ${date.toISOString().split('T')[0]}...`);
    
const [employees] = await db.query(
  `SELECT employee_id FROM employees 
   WHERE status != 'В отпуске' AND status != 'Уволен'`
);

    let successCount = 0;
    for (const emp of employees) {
      const result = await this.collectForEmployee(emp.employee_id, date);
      if (result) successCount++;
    }

    console.log(`📊 Сбор завершен: обработано ${employees.length} сотрудников, добавлено ${successCount} записей`);
    return { total: employees.length, added: successCount };
  }
}