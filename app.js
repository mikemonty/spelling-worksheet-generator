// Spelling Worksheet Generator (local-first)
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Storage keys
  const KEYS = {
    LIB: 'swg_library_v1',
    HIST: 'swg_history_v1',
    SETTINGS: 'swg_settings_v1'
  };

  // State
  let library = loadJSON(KEYS.LIB, []);
  let history = loadJSON(KEYS.HIST, []);
  let picked = []; // array of words (strings)
  let settings = Object.assign({
    linesPerWord: 3,
    excludeRecent: 0
  }, loadJSON(KEYS.SETTINGS, {}));

  // Elements
  const linesPerWordEl = $('#linesPerWord');
  const excludeRecentEl = $('#excludeRecent');
  const wordListEl = $('#wordList');
  const pickedListEl = $('#pickedList');
  const pickedCountEl = $('#pickedCount');
  const manualFilterEl = $('#manualFilter');
  const randomCountEl = $('#randomCount');
  const quickAddArea = $('#quickAddArea');

  const manualPicker = $('#manualPicker');
  const randomPicker = $('#randomPicker');
  const quickAdd = $('#quickAdd');

  const previewEl = $('#preview');
  const wordTemplate = $('#worksheet-word');

  // init form values
  linesPerWordEl.value = settings.linesPerWord;
  excludeRecentEl.value = settings.excludeRecent;

  // Word source switch
  $$('input[name="wordSource"]').forEach(r => {
    r.addEventListener('change', () => {
      const val = getWordSource();
      manualPicker.classList.toggle('hidden', val !== 'manual');
      randomPicker.classList.toggle('hidden', val !== 'random');
      quickAdd.classList.toggle('hidden', val !== 'quickadd');
    });
  });

  function getWordSource(){
    return ($$('input[name="wordSource"]').find(i => i.checked) || {}).value;
  }

  // Library UI
  function renderLibrary(){
    const container = $('#libraryList');
    container.innerHTML = '';
    const sorted = [...library].sort((a,b)=> a.text.localeCompare(b.text));
    for(const w of sorted){
      const row = document.createElement('div');
      row.className = 'row';
      const left = document.createElement('div');
      left.className = 'word';
      left.textContent = w.text;
      const right = document.createElement('div');
      const btnPick = document.createElement('button');
      btnPick.textContent = 'Pick';
      btnPick.addEventListener('click', ()=> addToPicked(w.text));
      const btnDel = document.createElement('button');
      btnDel.textContent = 'Delete';
      btnDel.addEventListener('click', ()=> {
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

  // Manual list (with filter) separate so we can keep it light
  function renderManualList(){
    wordListEl.innerHTML = '';
    const q = manualFilterEl.value.trim().toLowerCase();
    const list = q ? library.filter(w => w.text.toLowerCase().includes(q)) : library;
    const sorted = [...list].sort((a,b)=> a.text.localeCompare(b.text));
    for(const w of sorted){
      const row = document.createElement('div');
      row.className = 'row';
      const left = document.createElement('div');
      left.className = 'word';
      left.textContent = w.text;
      const right = document.createElement('div');
      const btn = document.createElement('button');
      btn.textContent = 'Add';
      btn.addEventListener('click', ()=> addToPicked(w.text));
      right.appendChild(btn);
      row.appendChild(left);
      row.appendChild(right);
      wordListEl.appendChild(row);
    }
  }

  manualFilterEl.addEventListener('input', renderManualList);

  // Picked UI
  function renderPicked(){
    pickedListEl.innerHTML = '';
    pickedCountEl.textContent = String(picked.length);
    picked.forEach((w, idx) => {
      const row = document.createElement('div');
      row.className = 'row';
      const left = document.createElement('div');
      left.className = 'word';
      left.textContent = w;
      const right = document.createElement('div');
      const up = document.createElement('button');
      up.textContent = '↑';
      up.addEventListener('click', ()=> {
        if(idx>0){ [picked[idx-1], picked[idx]] = [picked[idx], picked[idx-1]]; renderPicked(); }
      });
      const down = document.createElement('button');
      down.textContent = '↓';
      down.addEventListener('click', ()=> {
        if(idx<picked.length-1){ [picked[idx+1], picked[idx]] = [picked[idx], picked[idx+1]]; renderPicked(); }
      });
      const rem = document.createElement('button');
      rem.textContent = 'Remove';
      rem.addEventListener('click', ()=> {
        picked.splice(idx,1); renderPicked();
      });
      right.appendChild(up);
      right.appendChild(down);
      right.appendChild(rem);
      row.appendChild(left);
      row.appendChild(right);
      pickedListEl.appendChild(row);
    });
  }

  function addToPicked(word){
    if(!picked.includes(word)){
      picked.push(word);
      renderPicked();
    }
  }

  // Add word(s) to library
  $('#btnAddWord').addEventListener('click', () => {
    const v = $('#addWordInput').value.trim();
    if(!v) return;
    addLibraryWords([v]);
    $('#addWordInput').value = '';
  });
  $('#btnBulkAdd').addEventListener('click', () => {
    const lines = $('#bulkAddArea').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    addLibraryWords(lines);
    $('#bulkAddArea').value = '';
  });

  function addLibraryWords(words){
    const existing = new Set(library.map(w => w.text.toLowerCase()));
    const newOnes = words
      .map(w => w.split(',')).flat()
      .map(w => w.trim())
      .filter(Boolean)
      .filter(w => !existing.has(w.toLowerCase()));
    const now = Date.now();
    for(const t of newOnes){
      library.push({ id: 'w_'+now+'_'+Math.random().toString(36).slice(2,8), text: t, usageCount: 0, lastUsedAt: 0 });
      existing.add(t.toLowerCase());
    }
    saveJSON(KEYS.LIB, library);
    renderLibrary();
    renderManualList();
  }

  // Random pick
  $('#btnPickRandom').addEventListener('click', () => {
    const count = Math.max(1, parseInt(randomCountEl.value||'1',10));
    const excludeN = Math.max(0, parseInt(excludeRecentEl.value||'0',10));
    const recentWordIds = new Set(getRecentWordIds(excludeN));
    const candidates = library.filter(w => !recentWordIds.has(w.id));
    // Bias towards least practiced
    candidates.sort((a,b)=> (a.usageCount - b.usageCount) || a.text.localeCompare(b.text));
    const chosen = pickRandomDistinct(candidates, count).map(x=>x.text);
    picked = chosen;
    renderPicked();
  });

  function pickRandomDistinct(arr, n){
    const copy = [...arr];
    const out = [];
    while(copy.length && out.length<n){
      const idx = Math.floor(Math.random()*Math.min(copy.length, 8)); // random among top 8 least-used
      out.push(copy.splice(idx,1)[0]);
    }
    return out;
  }

  function getRecentWordIds(n){
    if(n<=0) return [];
    const recentSheets = [...history].sort((a,b)=> b.createdAt - a.createdAt).slice(0,n);
    const ids = new Set();
    for(const s of recentSheets){
      for(const wid of (s.wordIds || [])) ids.add(wid);
    }
    return Array.from(ids);
  }

  // Preview
  $('#btnPreview').addEventListener('click', renderPreview);
  $('#btnPrint').addEventListener('click', () => {
    renderPreview();
    window.print();
  });

  function renderPreview(){
    // persist settings
    const lpw = Math.max(1, parseInt(linesPerWordEl.value||'1',10));
    const exr = Math.max(0, parseInt(excludeRecentEl.value||'0',10));
    settings.linesPerWord = lpw;
    settings.excludeRecent = exr;
    saveJSON(KEYS.SETTINGS, settings);

    // If quickadd selected, import those words and pick them
    if(getWordSource()==='quickadd'){
      const raw = quickAddArea.value;
      const words = raw.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
      addLibraryWords(words);
      picked = words;
      quickAddArea.value='';
    }

    // Build preview
    previewEl.innerHTML = '';
    for(const w of picked){
      const node = wordTemplate.content.cloneNode(true);
      node.querySelector('.sample').textContent = w;
      const linesWrap = node.querySelector('.lines');
      for(let i=0;i<settings.linesPerWord;i++){
        const ln = document.createElement('div');
        ln.className = 'line';
        linesWrap.appendChild(ln);
      }
      previewEl.appendChild(node);
    }
  }

  // Save worksheet to history
  $('#btnSaveWorksheet').addEventListener('click', () => {
    if(!picked.length){ alert('Pick some words first.'); return; }
    // map picked words to ids
    const map = new Map(library.map(w=>[w.text.toLowerCase(), w.id]));
    const ids = picked.map(w => map.get(w.toLowerCase())).filter(Boolean);
    const sheet = {
      id: 's_'+Date.now(),
      createdAt: Date.now(),
      words: [...picked],
      wordIds: ids,
      linesPerWord: settings.linesPerWord
    };
    history.push(sheet);
    saveJSON(KEYS.HIST, history);
    // bump usage
    const setIds = new Set(ids);
    library = library.map(w => setIds.has(w.id) ? {...w, usageCount: (w.usageCount||0)+1, lastUsedAt: Date.now()} : w);
    saveJSON(KEYS.LIB, library);
    renderHistory();
    renderLibrary();
    alert('Saved to history.');
  });

  function renderHistory(){
    const box = $('#historyList');
    box.innerHTML = '';
    const sorted = [...history].sort((a,b)=> b.createdAt - a.createdAt);
    for(const s of sorted){
      const div = document.createElement('div');
      div.className = 'row';
      const when = new Date(s.createdAt).toLocaleString();
      const left = document.createElement('div');
      left.innerHTML = '<strong>'+when+'</strong><br/>'+s.words.join(', ');
      const right = document.createElement('div');
      const regen = document.createElement('button');
      regen.textContent = 'Re-generate';
      regen.addEventListener('click', ()=>{
        picked = [...s.words];
        linesPerWordEl.value = s.linesPerWord || settings.linesPerWord;
        renderPicked();
        renderPreview();
      });
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', ()=>{
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

  // Import/Export
  $('#btnExportJSON').addEventListener('click', () => {
    const data = JSON.stringify({ library }, null, 2);
    downloadFile('library.json', data, 'application/json');
  });
  $('#btnExportCSV').addEventListener('click', () => {
    const lines = ['word'];
    for(const w of library){ lines.push(csvEscape(w.text)); }
    downloadFile('library.csv', lines.join('\n'), 'text/csv');
  });
  $('#fileImport').addEventListener('change', async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const text = await f.text();
    if(f.name.endsWith('.json')){
      try {
        const obj = JSON.parse(text);
        if(Array.isArray(obj.library)){
          addLibraryWords(obj.library.map(w => w.text || w));
        } else if(Array.isArray(obj)){
          addLibraryWords(obj.map(w => typeof w==='string'?w:(w.text||'')));
        }
        alert('Imported JSON');
      } catch(err){ alert('Invalid JSON'); }
    } else if(f.name.endsWith('.csv')){
      // Expect header 'word'
      const rows = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      const header = rows.shift();
      const col = header.toLowerCase().includes('word')?0:null;
      const words = (col===0?rows:rows).map(r => r.split(',')[0]).filter(Boolean);
      addLibraryWords(words);
      alert('Imported CSV');
    } else {
      alert('Unsupported file type');
    }
    e.target.value='';
  });

  // Helpers
  function loadJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function saveJSON(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }
  function downloadFile(name, content, type){
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function csvEscape(s){
    if(/[",\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
    return s;
  }

  // Initial render
  renderLibrary();
  renderManualList();
  renderPicked();
  renderHistory();
})();
