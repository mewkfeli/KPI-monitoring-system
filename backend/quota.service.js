// backend/quota.service.js

import { db } from './db.js';

// Кэш для хранения количества закрытых обращений по дням
const quotaCache = new Map();

export const QuotaService = {
    /**
     * Получить дату, для которой сейчас считается норма
     * Если сейчас 23:00 или позже - считаем за СЕГОДНЯ
     * Если до 23:00 - считаем за ВЧЕРА
     */
    getCurrentQuotaDate() {
    const now = new Date();
    
    // Форматируем дату в локальном часовом поясе
    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    // Всегда показываем текущую дату (сегодня)
    // Норма обнуляется в 00:00 по местному времени
    return formatLocalDate(now);
},

    /**
     * Очистить весь кэш нормы (вызывается в 23:00)
     */
    clearQuotaCache() {
        quotaCache.clear();
        console.log('🗑️ Кэш нормы полностью очищен в 23:00');
    },

    /**
     * Очистить кэш для конкретного сотрудника
     */
    clearQuotaCacheForEmployee(employeeId) {
        for (const key of quotaCache.keys()) {
            if (key.startsWith(`${employeeId}_`)) {
                quotaCache.delete(key);
                console.log(`🗑️ Очищен кэш для сотрудника ${employeeId}`);
            }
        }
    },

    /**
     * Получить базовую дневную норму из KPI настроек
     */
    async getBaseDailyTarget() {
        try {
            const [result] = await db.query(
                `SELECT target_value FROM kpi_targets WHERE metric_name = 'tickets_per_day'`
            );
            console.log(`📊 Базовая норма из БД: ${result[0]?.target_value || 15}`);
            return result[0] ? parseFloat(result[0].target_value) : 15;
        } catch (error) {
            console.error('Ошибка получения базовой нормы:', error);
            return 15;
        }
    },

    /**
     * Получить настройку: включена ли динамическая корректировка нормы
     */
    async isDynamicQuotaEnabled() {
        try {
            const [result] = await db.query(
                `SELECT setting_value FROM system_settings WHERE setting_key = 'dynamic_quota_enabled'`
            );
            return result[0]?.setting_value === 'true';
        } catch (error) {
            return true;
        }
    },

    /**
     * Подсчитать, сколько обращений сотрудник закрыл за указанную дату (с кэшированием)
     */
    async getClosedCountByDate(employeeId, date) {
    const cacheKey = `${employeeId}_${date}`;
    
    if (quotaCache.has(cacheKey)) {
        return quotaCache.get(cacheKey);
    }
    
    // 👇 СЧИТАЕМ И closed, И resolved
    const [result] = await db.query(
        `SELECT COUNT(*) as count 
         FROM tickets 
         WHERE operator_id = ? 
           AND status IN ('closed', 'resolved')
           AND DATE(COALESCE(closed_at, resolved_at)) = ?`,
        [employeeId, date]
    );
    
    const count = result[0]?.count || 0;
    quotaCache.set(cacheKey, count);
    console.log(`📊 Для сотрудника ${employeeId} за ${date}: ${count} (closed+resolved)`);
    return count;

},
    /**
 * Очистить кэш для конкретного сотрудника (вызывается при закрытии обращения)
 */
/**
 * Алиас для getClosedCountByDate (для обратной совместимости)
 */

/**
 * Получить количество закрытых обращений за сегодня (алиас для getClosedCountByDate)
 */
async getTodayClosedCount(employeeId) {
    const quotaDate = this.getCurrentQuotaDate();
    return await this.getClosedCountByDate(employeeId, quotaDate);
},
    /**
     * Получить текущую информацию о норме для сотрудника
     */
    async getQuotaInfo(employeeId) {
        const quotaDate = this.getCurrentQuotaDate();
        const dailyTarget = await this.getDynamicDailyTarget(employeeId);
        const currentCount = await this.getClosedCountByDate(employeeId, quotaDate);
        const baseTarget = await this.getBaseDailyTarget();
        const isDynamicEnabled = await this.isDynamicQuotaEnabled();
        
        // Получаем информацию о загруженности группы
        let queueInfo = null;
        let groupProductivityInfo = null;
        
        try {
            const [employee] = await db.query(
                `SELECT group_id FROM employees WHERE employee_id = ?`,
                [employeeId]
            );
            if (employee.length) {
                const [queue] = await db.query(
                    `SELECT COUNT(*) as count FROM tickets 
                     WHERE group_id = ? AND status IN ('new', 'waiting')`,
                    [employee[0].group_id]
                );
                queueInfo = queue[0].count;
                
                const [productivity] = await db.query(
                    `SELECT AVG(CASE 
                        WHEN work_minutes > 0 THEN (processed_requests / (work_minutes / 60))
                        ELSE 0 
                      END) as avg_cph
                     FROM daily_metrics dm
                     JOIN employees e ON dm.employee_id = e.employee_id
                     WHERE e.group_id = ? 
                       AND dm.report_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                       AND dm.verification_status = 'Одобрено'`,
                    [employee[0].group_id]
                );
                groupProductivityInfo = productivity[0]?.avg_cph || 0;
            }
        } catch (error) {
            console.error('Ошибка получения информации о группе:', error);
            queueInfo = 0;
            groupProductivityInfo = 0;
        }
        
        const remaining = Math.max(0, dailyTarget - currentCount);
        const percent = Math.min(100, Math.round((currentCount / dailyTarget) * 100));
        
        console.log(`📊 Норма для сотрудника ${employeeId}: ${currentCount}/${dailyTarget} (${percent}%) за ${quotaDate}`);
        
        return {
            current: currentCount,
            target: dailyTarget,
            baseTarget: baseTarget,
            remaining: remaining,
            percent: percent,
            isCompleted: currentCount >= dailyTarget,
            isDynamicEnabled: isDynamicEnabled,
            isDynamic: dailyTarget !== baseTarget,
            quotaDate: quotaDate, // Дата, за которую считается норма
            queueInfo: queueInfo || 0,
            groupProductivity: groupProductivityInfo ? parseFloat(groupProductivityInfo).toFixed(1) : null
        };
    },

    /**
     * Проверить, может ли сотрудник взять обращение
     */
    async canTakeTicket(employeeId) {
        const [employee] = await db.query(
            `SELECT status FROM employees WHERE employee_id = ?`,
            [employeeId]
        );
        
        if (employee[0]?.status === 'В отпуске') {
            return { 
                allowed: false, 
                reason: '❌ Вы находитесь в отпуске',
                currentCount: 0,
                dailyTarget: 0
            };
        }
        
        const quotaInfo = await this.getQuotaInfo(employeeId);
        
        if (quotaInfo.current >= quotaInfo.target) {
            let reason = `Дневная норма выполнена (${quotaInfo.current}/${quotaInfo.target}).`;
            if (quotaInfo.isDynamic && quotaInfo.target !== quotaInfo.baseTarget) {
                reason = `Дневная норма выполнена (${quotaInfo.current}/${quotaInfo.target}). Сегодня норма увеличена до ${quotaInfo.target} из-за высокой нагрузки.`;
            }
            return { 
                allowed: false, 
                reason,
                currentCount: quotaInfo.current,
                dailyTarget: quotaInfo.target,
                baseTarget: quotaInfo.baseTarget,
                isDynamic: quotaInfo.isDynamic
            };
        }
        
        let warningMessage = null;
        if (quotaInfo.remaining <= 3 && quotaInfo.remaining > 0) {
            warningMessage = `⚠️ Осталось ${quotaInfo.remaining} обращений до выполнения нормы!`;
            if (quotaInfo.isDynamic && quotaInfo.target !== quotaInfo.baseTarget) {
                warningMessage += ` (сегодня норма ${quotaInfo.target})`;
            }
        }
        
        return { 
            allowed: true, 
            currentCount: quotaInfo.current,
            dailyTarget: quotaInfo.target,
            baseTarget: quotaInfo.baseTarget,
            remaining: quotaInfo.remaining,
            warningMessage,
            isDynamic: quotaInfo.isDynamic
        };
    },

    /**
     * Получить динамическую норму для сотрудника (пока возвращает базовую)
     */
    async getDynamicDailyTarget(employeeId) {
        return await this.getBaseDailyTarget();
    },

    /**
     * Получить динамическую норму для сотрудника на конкретную дату
     */
    async getDynamicDailyTargetByDate(employeeId, date, queueSize) {
        const baseTarget = await this.getBaseDailyTarget();
        console.log(`📊 getDynamicDailyTargetByDate: employeeId=${employeeId}, date=${date}, baseTarget=${baseTarget}`);
        return baseTarget;
    },

    /**
     * Получить статистику по группе (для руководителя)
     */
    async getGroupQuotaStats(groupId) {
        try {
            const [employees] = await db.query(
                `SELECT employee_id, last_name, first_name, avatar_url
                 FROM employees 
                 WHERE group_id = ? 
                   AND role = 'Сотрудник'
                   AND status = 'Активен'`,
                [groupId]
            );
            
            const [queue] = await db.query(
                `SELECT COUNT(*) as queue_size FROM tickets 
                 WHERE group_id = ? AND status IN ('new', 'waiting')`,
                [groupId]
            );
            
            const [productivity] = await db.query(
                `SELECT AVG(CASE 
                    WHEN work_minutes > 0 THEN (processed_requests / (work_minutes / 60))
                    ELSE 0 
                  END) as avg_cph
                 FROM daily_metrics dm
                 JOIN employees e ON dm.employee_id = e.employee_id
                 WHERE e.group_id = ? 
                   AND dm.report_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                   AND dm.verification_status = 'Одобрено'`,
                [groupId]
            );
            
            const quotaDate = this.getCurrentQuotaDate();
            const stats = [];
            
            for (const emp of employees) {
                const quotaInfo = await this.getQuotaInfo(emp.employee_id);
                stats.push({
                    employee_id: emp.employee_id,
                    name: `${emp.last_name} ${emp.first_name}`,
                    avatar_url: emp.avatar_url,
                    ...quotaInfo
                });
            }
            
            stats.sort((a, b) => {
                if (a.isCompleted === b.isCompleted) {
                    return b.percent - a.percent;
                }
                return a.isCompleted ? 1 : -1;
            });
            
            const totalEmployees = stats.length;
            const completedCount = stats.filter(s => s.isCompleted).length;
            const avgPercent = totalEmployees > 0 
                ? stats.reduce((sum, s) => sum + s.percent, 0) / totalEmployees 
                : 0;
            const totalClosed = stats.reduce((sum, s) => sum + s.current, 0);
            
            return {
                employees: stats,
                quotaDate: quotaDate,
                groupInfo: {
                    queueSize: queue[0]?.queue_size || 0,
                    avgProductivity: productivity[0]?.avg_cph ? parseFloat(productivity[0].avg_cph).toFixed(1) : 0,
                    activeEmployees: totalEmployees
                },
                summary: {
                    totalEmployees,
                    completedCount,
                    completionRate: totalEmployees > 0 ? (completedCount / totalEmployees * 100).toFixed(1) : 0,
                    avgPercent: avgPercent.toFixed(1),
                    totalClosed
                }
            };
        } catch (error) {
            console.error('Ошибка получения статистики группы:', error);
            return null;
        }
    },

    /**
     * Получить статистику по группе за конкретную дату (для руководителя)
     */
    async getGroupQuotaStatsByDate(groupId, date) {
        try {
            const [employees] = await db.query(
                `SELECT employee_id, last_name, first_name, avatar_url
                 FROM employees 
                 WHERE group_id = ? 
                   AND role = 'Сотрудник'
                   AND status = 'Активен'`,
                [groupId]
            );
            
            const [queue] = await db.query(
                `SELECT COUNT(*) as queue_size FROM tickets 
                 WHERE group_id = ? 
                   AND status IN ('new', 'waiting')
                   AND DATE(created_at) <= ?`,
                [groupId, date]
            );
            
            const [productivity] = await db.query(
                `SELECT AVG(CASE 
                    WHEN work_minutes > 0 THEN (processed_requests / (work_minutes / 60))
                    ELSE 0 
                  END) as avg_cph
                 FROM daily_metrics dm
                 JOIN employees e ON dm.employee_id = e.employee_id
                 WHERE e.group_id = ? 
                   AND dm.report_date >= DATE_SUB(?, INTERVAL 7 DAY)
                   AND dm.report_date <= ?
                   AND dm.verification_status = 'Одобрено'`,
                [groupId, date, date]
            );
            
            const stats = [];
            for (const emp of employees) {
                const closedCount = await this.getClosedCountByDate(emp.employee_id, date);
                const target = await this.getDynamicDailyTargetByDate(emp.employee_id, date, queue[0]?.queue_size || 0);
                const baseTarget = await this.getBaseDailyTarget();
                const current = closedCount;
                
                stats.push({
                    employee_id: emp.employee_id,
                    name: `${emp.last_name} ${emp.first_name}`,
                    avatar_url: emp.avatar_url,
                    current: current,
                    target: target,
                    baseTarget: baseTarget,
                    remaining: Math.max(0, target - current),
                    percent: Math.min(100, Math.round((current / target) * 100)),
                    isCompleted: current >= target,
                    isDynamic: target !== baseTarget,
                    queueInfo: queue[0]?.queue_size || 0,
                    groupProductivity: productivity[0]?.avg_cph ? parseFloat(productivity[0].avg_cph).toFixed(1) : '0'
                });
            }
            
            stats.sort((a, b) => {
                if (a.isCompleted === b.isCompleted) {
                    return b.percent - a.percent;
                }
                return a.isCompleted ? 1 : -1;
            });
            
            const totalEmployees = stats.length;
            const completedCount = stats.filter(s => s.isCompleted).length;
            const avgPercent = totalEmployees > 0 
                ? stats.reduce((sum, s) => sum + s.percent, 0) / totalEmployees 
                : 0;
            const totalClosed = stats.reduce((sum, s) => sum + s.current, 0);
            
            return {
                employees: stats,
                groupInfo: {
                    queueSize: queue[0]?.queue_size || 0,
                    avgProductivity: productivity[0]?.avg_cph ? parseFloat(productivity[0].avg_cph).toFixed(1) : '0',
                    activeEmployees: totalEmployees
                },
                summary: {
                    totalEmployees,
                    completedCount,
                    completionRate: totalEmployees > 0 ? (completedCount / totalEmployees * 100).toFixed(1) : 0,
                    avgPercent: avgPercent.toFixed(1),
                    totalClosed
                }
            };
        } catch (error) {
            console.error('Ошибка получения статистики группы по дате:', error);
            return null;
        }
    }
};

export default QuotaService;