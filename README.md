<div align="center">

# 📊 KPI Monitoring System

### Корпоративная система мониторинга KPI и управления рабочими процессами

Единое пространство для **KPI, сотрудников, задач, обращений, чатов, уведомлений и отчётности**.

<br>

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react\&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js\&logoColor=white)
![MySQL](https://img.shields.io/badge/Database-MySQL-4479A1?logo=mysql\&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io\&logoColor=white)
![Google](https://img.shields.io/badge/Auth-Google_OAuth-4285F4?logo=google\&logoColor=white)
![Status](https://img.shields.io/badge/status-in_development-orange)

<br>

[Возможности](#-возможности) •
[Технологии](#️-технологии) •
[Установка](#-установка) •
[Запуск](#-запуск) •
[Архитектура](#-архитектура) •
[Безопасность](#-безопасность)

</div>

---

## 📌 О проекте

**KPI Monitoring System** — веб-приложение для автоматизации внутренних рабочих процессов компании.

Система объединяет инструменты, которые обычно находятся в нескольких отдельных сервисах:

* 📊 мониторинг KPI;
* 👥 управление сотрудниками;
* 🏢 рабочие группы;
* ✅ задачи;
* 💬 корпоративный чат;
* 🎫 обращения;
* 🔔 уведомления;
* 📑 отчётность;
* 🔐 управление доступом.

Frontend и backend разделены на независимые приложения, а для обмена событиями в реальном времени используется **Socket.IO**.

---

## ✨ Возможности

<table>
<tr>
<td width="50%" valign="top">

### 📊 KPI

Мониторинг показателей эффективности сотрудников.

* хранение метрик;
* целевые показатели;
* сбор KPI;
* контроль выполнения;
* квоты и нормативы;
* отчётность.

</td>
<td width="50%" valign="top">

### 👥 Сотрудники

Управление внутренней структурой компании.

* сотрудники;
* рабочие группы;
* роли;
* статусы;
* администрирование;
* online-статус.

</td>
</tr>

<tr>
<td width="50%" valign="top">

### ✅ Задачи

Встроенный модуль управления задачами.

* создание;
* редактирование;
* назначение исполнителей;
* статусы;
* вложения;
* контроль выполнения.

</td>
<td width="50%" valign="top">

### 💬 Чаты

Корпоративный мессенджер на Socket.IO.

* личные сообщения;
* групповые чаты;
* реакции;
* ответы;
* вложения;
* закрепление сообщений.

</td>
</tr>

<tr>
<td width="50%" valign="top">

### 🎫 Обращения

Система внутренних обращений сотрудников.

* создание обращения;
* ответственный сотрудник;
* статусы;
* комментарии;
* чат;
* вложения.

</td>
<td width="50%" valign="top">

### 🔔 Уведомления

Уведомления о событиях системы.

* новые сообщения;
* задачи;
* обращения;
* изменения статусов;
* события в реальном времени.

</td>
</tr>
</table>

---

## 🛠️ Технологии

### Frontend

| Технология            | Назначение                 |
| --------------------- | -------------------------- |
| **React 18**          | пользовательский интерфейс |
| **React Router**      | маршрутизация              |
| **Ant Design**        | UI-компоненты              |
| **Styled Components** | стилизация                 |
| **Axios**             | HTTP-запросы               |
| **Socket.IO Client**  | real-time взаимодействие   |
| **Recharts**          | графики и аналитика        |
| **FullCalendar**      | календарь                  |
| **dnd-kit**           | drag & drop                |
| **Day.js**            | работа с датами            |
| **XLSX**              | Excel-файлы                |

### Backend

| Технология           | Назначение              |
| -------------------- | ----------------------- |
| **Node.js**          | серверная среда         |
| **Express**          | REST API                |
| **MySQL**            | база данных             |
| **Socket.IO**        | real-time события       |
| **Passport.js**      | авторизация             |
| **Google OAuth 2.0** | вход через Google       |
| **Express Session**  | пользовательские сессии |
| **bcrypt**           | работа с паролями       |
| **Multer**           | загрузка файлов         |
| **Nodemailer**       | электронная почта       |
| **Node Cron**        | фоновые задачи          |
| **XLSX**             | обработка Excel         |

---

## 📁 Структура проекта

```text
KPI-monitoring-system/
│
├── 📂 backend/
│   ├── services/
│   ├── uploads/
│   │   ├── avatars/
│   │   ├── chat/
│   │   ├── tasks/
│   │   └── tickets/
│   │
│   ├── admin.routes.js
│   ├── auth.routes.js
│   ├── chat.routes.js
│   ├── db.js
│   ├── email.service.js
│   ├── group.routes.js
│   ├── metrics.routes.js
│   ├── notification.service.js
│   ├── quota.report.routes.js
│   ├── quota.service.js
│   ├── tasks.routes.js
│   ├── tickets.routes.js
│   ├── server.js
│   └── package.json
│
├── 📂 frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── App.js
│   │   ├── index.js
│   │   └── socket.js
│   └── package.json
│
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Установка

### Требования

Перед запуском необходимо установить:

![Node.js](https://img.shields.io/badge/Node.js-LTS-339933?logo=node.js\&logoColor=white)
![npm](https://img.shields.io/badge/npm-latest-CB3837?logo=npm\&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8+-4479A1?logo=mysql\&logoColor=white)

### 1. Клонируйте проект

```bash
git clone https://github.com/mewkfeli/KPI-monitoring-system.git
cd KPI-monitoring-system
```

### 2. Установите зависимости

Корневые зависимости:

```bash
npm install
```

Frontend и backend:

```bash
npm run install:all
```

Либо вручную:

```bash
npm install --prefix frontend
npm install --prefix backend
```

---

## 🗄️ База данных

Проект использует **MySQL**.

Создайте базу данных:

```sql
CREATE DATABASE kpi_monitoring_system;
```

Настройки подключения рекомендуется хранить только в переменных окружения:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=kpi_monitoring_system
```

---

## ⚙️ Настройка окружения

Создайте файл:

```text
backend/.env
```

Пример конфигурации:

```env
# Server
SESSION_SECRET=your_session_secret

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=kpi_monitoring_system

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Optional integrations
OPENAI_API_KEY=your_openai_api_key
```

> [!IMPORTANT]
> Никогда не добавляйте `.env`, OAuth Client Secret, пароли базы данных и API-ключи в Git.

Добавьте в `.gitignore`:

```gitignore
.env
backend/.env
```

---

## ▶️ Запуск

### Запуск всей системы

Frontend и backend можно запустить одновременно одной командой:

```bash
npm run dev
```

Для параллельного запуска используется **concurrently**.

После запуска:

| Сервис      | Адрес                   |
| ----------- | ----------------------- |
| 🌐 Frontend | `http://localhost:3000` |
| ⚙️ Backend  | `http://localhost:5000` |

### Отдельный запуск Backend

```bash
npm run backend
```

или:

```bash
cd backend
npm run dev
```

### Отдельный запуск Frontend

```bash
npm run frontend
```

или:

```bash
cd frontend
npm start
```

---

## 📦 Корневые npm-команды

| Команда               | Назначение                          |
| --------------------- | ----------------------------------- |
| `npm run dev`         | запустить frontend + backend        |
| `npm run frontend`    | запустить только frontend           |
| `npm run backend`     | запустить только backend            |
| `npm run install:all` | установить зависимости обеих частей |

Пример корневого `package.json`:

```json
{
  "name": "kpi-monitoring-system",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix backend\" \"npm start --prefix frontend\"",
    "frontend": "npm start --prefix frontend",
    "backend": "npm run dev --prefix backend",
    "install:all": "npm install --prefix frontend && npm install --prefix backend"
  }
}
```

---

## 🔐 Google OAuth

Авторизация через Google использует переменные:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Для локальной разработки callback URL:

```text
http://localhost:5000/api/auth/google/callback
```

Его необходимо добавить в **Authorized redirect URIs** в настройках Google OAuth.

> [!CAUTION]
> `GOOGLE_CLIENT_SECRET` нельзя прописывать непосредственно в `auth.routes.js` или другом исходном файле.

---

## 🔌 API

Основные группы REST API:

```text
/api/auth
/api/metrics
/api/group
/api/chat
/api/admin
/api/tasks
/api/tickets
/api/reports
```

Пользовательские файлы:

```text
/uploads
```

---

## ⚡ Real-time

Для взаимодействия в реальном времени используется **Socket.IO**.

Через него работают:

* 💬 новые сообщения;
* 👤 online-статусы;
* ⌨️ индикатор набора текста;
* ❤️ реакции;
* 📌 закрепление сообщений;
* ✏️ редактирование;
* 🗑️ удаление;
* 👁️ статусы прочтения;
* 🔔 уведомления;
* 🎫 чаты обращений.

Примеры Socket.IO-комнат:

```text
user_{employee_id}
group_{group_id}
ticket_{ticket_id}
private_{chat_id}
custom_{chat_id}
```

---

## 📎 Загрузка файлов

Для хранения пользовательских файлов предусмотрена структура:

```text
backend/uploads/
├── avatars/
├── chat/
├── tasks/
└── tickets/
```

Загрузка файлов на backend реализована через **Multer**.

---

## 🏗️ Архитектура

```text
┌──────────────────────────────────┐
│             FRONTEND             │
│              React               │
│                                  │
│  Dashboard  │  KPI  │  Reports  │
│  Tasks      │  Chat │  Tickets  │
│  Calendar   │       │  Admin    │
└────────────────┬─────────────────┘
                 │
          REST API / Socket.IO
                 │
┌────────────────▼─────────────────┐
│             BACKEND              │
│        Node.js + Express         │
│                                  │
│  Auth        │ KPI Collector     │
│  Tasks       │ Chat              │
│  Tickets     │ Notifications     │
│  Reports     │ File Storage      │
└────────────────┬─────────────────┘
                 │
               MySQL
                 │
┌────────────────▼─────────────────┐
│             DATABASE             │
│                                  │
│ Employees    │ KPI               │
│ Work Groups  │ Tasks             │
│ Messages     │ Tickets           │
│ Reports      │ Settings          │
└──────────────────────────────────┘
```

---

## 🛡️ Безопасность

Перед production-развёртыванием необходимо:

* [ ] вынести все секреты в `.env`;
* [ ] использовать уникальный `SESSION_SECRET`;
* [ ] не хранить Google Client Secret в Git;
* [ ] не хранить API-ключи в исходном коде;
* [ ] создать отдельного пользователя MySQL;
* [ ] ограничить CORS production-доменами;
* [ ] использовать HTTPS;
* [ ] включить защищённые cookie;
* [ ] проверить доступ к `/uploads`;
* [ ] настроить production Google OAuth redirect URI.

> [!WARNING]
> Если секрет случайно попал в Git, удалить его из текущего файла недостаточно. Его необходимо удалить из соответствующего коммита/истории и перевыпустить в сервисе, которому он принадлежит.

---

## 📦 Production

Сборка frontend:

```bash
npm run build --prefix frontend
```

Результат:

```text
frontend/build/
```

Для production необходимо отдельно настроить:

* переменные окружения;
* MySQL;
* HTTPS;
* CORS;
* Google OAuth;
* сессии;
* хранение пользовательских файлов.

---

## 🚧 Статус проекта

> **KPI Monitoring System НЕ находится в разработке.**

---

<div align="center">

### KPI Monitoring System

**KPI • Tasks • Teams • Chat • Reports**

Made with React, Node.js & MySQL

</div>
