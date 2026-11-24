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
      }));
  } catch {
    return [];
  }
}

function savePapers() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
  } catch {
    showHint('Не удалось сохранить: браузер не даёт хранить данные.');
  }
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

  item.append(title, doi, footer);
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

  papers.unshift({ id: newId(), title, doi, addedAt: Date.now(), status: DEFAULT_STATUS });
  savePapers();
  render();
  form.reset();
  titleInput.focus();
});

// Смена статуса: меняем только карточку и счётчики, фокус остаётся на списке
list.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-id]');
  if (!select) return;
  const paper = papers.find((p) => p.id === select.dataset.id);
  if (!paper || !STATUSES[select.value]) return;

  paper.status = select.value;
  select.closest('.paper').dataset.status = paper.status;
  savePapers();
  renderCounter();
});

// Удаление: спрашиваем подтверждение, потом убираем из списка и localStorage
list.addEventListener('click', (event) => {
  const button = event.target.closest('.btn-delete');
  if (!button) return;
  const index = papers.findIndex((p) => p.id === button.dataset.id);
  if (index === -1) return;
  if (!confirm(`Удалить статью «${papers[index].title}»?`)) return;

  papers.splice(index, 1);
  savePapers();
  render();

  // фокус — на следующую статью, а если статей нет — на поле названия
  const next = list.children[index] || list.lastElementChild;
  (next ? next.querySelector('.btn-delete') : titleInput).focus();
});

// Начали исправлять поле — убираем подсказку
[titleInput, doiInput].forEach((input) => {
  input.addEventListener('input', () => {
    if (input.hasAttribute('aria-invalid')) clearHint();
  });
});

render();
