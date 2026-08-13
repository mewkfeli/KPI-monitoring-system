// frontend/src/pages/VerifyEmail.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { MailOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/useAuth';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text } = Typography;

const VerifyEmail = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [email, setEmail] = useState(location.state?.email || '');

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, code: values.code })
      });

      const data = await response.json();

      if (response.ok) {
        message.success('Email подтверждён!');
        // Автоматический вход
        const loginResult = await login(values.email, location.state?.password);
        if (loginResult.success) {
          navigate('/dashboard');
        }
      } else {
        message.error(data.error || 'Ошибка подтверждения');
      }
    } catch (error) {
      message.error('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!email) {
      message.warning('Введите email');
      return;
    }
    setResendLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) {
        message.success('Новый код отправлен на почту');
      } else {
        message.error(data.error || 'Ошибка');
      }
    } catch (error) {
      message.error('Ошибка соединения');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: "url('/images/login-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '20px',
      }}
    >
      {isDark && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 0,
          }}
        />
      )}

      <Card
        style={{
          width: '100%',
          maxWidth: '450px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          position: 'relative',
          zIndex: 1,
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
        }}
        bodyStyle={{ padding: '24px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <MailOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <Title level={2} style={{ color: '#1890ff', marginBottom: 8 }}>
            Подтверждение email
          </Title>
          <Text type="secondary" style={{ color: isDark ? '#a0a0a0' : '#666' }}>
            Введите код, отправленный на вашу почту
          </Text>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="email"
            label="Email"
            initialValue={email}
            rules={[{ required: true, type: 'email', message: 'Введите email' }]}
          >
            <Input
              size="large"
              placeholder="ivan@example.com"
              prefix={<MailOutlined />}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                borderColor: isDark ? '#3d3d3d' : '#d9d9d9',
                color: isDark ? '#e8e8e8' : '#1a1a1a',
              }}
            />
          </Form.Item>

          <Form.Item
            name="code"
            label="Код подтверждения"
            rules={[{ required: true, len: 6, message: 'Введите 6-значный код' }]}
          >
            <Input
              size="large"
              placeholder="000000"
              maxLength={6}
              style={{
                backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                borderColor: isDark ? '#3d3d3d' : '#d9d9d9',
                color: isDark ? '#e8e8e8' : '#1a1a1a',
                textAlign: 'center',
                fontSize: 20,
                letterSpacing: 8,
              }}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Подтвердить
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Button
              type="link"
              icon={<ReloadOutlined />}
              onClick={resendCode}
              loading={resendLoading}
            >
              Отправить код повторно
            </Button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Text type="secondary" style={{ color: isDark ? '#a0a0a0' : '#666' }}>
              Не пришло письмо? Проверьте папку "Спам"
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default VerifyEmail;