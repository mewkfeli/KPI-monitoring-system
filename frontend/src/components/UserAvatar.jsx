import React from "react";
import { Avatar } from "antd";
import { UserOutlined } from "@ant-design/icons";

const UserAvatar = ({ user, size = 80 }) => {
  // Получаем первую букву имени или фамилии
  const getFirstLetter = () => {
    // Сначала пробуем взять первую букву имени
    if (user?.first_name && user.first_name.trim()) {
      return user.first_name.charAt(0).toUpperCase();
    }
    // Если имени нет, пробуем взять первую букву фамилии
    if (user?.last_name && user.last_name.trim()) {
      return user.last_name.charAt(0).toUpperCase();
    }
    // Если ничего нет, берем первую букву username
    if (user?.username && user.username.trim()) {
      return user.username.charAt(0).toUpperCase();
    }
    return null;
  };

  const firstLetter = getFirstLetter();

  if (firstLetter) {
    return (
      <Avatar
        size={size}
        style={{
          backgroundColor: "#1890ff",
          fontSize: size === 80 ? "32px" : size === 64 ? "24px" : "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {firstLetter}
      </Avatar>
    );
  }

  return (
    <Avatar
      size={size}
      icon={<UserOutlined />}
      style={{ backgroundColor: "#1890ff" }}
    />
  );
};

export default UserAvatar;
