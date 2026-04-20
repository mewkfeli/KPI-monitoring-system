// notification.service.js
import { db } from "./db.js";

export const NotificationService = {
  /**
   * Создать уведомление для пользователя
   * @param {number} userId - ID получателя
   * @param {string} title - Заголовок уведомления
   * @param {string} message - Текст уведомления
   * @param {string} type - Тип: 'info', 'success', 'error', 'warning'
   * @param {string} relatedEntity - Связанная сущность (например, 'daily_metrics')
   * @param {number} relatedId - ID связанной записи
   */
  async createNotification(userId, title, message, type = 'info', relatedEntity = null, relatedId = null) {
    try {
      const [result] = await db.query(
        `INSERT INTO notifications (user_id, title, message, notification_type, related_entity, related_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
        [userId, title, message, type, relatedEntity, relatedId]
      );
      console.log(`✅ Уведомление создано для пользователя ${userId}: ${title}`);
      return result.insertId;
    } catch (error) {
      console.error("❌ Ошибка создания уведомления:", error);
      return null;
    }
  },

  /**
   * Получить всех руководителей группы сотрудника
   * @param {number} employeeId - ID сотрудника
   */
  async getGroupLeaders(employeeId) {
    const [rows] = await db.query(
      `SELECT e.employee_id 
       FROM employees e
       JOIN employees sub ON sub.group_id = e.group_id
       WHERE sub.employee_id = ? 
         AND e.role IN ('Руководитель группы', 'Руководитель отдела')
         AND e.status = 'Активен'`,
      [employeeId]
    );
    return rows.map(r => r.employee_id);
  },

  /**
   * Получить всех сотрудников группы руководителя
   * @param {number} leaderId - ID руководителя
   */
  async getGroupEmployees(leaderId) {
    const [rows] = await db.query(
      `SELECT e.employee_id 
       FROM employees e
       JOIN employees leader ON leader.group_id = e.group_id
       WHERE leader.employee_id = ? 
         AND e.role = 'Сотрудник'
         AND e.status = 'Активен'`,
      [leaderId]
    );
    return rows.map(r => r.employee_id);
  },

  /**
   * Получить информацию о сотруднике
   * @param {number} employeeId - ID сотрудника
   */
  async getEmployeeInfo(employeeId) {
    const [rows] = await db.query(
      `SELECT first_name, last_name, middle_name FROM employees WHERE employee_id = ?`,
      [employeeId]
    );
    if (rows.length === 0) return null;
    return rows[0];
  },

  /**
   * Получить количество непрочитанных уведомлений для пользователя
   * @param {number} userId - ID пользователя
   */
  async getUnreadCount(userId) {
    const [rows] = await db.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return rows[0].count;
  }
};