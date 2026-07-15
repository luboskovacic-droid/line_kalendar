const STORE_KEY = 'offline-calendar-items-v1';
const SETTINGS_KEY = 'offline-calendar-settings-v1';
const TYPES = {
  todo: 'Uloha',
  photo: 'Fotenie',
  service: 'Servis',
  repair: 'Oprava',
  trip: 'Ideme',
  car: 'Auto',
  admin: 'Doklady'
};

const CAR_PRESETS = [
  { title: 'Vymena oleja', note: 'Zapis km, filter a typ oleja.', days: 365, type: 'car' },
  { title: 'PZP / poistka', note: 'Skontrolovat platnost a zaplatit vcas.', days: 365, type: 'admin' },
  { title: 'STK a EK', note: 'Objednat termin, pripravit doklady.', days: 730, type: 'car' },
  { title: 'Kontrola svetiel', note: 'Predne, zadne, smerovky, brzdove, hmlovky.', days: 30, type: 'car' },
  { title: 'Pneumatiky', note: 'Tlak, dezen, sezonne prezutie.', days: 180, type: 'car' }
];

let items = loadItems();
let editingId = null;
let activeTab = 'upcoming';
let visibleMonth = startOfMonth(new Date());
let deferredInstallPrompt = null;

const els = {
  form: document.getElementById('taskForm'),
  title: document.getElementById('titleInput'),
  type: document.getElementById('typeInput'),
  date: document.getElementById('dateInput'),
  time: document.getElementById('timeInput'),
  note: document.getElementById('noteInput'),
  calendarTitle: document.getElementById('calendarTitle'),
  calendarGrid: document.getElementById('calendarGrid'),
  listPanel: document.getElementById('listPanel'),
  template: document.getElementById('taskTemplate'),
  notifyBtn: document.getElementById('notifyBtn'),
  installBtn: document.getElementById('installBtn'),
  seedBtn: document.getElementById('seedBtn'),
  clearFormBtn: document.getElementById('clearFormBtn'),
  prevMonth: document.getElementById('prevMonth'),
  nextMonth: document.getElementById('nextMonth'),
  todayCount: document.getElementById('todayCount'),
  soonCount: document.getElementById('soonCount'),
  overdueCount: document.getElementById('overdueCount'),
  doneCount: document.getElementById('doneCount')
};

init();

function init() {
  els.date.value = toDateInput(new Date());
  bindEvents();
  render();
  registerServiceWorker();
  runReminderCheck();
  setInterval(runReminderCheck, 60000);
}

function bindEvents() {
  els.form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(els.form);
    const reminders = data.getAll('reminders');
    const payload = {
      id: editingId || crypto.randomUUID(),
      title: els.title.value.trim(),
      type: els.type.value,
      date: els.date.value,
      time: els.time.value || '08:00',
      note: els.note.value.trim(),
      reminders,
      done: editingId ? findItem(editingId)?.done || false : false,
      notified: editingId ? findItem(editingId)?.notified || [] : [],
      createdAt: editingId ? findItem(editingId)?.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now()
    };
    if (!payload.title || !payload.date) return;
    items = editingId ? items.map(item => item.id === editingId ? payload : item) : [payload, ...items];
    editingId = null;
    saveItems();
    resetForm();
    render();
  });

  els.clearFormBtn.addEventListener('click', resetForm);
  els.seedBtn.addEventListener('click', seedExamples);
  els.prevMonth.addEventListener('click', () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  els.nextMonth.addEventListener('click', () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  els.notifyBtn.addEventListener('click', requestNotifications);
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn === tab));
      renderList();
    });
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function render() {
  renderStats();
  renderCalendar();
  renderList();
}

function renderStats() {
  const today = toDateInput(new Date());
  const soonLimit = addDays(new Date(), 7);
  const open = items.filter(item => !item.done);
  els.todayCount.textContent = open.filter(item => item.date === today).length;
  els.soonCount.textContent = open.filter(item => dateOnly(item.date) <= dateOnly(toDateInput(soonLimit)) && dateOnly(item.date) >= dateOnly(today)).length;
  els.overdueCount.textContent = open.filter(item => dateOnly(item.date) < dateOnly(today)).length;
  els.doneCount.textContent = items.filter(item => item.done).length;
}

function renderCalendar() {
  els.calendarGrid.textContent = '';
  els.calendarTitle.textContent = visibleMonth.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
  const first = startOfMonth(visibleMonth);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const todayKey = toDateInput(new Date());
  for (let index = 0; index < 42; index += 1) {
    const day = addDays(start, index);
    const key = toDateInput(day);
    const dayItems = items.filter(item => item.date === key);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day';
    if (day.getMonth() !== visibleMonth.getMonth()) button.classList.add('other');
    if (key === todayKey) button.classList.add('today');
    button.innerHTML = `<span class="day-num"><span>${day.getDate()}</span><span>${dayItems.length || ''}</span></span>`;
    const dots = document.createElement('span');
    dots.className = 'dots';
    dayItems.slice(0, 6).forEach(item => {
      const dot = document.createElement('span');
      dot.className = `dot ${item.done ? 'done' : isOverdue(item) ? 'overdue' : ''}`;
      dots.append(dot);
    });
    button.append(dots);
    button.addEventListener('click', () => {
      els.date.value = key;
      activeTab = 'upcoming';
      document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === activeTab));
      renderList(dayItems.length ? key : null);
      els.title.focus();
    });
    els.calendarGrid.append(button);
  }
}

function renderList(onlyDate = null) {
  els.listPanel.textContent = '';
  let list = [...items];
  if (onlyDate) {
    list = list.filter(item => item.date === onlyDate);
  } else if (activeTab === 'car') {
    list = list.filter(item => item.type === 'car' || item.type === 'service' || item.type === 'admin');
  } else if (activeTab === 'done') {
    list = list.filter(item => item.done);
  } else {
    list = list.filter(item => !item.done);
  }
  list.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = activeTab === 'done' ? 'Zatial nic odskrtnute.' : 'Zatial tu nic nie je.';
    els.listPanel.append(empty);
    return;
  }
  list.forEach(item => els.listPanel.append(renderTask(item)));
}

function renderTask(item) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.classList.toggle('done', item.done);
  node.classList.toggle('overdue', isOverdue(item));
  node.querySelector('h3').textContent = item.title;
  node.querySelector('.type-pill').textContent = TYPES[item.type] || item.type;
  node.querySelector('.task-meta').textContent = formatMeta(item);
  const note = node.querySelector('.task-note');
  note.textContent = item.note || '';
  note.hidden = !item.note;
  const checkbox = node.querySelector('.done-toggle');
  checkbox.checked = item.done;
  checkbox.addEventListener('change', () => {
    item.done = checkbox.checked;
    item.updatedAt = Date.now();
    saveItems();
    render();
  });
  node.querySelector('.edit-task').addEventListener('click', () => editItem(item.id));
  node.querySelector('.delete-task').addEventListener('click', () => {
    if (!confirm(`Vymazat "${item.title}"?`)) return;
    items = items.filter(entry => entry.id !== item.id);
    saveItems();
    render();
  });
  return node;
}

function formatMeta(item) {
  const date = new Date(`${item.date}T${item.time || '08:00'}`);
  const bits = [
    date.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }),
    item.time || '08:00'
  ];
  if (isOverdue(item)) bits.push('meska');
  if (item.reminders?.length) bits.push(`pripomienky: ${item.reminders.map(labelReminder).join(', ')}`);
  return bits.join(' · ');
}

function labelReminder(value) {
  return { '7d': '7 dni', '3d': '3 dni', '1d': '1 den', morning: 'rano', custom: 'cas' }[value] || value;
}

function editItem(id) {
  const item = findItem(id);
  if (!item) return;
  editingId = id;
  els.title.value = item.title;
  els.type.value = item.type;
  els.date.value = item.date;
  els.time.value = item.time;
  els.note.value = item.note || '';
  els.form.querySelectorAll('[name="reminders"]').forEach(input => {
    input.checked = item.reminders.includes(input.value);
  });
  els.title.focus();
}

function resetForm() {
  editingId = null;
  els.form.reset();
  els.date.value = toDateInput(new Date());
  els.time.value = '08:00';
  els.form.querySelectorAll('[name="reminders"]').forEach(input => {
    input.checked = ['7d', '3d', '1d', 'morning', 'custom'].includes(input.value);
  });
}

function seedExamples() {
  const base = new Date();
  const examples = [
    { title: 'Fotenie auta po umyti', type: 'photo', note: 'Exterier, interier, detail kolies.', days: 2 },
    { title: 'Zavolat servis', type: 'service', note: 'Dohodnut termin a cenu.', days: 4 },
    { title: 'Opravit policu v pivnici', type: 'repair', note: 'Skrutky, vrtacka, hmozdinky.', days: 8 },
    { title: 'Ideme na vylet', type: 'trip', note: 'Skontrolovat pocasie a tankovanie.', days: 12 },
    ...CAR_PRESETS
  ];
  const newItems = examples.map(example => ({
    id: crypto.randomUUID(),
    title: example.title,
    type: example.type,
    date: toDateInput(addDays(base, example.days)),
    time: '08:00',
    note: example.note,
    reminders: ['7d', '3d', '1d', 'morning', 'custom'],
    done: false,
    notified: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));
  items = [...newItems, ...items];
  saveItems();
  render();
}

async function requestNotifications() {
  if (!('Notification' in window)) {
    alert('Tento prehliadac nepodporuje webove notifikacie.');
    return;
  }
  const permission = await Notification.requestPermission();
  saveSettings({ notifications: permission === 'granted' });
  if (permission === 'granted') {
    new Notification('Notifikacie zapnute', { body: 'Kalendar bude upozornovat pri otvorenej aplikacii a po spusteni.' });
    runReminderCheck();
  }
}

function runReminderCheck() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  let changed = false;
  items.filter(item => !item.done).forEach(item => {
    dueReminderKeys(item, now).forEach(key => {
      if (item.notified.includes(key)) return;
      new Notification(item.title, { body: formatMeta(item), tag: key, icon: 'icon.svg' });
      item.notified.push(key);
      changed = true;
    });
  });
  if (changed) saveItems();
}

function dueReminderKeys(item, now) {
  const result = [];
  const target = new Date(`${item.date}T${item.time || '08:00'}`);
  const currentDay = toDateInput(now);
  const reminderMap = {
    '7d': addDays(target, -7),
    '3d': addDays(target, -3),
    '1d': addDays(target, -1),
    morning: new Date(`${item.date}T08:00`),
    custom: target
  };
  Object.entries(reminderMap).forEach(([kind, due]) => {
    if (!item.reminders.includes(kind)) return;
    const key = `${item.id}:${kind}:${item.date}`;
    const sameDay = toDateInput(due) === currentDay;
    const afterDueTime = now.getHours() * 60 + now.getMinutes() >= due.getHours() * 60 + due.getMinutes();
    if (sameDay && afterDueTime) result.push(key);
  });
  return result;
}

function loadItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}

function saveSettings(next) {
  const current = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...next }));
}

function findItem(id) {
  return items.find(item => item.id === id);
}

function isOverdue(item) {
  return !item.done && dateOnly(item.date) < dateOnly(toDateInput(new Date()));
}

function dateOnly(value) {
  return new Date(`${value}T00:00:00`).getTime();
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
