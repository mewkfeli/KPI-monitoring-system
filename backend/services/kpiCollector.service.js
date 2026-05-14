// services/kpiCollector.service.js
import { db } from "../db.js";
import { NotificationService } from "../notification.service.js";

export class KPICollector {
  /**
   * Генерация случайных данных для сотрудника
   */
  // В kpiCollector.service.js
static generateRandomMetrics(employeeId, date) {
  // Создаем детерминированный, но разный seed для каждого сотрудника
  const seed = (employeeId * 7919 + date.getDate() * 701 + date.getMonth() * 503) % 1000;
  
  // Базовый уровень эффективности сотрудника (разный для каждого)
  // От 30% до 98%
  const efficiency = 30 + (seed % 68);
  
  // 1. Обработанные запросы (от 20 до 120, зависит от эффективности)
  const processed_requests = 20 + Math.floor(efficiency / 100 * 100);
  
  // 2. CSAT (от 55% до 96%, зависит от эффективности)
  const csat = 55 + Math.floor(efficiency * 0.41);
  
  // 3. FCR (от 50% до 94%, зависит от эффективности)
  const fcr = 50 + Math.floor(efficiency * 0.44);
  
  // 4. Качество (от 2.5 до 5.0, зависит от эффективности)
  const quality_score = 2.5 + (efficiency / 100) * 2.5;
  
  // 5. Время работы (от 6 до 9.5 часов, немного случайности)
  const work_hours = 6 + (Math.random() * 3.5);
  const work_minutes = Math.floor(work_hours * 60);
  
  // 6. Количество отзывов (от 5 до 45, зависит от обработанных запросов)
  const total_feedbacks = 5 + Math.floor(Math.random() * 40);
  const positive_feedbacks = Math.floor(total_feedbacks * (csat / 100));
  
  // 7. Количество запросов для FCR
  const total_requests = processed_requests + Math.floor(Math.random() * 30);
  const first_contact_resolved = Math.floor(total_requests * (fcr / 100));
  
  // 8. Проверенные запросы (от 5 до 30)
  const checked_requests = 5 + Math.floor(Math.random() * 25);
  
  return {
    processed_requests: processed_requests,
    work_minutes: Math.max(360, Math.min(660, work_minutes)), // 6-11 часов
    positive_feedbacks: positive_feedbacks,
    total_feedbacks: total_feedbacks,
    first_contact_resolved: first_contact_resolved,
    total_requests: total_requests,
    quality_score: parseFloat(quality_score.toFixed(1)),
    checked_requests: checked_requests,
    // Для отладки
    _efficiency: Math.round(efficiency),
    _csat: csat,
    _fcr: fcr,
  };
}

  /**
   * Основной метод сбора KPI для одного сотрудника
   */
  static async collectForEmployee(employeeId, reportDate) {
    try {
      // Проверяем, что сотрудник имеет роль 'Сотрудник'
      const [employeeCheck] = await db.query(
        `SELECT role FROM employees WHERE employee_id = ? AND status = 'Активен'`,
        [employeeId]
      );
      
      if (employeeCheck.length === 0 || employeeCheck[0].role !== 'Сотрудник') {
        console.log(`⏭️ Пропуск: сотрудник ${employeeId} - метрики собираются только для сотрудников`);
        return null;
      }
      
      // Проверяем, нет ли уже данных за эту дату
      const [existing] = await db.query(
        `SELECT * FROM daily_metrics WHERE employee_id = ? AND DATE(report_date) = DATE(?)`,
        [employeeId, reportDate]
      );

      if (existing.length > 0) {
        console.log(`📋 Данные за ${reportDate.toISOString().split('T')[0]} для сотрудника ${employeeId} уже существуют`);
        return null;
      }

      // Генерируем случайные данные
      const metrics = this.generateRandomMetrics(employeeId, reportDate);

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
          metrics.processed_requests,
          metrics.work_minutes,
          metrics.positive_feedbacks,
          metrics.total_feedbacks,
          metrics.first_contact_resolved,
          metrics.total_requests,
          metrics.quality_score,
          metrics.checked_requests,
        ]
      );

      // Отправляем уведомление сотруднику
      const formattedDate = reportDate.toLocaleDateString('ru-RU');
      await NotificationService.createNotification(
        employeeId,
        "🤖 Данные автоматически собраны",
        `Ваши рабочие показатели за ${formattedDate} были автоматически собраны.\n\n📊 Обработано: ${metrics.processed_requests} запросов\n⭐ CSAT: ${Math.round((metrics.positive_feedbacks / metrics.total_feedbacks) * 100)}%\n🎯 Качество: ${metrics.quality_score}/5`,
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
    
    // Получаем только сотрудников
    const [employees] = await db.query(
      `SELECT employee_id FROM employees 
       WHERE status = 'Активен' 
         AND role = 'Сотрудник'`
    );

    console.log(`👥 Найдено сотрудников для сбора: ${employees.length}`);

    let successCount = 0;
    for (const emp of employees) {
      const result = await this.collectForEmployee(emp.employee_id, date);
      if (result) successCount++;
      
      // Небольшая задержка между запросами, чтобы не перегружать
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Сбор завершен: обработано ${employees.length} сотрудников, добавлено ${successCount} записей`);
    return { total: employees.length, added: successCount };
  }
}