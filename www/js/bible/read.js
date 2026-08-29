// The shelf, and one book as a grid of chapters. For jumping: reading straight
// through needs only the reader's own next and previous.

import * as store from '../store.js';
import * as bible from './program.js';
import { BOOKS } from './canon.js';
import { escapeHtml, haptic, toast } from '../ui.js';
import { icon } from '../icons.js';

export function renderRead(mount, { book } = {}) {
  const b = book ? bible.bookById(book) : null;
  if (b) return renderBook(mount, b);
  return renderShelf(mount);
}

/* ---------------- the shelf ---------------- */

function renderShelf(mount) {
  const prog = bible.overallProgress();

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible" aria-label="Back">${icon('back')}</button>
        <h1>The books</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="today bible-today">
        <div class="today-left">
          <h2>${prog.read} of ${prog.total} chapters</h2>
          <p class="muted small">${bible.booksFinished()} of ${BOOKS.length} books finished</p>
        </div>
      </div>

      ${bible.SECTIONS.map((sec) => {
        const books = BOOKS.filter((x) => x.section === sec.id);
        if (!books.length) return '';
        const sp = bible.sectionProgress(sec.id);
        // A section that is one book of the same name: the header is the book.
        const solo = books.length === 1 && books[0].name === sec.name;
        const head = `<div class="h-row">${icon('book', 16)}<h2>${escapeHtml(sec.name)}</h2>
            <span class="pill ghost">${sp.read}/${sp.total}</span></div>
          <div class="prog-bar"><i style="width:${(sp.frac * 100).toFixed(1)}%"></i></div>`;
        if (solo) return `<a class="card solo-book" href="#/bible/books?book=${books[0].id}">${head}</a>`;
        return `<section class="card">
          ${head}
          <div class="book-list">
            ${books.map((x) => {
              const p = bible.bookProgress(x.id);
              const finished = p.read >= p.total;
              return `<a class="book-row ${finished ? 'done' : ''}" href="#/bible/books?book=${x.id}">
                <span class="br-name">
                  <b>${escapeHtml(x.name)}</b>
                  ${x.also || x.deutero
                    ? `<i>${[x.also ? escapeHtml(x.also) : '', x.deutero ? 'deuterocanonical' : ''].filter(Boolean).join(' · ')}</i>`
                    : ''}
                </span>
                <span class="br-prog">
                  <span class="br-bar"><i style="width:${(p.frac * 100).toFixed(0)}%"></i></span>
                  <em>${p.read}/${p.total}</em>
                </span>
              </a>`;
            }).join('')}
          </div>
        </section>`;
      }).join('')}
    </div>`;
}

/* ---------------- one book ---------------- */

function renderBook(mount, b) {
  const rerender = () => renderBook(mount, b);
  const p = bible.bookProgress(b.id);
  const psalms = b.id === 'psa';

  mount.innerHTML = `
    <div class="screen bible">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible-books" aria-label="Back">${icon('back')}</button>
        <h1>${escapeHtml(b.name)}</h1>
        <a class="icon-btn" href="#/bible/book?id=${b.id}" aria-label="About this book">${icon('help')}</a>
      </header>

      <div class="today bible-today">
        <div class="today-left">
          <h2>${p.read} of ${p.total} ${psalms ? 'psalms' : 'chapters'}</h2>
          <p class="muted small">${b.also ? `${escapeHtml(b.also)} · ` : ''}${b.chapters.reduce((a, c) => a + c, 0)} verses</p>
        </div>
      </div>

      <a class="notice action" href="#/bible/book?id=${b.id}">
        ${icon('help', 16)} Before you read: what ${escapeHtml(b.name)} is and what to watch for.
      </a>

      <section class="card">
        <div class="h-row">${icon('book', 16)}<h2>${psalms ? 'Psalms' : 'Chapters'}</h2>
          <span class="pill ghost">tap to mark read</span></div>
        <div class="ch-grid">
          ${b.chapters.map((verses, i) => {
            const n = i + 1;
            const read = bible.chapterRead(b.id, n);
            return `<a class="ch ${read ? 'on' : ''}" href="#/bible/reader?book=${b.id}&ch=${n}"
              title="${psalms ? 'Psalm' : 'Chapter'} ${n}, ${verses} verses">${n}</a>`;
          }).join('')}
        </div>
      </section>

      <div class="btn-row">
        <button class="btn ghost" id="allRead">Mark the whole book read</button>
        <button class="btn ghost danger" id="allClear">Clear</button>
      </div>
    </div>`;

  // Worth a question: marking a fifty-chapter book read is a claim about fifty days.
  mount.querySelector('#allRead').addEventListener('click', () => {
    if (!confirm(`Mark all ${b.chapters.length} chapters of ${b.name} as read?`)) return;
    for (let n = 1; n <= b.chapters.length; n++) bible.markChapter(b.id, n);
    haptic('level');
    toast(`${b.name} marked read.`);
    rerender();
  });
  mount.querySelector('#allClear').addEventListener('click', () => {
    if (!confirm(`Clear every chapter of ${b.name}? This cannot be undone.`)) return;
    for (let n = 1; n <= b.chapters.length; n++) bible.unmarkChapter(b.id, n);
    rerender();
  });
}
