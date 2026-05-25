// backend/services/messageFilter.service.js

export class MessageFilter {
  // Расширенный список запрещенных слов (ручная проверка)
  static badWords = [
    // Основные матерные слова и их формы
    'сука', 'хуй', 'хуя', 'хуе', 'хуё', 'хуи', 'хуйня', 'хуесос', 'хуево', 'хуёво',
    'пизд', 'пизда', 'пиздец', 'пиздеть', 'пиздю', 'пиздой', 'пизды',
    'бля', 'блять', 'блядь', 'блядина', 'блядство', 'блядский', 'блядью',
    'еб', 'ебать', 'ебаться', 'ебануть', 'ебанутый', 'ебучий', 'ебал', 'ебало',
    'сука', 'суки', 'суку', 'сукой', 'суке', 'сучара', 'сучий',
    'заебал', 'заебали', 'заебаться', 'заебатый',
    'мудак', 'мудила', 'мудачье',
    'гандон', 'гандона', 'гандонье',
    'пидор', 'пидорас', 'пидора', 'пидорский',
    'шлюха', 'шлюхи', 'шлюхой', 'шлюший',
    'хуила', 'хуило', 'петух', 'петушара',
    'долбаеб', 'долбоеб', 'долбаёб'
  ];

  // Проверка на спам
  static async checkSpam(text) {
    console.log('🔍 [СПАМ-ФИЛЬТР] Проверка сообщения:', text);
    
    // 1. Проверка на подозрительные ссылки
    const urlPattern = /(?:https?:\/\/)?(?:www\.)?(?:t\.me|t\.ly|bit\.ly|goo\.gl|tinyurl\.com)\S+/i;
    if (urlPattern.test(text)) {
      console.log('🚫 [СПАМ-ФИЛЬТР] Обнаружена подозрительная ссылка');
      return { isSpam: true, reason: 'Обнаружена подозрительная ссылка' };
    }

    // 2. Проверка на повторяющиеся символы
    const repeatedPattern = /(.)\1{7,}/;
    if (repeatedPattern.test(text.replace(/\s/g, ''))) {
      console.log('🚫 [СПАМ-ФИЛЬТР] Слишком много повторяющихся символов');
      return { isSpam: true, reason: 'Слишком много повторяющихся символов' };
    }

    // 3. Проверка на рекламные фразы
    const spamPhrases = [
      'заработок', 'биткоин', 'крипта', 'манибек', 'быстрый займ',
      'продажа', 'скидка', 'акция', 'бесплатно', 'деньги', 'казино',
      'заработай', 'легкие деньги', 'пассивный доход'
    ];
    
    const lowerText = text.toLowerCase();
    for (const phrase of spamPhrases) {
      if (lowerText.includes(phrase) && text.length < 100) {
        console.log('🚫 [СПАМ-ФИЛЬТР] Подозрительное сообщение, фраза:', phrase);
        return { isSpam: true, reason: 'Подозрительное сообщение' };
      }
    }

    console.log('✅ [СПАМ-ФИЛЬТР] Спам не обнаружен');
    return { isSpam: false };
  }

  // Ручная проверка на нецензурную лексику
  // Ручная проверка на нецензурную лексику (упрощённая)
static checkProfanityManual(text) {
  console.log('🔍 [РУЧНАЯ ПРОВЕРКА] Анализ текста...');
  const lowerText = text.toLowerCase();
  
  // Простой поиск (без сложных регулярных выражений)
  const foundWords = [];
  for (const word of this.badWords) {
    if (lowerText.includes(word)) {  // 👈 ПРОСТО includes, без regex
      foundWords.push(word);
    }
  }
  
  if (foundWords.length > 0) {
    console.log(`⚠️ [РУЧНАЯ ПРОВЕРКА] Найдены запрещенные слова: ${foundWords.join(', ')}`);
    return { hasProfanity: true, foundWords };
  }
  
  console.log('✅ [РУЧНАЯ ПРОВЕРКА] Нарушений не найдено');
  return { hasProfanity: false };
}

  // Проверка через Яндекс.Спеллер (ИИ)
  static async checkProfanityAI(text) {
    console.log('🤖 [ЯНДЕКС.СПЕЛЛЕР (ИИ)] Отправка запроса...');
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(
        `https://speller.yandex.net/services/spellservice.json/checkText?text=${encodeURIComponent(text)}&lang=ru&options=4`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      const endTime = Date.now();
      console.log(`⏱️ [ЯНДЕКС.СПЕЛЛЕР (ИИ)] Время ответа: ${endTime - startTime}мс`);

      if (!response.ok) {
        console.log(`⚠️ [ЯНДЕКС.СПЕЛЛЕР (ИИ)] Ошибка API: ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log('📦 [ЯНДЕКС.СПЕЛЛЕР (ИИ)] Ответ:', JSON.stringify(data, null, 2));
      
      // code === 4 означает нецензурную лексику
      const badWordsFromAI = data.filter(item => item.code === 4);
      
      if (badWordsFromAI.length > 0) {
        console.log(`⚠️ [ЯНДЕКС.СПЕЛЛЕР (ИИ)] ИИ обнаружил нарушения!`);
        badWordsFromAI.forEach(item => {
          console.log(`   - Слово: "${item.word}" → предлагает: ${item.s?.join(', ') || '***'}`);
        });
        return { hasProfanity: true, source: 'yandex_ai', details: badWordsFromAI };
      }
      
      console.log('✅ [ЯНДЕКС.СПЕЛЛЕР (ИИ)] ИИ не нашёл нарушений');
      return { hasProfanity: false, source: 'yandex_ai' };
      
    } catch (error) {
      console.error('❌ [ЯНДЕКС.СПЕЛЛЕР (ИИ)] Ошибка:', error.message);
      return null;
    }
  }

  // Гибридная проверка: сначала ИИ, если недоступен - ручная
  static async checkProfanity(text) {
  console.log('\n🔍 [ГИБРИДНАЯ ПРОВЕРКА] Начинаем анализ текста...');
  console.log('📝 Текст:', text);
  
  // 1. Проверка через ИИ
  const aiResult = await this.checkProfanityAI(text);
  
  // 2. ВСЕГДА проверяем ручным списком (для слов, которые API пропускает, например "сука")
  const manualResult = this.checkProfanityManual(text);
  
  // 3. Если ИЛИ ИИ нашёл ИЛИ ручная проверка нашла - возвращаем true
  const hasProfanity = (aiResult?.hasProfanity === true) || manualResult.hasProfanity;
  
  if (hasProfanity) {
    console.log(`⚠️ [ГИБРИДНАЯ ПРОВЕРКА] Нарушение обнаружено!`);
    if (aiResult?.hasProfanity) console.log(`   - Источник: ИИ (Яндекс)`);
    if (manualResult.hasProfanity) console.log(`   - Источник: ручная проверка, слова: ${manualResult.foundWords?.join(', ')}`);
  } else {
    console.log(`✅ [ГИБРИДНАЯ ПРОВЕРКА] Нарушений не найдено`);
  }
  
  return { hasProfanity, source: 'hybrid' };
}

  // Очистка текста от нецензурной лексики
  static censorText(text) {
    console.log('🔧 [ЦЕНЗУРА] Исходный текст:', text);
    let censoredText = text;
    
    // Сортируем слова по длине (сначала длинные)
    const sortedWords = [...this.badWords].sort((a, b) => b.length - a.length);
    
    let replacedCount = 0;
    for (const word of sortedWords) {
      const regex = new RegExp(`\\b${word}\\w*`, 'gi');
      const beforeReplace = censoredText;
      censoredText = censoredText.replace(regex, '***');
      if (beforeReplace !== censoredText) {
        replacedCount++;
      }
    }
    
    // Дополнительная чистка с регулярками (на всякий случай)
    const patterns = [
      /бля(?:дь|ть|дина|дство|тский)?/gi,
      /сук(?:а|и|у|ой|е|чара)?/gi,
      /ху(?:й|я|е|ё|йня|есос|ево|ёво|ило|ила)?/gi,
      /пизд(?:а|е|ец|еть|ю|ой|ы)?/gi,
      /еб(?:ать|аться|ануть|анутый|учий|ал|ало)?/gi,
      /заеб(?:ал|али|аться|атый)?/gi
    ];
    
    for (const pattern of patterns) {
      censoredText = censoredText.replace(pattern, '***');
    }
    
    console.log(`🔧 [ЦЕНЗУРА] Результат: ${censoredText} (заменено ${replacedCount} слов)`);
    return censoredText;
  }

  // Главная функция фильтрации
  static async filterMessage(message, chatId, db) {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 [ФИЛЬТРАЦИЯ] НАЧАЛО ОБРАБОТКИ СООБЩЕНИЯ');
    console.log('='.repeat(70));
    console.log(`📝 Сообщение: "${message}"`);
    console.log(`🆔 ID чата: ${chatId}`);
    console.log('='.repeat(70));
    
    if (!message || message.trim().length === 0) {
      console.log('❌ [ФИЛЬТРАЦИЯ] Пустое сообщение - блокируем');
      return { allowed: false, message: null, reason: 'Пустое сообщение' };
    }

    // ЭТАП 1: Проверка на спам
    console.log('\n📌 ЭТАП 1: ПРОВЕРКА НА СПАМ');
    const spamCheck = await this.checkSpam(message);
    if (spamCheck.isSpam) {
      console.log(`❌ [ФИЛЬТРАЦИЯ] СПАМ! Причина: ${spamCheck.reason}`);
      
      // Логируем спам
      try {
        await db.query(
          `INSERT INTO filtered_messages (chat_id, original_message, reason, created_at)
           VALUES (?, ?, ?, NOW())`,
          [chatId, message.substring(0, 500), spamCheck.reason]
        );
        console.log('📝 [ФИЛЬТРАЦИЯ] Спам записан в лог');
      } catch (err) {
        console.error('❌ Ошибка записи в лог:', err.message);
      }
      
      console.log('='.repeat(70) + '\n');
      return { allowed: false, message: null, reason: spamCheck.reason };
    }
    console.log('✅ [ФИЛЬТРАЦИЯ] Спам не обнаружен');

    // ЭТАП 2: Проверка на нецензурную лексику (гибридная)
    console.log('\n📌 ЭТАП 2: ПРОВЕРКА НА НЕЦЕНЗУРНУЮ ЛЕКСИКУ');
    const profanityCheck = await this.checkProfanity(message);
    
    if (profanityCheck.hasProfanity) {
      console.log(`⚠️ [ФИЛЬТРАЦИЯ] Обнаружена нецензурная лексика! Источник: ${profanityCheck.source}`);
      
      // Цензурируем сообщение
      const censoredMessage = this.censorText(message);
      
      console.log(`📝 [ФИЛЬТРАЦИЯ] Оригинал: "${message}"`);
      console.log(`📝 [ФИЛЬТРАЦИЯ] Цензура: "${censoredMessage}"`);
      
      // Логируем в БД
      try {
        await db.query(
          `INSERT INTO filtered_messages (chat_id, original_message, filtered_message, reason, created_at)
           VALUES (?, ?, ?, 'нецензурная лексика', NOW())`,
          [chatId, message.substring(0, 500), censoredMessage.substring(0, 500)]
        );
        console.log('📝 [ФИЛЬТРАЦИЯ] Нарушение записано в лог');
      } catch (err) {
        console.error('❌ Ошибка записи в лог:', err.message);
      }
      
      console.log('✅ [ФИЛЬТРАЦИЯ] Сообщение отцензурено и будет отправлено');
      console.log('='.repeat(70) + '\n');
      return { allowed: true, message: censoredMessage, wasFiltered: true };
    }

    console.log('✅ [ФИЛЬТРАЦИЯ] Сообщение чистое, отправляем оригинал');
    console.log('='.repeat(70) + '\n');
    return { allowed: true, message: message, wasFiltered: false };
  }
}