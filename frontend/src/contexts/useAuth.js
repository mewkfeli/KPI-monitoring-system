import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = async (username, password) => {
  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
     if (res.ok) {
      const userData = await res.json();
      console.log("Данные пользователя при логине:", userData);
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return { success: true, data: userData };
    }
    const data = await res.json();
    console.log("Ответ сервера при логине:", data);

    if (!res.ok) {
      let errorMessage = "Ошибка входа";

      if (data.error) {
        errorMessage = data.error;
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.errors && data.errors.length) {
        errorMessage = data.errors.map(e => e.msg).join("; ");
      }

      return { success: false, error: errorMessage };
    }

    setUser(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || "Ошибка входа" };
  }
};


  const logout = () => setUser(null);

  const register = async (userData) => {
  try {
    console.log("Отправляем на сервер:", userData);

    const res = await fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Ошибка регистрации с сервера:", errorData);
      return { success: false, message: errorData.message || "Ошибка регистрации" };
    }

    return { success: true };
  } catch (error) {
    console.error("Ошибка регистрации:", error);
    return { success: false, message: error.message || "Ошибка регистрации" };
  }
};

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
