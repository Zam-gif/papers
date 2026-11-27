'use strict';

// Research Paper Tracker: список статей хранится в localStorage
const STORAGE_KEY = 'papers';

// Статусы чтения: ключ хранится в localStorage, подпись видна на странице
const STATUSES = {
  toread: 'Прочитать',
  reading: 'Читаю',
  done: 'Прочитано',
};
const DEFAULT_STATUS = 'toread';

const form = document.getElementById('paper-form');
const titleInput = document.getElementById('title');
const doiInput = document.getElementById('doi');
const hint = document.getElementById('hint');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const counter = document.getElementById('counter');

let papers = loadPapers();

function loadPapers() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(data)) return [];
    return data
      .filter((p) => p && typeof p.title === 'string' && p.title.trim())
      .map((p) => ({
        id: String(p.id || newId()),
        title: p.title,
        doi: typeof p.doi === 'string' ? p.doi : '',
        addedAt: Number.isFinite(p.addedAt) ? p.addedAt : Date.now(),
        // статьи, добавленные до статусов, получают «Прочитать»
        status: STATUSES[p.status] ? p.status : DEFAULT_STATUS,
        conclusions: typeof p.conclusions === 'string' ? p.conclusions : '',
      }));
  } catch {
    return [];
  }
}

function savePapers(nextPapers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPapers));
    papers = nextPapers;
    return true;
  } catch {
    return false;
  }
}

const STORAGE_ERROR = 'Не удалось сохранить. Проверьте доступ к хранилищу браузера и свободное место, затем повторите попытку.';

function updatePaper(id, changes) {
  return savePapers(papers.map((p) => p.id === id ? { ...p, ...changes } : p));
}

function recordMessage(element, message, isError = false) {
  element.textContent = message;
  element.dataset.error = String(isError);
}

function hasRecords(paper) {
  return Boolean(paper.conclusions.trim());
}

function updateRecordsView() {
  empty.hidden = papers.length > 0;
}

function renderNotes(paper) {
  const details = document.createElement('details');
  details.className = 'paper-notes';
  const summary = document.createElement('summary');
  summary.textContent = 'Заметки';
  const content = document.createElement('div');
  content.className = 'notes-content';
  const noteForm = document.createElement('form');
  noteForm.className = 'notes-form';
  const noteLabel = document.createElement('label');
  noteLabel.className = 'field';
  noteLabel.textContent = 'Выводы';
  const note = document.createElement('textarea');
  note.value = paper.conclusions;
  note.rows = 4;
  noteLabel.append(note);
  const save = document.createElement('button');
  save.className = 'btn';
  save.type = 'submit';
  save.textContent = 'Сохранить выводы';
  const noteStatus = document.createElement('p');
  noteStatus.className = 'record-status';
  noteStatus.setAttribute('role', 'status');
  note.addEventListener('input', () => recordMessage(noteStatus, 'Есть несохранённые изменения.'));
  noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!updatePaper(paper.id, { conclusions: note.value.trim() })) {
      recordMessage(noteStatus, STORAGE_ERROR, true);
      return;
    }
    note.value = papers.find((p) => p.id === paper.id).conclusions;
    recordMessage(noteStatus, 'Выводы сохранены.');
    updateRecordsView();
  });
  noteForm.append(noteLabel, save, noteStatus);

  content.append(noteForm);
  details.append(summary, content);
  return details;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// https://doi.org/10.1038/nature14539 и doi:10.1038/nature14539 → 10.1038/nature14539
function normalizeDoi(raw) {
  return raw
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

function isValidDoi(doi) {
  return /^10\.\d+\/\S+$/.test(doi);
}

function doiLink(doi) {
  return 'https://doi.org/' + encodeURIComponent(doi).replace(/%2F/gi, '/');
}

// Дата — ДД.ММ.ГГГГ по местному времени
function formatDate(timestamp) {
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function showHint(text, input) {
  hint.textContent = text;
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
}

function clearHint() {
  hint.textContent = '';
  titleInput.removeAttribute('aria-invalid');
  doiInput.removeAttribute('aria-invalid');
}

function renderStatusSelect(paper) {
  const label = document.createElement('label');
  label.className = 'paper-status';

  const text = document.createElement('span');
  text.textContent = 'Статус';

  const select = document.createElement('select');
  select.dataset.id = paper.id;
  Object.entries(STATUSES).forEach(([value, name]) => {
    select.add(new Option(name, value, false, value === paper.status));
  });

  label.append(text, select);
  return label;
}

function renderDeleteButton(paper) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-delete';
  button.dataset.id = paper.id;
  button.textContent = 'Удалить';
  button.setAttribute('aria-label', `Удалить статью «${paper.title}»`);
  return button;
}

function renderPaper(paper) {
  const item = document.createElement('li');
  item.className = 'paper';
  item.dataset.id = paper.id;
  item.dataset.status = paper.status;

  const title = document.createElement('h3');
  title.className = 'paper-title';
  title.textContent = paper.title;

  const doi = document.createElement('p');
  doi.className = 'paper-doi';
  if (paper.doi) {
    const link = document.createElement('a');
    link.href = doiLink(paper.doi);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = paper.doi;
    doi.append('DOI: ', link);
  } else {
    doi.textContent = 'DOI не указан';
  }

  const date = document.createElement('p');
  date.className = 'paper-date';
  date.textContent = `Добавлена ${formatDate(paper.addedAt)}`;

  const footer = document.createElement('div');
  footer.className = 'paper-footer';
  const actions = document.createElement('div');
  actions.className = 'paper-actions';
  actions.append(renderStatusSelect(paper), renderDeleteButton(paper));
  footer.append(date, actions);

  item.append(title, doi, footer, renderNotes(paper));
  return item;
}

// «Всего: 4 · Прочитать: 2 · Читаю: 1 · Прочитано: 1»
function renderCounter() {
  const parts = [`Всего: ${papers.length}`];
  Object.entries(STATUSES).forEach(([value, name]) => {
    const count = papers.filter((p) => p.status === value).length;
    parts.push(`${name}: ${count}`);
  });
  counter.textContent = parts.join(' · ');
}

function render() {
  list.replaceChildren(...papers.map(renderPaper));
  empty.hidden = papers.length > 0;
  renderCounter();
  updateRecordsView();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearHint();

  const title = titleInput.value.trim();
  const doi = normalizeDoi(doiInput.value);

  if (!title) {
    showHint('Введите название статьи', titleInput);
    return;
  }
  if (doi && !isValidDoi(doi)) {
    showHint('DOI начинается с 10. и содержит /, например 10.1038/nature14539', doiInput);
    return;
  }
  if (doi && papers.some((p) => p.doi.toLowerCase() === doi.toLowerCase())) {
    showHint('Статья с таким DOI уже есть в списке', doiInput);
    return;
  }

  const paper = { id: newId(), title, doi, addedAt: Date.now(), status: DEFAULT_STATUS, conclusions: '' };
  if (!savePapers([paper, ...papers])) {
    showHint(STORAGE_ERROR);
    return;
  }
  list.prepend(renderPaper(paper));
  renderCounter();
  updateRecordsView();
  form.reset();
  titleInput.focus();
});

// Смена статуса: меняем только карточку и счётчики, фокус остаётся на списке
list.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-id]');
  if (!select) return;
  const paper = papers.find((p) => p.id === select.dataset.id);
  if (!paper || !STATUSES[select.value]) return;

  if (!updatePaper(paper.id, { status: select.value })) {
    select.value = paper.status;
    showHint(STORAGE_ERROR);
    return;
  }
  select.closest('.paper').dataset.status = select.value;
  renderCounter();
});

// Удаление: спрашиваем подтверждение, потом убираем из списка и localStorage
list.addEventListener('click', (event) => {
  const button = event.target.closest('.btn-delete[data-id]');
  if (!button) return;
  const index = papers.findIndex((p) => p.id === button.dataset.id);
  if (index === -1) return;
  const paper = papers[index];
  const question = hasRecords(paper)
    ? `Удалить статью «${paper.title}» вместе с выводами?`
    : `Удалить статью «${paper.title}»?`;
  if (!confirm(question)) return;

  if (!savePapers(papers.filter((p) => p.id !== paper.id))) {
    showHint(STORAGE_ERROR);
    return;
  }
  button.closest('.paper').remove();
  renderCounter();
  updateRecordsView();

  // фокус — на следующую статью, а если статей нет — на поле названия
  const visible = [...list.children].filter((item) => !item.hidden);
  const next = visible.find((item) => [...list.children].indexOf(item) >= index) || visible[visible.length - 1];
  (next ? next.querySelector('.btn-delete[data-id]') : titleInput).focus();
});

// Начали исправлять поле — убираем подсказку
[titleInput, doiInput].forEach((input) => {
  input.addEventListener('input', () => {
    if (input.hasAttribute('aria-invalid')) clearHint();
  });
});



render();
