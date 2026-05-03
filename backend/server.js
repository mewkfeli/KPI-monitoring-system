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
import chatRoutes, { setIo } from "./chat.routes.js";
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

app.use(express.raw({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ
const uploadsPath = path.join(__dirname, 'uploads');
console.log('📁 Папка для статики:', uploadsPath);
console.log('📁 Существует?', fs.existsSync(uploadsPath));

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
const chatPath = path.join(uploadsPath, 'chat');
if (!fs.existsSync(chatPath)) {
  fs.mkdirSync(chatPath, { recursive: true });
}

app.use('/uploads', express.static(uploadsPath));

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

// ПЕРЕДАЕМ io В CHAT ROUTES (ВАЖНО!)
setIo(io);

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

  // ПЕРСОНАЛЬНАЯ КОМНАТА ДЛЯ УВЕДОМЛЕНИЙ
  socket.join(`user_${user.employee_id}`);
  
  activeUsers.set(socket.id, user);
  socket.join(`group_${user.group_id}`);
  
  const groupUsers = Array.from(activeUsers.values())
    .filter(u => u.group_id === user.group_id);
  io.to(`group_${user.group_id}`).emit("users_online", groupUsers);

  socket.on("pin_message", async (data) => {
    const { message_id, chat_type, chat_id } = data;
    const userId = socket.user.employee_id;

    console.log(`📌 Запрос на закрепление сообщения ${message_id} от пользователя ${userId}`);

    try {
        // 1. Проверяем права. Важно! Это дублирует часть логики из Роута, но для Socket.IO она нужна здесь.
        const [message] = await db.query(
            `SELECT cm.*, 
                    CASE 
                        WHEN cm.chat_type = 'custom' THEN (SELECT role FROM custom_group_members WHERE group_id = cm.chat_id AND user_id = ? AND role = 'admin')
                        WHEN cm.chat_type = 'group' THEN (SELECT role FROM employees WHERE employee_id = ? AND role IN ('Руководитель группы', 'Руководитель отдела'))
                        ELSE NULL
                    END as user_role
             FROM chat_messages cm
             WHERE cm.message_id = ?`,
            [userId, userId, message_id]
        );

        if (message.length === 0) {
            socket.emit("error", { message: "Сообщение не найдено" });
            return;
        }

        const msg = message[0];

        // Проверка прав: только админ или руководитель
        if (msg.chat_type === 'private' || !msg.user_role) {
            socket.emit("error", { message: "Нет прав для закрепления" });
            return;
        }

        // Определяем комнату для рассылки
        let roomName;
        if (chat_type === 'private') roomName = `private_${chat_id}`;
        else if (chat_type === 'custom') roomName = `custom_${chat_id}`;
        else roomName = `group_${chat_id}`;

        // Проверяем, закреплено ли уже сообщение
        if (msg.is_pinned) {
            // Если закреплено - открепляем
            await db.query(
                `UPDATE chat_messages SET is_pinned = FALSE, pinned_by = NULL, pinned_at = NULL WHERE message_id = ?`,
                [message_id]
            );
            io.to(roomName).emit("message_unpinned", { message_id });
            console.log(`📌 Сообщение ${message_id} откреплено`);
        } else {
            // Если не закреплено - закрепляем
            await db.query(
                `UPDATE chat_messages SET is_pinned = TRUE, pinned_by = ?, pinned_at = NOW() WHERE message_id = ?`,
                [userId, message_id]
            );
            // Отправляем объект сообщения, чтобы клиент мог добавить его в список закрепленных
            io.to(roomName).emit("message_pinned", {
                ...msg,
                is_pinned: true,
                pinned_by: userId,
                pinned_at: new Date(),
                // Добавим данные об авторе для красивого отображения
                first_name: socket.user.full_name.split(' ')[0],
                last_name: socket.user.full_name.split(' ')[1] || ''
            });
            console.log(`📌 Сообщение ${message_id} закреплено`);
        }

    } catch (error) {
        console.error("❌ Ошибка закрепления/открепления:", error);
        socket.emit("error", { message: "Ошибка сервера при закреплении сообщения" });
    }
});

// Отправка сообщения
socket.on("send_message", async (data) => {
    const { message, attachment_url, attachment_type, is_image, _tempId, chat_type, chat_id } = data;
    
    console.log('📨 send_message:', { chat_type, chat_id, sender: user.full_name, tempId: _tempId });
    
    try {
        let result;
        
        if (chat_type === 'group') {
            [result] = await db.query(
                `INSERT INTO chat_messages (chat_type, chat_id, group_id, sender_id, message, attachment_url, attachment_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [chat_type, chat_id, chat_id, user.employee_id, message || '', attachment_url || null, attachment_type || null]
            );
        } else {
            [result] = await db.query(
                `INSERT INTO chat_messages (chat_type, chat_id, group_id, sender_id, message, attachment_url, attachment_type) VALUES (?, ?, NULL, ?, ?, ?, ?)`,
                [chat_type, chat_id, user.employee_id, message || '', attachment_url || null, attachment_type || null]
            );
        }
        
        const [senderInfo] = await db.query(
            `SELECT avatar_url FROM employees WHERE employee_id = ?`, 
            [user.employee_id]
        );
        
        const messageData = {
            message_id: result.insertId,
            chat_type, 
            chat_id,
            sender_id: user.employee_id,
            sender_name: user.full_name,
            sender_role: user.role,
            sender_avatar_url: senderInfo[0]?.avatar_url || null,
            message: message || '',
            created_at: new Date().toISOString(),
            attachment_url: attachment_url || null,
            attachment_type: attachment_type || null,
            is_image: is_image || false,
            read_count: 0, 
            reactions: {},
            status: 'sent',
            _tempId: _tempId || null,
        };
        
        let roomName;
        if (chat_type === 'private') roomName = `private_${chat_id}`;
        else if (chat_type === 'custom') roomName = `custom_${chat_id}`;
        else roomName = `group_${chat_id}`;
        
        console.log(`📨 Отправка в комнату: ${roomName}, msg_id: ${messageData.message_id}`);
        
        // ✅ Отправляем ВСЕМ в комнате (включая отправителя)
        io.to(roomName).emit("new_message", messageData);
        
        // ✅ Отправляем подтверждение ТОЛЬКО отправителю
        socket.emit("message_sent", messageData);
        
    } catch (error) {
        console.error("Ошибка сохранения сообщения:", error);
        socket.emit("message_error", { error: "Ошибка при отправке", _tempId });
    }
});

  // Подключение к чату
  socket.on("join_chat", ({ chat_type, chat_id }) => {
  let roomName;
  if (chat_type === 'private') roomName = `private_${chat_id}`;
  else if (chat_type === 'custom') roomName = `custom_${chat_id}`;
  else roomName = `group_${chat_id}`;
  
  // ВАЖНО: Покидаем все предыдущие комнаты чатов
  const rooms = Array.from(socket.rooms);
  rooms.forEach(room => {
    if (room.startsWith('private_') || room.startsWith('custom_') || room.startsWith('group_')) {
      socket.leave(room);
    }
  });
  
  socket.join(roomName);
  console.log(`👥 ${user.full_name} присоединился к комнате ${roomName}`);
});

  // Выход из чата
socket.on("leave_chat", ({ chat_type, chat_id }) => {
  let roomName;
  if (chat_type === 'private') {
    roomName = `private_${chat_id}`;
  } else if (chat_type === 'custom') {
    roomName = `custom_${chat_id}`;  // 👈 ВАЖНО
  } else {
    roomName = `group_${chat_id}`;
  }
  
  socket.leave(roomName);
  console.log(`👋 ${user.full_name} покинул ${roomName}`);
});

  // Редактирование
  socket.on("edit_message", async (data) => {
    const { message_id, message } = data;
    await db.query(
      `UPDATE chat_messages SET message = ?, edited_at = NOW() WHERE message_id = ? AND sender_id = ?`,
      [message, message_id, user.employee_id]
    );
    
    const [msgInfo] = await db.query(`SELECT chat_type, chat_id FROM chat_messages WHERE message_id = ?`, [message_id]);
    if (msgInfo.length > 0) {
      const roomName = msgInfo[0].chat_type === 'private' ? `private_${msgInfo[0].chat_id}` : `group_${msgInfo[0].chat_id}`;
      io.to(roomName).emit("message_edited", { message_id, message, edited_at: new Date() });
    }
  });

  // Удаление сообщения
socket.on("delete_message", async (data) => {
  const { message_id } = data;
  
  try {
    // Проверяем, что сообщение существует и принадлежит пользователю
    const [msgInfo] = await db.query(
      `SELECT * FROM chat_messages WHERE message_id = ? AND sender_id = ?`,
      [message_id, user.employee_id]
    );
    
    if (msgInfo.length === 0) {
      socket.emit("error", { message: "Сообщение не найдено или нет прав на удаление" });
      return;
    }
    
    // Удаляем файл, если есть
    if (msgInfo[0].attachment_url) {
      const filePath = path.join(process.cwd(), msgInfo[0].attachment_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑 Файл удален:', filePath);
      }
    }
    
    // Удаляем связанные данные
    await db.query(`DELETE FROM chat_reactions WHERE message_id = ?`, [message_id]);
    await db.query(`DELETE FROM chat_read_receipts WHERE message_id = ?`, [message_id]);
    
    // Удаляем само сообщение
    await db.query(`DELETE FROM chat_messages WHERE message_id = ?`, [message_id]);
    
    // Отправляем событие в комнату
    const roomName = msgInfo[0].chat_type === 'private' 
      ? `private_${msgInfo[0].chat_id}` 
      : msgInfo[0].chat_type === 'custom' 
        ? `custom_${msgInfo[0].chat_id}` 
        : `group_${msgInfo[0].chat_id}`;
    
    io.to(roomName).emit("message_deleted", { 
      message_id,
      deleted: true
    });
    
    console.log(`✅ Сообщение ${message_id} полностью удалено`);
    
  } catch (error) {
    console.error("Ошибка удаления сообщения:", error);
    socket.emit("error", { message: "Ошибка при удалении сообщения" });
  }
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
    
    const [msgInfo] = await db.query(`SELECT chat_type, chat_id FROM chat_messages WHERE message_id = ?`, [message_id]);
    if (msgInfo.length > 0) {
      const roomName = msgInfo[0].chat_type === 'private' ? `private_${msgInfo[0].chat_id}` : `group_${msgInfo[0].chat_id}`;
      io.to(roomName).emit("reaction_update", { message_id, reactions: reactionMap });
    }
  });

  // Прочтение
 socket.on("mark_read", async (data) => {
  const { message_id } = data;
  
  if (!message_id) return;
  
  try {
    // Проверяем, есть ли уже отметка о прочтении
    const [existing] = await db.query(
      `SELECT * FROM chat_read_receipts WHERE message_id = ? AND user_id = ?`,
      [message_id, user.employee_id]
    );
    
    if (existing.length === 0) {
      // Добавляем отметку о прочтении
      await db.query(
        `INSERT INTO chat_read_receipts (message_id, user_id, read_at) VALUES (?, ?, NOW())`,
        [message_id, user.employee_id]
      );
      console.log(`✅ Пользователь ${user.employee_id} прочитал сообщение ${message_id}`);
    }
    
    // Получаем актуальное количество прочитавших
    const [countResult] = await db.query(
      `SELECT COUNT(*) as read_count FROM chat_read_receipts WHERE message_id = ?`,
      [message_id]
    );
    
    // Получаем информацию о чате
    const [msgInfo] = await db.query(
      `SELECT chat_type, chat_id FROM chat_messages WHERE message_id = ?`,
      [message_id]
    );
    
    if (msgInfo.length > 0) {
      const roomName = msgInfo[0].chat_type === 'private' 
        ? `private_${msgInfo[0].chat_id}` 
        : `group_${msgInfo[0].chat_id}`;
      
      // Отправляем обновление в комнату
      io.to(roomName).emit("read_update", {
        message_id,
        read_count: countResult[0]?.read_count || 0,
      });
    }
    
    // ОБНОВЛЯЕМ СЧЕТЧИК НЕПРОЧИТАННЫХ ДЛЯ ПОЛЬЗОВАТЕЛЯ
    // Отправляем событие обновления списка чатов
    io.to(`user_${user.employee_id}`).emit("unread_count_update");
    
  } catch (error) {
    console.error("Ошибка отметки прочтения:", error);
  }
});

  // Печатает
  socket.on("typing", (data) => {
    const roomName = `group_${user.group_id}`;
    socket.to(roomName).emit("user_typing", {
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