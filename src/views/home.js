import { getEntries } from '../services/entries.js';
import { navigate } from '../router.js';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDate(entries) {
  const groups = {};
  entries.forEach(entry => {
    const key = formatDate(entry.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });
  return groups;
}

// Returns 'YYYY-MM-DD' in local time, matching the calendar grid's date keys
function localDateStr(dateVal) {
  const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Formats a 'YYYY-MM-DD' string for display in the filter bar
function formatSelectedDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function renderHome(container, user) {
  container.innerHTML = `
    <div class="view home-view">
      <header class="app-header">
        <h1>Garden Diary</h1>
        <button class="btn btn--ghost calendar-toggle" id="cal-toggle" aria-label="Browse by date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </header>
      <div class="calendar-section" id="calendar-section" hidden>
        <div class="calendar-nav">
          <button class="calendar-nav-btn" id="cal-prev">&#8249;</button>
          <span class="calendar-month-label" id="cal-month-label"></span>
          <button class="calendar-nav-btn" id="cal-next">&#8250;</button>
        </div>
        <div class="calendar-day-names">
          <span>Mo</span><span>Tu</span><span>We</span>
          <span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
        </div>
        <div class="calendar-days" id="calendar-days"></div>
      </div>
      <div class="tag-filter-bar" id="tag-filter-bar"></div>
      <div class="date-nav" id="date-nav"></div>
      <main class="entry-list" id="entry-list">
        <div class="loading">Loading entries…</div>
      </main>
    </div>
  `;

  const listEl = container.querySelector('#entry-list');
  const filterBar = container.querySelector('#tag-filter-bar');
  const dateNavEl = container.querySelector('#date-nav');
  const calSection = container.querySelector('#calendar-section');
  const calDays = container.querySelector('#calendar-days');
  const calMonthLabel = container.querySelector('#cal-month-label');

  container.querySelector('#cal-toggle').addEventListener('click', () => {
    calSection.hidden = !calSection.hidden;
  });

  let activeTag = null;
  let selectedDate = null; // 'YYYY-MM-DD' or null

  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth();

  let entries = [];
  let entryDates = new Set(); // set of 'YYYY-MM-DD' strings
  let sortedDates = [];       // entry dates sorted oldest→newest, for prev/next nav
  let renderFilterBar = () => {};
  let renderDateNav = () => {};

  function renderCalendar() {
    calMonthLabel.textContent = new Date(calYear, calMonth, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const todayStr = localDateStr(new Date());
    // Monday-first: Sunday (getDay()=0) → offset 6, Monday → 0, etc.
    const firstDayOffset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    let html = '';

    // Empty cells before the first day
    for (let i = 0; i < firstDayOffset; i++) {
      html += '<span class="calendar-day calendar-day--filler"></span>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasEntries = entryDates.has(dateStr);
      const isSelected = selectedDate === dateStr;
      const isToday = todayStr === dateStr;

      const classes = ['calendar-day',
        hasEntries   ? 'calendar-day--has-entries' : '',
        isSelected   ? 'calendar-day--selected'    : '',
        isToday      ? 'calendar-day--today'        : '',
      ].filter(Boolean).join(' ');

      html += `<button type="button" class="${classes}" data-date="${dateStr}"${!hasEntries ? ' disabled' : ''}>${day}</button>`;
    }

    calDays.innerHTML = html;

    calDays.querySelectorAll('.calendar-day:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        goToDate(selectedDate === btn.dataset.date ? null : btn.dataset.date);
      });
    });
  }

  container.querySelector('#cal-prev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });

  container.querySelector('#cal-next').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  // Navigate to a specific date: updates all filter state and keeps calendar in sync
  function goToDate(dateStr) {
    selectedDate = dateStr;
    if (dateStr) {
      const [y, m] = dateStr.split('-').map(Number);
      calYear = y;
      calMonth = m - 1;
    }
    calSection.hidden = true;
    renderCalendar();
    renderFilterBar();
    renderDateNav();
    renderList();
  }

  function renderList() {
    let filtered = entries;

    if (selectedDate) {
      filtered = filtered.filter(e => localDateStr(e.date) === selectedDate);
    }
    if (activeTag) {
      filtered = filtered.filter(e => (e.tags || []).includes(activeTag));
    }

    if (filtered.length === 0) {
      let msg;
      if (selectedDate && activeTag) msg = `No "${activeTag}" entries on this date.`;
      else if (selectedDate)         msg = 'No entries on this date.';
      else if (activeTag)            msg = `No entries tagged "${activeTag}".`;
      else                           msg = 'No entries yet.<br>Tap <strong>+</strong> to add your first garden note.';
      listEl.innerHTML = `<div class="empty-state">${msg}</div>`;
      return;
    }

    const groups = groupByDate(filtered);
    listEl.innerHTML = '';

    for (const [dateLabel, dayEntries] of Object.entries(groups)) {
      const section = document.createElement('section');
      section.className = 'date-group';
      section.innerHTML = `<h2 class="date-heading">${dateLabel}</h2>`;

      dayEntries.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'entry-card';
        const preview = entry.textNote || entry.voiceTranscript || '(no notes)';
        const photoCount = entry.photoRefs?.length || 0;
        const entryTags = entry.tags || [];
        card.innerHTML = `
          <div class="entry-card__body">
            <p class="entry-card__preview">${preview.slice(0, 120)}${preview.length > 120 ? '…' : ''}</p>
            <div class="entry-card__meta">
              ${photoCount > 0 ? `<span class="entry-card__photos">📷 ${photoCount}</span>` : ''}
              ${entryTags.map(t => `<span class="tag-chip tag-chip--small">${t}</span>`).join('')}
            </div>
          </div>
        `;
        card.addEventListener('click', () => navigate(`/entry/${entry.id}`));
        section.appendChild(card);
      });

      listEl.appendChild(section);
    }
  }

  try {
    entries = await getEntries(user.uid);
    entryDates = new Set(entries.map(e => localDateStr(e.date)));

    const allTags = [...new Set(entries.flatMap(e => e.tags || []))].sort();

    renderFilterBar = function() {
      const datePart = selectedDate ? `
        <button class="tag-filter-chip tag-filter-chip--date active" id="clear-date">
          ${formatSelectedDate(selectedDate)} ×
        </button>` : '';

      filterBar.innerHTML = datePart + allTags.map(tag => `
        <button class="tag-filter-chip${activeTag === tag ? ' active' : ''}" data-tag="${tag}">${tag}</button>
      `).join('');

      filterBar.querySelector('#clear-date')?.addEventListener('click', () => {
        goToDate(null);
      });

      filterBar.querySelectorAll('.tag-filter-chip[data-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
          activeTag = activeTag === btn.dataset.tag ? null : btn.dataset.tag;
          renderFilterBar();
          renderDateNav();
          renderList();
        });
      });
    }

    sortedDates = [...entryDates].sort(); // YYYY-MM-DD strings sort correctly lexicographically

    renderDateNav = function() {
      if (!selectedDate) {
        dateNavEl.innerHTML = '';
        return;
      }
      const idx = sortedDates.indexOf(selectedDate);
      const olderDate = idx > 0 ? sortedDates[idx - 1] : null;
      const newerDate = idx < sortedDates.length - 1 ? sortedDates[idx + 1] : null;

      dateNavEl.innerHTML = `
        <button class="date-nav-btn" id="nav-older" ${!olderDate ? 'disabled' : ''}>
          &#8592; ${olderDate ? formatSelectedDate(olderDate) : ''}
        </button>
        <button class="date-nav-btn" id="nav-newer" ${!newerDate ? 'disabled' : ''}>
          ${newerDate ? formatSelectedDate(newerDate) : ''} &#8594;
        </button>
      `;

      dateNavEl.querySelector('#nav-older')?.addEventListener('click', () => goToDate(olderDate));
      dateNavEl.querySelector('#nav-newer')?.addEventListener('click', () => goToDate(newerDate));
    };

    renderFilterBar();
    renderCalendar();
    renderDateNav();
    renderList();

  } catch (err) {
    listEl.innerHTML = `<div class="error">Failed to load entries: ${err.code || err.message}</div>`;
    console.error(err);
  }
}
