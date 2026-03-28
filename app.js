(() => {
  const STORAGE_KEY = 'gersang-todo';
  const SECTIONS = ['daily', 'weekly', 'dailyRepeat', 'event'];

  // --- Data ---

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* fall through */ }
    }
    return getDefaultData();
  }

  function getDefaultData() {
    return {
      daily: [],
      weekly: [],
      dailyRepeat: [],
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
    const day = d.getDay(); // 0=Sun
    if (now < d || day !== 0) {
      // Go back to last Sunday 06:00
      const diff = day === 0 && now >= d ? 0 : (day === 0 ? 7 : day);
      d.setDate(d.getDate() - diff);
    }
    return d;
  }

  function checkAndReset(data) {
    const now = new Date();
    let changed = false;

    // Daily reset (daily + dailyRepeat)
    const latestDaily = getLatestDaily06(now);
    const lastDaily = data.lastDailyReset ? new Date(data.lastDailyReset) : null;
    if (!lastDaily || lastDaily < latestDaily) {
      data.daily.forEach(q => q.done = false);
      data.dailyRepeat.forEach(q => q.done = false);
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

  // --- Rendering ---

  function render(data) {
    SECTIONS.forEach(section => {
      const list = document.getElementById(`${section}-list`);
      list.innerHTML = '';

      if (data[section].length === 0) {
        const li = document.createElement('li');
        li.className = 'empty-msg';
        li.textContent = '퀘스트가 없습니다';
        list.appendChild(li);
        return;
      }

      data[section].forEach(quest => {
        const li = document.createElement('li');
        li.className = 'quest-item' + (quest.done ? ' done' : '');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'quest-checkbox';
        cb.checked = quest.done;
        cb.addEventListener('change', () => {
          quest.done = cb.checked;
          saveData(data);
          render(data);
        });

        const name = document.createElement('span');
        name.className = 'quest-name';
        name.textContent = quest.name;

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
  }

  // --- Init ---

  function init() {
    const data = loadData();
    if (checkAndReset(data)) {
      saveData(data);
    }
    render(data);
    bindEvents(data);
  }

  init();
})();
