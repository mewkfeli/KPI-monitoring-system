// NotificationBell.jsx
import React, { useState, useEffect } from "react";
import { Badge, Popover, List, Button, Empty, Spin, message } from "antd";
import { BellOutlined, CheckOutlined } from "@ant-design/icons";

const NotificationBell = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/notifications?user_id=${userId}&limit=20`,
      );
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        const unread = data.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Ошибка загрузки уведомлений:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!userId) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/notifications/unread-count?user_id=${userId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Ошибка загрузки счетчика:", error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/notifications/${notificationId}/read`,
        { method: "PUT" },
      );
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.notification_id === notificationId ? { ...n, is_read: 1 } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Ошибка отметки о прочтении:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/notifications/read-all`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        },
      );
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
        message.success("Все уведомления отмечены как прочитанные");
      }
    } catch (error) {
      console.error("Ошибка:", error);
      message.error("Ошибка при отметке уведомлений");
    }
  };

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      // Обновляем счетчик каждые 30 секунд
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchNotifications();
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "success":
        return "#52c41a";
      case "error":
        return "#ff4d4f";
      case "warning":
        return "#faad14";
      default:
        return "#1890ff";
    }
  };

  const notificationContent = (
    <div style={{ width: 350, maxHeight: 400, overflowY: "auto" }}>
      {loading ? (
        <div style={{ textAlign: "center", padding: 20 }}>
          <Spin />
        </div>
      ) : notifications.length === 0 ? (
        <Empty description="Нет уведомлений" />
      ) : (
        <>
          <div style={{ textAlign: "right", padding: "8px 12px" }}>
            <Button
              size="small"
              onClick={markAllAsRead}
              icon={<CheckOutlined />}
            >
              Прочитать все
            </Button>
          </div>
          <List
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item
                style={{
                  background: item.is_read ? "transparent" : "#f0f7ff",
                  cursor: "pointer",
                  padding: "12px",
                  borderRadius: "4px",
                  marginBottom: "4px",
                  borderLeft: `3px solid ${getNotificationColor(item.notification_type)}`,
                }}
                onClick={() =>
                  !item.is_read && markAsRead(item.notification_id)
                }
              >
                <List.Item.Meta
                  title={
                    <span
                      style={{ fontWeight: item.is_read ? "normal" : "bold" }}
                    >
                      {item.title}
                    </span>
                  }
                  description={
                    <div>
                      <div style={{ whiteSpace: "pre-line", fontSize: 12 }}>
                        {item.message}
                      </div>
                      <div
                        style={{ fontSize: 10, color: "#999", marginTop: 4 }}
                      >
                        {new Date(item.created_at).toLocaleString("ru-RU")}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </div>
  );

  return (
    <Popover
      content={notificationContent}
      title="Уведомления"
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-5, 5]}>
        <Button icon={<BellOutlined />} type="text" />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
