// backend/chat.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db.js";
import { NotificationService } from "./notification.service.js";
import crypto from 'crypto';

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
    const allChats = [];

    // 1. Рабочая группа пользователя (из work_groups)
    const [workGroups] = await db.query(
      `SELECT 
        wg.group_id as id, 
        wg.group_name as name, 
        NULL as avatar, 
        wg.created_at,
        'group' as type
       FROM work_groups wg
       JOIN employees e ON e.group_id = wg.group_id
       WHERE e.employee_id = ?`,
      [user_id]
    );
    
    if (workGroups.length > 0) {
      console.log('✅ Найдена рабочая группа:', workGroups[0]);
      allChats.push(...workGroups);
    } else {
      console.log('⚠️ Рабочая группа не найдена для user_id:', user_id);
    }

    // 2. Кастомные группы пользователя
    const [customGroups] = await db.query(
      `SELECT 
        cg.group_id as id, 
        cg.group_name as name, 
        cg.group_avatar as avatar, 
        cg.created_at,
        'custom' as type
       FROM custom_groups cg
       JOIN custom_group_members cgm ON cg.group_id = cgm.group_id
       WHERE cgm.user_id = ?`,
      [user_id]
    );
    
    if (customGroups.length > 0) {
      console.log('✅ Найдены кастомные группы:', customGroups.length);
      allChats.push(...customGroups);
    }

    // 3. Личные чаты пользователя
    const [privateChats] = await db.query(
      `SELECT 
        pc.chat_id as id, 
        CONCAT(e.first_name, ' ', e.last_name) as name,
        e.avatar_url as avatar,
        pc.created_at,
        'private' as type
       FROM private_chats pc
       JOIN private_chat_participants pcp ON pc.chat_id = pcp.chat_id
       JOIN employees e ON pcp.user_id = e.employee_id
       WHERE pcp.user_id != ? 
         AND pc.chat_id IN (
           SELECT chat_id 
           FROM private_chat_participants 
           WHERE user_id = ?
         )`,
      [user_id, user_id]
    );
    
    if (privateChats.length > 0) {
      console.log('✅ Найдены личные чаты:', privateChats.length);
      allChats.push(...privateChats);
    }

    // Добавляем счетчики непрочитанных сообщений
    for (const chat of allChats) {
      try {
        const [unreadResult] = await db.query(
          `SELECT COUNT(*) as count
           FROM chat_messages cm
           LEFT JOIN chat_read_receipts crr 
             ON cm.message_id = crr.message_id 
             AND crr.user_id = ?
           WHERE cm.chat_type = ? 
             AND cm.chat_id = ? 
             AND cm.sender_id != ? 
             AND crr.receipt_id IS NULL 
             AND cm.is_deleted = 0`,
          [user_id, chat.type, chat.id, user_id]
        );
        chat.unread_count = unreadResult[0]?.count || 0;
      } catch (err) {
        console.error(`Ошибка подсчета для чата ${chat.type}_${chat.id}:`, err.message);
        chat.unread_count = 0;
      }
    }

    console.log(`📋 Итого чатов: ${allChats.length} (группы: ${workGroups.length}, кастомные: ${customGroups.length}, личные: ${privateChats.length})`);
    
    res.json(allChats);

  } catch (error) {
    console.error("❌ Критическая ошибка получения списка чатов:", error);
    res.status(500).json({ 
      error: "Ошибка сервера", 
      details: error.message,
      stack: error.stack
    });
  }
});

// ============= ПОЛУЧЕНИЕ НЕПРОЧИТАННЫХ СООБЩЕНИЙ =============
router.get("/unread-count", async (req, res) => {
  const { user_id, chat_type, chat_id } = req.query;
  
  try {
    const [result] = await db.query(
      `SELECT COUNT(*) as count
       FROM chat_messages cm
       LEFT JOIN chat_read_receipts crr ON cm.message_id = crr.message_id AND crr.user_id = ?
       WHERE cm.chat_type = ? 
         AND cm.chat_id = ? 
         AND cm.sender_id != ? 
         AND crr.receipt_id IS NULL 
         AND (cm.is_deleted = FALSE OR cm.is_deleted IS NULL)`,
      [user_id, chat_type, chat_id, user_id]
    );
    
    res.json({ count: result[0]?.count || 0 });
  } catch (error) {
    console.error("Ошибка подсчета непрочитанных:", error);
    res.json({ count: 0 });
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

    // СОЗДАЕМ ПРИГЛАСИТЕЛЬНЫЙ КОД (ОДИН РАЗ!)
const inviteCode = crypto.randomBytes(16).toString('hex');

await db.query(
  `INSERT INTO chat_invites (invite_code, target_type, target_id, created_by, expires_at, max_uses, created_at) 
   VALUES (?, 'custom', ?, ?, NULL, 0, NOW())`,  // ✅ NULL = бессрочно, 0 = безлимитно
  [inviteCode, group_id, created_by]
);
    
    console.log('✅ Пригласительный код создан:', inviteCode);

    // Отправляем событие через Socket.IO всем участникам
    if (io) {
      const newChatInfo = {
        id: group_id,
        type: "custom",
        name: group_name,
        avatar: null,
        unread_count: 0
      };

      io.to(`user_${created_by}`).emit("new_chat_created", newChatInfo);

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

    // ВОЗВРАЩАЕМ КОД В ОТВЕТЕ
    res.json({ 
      success: true, 
      group_id: group_id, 
      invite_code: inviteCode
    });

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
        `SELECT wg.group_id, 
                wg.group_name, 
                wg.created_at,
                NULL as created_by, 
                NULL as is_private
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
                e.first_name, 
                e.last_name, 
                e.avatar_url, 
                e.role as employee_role,
                e.status
         FROM employees e
         WHERE e.group_id = ?
           AND e.status != 'Уволен'
         ORDER BY e.last_name`,
        [groupId]
      );
      userRole = 'member';
    }

    console.log('Group created_at:', group[0].created_at);

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

  console.log('🔑 Попытка присоединения по коду:', { invite_code, user_id });

  try {
    // Ищем приглашение (без проверки срока действия)
    const [invite] = await db.query(
      `SELECT * FROM chat_invites 
       WHERE invite_code = ? 
       AND (expires_at IS NULL OR 1=1)  -- ✅ ВСЕГДА АКТИВЕН
       AND (max_uses IS NULL OR uses_count < max_uses OR max_uses = 0)`,
      [invite_code]
    );

    console.log('Найдено приглашений:', invite.length);

    if (invite.length === 0) {
      return res.status(404).json({ error: "Приглашение не найдено" });
    }

    const inviteData = invite[0];

    if (inviteData.target_type === 'custom') {
      // Проверяем, не состоит ли уже пользователь в группе
      const [existing] = await db.query(
        `SELECT * FROM custom_group_members WHERE group_id = ? AND user_id = ?`,
        [inviteData.target_id, user_id]
      );

      if (existing.length > 0) {
        // Пользователь уже в группе - просто возвращаем успех
        await db.query(
          `UPDATE chat_invites SET uses_count = uses_count + 1 WHERE invite_id = ?`,
          [inviteData.invite_id]
        );
        
        return res.json({ 
          success: true, 
          target_id: inviteData.target_id, 
          target_type: 'custom',
          message: 'Вы уже состоите в этой группе'
        });
      }

      // Добавляем пользователя в группу
      await db.query(
        `INSERT INTO custom_group_members (group_id, user_id, role) VALUES (?, ?, 'member')`,
        [inviteData.target_id, user_id]
      );

      // Получаем информацию о группе для уведомления
      const [groupInfo] = await db.query(
        `SELECT group_name FROM custom_groups WHERE group_id = ?`,
        [inviteData.target_id]
      );

      // Отправляем уведомление
      try {
        await NotificationService.createNotification(
          user_id,
          "👥 Присоединение к группе",
          `Вы присоединились к группе "${groupInfo[0]?.group_name || 'Без названия'}"`,
          "info",
          "custom_group",
          inviteData.target_id
        );
      } catch (notifError) {
        console.error('Ошибка создания уведомления:', notifError);
      }

      // Увеличиваем счетчик использований
      await db.query(
        `UPDATE chat_invites SET uses_count = uses_count + 1 WHERE invite_id = ?`,
        [inviteData.invite_id]
      );

      console.log('✅ Пользователь присоединился к группе');

      // Отправляем событие через сокет
      if (io) {
        const [newMember] = await db.query(
          `SELECT employee_id, first_name, last_name, avatar_url FROM employees WHERE employee_id = ?`,
          [user_id]
        );
        
        if (newMember.length > 0) {
          io.to(`custom_${inviteData.target_id}`).emit("member_joined", {
            group_id: inviteData.target_id,
            member: newMember[0]
          });
        }
      }

      res.json({ 
        success: true, 
        target_id: inviteData.target_id, 
        target_type: 'custom',
        message: 'Вы успешно присоединились к группе'
      });
    } else {
      res.status(400).json({ error: "Неподдерживаемый тип приглашения" });
    }
  } catch (error) {
    console.error("Ошибка присоединения по коду:", error);
    res.status(500).json({ error: "Ошибка сервера", details: error.message });
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
// ============= ПОЛУЧЕНИЕ КОДА ПРИГЛАШЕНИЯ =============
router.get("/group/:groupId/invite-code", async (req, res) => {
  const { groupId } = req.params;
  const { user_id } = req.query;
  
  console.log('🔑 Запрос кода приглашения для группы:', groupId);
  
  try {
    // Проверяем, существует ли группа
    const [group] = await db.query(
      `SELECT group_id, group_name FROM custom_groups WHERE group_id = ?`,
      [groupId]
    );
    
    if (group.length === 0) {
      return res.status(404).json({ error: "Группа не найдена" });
    }
    
    // Ищем активное приглашение (без проверки срока)
    let [invite] = await db.query(
      `SELECT invite_code, expires_at FROM chat_invites 
       WHERE target_type = 'custom' AND target_id = ? 
       AND (expires_at IS NULL OR 1=1)  -- ✅ Всегда активно
       ORDER BY created_at DESC LIMIT 1`,
      [groupId]
    );
    
    // Если нет приглашения - создаем новое (бессрочное)
    if (invite.length === 0) {
      const newInviteCode = crypto.randomBytes(16).toString('hex');
      
      await db.query(
        `INSERT INTO chat_invites (invite_code, target_type, target_id, created_by, expires_at, max_uses) 
         VALUES (?, 'custom', ?, ?, NULL, 0)`,  // ✅ Бессрочное и безлимитное
        [newInviteCode, groupId, user_id || 1]
      );
      
      invite = [{ invite_code: newInviteCode }];
      console.log('✅ Создан новый бессрочный код:', newInviteCode);
    }
    
    res.json({ invite_code: invite[0].invite_code });
    
  } catch (error) {
    console.error("Ошибка получения кода приглашения:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});
// ============= УДАЛЕНИЕ УЧАСТНИКА ИЗ ГРУППЫ =============
router.delete("/group/:groupId/member/:userId", async (req, res) => {
  const { groupId, userId } = req.params;
  const { admin_id } = req.body;
  
  console.log('🗑 Удаление участника:', { groupId, userId, admin_id });
  
  if (!admin_id) {
    return res.status(400).json({ error: "Не указан ID администратора" });
  }
  
  try {
    // Проверяем права админа
    const [adminCheck] = await db.query(
      `SELECT role FROM custom_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, admin_id]
    );
    
    if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
      return res.status(403).json({ error: "Нет прав на удаление участников" });
    }
    
    // Проверяем, что удаляемый не админ
    const [memberCheck] = await db.query(
      `SELECT role FROM custom_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (memberCheck.length === 0) {
      return res.status(404).json({ error: "Участник не найден" });
    }
    
    if (memberCheck[0].role === 'admin') {
      return res.status(403).json({ error: "Нельзя удалить администратора группы" });
    }
    
    // Получаем название группы до удаления
    const [groupInfo] = await db.query(
      `SELECT group_name FROM custom_groups WHERE group_id = ?`,
      [groupId]
    );
    const groupName = groupInfo[0]?.group_name || 'группы';
    
    // Удаляем участника
    await db.query(
      `DELETE FROM custom_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    // Отправляем уведомление удаленному пользователю
    await NotificationService.createNotification(
      userId,
      "⚠️ Исключение из группы",
      `Вас исключили из группы "${groupName}"`,
      "warning",
      "custom_group",
      groupId
    );
    
    // 👇 ВАЖНО: Отправляем событие через Socket.IO удаленному пользователю
if (io) {
      // Событие для удаления чата из списка у пользователя
      io.to(`user_${userId}`).emit("chat_removed", { 
        chat_id: parseInt(groupId), 
        chat_type: "custom",
        group_name: groupName
      });
      
      // Также отправляем событие для обновления списка участников админу
      io.to(`user_${admin_id}`).emit("member_removed", {
        group_id: parseInt(groupId),
        member_id: parseInt(userId)
      });
    }
    
    res.json({ success: true, message: "Участник удален" });
    
  } catch (error) {
    console.error("Ошибка удаления участника:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= УДАЛЕНИЕ ГРУППЫ =============
router.delete("/group/:groupId", async (req, res) => {
  const { groupId } = req.params;
  const { admin_id } = req.body;
  
  console.log('🗑 Удаление группы:', { groupId, admin_id });
  
  if (!admin_id) {
    return res.status(400).json({ error: "Не указан ID администратора" });
  }
  
  try {
    // Проверяем, что пользователь является администратором группы
    const [adminCheck] = await db.query(
      `SELECT role FROM custom_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, admin_id]
    );
    
    if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
      return res.status(403).json({ error: "Нет прав на удаление группы" });
    }
    
    // Получаем всех участников группы для уведомлений
    const [members] = await db.query(
      `SELECT user_id FROM custom_group_members WHERE group_id = ?`,
      [groupId]
    );
    
    // Получаем название группы
    const [groupInfo] = await db.query(
      `SELECT group_name FROM custom_groups WHERE group_id = ?`,
      [groupId]
    );
    const groupName = groupInfo[0]?.group_name || 'Группа';
    
    // Отправляем уведомления всем участникам перед удалением
    for (const member of members) {
      await NotificationService.createNotification(
        member.user_id,
        "🗑 Группа удалена",
        `Группа "${groupName}" была удалена администратором`,
        "warning",
        "custom_group",
        groupId
      );
      
      // Отправляем событие через Socket.IO каждому участнику
      if (io) {
        io.to(`user_${member.user_id}`).emit("group_deleted", { 
          group_id: parseInt(groupId), 
          group_name: groupName,
          chat_type: "custom"
        });
      }
    }
    
    // Удаляем все приглашения для этой группы
    await db.query(`DELETE FROM chat_invites WHERE target_type = 'custom' AND target_id = ?`, [groupId]);
    
    // Удаляем всех участников группы
    await db.query(`DELETE FROM custom_group_members WHERE group_id = ?`, [groupId]);
    
    // Удаляем сообщения группы
    await db.query(`DELETE FROM chat_messages WHERE chat_type = 'custom' AND chat_id = ?`, [groupId]);
    
    // Удаляем саму группу
    await db.query(`DELETE FROM custom_groups WHERE group_id = ?`, [groupId]);
    
    console.log(`✅ Группа ${groupId} "${groupName}" полностью удалена`);
    
    res.json({ success: true, message: "Группа удалена" });
    
  } catch (error) {
    console.error("Ошибка удаления группы:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ============= НАСТРОЙКА MULTER ДЛЯ АВАТАРОК ГРУПП =============
const groupAvatarsDir = './uploads/group-avatars/';
if (!fs.existsSync(groupAvatarsDir)) {
  fs.mkdirSync(groupAvatarsDir, { recursive: true });
}

const groupAvatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, groupAvatarsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'group-avatar-' + uniqueSuffix + ext);
  }
});

const uploadGroupAvatar = multer({
  storage: groupAvatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения'));
    }
  }
});

// ============= ЗАГРУЗКА АВАТАРКИ ГРУППЫ =============
router.post('/group/:groupId/avatar', uploadGroupAvatar.single('avatar'), async (req, res) => {
  const { groupId } = req.params;
  const { admin_id } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  
  try {
    // Проверяем, что пользователь админ группы
    const [adminCheck] = await db.query(
      `SELECT role FROM custom_group_members WHERE group_id = ? AND user_id = ? AND role = 'admin'`,
      [groupId, admin_id]
    );
    
    if (adminCheck.length === 0) {
      return res.status(403).json({ error: 'Только администратор может менять аватарку' });
    }
    
    const avatarUrl = `/uploads/group-avatars/${req.file.filename}`;
    
    await db.query(
      `UPDATE custom_groups SET group_avatar = ? WHERE group_id = ?`,
      [avatarUrl, groupId]
    );
    
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (error) {
    console.error('Ошибка загрузки аватарки группы:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= УДАЛЕНИЕ АВАТАРКИ ГРУППЫ =============
router.delete('/group/:groupId/avatar', async (req, res) => {
  const { groupId } = req.params;
  const { admin_id } = req.body;
  
  try {
    const [adminCheck] = await db.query(
      `SELECT role FROM custom_group_members WHERE group_id = ? AND user_id = ? AND role = 'admin'`,
      [groupId, admin_id]
    );
    
    if (adminCheck.length === 0) {
      return res.status(403).json({ error: 'Только администратор может менять аватарку' });
    }
    
    const [rows] = await db.query(
      `SELECT group_avatar FROM custom_groups WHERE group_id = ?`,
      [groupId]
    );
    
    if (rows[0]?.group_avatar) {
      const oldPath = path.join(process.cwd(), rows[0].group_avatar);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    await db.query(
      `UPDATE custom_groups SET group_avatar = NULL WHERE group_id = ?`,
      [groupId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления аватарки группы:', error);
    res.status(500).json({ error: error.message });
  }
});
// ============= ЗАКРЕПИТЬ СООБЩЕНИЕ =============
router.post('/messages/:messageId/pin', async (req, res) => {
  const { messageId } = req.params;
  const { user_id } = req.body;
  
  try {
    // Получаем информацию о сообщении и чате
    const [message] = await db.query(
      `SELECT cm.*, 
              CASE 
                WHEN cm.chat_type = 'custom' THEN (
                  SELECT role FROM custom_group_members 
                  WHERE group_id = cm.chat_id AND user_id = ? AND role = 'admin'
                )
                WHEN cm.chat_type = 'group' THEN (
                  SELECT role FROM employees 
                  WHERE employee_id = ? AND role IN ('Руководитель группы', 'Руководитель отдела')
                )
                ELSE NULL
              END as user_role
       FROM chat_messages cm
       WHERE cm.message_id = ?`,
      [user_id, user_id, messageId]
    );
    
    if (message.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    
    // Проверяем права (только админ или руководитель)
    if (message[0].chat_type === 'private' || !message[0].user_role) {
      return res.status(403).json({ error: 'Нет прав для закрепления' });
    }
    
    await db.query(
      `UPDATE chat_messages 
       SET is_pinned = TRUE, pinned_by = ?, pinned_at = NOW() 
       WHERE message_id = ?`,
      [user_id, messageId]
    );
    
    // Отправляем событие через сокет
    if (io) {
      const roomName = message[0].chat_type === 'private' 
        ? `private_${message[0].chat_id}` 
        : message[0].chat_type === 'custom' 
          ? `custom_${message[0].chat_id}` 
          : `group_${message[0].chat_id}`;
      
      io.to(roomName).emit('message_pinned', { message_id: messageId });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка закрепления:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= ОТКРЕПИТЬ СООБЩЕНИЕ =============
router.post('/messages/:messageId/unpin', async (req, res) => {
  const { messageId } = req.params;
  const { user_id } = req.body;
  
  try {
    const [message] = await db.query(
      `SELECT chat_type, chat_id FROM chat_messages WHERE message_id = ?`,
      [messageId]
    );
    
    if (message.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    
    await db.query(
      `UPDATE chat_messages 
       SET is_pinned = FALSE, pinned_by = NULL, pinned_at = NULL 
       WHERE message_id = ?`,
      [messageId]
    );
    
    if (io) {
      const roomName = message[0].chat_type === 'private' 
        ? `private_${message[0].chat_id}` 
        : message[0].chat_type === 'custom' 
          ? `custom_${message[0].chat_id}` 
          : `group_${message[0].chat_id}`;
      
      io.to(roomName).emit('message_unpinned', { message_id: messageId });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка открепления:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= ПОЛУЧИТЬ ЗАКРЕПЛЕННЫЕ СООБЩЕНИЯ =============
router.get('/messages/pinned', async (req, res) => {
  const { chat_type, chat_id } = req.query;
  
  try {
    const [messages] = await db.query(
      `SELECT cm.*, 
              e.last_name, e.first_name, e.avatar_url as sender_avatar_url
       FROM chat_messages cm
       JOIN employees e ON cm.sender_id = e.employee_id
       WHERE cm.chat_type = ? 
         AND cm.chat_id = ? 
         AND cm.is_pinned = TRUE 
         AND cm.is_deleted = FALSE
       ORDER BY cm.pinned_at DESC`,
      [chat_type, chat_id]
    );
    
    res.json(messages);
  } catch (error) {
    console.error('Ошибка получения закрепленных:', error);
    res.status(500).json({ error: error.message });
  }
});
export default router;