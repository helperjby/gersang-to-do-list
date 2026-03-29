(() => {
  const STORAGE_KEY = 'gersang-todo';
  const SECTIONS = ['todo', 'daily', 'weekly', 'event'];

  const DEFAULT_DUNGEONS = [
    '고수동굴', '대관령', '한라산', '월기봉', '거제해저동굴',
    '무령왕릉', '천년호', '이시즈치산', '하치만타이온천', '대설산',
    '일본해저동굴', '귀곡성', '대둔산', '대만해저동굴', '해적동굴',
    '해적동굴2층(200렙 이하)', '유명계', '륭산', '샤오링의후원', '챠우신전',
  ];

  // --- State ---
  let reorderMode = {};

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
    if (!data.dungeon) {
      data.dungeon = getDefaultDungeons();
    }
    return data;
  }

  function getDefaultDungeons() {
    return DEFAULT_DUNGEONS.map(name => ({ name, done: false, hidden: false }));
  }

  function getDefaultData() {
    return {
      todo: [],
      daily: [],
      weekly: [],
      event: [],
      dungeon: getDefaultDungeons(),
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

    const latestDaily = getLatestDaily06(now);
    const lastDaily = data.lastDailyReset ? new Date(data.lastDailyReset) : null;
    if (!lastDaily || lastDaily < latestDaily) {
      data.daily.forEach(q => q.done = false);
      data.dungeon.forEach(d => d.done = false);
      data.lastDailyReset = latestDaily.toISOString();
      changed = true;
    }

    const latestWeekly = getLatestSunday06(now);
    const lastWeekly = data.lastWeeklyReset ? new Date(data.lastWeeklyReset) : null;
    if (!lastWeekly || lastWeekly < latestWeekly) {
      data.weekly.forEach(q => q.done = false);
      data.lastWeeklyReset = latestWeekly.toISOString();
      changed = true;
    }

    return changed;
  }

  // --- Progress helpers ---

  function updateProgressBar(progressWrap, doneCount, total) {
    const fill = progressWrap.querySelector('.progress-bar-fill');
    if (total > 0) {
      progressWrap.style.display = 'block';
      const pct = (doneCount / total) * 100;
      fill.style.width = `${pct}%`;
      fill.classList.toggle('complete', doneCount === total && total > 0);
    } else {
      progressWrap.style.display = 'none';
      fill.style.width = '0';
      fill.classList.remove('complete');
    }
  }

  function updateOverallProgress(data) {
    let totalAll = 0;
    let doneAll = 0;

    SECTIONS.forEach(section => {
      totalAll += data[section].length;
      doneAll += data[section].filter(q => q.done).length;
    });

    const visible = data.dungeon.filter(d => !d.hidden);
    totalAll += visible.length;
    doneAll += visible.filter(d => d.done).length;

    const progressBar = document.getElementById('overallProgress');
    const label = document.getElementById('overallLabel');
    const fill = progressBar.querySelector('.overall-progress-fill');

    if (totalAll > 0) {
      const pct = Math.round((doneAll / totalAll) * 100);
      fill.style.width = `${pct}%`;
      label.textContent = `${pct}%`;
      const isComplete = doneAll === totalAll;
      fill.classList.toggle('complete', isComplete);
      label.classList.toggle('complete', isComplete);
    } else {
      fill.style.width = '0';
      label.textContent = '';
      fill.classList.remove('complete');
      label.classList.remove('complete');
    }
  }

  // --- Rendering ---

  function render(data) {
    SECTIONS.forEach(section => {
      const list = document.getElementById(`${section}-list`);
      list.innerHTML = '';

      const quests = data[section];
      const total = quests.length;
      const doneCount = quests.filter(q => q.done).length;

      const countEl = document.getElementById(`${section}-count`);
      countEl.textContent = total > 0 ? `${doneCount}/${total}` : '';

      const progressWrap = document.getElementById(`${section}-progress`);
      updateProgressBar(progressWrap, doneCount, total);

      if (total === 0) {
        const li = document.createElement('li');
        li.className = 'empty-msg';
        const icon = document.createElement('span');
        icon.className = 'empty-icon';
        icon.textContent = '📭';
        li.appendChild(icon);
        li.appendChild(document.createTextNode(section === 'todo' ? '할 일이 없습니다' : '퀘스트가 없습니다'));
        list.appendChild(li);
        return;
      }

      const isReordering = reorderMode[section];

      quests.forEach((quest, idx) => {
        const li = document.createElement('li');
        li.className = 'quest-item' + (quest.done ? ' done' : '');
        li.dataset.index = idx;
        li.dataset.section = section;

        if (isReordering) {
          li.classList.add('reorder-mode');
          const handle = document.createElement('span');
          handle.className = 'drag-handle';
          handle.textContent = '☰';
          li.appendChild(handle);

          handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startDrag(li, section, idx, e.clientY);
          });
        }

        const cb = document.createElement('div');
        cb.className = 'custom-checkbox' + (quest.done ? ' checked' : '');
        cb.addEventListener('click', () => {
          quest.done = !quest.done;
          saveData(data);
          render(data);
        });

        const name = document.createElement('span');
        name.className = 'quest-name';
        name.textContent = quest.name;

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

    renderDungeon(data);
    updateResetInfo(data);
    updateOverallProgress(data);
  }

  // --- Dungeon Rendering ---

  function renderDungeon(data) {
    const list = document.getElementById('dungeon-list');
    list.innerHTML = '';

    const visible = data.dungeon.filter(d => !d.hidden);
    const total = visible.length;
    const doneCount = visible.filter(d => d.done).length;

    const countEl = document.getElementById('dungeon-count');
    countEl.textContent = total > 0 ? `${doneCount}/${total}` : '';

    const progressWrap = document.getElementById('dungeon-progress');
    updateProgressBar(progressWrap, doneCount, total);

    if (total === 0) {
      const li = document.createElement('li');
      li.className = 'empty-msg';
      const icon = document.createElement('span');
      icon.className = 'empty-icon';
      icon.textContent = '📭';
      li.appendChild(icon);
      li.appendChild(document.createTextNode('모든 던전이 제거되었습니다'));
      list.appendChild(li);
      return;
    }

    visible.forEach(dungeon => {
      const li = document.createElement('li');
      li.className = 'quest-item' + (dungeon.done ? ' done' : '');

      const cb = document.createElement('div');
      cb.className = 'custom-checkbox' + (dungeon.done ? ' checked' : '');
      cb.addEventListener('click', () => {
        dungeon.done = !dungeon.done;
        saveData(data);
        renderDungeon(data);
        updateOverallProgress(data);
      });

      const name = document.createElement('span');
      name.className = 'quest-name';
      name.textContent = dungeon.name;

      const del = document.createElement('button');
      del.className = 'btn-delete';
      del.textContent = '✕';
      del.title = '제거';
      del.addEventListener('click', () => {
        dungeon.hidden = true;
        dungeon.done = false;
        saveData(data);
        renderDungeon(data);
        updateOverallProgress(data);
      });

      li.append(cb, name, del);
      list.appendChild(li);
    });
  }

  // --- Drag and Drop (mouse events) ---

  let dragState = { active: false, section: null, fromIndex: null, el: null };

  function startDrag(li, section, index, startY) {
    dragState = { active: true, section, fromIndex: index, el: li };
    li.classList.add('dragging');
    document.body.style.userSelect = 'none';

    function onMouseMove(e) {
      if (!dragState.active) return;
      const list = li.closest('.quest-list');
      const items = [...list.querySelectorAll('.quest-item')];
      items.forEach(item => item.classList.remove('drag-over'));

      for (const item of items) {
        if (item === dragState.el) continue;
        const rect = item.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          item.classList.add('drag-over');
          break;
        }
      }
    }

    function onMouseUp(e) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';

      if (!dragState.active) return;

      const list = li.closest('.quest-list');
      const items = [...list.querySelectorAll('.quest-item')];
      const target = items.find(item => item.classList.contains('drag-over'));

      items.forEach(item => item.classList.remove('drag-over'));
      dragState.el.classList.remove('dragging');

      if (target) {
        const toIndex = parseInt(target.dataset.index);
        if (toIndex !== dragState.fromIndex) {
          const arr = data[dragState.section];
          const [moved] = arr.splice(dragState.fromIndex, 1);
          arr.splice(toIndex, 0, moved);
          saveData(data);
          render(data);
        }
      }

      dragState = { active: false, section: null, fromIndex: null, el: null };
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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

    document.querySelectorAll('.btn-reorder').forEach(btn => {
      const section = btn.dataset.section;
      btn.addEventListener('click', () => {
        reorderMode[section] = !reorderMode[section];
        btn.classList.toggle('active', reorderMode[section]);
        render(data);
      });
    });

    // Dungeon reset
    document.getElementById('dungeonReset').addEventListener('click', () => {
      data.dungeon = getDefaultDungeons();
      saveData(data);
      renderDungeon(data);
      updateOverallProgress(data);
    });
  }

  // --- Init ---

  let data;

  function init() {
    data = loadData();
    if (checkAndReset(data)) {
      saveData(data);
    }
    render(data);
    bindEvents(data);
  }

  init();
})();
