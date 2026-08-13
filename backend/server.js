// backend/server.js
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
import adminRoutes from "./admin.routes.js";
import taskRoutes from "./tasks.routes.js";
import ticketsRoutes from "./tickets.routes.js";
import { MessageFilter } from './services/messageFilter.service.js';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import quotaReportRoutes from './quota.report.routes.js';
import { QuotaService } from './quota.service.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Настройка CORS
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "user-id"], 
}));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
app.use(express.raw({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use("/api/tasks", taskRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use('/uploads/tasks', express.static(path.join(__dirname, 'uploads/tasks')));
app.use("/api/reports", quotaReportRoutes);

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
const ticketsPath = path.join(uploadsPath, 'tickets');
if (!fs.existsSync(ticketsPath)) {
  fs.mkdirSync(ticketsPath, { recursive: true });
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

app.get('/uploads/tickets/:filename', (req, res) => {
  const filepath = path.join(ticketsPath, req.params.filename);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
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
app.use("/api/admin", adminRoutes);

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

// ПЕРЕДАЕМ io В CHAT ROUTES
setIo(io);

// Socket.IO auth
io.use(async (socket, next) => {
  const employeeId = socket.handshake.auth.employeeId;
  
  if (!employeeId) {
    return next(new Error("Не авторизован"));
  }
  
  try {
    const [rows] = await db.query(
      `SELECT e.employee_id, e.group_id, e.last_name, e.first_name, e.role, e.status 
       FROM employees e 
       WHERE e.employee_id = ?`,
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
      status: rows[0].status,
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

  // ============ ЧАТ ДЛЯ ТИКЕТОВ (ОБРАЩЕНИЙ) ============
  
  // Присоединение к комнате тикета
  socket.on("join_ticket", (ticketId) => {
    const roomName = `ticket_${ticketId}`;
    socket.join(roomName);
    console.log(`📢 ${user.full_name} присоединился к чату тикета ${ticketId}`);
  });

  // Отправка сообщения в тикете
  socket.on("ticket_message", async (data) => {
    const { ticket_id, message, user_id } = data;
    console.log("📨 Получено ticket_message:", { ticket_id, message, user_id });
    
    try {
      // Сохраняем сообщение в БД
      await db.query(
        `INSERT INTO ticket_comments (ticket_id, user_id, message, created_at)
         VALUES (?, ?, ?, NOW())`,
        [ticket_id, user_id, message]
      );
      
      // Получаем информацию об отправителе
      const [sender] = await db.query(
        `SELECT first_name, last_name, role FROM employees WHERE employee_id = ?`,
        [user_id]
      );
      
      const messageData = {
        ticket_id,
        user_id,
        user_name: `${sender[0].first_name} ${sender[0].last_name}`,
        user_role: sender[0].role,
        message,
        created_at: new Date().toISOString()
      };
      
      console.log("📨 Отправляем сообщение в комнату ticket_" + ticket_id, messageData);
      
      // Отправляем всем в комнате тикета
      io.to(`ticket_${ticket_id}`).emit("new_ticket_message", messageData);
      
      // Уведомляем другую сторону
      const [ticket] = await db.query(
        `SELECT client_id, operator_id FROM tickets WHERE ticket_id = ?`,
        [ticket_id]
      );
      
      const otherUserId = user_id == ticket[0].client_id ? ticket[0].operator_id : ticket[0].client_id;
      if (otherUserId) {
        io.to(`user_${otherUserId}`).emit("ticket_notification", {
          ticket_id,
          message: `Новое сообщение в обращении #${ticket_id}`
        });
      }
    } catch (error) {
      console.error("Ошибка отправки сообщения в тикет:", error);
      socket.emit("ticket_message_error", { error: "Ошибка отправки сообщения" });
    }
  });
  // Выход из комнаты тикета
  socket.on("leave_ticket", (ticketId) => {
    socket.leave(`ticket_${ticketId}`);
    console.log(`👋 ${user.full_name} покинул чат тикета ${ticketId}`);
  });

  // ============ ОСТАЛЬНЫЕ ОБРАБОТЧИКИ (pin_message, send_message, etc) ============
  
  socket.on("pin_message", async (data) => {
    const { message_id, chat_type, chat_id } = data;
    const userId = socket.user.employee_id;

    console.log(`📌 Запрос на закрепление сообщения ${message_id} от пользователя ${userId}`);

    try {
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

        if (msg.chat_type === 'private' || !msg.user_role) {
            socket.emit("error", { message: "Нет прав для закрепления" });
            return;
        }

        let roomName;
        if (chat_type === 'private') roomName = `private_${chat_id}`;
        else if (chat_type === 'custom') roomName = `custom_${chat_id}`;
        else roomName = `group_${chat_id}`;

        if (msg.is_pinned) {
            await db.query(
                `UPDATE chat_messages SET is_pinned = FALSE, pinned_by = NULL, pinned_at = NULL WHERE message_id = ?`,
                [message_id]
            );
            io.to(roomName).emit("message_unpinned", { message_id });
            console.log(`📌 Сообщение ${message_id} откреплено`);
        } else {
            await db.query(
                `UPDATE chat_messages SET is_pinned = TRUE, pinned_by = ?, pinned_at = NOW() WHERE message_id = ?`,
                [userId, message_id]
            );
            io.to(roomName).emit("message_pinned", {
                ...msg,
                is_pinned: true,
                pinned_by: userId,
                pinned_at: new Date(),
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

  // Отправка сообщения (обычный чат)
  socket.on("send_message", async (data) => {
    const { message, attachment_url, attachment_type, is_image, _tempId, chat_type, chat_id, reply_to_id } = data;
    console.log('📨 send_message:', { chat_type, chat_id, sender: user.full_name, tempId: _tempId, reply_to_id });
    
    if (socket.user.status === 'В отпуске') {
      socket.emit("message_warning", { 
        _tempId, 
        warning: "Вы находитесь в отпуске. Сообщение будет отправлено, но учтите, что вы не должны работать." 
      });
    }
    
    try {
      let queryResult;
      let groupId = null;
      let finalMessage = message || '';
      let wasFiltered = false;
      
      if ((chat_type === 'custom' || chat_type === 'group') && finalMessage && finalMessage.trim()) {
        let shouldFilter = false;
        
        if (chat_type === 'group') {
          shouldFilter = true;
          console.log('🔍 Рабочая группа - фильтрация включена принудительно');
        } else if (chat_type === 'custom') {
          const [groupInfo] = await db.query(
            `SELECT has_filter FROM custom_groups WHERE group_id = ?`,
            [chat_id]
          );
          shouldFilter = groupInfo[0]?.has_filter === 1;
          console.log('🔍 Кастомная группа - фильтрация:', shouldFilter ? 'включена' : 'выключена');
        }
        
        if (shouldFilter) {
          const filterResult = await MessageFilter.filterMessage(finalMessage, chat_id, db);
          
          if (!filterResult.allowed) {
            socket.emit("message_blocked", { _tempId, reason: filterResult.reason });
            return;
          }
          
          finalMessage = filterResult.message;
          wasFiltered = filterResult.wasFiltered || false;
          
          if (wasFiltered) {
            socket.emit("message_censored", { _tempId, censoredMessage: finalMessage });
          }
        }
      }
      
      if (chat_type === 'group') {
        groupId = chat_id;
      }
      
      if (chat_type === 'group') {
        [queryResult] = await db.query(
          `INSERT INTO chat_messages (chat_type, chat_id, group_id, sender_id, message, attachment_url, attachment_type, reply_to_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [chat_type, chat_id, groupId, user.employee_id, finalMessage || '', attachment_url || null, attachment_type || null, reply_to_id || null]
        );
      } else {
        [queryResult] = await db.query(
          `INSERT INTO chat_messages (chat_type, chat_id, group_id, sender_id, message, attachment_url, attachment_type, reply_to_id) 
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
          [chat_type, chat_id, user.employee_id, finalMessage || '', attachment_url || null, attachment_type || null, reply_to_id || null]
        );
      }
      
      const [senderInfo] = await db.query(
        `SELECT avatar_url FROM employees WHERE employee_id = ?`, 
        [user.employee_id]
      );
      
      const messageData = {
        message_id: queryResult.insertId,
        chat_type, 
        chat_id,
        sender_id: user.employee_id,
        sender_name: user.full_name,
        sender_role: user.role,
        sender_avatar_url: senderInfo[0]?.avatar_url || null,
        message: finalMessage || '',
        created_at: new Date().toISOString(),
        attachment_url: attachment_url || null,
        attachment_type: attachment_type || null,
        reply_to_id: reply_to_id || null,
        is_image: is_image || false,
        read_count: 0, 
        reactions: {},
        status: 'sent',
        _tempId: _tempId || null,
        was_filtered: wasFiltered
      };
      
      if (chat_type === 'private') {
        const [participants] = await db.query(
          `SELECT user_id FROM private_chat_participants WHERE chat_id = ? AND user_id != ?`,
          [chat_id, user.employee_id]
        );
        
        if (participants.length > 0) {
          const otherUserId = participants[0].user_id;
          const otherUserRoom = `user_${otherUserId}`;
          io.to(otherUserRoom).emit("new_message", messageData);
        }
        socket.emit("message_sent", messageData);
      } else if (chat_type === 'custom') {
        const roomName = `custom_${chat_id}`;
        socket.to(roomName).emit("new_message", messageData);
        socket.emit("message_sent", { ...messageData, _tempId });
      } else {
        const roomName = `group_${chat_id}`;
        io.to(roomName).emit("new_message", messageData);
        socket.emit("message_sent", messageData);
      }
      
      console.log(`📨 Отправлено, msg_id: ${messageData.message_id}`);
      
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
      roomName = `custom_${chat_id}`;
    } else {
      roomName = `group_${chat_id}`;
    }
    socket.leave(roomName);
    console.log(`👋 ${user.full_name} покинул ${roomName}`);
  });

  // Редактирование сообщения
  socket.on("edit_message", async (data) => {
    const { message_id, message } = data;
    console.log(`✏️ Редактирование сообщения ${message_id} пользователем ${user.employee_id}`);
    
    try {
      const [msgInfo] = await db.query(
        `SELECT chat_type, chat_id, sender_id FROM chat_messages WHERE message_id = ?`,
        [message_id]
      );
      
      if (msgInfo.length === 0) {
        socket.emit("error", { message: "Сообщение не найдено" });
        return;
      }
      
      if (msgInfo[0].sender_id !== user.employee_id) {
        socket.emit("error", { message: "Можно редактировать только свои сообщения" });
        return;
      }
      
      const chat_type = msgInfo[0].chat_type;
      const chat_id = msgInfo[0].chat_id;
      let finalMessage = message;
      let wasFiltered = false;
      
      if ((chat_type === 'custom' || chat_type === 'group') && finalMessage && finalMessage.trim()) {
        let shouldFilter = false;
        
        if (chat_type === 'group') {
          shouldFilter = true;
        } else if (chat_type === 'custom') {
          const [groupInfo] = await db.query(
            `SELECT has_filter FROM custom_groups WHERE group_id = ?`,
            [chat_id]
          );
          shouldFilter = groupInfo[0]?.has_filter === 1;
        }
        
        if (shouldFilter) {
          const filterResult = await MessageFilter.filterMessage(finalMessage, chat_id, db);
          
          if (!filterResult.allowed) {
            socket.emit("message_edit_blocked", { message_id, reason: filterResult.reason });
            return;
          }
          
          finalMessage = filterResult.message;
          wasFiltered = filterResult.wasFiltered || false;
          
          if (wasFiltered) {
            socket.emit("message_edit_censored", { message_id, censoredMessage: finalMessage });
          }
        }
      }
      
      await db.query(
        `UPDATE chat_messages SET message = ?, edited_at = NOW() WHERE message_id = ? AND sender_id = ?`,
        [finalMessage, message_id, user.employee_id]
      );
      
      let roomName;
      if (chat_type === 'private') {
        roomName = `private_${chat_id}`;
      } else if (chat_type === 'custom') {
        roomName = `custom_${chat_id}`;
      } else {
        roomName = `group_${chat_id}`;
      }
      
      io.to(roomName).emit("message_edited", { 
        message_id, 
        message: finalMessage, 
        edited_at: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Ошибка редактирования сообщения:", error);
      socket.emit("error", { message: "Ошибка при редактировании" });
    }
  });

  // Удаление сообщения
  socket.on("delete_message", async (data) => {
    const { message_id } = data;
    
    try {
      const [msgInfo] = await db.query(
        `SELECT * FROM chat_messages WHERE message_id = ? AND sender_id = ?`,
        [message_id, user.employee_id]
      );
      
      if (msgInfo.length === 0) {
        socket.emit("error", { message: "Сообщение не найдено или нет прав на удаление" });
        return;
      }
      
      if (msgInfo[0].attachment_url) {
        const filePath = path.join(process.cwd(), msgInfo[0].attachment_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      await db.query(`DELETE FROM chat_reactions WHERE message_id = ?`, [message_id]);
      await db.query(`DELETE FROM chat_read_receipts WHERE message_id = ?`, [message_id]);
      await db.query(`DELETE FROM chat_messages WHERE message_id = ?`, [message_id]);
      
      const roomName = msgInfo[0].chat_type === 'private' 
        ? `private_${msgInfo[0].chat_id}` 
        : msgInfo[0].chat_type === 'custom' 
          ? `custom_${msgInfo[0].chat_id}` 
          : `group_${msgInfo[0].chat_id}`;
      
      io.to(roomName).emit("message_deleted", { message_id, deleted: true });
      console.log(`✅ Сообщение ${message_id} полностью удалено`);
      
    } catch (error) {
      console.error("Ошибка удаления сообщения:", error);
      socket.emit("error", { message: "Ошибка при удалении сообщения" });
    }
  });

  // Реакции
  socket.on("add_reaction", async (data) => {
    const { message_id, reaction } = data;
    console.log(`😊 Реакция ${reaction} на сообщение ${message_id} от пользователя ${user.employee_id}`);
    
    try {
      const [existing] = await db.query(
        `SELECT * FROM chat_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?`,
        [message_id, user.employee_id, reaction]
      );
      
      if (existing.length > 0) {
        await db.query(
          `DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?`,
          [message_id, user.employee_id, reaction]
        );
      } else {
        await db.query(
          `INSERT INTO chat_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)`,
          [message_id, user.employee_id, reaction]
        );
      }
      
      const [reactions] = await db.query(
        `SELECT reaction, COUNT(*) as count FROM chat_reactions WHERE message_id = ? GROUP BY reaction`,
        [message_id]
      );
      
      const reactionMap = {};
      reactions.forEach(r => { reactionMap[r.reaction] = parseInt(r.count); });
      
      const [msgInfo] = await db.query(
        `SELECT chat_type, chat_id FROM chat_messages WHERE message_id = ?`,
        [message_id]
      );
      
      if (msgInfo.length > 0) {
        let roomName;
        const chatType = msgInfo[0].chat_type;
        const chatId = msgInfo[0].chat_id;
        
        if (chatType === 'private') {
          roomName = `private_${chatId}`;
        } else if (chatType === 'custom') {
          roomName = `custom_${chatId}`;
        } else {
          roomName = `group_${chatId}`;
        }
        
        io.to(roomName).emit("reaction_update", { message_id, reactions: reactionMap });
      }
    } catch (error) {
      console.error("❌ Ошибка при работе с реакциями:", error);
      socket.emit("error", { message: "Ошибка при добавлении реакции" });
    }
  });

  // Прочтение
  socket.on("mark_read", async (data) => {
    const { message_id } = data;
    if (!message_id) return;
    
    try {
      const [existing] = await db.query(
        `SELECT * FROM chat_read_receipts WHERE message_id = ? AND user_id = ?`,
        [message_id, user.employee_id]
      );
      
      if (existing.length === 0) {
        await db.query(
          `INSERT INTO chat_read_receipts (message_id, user_id, read_at) VALUES (?, ?, NOW())`,
          [message_id, user.employee_id]
        );
      }
      
      const [countResult] = await db.query(
        `SELECT COUNT(*) as read_count FROM chat_read_receipts WHERE message_id = ?`,
        [message_id]
      );
      
      const [msgInfo] = await db.query(
        `SELECT chat_type, chat_id FROM chat_messages WHERE message_id = ?`,
        [message_id]
      );
      
      if (msgInfo.length > 0) {
        const roomName = msgInfo[0].chat_type === 'private' 
          ? `private_${msgInfo[0].chat_id}` 
          : `group_${msgInfo[0].chat_id}`;
        
        io.to(roomName).emit("read_update", {
          message_id,
          read_count: countResult[0]?.read_count || 0,
        });
      }
      
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
// Очистка кэша нормы каждый день в 23:00
cron.schedule('0 23 * * *', async () => {
    console.log('⏰ 23:00 - Очистка кэша дневной нормы');
    QuotaService.clearQuotaCache();
    console.log('✅ Кэш нормы очищен');
});
// Получить все KPI нормы
app.get("/api/kpi/targets", async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM kpi_targets');
    const targets = {};
    rows.forEach(row => {
      targets[row.metric_name] = parseFloat(row.target_value);
    });
    res.json(targets);
  } catch (error) {
    res.json({ csat: 85, fcr: 75, contacts_per_hour: 8, quality_score: 90 });
  }
});

export const getIo = () => io;

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Статика из папки: ${chatPath}`);
  console.log(`📁 Папка для файлов тикетов: ${ticketsPath}`);
  console.log(`🔗 Тест: http://localhost:${PORT}/api/list-files`);
});