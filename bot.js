const { Telegraf, Markup } = require('telegraf');
const { openDatabase } = require('./db');
const pluginManager = require('./pluginManager');

const MAIN = 'main';
const PAGE_SIZE = 6;

function keyboard(rows) {
  return Markup.inlineKeyboard(rows.map((row) =>
    row.map(([text, data]) => Markup.button.callback(text, data))
  ));
}

function mainKeyboard() {
  return keyboard([
    [['👤 Аккаунты Playerok', 'accounts'], ['⚙️ Глобальные переключатели', 'global']],
    [['📦 Управление лотами', 'lots'], ['🛒 Автопокупка', 'autobuy']],
    [['📤 Настройки автовыдачи', 'delivery'], ['💬 Чаты и автоответы', 'chats']],
    [['🤝 Заказы и сделки', 'orders'], ['💰 Финансы и статистика', 'finance']],
    [['🔔 Уведомления', 'notifications'], ['🧩 Плагины', 'plugins']],
    [['🛠️ Система и настройки', 'system'], ['▶️ Далее', 'more']]
  ]);
}

function backKeyboard(target = MAIN) {
  return keyboard([[['⬅️ Назад', target]]]);
}

function createBot({ token, adminIds, dataDir }) {
  const bot = new Telegraf(token);
  const db = openDatabase(dataDir);

  function allowed(ctx) {
    return Boolean(ctx.from && adminIds.includes(ctx.from.id));
  }

  async function deny(ctx) {
    const message = '⛔ Доступ закрыт. Этот бот доступен только владельцу.';
    if (ctx.callbackQuery) return ctx.answerCbQuery(message, { show_alert: true });
    return ctx.reply(message);
  }

  bot.use(async (ctx, next) => {
    if (!allowed(ctx)) return deny(ctx);
    return next();
  });

  function activeAccount() {
    const id = Number(db.getAppSetting('active_account_id', '0'));
    return db.listAccounts().find((account) => account.id === id) || null;
  }

  function accountName() {
    return activeAccount()?.label || 'не выбран';
  }

  bot.start((ctx) => {
    db.addEvent('INFO', `Started by Telegram user ${ctx.from.id}`);
    return ctx.reply(
      '🎮 PLAYEROK CONTROL\n\n' +
      'Каркас панели управления запущен.\n' +
      `Активный аккаунт: ${accountName()}\n\n` +
      'Выбери раздел:',
      mainKeyboard()
    );
  });

  bot.command('menu', (ctx) => ctx.reply('🎮 PLAYEROK CONTROL\nВыбери раздел:', mainKeyboard()));

  bot.action('main', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText(
      '🎮 PLAYEROK CONTROL\n\n' +
      `Активный аккаунт: ${accountName()}\n` +
      'Выбери раздел:',
      mainKeyboard()
    );
  });

  bot.action('accounts', async (ctx) => {
    await ctx.answerCbQuery();
    const accounts = db.listAccounts();
    const active = activeAccount();
    const rows = accounts.map((a) => [[`${a.id === active?.id ? '🟢' : '⚪'} ${a.label}`, `account:${a.id}`]]);
    rows.push([['➕ Добавить аккаунт', 'account:add']]);
    rows.push([['ℹ️ Как подключить', 'account:help'], ['⬅️ Назад', 'main']]);
    const body = accounts.length
      ? `👤 АККАУНТЫ\n\n${accounts.map((a) => `${a.id === active?.id ? '🟢' : '⚪'} #${a.id} — ${a.label}`).join('\n')}\n\nЭто локальные метки аккаунтов, пока не авторизация Playerok.`
      : '👤 АККАУНТЫ\n\nПока аккаунтов нет. Добавь метку, чтобы подготовить структуру.';
    return ctx.editMessageText(body, keyboard(rows));
  });

  bot.action('account:add', async (ctx) => {
    await ctx.answerCbQuery();
    db.setAppSetting(`awaiting_label_${ctx.from.id}`, '1');
    return ctx.reply('Отправь короткое название аккаунта, например: Основной. Не отправляй пароль, cookie или код входа.');
  });

  bot.action('account:help', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply(
      'ℹ️ Подключение аккаунтов\n\n' +
      'Сейчас сохраняются только названия аккаунтов. Реальную интеграцию подключим отдельным этапом после проверки доступного и разрешённого способа работы с Playerok.\n' +
      'Не отправляй пароли, session cookies или коды входа в чат.'
    );
  });

  bot.action(/^account:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const id = Number(ctx.match[1]);
    const account = db.listAccounts().find((a) => a.id === id);
    if (!account) return ctx.reply('Аккаунт не найден.');
    db.setAppSetting('active_account_id', String(id));
    db.addEvent('INFO', `Active account label switched to #${id}`);
    return ctx.editMessageText(
      `👤 АККАУНТ #${id}\n\nНазвание: ${account.label}\nСтатус: метка сохранена, Playerok ещё не подключён.`,
      keyboard([
        [['⚙️ Переключатели аккаунта', `switches:${id}`]],
        [['🗑️ Удалить метку', `account:delete:${id}`]],
        [['⬅️ К аккаунтам', 'accounts'], ['🏠 Главное меню', 'main']]
      ])
    );
  });

  bot.action(/^account:delete:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const id = Number(ctx.match[1]);
    db.removeAccount(id);
    if (Number(db.getAppSetting('active_account_id', '0')) === id) {
      db.setAppSetting('active_account_id', '');
    }
    db.addEvent('INFO', `Removed account label #${id}`);
    return ctx.editMessageText('Метка аккаунта удалена.', backKeyboard('accounts'));
  });

  bot.on('text', async (ctx, next) => {
    const key = `awaiting_label_${ctx.from.id}`;
    if (db.getAppSetting(key, '0') !== '1') return next();
    db.setAppSetting(key, '0');
    const label = ctx.message.text.trim().replace(/\s+/g, ' ').slice(0, 48);
    if (!label || label.startsWith('/')) return ctx.reply('Название не подходит. Нажми «Добавить аккаунт» и введи обычное название.');
    const id = db.addAccount(label);
    db.setAppSetting('active_account_id', String(id));
    db.addEvent('INFO', `Created account label #${id}`);
    return ctx.reply(`✅ Добавлена метка аккаунта #${id}: ${label}\n\nРеальное подключение Playerok сделаем следующим этапом.`, mainKeyboard());
  });

  bot.action('global', async (ctx) => {
    await ctx.answerCbQuery();
    const enabled = db.getAppSetting('global_automation', 'false') === 'true';
    return ctx.editMessageText(
      `⚙️ ГЛОБАЛЬНЫЕ ПЕРЕКЛЮЧАТЕЛИ\n\nОбщая автоматизация: ${enabled ? 'ВКЛ' : 'ВЫКЛ'}\n\nНа этом этапе переключатель сохраняет состояние панели; реальные операции ещё не запускаются.`,
      keyboard([
        [[enabled ? '🔴 Выключить автоматизацию' : '🟢 Включить автоматизацию', 'global:toggle']],
        [['⬅️ Назад', 'main']]
      ])
    );
  });

  bot.action('global:toggle', async (ctx) => {
    await ctx.answerCbQuery();
    const enabled = db.getAppSetting('global_automation', 'false') === 'true';
    db.setAppSetting('global_automation', String(!enabled));
    db.addEvent('INFO', `Global automation switch set to ${!enabled}`);
    return ctx.editMessageText(`⚙️ Общая автоматизация: ${!enabled ? 'ВКЛ' : 'ВЫКЛ'}\n\nЭто только флаг конфигурации; live-действия не выполняются.`, keyboard([[['⬅️ Назад', 'global'], ['🏠 Меню', 'main']]]));
  });

  bot.action(/^switches:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const id = Number(ctx.match[1]);
    const account = db.listAccounts().find((a) => a.id === id);
    if (!account) return ctx.reply('Аккаунт не найден.');
    const features = [
      ['delivery', '📤 Автовыдача'],
      ['autobuy', '🛒 Автопокупка'],
      ['replies', '💬 Автоответы'],
      ['notifications', '🔔 Уведомления']
    ];
    const rows = features.map(([key, label]) => {
      const value = db.getSetting(id, key, 'false') === 'true';
      return [[`${value ? '🟢' : '⚪'} ${label}: ${value ? 'ВКЛ' : 'ВЫКЛ'}`, `switch:${id}:${key}`]];
    });
    rows.push([['⬅️ К аккаунту', `account:${id}`]]);
    return ctx.editMessageText(`⚙️ ПЕРЕКЛЮЧАТЕЛИ: ${account.label}\n\nСостояния сохраняются отдельно для каждого аккаунта. Пока это настройки, не подключённые к Playerok.`, keyboard(rows));
  });

  bot.action(/^switch:(\d+):(delivery|autobuy|replies|notifications)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, idRaw, key] = ctx.match;
    const id = Number(idRaw);
    const account = db.listAccounts().find((a) => a.id === id);
    if (!account) return ctx.reply('Аккаунт не найден.');
    const value = db.getSetting(id, key, 'false') === 'true';
    db.setSetting(id, key, String(!value));
    db.addEvent('INFO', `Account #${id} setting ${key} set to ${!value}`);
    return ctx.editMessageText(`⚙️ ${account.label}\n\nНастройка ${key}: ${!value ? 'ВКЛ' : 'ВЫКЛ'}\n\nЭто сохранённый флаг. Реальная интеграция ещё не подключена.`, keyboard([[['⬅️ К переключателям', `switches:${id}`], ['🏠 Меню', 'main']]]));
  });

  const placeholders = {
    lots: ['📦 УПРАВЛЕНИЕ ЛОТАМИ', 'Список лотов, фильтры, шаблоны и поддерживаемые операции появятся после подключения интеграции.'],
    autobuy: ['🛒 АВТОПОКУПКА', 'Будут правила поиска, максимальная цена, лимиты расходов и журнал. Пока реальные покупки не выполняются.'],
    delivery: ['📤 АВТОВЫДАЧА', 'Будут правила выдачи, остатки и контроль повторной выдачи. Пока реальные заказы не обрабатываются.'],
    chats: ['💬 ЧАТЫ И АВТООТВЕТЫ', 'Будут шаблоны и правила ответов. Сообщения Playerok пока не читаются и не отправляются.'],
    orders: ['🤝 ЗАКАЗЫ И СДЕЛКИ', 'Будут списки и статусы заказов после подключения проверенного источника данных.'],
    finance: ['💰 ФИНАНСЫ И СТАТИСТИКА', 'Отчёты появятся после подключения реальных данных. Никакие цифры не генерируются.'],
    notifications: ['🔔 УВЕДОМЛЕНИЯ', 'Здесь будут настраиваться уведомления о заказах, остатках, ошибках и статусе аккаунтов.'],
    system: ['🛠️ СИСТЕМА И НАСТРОЙКИ', 'Состояние панели, база данных и информация о подключении.'],
    more: ['▶️ ДОПОЛНИТЕЛЬНЫЕ РАЗДЕЛЫ', 'Дополнительные инструменты панели.']
  };

  for (const [id, [title, description]] of Object.entries(placeholders)) {
    bot.action(id, async (ctx) => {
      await ctx.answerCbQuery();
      const rows = [];
      if (id === 'more') {
        rows.push([['🛡️ Безопасность', 'security'], ['📜 Журнал событий', 'logs']]);
        rows.push([['💾 Резервная копия', 'backup'], ['🧩 Плагины', 'plugins']]);
      }
      rows.push([['⬅️ Назад', 'main']]);
      return ctx.editMessageText(`${title}\n\n${description}\n\nАктивная метка аккаунта: ${accountName()}`, keyboard(rows));
    });
  }

  bot.action('security', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText(`🛡️ БЕЗОПАСНОСТЬ\n\nРазрешённые Telegram ID: ${adminIds.join(', ')}\nСекреты не хранятся в сообщениях. Не добавляй чужие ID без необходимости.`, backKeyboard('more'));
  });

  bot.action('backup', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply('💾 База SQLite находится в папке DATA_DIR. Перед обновлением останови бота и скопируй файл playerok-control.sqlite. Автоматическое восстановление пока не реализовано.');
  });

  bot.action('plugins', async (ctx) => {
    await ctx.answerCbQuery();
    const plugins = pluginManager.listPlugins();
    const rows = plugins.map((plugin) => {
      const enabled = db.listPlugins().find((p) => p.plugin_id === plugin.id)?.enabled === 1;
      return [[`${enabled ? '🟢' : '⚪'} ${plugin.name}`, `plugin:${plugin.id}`]];
    });
    rows.push([['⬅️ Назад', 'main']]);
    return ctx.editMessageText('🧩 ПЛАГИНЫ\n\nВключение здесь меняет состояние модуля в настройках, но пока не запускает интеграцию с Playerok.', keyboard(rows));
  });

  bot.action(/^plugin:([a-z0-9_]+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const plugin = pluginManager.getPlugin(ctx.match[1]);
    if (!plugin) return ctx.reply('Плагин не найден.');
    const row = db.listPlugins().find((p) => p.plugin_id === plugin.id);
    const enabled = row?.enabled === 1;
    db.setPlugin(plugin.id, !enabled);
    db.addEvent('INFO', `Plugin ${plugin.id} enabled=${!enabled}`);
    return ctx.editMessageText(`${plugin.name}\n\n${plugin.description}\n\nСостояние: ${!enabled ? 'ВКЛ' : 'ВЫКЛ'}\nЭто демонстрационное состояние модуля.`, keyboard([[['⬅️ К плагинам', 'plugins'], ['🏠 Меню', 'main']]]));
  });

  bot.action('logs', async (ctx) => {
    await ctx.answerCbQuery();
    const events = db.recentEvents();
    const body = events.length
      ? events.map((event) => `${event.created_at} [${event.level}] ${event.message}`).join('\n')
      : 'Журнал пока пуст.';
    return ctx.editMessageText(`📜 ПОСЛЕДНИЕ СОБЫТИЯ\n\n${body}`.slice(0, 3900), backKeyboard('more'));
  });

  bot.catch((error, ctx) => {
    console.error('Telegram handler error:', error.message);
    try {
      db.addEvent('ERROR', `${ctx.updateType}: ${error.message}`.slice(0, 500));
    } catch (_) {}
  });

  return bot;
}

module.exports = { createBot };
