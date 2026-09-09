(() => {
  'use strict';

  const STORAGE_KEY = 'job-calendar-events-v1';

  const EVENT_TYPES = [
    { key: 'entry', label: 'エントリー締切', color: 'var(--type-entry)' },
    { key: 'briefing', label: '説明会・セミナー', color: 'var(--type-briefing)' },
    { key: 'test', label: 'Webテスト・適性検査', color: 'var(--type-test)' },
    { key: 'es', label: 'ES提出締切', color: 'var(--type-es)' },
    { key: 'interview1', label: '一次面接', color: 'var(--type-interview1)' },
    { key: 'interview2', label: '二次面接', color: 'var(--type-interview2)' },
    { key: 'interview_final', label: '最終面接', color: 'var(--type-interview-final)' },
    { key: 'offer', label: '内定関連', color: 'var(--type-offer)' },
    { key: 'other', label: 'その他', color: 'var(--type-other)' },
  ];

  const typeMap = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t]));

  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  /** @type {{id:string,date:string,time:string,company:string,type:string,memo:string}[]} */
  let events = loadEvents();
  let viewYear, viewMonth; // 0-indexed month
  let selectedDate = null; // 'YYYY-MM-DD' for day modal

  const $ = (sel) => document.querySelector(sel);
  const monthLabel = $('#month-label');
  const weekdayRow = $('#weekday-row');
  const calendarGrid = $('#calendar-grid');
  const upcomingList = $('#upcoming-list');
  const upcomingEmpty = $('#upcoming-empty');

  function loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('予定の読み込みに失敗しました', e);
      return [];
    }
  }

  function saveEvents() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.error('予定の保存に失敗しました', e);
      showToast('保存に失敗しました（容量不足の可能性があります）');
    }
  }

  function todayStr() {
    return formatDate(new Date());
  }

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function genId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---------- カレンダー描画 ----------

  function initWeekdayRow() {
    weekdayRow.innerHTML = '';
    WEEKDAYS.forEach((w, i) => {
      const span = document.createElement('span');
      span.textContent = w;
      if (i === 0) span.className = 'sun';
      if (i === 6) span.className = 'sat';
      weekdayRow.appendChild(span);
    });
  }

  function renderCalendar() {
    monthLabel.textContent = `${viewYear}年${viewMonth + 1}月`;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(viewYear, viewMonth, 1);
    const startOffset = firstDay.getDay(); // 0=日
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];

    for (let i = 0; i < startOffset; i++) {
      const day = daysInPrevMonth - startOffset + i + 1;
      const d = new Date(viewYear, viewMonth - 1, day);
      cells.push({ date: d, otherMonth: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(viewYear, viewMonth, day), otherMonth: false });
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const nextIndex = cells.length - startOffset - daysInMonth + 1;
      cells.push({ date: new Date(viewYear, viewMonth + 1, nextIndex), otherMonth: true });
    }

    const today = todayStr();
    const byDate = groupByDate(events);

    cells.forEach(({ date, otherMonth }) => {
      const dateStr = formatDate(date);
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      if (otherMonth) cell.classList.add('other-month');
      if (dateStr === today) cell.classList.add('is-today');
      const dow = date.getDay();
      if (dow === 0) cell.classList.add('sun');
      if (dow === 6) cell.classList.add('sat');

      const num = document.createElement('div');
      num.className = 'day-num';
      num.textContent = date.getDate();
      cell.appendChild(num);

      const dayEvents = byDate[dateStr] || [];
      if (dayEvents.length > 0) {
        const dots = document.createElement('div');
        dots.className = 'day-dots';
        dayEvents.slice(0, 4).forEach((ev) => {
          const dot = document.createElement('span');
          dot.className = 'dot';
          dot.style.background = typeMap[ev.type]?.color || 'var(--type-other)';
          dots.appendChild(dot);
        });
        cell.appendChild(dots);
      }

      cell.addEventListener('click', () => openDayModal(dateStr));
      calendarGrid.appendChild(cell);
    });
  }

  function groupByDate(list) {
    const map = {};
    list.forEach((ev) => {
      (map[ev.date] ||= []).push(ev);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')));
    return map;
  }

  function renderUpcoming() {
    const today = todayStr();
    const upcoming = events
      .filter((ev) => ev.date >= today)
      .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))
      .slice(0, 8);

    upcomingList.innerHTML = '';
    upcomingEmpty.hidden = upcoming.length > 0;

    upcoming.forEach((ev) => {
      const li = document.createElement('li');
      li.className = 'upcoming-item';

      const chip = document.createElement('span');
      chip.className = 'type-chip';
      chip.style.background = typeMap[ev.type]?.color || 'var(--type-other)';

      const info = document.createElement('div');
      info.className = 'upcoming-info';
      const company = document.createElement('div');
      company.className = 'company';
      company.textContent = ev.company || '(企業名未設定)';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${formatDateLabel(ev.date)}${ev.time ? ' ' + ev.time : ''} ・ ${typeMap[ev.type]?.label || 'その他'}`;
      info.appendChild(company);
      info.appendChild(meta);

      li.appendChild(chip);
      li.appendChild(info);
      li.addEventListener('click', () => openEventModal(ev));
      upcomingList.appendChild(li);
    });
  }

  function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${m}/${d}(${WEEKDAYS[date.getDay()]})`;
  }

  function refreshAll() {
    renderCalendar();
    renderUpcoming();
    saveEvents();
  }

  // ---------- 日別モーダル ----------

  const dayModal = $('#day-modal');
  const dayModalTitle = $('#day-modal-title');
  const dayEventList = $('#day-event-list');
  const dayEmptyMsg = $('#day-empty-msg');

  function openDayModal(dateStr) {
    selectedDate = dateStr;
    dayModalTitle.textContent = formatDateLabel(dateStr) + 'の予定';
    const dayEvents = (groupByDate(events)[dateStr]) || [];

    dayEventList.innerHTML = '';
    dayEmptyMsg.hidden = dayEvents.length > 0;

    dayEvents.forEach((ev) => {
      const li = document.createElement('li');
      li.className = 'day-event-item';
      const chip = document.createElement('span');
      chip.className = 'type-chip';
      chip.style.background = typeMap[ev.type]?.color || 'var(--type-other)';
      const info = document.createElement('div');
      info.className = 'upcoming-info';
      const company = document.createElement('div');
      company.className = 'company';
      company.textContent = ev.company || '(企業名未設定)';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${ev.time ? ev.time + ' ・ ' : ''}${typeMap[ev.type]?.label || 'その他'}`;
      info.appendChild(company);
      info.appendChild(meta);
      li.appendChild(chip);
      li.appendChild(info);
      li.addEventListener('click', () => openEventModal(ev));
      dayEventList.appendChild(li);
    });

    showModal(dayModal);
  }

  // ---------- 予定 追加/編集モーダル ----------

  const eventModal = $('#event-modal');
  const eventModalTitle = $('#event-modal-title');
  const eventForm = $('#event-form');
  const inputId = $('#input-id');
  const inputCompany = $('#input-company');
  const inputType = $('#input-type');
  const inputDate = $('#input-date');
  const inputTime = $('#input-time');
  const inputMemo = $('#input-memo');
  const btnDeleteEvent = $('#btn-delete-event');

  function initTypeSelect() {
    inputType.innerHTML = '';
    EVENT_TYPES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = t.label;
      inputType.appendChild(opt);
    });
  }

  function openEventModal(ev) {
    if (ev) {
      eventModalTitle.textContent = '予定を編集';
      inputId.value = ev.id;
      inputCompany.value = ev.company || '';
      inputType.value = ev.type || 'other';
      inputDate.value = ev.date;
      inputTime.value = ev.time || '';
      inputMemo.value = ev.memo || '';
      btnDeleteEvent.hidden = false;
    } else {
      eventModalTitle.textContent = '予定を追加';
      inputId.value = '';
      inputCompany.value = '';
      inputType.value = 'entry';
      inputDate.value = selectedDate || todayStr();
      inputTime.value = '';
      inputMemo.value = '';
      btnDeleteEvent.hidden = true;
    }
    hideModal(dayModal);
    showModal(eventModal, inputCompany);
  }

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = inputId.value || genId();
    const data = {
      id,
      company: inputCompany.value.trim(),
      type: inputType.value,
      date: inputDate.value,
      time: inputTime.value,
      memo: inputMemo.value.trim(),
    };
    if (!data.date) return;

    const idx = events.findIndex((ev) => ev.id === id);
    if (idx >= 0) {
      events[idx] = data;
    } else {
      events.push(data);
    }
    hideModal(eventModal);
    refreshAll();
    showToast('保存しました');
  });

  btnDeleteEvent.addEventListener('click', () => {
    const id = inputId.value;
    if (!id) return;
    if (!confirm('この予定を削除しますか？この操作は取り消せません。')) return;
    events = events.filter((ev) => ev.id !== id);
    hideModal(eventModal);
    refreshAll();
    showToast('削除しました');
  });

  $('#btn-add-in-day').addEventListener('click', () => openEventModal(null));
  $('#btn-add').addEventListener('click', () => {
    selectedDate = todayStr();
    openEventModal(null);
  });

  // ---------- モーダル共通処理 ----------

  function showModal(modal, focusEl) {
    modal.hidden = false;
    if (focusEl) setTimeout(() => focusEl.focus(), 50);
  }
  function hideModal(modal) {
    modal.hidden = true;
  }

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      hideModal(document.getElementById(btn.dataset.close));
    });
  });
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideModal(overlay);
    });
  });

  // ---------- 月送り ----------

  $('#btn-prev-month').addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderCalendar();
  });
  $('#btn-next-month').addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderCalendar();
  });
  $('#btn-today').addEventListener('click', () => {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    renderCalendar();
  });

  // ---------- メニュー（エクスポート・インポート・インストール） ----------

  const menuModal = $('#menu-modal');
  $('#btn-menu').addEventListener('click', () => showModal(menuModal));

  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    a.href = url;
    a.download = `job-calendar-backup-${formatDate(now)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('バックアップを書き出しました');
  });

  $('#input-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error('invalid format');
        const valid = parsed.filter((ev) => ev && ev.date && ev.company !== undefined);
        if (valid.length === 0) throw new Error('no valid events');
        if (!confirm(`${valid.length}件の予定を読み込みます。現在のデータに追加されます。よろしいですか？`)) return;
        valid.forEach((ev) => {
          events.push({
            id: ev.id || genId(),
            company: ev.company || '',
            type: typeMap[ev.type] ? ev.type : 'other',
            date: ev.date,
            time: ev.time || '',
            memo: ev.memo || '',
          });
        });
        refreshAll();
        hideModal(menuModal);
        showToast(`${valid.length}件読み込みました`);
      } catch (err) {
        console.error(err);
        alert('ファイルの読み込みに失敗しました。正しいバックアップファイルか確認してください。');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  });

  // ホーム画面への追加（Android/Chrome の beforeinstallprompt）
  let deferredInstallPrompt = null;
  const btnInstall = $('#btn-install');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btnInstall.hidden = false;
  });
  btnInstall.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btnInstall.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    showToast('ホーム画面に追加しました');
  });

  // ---------- トースト ----------

  let toastTimer = null;
  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  // ---------- Service Worker 登録 ----------

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.error('Service Worker の登録に失敗しました', err);
      });
    });
  }

  // ---------- 初期化 ----------

  function init() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    initWeekdayRow();
    initTypeSelect();
    renderCalendar();
    renderUpcoming();
  }

  init();
})();
