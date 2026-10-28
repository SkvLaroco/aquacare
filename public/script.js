// AquaCare frontend. Talks to the Express API with fetch() using relative URLs.
const API = '/api/tasks';
const AQ_API = '/api/aquariums';
const NEW_AQUARIUM = '__new__';

const state = { tasks: [], aquariums: [], filter: 'active', aquarium: 'all', search: '', editingId: null, deleting: null, lastAquarium: '' };
const $ = (id) => document.getElementById(id);

function el(tag, o = {}, kids = []) {
  const n = document.createElement(tag);
  if (o.className) n.className = o.className;
  if (o.text !== undefined) n.textContent = o.text;
  if (o.type) n.type = o.type;
  if (o.onClick) n.addEventListener('click', o.onClick);
  if (o.attrs) Object.entries(o.attrs).forEach(([k, v]) => n.setAttribute(k, v));
  kids.forEach((k) => n.appendChild(k));
  return n;
}

// ---------- Dates (status is computed here, not stored) ----------
function todayString() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const dateOnly = (v) => String(v).slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
function formatDate(s) {
  const d = new Date(s + 'T00:00:00');
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-PH', opts);
}
function getStatus(t) {
  if (t.completed) return 'completed';
  const due = dateOnly(t.dueDate), today = todayString();
  return due < today ? 'overdue' : due === today ? 'today' : 'upcoming';
}
function relative(t) {
  if (t.completed) return t.completedAt ? 'done ' + formatDate(dateOnly(t.completedAt)) : 'done';
  const n = daysBetween(todayString(), dateOnly(t.dueDate));
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? 'in ' + n + ' days' : -n + ' days ago';
}

// ---------- Messages ----------
let toastTimer = null;
function showMessage(text, kind) {
  const t = $('toast');
  t.textContent = text;
  t.className = kind === 'error' ? 'error' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'error' ? 6000 : 3500);
}
function showFormErrors(list) {
  const ul = $('formErrors');
  ul.innerHTML = '';
  list.forEach((m) => ul.appendChild(el('li', { text: m })));
  ul.hidden = list.length === 0;
}

// ---------- API ----------
async function api(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Request failed (' + res.status + ')');
    err.details = (data && data.errors) || [];
    throw err;
  }
  return data;
}
async function loadTasks() {
  try {
    state.tasks = await api(API);
    render();
  } catch (err) {
    showMessage('Could not load tasks: ' + err.message, 'error');
  }
}
async function loadAquariums() {
  try { state.aquariums = await api(AQ_API); } catch (e) { state.aquariums = []; }
  render();
}

// ---------- Aquarium names ----------
function aquariumNames() {
  const seen = {}, names = [];
  state.aquariums.map((a) => a.name).concat(state.tasks.map((t) => t.aquarium)).forEach((n) => {
    if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = true; names.push(n); }
  });
  return names.sort((a, b) => a.localeCompare(b));
}

const canon = (name) => aquariumNames().find((n) => n.toLowerCase() === String(name).toLowerCase()) || name;

// ---------- Rendering ----------
function visibleTasks() {
  const q = state.search.trim().toLowerCase();
  return state.tasks.filter((t) => {
    const s = getStatus(t);
    if (state.filter === 'active' ? s === 'completed' : s !== state.filter) return false;
    if (state.aquarium !== 'all' && canon(t.aquarium) !== state.aquarium) return false;
    return !q || (t.title + ' ' + t.aquarium + ' ' + t.type + ' ' + (t.notes || '')).toLowerCase().includes(q);
  });
}

function renderStrip() {
  const c = { overdue: 0, today: 0, upcoming: 0, completed: 0 };
  state.tasks.forEach((t) => { c[getStatus(t)] += 1; });
  $('nActive').textContent = c.overdue + c.today + c.upcoming;
  $('nOverdue').textContent = c.overdue;
  $('nToday').textContent = c.today;
  $('nUpcoming').textContent = c.upcoming;
  $('nCompleted').textContent = c.completed;
  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.filter === state.filter);
    b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter));
    b.classList.toggle('alert', b.dataset.filter === 'overdue' && c.overdue > 0);
  });
}

function renderTools() {
  const sel = $('filterAquarium');
  sel.innerHTML = '';
  sel.appendChild(el('option', { text: 'All aquariums', attrs: { value: 'all' } }));
  aquariumNames().forEach((n) => sel.appendChild(el('option', { text: n, attrs: { value: n } })));
  sel.value = aquariumNames().includes(state.aquarium) ? state.aquarium : 'all';
  state.aquarium = sel.value;
}

function buildRow(t) {
  const s = getStatus(t);
  const main = [
    el('div', { className: 'title', text: t.title }),
    el('div', { className: 'meta' }, [t.aquarium, t.type, t.frequency].map((x) => el('span', { text: x }))),
  ];
  if (t.notes) main.push(el('p', { className: 'notes', text: t.notes }));

  const actions = state.deleting === t._id
    ? [
        el('span', { className: 'confirm', text: 'Delete this task?' }),
        el('button', { type: 'button', className: 'btn btn-danger', text: 'Delete', onClick: () => removeTask(t) }),
        el('button', { type: 'button', className: 'btn btn-text', text: 'Keep', onClick: () => { state.deleting = null; renderList(); } }),
      ]
    : [
        el('button', { type: 'button', className: 'btn btn-text', text: 'Edit', attrs: { 'aria-label': 'Edit ' + t.title }, onClick: () => startEdit(t._id) }),
        el('button', { type: 'button', className: 'btn btn-text', text: 'Delete', attrs: { 'aria-label': 'Delete ' + t.title }, onClick: () => { state.deleting = t._id; renderList(); } }),
      ];

  return el('li', { className: 'task ' + s + (t.completed ? ' done' : '') }, [
    el('button', { type: 'button', className: 'check', attrs: { 'aria-label': (t.completed ? 'Mark not done: ' : 'Mark done: ') + t.title }, onClick: () => toggleComplete(t) }),
    el('div', {}, main),
    el('div', { className: 'when' }, [
      el('span', { className: 'date', text: formatDate(dateOnly(t.dueDate)) }),
      el('span', { className: 'rel', text: relative(t) }),
    ]),
    el('div', { className: 'actions' }, actions),
  ]);
}

function renderList() {
  const area = $('taskArea');
  area.innerHTML = '';
  let tasks = visibleTasks();

  if (tasks.length === 0) {
    const none = state.tasks.length === 0;
    const box = el('div', { className: 'empty' }, [
      el('p', { text: none ? 'No tasks yet. Start with the next thing your tank needs.' : 'Nothing matches these filters.' }),
    ]);
    if (none) box.appendChild(el('button', { type: 'button', className: 'btn btn-primary', text: 'Add the first task', onClick: () => openForm() }));
    area.appendChild(box);
    return;
  }

  const byDue = (a, b) => dateOnly(a.dueDate).localeCompare(dateOnly(b.dueDate));
  if (state.filter === 'completed') {
    tasks = tasks.sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt));
    const ul = el('ul', { className: 'plain' });
    tasks.forEach((t) => ul.appendChild(buildRow(t)));
    area.appendChild(ul);
    return;
  }
  const groups = state.filter === 'active' ? ['overdue', 'today', 'upcoming'] : [state.filter];
  const heads = { overdue: 'Overdue', today: 'Due today', upcoming: 'Upcoming' };
  groups.forEach((g) => {
    const items = tasks.filter((t) => getStatus(t) === g).sort(byDue);
    if (items.length === 0) return;
    if (state.filter === 'active') {
      area.appendChild(el('h3', { className: 'group-head ' + g }, [document.createTextNode(heads[g]), el('span', { className: 'count', text: String(items.length) })]));
    }
    const ul = el('ul', { className: 'plain' });
    items.forEach((t) => ul.appendChild(buildRow(t)));
    area.appendChild(ul);
  });
}

function renderSide() {
  const tanks = {};
  aquariumNames().forEach((n) => { tanks[n] = { total: 0, done: 0, active: 0, late: 0 }; });
  state.tasks.forEach((t) => {
    const x = tanks[canon(t.aquarium)], s = getStatus(t);
    x.total += 1;
    if (s === 'completed') x.done += 1; else x.active += 1;
    if (s === 'overdue') x.late += 1;
  });
  const list = $('aquariumList');
  list.innerHTML = '';
  const names = Object.keys(tanks);
  if (names.length === 0) list.appendChild(el('li', { className: 'side-empty', text: 'None yet. Add one from the New task form.' }));
  names.forEach((n) => {
    const x = tanks[n], pct = x.total ? Math.round((x.done / x.total) * 100) : 0;
    const fill = el('div', { className: 'tank-fill' });
    fill.style.width = pct + '%';
    const note = el('div', { className: 'tank-note' }, [document.createTextNode(x.total ? x.active + ' active, ' + x.done + ' done' : 'No tasks yet')]);
    if (x.late) { note.appendChild(document.createTextNode(', ')); note.appendChild(el('span', { className: 'late', text: x.late + ' overdue' })); }
    list.appendChild(el('li', {}, [
      el('button', { type: 'button', className: 'tank' + (state.aquarium === n ? ' is-active' : ''), attrs: { 'aria-pressed': String(state.aquarium === n) }, onClick: () => { state.aquarium = state.aquarium === n ? 'all' : n; render(); } }, [
        el('div', { className: 'tank-line' }, [el('span', { className: 'tank-name', text: n }), el('span', { className: 'tank-pct', text: pct + '%' })]),
        el('div', { className: 'tank-bar', attrs: { 'aria-hidden': 'true' } }, [fill]),
        note,
      ]),
    ]));
  });

  const recent = state.tasks.filter((t) => t.completed)
    .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt)).slice(0, 5);
  const rl = $('recentList');
  rl.innerHTML = '';
  rl.className = 'plain recent';
  if (recent.length === 0) rl.appendChild(el('li', { className: 'side-empty', text: 'Nothing completed yet.' }));
  recent.forEach((t) => rl.appendChild(el('li', {}, [
    el('span', { text: t.title + ' (' + t.aquarium + ')' }),
    el('span', { className: 'when-done', text: t.completedAt ? formatDate(dateOnly(t.completedAt)) : '' }),
  ])));
}

function render() {
  renderStrip();
  renderTools();
  renderList();
  renderSide();
}

// ---------- Task form (a dialog) ----------
function renderAquariumOptions(selected) {
  const sel = $('aquarium');
  sel.innerHTML = '';
  aquariumNames().forEach((n) => sel.appendChild(el('option', { text: n, attrs: { value: n } })));
  sel.appendChild(el('option', { text: '+ New aquarium...', attrs: { value: NEW_AQUARIUM } }));
  const names = aquariumNames();
  sel.value = names.includes(selected) ? selected : (names[0] || NEW_AQUARIUM);
  state.lastAquarium = sel.value === NEW_AQUARIUM ? '' : sel.value;
  syncNewAquariumRow();
}
function syncNewAquariumRow() {
  const adding = $('aquarium').value === NEW_AQUARIUM;
  $('newAquariumRow').hidden = !adding;
  if (adding) $('newAquarium').focus();
}
function syncRepeatHint() {
  $('repeatHint').hidden = !['Daily', 'Weekly', 'Monthly'].includes($('frequency').value);
}

function openForm(task) {
  state.editingId = task ? task._id : null;
  $('taskForm').reset();
  showFormErrors([]);
  $('newAquarium').value = '';
  $('dialogTitle').textContent = task ? 'Edit task' : 'New task';
  $('submitBtn').textContent = task ? 'Save changes' : 'Add task';
  $('title').value = task ? task.title : '';
  $('type').value = task ? task.type : 'Feeding';
  $('frequency').value = task ? task.frequency : 'Once';
  $('dueDate').value = task ? dateOnly(task.dueDate) : todayString();
  $('notes').value = task ? task.notes || '' : '';
  renderAquariumOptions(task ? task.aquarium : state.aquarium !== 'all' ? state.aquarium : state.lastAquarium);
  syncRepeatHint();
  $('taskDialog').showModal();
  if ($('aquarium').value === NEW_AQUARIUM) $('newAquarium').focus(); else $('title').focus();
}
function closeForm() { $('taskDialog').close(); }

async function saveNewAquarium() {
  const name = $('newAquarium').value.trim();
  if (!name) { showFormErrors(['Type a name for the new aquarium']); return; }
  const existing = aquariumNames().find((n) => n.toLowerCase() === name.toLowerCase());
  if (existing) { // already known (saved, or used by a task): just select it
    showFormErrors([]);
    renderAquariumOptions(existing);
    return;
  }
  try {
    const created = await api(AQ_API, { method: 'POST', body: JSON.stringify({ name }) });
    state.aquariums.push(created);
    showFormErrors([]);
    renderAquariumOptions(created.name);
    render();
  } catch (err) {
    if (/already exists/i.test(err.message)) {
      const match = aquariumNames().find((n) => n.toLowerCase() === name.toLowerCase());
      renderAquariumOptions(match || '');
      showFormErrors([]);
    } else {
      showFormErrors(err.details.length ? err.details : [err.message]);
    }
  }
}
function cancelNewAquarium() {
  $('newAquarium').value = '';
  renderAquariumOptions(state.lastAquarium);
  if ($('aquarium').value === NEW_AQUARIUM) closeForm(); // nothing to fall back to
}

async function handleSubmit(event) {
  event.preventDefault();
  const data = {
    title: $('title').value.trim(),
    aquarium: $('aquarium').value === NEW_AQUARIUM ? '' : $('aquarium').value,
    type: $('type').value,
    frequency: $('frequency').value,
    dueDate: $('dueDate').value,
    notes: $('notes').value.trim(),
  };
  const problems = [];
  if (!data.title) problems.push('Give the task a title');
  if (!data.aquarium) problems.push('Choose an aquarium, or save the new one first');
  if (!data.dueDate) problems.push('Pick a due date');
  if (problems.length) { showFormErrors(problems); return; }

  const editing = state.editingId;
  try {
    if (editing) await api(API + '/' + editing, { method: 'PUT', body: JSON.stringify(data) });
    else await api(API, { method: 'POST', body: JSON.stringify(data) });
    state.lastAquarium = data.aquarium;
    closeForm();
    await loadTasks();
    showMessage(editing ? 'Task updated.' : 'Task added.');
  } catch (err) {
    showFormErrors(err.details.length ? err.details : [err.message]);
  }
}

async function startEdit(id) {
  try { openForm(await api(API + '/' + id)); }
  catch (err) { showMessage('Could not open that task: ' + err.message, 'error'); }
}

// ---------- Actions ----------
async function toggleComplete(t) {
  try {
    const result = await api(API + '/' + t._id, { method: 'PUT', body: JSON.stringify({ completed: !t.completed, today: todayString() }) });
    await loadTasks();
    if (t.completed) showMessage('Marked as not done.');
    else if (result && result.nextTask) showMessage('Done. Next one is due ' + formatDate(dateOnly(result.nextTask.dueDate)) + '.');
    else showMessage('Marked as done.');
  } catch (err) { showMessage('Could not update the task: ' + err.message, 'error'); }
}
async function removeTask(t) {
  try {
    await api(API + '/' + t._id, { method: 'DELETE' });
    state.deleting = null;
    await loadTasks();
    showMessage('Task deleted.');
  } catch (err) { showMessage('Could not delete the task: ' + err.message, 'error'); }
}

// ---------- Start ----------
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.filter; state.deleting = null; render(); }));
$('search').addEventListener('input', (e) => { state.search = e.target.value; renderList(); });
$('filterAquarium').addEventListener('change', (e) => { state.aquarium = e.target.value; render(); });
$('newTaskBtn').addEventListener('click', () => openForm());
$('cancelBtn').addEventListener('click', closeForm);
$('taskForm').addEventListener('submit', handleSubmit);
$('aquarium').addEventListener('change', syncNewAquariumRow);
$('frequency').addEventListener('change', syncRepeatHint);
$('saveAquariumBtn').addEventListener('click', saveNewAquarium);
$('cancelAquariumBtn').addEventListener('click', cancelNewAquarium);
$('newAquarium').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveNewAquarium(); } });
$('taskDialog').addEventListener('click', (e) => { if (e.target === $('taskDialog')) closeForm(); });

$('todayDate').textContent = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
loadAquariums();
loadTasks();
