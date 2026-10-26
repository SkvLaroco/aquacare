// AquaCare frontend: talks to the Express API using fetch().
// Relative URLs are used on purpose, so it works locally and after deployment.
const API_URL = '/api/tasks';

const AQUARIUMS_URL = '/api/aquariums';

const state = {
  tasks: [],
  aquariums: [],
  filter: 'all',
  editingId: null,
};

const $ = (id) => document.getElementById(id);

// ---------- Small helpers ----------

// Create an element safely (text is inserted with textContent, never as HTML).
function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.type = options.type;
  if (options.onClick) node.addEventListener('click', options.onClick);
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, value));
  }
  children.forEach((child) => node.appendChild(child));
  return node;
}

// Today's date as YYYY-MM-DD in the user's local time zone.
function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + month + '-' + day;
}

// The API stores the due date as midnight UTC of the chosen day,
// so the first 10 characters are always the date the user picked.
function dateOnly(value) {
  return String(value).slice(0, 10);
}

function daysBetween(fromDate, toDate) {
  const from = Date.parse(fromDate + 'T00:00:00Z');
  const to = Date.parse(toDate + 'T00:00:00Z');
  return Math.round((to - from) / 86400000);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function pluralDays(n) {
  return n + (n === 1 ? ' day' : ' days');
}

// Status is worked out here from dueDate + completed (it is not stored in MongoDB).
function getStatus(task) {
  if (task.completed) return 'completed';
  const due = dateOnly(task.dueDate);
  const today = todayString();
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'upcoming';
}

const STATUS_LABELS = {
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  completed: 'Completed',
};

function dueText(task) {
  const due = dateOnly(task.dueDate);
  const diff = daysBetween(todayString(), due);
  if (task.completed) {
    return task.completedAt ? 'Completed on ' + formatDate(dateOnly(task.completedAt)) : 'Completed';
  }
  if (diff < 0) return 'Due ' + formatDate(due) + ' (' + pluralDays(-diff) + ' overdue)';
  if (diff === 0) return 'Due today (' + formatDate(due) + ')';
  return 'Due ' + formatDate(due) + ' (in ' + pluralDays(diff) + ')';
}

// ---------- Messages ----------

let messageTimer = null;

function showMessage(text, kind) {
  const box = $('message');
  box.textContent = text;
  box.className = kind === 'error' ? 'is-error' : 'is-success';
  box.hidden = false;
  clearTimeout(messageTimer);
  if (kind !== 'error') {
    messageTimer = setTimeout(() => { box.hidden = true; }, 3500);
  }
}

function showFormErrors(messages) {
  const list = $('formErrors');
  list.innerHTML = '';
  messages.forEach((m) => list.appendChild(el('li', { text: m })));
  list.hidden = messages.length === 0;
}

// ---------- API ----------

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    const error = new Error((data && data.message) || 'Request failed (' + response.status + ')');
    error.details = (data && data.errors) || [];
    throw error;
  }
  return data;
}

async function loadTasks() {
  try {
    state.tasks = await api(API_URL);
    render();
  } catch (err) {
    showMessage('Could not load tasks: ' + err.message, 'error');
    $('emptyState').textContent = 'Tasks could not be loaded. Check that the server and database are running, then refresh.';
    $('emptyState').hidden = false;
  }
}

// ---------- Rendering ----------

function renderDashboard() {
  const counts = { overdue: 0, today: 0, upcoming: 0, completed: 0 };
  state.tasks.forEach((t) => { counts[getStatus(t)] += 1; });

  $('statActive').textContent = counts.overdue + counts.today + counts.upcoming;
  $('statToday').textContent = counts.today;
  $('statUpcoming').textContent = counts.upcoming;
  $('statOverdue').textContent = counts.overdue;

  const recent = state.tasks
    .filter((t) => t.completed)
    .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt))
    .slice(0, 5);

  const list = $('recentList');
  list.innerHTML = '';
  if (recent.length === 0) {
    list.appendChild(el('li', { className: 'recent-empty', text: 'Nothing completed yet.' }));
    return;
  }
  recent.forEach((t) => {
    const when = t.completedAt ? formatDate(dateOnly(t.completedAt)) : '';
    list.appendChild(
      el('li', {}, [
        el('span', { text: t.title + ' (' + t.aquarium + ')' }),
        el('span', { className: 'when', text: when }),
      ])
    );
  });
}

// Every aquarium name we know about: saved aquariums plus names already used by tasks.
function allAquariumNames() {
  const seen = {};
  const names = [];
  state.aquariums.map((a) => a.name).concat(state.tasks.map((t) => t.aquarium)).forEach((name) => {
    const key = String(name).toLowerCase();
    if (name && !seen[key]) {
      seen[key] = true;
      names.push(name);
    }
  });
  return names.sort((a, b) => a.localeCompare(b));
}

// Rebuild the aquarium drop-down, keeping the current (or a requested) selection.
function renderAquariumOptions(selectName) {
  const select = $('aquarium');
  const wanted = selectName !== undefined ? selectName : select.value;
  const names = allAquariumNames();
  select.innerHTML = '';
  if (names.length === 0) {
    select.appendChild(el('option', { text: 'No aquariums yet: press + to add one', attrs: { value: '' } }));
    return;
  }
  names.forEach((name) => select.appendChild(el('option', { text: name, attrs: { value: name } })));
  if (names.includes(wanted)) select.value = wanted;
}

async function loadAquariums() {
  try {
    state.aquariums = await api(AQUARIUMS_URL);
  } catch (err) {
    state.aquariums = [];
  }
  renderAquariumOptions();
  renderAquariums();
}

function openNewAquarium() {
  $('newAquariumRow').hidden = false;
  $('newAquarium').value = '';
  $('newAquarium').focus();
}

function closeNewAquarium() {
  $('newAquariumRow').hidden = true;
  $('newAquarium').value = '';
}

async function saveNewAquarium() {
  const name = $('newAquarium').value.trim();
  if (!name) {
    showFormErrors(['Type a name for the new aquarium']);
    return;
  }
  try {
    const created = await api(AQUARIUMS_URL, { method: 'POST', body: JSON.stringify({ name }) });
    showFormErrors([]);
    state.aquariums.push(created);
    renderAquariumOptions(created.name);
    renderAquariums();
    closeNewAquarium();
    showMessage('Aquarium "' + created.name + '" added.', 'success');
  } catch (err) {
    if (/already exists/i.test(err.message)) {
      // Select the existing one instead of showing an error.
      const match = allAquariumNames().find((n) => n.toLowerCase() === name.toLowerCase());
      if (match) renderAquariumOptions(match);
      closeNewAquarium();
      showMessage('That aquarium already exists. It is selected.', 'success');
    } else {
      showFormErrors(err.details.length ? err.details : [err.message]);
    }
  }
}

// "By aquarium" summary: task counts and a completion bar for each tank.
function renderAquariums() {
  const tanks = {};
  allAquariumNames().forEach((name) => { tanks[name] = { total: 0, completed: 0, overdue: 0, active: 0 }; });
  state.tasks.forEach((t) => {
    const name = t.aquarium;
    if (!tanks[name]) tanks[name] = { total: 0, completed: 0, overdue: 0, active: 0 };
    const status = getStatus(t);
    tanks[name].total += 1;
    if (status === 'completed') tanks[name].completed += 1;
    else tanks[name].active += 1;
    if (status === 'overdue') tanks[name].overdue += 1;
  });

  const list = $('aquariumList');
  list.innerHTML = '';
  const names = Object.keys(tanks).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    list.appendChild(el('li', { text: 'Add a task to see your aquariums here.' }));
    return;
  }

  names.forEach((name) => {
    const t = tanks[name];
    const percent = t.total === 0 ? 0 : Math.round((t.completed / t.total) * 100);
    const fill = el('div', { className: 'tank-fill' });
    fill.style.width = percent + '%';
    const stats = el('p', { className: 'tank-stats' }, [
      el('span', { text: t.active + ' active, ' + t.completed + ' done' }),
    ]);
    if (t.overdue > 0) {
      stats.appendChild(document.createTextNode(', '));
      stats.appendChild(el('span', { className: 'overdue', text: t.overdue + ' overdue' }));
    }
    list.appendChild(
      el('li', {}, [
        el('div', { className: 'tank-head' }, [
          el('span', { className: 'tank-name', text: name }),
          el('span', { text: percent + '% done' }),
        ]),
        el('div', { className: 'tank-bar', attrs: { 'aria-hidden': 'true' } }, [fill]),
        stats,
      ])
    );
  });
}

function buildTaskItem(task) {
  const status = getStatus(task);

  const children = [
    el('div', { className: 'task-head' }, [
      el('h3', { className: 'task-title', text: task.title }),
      el('span', { className: 'badge badge-' + status, text: STATUS_LABELS[status] }),
    ]),
    el('p', { className: 'task-meta' }, [
      el('span', { text: 'Aquarium: ' + task.aquarium }),
      el('span', { text: 'Type: ' + task.type }),
      el('span', { text: 'Frequency: ' + task.frequency }),
    ]),
    el('p', { className: 'task-due', text: dueText(task) }),
  ];

  if (task.notes) {
    children.push(el('p', { className: 'task-notes', text: 'Notes: ' + task.notes }));
  }

  children.push(
    el('div', { className: 'task-actions' }, [
      el('button', {
        type: 'button',
        className: 'btn btn-small',
        text: task.completed ? 'Mark not done' : 'Mark done',
        onClick: () => toggleComplete(task),
      }),
      el('button', {
        type: 'button',
        className: 'btn btn-small',
        text: 'Edit',
        attrs: { 'aria-label': 'Edit ' + task.title },
        onClick: () => startEdit(task._id),
      }),
      el('button', {
        type: 'button',
        className: 'btn btn-small btn-danger',
        text: 'Delete',
        attrs: { 'aria-label': 'Delete ' + task.title },
        onClick: () => removeTask(task),
      }),
    ])
  );

  return el('li', { className: 'task status-' + status }, children);
}

function renderTasks() {
  const list = $('taskList');
  const empty = $('emptyState');
  list.innerHTML = '';

  // Active tasks first (earliest due date first), completed tasks last.
  const visible = state.tasks
    .filter((t) => state.filter === 'all' || getStatus(t) === state.filter)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return dateOnly(a.dueDate).localeCompare(dateOnly(b.dueDate));
    });

  if (visible.length === 0) {
    empty.textContent =
      state.tasks.length === 0
        ? 'No tasks yet. Add your first aquarium-care task using the form.'
        : 'No tasks match this filter.';
    empty.hidden = false;
  } else {
    empty.hidden = true;
  }

  visible.forEach((t) => list.appendChild(buildTaskItem(t)));
}

function render() {
  renderDashboard();
  renderAquariumOptions();
  renderAquariums();
  renderTasks();
}

// ---------- Form (create + edit) ----------

function resetForm() {
  state.editingId = null;
  const keepAquarium = $('aquarium').value; // keep the same tank selected between tasks
  $('taskForm').reset();
  renderAquariumOptions(keepAquarium);
  $('dueDate').value = todayString();
  $('formHeading').textContent = 'Add a task';
  $('submitBtn').textContent = 'Add task';
  $('cancelEditBtn').hidden = true;
  closeNewAquarium();
  showFormErrors([]);
}

function readForm() {
  return {
    title: $('title').value.trim(),
    aquarium: $('aquarium').value.trim(),
    type: $('type').value,
    frequency: $('frequency').value,
    dueDate: $('dueDate').value,
    notes: $('notes').value.trim(),
  };
}

function checkForm(data) {
  const problems = [];
  if (!data.title) problems.push('Title is required');
  if (!data.aquarium) problems.push('Choose an aquarium (use + to add one)');
  if (!data.dueDate) problems.push('Due date is required');
  return problems;
}

async function handleSubmit(event) {
  event.preventDefault();
  const data = readForm();

  const problems = checkForm(data);
  if (problems.length > 0) {
    showFormErrors(problems);
    return;
  }
  showFormErrors([]);

  const editing = state.editingId;
  try {
    if (editing) {
      await api(API_URL + '/' + editing, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api(API_URL, { method: 'POST', body: JSON.stringify(data) });
    }
    resetForm();
    await loadTasks();
    showMessage(editing ? 'Task updated.' : 'Task added.', 'success');
  } catch (err) {
    showFormErrors(err.details.length ? err.details : [err.message]);
  }
}

async function startEdit(id) {
  try {
    const task = await api(API_URL + '/' + id); // GET /api/tasks/:id
    state.editingId = task._id;
    $('title').value = task.title;
    renderAquariumOptions(task.aquarium);
    $('type').value = task.type;
    $('frequency').value = task.frequency;
    $('dueDate').value = dateOnly(task.dueDate);
    $('notes').value = task.notes || '';
    $('formHeading').textContent = 'Edit task';
    $('submitBtn').textContent = 'Save changes';
    $('cancelEditBtn').hidden = false;
    showFormErrors([]);
    $('formHeading').scrollIntoView({ block: 'start' });
    $('title').focus();
  } catch (err) {
    showMessage('Could not open the task for editing: ' + err.message, 'error');
  }
}

// ---------- Actions ----------

async function toggleComplete(task) {
  try {
    const result = await api(API_URL + '/' + task._id, {
      method: 'PUT',
      body: JSON.stringify({ completed: !task.completed, today: todayString() }),
    });
    await loadTasks();
    if (task.completed) {
      showMessage('Task marked as not done.', 'success');
    } else if (result && result.nextTask) {
      showMessage('Task done. Next one scheduled for ' + formatDate(dateOnly(result.nextTask.dueDate)) + '.', 'success');
    } else {
      showMessage('Task marked as done.', 'success');
    }
  } catch (err) {
    showMessage('Could not update the task: ' + err.message, 'error');
  }
}

async function removeTask(task) {
  const ok = window.confirm('Delete "' + task.title + '"? This cannot be undone.');
  if (!ok) return;
  try {
    await api(API_URL + '/' + task._id, { method: 'DELETE' });
    if (state.editingId === task._id) resetForm();
    await loadTasks();
    showMessage('Task deleted.', 'success');
  } catch (err) {
    showMessage('Could not delete the task: ' + err.message, 'error');
  }
}

// ---------- Start ----------

document.querySelectorAll('.filter').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach((b) => b.classList.toggle('is-active', b === button));
    renderTasks();
  });
});

$('taskForm').addEventListener('submit', handleSubmit);
$('cancelEditBtn').addEventListener('click', resetForm);
$('addAquariumBtn').addEventListener('click', openNewAquarium);
$('saveAquariumBtn').addEventListener('click', saveNewAquarium);
$('cancelAquariumBtn').addEventListener('click', closeNewAquarium);
$('newAquarium').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveNewAquarium();
  }
});

resetForm();
loadAquariums();
loadTasks();
