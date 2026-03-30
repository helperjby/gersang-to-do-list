(() => {
  const STORAGE_KEY = 'gersang-todo';
  const SECTIONS = ['todo', 'daily', 'weekly', 'event'];

  const DEFAULT_DUNGEONS = [
    '고수동굴', '대관령', '한라산', '월기봉', '거제해저동굴',
    '무령왕릉', '천년호', '이시즈치산', '하치만타이온천', '대설산',
    '일본해저동굴', '귀곡성', '대둔산', '대만해저동굴', '해적동굴',
    '해적동굴2층(200렙 이하)', '유명계', '륭산', '샤오링의후원', '챠우신전',
  ];

  // --- Firebase ---
  // Firebase 클라이언트 API 키는 공개 식별자이며 비밀이 아닙니다. 보안은 Firebase Security Rules로 제어됩니다.
  // 아래 값을 Firebase 프로젝트 설정값으로 교체하세요.
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDKtfpk0KgupPiCLPdLfZPC42ABsBjfQo0",
    authDomain: "gersang-to-do.firebaseapp.com",
    databaseURL: "https://gersang-to-do-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gersang-to-do",
    storageBucket: "gersang-to-do.firebasestorage.app",
    appId: "1:624043848118:web:d13fef4d2426dfe1581117",
  };

  let db = null;
  const isFirebaseConfigured = FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.databaseURL !== "YOUR_DATABASE_URL";
  if (isFirebaseConfigured && typeof firebase !== 'undefined') {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
    } catch (e) {
      console.warn('Firebase 초기화 실패:', e.message);
    }
  }

  // --- State ---
  let reorderMode = {};
  let openSubAddForms = new Set(); // Track quest IDs with open sub-add forms

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

  function normalizeQuests(quests) {
    if (!Array.isArray(quests)) return [];
    return quests.map(q => ({
      ...q,
      children: q.children ? normalizeQuests(q.children) : [],
      collapsed: q.collapsed || false,
    }));
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

    // Normalize quest items to include children/collapsed
    SECTIONS.forEach(s => { data[s] = normalizeQuests(data[s]); });

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

  // --- Recursive Utility Functions ---

  function countQuests(quests) {
    let total = 0, done = 0;
    for (const q of quests) {
      total++;
      if (q.done) done++;
      if (q.children && q.children.length > 0) {
        const sub = countQuests(q.children);
        total += sub.total;
        done += sub.done;
      }
    }
    return { total, done };
  }

  function resetQuests(quests) {
    quests.forEach(q => {
      q.done = false;
      if (q.children && q.children.length > 0) resetQuests(q.children);
    });
  }

  function removeQuestById(quests, id) {
    for (let i = 0; i < quests.length; i++) {
      if (quests[i].id === id) {
        quests.splice(i, 1);
        return true;
      }
      if (quests[i].children && removeQuestById(quests[i].children, id)) {
        return true;
      }
    }
    return false;
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
      resetQuests(data.daily);
      data.dungeon.forEach(d => d.done = false);
      data.lastDailyReset = latestDaily.toISOString();
      changed = true;
    }

    const latestWeekly = getLatestSunday06(now);
    const lastWeekly = data.lastWeeklyReset ? new Date(data.lastWeeklyReset) : null;
    if (!lastWeekly || lastWeekly < latestWeekly) {
      resetQuests(data.weekly);
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
      const counts = countQuests(data[section]);
      totalAll += counts.total;
      doneAll += counts.done;
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

  function renderQuestItem(quest, section, depth, data, list) {
    const li = document.createElement('li');
    li.className = 'quest-item' + (quest.done ? ' done' : '');
    li.dataset.id = quest.id;
    li.dataset.section = section;

    const row = document.createElement('div');
    row.className = 'quest-item-row';

    const isReordering = reorderMode[section] && depth === 0;
    const hasChildren = quest.children && quest.children.length > 0;

    // Drag handle (top-level only, reorder mode)
    if (isReordering) {
      li.classList.add('reorder-mode');
      const handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.textContent = '☰';
      row.appendChild(handle);

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = [...list.children].indexOf(li);
        startDrag(li, section, idx, e.clientY);
      });
    }

    // Toggle button
    if (hasChildren) {
      const toggle = document.createElement('button');
      toggle.className = 'btn-toggle' + (quest.collapsed ? '' : ' expanded');
      toggle.textContent = '▶';
      toggle.addEventListener('click', () => {
        quest.collapsed = !quest.collapsed;
        saveData(data);
        render(data);
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'toggle-spacer';
      row.appendChild(spacer);
    }

    // Checkbox
    const cb = document.createElement('div');
    cb.className = 'custom-checkbox' + (quest.done ? ' checked' : '');
    cb.addEventListener('click', () => {
      quest.done = !quest.done;
      saveData(data);
      render(data);
    });

    // Name
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

    // Add child button
    const addChild = document.createElement('button');
    addChild.className = 'btn-add-child';
    addChild.textContent = '+';
    addChild.title = '하위 항목 추가';
    addChild.addEventListener('click', () => {
      if (!quest.children) quest.children = [];
      quest.collapsed = false;
      openSubAddForms.add(quest.id);
      saveData(data);
      render(data);
      // Focus the sub-add input after render
      setTimeout(() => {
        const thisLi = list.querySelector(`[data-id="${quest.id}"]`);
        if (thisLi) {
          const subInput = thisLi.querySelector('.sub-add-form input');
          if (subInput) subInput.focus();
        }
      }, 0);
    });

    // Delete button
    const del = document.createElement('button');
    del.className = 'btn-delete';
    del.textContent = '\u2212';
    del.title = '삭제';
    del.addEventListener('click', () => {
      const hasKids = quest.children && quest.children.length > 0;
      const msg = hasKids
        ? `"${quest.name}" 및 하위 항목 ${quest.children.length}개를 삭제하시겠습니까?`
        : `"${quest.name}"을(를) 삭제하시겠습니까?`;
      if (!confirm(msg)) return;
      removeQuestById(data[section], quest.id);
      saveData(data);
      render(data);
    });

    row.append(cb, name, addChild, del);
    li.appendChild(row);

    // Children list (if expanded or sub-add form is open)
    const showChildren = !quest.collapsed && (hasChildren || openSubAddForms.has(quest.id));
    if (showChildren) {
      const childUl = document.createElement('ul');
      childUl.className = 'quest-children';

      quest.children.forEach(child => {
        renderQuestItem(child, section, depth + 1, data, childUl);
      });

      // Sub-add form
      const addLi = document.createElement('li');
      addLi.className = 'sub-add-form';
      const subInput = document.createElement('input');
      subInput.type = 'text';
      subInput.placeholder = '하위 항목 추가...';
      subInput.maxLength = 50;

      const subBtn = document.createElement('button');
      subBtn.textContent = '+';

      const addSubQuest = () => {
        const val = subInput.value.trim();
        if (!val) return;
        quest.children.push({ id: generateId(), name: val, done: false, children: [], collapsed: false });
        saveData(data);
        render(data);
        // Re-focus the sub-add input
        setTimeout(() => {
          const thisLi = list.querySelector(`[data-id="${quest.id}"]`);
          if (thisLi) {
            const newInput = thisLi.querySelector('.sub-add-form input');
            if (newInput) newInput.focus();
          }
        }, 0);
      };

      subBtn.addEventListener('click', addSubQuest);
      subInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') addSubQuest();
      });

      addLi.append(subInput, subBtn);
      childUl.appendChild(addLi);
      li.appendChild(childUl);
    }

    list.appendChild(li);
  }

  function render(data) {
    SECTIONS.forEach(section => {
      const list = document.getElementById(`${section}-list`);
      list.innerHTML = '';

      const quests = data[section];
      const counts = countQuests(quests);

      const countEl = document.getElementById(`${section}-count`);
      countEl.textContent = counts.total > 0 ? `${counts.done}/${counts.total}` : '';

      const progressWrap = document.getElementById(`${section}-progress`);
      updateProgressBar(progressWrap, counts.done, counts.total);

      if (quests.length === 0) {
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

      quests.forEach(quest => {
        renderQuestItem(quest, section, 0, data, list);
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

      const row = document.createElement('div');
      row.className = 'quest-item-row';

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
        if (!confirm(`"${dungeon.name}"을(를) 제거하시겠습니까?`)) return;
        dungeon.hidden = true;
        dungeon.done = false;
        saveData(data);
        renderDungeon(data);
        updateOverallProgress(data);
      });

      row.append(cb, name, del);
      li.appendChild(row);
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
      const items = [...list.querySelectorAll(':scope > .quest-item')];
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
      const items = [...list.querySelectorAll(':scope > .quest-item')];
      const target = items.find(item => item.classList.contains('drag-over'));

      items.forEach(item => item.classList.remove('drag-over'));
      dragState.el.classList.remove('dragging');

      if (target) {
        const toIndex = items.indexOf(target);
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

    data[section].push({ id: generateId(), name, done: false, children: [], collapsed: false });
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

  // --- Sync ---

  function generateSyncCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 방지: 0/O, 1/I 제외
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function setSyncStatus(msg, type) {
    const el = document.getElementById('syncStatus');
    el.textContent = msg;
    el.className = 'sync-status' + (type ? ` sync-status-${type}` : '');
    if (type === 'success' || type === 'error') {
      setTimeout(() => { el.textContent = ''; el.className = 'sync-status'; }, 5000);
    }
  }

  async function uploadData() {
    if (!db) {
      setSyncStatus('Firebase가 설정되지 않았습니다.', 'error');
      return;
    }

    const uploadBtn = document.getElementById('syncUpload');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '업로드 중...';
    setSyncStatus('', '');

    try {
      const code = generateSyncCode();
      const currentData = loadData();
      // 리셋 타임스탬프와 collapsed 상태는 제외 (디바이스별 상태)
      const syncPayload = {
        data: JSON.stringify(currentData),
        timestamp: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      await Promise.race([
        db.ref(`sync/${code}`).set(syncPayload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]);

      const display = document.getElementById('syncCodeDisplay');
      const codeText = document.getElementById('syncCodeText');
      display.style.display = 'flex';
      codeText.textContent = code;
      setSyncStatus('코드가 생성되었습니다!', 'success');
    } catch (e) {
      console.error('Upload error:', e);
      setSyncStatus('업로드에 실패했습니다. 인터넷 연결을 확인해주세요.', 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = '코드 생성';
    }
  }

  async function downloadData() {
    if (!db) {
      setSyncStatus('Firebase가 설정되지 않았습니다.', 'error');
      return;
    }

    const input = document.getElementById('syncCodeInput');
    const code = input.value.trim().toUpperCase();
    if (!code) {
      setSyncStatus('동기화 코드를 입력해주세요.', 'error');
      return;
    }

    const downloadBtn = document.getElementById('syncDownload');
    downloadBtn.disabled = true;
    downloadBtn.textContent = '불러오는 중...';
    setSyncStatus('', '');

    try {
      const snapshot = await Promise.race([
        db.ref(`sync/${code}`).once('value'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]);
      const val = snapshot.val();

      if (!val) {
        setSyncStatus('유효하지 않은 코드입니다.', 'error');
        return;
      }

      if (val.expiresAt && val.expiresAt < Date.now()) {
        setSyncStatus('만료된 코드입니다. 다시 업로드해주세요.', 'error');
        return;
      }

      const remoteData = JSON.parse(val.data);
      const uploadTime = new Date(val.timestamp);
      const timeStr = `${uploadTime.getFullYear()}-${String(uploadTime.getMonth() + 1).padStart(2, '0')}-${String(uploadTime.getDate()).padStart(2, '0')} ${String(uploadTime.getHours()).padStart(2, '0')}:${String(uploadTime.getMinutes()).padStart(2, '0')}`;

      if (!confirm(`마지막 업로드: ${timeStr}\n\n현재 데이터를 덮어쓰시겠습니까?`)) {
        setSyncStatus('취소되었습니다.', '');
        return;
      }

      const migrated = migrateData(remoteData);
      saveData(migrated);
      data = migrated;
      if (checkAndReset(data)) saveData(data);
      render(data);

      input.value = '';
      setSyncStatus('데이터를 불러왔습니다!', 'success');
    } catch (e) {
      console.error('Download error:', e);
      setSyncStatus('불러오기에 실패했습니다. 인터넷 연결을 확인해주세요.', 'error');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = '불러오기';
    }
  }

  function bindSyncEvents() {
    const overlay = document.getElementById('syncOverlay');
    const btnSync = document.getElementById('btnSync');
    const btnClose = document.getElementById('syncClose');

    btnSync.addEventListener('click', () => {
      overlay.classList.add('active');
      // Reset state
      document.getElementById('syncCodeDisplay').style.display = 'none';
      document.getElementById('syncCodeInput').value = '';
      document.getElementById('syncStatus').textContent = '';
    });

    btnClose.addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });

    document.getElementById('syncUpload').addEventListener('click', uploadData);
    document.getElementById('syncDownload').addEventListener('click', downloadData);

    // Enter key on input
    document.getElementById('syncCodeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') downloadData();
    });

    // Copy code
    document.getElementById('syncCopy').addEventListener('click', () => {
      const code = document.getElementById('syncCodeText').textContent;
      navigator.clipboard.writeText(code).then(() => {
        setSyncStatus('코드가 복사되었습니다!', 'success');
      }).catch(() => {
        // Fallback: select text
        const range = document.createRange();
        range.selectNodeContents(document.getElementById('syncCodeText'));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        setSyncStatus('코드를 선택했습니다. Ctrl+C로 복사해주세요.', '');
      });
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
    bindSyncEvents();
  }

  init();
})();
