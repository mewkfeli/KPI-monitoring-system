// frontend/src/components/DailyQuotaWidget.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Progress, Tag, Spin, Alert, Tooltip } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';

const DailyQuotaWidget = ({ userId, userStatus, refreshTrigger }) => {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/quota/my?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Данные нормы для виджета:', data);
        setQuota(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки нормы:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota, refreshTrigger]);

  // Автообновление каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(fetchQuota, 30000);
    return () => clearInterval(interval);
  }, [fetchQuota]);

  if (loading) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Spin size="small" />
      </Card>
    );
  }

  if (!quota) return null;

  const isCompleted = quota.isCompleted;
  const percent = quota.percent;
  
  // Форматируем дату для отображения
  const getQuotaDateText = () => {
    if (!quota.quotaDate) return 'сегодня';
    const date = new Date(quota.quotaDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Проверяем, совпадает ли с сегодня
    if (date.toDateString() === today.toDateString()) {
      return 'сегодня';
    }
    // Проверяем, совпадает ли с вчера
    if (date.toDateString() === yesterday.toDateString()) {
      return 'вчера';
    }
    // Иначе показываем полную дату
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <Card size="small" style={{ 
      marginBottom: 16,
      background: isCompleted ? 'rgba(82,196,26,0.1)' : 'rgba(24,144,255,0.05)',
      borderLeft: `4px solid ${isCompleted ? '#52c41a' : '#1890ff'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Дневная норма обращений</span>
            {quota.isDynamic && (
              <Tooltip title="Норма скорректирована с учётом загруженности группы">
                <InfoCircleOutlined style={{ color: '#faad14', fontSize: 12 }} />
              </Tooltip>
            )}
          </div>
          {/* 👇 ЗДЕСЬ ДОБАВЛЯЕМ СТРОКУ С ДАТОЙ 👇 */}
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            Норма за {getQuotaDateText()}
          </div>
          <div>
            <span style={{ fontSize: 28, fontWeight: 'bold', color: isCompleted ? '#52c41a' : '#1890ff' }}>
              {quota.current}
            </span>
            <span style={{ fontSize: 16, color: '#888' }}> / {quota.target}</span>
          </div>
        </div>
        
        <div style={{ width: 200 }}>
          <Progress 
            percent={percent} 
            size="small" 
            strokeColor={isCompleted ? '#52c41a' : '#1890ff'}
            status={isCompleted ? 'success' : 'active'}
          />
        </div>
        
        {isCompleted ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            🎉 Норма выполнена!
          </Tag>
        ) : (
          <Tag color="processing" icon={<ClockCircleOutlined />}>
            Осталось: {quota.remaining}
          </Tag>
        )}
      </div>
    </Card>
  );
};

export default DailyQuotaWidget;