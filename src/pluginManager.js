const plugins = [
  {
    id: 'delivery_rules',
    name: '📤 Правила автовыдачи',
    description: 'Каркас управления правилами выдачи. Пока без подключения к Playerok.'
  },
  {
    id: 'reply_templates',
    name: '💬 Заготовки ответов',
    description: 'Заготовки ответов для будущего модуля чатов.'
  },
  {
    id: 'sales_reports',
    name: '📊 Отчёты о продажах',
    description: 'Каркас отчётов; реальные данные появятся после интеграции.'
  }
];

function listPlugins() {
  return plugins;
}

function getPlugin(id) {
  return plugins.find((plugin) => plugin.id === id);
}

module.exports = { listPlugins, getPlugin };
