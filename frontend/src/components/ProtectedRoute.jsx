import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div>Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Если указаны allowedRoles, проверяем роль пользователя
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Для руководителей перенаправляем на их дашборд
    if (
      user.role === "Руководитель группы" ||
      user.role === "Руководитель отдела"
    ) {
      return <Navigate to="/group-leader" replace />;
    }
    // Для обычных сотрудников - на обычный дашборд
    return <Navigate to="/dashboard" replace />;
  }

  // Если children - функция, передаем ей user
  if (typeof children === "function") {
    return children(user);
  }

  return children;
};

export default ProtectedRoute;
