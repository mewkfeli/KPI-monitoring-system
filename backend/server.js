// server.js
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cron from "node-cron";
import fs from "fs";
import authRoutes from "./auth.routes.js";
import metricsRoutes from "./metrics.routes.js";
import groupRoutes from "./group.routes.js";
import chatRoutes from "./chat.routes.js";
import { db } from "./db.js";
import { KPICollector } from "./services/kpiCollector.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Настройка CORS
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ - АБСОЛЮТНЫЙ ПУТЬ
const uploadsPath = path.join(__dirname, 'uploads');
console.log('📁 Папка для статики:', uploadsPath);
console.log('📁 Существует?', fs.existsSync(uploadsPath));

// Проверяем и создаём папку если нужно
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
const chatPath = path.join(uploadsPath, 'chat');
if (!fs.existsSync(chatPath)) {
  fs.mkdirSync(chatPath, { recursive: true });
}

// РАЗДАЧА СТАТИКИ - ГЛАВНОЕ
app.use('/uploads', express.static(uploadsPath));

// ДОБАВЛЯЕМ ЯВНЫЙ МАРШРУТ ДЛЯ ФАЙЛОВ
app.get('/uploads/chat/:filename', (req, res) => {
  const filepath = path.join(chatPath, req.params.filename);
  console.log('🔍 Запрос файла:', filepath);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    console.log('❌ Файл не найден:', filepath);
    res.status(404).json({ error: 'File not found' });
  }
});

// Тестовый эндпоинт для проверки
app.get('/api/list-files', (req, res) => {
  try {
    const files = fs.readdirSync(chatPath);
    res.json({
      chatPath: chatPath,
      files: files,
      fileUrls: files.map(f => `http://localhost:5000/uploads/chat/${f}`)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Маршруты API
app.use("/api/auth", authRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/chat", chatRoutes);

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ['websocket', 'polling'],
});

// Socket.IO auth
io.use(async (socket, next) => {
  const employeeId = socket.handshake.auth.employeeId;
  
  if (!employeeId) {
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
      return next(new Error("Сотрудник не найден"));
    }
    
    socket.user = {
      employee_id: rows[0].employee_id,
      group_id: rows[0].group_id,
      full_name: `${rows[0].first_name} ${rows[0].last_name}`,
      role: rows[0].role,
    };
    next();
  } catch (error) {
    console.error("Socket auth error:", error);
    next(new Error("Ошибка авторизации"));
  }
});

const activeUsers = new Map();

io.on("connection", (socket) => {
  const user = socket.user;
  console.log(`🔌 ${user.full_name} подключен`);

  activeUsers.set(socket.id, user);
  socket.join(`group_${user.group_id}`);
  
  const groupUsers = Array.from(activeUsers.values())
    .filter(u => u.group_id === user.group_id);
  io.to(`group_${user.group_id}`).emit("users_online", groupUsers);

  // Отправка сообщения
  socket.on("send_message", async (data) => {
    const { message, attachment_url, attachment_type, is_image } = data;
    
    try {
      const [result] = await db.query(
        `INSERT INTO chat_messages (group_id, sender_id, message, attachment_url, attachment_type) 
         VALUES (?, ?, ?, ?, ?)`,
        [user.group_id, user.employee_id, message || '', attachment_url || null, attachment_type || null]
      );
      
      const messageData = {
        message_id: result.insertId,
        group_id: user.group_id,
        sender_id: user.employee_id,
        sender_name: user.full_name,
        sender_role: user.role,
        message: message || '',
        created_at: new Date().toISOString(),
        attachment_url: attachment_url || null,
        attachment_type: attachment_type || null,
        is_image: is_image || false,
        read_count: 0,
        reactions: {},
      };
      
      io.to(`group_${user.group_id}`).emit("new_message", messageData);
      
    } catch (error) {
      console.error("Ошибка:", error);
      socket.emit("error", { message: "Ошибка отправки" });
    }
  });

  // Редактирование
  socket.on("edit_message", async (data) => {
    const { message_id, message } = data;
    await db.query(
      `UPDATE chat_messages SET message = ?, edited_at = NOW() WHERE message_id = ? AND sender_id = ?`,
      [message, message_id, user.employee_id]
    );
    io.to(`group_${user.group_id}`).emit("message_edited", { message_id, message, edited_at: new Date() });
  });

  // Удаление
  socket.on("delete_message", async (data) => {
    const { message_id } = data;
    await db.query(
      `UPDATE chat_messages SET is_deleted = TRUE, message = '⚠️ Сообщение удалено' WHERE message_id = ?`,
      [message_id]
    );
    io.to(`group_${user.group_id}`).emit("message_deleted", { message_id });
  });

  // Реакции
  socket.on("add_reaction", async (data) => {
    const { message_id, reaction } = data;
    
    const [existing] = await db.query(
      `SELECT * FROM chat_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?`,
      [message_id, user.employee_id, reaction]
    );
    
    if (existing.length > 0) {
      await db.query(`DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?`,
        [message_id, user.employee_id, reaction]);
    } else {
      await db.query(`INSERT INTO chat_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)`,
        [message_id, user.employee_id, reaction]);
    }
    
    const [reactions] = await db.query(
      `SELECT reaction, COUNT(*) as count FROM chat_reactions WHERE message_id = ? GROUP BY reaction`,
      [message_id]
    );
    
    const reactionMap = {};
    reactions.forEach(r => { reactionMap[r.reaction] = parseInt(r.count); });
    
    io.to(`group_${user.group_id}`).emit("reaction_update", { message_id, reactions: reactionMap });
  });

  // Прочтение
  socket.on("mark_read", async (data) => {
    const { message_id } = data;
    await db.query(`INSERT IGNORE INTO chat_read_receipts (message_id, user_id) VALUES (?, ?)`,
      [message_id, user.employee_id]);
    
    const [countResult] = await db.query(
      `SELECT COUNT(*) as read_count FROM chat_read_receipts WHERE message_id = ?`,
      [message_id]
    );
    
    io.to(`group_${user.group_id}`).emit("read_update", {
      message_id,
      read_count: countResult[0].read_count,
    });
  });

  // Печатает
  socket.on("typing", (data) => {
    socket.to(`group_${user.group_id}`).emit("user_typing", {
      user_id: user.employee_id,
      user_name: user.full_name,
      is_typing: data.is_typing,
    });
  });

  // Отключение
  socket.on("disconnect", () => {
    console.log(`🔌 ${user.full_name} отключен`);
    activeUsers.delete(socket.id);
    
    const groupUsers = Array.from(activeUsers.values())
      .filter(u => u.group_id === user.group_id);
    io.to(`group_${user.group_id}`).emit("users_online", groupUsers);
  });
});

// Автосбор KPI
cron.schedule('59 23 * * *', async () => {
  console.log('⏰ Запуск планового сбора KPI...');
  await KPICollector.collectForAllEmployees(new Date());
});

setTimeout(async () => {
  console.log('🔄 Проверка данных за сегодня...');
  await KPICollector.collectForAllEmployees(new Date());
}, 5000);

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Статика из папки: ${chatPath}`);
  console.log(`🔗 Тест: http://localhost:${PORT}/api/list-files`);
});