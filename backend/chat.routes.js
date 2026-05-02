// backend/chat.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db.js";
import { NotificationService } from "./notification.service.js";

const router = express.Router();

// Socket.IO экземпляр (будет установлен из server.js)
let io;
export const setIo = (socketIo) => { io = socketIo; };

// ============= НАСТРОЙКА MULTER ДЛЯ ФАЙЛОВ =============
const uploadDir = './uploads/chat/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
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

// ============= ПОЛУЧЕНИЕ ГРУППЫ СОТРУДНИКА =============
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

// ============= ПОЛУЧЕНИЕ ВСЕХ СОТРУДНИКОВ =============
router.get("/employees/all", async (req, res) => {
  const { user_id, search } = req.query;

  console.log('📋 Запрос списка сотрудников, user_id:', user_id);

  try {
    let query = `
      SELECT 
        employee_id, 
        first_name, 
        last_name, 
        middle_name, 
        role, 
        avatar_url,
        group_id
      FROM employees 
      WHERE status = 'Активен'
    `;
    const params = [];

    if (user_id) {
      query += ` AND employee_id != ?`;
      params.push(user_id);
    }

    if (search) {
      query += ` AND (first_name LIKE ? OR last_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY last_name, first_name LIMIT 100`;

    const [rows] = await db.query(query, params);

    const employees = rows.map(emp => ({
      ...emp,
      full_name: `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim(),
      display_name: `${emp.last_name} ${emp.first_name} (${emp.role === 'Руководитель группы' ? 'Рук. группы' : emp.role === 'Руководитель отдела' ? 'Рук. отдела' : 'Сотр.'})`
    }));

    console.log(`📋 Найдено сотрудников: ${employees.length}`);
    res.json(employees);

  } catch (error) {
    console.error("Ошибка получения сотрудников:", error);
    res.status(500).json({ error: "Ошибка сервера", details: error.message });
  }
});

// ============= ПОЛУЧЕНИЕ СПИСКА ЧАТОВ ПОЛЬЗОВАТЕЛЯ =============
router.get("/list", async (req, res) => {
  const { user_id } = req.query;

  console.log('📋 Запрос списка чатов для пользователя:', user_id);

  if (!user_id) {
    return res.status(400).json({ error: "Не указан user_id" });
  }

  try {
    // 1. Рабочая группа пользователя
    const [workGroup] = await db.query(
      `SELECT wg.group_id as id, wg.group_name as name, NULL as avatar, 'group' as type
       FROM work_groups wg
       JOIN employees e ON e.group_id = wg.group_id
       WHERE e.employee_id = ?`,
      [user_id]
    );

    // 2. Кастомные группы пользователя
    const [customGroups] = await db.query(
      `SELECT cg.group_id as id, cg.group_name as name, cg.group_avatar as avatar, 'custom' as type
       FROM custom_groups cg
       JOIN custom_group_members cgm ON cg.group_id = cgm.group_id
       WHERE cgm.user_id = ?`,
      [user_id]
    );

    // 3. Личные чаты пользователя
    const [privateChats] = await db.query(
      `SELECT pc.chat_id as id, 
              CONCAT(e.first_name, ' ', e.last_name) as name,
              e.avatar_url as avatar,
              'private' as type
       FROM private_chats pc
       JOIN private_chat_participants pcp ON pc.chat_id = pcp.chat_id
       JOIN employees e ON pcp.user_id = e.employee_id
       WHERE pc.chat_id IN (
         SELECT chat_id FROM private_chat_participants WHERE user_id = ?
       ) AND pcp.user_id != ?`,
      [user_id, user_id]
    );

    const allChats = [...workGroup, ...customGroups, ...privateChats];

    // Добавляем счетчики непрочитанных
    for (const chat of allChats) {
      const [unreadResult] = await db.query(
        `SELECT COUNT(*) as count
         FROM chat_messages cm
         LEFT JOIN chat_read_receipts crr ON cm.message_id = crr.message_id AND crr.user_id = ?
         WHERE cm.chat_type = ? AND cm.chat_id = ? AND cm.sender_id != ? AND crr.receipt_id IS NULL AND cm.is_deleted = 0`,
        [user_id, chat.type, chat.id, user_id]
      );
      chat.unread_count = unreadResult[0]?.count || 0;
    }

    console.log(`📋 Найдено чатов: ${allChats.length}`);
    res.json(allChats);

  } catch (error) {
    console.error("Ошибка получения списка чатов:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= ИСТОРИЯ СООБЩЕНИЙ =============
router.get("/history", async (req, res) => {
  const { chat_type, chat_id, limit = 200 } = req.query;

  console.log('📜 Запрос истории:', { chat_type, chat_id, limit });

  if (!chat_type || !chat_id) {
    return res.status(400).json({ error: "Не указаны параметры chat_type и chat_id" });
  }

  try {
    const query = `
      SELECT 
        cm.message_id,
        cm.chat_type,
        cm.chat_id,
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
      WHERE cm.chat_type = ? AND cm.chat_id = ?
      ORDER BY cm.created_at ASC
      LIMIT ?
    `;
    const params = [chat_type, chat_id, parseInt(limit)];

    const [rows] = await db.query(query, params);

    console.log(`📜 Найдено ${rows.length} сообщений`);

    // Получаем реакции отдельно
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
        chat_type: row.chat_type,
        chat_id: row.chat_id,
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

// ============= СОЗДАНИЕ ЛИЧНОГО ЧАТА =============
router.post("/private", async (req, res) => {
  const { user1_id, user2_id } = req.body;

  try {
    // Проверяем, существует ли уже чат
    const [existing] = await db.query(
      `SELECT pc.chat_id 
       FROM private_chats pc
       JOIN private_chat_participants pcp1 ON pc.chat_id = pcp1.chat_id
       JOIN private_chat_participants pcp2 ON pc.chat_id = pcp2.chat_id
       WHERE pcp1.user_id = ? AND pcp2.user_id = ?
       AND (SELECT COUNT(*) FROM private_chat_participants WHERE chat_id = pc.chat_id) = 2`,
      [user1_id, user2_id]
    );

    if (existing.length > 0) {
      return res.json({ chat_id: existing[0].chat_id, is_new: false });
    }

    // Создаем новый чат
    const [result] = await db.query(`INSERT INTO private_chats () VALUES ()`);
    const chat_id = result.insertId;

    await db.query(
      `INSERT INTO private_chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)`,
      [chat_id, user1_id, chat_id, user2_id]
    );

    // Отправляем событие через Socket.IO
    if (io) {
      const newChatInfo = { id: chat_id, type: "private", unread_count: 0 };
      await NotificationService.createNotification(
        user2_id,
        "💬 Новый личный чат",
        `Пользователь начал с вами диалог`,
        "info",
        "private_chat",
        chat_id
      );
      io.to(`user_${user2_id}`).emit("new_chat_created", newChatInfo);
    }

    res.json({ chat_id, is_new: true });
  } catch (error) {
    console.error("Ошибка создания личного чата:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= СОЗДАНИЕ ГРУППЫ =============
router.post("/create-group", async (req, res) => {
  const { group_name, created_by, is_private = false, member_ids = [] } = req.body;

  console.log('📝 Создание группы:', { group_name, created_by, member_ids });

  if (!group_name || !created_by) {
    return res.status(400).json({ error: "Не указаны обязательные параметры" });
  }

  try {
    // Создаем группу
    const [groupResult] = await db.query(
      `INSERT INTO custom_groups (group_name, created_by, is_private, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [group_name.trim(), created_by, is_private ? 1 : 0]
    );

    const group_id = groupResult.insertId;
    console.log('✅ Группа создана, ID:', group_id);

    // Добавляем создателя как администратора
    await db.query(
      `INSERT INTO custom_group_members (group_id, user_id, role, joined_at) 
       VALUES (?, ?, 'admin', NOW())`,
      [group_id, created_by]
    );

    // Добавляем остальных участников
    for (const member_id of member_ids) {
      if (member_id && member_id !== created_by) {
        await db.query(
          `INSERT IGNORE INTO custom_group_members (group_id, user_id, role, joined_at) 
           VALUES (?, ?, 'member', NOW())`,
          [group_id, member_id]
        );
        console.log(`✅ Участник ${member_id} добавлен`);
      }
    }

    // Создаем пригласительный код
    const crypto = await import('crypto');
    const inviteCode = crypto.randomBytes(16).toString('hex');

    await db.query(
      `INSERT INTO chat_invites (invite_code, target_type, target_id, created_by, expires_at, created_at) 
       VALUES (?, 'custom', ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), NOW())`,
      [inviteCode, group_id, created_by]
    );

    // Отправляем событие через Socket.IO всем участникам
    if (io) {
      const newChatInfo = {
        id: group_id,
        type: "custom",
        name: group_name,
        avatar: null,
        unread_count: 0
      };

      // Отправляем создателю
      io.to(`user_${created_by}`).emit("new_chat_created", newChatInfo);

      // Отправляем всем добавленным участникам
      for (const member_id of member_ids) {
        if (member_id !== created_by) {
          io.to(`user_${member_id}`).emit("new_chat_created", newChatInfo);
          await NotificationService.createNotification(
            member_id,
            "👥 Новая группа",
            `Вас добавили в группу "${group_name}"`,
            "info",
            "custom_group",
            group_id
          );
        }
      }
    }

    res.json({ success: true, group_id: group_id, invite_code: inviteCode });

  } catch (error) {
    console.error('❌ Ошибка создания группы:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= ИНФОРМАЦИЯ О ГРУППЕ =============
router.get("/group/:groupId", async (req, res) => {
  const { groupId } = req.params;
  const { user_id } = req.query;

  console.log('📋 Запрос информации о группе:', { groupId, user_id });

  try {
    // Ищем в кастомных группах
    let [group] = await db.query(
      `SELECT cg.*, e.first_name, e.last_name as creator_name
       FROM custom_groups cg
       JOIN employees e ON cg.created_by = e.employee_id
       WHERE cg.group_id = ?`,
      [groupId]
    );

    let isCustomGroup = true;

    if (group.length === 0) {
      isCustomGroup = false;
      [group] = await db.query(
        `SELECT wg.group_id, wg.group_name, NULL as created_by, NULL as created_at, NULL as is_private
         FROM work_groups wg
         WHERE wg.group_id = ?`,
        [groupId]
      );
    }

    if (group.length === 0) {
      return res.status(404).json({ error: "Группа не найдена" });
    }

    let members = [];
    let userRole = null;

    if (isCustomGroup) {
      [members] = await db.query(
        `SELECT cgm.user_id, cgm.role, cgm.joined_at,
                e.first_name, e.last_name, e.avatar_url, e.role as employee_role
         FROM custom_group_members cgm
         JOIN employees e ON cgm.user_id = e.employee_id
         WHERE cgm.group_id = ?
         ORDER BY cgm.role = 'admin' DESC, e.last_name`,
        [groupId]
      );
      userRole = members.find(m => m.user_id == user_id)?.role || null;
    } else {
      [members] = await db.query(
        `SELECT e.employee_id as user_id, 
                'member' as role,
                e.hire_date as joined_at,
                e.first_name, e.last_name, e.avatar_url, e.role as employee_role
         FROM employees e
         WHERE e.group_id = ?
         ORDER BY e.last_name`,
        [groupId]
      );
      userRole = 'member';
    }

    res.json({
      group_id: group[0].group_id,
      group_name: group[0].group_name,
      created_by: group[0].created_by,
      created_at: group[0].created_at,
      is_private: group[0].is_private || false,
      members: members,
      user_role: userRole,
      can_edit: userRole === 'admin' || (isCustomGroup && user_id == group[0].created_by),
      is_custom: isCustomGroup
    });

  } catch (error) {
    console.error("Ошибка получения группы:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= ДОБАВЛЕНИЕ УЧАСТНИКОВ В ГРУППУ =============
router.post("/group/:groupId/add-members", async (req, res) => {
  const { groupId } = req.params;
  const { admin_id, member_ids } = req.body;

  if (!admin_id || !member_ids || member_ids.length === 0) {
    return res.status(400).json({ error: "Не указаны обязательные параметры" });
  }

  try {
    const [adminCheck] = await db.query(
      `SELECT role FROM custom_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, admin_id]
    );

    if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
      return res.status(403).json({ error: "Нет прав на добавление участников" });
    }

    const [groupInfo] = await db.query(
      `SELECT group_name FROM custom_groups WHERE group_id = ?`,
      [groupId]
    );
    const groupName = groupInfo[0]?.group_name || 'Группа';

    for (const user_id of member_ids) {
      const [existing] = await db.query(
        `SELECT * FROM custom_group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, user_id]
      );

      if (existing.length === 0) {
        await db.query(
          `INSERT INTO custom_group_members (group_id, user_id, role) VALUES (?, ?, 'member')`,
          [groupId, user_id]
        );

        // Уведомление новому участнику
        await NotificationService.createNotification(
          user_id,
          "👥 Приглашение в группу",
          `Вас добавили в группу "${groupName}"`,
          "info",
          "custom_group",
          groupId
        );

        // Отправляем событие через Socket.IO
        if (io) {
          const newChatInfo = {
            id: parseInt(groupId),
            type: "custom",
            name: groupName,
            avatar: null,
            unread_count: 0
          };
          io.to(`user_${user_id}`).emit("new_chat_created", newChatInfo);
        }
      }
    }

    res.json({ success: true, added_count: member_ids.length });

  } catch (error) {
    console.error("Ошибка добавления участников:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= ПРИСОЕДИНЕНИЕ ПО КОДУ =============
router.post("/join-by-code", async (req, res) => {
  const { invite_code, user_id } = req.body;

  try {
    const [invite] = await db.query(
      `SELECT * FROM chat_invites 
       WHERE invite_code = ? AND (expires_at IS NULL OR expires_at > NOW())
       AND (max_uses IS NULL OR uses_count < max_uses)`,
      [invite_code]
    );

    if (invite.length === 0) {
      return res.status(404).json({ error: "Приглашение недействительно" });
    }

    const inviteData = invite[0];

    if (inviteData.target_type === 'custom') {
      const [existing] = await db.query(
        `SELECT * FROM custom_group_members WHERE group_id = ? AND user_id = ?`,
        [inviteData.target_id, user_id]
      );

      if (existing.length === 0) {
        await db.query(
          `INSERT INTO custom_group_members (group_id, user_id, role) VALUES (?, ?, 'member')`,
          [inviteData.target_id, user_id]
        );

        const [groupInfo] = await db.query(
          `SELECT group_name FROM custom_groups WHERE group_id = ?`,
          [inviteData.target_id]
        );

        await NotificationService.createNotification(
          user_id,
          "👥 Присоединение к группе",
          `Вы присоединились к группе "${groupInfo[0]?.group_name}"`,
          "info",
          "custom_group",
          inviteData.target_id
        );
      }

      await db.query(
        `UPDATE chat_invites SET uses_count = uses_count + 1 WHERE invite_id = ?`,
        [inviteData.invite_id]
      );

      res.json({ success: true, target_id: inviteData.target_id, target_type: 'custom' });
    } else if (inviteData.target_type === 'private') {
      const [existing] = await db.query(
        `SELECT * FROM private_chat_participants WHERE chat_id = ? AND user_id = ?`,
        [inviteData.target_id, user_id]
      );

      if (existing.length === 0) {
        await db.query(
          `INSERT INTO private_chat_participants (chat_id, user_id) VALUES (?, ?)`,
          [inviteData.target_id, user_id]
        );
      }

      res.json({ success: true, target_id: inviteData.target_id, target_type: 'private' });
    }
  } catch (error) {
    console.error("Ошибка присоединения по коду:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= ЗАГРУЗКА ФАЙЛОВ =============
router.post('/upload', upload.single('file'), async (req, res) => {
  const { sender_id, chat_type, chat_id } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "Файл не загружен" });
  }

  const fileUrl = `/uploads/chat/${req.file.filename}`;
  const fileType = req.file.mimetype;
  const isImage = fileType.startsWith('image/');

  try {
    const messageText = isImage ? '' : `📎 Файл: ${req.file.originalname}`;

    const [result] = await db.query(
      `INSERT INTO chat_messages (chat_type, chat_id, group_id, sender_id, message, attachment_url, attachment_type)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`,
      [chat_type, chat_id, sender_id, messageText, fileUrl, fileType]
    );

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

// ============= ЧЕРНОВИКИ =============
router.get('/draft', async (req, res) => {
  const { user_id, chat_type, chat_id } = req.query;

  try {
    const [draft] = await db.query(
      `SELECT content, reply_to_id FROM chat_drafts WHERE user_id = ? AND chat_type = ? AND chat_id = ?`,
      [user_id, chat_type, chat_id]
    );

    res.json(draft[0] || { content: '', reply_to_id: null });
  } catch (error) {
    console.error("Ошибка получения черновика:", error);
    res.json({ content: '', reply_to_id: null });
  }
});

router.post('/draft', async (req, res) => {
  const { user_id, chat_type, chat_id, content, reply_to_id } = req.body;

  try {
    await db.query(
      `INSERT INTO chat_drafts (user_id, chat_type, chat_id, content, reply_to_id) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content), reply_to_id = VALUES(reply_to_id), updated_at = NOW()`,
      [user_id, chat_type, chat_id, content || '', reply_to_id || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка сохранения черновика:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete('/draft', async (req, res) => {
  const { user_id, chat_type, chat_id } = req.body;

  try {
    await db.query(
      `DELETE FROM chat_drafts WHERE user_id = ? AND chat_type = ? AND chat_id = ?`,
      [user_id, chat_type, chat_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка удаления черновика:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;