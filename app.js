/* ============================================
   Controle de Gastos — app.js  v1.0
   Dados salvos em localStorage (apenas neste
   dispositivo, nada enviado para nenhum servidor).
   ============================================ */

const STORAGE_KEY = 'controleGastos_v1';

/* ---------- definições de classificação ---------- */

const CLASS_DEFS = [
  { key:'essencial',    label:'Essencial',     color:'var(--green)' },
  { key:'reduzir',      label:'Pode reduzir',  color:'var(--amber)' },
  { key:'atencao',      label:'Atenção',       color:'var(--red)'   },
  { key:'investimento', label:'Investimento',  color:'var(--blue)'  },
];

/* ---------- catálogo de categorias ---------- */

// As 10 categorias solicitadas — ativas por padrão
const DEFAULT_CATEGORIES = [
  { id:'cartao',        type:'expense', name:'Cartão de Crédito',  icon:'💳', classification:'reduzir',
    tip:'Revise a fatura todo mês. Parcelar compras não essenciais costuma custar mais do que parece.' },
  { id:'internet',      type:'expense', name:'Internet',           icon:'🌐', classification:'essencial',
    tip:'Vale comparar planos uma vez por ano — preços mudam bastante.' },
  { id:'energia',       type:'expense', name:'Energia Elétrica',   icon:'⚡', classification:'essencial',
    tip:'Fique de olho na bandeira tarifária do mês. Bandeira vermelha pode pesar no orçamento.' },
  { id:'gas',           type:'expense', name:'Gás',                icon:'🔥', classification:'essencial',
    tip:'' },
  { id:'financiamento', type:'expense', name:'Financiamento AP',   icon:'🏠', classification:'essencial',
    tip:'Amortizar quando sobrar caixa reduz bastante o total pago em juros ao longo dos anos.' },
  { id:'seguros',       type:'expense', name:'Seguros',            icon:'🛡️', classification:'essencial',
    tip:'Cotar de tempos em tempos costuma render desconto sem reduzir cobertura.' },
  { id:'contabilidade', type:'expense', name:'Contabilidade',      icon:'🧾', classification:'essencial',
    tip:'' },
  { id:'impostos',      type:'expense', name:'Impostos e Taxas',   icon:'🏛️', classification:'essencial',
    tip:'' },
  { id:'previdencia',   type:'expense', name:'Previdência',        icon:'🌱', classification:'investimento',
    tip:'Mais que um gasto — é dinheiro trabalhando para o seu futuro.' },
  { id:'limite',        type:'expense', name:'Limite Bancário',    icon:'🏦', classification:'atencao',
    tip:'O cheque especial tem um dos juros mais altos do mercado. Priorize quitar antes de qualquer outro investimento.' },
];

// Sugestões adicionais — desativadas por padrão, o usuário escolhe o que ativar
const SUGGESTED_CATEGORIES = [
  { id:'aluguel',       type:'expense', name:'Aluguel',            icon:'🔑', classification:'essencial', tip:'' },
  { id:'condominio',    type:'expense', name:'Condomínio',         icon:'🏢', classification:'essencial', tip:'' },
  { id:'agua',          type:'expense', name:'Água/Saneamento',    icon:'💧', classification:'essencial', tip:'' },
  { id:'telefone',      type:'expense', name:'Celular/Telefone',   icon:'📱', classification:'essencial', tip:'' },
  { id:'mercado',       type:'expense', name:'Mercado',            icon:'🛒', classification:'essencial', tip:'' },
  { id:'saude',         type:'expense', name:'Plano de Saúde',     icon:'🩺', classification:'essencial', tip:'' },
  { id:'educacao',      type:'expense', name:'Educação',           icon:'🎓', classification:'essencial', tip:'' },
  { id:'iptu',          type:'expense', name:'IPTU',               icon:'🏡', classification:'essencial', tip:'' },
  { id:'ipva',          type:'expense', name:'IPVA',               icon:'🚗', classification:'essencial', tip:'' },
  { id:'combustivel',   type:'expense', name:'Combustível',        icon:'⛽', classification:'essencial', tip:'' },
  { id:'transporte',    type:'expense', name:'Transporte/Uber',    icon:'🚕', classification:'reduzir',   tip:'' },
  { id:'streaming',     type:'expense', name:'Streaming',          icon:'🎬', classification:'reduzir',
    tip:'Vale revisar quais serviços você realmente usa todo mês. Uma assinatura parada é dinheiro perdido.' },
  { id:'lazer',         type:'expense', name:'Lazer e Hobbies',    icon:'🎉', classification:'reduzir',   tip:'' },
  { id:'restaurante',   type:'expense', name:'Restaurante/Delivery',icon:'🍔',classification:'reduzir',   tip:'' },
  { id:'vestuario',     type:'expense', name:'Vestuário',          icon:'👕', classification:'reduzir',   tip:'' },
  { id:'academia',      type:'expense', name:'Academia',           icon:'🏋️', classification:'reduzir',  tip:'' },
  { id:'assinaturas',   type:'expense', name:'Assinaturas/Apps',   icon:'📲', classification:'reduzir',
    tip:'Assinaturas pequenas somam rápido. Revise a cada 3 meses.' },
  { id:'farmacia',      type:'expense', name:'Farmácia',           icon:'💊', classification:'essencial', tip:'' },
  { id:'pet',           type:'expense', name:'Pet',                icon:'🐾', classification:'essencial', tip:'' },
  { id:'manutencao',    type:'expense', name:'Manutenção/Reparos', icon:'🔧', classification:'essencial', tip:'' },
  { id:'juros',         type:'expense', name:'Juros e Multas',     icon:'⚠️', classification:'atencao',
    tip:'Atraso em contas gera juros que se acumulam rápido. Vale automatizar pagamentos.' },
  { id:'investimentos',  type:'expense', name:'Investimentos',     icon:'🐷', classification:'investimento', tip:'' },
  { id:'doacao',        type:'expense', name:'Doações',            icon:'🤝', classification:'reduzir',   tip:'' },
  { id:'outros',        type:'expense', name:'Outros',             icon:'🔖', classification:'reduzir',   tip:'' },
];

// Categorias de receita
const INCOME_CATEGORIES = [
  { id:'salario',    type:'income', name:'Salário/Pró-labore', icon:'💰' },
  { id:'extra',      type:'income', name:'Renda Extra',        icon:'💼' },
  { id:'aluguel_rec',type:'income', name:'Aluguel Recebido',   icon:'🏠' },
  { id:'dividendos', type:'income', name:'Dividendos/Rendimentos', icon:'📈' },
  { id:'reembolso',  type:'income', name:'Reembolso',          icon:'🔄' },
  { id:'outros_rec', type:'income', name:'Outros Recebimentos',icon:'💵' },
];

/* ---------- estado global ---------- */

let state = { entries: [], categories: [], viewMonth: '' };
let entryType = 'expense';
let selectedCategory = null;
let selectedClassification = null;
let keypadCents = 0;
let newCatType = 'expense';
let newCatClass = 'essencial';
let toastTimer = null;
let toastHideTimer = null;

/* ---------- utilidades ---------- */

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toISO(d){
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}
function todayISO(){ return toISO(new Date()); }

function formatBRL(v){
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(iso){
  if(!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

function shiftMonth(monthKey, delta){
  let [y, m] = monthKey.split('-').map(Number);
  m += delta;
  if(m < 1){ m = 12; y--; }
  if(m > 12){ m = 1; y++; }
  return y + '-' + String(m).padStart(2, '0');
}

function monthLabel(monthKey){
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function dayLabel(dateStr){
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if(dt.getTime() === today.getTime()) return 'Hoje';
  if(dt.getTime() === yest.getTime())  return 'Ontem';
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

function getCategoryById(id){ return state.categories.find(c => c.id === id); }

/* ---------- toast ---------- */

function showToast(msg){
  const t = document.getElementById('toast');
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  t.textContent = msg;
  t.classList.remove('hide');
  t.classList.add('show');
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    t.classList.add('hide');
    toastHideTimer = setTimeout(() => t.classList.remove('hide'), 250);
  }, 2200);
}

/* ---------- persistência ---------- */

function seedCategories(){
  return [
    ...DEFAULT_CATEGORIES.map(c => ({ ...c, active: true,  builtin: true })),
    ...SUGGESTED_CATEGORIES.map(c => ({ ...c, active: false, builtin: true })),
    ...INCOME_CATEGORIES.map(c => ({ ...c, active: true,  builtin: true })),
  ];
}

function mergeBuiltinCategories(){
  const all = seedCategories();
  const existing = new Set(state.categories.map(c => c.id));
  all.forEach(c => { if(!existing.has(c.id)) state.categories.push(c); });
}

function loadState(){
  let stored = null;
  try{ stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch(e){ stored = null; }

  if(stored && Array.isArray(stored.entries) && Array.isArray(stored.categories)){
    state = stored;
    mergeBuiltinCategories();
  } else {
    state = { entries: [], categories: seedCategories(), viewMonth: todayISO().slice(0, 7) };
  }
  if(!state.viewMonth) state.viewMonth = todayISO().slice(0, 7);
  saveState();
}

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    console.error('Falha ao salvar', e);
    showToast('⚠️ Não foi possível salvar — armazenamento cheio?');
  }
  // Sincroniza com a planilha no Google Drive (só quando logado via Google)
  if(window.GoogleSync) GoogleSync.scheduleSync(state);
}

/* ---------- cálculos do mês ---------- */

function computeMonthTotals(monthKey){
  const entries = state.entries.filter(e => e.date.slice(0, 7) === monthKey);
  let income = 0, expense = 0;
  const byClass = { essencial: 0, reduzir: 0, atencao: 0, investimento: 0 };
  entries.forEach(e => {
    if(e.type === 'income'){
      income += e.amount;
    } else {
      expense += e.amount;
      if(e.classification && byClass.hasOwnProperty(e.classification))
        byClass[e.classification] += e.amount;
    }
  });
  return { income, expense, balance: income - expense, byClass };
}

/* ---------- renderização: saldo / insight / lista ---------- */

function renderBalance(){
  const t = computeMonthTotals(state.viewMonth);
  const el = document.getElementById('balanceAmount');
  el.textContent = formatBRL(t.balance);
  el.classList.toggle('negative', t.balance < 0);
  document.getElementById('totalIncome').textContent  = formatBRL(t.income);
  document.getElementById('totalExpense').textContent = formatBRL(t.expense);
  document.getElementById('monthLabel').textContent   = monthLabel(state.viewMonth);
}

function renderInsight(){
  const t = computeMonthTotals(state.viewMonth);
  const bar    = document.getElementById('insightBar');
  const legend = document.getElementById('insightLegend');
  const tip    = document.getElementById('insightTip');
  const total  = t.expense;

  if(total <= 0){
    bar.innerHTML = legend.innerHTML = '';
    tip.textContent = 'Assim que você lançar despesas, mostramos aqui quanto é essencial e quanto dá para economizar.';
    return;
  }

  bar.innerHTML = CLASS_DEFS.map(c => {
    const v = t.byClass[c.key] || 0;
    const pct = (v / total * 100).toFixed(1);
    return pct > 0 ? `<span style="width:${pct}%;background:${c.color}"></span>` : '';
  }).join('');

  legend.innerHTML = CLASS_DEFS.map(c => {
    const v = t.byClass[c.key] || 0;
    if(v <= 0) return '';
    const pct = Math.round(v / total * 100);
    return `<div><span class="dot" style="background:${c.color}"></span>${c.label} · ${pct}% (${formatBRL(v)})</div>`;
  }).join('');

  const reduzirPct = (t.byClass.reduzir / total * 100) || 0;
  const atencaoVal = t.byClass.atencao || 0;
  const investVal  = t.byClass.investimento || 0;
  const saldoPos   = t.balance > 0;

  if(atencaoVal > 0){
    tip.textContent = `⚠️ ${formatBRL(atencaoVal)} em itens de atenção (juros/limite bancário). Quitar isso primeiro costuma liberar mais orçamento do que qualquer corte.`;
  } else if(reduzirPct >= 35){
    tip.textContent = `💡 ${Math.round(reduzirPct)}% dos gastos este mês podem ser reduzidos. Um corte de 15% aí já faz diferença no saldo final.`;
  } else if(investVal > 0 && saldoPos){
    tip.textContent = `🌱 Você está investindo ${formatBRL(investVal)} este mês — ótimo hábito para o futuro.`;
  } else {
    tip.textContent = 'Seus gastos estão concentrados em itens essenciais — bom sinal para o controle do orçamento.';
  }
}

function entryRowHtml(e){
  const cat = getCategoryById(e.catId) || { icon: '🔖', name: 'Categoria removida' };
  const cls = CLASS_DEFS.find(c => c.key === e.classification);
  return `
    <div class="entry-row">
      <div class="entry-icon">${cat.icon}</div>
      <div class="entry-mid">
        <div class="entry-cat">${escapeHtml(cat.name)}</div>
        ${e.desc ? `<div class="entry-desc">${escapeHtml(e.desc)}</div>` : ''}
        ${cls ? `<span class="entry-tag" style="background:${cls.color};color:#fff">${cls.label}</span>` : ''}
      </div>
      <div class="entry-amount ${e.type === 'income' ? 'in' : 'out'} tabular">
        ${e.type === 'income' ? '+' : '−'} ${formatBRL(e.amount)}
      </div>
      <button class="entry-del" data-id="${e.id}" aria-label="Excluir lançamento de ${escapeHtml(cat.name)}">✕</button>
    </div>`;
}

function renderEntries(){
  const list = document.getElementById('entriesList');
  const monthEntries = state.entries
    .filter(e => e.date.slice(0, 7) === state.viewMonth)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  if(monthEntries.length === 0){
    list.innerHTML = `
      <div class="empty-state">
        <span class="big">🧾</span>
        Nenhum lançamento neste mês ainda.<br>
        Toque em <strong>Despesa</strong> ou <strong>Receita</strong> para começar.
      </div>`;
    return;
  }

  const groups = [];
  let lastDate = null, current = null;
  monthEntries.forEach(e => {
    if(e.date !== lastDate){
      current = { date: e.date, items: [] };
      groups.push(current);
      lastDate = e.date;
    }
    current.items.push(e);
  });

  list.innerHTML = groups.map(g => `
    <div class="day-group">
      <div class="day-label">${dayLabel(g.date)}</div>
      ${g.items.map(entryRowHtml).join('')}
    </div>`).join('');
}

function renderAll(){
  renderBalance();
  renderInsight();
  renderEntries();
}

function confirmDeleteEntry(id){
  const e = state.entries.find(x => x.id === id);
  if(!e) return;
  if(confirm('Excluir este lançamento?')){
    state.entries = state.entries.filter(x => x.id !== id);
    saveState();
    renderAll();
    showToast('Lançamento excluído');
  }
}

/* ---------- sheets ---------- */

function openSheet(id){
  document.getElementById('backdrop').classList.add('open');
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSheet(id){
  document.getElementById(id).classList.remove('open');
  // Só remove backdrop se nenhum sheet estiver aberto
  const anyOpen = ['sheetEntry','sheetCategories','sheetExport']
    .some(s => document.getElementById(s).classList.contains('open'));
  if(!anyOpen){
    document.getElementById('backdrop').classList.remove('open');
    document.body.style.overflow = '';
  }
}
function closeAllSheets(){
  ['sheetEntry','sheetCategories','sheetExport'].forEach(id =>
    document.getElementById(id).classList.remove('open')
  );
  document.getElementById('backdrop').classList.remove('open');
  document.body.style.overflow = '';
}

/* ---------- swipe para fechar sheets ---------- */

function attachSwipeToClose(sheetId){
  const el = document.getElementById(sheetId);
  let startY = 0, isDragging = false;
  el.addEventListener('touchstart', e => {
    // Só inicia arrasto se tocar na alça ou no topo do sheet
    if(e.target.closest('.sheet-handle') || e.target.closest('.sheet-head')){
      startY = e.touches[0].clientY;
      isDragging = true;
    }
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if(!isDragging) return;
    const dy = e.touches[0].clientY - startY;
    if(dy > 0){
      el.style.transform = `translateY(${dy}px)`;
      // Em telas largas (CSS faz translate(-50%, 0)) ajustamos
      if(window.innerWidth >= 560)
        el.style.transform = `translate(-50%, ${dy}px)`;
    }
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if(!isDragging) return;
    isDragging = false;
    const dy = e.changedTouches[0].clientY - startY;
    el.style.transform = '';
    if(dy > 80) closeSheet(sheetId);
  });
}

/* ---------- lançamento: abrir / navegar ---------- */

function openEntrySheet(type){
  entryType = type;
  selectedCategory = null;
  keypadCents = 0;
  document.getElementById('entryTitle').textContent =
    type === 'expense' ? 'Nova despesa' : 'Nova receita';
  goBackToCat();
  renderCatGrid(type);
  openSheet('sheetEntry');
}

function goBackToCat(){
  document.getElementById('entryStepCat').style.display = 'block';
  document.getElementById('entryStepAmount').style.display = 'none';
  document.getElementById('entryBack').style.visibility = 'hidden';
}

function renderCatGrid(type){
  const cats = state.categories.filter(c => c.type === type && c.active);
  const grid = document.getElementById('catGrid');
  if(cats.length === 0){
    grid.innerHTML = `<p class="export-help" style="grid-column:1/-1">
      Nenhuma categoria ativa. Toque em 🏷️ para ativar ou criar categorias.</p>`;
    return;
  }
  grid.innerHTML = cats.map(c => `
    <button class="cat-btn" data-id="${c.id}" aria-label="${escapeHtml(c.name)}">
      <span class="ic">${c.icon}</span>
      <span class="lb">${escapeHtml(c.name)}</span>
    </button>`).join('');
}

function selectCategory(cat){
  selectedCategory = cat;
  selectedClassification = cat.classification || null;
  keypadCents = 0;

  document.getElementById('selCatIcon').textContent = cat.icon;
  document.getElementById('selCatLabel').textContent = cat.name;
  document.getElementById('descInput').value = '';
  document.getElementById('dateInput').value = todayISO();
  updateAmountDisplay();

  document.getElementById('entryStepCat').style.display = 'none';
  document.getElementById('entryStepAmount').style.display = 'block';
  document.getElementById('entryBack').style.visibility = 'visible';

  const classField = document.getElementById('classField');
  if(entryType === 'expense'){
    classField.style.display = 'block';
    renderClassRow();
  } else {
    classField.style.display = 'none';
  }
  updateSaveEnabled();
}

function renderClassRow(){
  document.getElementById('classRow').innerHTML = CLASS_DEFS.map(c => `
    <button class="chip${selectedClassification === c.key ? ' active' : ''}"
            data-class="${c.key}" style="color:${c.color}">${c.label}</button>
  `).join('');
}

function updateAmountDisplay(){
  document.getElementById('amountDisplay').textContent = formatBRL(keypadCents / 100);
}

function updateSaveEnabled(){
  document.getElementById('saveEntry').disabled = !(selectedCategory && keypadCents > 0);
}

function keypadPress(k){
  if(k === 'back'){ keypadCents = Math.floor(keypadCents / 10); }
  else if(k === 'clear'){ keypadCents = 0; }
  else {
    const next = keypadCents * 10 + Number(k);
    if(next <= 999999999) keypadCents = next;  // teto: R$ 9.999.999,99
  }
  updateAmountDisplay();
  updateSaveEnabled();
}

function saveEntryHandler(){
  if(!selectedCategory || keypadCents <= 0) return;
  const entry = {
    id:             uid(),
    type:           entryType,
    catId:          selectedCategory.id,
    desc:           document.getElementById('descInput').value.trim().slice(0, 60),
    amount:         keypadCents / 100,
    date:           document.getElementById('dateInput').value || todayISO(),
    classification: entryType === 'expense' ? selectedClassification : null,
    createdAt:      Date.now(),
  };
  state.entries.push(entry);
  saveState();
  closeSheet('sheetEntry');
  state.viewMonth = entry.date.slice(0, 7);
  renderAll();
  showToast(entryType === 'expense' ? '✅ Despesa registrada' : '✅ Receita registrada');
}

/* ---------- categorias ---------- */

function catManageRow(c){
  const cls = CLASS_DEFS.find(x => x.key === c.classification);
  const isExpense = c.type === 'expense';
  return `
    <div class="cat-manage-row">
      <span class="ic">${c.icon}</span>
      <span class="nm">${escapeHtml(c.name)}</span>
      ${cls ? `<span class="tag" style="background:${cls.color};color:#fff">${cls.label}</span>` : ''}
      ${isExpense
        ? `<button class="switch${c.active ? ' on' : ''}" data-toggle="${c.id}"
               aria-label="${c.active ? 'Desativar' : 'Ativar'} categoria ${escapeHtml(c.name)}"></button>`
        : ''}
      ${!c.builtin
        ? `<button class="entry-del" data-del="${c.id}"
               aria-label="Remover categoria ${escapeHtml(c.name)}">✕</button>`
        : ''}
    </div>`;
}

function renderCategoryManager(){
  const active    = state.categories.filter(c => c.type === 'expense' && c.active);
  const suggested = state.categories.filter(c => c.type === 'expense' && !c.active);
  const income    = state.categories.filter(c => c.type === 'income');

  document.getElementById('activeExpenseList').innerHTML =
    active.length
      ? active.map(catManageRow).join('')
      : '<p class="export-help">Nenhuma categoria ativa ainda.</p>';

  document.getElementById('suggestedExpenseList').innerHTML =
    suggested.length
      ? suggested.map(catManageRow).join('')
      : '<p class="export-help">Todas as sugestões já estão ativas.</p>';

  document.getElementById('incomeList').innerHTML = income.map(catManageRow).join('');
}

function renderNewCatClassRow(){
  document.getElementById('newCatClass').innerHTML = CLASS_DEFS.map(c => `
    <button class="chip${newCatClass === c.key ? ' active' : ''}"
            data-class="${c.key}" style="color:${c.color}">${c.label}</button>
  `).join('');
}

function addCustomCategory(){
  const iconInput = document.getElementById('newCatIcon');
  const nameInput = document.getElementById('newCatName');
  const name = nameInput.value.trim();
  if(!name){ showToast('⚠️ Dê um nome para a categoria'); return; }

  const cat = {
    id:             'custom_' + uid(),
    type:           newCatType,
    name:           name.slice(0, 24),
    icon:           (iconInput.value.trim() || '📌').slice(0, 2),
    classification: newCatType === 'expense' ? newCatClass : null,
    tip:            '',
    active:         true,
    builtin:        false,
  };
  state.categories.push(cat);
  saveState();
  nameInput.value = '';
  iconInput.value = '';
  renderCategoryManager();
  showToast('✅ Categoria adicionada');
}

/* ---------- exportar para Excel ---------- */

function getRangeEntries(){
  const start = document.getElementById('exportStart').value;
  const end   = document.getElementById('exportEnd').value;
  if(!start || !end) return [];
  return state.entries
    .filter(e => e.date >= start && e.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function updateExportSummary(){
  const entries  = getRangeEntries();
  const income   = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense  = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  document.getElementById('exportSummary').innerHTML =
    entries.length === 0
      ? 'Nenhum lançamento neste período.'
      : `<b>${entries.length}</b> lançamento(s) · Receitas <b>${formatBRL(income)}</b> ·
         Despesas <b>${formatBRL(expense)}</b> · Saldo <b>${formatBRL(income - expense)}</b>`;
}

function prepExportSheet(){
  const start = document.getElementById('exportStart');
  const end   = document.getElementById('exportEnd');
  if(!start.value || !end.value){
    const [y, m] = state.viewMonth.split('-').map(Number);
    start.value = toISO(new Date(y, m - 1, 1));
    end.value   = toISO(new Date(y, m, 0));
  }
  updateExportSummary();
}

function applyCurrencyFormat(ws, colIndex){
  if(!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for(let r = range.s.r + 1; r <= range.e.r; r++){
    const ref  = XLSX.utils.encode_cell({ r, c: colIndex });
    const cell = ws[ref];
    if(cell && typeof cell.v === 'number') cell.z = '"R$" #,##0.00';
  }
}

function doExport(){
  const entries = getRangeEntries();
  if(entries.length === 0){ showToast('⚠️ Não há lançamentos nesse período'); return; }
  if(typeof XLSX === 'undefined'){ showToast('⚠️ Biblioteca de exportação não carregou'); return; }

  const startVal = document.getElementById('exportStart').value;
  const endVal   = document.getElementById('exportEnd').value;

  // Aba 1: detalhe linha a linha
  const detailRows = entries.map(e => {
    const cat = getCategoryById(e.catId);
    const cls = CLASS_DEFS.find(c => c.key === e.classification);
    return {
      'Data':           formatDateBR(e.date),
      'Tipo':           e.type === 'income' ? 'Receita' : 'Despesa',
      'Categoria':      cat ? cat.name : '(removida)',
      'Descrição':      e.desc || '',
      'Classificação':  cls ? cls.label : '',
      'Valor (R$)':     e.type === 'income' ? e.amount : -e.amount,
    };
  });
  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  wsDetail['!cols'] = [{ wch:12 },{ wch:10 },{ wch:22 },{ wch:32 },{ wch:16 },{ wch:13 }];
  applyCurrencyFormat(wsDetail, 5);

  // Aba 2: resumo
  const income  = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const byCat   = {};
  entries.filter(e => e.type === 'expense').forEach(e => {
    const cat  = getCategoryById(e.catId);
    const name = cat ? cat.name : '(removida)';
    byCat[name] = (byCat[name] || 0) + e.amount;
  });
  const byClass = { essencial: 0, reduzir: 0, atencao: 0, investimento: 0 };
  entries.filter(e => e.type === 'expense').forEach(e => {
    if(e.classification && byClass.hasOwnProperty(e.classification))
      byClass[e.classification] += e.amount;
  });

  const summaryRows = [
    { Resumo: 'Período',                            Valor: `${formatDateBR(startVal)} a ${formatDateBR(endVal)}` },
    { Resumo: 'Total de receitas',                  Valor: income },
    { Resumo: 'Total de despesas',                  Valor: expense },
    { Resumo: 'Saldo do período',                   Valor: income - expense },
    { Resumo: '',                                   Valor: '' },
    { Resumo: 'Despesas essenciais',                Valor: byClass.essencial },
    { Resumo: 'Despesas que podem reduzir',         Valor: byClass.reduzir },
    { Resumo: 'Despesas de atenção (juros/limite)', Valor: byClass.atencao },
    { Resumo: 'Investimentos/Poupança',             Valor: byClass.investimento },
    { Resumo: '',                                   Valor: '' },
    { Resumo: 'Detalhamento por categoria',         Valor: '' },
    ...Object.entries(byCat)
       .sort((a, b) => b[1] - a[1])
       .map(([k, v]) => ({ Resumo: k, Valor: v })),
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch:34 },{ wch:16 }];
  applyCurrencyFormat(wsSummary, 1);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDetail,  'Lançamentos');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  XLSX.writeFile(wb, `controle-gastos_${startVal}_a_${endVal}.xlsx`);
  showToast('📊 Planilha exportada com sucesso');
}

/* ---------- backup / restauração ---------- */

function doBackup(){
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `controle-gastos-backup_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('💾 Backup salvo com sucesso');
}

function doRestore(){
  document.getElementById('restoreFileInput').click();
}

function handleRestoreFile(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try{
      const parsed = JSON.parse(ev.target.result);
      if(!Array.isArray(parsed.entries) || !Array.isArray(parsed.categories))
        throw new Error('Formato inválido');
      if(!confirm(`Restaurar backup? Isso substituirá os ${state.entries.length} lançamento(s) atuais.`)) return;
      state = parsed;
      mergeBuiltinCategories();
      saveState();
      renderAll();
      closeAllSheets();
      showToast('✅ Backup restaurado com sucesso');
    }catch(err){
      showToast('⚠️ Arquivo de backup inválido');
    }
  };
  reader.readAsText(file);
  e.target.value = '';  // permite reselecionar o mesmo arquivo
}

function doClearData(){
  if(!confirm(`Apagar TODOS os dados permanentemente?\n(${state.entries.length} lançamento(s) serão perdidos)`)) return;
  if(!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
  state = { entries: [], categories: seedCategories(), viewMonth: todayISO().slice(0, 7) };
  saveState();
  renderAll();
  closeAllSheets();
  showToast('🗑️ Todos os dados foram apagados');
}

/* ---------- service worker (cache offline) ---------- */

function registerSW(){
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}

/* ---------- listeners ---------- */

function attachListeners(){

  // Botões de novo lançamento
  document.getElementById('btnAddExpense').addEventListener('click', () => openEntrySheet('expense'));
  document.getElementById('btnAddIncome').addEventListener('click',  () => openEntrySheet('income'));

  // Sheet de lançamento
  document.getElementById('entryClose').addEventListener('click',   () => closeSheet('sheetEntry'));
  document.getElementById('entryBack').addEventListener('click',    goBackToCat);
  document.getElementById('selCatChange').addEventListener('click', goBackToCat);

  // Backdrop fecha qualquer sheet
  document.getElementById('backdrop').addEventListener('click', closeAllSheets);

  // Grade de categorias (passo 1)
  document.getElementById('catGrid').addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if(!btn) return;
    const cat = getCategoryById(btn.dataset.id);
    if(cat) selectCategory(cat);
  });

  // Teclado numérico (passo 2)
  document.getElementById('keypad').addEventListener('click', e => {
    const btn = e.target.closest('.key');
    if(btn) keypadPress(btn.dataset.k);
  });

  // Chips de classificação
  document.getElementById('classRow').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if(!btn) return;
    selectedClassification = btn.dataset.class;
    renderClassRow();
  });

  // Salvar com Enter no campo descrição
  document.getElementById('descInput').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('saveEntry').click(); }
  });

  document.getElementById('saveEntry').addEventListener('click', saveEntryHandler);

  // Navegação de mês
  document.getElementById('prevMonth').addEventListener('click', () => {
    state.viewMonth = shiftMonth(state.viewMonth, -1); renderAll();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    state.viewMonth = shiftMonth(state.viewMonth, 1); renderAll();
  });

  // Excluir lançamento
  document.getElementById('entriesList').addEventListener('click', e => {
    const del = e.target.closest('.entry-del');
    if(del) confirmDeleteEntry(del.dataset.id);
  });

  // ---- Sheet de categorias ----
  document.getElementById('openCategories').addEventListener('click', () => {
    renderCategoryManager();
    openSheet('sheetCategories');
  });
  document.getElementById('catClose').addEventListener('click', () => closeSheet('sheetCategories'));

  document.getElementById('sheetCategories').addEventListener('click', e => {
    const sw = e.target.closest('[data-toggle]');
    if(sw){
      const cat = getCategoryById(sw.dataset.toggle);
      if(cat){ cat.active = !cat.active; saveState(); renderCategoryManager(); }
      return;
    }
    const del = e.target.closest('[data-del]');
    if(del){
      if(confirm('Remover esta categoria? Lançamentos antigos mantêm o nome, mas ela some da lista rápida.')){
        state.categories = state.categories.filter(c => c.id !== del.dataset.del);
        saveState();
        renderCategoryManager();
      }
    }
  });

  document.getElementById('newCatType').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if(!btn) return;
    newCatType = btn.dataset.type;
    [...document.getElementById('newCatType').children].forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    document.getElementById('newCatClassField').style.display =
      newCatType === 'expense' ? 'block' : 'none';
  });

  document.getElementById('newCatClass').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if(!btn) return;
    newCatClass = btn.dataset.class;
    renderNewCatClassRow();
  });

  document.getElementById('addCustomCat').addEventListener('click', addCustomCategory);

  // ---- Sheet de exportação ----
  document.getElementById('openExport').addEventListener('click', () => {
    prepExportSheet();
    openSheet('sheetExport');
  });
  document.getElementById('exportClose').addEventListener('click', () => closeSheet('sheetExport'));
  document.getElementById('exportStart').addEventListener('change', updateExportSummary);
  document.getElementById('exportEnd').addEventListener('change', updateExportSummary);
  document.getElementById('doExport').addEventListener('click', doExport);

  // Backup / Restore / Limpar dados
  document.getElementById('doBackup').addEventListener('click', doBackup);
  document.getElementById('doRestore').addEventListener('click', doRestore);
  document.getElementById('doClearData').addEventListener('click', doClearData);
  document.getElementById('restoreFileInput').addEventListener('change', handleRestoreFile);

  // Swipe para fechar cada sheet
  attachSwipeToClose('sheetEntry');
  attachSwipeToClose('sheetCategories');
  attachSwipeToClose('sheetExport');
}

/* ---------- inicialização ---------- */

function init(){
  loadState();
  attachListeners();
  renderNewCatClassRow();
  renderAll();
  registerSW();
}

function attachUserPillListener(){
  const pill = document.getElementById('btnUserPill');
  if(pill){
    pill.addEventListener('click', () => {
      const sess = Auth.getCurrentSession && Auth.getCurrentSession();
      const isGoogle = sess && sess.loginMethod === 'google';
      if(isGoogle){
        const email = sess.googleEmail ? `\n(${sess.googleEmail})` : '';
        if(confirm('Seus dados estão salvos na planilha do seu Google Drive.' + email + '\n\nDeseja sair da conta?')){
          Auth.clearSession();
          window.location.reload();
        }
      } else if(Auth.isAdmin()){
        Auth.renderUserPanel();
      } else {
        // Usuário não-admin: mostra apenas opção de sair
        if(confirm('Deseja sair da conta?')){
          Auth.clearSession();
          window.location.reload();
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // A função onAuthSuccess é chamada por auth.js após login bem-sucedido
  window.onAuthSuccess = init;
  attachUserPillListener();
  const ok = await Auth.checkAuth();
  if(ok) init();
});

// Console de depuração — acesse via Safari → Ajustes → Avançado → Web Inspector
window.appDebug = {
  get state(){ return state; },
  getCategoryById, computeMonthTotals, shiftMonth, formatBRL,
};
