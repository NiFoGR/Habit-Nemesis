// The reader. One chapter on screen, Genesis 1 through to Revelation 22.
//
// There is no plan and no daily portion. You open it where you left off and
// you keep going, which is how anyone actually reads a book, and the only
// navigation that matters is next and previous. Reaching the end of a chapter
// marks it read, so the record builds itself out of reading rather than out of
// remembering to tick something.

import * as store from '../store.js';
import * as bible from './program.js';
import * as text from './text.js';
import { CONTEXT } from './context.js';
import { escapeHtml, haptic } from '../ui.js';
import { icon } from '../icons.js';

export async function renderReader(mount, { book, ch }) {
  const b = bible.bookById(book) || bible.bookById(bible.position().book) || bible.BOOKS[0];
  const n = Math.min(Math.max(1, Number(ch) || bible.position().ch || 1), b.chapters.length);
  const large = store.get().bible.settings.largeText;
  const psalms = b.id === 'psa';
  const title = psalms ? `Psalm ${n}` : `${b.name} ${n}`;

  bible.setPosition(b.id, n);

  mount.innerHTML = `
    <div class="screen bible reader ${large ? 'large' : ''}">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible" aria-label="Back">${icon('back')}</button>
        <h1>${escapeHtml(title)}</h1>
        <a class="icon-btn" href="#/bible/books" aria-label="All books">${icon('book')}</a>
      </header>
      <div id="chapterBody"><p class="muted small">Loading…</p></div>
    </div>`;

  const body = mount.querySelector('#chapterBody');
  const [verses, notes] = await Promise.all([
    text.chapter(b.id, n, b.chapters[n - 1]),
    text.notesFor(b.id),
  ]);

  const prev = bible.previousChapter(b.id, n);
  const next = bible.nextChapter(b.id, n);
  const read = bible.chapterRead(b.id, n);
  const c = CONTEXT[b.id];

  body.innerHTML = `
    ${n === 1 && c ? `<a class="notice action" href="#/bible/book?id=${b.id}">
      ${icon('help', 16)} Before you read: what ${escapeHtml(b.name)} is and what to watch for.
    </a>` : ''}

    <div class="verses">
      ${verses.map((v) => {
        if (v.missing) {
          return `<p class="verse gap"><b>${v.n}</b><i>Not separated out by the parser. Its text is usually folded into the verse above; check your Bible.</i></p>`;
        }
        // A noted verse gets a marked number and nothing else, so the page
        // still reads as scripture. The commentary is one tap away rather
        // than wedged between every verse, which is the printed edition's own
        // arrangement: notes at the foot, not in the column.
        const note = text.noteAt(notes, n, v.n);
        if (!note) return `<p class="verse"><b>${v.n}</b>${escapeHtml(v.text)}</p>`;
        const id = `n${n}-${v.n}`;
        const ref = `${n}:${v.n}${note.span ? note.span : ''}`;
        return `<p class="verse noted">
            <b class="vnum" role="button" tabindex="0" aria-expanded="false" aria-controls="${id}"
               data-note="${id}" title="Study note on ${escapeHtml(ref)}">${v.n}</b>${escapeHtml(v.text)}
          </p>
          <aside class="vnote" id="${id}" hidden>
            <span class="vnote-ref">${escapeHtml(ref)}</span>${escapeHtml(note.text)}
          </aside>`;
      }).join('')}
    </div>

    <button class="btn ${read ? 'ghost' : 'primary'} wide" id="markRead">
      ${read ? `${icon('check', 16)} Read` : 'Mark as read'}
    </button>

    <nav class="chapter-nav">
      ${prev ? `<a class="btn ghost" href="#/bible/reader?book=${prev.book}&ch=${prev.ch}">${icon('back', 16)} ${escapeHtml(bible.refName(`${prev.book}:${prev.ch}`))}</a>` : '<span></span>'}
      ${next ? `<a class="btn primary" href="#/bible/reader?book=${next.book}&ch=${next.ch}">${escapeHtml(bible.refName(`${next.book}:${next.ch}`))} ${icon('play', 16)}</a>` : '<span></span>'}
    </nav>`;

  // One listener on the container rather than one per verse: a long chapter
  // can carry a hundred noted verses.
  body.addEventListener('click', (e) => {
    const num = e.target.closest('[data-note]');
    if (!num) return;
    toggleNote(num);
  });
  body.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const num = e.target.closest('[data-note]');
    if (!num) return;
    e.preventDefault();
    toggleNote(num);
  });
  function toggleNote(num) {
    const panel = body.querySelector('#' + CSS.escape(num.dataset.note));
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    num.setAttribute('aria-expanded', String(open));
    num.classList.toggle('open', open);
    haptic('tick');
  }

  const btn = body.querySelector('#markRead');
  btn.addEventListener('click', () => {
    if (bible.chapterRead(b.id, n)) bible.unmarkChapter(b.id, n);
    else bible.markChapter(b.id, n);
    haptic('tick');
    renderReader(mount, { book: b.id, ch: n });
  });

  // Reaching the bottom is the honest signal that a chapter was read, so it
  // marks itself. Anything already marked is left alone.
  if (!read) {
    const sentinel = body.querySelector('.chapter-nav');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (bible.chapterRead(b.id, n)) return;
      bible.markChapter(b.id, n);
      btn.className = 'btn ghost wide';
      btn.innerHTML = `${icon('check', 16)} Read`;
    }, { threshold: 0.9 });
    if (sentinel) io.observe(sentinel);
  }
}

