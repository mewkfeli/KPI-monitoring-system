// server.js - исправленная версия
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import cron from "node-cron";
import authRoutes from "./auth.routes.js";
import metricsRoutes from "./metrics.routes.js";
import groupRoutes from "./group.routes.js";
import chatRoutes from "./chat.routes.js";
import { db } from "./db.js";
import { KPICollector } from "./services/kpiCollector.service.js";

const app = express();

// Настройка CORS для Express
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

const server = http.createServer(app);

// Настройка Socket.IO с CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ['websocket', 'polling'], // разрешаем оба транспорта
});

// Маршруты
app.use("/api/auth", authRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/chat", chatRoutes);

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ============= SOCKET.IO ЧАТ =============
const activeUsers = new Map();

io.use(async (socket, next) => {
  const employeeId = socket.handshake.auth.employeeId;
  console.log("Socket auth attempt, employeeId:", employeeId);
  
  if (!employeeId) {
    console.log("No employeeId provided");
    return next(new Error("Не авторизован"));
  }
  
  try {
    const [rows] = await db.query(
      `SELECT e.employee_id, e.group_id, e.last_name, e.first_name, e.role 
       FROM employees e 
       WHERE e.employee_id = ? AND e.status = 'Активен'`,
      [employeeId]
    );
    
    if (rows.length === 0) {
      console.log("Employee not found:", employeeId);
      return next(new Error("Сотрудник не найден или не активен"));
    }
    
    socket.user = {
      employee_id: rows[0].employee_id,
      group_id: rows[0].group_id,
      full_name: `${rows[0].first_name} ${rows[0].last_name}`,
      role: rows[0].role,
    };
    console.log("Socket authenticated:", socket.user.full_name);
    next();
  } catch (error) {
    console.error("Socket auth error:", error);
    next(new Error("Ошибка авторизации"));
  }
});

io.on("connection", (socket) => {
  const user = socket.user;
  console.log(`🔌 Пользователь подключен: ${user.full_name} (${user.employee_id})`);

  activeUsers.set(socket.id, user);
  socket.join(`group_${user.group_id}`);
  console.log(`📢 ${user.full_name} присоединился к комнате group_${user.group_id}`);
  
  // Отправляем обновленный список пользователей
  const groupUsers = Array.from(activeUsers.values())
    .filter(u => u.group_id === user.group_id);
  
  io.to(`group_${user.group_id}`).emit("users_online", groupUsers);
  console.log(`👥 В группе ${user.group_id} сейчас ${groupUsers.length} пользователей`);

  // Обработка нового сообщения
  socket.on("send_message", async (data) => {
    const { message } = data;
    console.log(`📝 Получено сообщение от ${user.full_name}: ${message.substring(0, 50)}...`);
    
    if (!message || message.trim().length === 0) {
      socket.emit("error", { message: "Сообщение не может быть пустым" });
      return;
    }
    
    if (message.length > 2000) {
      socket.emit("error", { message: "Сообщение слишком длинное (макс. 2000 символов)" });
      return;
    }
    
    try {
      const [result] = await db.query(
        `INSERT INTO chat_messages (group_id, sender_id, message) VALUES (?, ?, ?)`,
        [user.group_id, user.employee_id, message.trim()]
      );
      
const messageData = {
  message_id: result.insertId,
  group_id: user.group_id,
  sender_id: user.employee_id,
  sender_name: user.full_name,
  sender_role: user.role,
  message: message.trim(),
  created_at: new Date().toISOString(),
  status: 'sent',  // ← ДОБАВИТЬ ЭТУ СТРОКУ
  read_count: 0,
};
      
      console.log(`✅ Сообщение сохранено (ID: ${result.insertId}), рассылаем в группу ${user.group_id}`);
      io.to(`group_${user.group_id}`).emit("new_message", messageData);
      
    } catch (error) {
      console.error("Ошибка сохранения сообщения:", error);
      socket.emit("error", { message: "Ошибка при отправке сообщения" });
    }
  });

  // Обработка отметки о прочтении
  socket.on("mark_read", async (data) => {
    const { message_id } = data;
    
    try {
      await db.query(
        `INSERT IGNORE INTO chat_read_receipts (message_id, user_id) VALUES (?, ?)`,
        [message_id, user.employee_id]
      );
      
      const [countResult] = await db.query(
        `SELECT COUNT(*) as read_count FROM chat_read_receipts WHERE message_id = ?`,
        [message_id]
      );
      
      io.to(`group_${user.group_id}`).emit("read_update", {
        message_id,
        read_count: countResult[0].read_count,
        user_id: user.employee_id,
      });
    } catch (error) {
      console.error("Ошибка отметки прочтения:", error);
    }
  });

  // Печатает...
  socket.on("typing", (data) => {
    socket.to(`group_${user.group_id}`).emit("user_typing", {
      user_id: user.employee_id,
      user_name: user.full_name,
      is_typing: data.is_typing,
    });
  });

  // Отключение
  socket.on("disconnect", () => {
    console.log(`🔌 Пользователь отключен: ${user.full_name}`);
    activeUsers.delete(socket.id);
    
    const groupUsers = Array.from(activeUsers.values())
      .filter(u => u.group_id === user.group_id);
    
    io.to(`group_${user.group_id}`).emit("users_online", groupUsers);
  });
});

// ============= АВТОМАТИЧЕСКИЙ СБОР KPI =============
cron.schedule('59 23 * * *', async () => {
  console.log('⏰ Запуск планового сбора KPI за сегодня...');
  await KPICollector.collectForAllEmployees(new Date());
});

setTimeout(async () => {
  console.log('🔄 Проверка данных за сегодня при старте...');
  await KPICollector.collectForAllEmployees(new Date());
}, 5000);
app.use("/api/chat", chatRoutes);
// ============= ЗАПУСК СЕРВЕРА =============
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Backend запущен на http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO сервер запущен`);
  console.log(`🤖 Автосбор KPI будет выполняться ежедневно в 23:59`);
});