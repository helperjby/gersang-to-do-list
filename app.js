(() => {
  const STORAGE_KEY = 'gersang-todo';
  const SECTIONS = ['todo', 'daily', 'weekly', 'event'];

  // --- State ---
  let reorderMode = {}; // { sectionName: true/false }

  // --- Data ---

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return migrateData(parsed);
      } catch { /* fall through */ }
    }
    return getDefaultData();
  }

  function migrateData(data) {
    // Migrate dailyRepeat → todo
    if (data.dailyRepeat && !data.todo) {
      data.todo = data.dailyRepeat;
      delete data.dailyRepeat;
    }
    if (!data.todo) data.todo = [];
    if (!data.daily) data.daily = [];
    if (!data.weekly) data.weekly = [];
    if (!data.event) data.event = [];
    if (!data.lastDailyReset) data.lastDailyReset = null;
    if (!data.lastWeeklyReset) data.lastWeeklyReset = null;
    return data;
  }

  function getDefaultData() {
    return {
      todo: [],
      daily: [],
      weekly: [],
      event: [],
      lastDailyReset: null,
      lastWeeklyReset: null,
    };
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // --- Reset Logic ---

  function getLatestDaily06(now) {
    const today06 = new Date(now);
    today06.setHours(6, 0, 0, 0);
    if (now < today06) {
      today06.setDate(today06.getDate() - 1);
    }
    return today06;
  }

  function getLatestSunday06(now) {
    const d = new Date(now);
    d.setHours(6, 0, 0, 0);
    const day = d.getDay();
    if (now < d || day !== 0) {
      const diff = day === 0 && now >= d ? 0 : (day === 0 ? 7 : day);
      d.setDate(d.getDate() - diff);
    }
    return d;
  }

  function checkAndReset(data) {
    const now = new Date();
    let changed = false;

    // Daily reset (daily only — todo has no reset)
    const latestDaily = getLatestDaily06(now);
    const lastDaily = data.lastDailyReset ? new Date(data.lastDailyReset) : null;
    if (!lastDaily || lastDaily < latestDaily) {
      data.daily.forEach(q => q.done = false);
      data.lastDailyReset = latestDaily.toISOString();
      changed = true;
    }

    // Weekly reset (weekly)
    const latestWeekly = getLatestSunday06(now);
    const lastWeekly = data.lastWeeklyReset ? new Date(data.lastWeeklyReset) : null;
    if (!lastWeekly || lastWeekly < latestWeekly) {
      data.weekly.forEach(q => q.done = false);
      data.lastWeeklyReset = latestWeekly.toISOString();
      changed = true;
    }

    return changed;
  }

  // --- Sort: done items to bottom ---

  function sortDoneToBottom(arr) {
    const notDone = arr.filter(q => !q.done);
    const done = arr.filter(q => q.done);
    return [...notDone, ...done];
  }

  // --- Rendering ---

  function render(data) {
    SECTIONS.forEach(section => {
      const list = document.getElementById(`${section}-list`);
      list.innerHTML = '';

      const quests = data[section];
      const total = quests.length;
      const doneCount = quests.filter(q => q.done).length;

      // Progress
      const countEl = document.getElementById(`${section}-count`);
      const progressWrap = document.getElementById(`${section}-progress`);
      if (total > 0) {
        countEl.textContent = `${doneCount}/${total}`;
        progressWrap.style.display = 'block';
        const fill = progressWrap.querySelector('.progress-bar-fill');
        fill.style.width = `${(doneCount / total) * 100}%`;
      } else {
        countEl.textContent = '';
        progressWrap.style.display = 'none';
      }

      if (total === 0) {
        const li = document.createElement('li');
        li.className = 'empty-msg';
        li.textContent = section === 'todo' ? '할 일이 없습니다' : '퀘스트가 없습니다';
        list.appendChild(li);
        return;
      }

      const isReordering = reorderMode[section];

      quests.forEach((quest, idx) => {
        const li = document.createElement('li');
        li.className = 'quest-item' + (quest.done ? ' done' : '');
        li.dataset.index = idx;
        li.dataset.section = section;

        // Drag handle (visible only in reorder mode)
        if (isReordering) {
          li.draggable = true;
          const handle = document.createElement('span');
          handle.className = 'drag-handle';
          handle.textContent = '☰';
          li.appendChild(handle);

          li.addEventListener('dragstart', onDragStart);
          li.addEventListener('dragover', onDragOver);
          li.addEventListener('dragenter', onDragEnter);
          li.addEventListener('dragleave', onDragLeave);
          li.addEventListener('drop', onDrop);
          li.addEventListener('dragend', onDragEnd);
        }

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'quest-checkbox';
        cb.checked = quest.done;
        cb.addEventListener('change', () => {
          quest.done = cb.checked;
          data[section] = sortDoneToBottom(data[section]);
          saveData(data);
          render(data);
        });

        const name = document.createElement('span');
        name.className = 'quest-name';
        name.textContent = quest.name;

        // Inline edit on double-click
        name.addEventListener('dblclick', () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'quest-edit-input';
          input.value = quest.name;
          input.maxLength = 50;

          const commitEdit = () => {
            const newName = input.value.trim();
            if (newName && newName !== quest.name) {
              quest.name = newName;
              saveData(data);
            }
            render(data);
          };

          input.addEventListener('blur', commitEdit);
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { input.blur(); }
            if (e.key === 'Escape') {
              input.removeEventListener('blur', commitEdit);
              render(data);
            }
          });

          name.replaceWith(input);
          input.focus();
          input.select();
        });

        const del = document.createElement('button');
        del.className = 'btn-delete';
        del.textContent = '\u2212';
        del.title = '삭제';
        del.addEventListener('click', () => {
          data[section] = data[section].filter(q => q.id !== quest.id);
          saveData(data);
          render(data);
        });

        li.append(cb, name, del);
        list.appendChild(li);
      });
    });

    updateResetInfo(data);
  }

  // --- Drag and Drop ---

  let dragState = { section: null, fromIndex: null };

  function onDragStart(e) {
    const li = e.currentTarget;
    dragState.section = li.dataset.section;
    dragState.fromIndex = parseInt(li.dataset.index);
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDragEnter(e) {
    e.preventDefault();
    const li = e.currentTarget;
    if (li.dataset.section === dragState.section && !li.classList.contains('dragging')) {
      li.classList.add('drag-over');
    }
  }

  function onDragLeave(e) {
    const li = e.currentTarget;
    if (!li.contains(e.relatedTarget)) {
      li.classList.remove('drag-over');
    }
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const li = e.currentTarget;
    li.classList.remove('drag-over');

    const toSection = li.dataset.section;
    const toIndex = parseInt(li.dataset.index);

    if (toSection !== dragState.section || toIndex === dragState.fromIndex) return;

    const arr = data[dragState.section];
    const [moved] = arr.splice(dragState.fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    saveData(data);
    render(data);
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  }

  // --- Reset Info ---

  function updateResetInfo(data) {
    const el = document.getElementById('resetInfo');
    const parts = [];
    if (data.lastDailyReset) {
      parts.push('일일 리셋: ' + formatTime(data.lastDailyReset));
    }
    if (data.lastWeeklyReset) {
      parts.push('주간 리셋: ' + formatTime(data.lastWeeklyReset));
    }
    el.textContent = parts.join(' | ');
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  // --- Events ---

  function addQuest(section, data) {
    const input = document.getElementById(`${section}-input`);
    const name = input.value.trim();
    if (!name) return;

    data[section].push({ id: generateId(), name, done: false });
    data[section] = sortDoneToBottom(data[section]);
    saveData(data);
    render(data);
    input.value = '';
    input.focus();
  }

  function bindEvents(data) {
    document.querySelectorAll('.btn-add').forEach(btn => {
      const section = btn.dataset.section;
      btn.addEventListener('click', () => addQuest(section, data));
    });

    document.querySelectorAll('.add-form input').forEach(input => {
      const section = input.id.replace('-input', '');
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') addQuest(section, data);
      });
    });

    // Reorder toggle buttons
    document.querySelectorAll('.btn-reorder').forEach(btn => {
      const section = btn.dataset.section;
      btn.addEventListener('click', () => {
        reorderMode[section] = !reorderMode[section];
        btn.classList.toggle('active', reorderMode[section]);
        render(data);
      });
    });
  }

  // --- Init ---

  let data;

  function init() {
    data = loadData();
    // Sort done to bottom on load
    SECTIONS.forEach(s => {
      data[s] = sortDoneToBottom(data[s]);
    });
    if (checkAndReset(data)) {
      saveData(data);
    }
    render(data);
    bindEvents(data);
  }

  init();
})();
