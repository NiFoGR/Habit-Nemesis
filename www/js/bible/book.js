// The pretext: one book, and what you need in your head before you open it.
//
// The same six questions for every book, in the same order, because the value
// of this screen is that it is comparable. You can read Habakkuk's and
// Colossians' and get the same six answers, which is what makes it possible to
// hold seventy-six books in one map rather than as seventy-six unrelated facts.
//
// The Gospels get two more questions, because "who was this written for" and
// "what does only this one give me" are the two things that actually
// distinguish four accounts of the same events, and no one ever says them out
// loud.

import * as store from '../store.js';
import * as bible from './program.js';
import { CONTEXT } from './context.js';
import { escapeHtml } from '../ui.js';
import { icon } from '../icons.js';

const FIELDS = [
  ['author', 'Who wrote it'],
  ['when', 'When'],
  ['place', 'Where it sits'],
  ['for', 'Who it was written for'],
  ['theme', 'What it is for'],
  ['only', 'What only this one gives you'],
  ['read', 'How to read it'],
  ['christ', 'How the Church reads it'],
];

export function renderBookContext(mount, id) {
  const b = bible.bookById(id);
  const c = b ? CONTEXT[b.id] : null;

  if (!b || !c) {
    mount.innerHTML = `
      <div class="screen bible">
        <header class="screen-head">
          <button class="icon-btn" data-back="bible-read" aria-label="Back">${icon('back')}</button>
          <h1>Not found</h1>
          <span class="icon-btn ghost"></span>
        </header>
        <p class="muted">No such book.</p>
      </div>`;
    return;
  }

  const p = bible.bookProgress(b.id);
  const large = store.get().bible.settings.largeText;
  const sectionName = bible.SECTIONS.find((s) => s.id === b.section)?.name || '';

  mount.innerHTML = `
    <div class="screen bible ${large ? 'large' : ''}">
      <header class="screen-head">
        <button class="icon-btn" data-back="bible-read" aria-label="Back">${icon('back')}</button>
        <h1>${escapeHtml(b.name)}</h1>
        <span class="icon-btn ghost"></span>
      </header>

      <div class="book-meta">
        <span class="pill ghost">${escapeHtml(sectionName)}</span>
        <span class="pill ghost">${b.chapters.length} chapter${b.chapters.length === 1 ? '' : 's'}</span>
        <span class="pill ghost">${b.chapters.reduce((a, x) => a + x, 0)} verses</span>
        ${b.also ? `<span class="pill ghost">also called ${escapeHtml(b.also)}</span>` : ''}
        ${b.deutero ? '<span class="pill ghost">deuterocanonical</span>' : ''}
      </div>

      <section class="card ctx">
        ${FIELDS.filter(([k]) => c[k]).map(([k, label]) => `
          <div class="ctx-row">
            <h3>${escapeHtml(label)}</h3>
            <p>${escapeHtml(c[k])}</p>
          </div>`).join('')}
      </section>

      <section class="card">
        <div class="h-row">${icon('route', 16)}<h2>The shape of it</h2></div>
        <ol class="outline">
          ${c.outline.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ol>
      </section>

      <section class="card">
        <div class="h-row">${icon('chart', 16)}<h2>Your progress</h2></div>
        <div class="prog-bar"><i style="width:${(p.frac * 100).toFixed(1)}%"></i></div>
        <p class="muted small">${p.read} of ${p.total} chapters read.</p>
      </section>

      <a class="btn primary big linkbtn" href="#/bible/read?book=${b.id}">
        ${icon('book', 18)}<span>${p.read ? 'Carry on' : 'Start'} ${escapeHtml(b.name)}</span>
      </a>
    </div>`;
}
