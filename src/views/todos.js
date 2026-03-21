import { getTodos, addTodo, toggleTodo, deleteTodo } from '../services/todos.js';

function formatCreatedAt(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDueMonth(ym) {
  if (!ym) return null;
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function sortTodos(todos) {
  const dated   = todos.filter(t => t.dueMonth).sort((a, b) => a.dueMonth.localeCompare(b.dueMonth));
  const undated = todos.filter(t => !t.dueMonth);
  return [...dated, ...undated];
}

export async function renderTodos(container, user) {
  container.innerHTML = `
    <div class="view todos-view">
      <header class="app-header">
        <h1>Garden To-do</h1>
      </header>
      <div class="todo-add-bar">
        <input class="todo-input" id="todo-input" type="text" placeholder="Add a task…" autocomplete="off" />
        <input class="todo-month-input" id="todo-month" type="month" placeholder="YYYY-MM" aria-label="Due month (optional)" />
        <button class="btn btn--primary todo-add-btn" id="todo-add-btn">Add</button>
      </div>
      <main class="todo-list" id="todo-list">
        <div class="loading">Loading…</div>
      </main>
    </div>
  `;

  const listEl = container.querySelector('#todo-list');
  const input = container.querySelector('#todo-input');
  const monthInput = container.querySelector('#todo-month');
  const addBtn = container.querySelector('#todo-add-btn');

  let todos = [];
  let showDone = false;

  function renderList() {
    if (todos.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No tasks yet — add one above.</div>';
      return;
    }

    const doneCount = todos.filter(t => t.done).length;
    const visible = sortTodos(todos.filter(t => showDone || !t.done));

    listEl.innerHTML = '';
    visible.forEach(todo => {
      const item = document.createElement('div');
      item.className = `todo-item${todo.done ? ' todo-item--done' : ''}`;
      const duePart = todo.dueMonth
        ? `<span class="todo-due">${formatDueMonth(todo.dueMonth)}</span>`
        : '';
      const createdPart = (todo.done && showDone && todo.createdAt)
        ? `<span class="todo-due">Added ${formatCreatedAt(todo.createdAt)}</span>`
        : '';
      item.innerHTML = `
        <button class="todo-check" aria-label="${todo.done ? 'Mark undone' : 'Mark done'}" data-id="${todo.id}" data-done="${todo.done}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
            ${todo.done
              ? '<polyline points="20 6 9 17 4 12"/>'
              : '<rect x="3" y="3" width="18" height="18" rx="3"/>'}
          </svg>
        </button>
        <div class="todo-body">
          <span class="todo-text">${escapeHtml(todo.text)}</span>
          ${duePart}
          ${createdPart}
        </div>
        <button class="todo-delete btn btn--ghost btn--icon" aria-label="Delete" data-id="${todo.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      `;
      listEl.appendChild(item);
    });

    listEl.querySelectorAll('.todo-check').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const newDone = btn.dataset.done !== 'true';
        await toggleTodo(user.uid, id, newDone);
        const todo = todos.find(t => t.id === id);
        if (todo) todo.done = newDone;
        renderList();
      });
    });

    listEl.querySelectorAll('.todo-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await deleteTodo(user.uid, id);
        todos = todos.filter(t => t.id !== id);
        renderList();
      });
    });

    if (doneCount > 0) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn btn--ghost todo-done-toggle';
      toggleBtn.textContent = showDone ? 'Hide completed' : `Show ${doneCount} completed`;
      toggleBtn.addEventListener('click', () => {
        showDone = !showDone;
        renderList();
      });
      listEl.appendChild(toggleBtn);
    }
  }

  async function handleAdd() {
    const text = input.value.trim();
    if (!text) return;
    const dueMonth = monthInput.value || null; // "YYYY-MM" or ""
    input.value = '';
    monthInput.value = '';
    addBtn.disabled = true;
    try {
      const ref = await addTodo(user.uid, text, dueMonth);
      todos.push({ id: ref.id, text, done: false, dueMonth });
      renderList();
    } finally {
      addBtn.disabled = false;
    }
  }

  addBtn.addEventListener('click', handleAdd);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAdd();
  });

  try {
    todos = await getTodos(user.uid);
    renderList();
  } catch (err) {
    listEl.innerHTML = `<div class="error">Failed to load todos: ${err.code || err.message}</div>`;
    console.error(err);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
