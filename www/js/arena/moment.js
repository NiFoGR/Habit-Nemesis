// The three times a cup becomes an event: opening night, qualification night,
// the ceremony. Each fires once. They queue behind a result: its way out is the
// grid, and the grid sends you here.

import * as arena from './program.js';
import { escapeHtml, chime, celebrate, haptic } from '../ui.js';
import { icon } from '../icons.js';
import { cup } from './cup.js';
import { navigate, replaceWith } from '../back.js';

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

export const hasMoment = () => !!arena.arcMoment();

/* Marked seen on the way OUT, so a re-render still finds the moment and a
 * reload does not lose it. */
let showing = null;

export function leaveMoment() {
  if (showing) arena.markArcSeen(showing.arc.key, showing.kind);
  showing = null;
}

export function renderMoment(mount) {
  const m = arena.arcMoment();
  // Nothing owed: closed on this screen and the launch restored the hash.
  if (!m) return replaceWith('#/hub');
  showing = m;
  const st = m.arc;

  if (m.kind === 'open') return opening(mount, st);
  if (m.kind === 'group') return qualification(mount, st);
  return ceremony(mount, st);
}

/* ------------------- opening night ------------------- */

function opening(mount, st) {
  const g = arena.groupTable(st.arc);
  const rivals = g.table.filter((r) => !r.you);
  mount.innerHTML = `
    <div class="screen moment">
      <section class="mo-head">
        <p class="eyebrow">The cup</p>
        <h1 class="mo-title">${escapeHtml(st.arc.name)}</h1>
        <p class="mo-sub">${st.season.length} weeks. ${rivals.length + 1} of you. Three go through.</p>
      </section>

      <div class="mo-deal">
        ${g.table.length <= 1
          ? '<p class="muted small centre">Your group fills up as you play weeks. Every rival in it will be a week you actually had.</p>'
          : g.table
              .map((r, i) => `<div class="mo-card ${r.you ? 'you' : ''} ${i < 3 ? 'q' : 'nq'}" style="--i:${i}">
                <span class="mo-seed">${i + 1}</span>
                <span class="mo-who">${escapeHtml(r.name)}</span>
                <b>${pct(r.score)}</b>
              </div>`)
              .join('')}
      </div>

      <button class="btn primary big" id="go" data-back>Let's go</button>
    </div>`;
  land(mount, 'promote', 'promote');
}

/* ---------------- qualification night ---------------- */

function qualification(mount, st) {
  const through = st.rec.qualified === true;
  const g = arena.groupTable(st.arc);
  mount.innerHTML = `
    <div class="screen moment">
      <section class="mo-head ${through ? 'won' : 'lost'}">
        <p class="eyebrow">${escapeHtml(st.arc.name)} · group stage</p>
        <h1 class="mo-title">${through ? 'Through' : 'Out'}</h1>
        <p class="mo-sub">${through
          ? `You finished ${ordinal(g.place)} of ${g.table.length}. The knockout starts now.`
          : `You finished ${ordinal(g.place)} of ${g.table.length}. Top three went through.`}</p>
      </section>

      ${through
        ? `<section class="card">
            <h2>What is left</h2>
            ${['qf', 'sf', 'final']
              .map((id) => `<div class="kv"><span>${escapeHtml(arena.KNOCKOUT[id].name)}</span><b>${escapeHtml(arena.KNOCKOUT[id].who)}</b></div>`)
              .join('')}
          </section>`
        : `<section class="vault">
            <span class="vault-lock">${icon('trophy', 22)}</span>
            <b class="vault-count">${st.opensIn}</b>
            <span class="vault-unit">day${st.opensIn === 1 ? '' : 's'}</span>
            <p class="vault-label">until the <b>${escapeHtml(st.next.name)}</b></p>
          </section>`}

      <button class="btn primary big" id="go" data-back>${through ? 'Bring it' : 'Next time'}</button>
    </div>`;
  land(mount, through ? 'promote' : 'loss', through ? 'promote' : 'loss');
}

/* -------------------- the ceremony -------------------- */

function ceremony(mount, st) {
  const existing = st.rec.note;
  mount.innerHTML = `
    <div class="screen moment">
      <section class="mo-head cup" id="hero">
        <span class="mo-cup">${cup(st.arc.id, 132)}</span>
        <p class="eyebrow">Champion</p>
        <h1 class="mo-title">${escapeHtml(st.trophy)}</h1>
        <p class="mo-sub">${escapeHtml(arena.arcLabel(st.arc))}</p>
      </section>

      <section class="card note-ask" id="noteAsk">
        <h2>Engrave it</h2>
        <input type="text" id="noteText" maxlength="${arena.MAX_NOTE}" autocomplete="off"
          placeholder="Nobody gave me this." value="${escapeHtml(existing)}">
        <button class="btn" id="noteSave">${existing ? 'Change it' : 'Engrave it'}</button>
      </section>

      <button class="btn primary big" id="go" data-back>Into the Cabinet</button>
    </div>`;

  mount.querySelector('#noteSave').addEventListener('click', () => {
    const field = mount.querySelector('#noteText');
    arena.setArcNote(st.key, field.value);
    haptic('press');
    const box = mount.querySelector('#noteAsk');
    box.innerHTML = field.value.trim()
      ? `<h2>On the trophy</h2><p class="said-quote">“${escapeHtml(field.value.trim().slice(0, arena.MAX_NOTE))}”</p>`
      : '<h2>Nothing said</h2><p class="muted small">The cup speaks for itself, then.</p>';
  });

  land(mount, 'trophy', 'trophy', true);
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`;

/** Noise, sparks and the way out, in one place so the three cannot drift. */
function land(mount, sound, buzz, big = false) {
  chime(sound);
  haptic(buzz);
  const hero = mount.querySelector('.mo-head');
  if (hero && sound !== 'loss') {
    setTimeout(() => celebrate(hero, {
      count: big ? 30 : 18,
      spread: big ? 150 : 110,
      colour: big ? 'var(--warn)' : 'var(--accent)',
    }), 160);
  }
  mount.querySelector('#go').addEventListener('click', () => navigate(big ? '#/cabinet' : '#/arena'));
  window.scrollTo(0, 0);
}
