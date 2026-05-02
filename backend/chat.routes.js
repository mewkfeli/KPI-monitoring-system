// backend/chat.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db.js";

const router = express.Router();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/chat/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'application/pdf', 'text/plain', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый тип файла'), false);
  }
};

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter 
});

// ============= ГРУППА =============
router.get("/my-group", async (req, res) => {
  const { employee_id } = req.query;
  
  if (!employee_id) {
    return res.status(400).json({ error: "Не указан ID сотрудника" });
  }

  try {
    const [rows] = await db.query(
      `SELECT e.group_id, wg.group_name 
       FROM employees e
       JOIN work_groups wg ON e.group_id = wg.group_id
       WHERE e.employee_id = ? AND e.status = 'Активен'`,
      [employee_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Сотрудник не найден" });
    }

    const [members] = await db.query(
      `SELECT employee_id, last_name, first_name, role, status 
       FROM employees 
       WHERE group_id = ? AND status = 'Активен'
       ORDER BY role, last_name`,
      [rows[0].group_id]
    );

    res.json({
      group_id: rows[0].group_id,
      group_name: rows[0].group_name,
      members,
    });
  } catch (error) {
    console.error("Ошибка получения группы:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= ИСТОРИЯ СООБЩЕНИЙ (УПРОЩЕННАЯ ВЕРСИЯ) =============
router.get("/history", async (req, res) => {
  const { group_id, limit = 100 } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: "Не указан ID группы" });
  }

  try {
    const [rows] = await db.query(
      `SELECT 
         cm.message_id,
         cm.group_id,
         cm.sender_id,
         cm.message,
         cm.created_at,
         cm.attachment_url,
         cm.attachment_type,
         cm.reply_to_id,
         cm.edited_at,
         cm.is_deleted,
         e.last_name,
         e.first_name,
         e.middle_name,
         e.role,
         e.avatar_url as sender_avatar_url,
         (SELECT COUNT(*) FROM chat_read_receipts WHERE message_id = cm.message_id) as read_count
       FROM chat_messages cm
       JOIN employees e ON cm.sender_id = e.employee_id
       WHERE cm.group_id = ? AND (cm.is_deleted = FALSE OR cm.is_deleted IS NULL)
       ORDER BY cm.created_at ASC
       LIMIT ?`,
      [group_id, parseInt(limit)]
    );
    
    // Получаем реакции отдельно для каждого сообщения
    const messagesWithReactions = [];
for (const row of rows) {
  const [reactions] = await db.query(
    `SELECT reaction, COUNT(*) as count 
     FROM chat_reactions 
     WHERE message_id = ? 
     GROUP BY reaction`,
    [row.message_id]
  );
  
  const reactionMap = {};
  reactions.forEach(r => { reactionMap[r.reaction] = parseInt(r.count); });
  
  messagesWithReactions.push({
    message_id: row.message_id,
    sender_id: row.sender_id,
    sender_name: `${row.first_name} ${row.last_name}`,
    sender_role: row.role,
    sender_avatar_url: row.sender_avatar_url,
    message: row.is_deleted ? "⚠️ Сообщение удалено" : row.message,
    created_at: row.created_at,
    attachment_url: row.attachment_url,
    attachment_type: row.attachment_type,
    reply_to_id: row.reply_to_id,
    edited_at: row.edited_at,
    is_deleted: row.is_deleted,
    read_count: row.read_count,
    reactions: reactionMap,
    status: 'sent',
  });
}
    
    res.json(messagesWithReactions);
  } catch (error) {
    console.error("Ошибка получения истории:", error);
    res.status(500).json({ error: "Ошибка сервера", details: error.message });
  }
});

// ============= НЕПРОЧИТАННЫЕ =============
router.get("/unread", async (req, res) => {
  const { user_id, group_id } = req.query;

  if (!user_id || !group_id) {
    return res.status(400).json({ error: "Не указаны обязательные параметры" });
  }

  try {
    const [result] = await db.query(
      `SELECT COUNT(*) as unread_count
       FROM chat_messages cm
       LEFT JOIN chat_read_receipts crr ON cm.message_id = crr.message_id AND crr.user_id = ?
       WHERE cm.group_id = ? 
         AND cm.sender_id != ?
         AND crr.receipt_id IS NULL
         AND (cm.is_deleted = FALSE OR cm.is_deleted IS NULL)`,
      [user_id, group_id, user_id]
    );
    
    res.json({ unread_count: result[0].unread_count });
  } catch (error) {
    console.error("Ошибка подсчета непрочитанных:", error);
    res.json({ unread_count: 0 });
  }
});

// ============= ПОИСК СООБЩЕНИЙ =============
router.get("/search", async (req, res) => {
  const { group_id, query, limit = 50 } = req.query;
  
  if (!group_id || !query) {
    return res.status(400).json({ error: "Не указаны параметры поиска" });
  }
  
  try {
    const [rows] = await db.query(
      `SELECT 
         cm.message_id, cm.sender_id, cm.message, cm.created_at, cm.attachment_url,
         e.last_name, e.first_name, e.role
       FROM chat_messages cm
       JOIN employees e ON cm.sender_id = e.employee_id
       WHERE cm.group_id = ? AND cm.message LIKE ? AND (cm.is_deleted = FALSE OR cm.is_deleted IS NULL)
       ORDER BY cm.created_at DESC
       LIMIT ?`,
      [group_id, `%${query}%`, parseInt(limit)]
    );
    
    res.json(rows);
  } catch (error) {
    console.error("Ошибка поиска:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= ЗАГРУЗКА ФАЙЛОВ =============
router.post('/upload', upload.single('file'), async (req, res) => {
  const { sender_id, group_id } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: "Файл не загружен" });
  }
  
  const fileUrl = `/uploads/chat/${req.file.filename}`;
  const fileType = req.file.mimetype;
  const isImage = fileType.startsWith('image/');
  
  try {
    // Для изображений сохраняем ПУСТОЕ сообщение (не "🖼 Изображение")
    const messageText = isImage ? '' : `📎 Файл: ${req.file.originalname}`;
    
    const [result] = await db.query(
      `INSERT INTO chat_messages (group_id, sender_id, message, attachment_url, attachment_type)
       VALUES (?, ?, ?, ?, ?)`,
      [group_id, sender_id, messageText, fileUrl, fileType]
    );
    
    // Возвращаем данные, включая флаг is_image
    res.json({ 
      success: true, 
      message_id: result.insertId,
      fileUrl,
      fileName: req.file.originalname,
      is_image: isImage,
      attachment_type: fileType
    });
  } catch (error) {
    console.error("Ошибка сохранения файла:", error);
    res.status(500).json({ error: "Ошибка сохранения" });
  }
});

// ============= РЕАКЦИИ =============
router.post('/reaction', async (req, res) => {
  const { message_id, user_id, reaction } = req.body;
  
  try {
    const [existing] = await db.query(
      `SELECT * FROM chat_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?`,
      [message_id, user_id, reaction]
    );
    
    if (existing.length > 0) {
      await db.query(
        `DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?`,
        [message_id, user_id, reaction]
      );
    } else {
      await db.query(
        `INSERT INTO chat_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)`,
        [message_id, user_id, reaction]
      );
    }
    
    const [reactions] = await db.query(
      `SELECT reaction, COUNT(*) as count FROM chat_reactions 
       WHERE message_id = ? GROUP BY reaction`,
      [message_id]
    );
    
    const reactionMap = {};
    reactions.forEach(r => { reactionMap[r.reaction] = parseInt(r.count); });
    
    res.json({ success: true, reactions: reactionMap });
  } catch (error) {
    console.error("Ошибка обработки реакции:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= РЕДАКТИРОВАНИЕ СООБЩЕНИЯ =============
router.put('/message/:id', async (req, res) => {
  const { id } = req.params;
  const { message, user_id } = req.body;
  
  try {
    const [messageCheck] = await db.query(
      `SELECT sender_id FROM chat_messages WHERE message_id = ?`,
      [id]
    );
    
    if (messageCheck.length === 0) {
      return res.status(404).json({ error: "Сообщение не найдено" });
    }
    
    if (messageCheck[0].sender_id !== user_id) {
      return res.status(403).json({ error: "Нет прав на редактирование" });
    }
    
    await db.query(
      `UPDATE chat_messages SET message = ?, edited_at = NOW() WHERE message_id = ?`,
      [message, id]
    );
    
    res.json({ success: true, edited_at: new Date().toISOString() });
  } catch (error) {
    console.error("Ошибка редактирования:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= УДАЛЕНИЕ СООБЩЕНИЯ =============
router.delete('/message/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, is_admin } = req.body;
  
  try {
    const [messageCheck] = await db.query(
      `SELECT sender_id FROM chat_messages WHERE message_id = ?`,
      [id]
    );
    
    if (messageCheck.length === 0) {
      return res.status(404).json({ error: "Сообщение не найдено" });
    }
    
    if (messageCheck[0].sender_id !== user_id && !is_admin) {
      return res.status(403).json({ error: "Нет прав на удаление" });
    }
    
    await db.query(
      `UPDATE chat_messages SET is_deleted = TRUE, message = '⚠️ Сообщение удалено' WHERE message_id = ?`,
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка удаления:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= ЧЕРНОВИКИ =============
router.get('/draft', async (req, res) => {
  const { user_id, group_id } = req.query;
  
  try {
    const [draft] = await db.query(
      `SELECT content, reply_to_id FROM chat_drafts WHERE user_id = ? AND group_id = ?`,
      [user_id, group_id]
    );
    
    res.json(draft[0] || { content: '', reply_to_id: null });
  } catch (error) {
    console.error("Ошибка получения черновика:", error);
    res.json({ content: '', reply_to_id: null });
  }
});

router.post('/draft', async (req, res) => {
  const { user_id, group_id, content, reply_to_id } = req.body;
  
  try {
    await db.query(
      `INSERT INTO chat_drafts (user_id, group_id, content, reply_to_id) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content), reply_to_id = VALUES(reply_to_id), updated_at = NOW()`,
      [user_id, group_id, content || '', reply_to_id || null]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка сохранения черновика:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete('/draft', async (req, res) => {
  const { user_id, group_id } = req.body;
  
  try {
    await db.query(
      `DELETE FROM chat_drafts WHERE user_id = ? AND group_id = ?`,
      [user_id, group_id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка удаления черновика:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;