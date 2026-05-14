// frontend/src/components/ChatButton.jsx
import React, { useState, useEffect } from "react";
import { Button, Badge, message } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import Chat from "./Chat";

const ChatButton = ({ userId }) => {
  const [visible, setVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Получаем количество непрочитанных сообщений
  const fetchUnreadCount = async () => {
    if (!userId) return;
    
    try {
      // Сначала получаем группу пользователя
      const groupRes = await fetch(
        `http://localhost:5000/api/chat/my-group?employee_id=${userId}`
      );
      
      // Проверяем, что ответ успешный и это JSON
      if (!groupRes.ok) {
        console.error('Ошибка получения группы:', groupRes.status);
        return;
      }
      
      const groupData = await groupRes.json();
      
      if (groupData.group_id) {
        const unreadRes = await fetch(
          `http://localhost:5000/api/chat/unread-count?user_id=${userId}&chat_type=group&chat_id=${groupData.group_id}`
        );
        
        if (!unreadRes.ok) {
          console.error('Ошибка получения непрочитанных:', unreadRes.status);
          return;
        }
        
        const data = await unreadRes.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error("Ошибка получения непрочитанных:", error);
      // Не показываем message.error, чтобы не спамить пользователя
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    // Обновляем каждые 30 секунд
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <>
      <Badge count={unreadCount} offset={[-5, 5]} size="small">
        <Button
          icon={<MessageOutlined />}
          onClick={() => setVisible(true)}
          type={unreadCount > 0 ? "primary" : "default"}
        >
          Чат
        </Button>
      </Badge>
      <Chat visible={visible} onClose={() => setVisible(false)} />
    </>
  );
};

export default ChatButton;