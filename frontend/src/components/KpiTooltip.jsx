// frontend/src/components/KpiTooltip.jsx
import React from 'react';
import { Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

// Словарь с описаниями всех KPI
export const KPI_DEFINITIONS = {
  csat: {
    name: 'CSAT (Customer Satisfaction Score)',
    description: 'Показатель удовлетворенности клиентов работой сотрудника',
    formula: 'CSAT = (Количество положительных отзывов / Общее количество отзывов) × 100%',
    example: '45 положительных отзывов из 50 → CSAT = 90%',
    target: 'Целевое значение: ≥ 85%',
    color: '#faad14',
  },
  fcr: {
    name: 'FCR (First Contact Resolution)',
    description: 'Процент запросов, решенных при первом обращении клиента',
    formula: 'FCR = (Решено с первого контакта / Всего запросов) × 100%',
    example: '65 решено сразу из 80 → FCR = 81.25%',
    target: 'Целевое значение: ≥ 75%',
    color: '#52c41a',
  },
  contacts_per_hour: {
    name: 'Контакты в час',
    description: 'Количество обработанных запросов за один час рабочего времени',
    formula: 'Контакты/час = Обработанные запросы / (Время работы в минутах / 60)',
    example: 'За 7 часов обработано 56 запросов → 8 контактов/час',
    target: 'Целевое значение: ≥ 8',
    color: '#1890ff',
  },
  quality_score: {
    name: 'Оценка качества',
    description: 'Оценка качества обслуживания по шкале от 1 до 5',
    formula: 'Качество = Сумма баллов за проверенные запросы / Количество проверенных запросов',
    example: '92 балла за 20 проверенных запросов → 4.6/5',
    target: 'Целевое значение: ≥ 4.5',
    color: '#722ed1',
  },
  productivity: {
    name: 'Производительность',
    description: 'Эффективность обработки запросов',
    formula: 'Производительность = Обработанные запросы / Часы работы',
    target: 'Целевое значение: ≥ 8 запросов/час',
    color: '#1890ff',
  },
  processed_requests: {
    name: 'Обработанные запросы',
    description: 'Общее количество запросов, обработанных сотрудником за период',
    target: 'Чем больше, тем лучше (при сохранении качества)',
    color: '#1890ff',
  },
  work_minutes: {
    name: 'Время работы',
    description: 'Фактическое время работы сотрудника в системе',
    format: 'Переводится в часы и минуты',
    color: '#52c41a',
  },
  positive_feedbacks: {
    name: 'Положительные отзывы',
    description: 'Количество оценок "хорошо" или "отлично" от клиентов',
    color: '#52c41a',
  },
  total_feedbacks: {
    name: 'Всего отзывов',
    description: 'Общее количество полученных оценок от клиентов',
    color: '#faad14',
  },
  first_contact_resolved: {
    name: 'Решение с первого контакта',
    description: 'Запросы, которые не потребовали повторных обращений клиента',
    formula: 'Используется для расчета FCR',
    color: '#52c41a',
  },
  total_requests: {
    name: 'Всего запросов',
    description: 'Общее количество поступивших запросов за период',
    color: '#1890ff',
  },
  avg_quality: {
    name: 'Средняя оценка качества',
    description: 'Средний балл качества за все проверенные дни',
    formula: 'Сумма баллов качества / Количество дней',
    target: 'Целевое значение: ≥ 4.5/5',
    color: '#722ed1',
  },
  avg_csat: {
    name: 'Средний CSAT',
    description: 'Средняя удовлетворенность клиентов за выбранный период',
    formula: 'Среднее арифметическое CSAT по всем дням',
    target: 'Целевое значение: ≥ 85%',
    color: '#faad14',
  },
  avg_fcr: {
    name: 'Средний FCR',
    description: 'Средний процент решений с первого контакта за период',
    target: 'Целевое значение: ≥ 75%',
    color: '#52c41a',
  },
  avg_contacts_per_hour: {
    name: 'Средние контакты в час',
    description: 'Средняя производительность сотрудника за период',
    target: 'Целевое значение: ≥ 8',
    color: '#1890ff',
  },
  quality_score_raw: {
    name: 'Балл качества',
    description: 'Суммарный балл качества по проверенным запросам',
    color: '#722ed1',
  },
  checked_requests: {
    name: 'Проверенные запросы',
    description: 'Количество запросов, проверенных руководителем',
    color: '#722ed1',
  },
  total_tickets: {
    name: 'Всего обращений',
    description: 'Общее количество обращений, созданных за выбранный период',
    formula: 'COUNT(ticket_id)',
    target: 'Чем больше, тем лучше (при сохранении качества)',
    color: '#1890ff',
  },
  closed_tickets: {
    name: 'Закрытые обращения',
    description: 'Количество обращений, которые были успешно завершены',
    formula: 'COUNT(status = "closed" OR status = "resolved")',
    target: 'Показатель завершённых кейсов',
    color: '#52c41a',
  },
  avg_rating: {
    name: 'Средняя оценка клиентов',
    description: 'Средний балл удовлетворённости клиентов по шкале от 1 до 5',
    formula: 'SUM(satisfaction_rating) / COUNT(satisfaction_rating)',
    example: 'Сумма 45 баллов за 10 оценок → 4.5/5',
    target: 'Целевое значение: ≥ 4.5/5',
    color: '#faad14',
  },
  avg_resolution_time: {
    name: 'Среднее время решения',
    description: 'Среднее время от создания обращения до его закрытия',
    formula: 'AVG(resolution_time_minutes)',
    example: 'Общее время 600 минут за 10 обращений → 60 минут',
    target: 'Чем меньше, тем лучше',
    color: '#722ed1',
  },
  avg_first_response: {
    name: 'Среднее время первого ответа',
    description: 'Среднее время от создания обращения до первого ответа оператора',
    formula: 'AVG(first_response_time_minutes)',
    example: 'Первый ответ через 5, 10, 15 минут → среднее 10 минут',
    target: 'SLA: urgent ≤ 15 мин, high ≤ 60 мин, medium ≤ 240 мин',
    color: '#eb2f96',
  },
  new_tickets: {
    name: 'Новые обращения',
    description: 'Обращения, которые еще не взяты в работу оператором',
    formula: 'COUNT(status = "new")',
    target: 'Чем меньше, тем лучше (очередь не должна расти)',
    color: '#fa8c16',
  },
  in_progress_tickets: {
    name: 'Обращения в работе',
    description: 'Активные обращения, над которыми работают операторы',
    formula: 'COUNT(status = "in_progress")',
    target: 'Нормальная загрузка команды',
    color: '#1890ff',
  },
  daily_trend: {
    name: 'Динамика обращений',
    description: 'График показывает количество обращений и среднюю оценку по дням',
    color: '#1890ff',
  },
  priority_distribution: {
    name: 'Распределение по приоритетам',
    description: 'Показывает, сколько обращений каждого приоритета было создано',
    color: '#52c41a',
  },
  status_distribution: {
    name: 'Статусы обращений',
    description: 'Текущее состояние всех обращений в системе',
    color: '#faad14',
  },
  operator_ranking: {
    name: 'Рейтинг операторов',
    description: 'Операторы отсортированы по средней оценке клиентов',
    formula: 'AVG(satisfaction_rating) по каждому оператору',
    target: 'Стремитесь к 5★',
    color: '#722ed1',
  },
};

/**
 * Компонент для отображения KPI с подсказкой при наведении
 * @param {string} metric - Ключ метрики из KPI_DEFINITIONS
 * @param {React.ReactNode} children - Отображаемое значение/контент
 * @param {string} placement - Позиция подсказки (top, bottom, left, right)
 * @param {boolean} showIcon - Показывать ли иконку информации
 */
export const KpiTooltip = ({ metric, children, placement = 'top', showIcon = true }) => {
  const def = KPI_DEFINITIONS[metric];
  
  if (!def) {
    return <>{children}</>;
  }
  
  const tooltipContent = (
    <div style={{ maxWidth: 300 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: 14, color: def.color }}>
        {def.name}
      </div>
      <div style={{ fontSize: 12, marginBottom: 8, color: '#d9d9d9' }}>
        {def.description}
      </div>
      {def.formula && (
        <div style={{ 
          fontSize: 11, 
          background: 'rgba(255,255,255,0.08)', 
          padding: '6px 8px', 
          borderRadius: 6, 
          marginBottom: 6,
          fontFamily: 'monospace'
        }}>
          <strong>Формула:</strong> {def.formula}
        </div>
      )}
      {def.example && (
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>
          <strong>Пример:</strong> {def.example}
        </div>
      )}
      {def.target && (
        <div style={{ fontSize: 11, color: '#52c41a', marginTop: 4 }}>
          <strong>Цель:</strong> {def.target}
        </div>
      )}
    </div>
  );
  
  return (
    <Tooltip title={tooltipContent} placement={placement} color="#1e1e1e" overlayStyle={{ maxWidth: 320 }}>
      <span style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        {showIcon && <InfoCircleOutlined style={{ fontSize: 12, color: '#888', opacity: 0.7 }} />}
      </span>
    </Tooltip>
  );
};

/**
 * Компонент для отображения заголовка таблицы с подсказкой
 * 👇 ЭТОТ КОМПОНЕНТ БЫЛ ОТСУТСТВОВАЛ - ТЕПЕРЬ ОН ЕСТЬ 👇
 */
export const KpiColumnTitle = ({ metric, title }) => (
  <KpiTooltip metric={metric} placement="top" showIcon={false}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {title}
      <InfoCircleOutlined style={{ fontSize: 11, color: '#888', opacity: 0.6 }} />
    </span>
  </KpiTooltip>
);

/**
 * Упрощенный компонент для ячейки таблицы со значением KPI
 */
export const KpiCell = ({ metric, value, suffix = '%', precision = 1 }) => {
  const formattedValue = typeof value === 'number' 
    ? value.toFixed(precision) 
    : value;
  
  return (
    <KpiTooltip metric={metric}>
      <span>{formattedValue}{suffix}</span>
    </KpiTooltip>
  );
};

export default KpiTooltip;