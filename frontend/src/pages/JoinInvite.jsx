import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { message, Spin } from 'antd';

const JoinInvite = () => {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const join = async () => {
      if (!user?.employee_id) {
        message.error('Требуется авторизация');
        navigate('/login');
        return;
      }
      try {
        const response = await fetch('http://localhost:5000/api/chat/join-by-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite_code: code, user_id: user.employee_id }),
        });
        if (response.ok) {
          message.success('Вы присоединились к чату');
          navigate('/chat');
        } else {
          message.error('Ссылка недействительна');
          navigate('/chat');
        }
      } catch (error) {
        console.error('Ошибка присоединения по ссылке:', error);
        message.error('Ошибка присоединения');
        navigate('/chat');
      }
    };

    join();
  }, [code, user, navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spin size="large" />
    </div>
  );
};

export default JoinInvite;
