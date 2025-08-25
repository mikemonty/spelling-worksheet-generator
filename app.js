// Spelling Worksheet Generator (local-first, pure random)
// - Two-column print layout
// - Manual pick / Random pick / Quick add
// - History tracking
// - Import/Export JSON or CSV
// - Auto-seed from words-starter.json on first load (if present)
// - Optional Name/Date header (checkbox)
// - Selected words list is always visible
// - Random pick = pure uniform (no usage counts)

(() => {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const KEYS = {
    LIB: 'swg_library_v1',
    HIST: 'swg_history_v1',
    SETTINGS: 'swg_settings_v1'
  };

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function uid(prefix = 'id_') {
    return prefix + Math.random().toString(36).slice(2, 10);
  }
  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function csvEscape(s) {
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // Fisher-Yates shuffle
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Uniform random sample without replacement
  function randomSample(arr, n) {
    if (n >= arr.length) return shuffle([...arr]);
    const a = [...arr];
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (a.length - i));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  }

  let library  = loadJSON(KEYS.LIB, []);
  let history  = loadJSON(KEYS.HIST, []);
  let picked   = [];
  let settings = Object.assign({
    linesPerWord: 3,
    includeNameDate: false
  }, loadJSON(KEYS.SETTINGS, {}));

  const linesPerWordEl    = $('#linesPerWord');
  const includeNameDateEl = $('#includeNameDate');

  const wordListEl     = $('#wordList');
  const pickedListEl   = $('#pickedList');
  const pickedCountEl  = $('#pickedCount');
  const manualFilterEl = $('#manualFilter');
  const randomCountEl  = $('#randomCount');
  const quickAddArea   = $('#quickAddArea');

  const manualPicker = $('#manualPicker');
  const randomPicker = $('#randomPicker');
  const quickAdd     = $('#quickAdd');

  const previewEl     = $('#preview');
  const sheetHeaderEl = $('#sheetHeader');
  const wordTemplate  = $('#worksheet-word');

  if (linesPerWordEl) linesPerWordEl.value = settings.linesPerWord;
  if (includeNameDateEl) includeNameDateEl.checked = !!settings.includeNameDate;

  $$('input[name="wordSource"]').forEach(r => {
    r.addEventListener('change', () => {
      const val = getWordSource();
      manualPicker?.classList.toggle('hidden', val !== 'manual');
      randomPicker?.classList.toggle('hidden', val !== 'random');
      quickAdd?.classList.toggle('hidden', val !== 'quickadd');
    });
  });
  function getWordSource() {
    return ($$('input[name="wordSource"]').find(i => i.checked) || {}).value;
  }

  async function maybeSeedLibrary() {
    if (library && library.length > 0) return;
    try {
      const res = await fetch('words-starter.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.library)) {
        const normalized = data.library.map(w => {
          const text = typeof w === 'string' ? w : (w?.text || '');
          return text ? { id: uid('seed_'), text } : null;
        }).filter(Boolean);
        if (normalized.length) {
          library = normalized;
          saveJSON(KEYS.LIB, library);
        }
      }
    } catch {}
  }

  function renderLibrary() {
    const container = $('#libraryList');
    if (!container) return;
    container.innerHTML = '';
    const sorted = [...library].sort((a, b) => a.text.localeCompare(b.text));
    for (const w of sorted) {
      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      left.className = 'word';
      left.textContent = w.text;

      const right = document.createElement('div');
      const btnPick = document.createElement('button');
      btnPick.textContent = 'Pick';
      btnPick.addEventListener('click', () => addToPicked(w.text));

      const btnDel = document.createElement('button');
      btnDel.textContent = 'Delete';
      btnDel.addEventListener('click', () => {
        library = library.filter(x => x.id !== w.id);
        saveJSON(KEYS.LIB, library);
        renderLibrary();
        renderManualList();
      });

      right.appendChild(btnPick);
      right.appendChild(btnDel);

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    }
  }

  function renderManualList() {
    if (!wordListEl) return;
    wordListEl.innerHTML = '';
    const q = (manualFilterEl?.value || '').trim().toLowerCase();
    const list = q ? library.filter(w => w.text.toLowerCase().includes(q)) : library;
    const sorted = [...list].sort((a, b) => a.text.localeCompare(b.text));
    for (const w of sorted) {
      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      left.className = 'word';
      left.textContent = w.text;

      const right = document.createElement('div');
      const btn = document.createElement('button');
      btn.textContent = 'Add';
      btn.addEventListener('click', () => addToPicked(w.text));
      right.appendChild(btn);

      row.appendChild(left);
      row.appendChild(right);
      wordListEl.appendChild(row);
    }
  }
  manualFilterEl?.addEventListener('input', renderManualList);

  function renderPicked() {
    if (!pickedListEl) return;
    pickedListEl.innerHTML = '';
    if (pickedCountEl) pickedCountEl.textContent = String(picked.length);

    picked.forEach((w, idx) => {
      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      left.className = 'word';
      left.textContent = w;

      const right = document.createElement('div');

      const up = document.createElement('button');
      up.textContent = '↑';
      up.addEventListener('click', () => {
        if (idx > 0) {
          [picked[idx - 1], picked[idx]] = [picked[idx], picked[idx - 1]];
          renderPicked();
        }
      });

      const down = document.createElement('button');
      down.textContent = '↓';
      down.addEventListener('click', () => {
        if (idx < picked.length - 1) {
          [picked[idx + 1], picked[idx]] = [picked[idx], picked[idx + 1]];
          renderPicked();
        }
      });

      const rem = document.createElement('button');
      rem.textContent = 'Remove';
      rem.addEventListener('click', () => {
        picked.splice(idx, 1);
        renderPicked();
      });

      right.appendChild(up);
      right.appendChild(down);
      right.appendChild(rem);

      row.appendChild(left);
      row.appendChild(right);
      pickedListEl.appendChild(row);
    });
  }

  $('#btnClearPicked')?.addEventListener('click', () => {
    picked = [];
    renderPicked();
    renderPreview();
  });

  function addToPicked(word) {
    if (!picked.includes(word)) {
      picked.push(word);
      renderPicked();
    }
  }

  // Add words to library
  $('#btnAddWord')?.addEventListener('click', () => {
    const v = ($('#addWordInput')?.value || '').trim();
    if (!v) return;
    addLibraryWords([v]);
    $('#addWordInput').value = '';
  });

  $('#btnBulkAdd')?.addEventListener('click', () => {
    const raw = ($('#bulkAddArea')?.value || '');
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    addLibraryWords(lines);
    $('#bulkAddArea').value = '';
  });

  function addLibraryWords(words) {
    const existing = new Set(library.map(w => w.text.toLowerCase()));
    const newOnes = words
      .map(w => w.split(','))
      .flat()
      .map(w => w.trim())
      .filter(Boolean)
      .filter(w => !existing.has(w.toLowerCase()));

    for (const t of newOnes) {
      library.push({ id: uid('w_'), text: t });
      existing.add(t.toLowerCase());
    }
    saveJSON(KEYS.LIB, library);
    renderLibrary();
    renderManualList();
  }

  // Pure random pick
  $('#btnPickRandom')?.addEventListener('click', () => {
    const count = Math.max(1, parseInt((randomCountEl?.value || '1'), 10));
    if (!library.length) {
      alert('Library is empty. Add some words first.');
      return;
    }
    const chosen = randomSample(library, count).map(x => x.text);
    picked = chosen;
    renderPicked();
  });

  // Preview & Print
  $('#btnPreview')?.addEventListener('click', renderPreview);
  $('#btnPrint')?.addEventListener('click', () => {
    renderPreview();
    window.print();
  });

  includeNameDateEl?.addEventListener('change', () => {
    settings.includeNameDate = !!includeNameDateEl.checked;
    saveJSON(KEYS.SETTINGS, settings);
    renderPreview();
  });

  function renderPreview() {
    const lpw = Math.max(1, parseInt((linesPerWordEl?.value || '1'), 10));
    settings.linesPerWord = lpw;
    settings.includeNameDate = !!(includeNameDateEl?.checked);
    saveJSON(KEYS.SETTINGS, settings);

    if (getWordSource() === 'quickadd') {
      const raw = (quickAddArea?.value || '');
      const words = raw.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
      if (words.length) {
        addLibraryWords(words);
        picked = words;
        quickAddArea.value = '';
        renderPicked();
      }
    }

    if (sheetHeaderEl) {
      sheetHeaderEl.innerHTML = '';
      sheetHeaderEl.classList.remove('visible');
      if (settings.includeNameDate) {
        const wrapper = document.createElement('div');
        wrapper.className = 'name-date';

        const nameField = document.createElement('div');
        nameField.className = 'line-field';
        nameField.innerHTML = '<span class="line-label">Name:</span><span class="line-blank"></span>';

        const dateField = document.createElement('div');
        dateField.className = 'line-field';
        dateField.innerHTML = '<span class="line-label">Date:</span><span class="line-blank"></span>';

        wrapper.appendChild(nameField);
        wrapper.appendChild(dateField);
        sheetHeaderEl.appendChild(wrapper);
        sheetHeaderEl.classList.add('visible');
        sheetHeaderEl.setAttribute('aria-hidden', 'false');
      } else {
        sheetHeaderEl.setAttribute('aria-hidden', 'true');
      }
    }

    if (!previewEl) return;
    previewEl.innerHTML = '';
    for (const w of picked) {
      const node = wordTemplate.content.cloneNode(true);
      node.querySelector('.sample').textContent = w;
      const linesWrap = node.querySelector('.lines');
      for (let i = 0; i < settings.linesPerWord; i++) {
        const ln = document.createElement('div');
        ln.className = 'line';
        linesWrap.appendChild(ln);
      }
      previewEl.appendChild(node);
    }
  }

  // History
  $('#btnSaveWorksheet')?.addEventListener('click', () => {
    if (!picked.length) { alert('Pick some words first.'); return; }
    const map = new Map(library.map(w => [w.text.toLowerCase(), w.id]));
    const ids = picked.map(w => map.get(w.toLowerCase())).filter(Boolean);
    const sheet = {
      id: uid('s_'),
      createdAt: Date.now(),
      words: [...picked],
      wordIds: ids,
      linesPerWord: settings.linesPerWord
    };
    history.push(sheet);
    saveJSON(KEYS.HIST, history);

    renderHistory();
    renderLibrary();
    alert('Saved to history.');
  });

  function renderHistory() {
    const box = $('#historyList');
    if (!box) return;
    box.innerHTML = '';
    const sorted = [...history].sort((a, b) => b.createdAt - a.createdAt);
    for (const s of sorted) {
      const div = document.createElement('div');
      div.className = 'row';

      const when = new Date(s.createdAt).toLocaleString();
      const left = document.createElement('div');
      left.innerHTML = '<strong>' + when + '</strong><br/>' + s.words.join(', ');

      const right = document.createElement('div');

      const regen = document.createElement('button');
      regen.textContent = 'Re-generate';
      regen.addEventListener('click', () => {
        picked = [...s.words];
        if (linesPerWordEl) linesPerWordEl.value = s.linesPerWord || settings.linesPerWord;
        renderPicked();
        renderPreview();
      });

      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        history = history.filter(x => x.id !== s.id);
        saveJSON(KEYS.HIST, history);
        renderHistory();
      });

      right.appendChild(regen);
      right.appendChild(del);

      div.appendChild(left);
      div.appendChild(right);
      box.appendChild(div);
    }
  }

  // Import / Export
  $('#btnExportJSON')?.addEventListener('click', () => {
    const data = JSON.stringify({ library }, null, 2);
    downloadFile('library.json', data, 'application/json');
  });
  $('#btnExportCSV')?.addEventListener('click', () => {
    const lines = ['word'];
    for (const w of library) lines.push(csvEscape(w.text));
    downloadFile('library.csv', lines.join('\n'), 'text/csv');
  });
  $('#fileImport')?.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();

    if (f.name.endsWith('.json')) {
      try {
        const obj = JSON.parse(text);
        if (Array.isArray(obj?.library)) {
          addLibraryWords(obj.library.map(w => (typeof w === 'string' ? w : (w.text || ''))));
        } else if (Array.isArray(obj)) {
          addLibraryWords(obj.map(w => (typeof w === 'string' ? w : (w.text || ''))));
        } else {
          alert('JSON format not recognized.');
        }
        alert('Imported JSON.');
      } catch {
        alert('Invalid JSON.');
      }
    } else if (f.name.endsWith('.csv')) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!rows.length) { e.target.value = ''; return; }
      let words = [];
      const header = rows[0].toLowerCase();
      if (header.includes('word')) {
        for (let i = 1; i < rows.length; i++) {
          const firstCol = rows[i].split(',')[0];
          if (firstCol) words.push(firstCol);
        }
      } else {
        words = rows;
      }
      addLibraryWords(words);
      alert('Imported CSV.');
    } else {
      alert('Unsupported file type.');
    }

    e.target.value = '';
  });

  async function init() {
    await maybeSeedLibrary();
    renderLibrary();
    renderManualList();
    renderPicked();
    renderHistory();
    renderPreview();
  }

  init();
})();
