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
const recordSearch = document.getElementById('record-search');
const searchResult = document.getElementById('search-result');
const noResults = document.getElementById('no-results');
const downloadButton = document.getElementById('download-records');
const downloadHelp = document.getElementById('download-help');
const downloadMessage = document.getElementById('download-message');

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
        quotes: Array.isArray(p.quotes) ? p.quotes
          .filter((q) => q && typeof q.text === 'string' && q.text.trim()
            && Number.isSafeInteger(q.page) && q.page > 0)
          .map((q) => ({ id: newId(), text: q.text, page: q.page })) : [],
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
  return Boolean(paper.conclusions.trim() || paper.quotes.length);
}

// Фильтруем существующие карточки, не теряя введённые, но ещё не сохранённые выводы.
function updateRecordsView() {
  const query = recordSearch.value.trim().toLocaleLowerCase('ru');
  let found = 0;
  for (const item of list.children) {
    const paper = papers.find((p) => p.id === item.dataset.id);
    const matches = !query || [paper.conclusions, ...paper.quotes.map((q) => q.text)]
      .some((text) => text.toLocaleLowerCase('ru').includes(query));
    item.hidden = !matches;
    if (matches) found++;
    // Совпавшие записи сразу доступны для чтения.
    if (query && matches) item.querySelector('.paper-notes').open = true;
  }
  searchResult.textContent = query ? `Найдено статей: ${found} из ${papers.length}. Поиск по сохранённым выводам и цитатам.` : '';
  noResults.hidden = !query || found > 0 || papers.length === 0;
  empty.hidden = papers.length > 0;
  const available = papers.some(hasRecords);
  downloadButton.disabled = !available;
  downloadHelp.textContent = available ? 'Скачивание в формате TXT.' : 'Пока нет сохранённых записей.';
  downloadMessage.textContent = '';
}

function renderQuote(quote, paper, quoteList, status) {
  const item = document.createElement('li');
  item.className = 'quote-item';
  const text = document.createElement('blockquote');
  text.className = 'quote-text';
  text.textContent = quote.text;
  const footer = document.createElement('div');
  footer.className = 'quote-footer';
  const page = document.createElement('p');
  page.textContent = `Страница ${quote.page}`;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn-delete';
  remove.textContent = 'Удалить цитату';
  remove.setAttribute('aria-label', `Удалить цитату со страницы ${quote.page}`);
  remove.addEventListener('click', () => {
    const current = papers.find((p) => p.id === paper.id);
    if (!updatePaper(paper.id, { quotes: current.quotes.filter((q) => q.id !== quote.id) })) {
      recordMessage(status, STORAGE_ERROR, true);
      return;
    }
    const next = item.nextElementSibling || item.previousElementSibling;
    item.remove();
    recordMessage(status, 'Цитата удалена.');
    updateRecordsView();
    (next ? next.querySelector('button') : quoteList.parentElement.querySelector('textarea')).focus();
  });
  footer.append(page, remove);
  item.append(text, footer);
  return item;
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

  const quoteForm = document.createElement('form');
  quoteForm.className = 'quote-form';
  quoteForm.noValidate = true;
  const heading = document.createElement('h4');
  heading.textContent = 'Цитаты';
  const quoteLabel = document.createElement('label');
  quoteLabel.className = 'field';
  quoteLabel.textContent = 'Текст цитаты';
  const quoteText = document.createElement('textarea');
  quoteText.rows = 3;
  quoteLabel.append(quoteText);
  const pageLabel = document.createElement('label');
  pageLabel.className = 'field';
  pageLabel.textContent = 'Номер страницы';
  const page = document.createElement('input');
  page.type = 'text';
  page.inputMode = 'numeric';
  page.placeholder = 'Например, 12';
  pageLabel.append(page);
  const add = document.createElement('button');
  add.className = 'btn';
  add.type = 'submit';
  add.textContent = 'Добавить цитату';
  const quoteStatus = document.createElement('p');
  quoteStatus.className = 'record-status';
  quoteStatus.id = `quote-status-${paper.id}`;
  quoteStatus.setAttribute('role', 'status');
  quoteText.setAttribute('aria-describedby', quoteStatus.id);
  page.setAttribute('aria-describedby', quoteStatus.id);
  const quotes = document.createElement('ul');
  quotes.className = 'quote-list';
  quotes.setAttribute('aria-label', `Цитаты статьи «${paper.title}»`);
  quotes.append(...paper.quotes.map((q) => renderQuote(q, paper, quotes, quoteStatus)));
  for (const field of [quoteText, page]) {
    field.addEventListener('input', () => {
      field.removeAttribute('aria-invalid');
      recordMessage(quoteStatus, '');
    });
  }
  quoteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    quoteText.removeAttribute('aria-invalid');
    page.removeAttribute('aria-invalid');
    const text = quoteText.value.trim();
    const pageValue = page.value.trim();
    const pageNumber = Number(pageValue);
    const invalid = !text ? quoteText : !/^\d+$/.test(pageValue) || !Number.isSafeInteger(pageNumber) || pageNumber < 1 ? page : null;
    if (invalid) {
      invalid.setAttribute('aria-invalid', 'true');
      recordMessage(quoteStatus, !text ? 'Введите текст цитаты.' : 'Введите целый номер страницы больше нуля.', true);
      invalid.focus();
      return;
    }
    const quote = { id: newId(), text, page: pageNumber };
    const current = papers.find((p) => p.id === paper.id);
    if (!updatePaper(paper.id, { quotes: [...current.quotes, quote] })) {
      recordMessage(quoteStatus, STORAGE_ERROR, true);
      return;
    }
    quotes.append(renderQuote(quote, paper, quotes, quoteStatus));
    quoteForm.reset();
    recordMessage(quoteStatus, 'Цитата сохранена.');
    updateRecordsView();
    quoteText.focus();
  });
  quoteForm.append(heading, quoteLabel, pageLabel, add, quoteStatus);
  content.append(noteForm, quoteForm, quotes);
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

  const paper = { id: newId(), title, doi, addedAt: Date.now(), status: DEFAULT_STATUS, conclusions: '', quotes: [] };
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
    ? `Удалить статью «${paper.title}» вместе с выводами и цитатами?`
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
  (next ? next.querySelector('.btn-delete[data-id]') : recordSearch.value.trim() ? recordSearch : titleInput).focus();
});

// Начали исправлять поле — убираем подсказку
[titleInput, doiInput].forEach((input) => {
  input.addEventListener('input', () => {
    if (input.hasAttribute('aria-invalid')) clearHint();
  });
});

recordSearch.addEventListener('input', updateRecordsView);

downloadButton.addEventListener('click', () => {
  const withRecords = papers.filter(hasRecords);
  if (!withRecords.length) return;
  const sections = withRecords.map((paper) => {
    const lines = [paper.title, paper.doi ? `DOI: ${paper.doi}` : 'DOI не указан'];
    if (paper.conclusions.trim()) lines.push('', 'Выводы:', paper.conclusions);
    if (paper.quotes.length) {
      lines.push('', 'Цитаты:');
      paper.quotes.forEach((q) => lines.push(`Страница ${q.page}:`, q.text, ''));
    }
    return lines.join('\n').trimEnd();
  });
  let url;
  const link = document.createElement('a');
  try {
    // BOM помогает текстовым редакторам правильно определить UTF-8.
    const blob = new Blob(['\uFEFF', sections.join('\n\n────────────────────\n\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `zametki-${formatDate(Date.now()).replace(/\./g, '-')}.txt`;
    link.hidden = true;
    document.body.append(link);
    link.click();
  } catch {
    downloadMessage.textContent = 'Не удалось скачать записи. Повторите попытку.';
  } finally {
    link.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

render();
