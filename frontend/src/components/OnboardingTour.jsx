// frontend/src/components/OnboardingTour.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, Steps, Typography, Card } from 'antd';
import { 
  PlusOutlined, EyeOutlined, StarOutlined, 
  MessageOutlined, CheckCircleOutlined, FolderOpenOutlined,
  FileTextOutlined, UserOutlined, ClockCircleOutlined,
  ArrowRightOutlined, RightOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Step } = Steps;

// Компонент кастомной иконки для шагов
const StepIcon = ({ step, isActive, isFinished }) => {
  const icons = {
    0: "👋",  // Добро пожаловать
    1: "📝",  // Создание обращения
    2: "👁️",  // Просмотр обращений
    3: "📊",  // Статус-бар
    4: "💬",  // Чат с оператором
    5: "⭐",  // Оценка качества
    6: "🎉",  // Готово
  };
  
  const colors = {
    active: { bg: '#1890ff', text: '#fff' },
    finished: { bg: '#52c41a', text: '#fff' },
    waiting: { bg: '#f0f0f0', text: '#bfbfbf' }
  };
  
  let status = 'waiting';
  if (isActive) status = 'active';
  else if (isFinished) status = 'finished';
  
  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      backgroundColor: colors[status].bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 16,
      color: colors[status].text,
      transition: 'all 0.3s ease',
      boxShadow: isActive ? '0 0 0 3px rgba(24, 144, 255, 0.2)' : 'none'
    }}>
      {icons[step]}
    </div>
  );
};

const OnboardingTour = ({ visible, onClose, userRole }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setCurrentStep(0);
    }
  }, [visible]);

  // Шаги для клиента
  const clientSteps = [
    {
      title: "Добро пожаловать",
      icon: "👋",
      description: "Знакомство с системой",
      content: (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 20, color: '#1890ff' }}>
            👋
          </div>
          <Title level={3} style={{ marginBottom: 12 }}>Добро пожаловать!</Title>
          <Text type="secondary" style={{ fontSize: 15 }}>
            Вы зарегистрировались в системе поддержки. Давайте проведём вас по основным возможностям.
          </Text>
          <div style={{ marginTop: 24, padding: 16, background: '#f0f7ff', borderRadius: 8 }}>
            <Text>Это обучение займёт всего 1-2 минуты и поможет быстро освоиться.</Text>
          </div>
        </div>
      )
    },
    {
      title: "Создание обращения",
      icon: "📝",
      description: "Как создать новое обращение",
      element: "create-ticket-btn",
      content: (
        <div>
          <Text strong style={{ fontSize: 15 }}>Как создать обращение в поддержку?</Text>
          <div style={{ margin: '20px 0', textAlign: 'center' }}>
            <Button type="primary" size="large" icon={<PlusOutlined />} disabled style={{ height: 40, padding: '0 24px' }}>
              Создать обращение
            </Button>
          </div>
          <div style={{ marginTop: 16 }}>
            <Text strong>После нажатия на кнопку:</Text>
            <ul style={{ marginTop: 10, paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}><strong>Тема</strong> – кратко опишите проблему</li>
              <li style={{ marginBottom: 8 }}><strong>Описание</strong> – подробно расскажите о ситуации</li>
              <li style={{ marginBottom: 8 }}><strong>Категория</strong> – выберите тип обращения</li>
              <li style={{ marginBottom: 8 }}><strong>Приоритет</strong> – укажите срочность</li>
            </ul>
          </div>
          <div style={{ marginTop: 16, background: '#e6f7ff', padding: 12, borderRadius: 8 }}>
            <Text type="secondary">После отправки оператор свяжется с вами в чате!</Text>
          </div>
        </div>
      )
    },
    {
      title: "Просмотр обращений",
      icon: "👁️",
      description: "Отслеживайте статус",
      element: "tickets-table",
      content: (
        <div>
          <Text strong style={{ fontSize: 15 }}>Что можно делать в таблице обращений?</Text>
          <div style={{ marginTop: 20 }}>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 12 }}>
                <strong>Открыть обращение</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Нажмите на номер обращения, чтобы увидеть детали и чат</div>
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Отслеживать статус</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Новое → В работе → Решено → Закрыто</div>
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Оценивать качество</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>После решения проблемы можно поставить оценку</div>
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Отменять обращение</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Если проблема решилась самостоятельно</div>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Статус-бар",
      icon: "📊",
      description: "Этапы обработки",
      element: "ticket-status-steps",
      content: (
        <div>
          <Text strong style={{ fontSize: 15 }}>Как понять, на каком этапе ваше обращение?</Text>
          <div style={{ margin: '20px 0' }}>
            <Steps current={1} size="small">
              <Step title="Создано" />
              <Step title="В работе" />
              <Step title="Решено" />
              <Step title="Закрыто" />
            </Steps>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, flexShrink: 0 }}>1</div>
              <div>
                <strong>Создано</strong>
                <div style={{ fontSize: 13, color: '#666' }}>Обращение отправлено, ожидает оператора</div>
              </div>
            </div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, flexShrink: 0 }}>2</div>
              <div>
                <strong>В работе</strong>
                <div style={{ fontSize: 13, color: '#666' }}>Оператор взял обращение и решает проблему</div>
              </div>
            </div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#faad14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, flexShrink: 0 }}>3</div>
              <div>
                <strong>Решено</strong>
                <div style={{ fontSize: 13, color: '#666' }}>Проблема решена, ждёт вашей оценки</div>
              </div>
            </div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, flexShrink: 0 }}>4</div>
              <div>
                <strong>Закрыто</strong>
                <div style={{ fontSize: 13, color: '#666' }}>Вы оценили обслуживание, обращение завершено</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Чат с оператором",
      icon: "💬",
      description: "Общайтесь в реальном времени",
      element: "ticket-chat",
      content: (
        <div>
          <Text strong style={{ fontSize: 15 }}>Как общаться с оператором?</Text>
          <div style={{ marginTop: 20 }}>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 12 }}>
                <strong>Отправляйте сообщения</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Напишите оператору, чтобы уточнить детали</div>
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Прикрепляйте файлы</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Скриншоты, документы, фотографии – до 10 МБ</div>
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Мгновенные уведомления</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Сообщения приходят сразу – не нужно обновлять страницу</div>
              </li>
            </ul>
          </div>
          <div style={{ marginTop: 16, background: '#f6ffed', padding: 12, borderRadius: 8 }}>
            <Text type="secondary">Оператор ответит вам в ближайшее время</Text>
          </div>
        </div>
      )
    },
    {
      title: "Оценка качества",
      icon: "⭐",
      description: "Как оценить работу оператора",
      element: "rate-ticket-btn",
      content: (
        <div>
          <Text strong style={{ fontSize: 15 }}>Когда обращение решено, появится кнопка:</Text>
          <div style={{ margin: '20px 0', textAlign: 'center' }}>
            <Button type="primary" size="large" icon={<StarOutlined />} disabled style={{ height: 40, padding: '0 24px' }}>
              Оценить
            </Button>
          </div>
          <div style={{ marginTop: 16 }}>
            <Text strong>Вы можете поставить оценку от 1 до 5 звёзд:</Text>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16 }}>⭐</span>
                <div>1-2 – плохо, нужно улучшение</div>
              </div>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16 }}>⭐⭐⭐</span>
                <div>3 – удовлетворительно</div>
              </div>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16 }}>⭐⭐⭐⭐⭐</span>
                <div>4-5 – отлично!</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, background: '#fff7e6', padding: 12, borderRadius: 8 }}>
            <Text type="secondary">Ваши оценки помогают нам становиться лучше!</Text>
          </div>
        </div>
      )
    },
    {
      title: "Готово",
      icon: "🎉",
      description: "Вы готовы к работе",
      content: (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 20, color: '#52c41a' }}>
            🎉
          </div>
          <Title level={3} style={{ marginBottom: 12 }}>Вы готовы к работе!</Title>
          <Text type="secondary" style={{ fontSize: 15 }}>
            Теперь вы знаете, как создавать обращения, общаться с операторами и оценивать качество обслуживания.
          </Text>
          <div style={{ marginTop: 24, padding: 16, background: '#f0f7ff', borderRadius: 8 }}>
            <Text>Если возникнут вопросы – свяжитесь с поддержкой.</Text>
          </div>
        </div>
      )
    }
  ];

  const steps = clientSteps;
  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setCurrentStep(currentStep + 1);
      scrollToElement(steps[currentStep + 1]?.element);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollToElement(steps[currentStep - 1]?.element);
    }
  };

  const handleFinish = () => {
    setOpen(false);
    setCurrentStep(0);
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('onboarding_completed_date', new Date().toISOString());
    onClose();
  };

  const scrollToElement = (elementId) => {
    if (!elementId) return;
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.style.transition = 'box-shadow 0.3s';
        element.style.boxShadow = '0 0 0 3px #1890ff';
        setTimeout(() => {
          element.style.boxShadow = '';
        }, 2000);
      }
    }, 300);
  };

  // Кастомный рендер шагов
  const customSteps = steps.map((step, idx) => {
    const isActive = currentStep === idx;
    const isFinished = currentStep > idx;
    
    let status = 'wait';
    if (isActive) status = 'process';
    if (isFinished) status = 'finish';
    
    return (
      <div 
        key={idx} 
        style={{
          flex: 1,
          textAlign: 'center',
          position: 'relative',
          cursor: 'pointer'
        }}
        onClick={() => setCurrentStep(idx)}
      >
        {/* Соединительная линия */}
        {idx < steps.length - 1 && (
          <div style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            right: '-50%',
            height: 2,
            backgroundColor: isFinished ? '#52c41a' : '#e8e8e8',
            zIndex: 0
          }} />
        )}
        
        {/* Иконка */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: isActive ? '#1890ff' : (isFinished ? '#52c41a' : '#f0f0f0'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 8px auto',
          position: 'relative',
          zIndex: 1,
          transition: 'all 0.3s ease',
          boxShadow: isActive ? '0 0 0 3px rgba(24, 144, 255, 0.2)' : 'none',
          fontSize: 16,
          color: (isActive || isFinished) ? '#fff' : '#bfbfbf'
        }}>
          {step.icon}
        </div>
        
        {/* Название */}
        <div style={{
          fontSize: 12,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#1890ff' : (isFinished ? '#52c41a' : '#999'),
          whiteSpace: 'normal',
          wordBreak: 'keep-all',
          lineHeight: 1.4,
          padding: '0 4px'
        }}>
          {step.title}
        </div>
      </div>
    );
  });

  return (
    <Modal
      className="onboarding-modal"
      title={
        <Space size="middle">
          <span style={{ fontSize: 18, fontWeight: 500 }}>Обучение работе с системой</span>
        </Space>
      }
      open={open}
      onCancel={handleFinish}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {currentStep > 0 && currentStep < totalSteps - 1 && (
              <Button onClick={handlePrev} size="large">
                ← Назад
              </Button>
            )}
          </div>
          <div>
            <Button onClick={handleFinish} size="large" style={{ marginRight: 12 }}>
              Пропустить
            </Button>
            <Button type="primary" size="large" onClick={handleNext}>
              {isLastStep ? '🎉 Завершить' : 'Далее →'}
            </Button>
          </div>
        </div>
      }
      width={750}
      maskClosable={false}
      closable={false}
      bodyStyle={{ padding: '24px 32px' }}
    >
      {/* Кастомная навигация */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        marginBottom: 40,
        padding: '0 8px'
      }}>
        {customSteps}
      </div>
      
      <div style={{ minHeight: 380 }}>
        {steps[currentStep].content}
      </div>
      
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Text type="secondary">
          Шаг {currentStep + 1} из {totalSteps}
        </Text>
      </div>
    </Modal>
  );
};

export default OnboardingTour;