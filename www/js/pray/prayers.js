// The prayer texts, Greek and English side by side.
//
// What is bundled here is the ancient core: the short pieces that open and
// close almost every Orthodox rule, and which are old enough to be nobody's
// property. The Greek is the original. The English is the traditional
// rendering that has been in common use for centuries.
//
// A full prayer book is a modern compiled translation and is somebody's
// copyright, so the app does not ship one. What it ships is the frame, plus
// `custom` slots you fill from your own book. Anything you add is stored with
// your data and appears in the slot exactly like the bundled texts.

/** @typedef {{id:string, title:{el:string,en:string}, el:string[], en:string[],
 *             repeat?:number, note?:string}} Prayer */

/* ---------------- the ancient core ---------------- */

/** @type {Record<string, Prayer>} */
export const PRAYERS = {
  sign: {
    id: 'sign',
    title: { el: 'Εἰς τὸ ὄνομα', en: 'In the name' },
    el: ['Εἰς τὸ ὄνομα τοῦ Πατρὸς καὶ τοῦ Υἱοῦ καὶ τοῦ Ἁγίου Πνεύματος. Ἀμήν.'],
    en: ['In the name of the Father, and of the Son, and of the Holy Spirit. Amen.'],
    note: 'Make the sign of the cross.',
  },

  glory: {
    id: 'glory',
    title: { el: 'Δόξα σοι', en: 'Glory to Thee' },
    el: ['Δόξα σοι, ὁ Θεὸς ἡμῶν, δόξα σοι.'],
    en: ['Glory to Thee, our God, glory to Thee.'],
  },

  trisagion: {
    id: 'trisagion',
    title: { el: 'Τρισάγιον', en: 'Trisagion' },
    el: ['Ἅγιος ὁ Θεός, Ἅγιος Ἰσχυρός, Ἅγιος Ἀθάνατος, ἐλέησον ἡμᾶς.'],
    en: ['Holy God, Holy Mighty, Holy Immortal, have mercy on us.'],
    repeat: 3,
  },

  trinity: {
    id: 'trinity',
    title: { el: 'Παναγία Τριάς', en: 'All-holy Trinity' },
    el: [
      'Παναγία Τριάς, ἐλέησον ἡμᾶς.',
      'Κύριε, ἱλάσθητι ταῖς ἁμαρτίαις ἡμῶν.',
      'Δέσποτα, συγχώρησον τὰς ἀνομίας ἡμῖν.',
      'Ἅγιε, ἐπίσκεψαι καὶ ἴασαι τὰς ἀσθενείας ἡμῶν, ἕνεκεν τοῦ ὀνόματός σου.',
    ],
    en: [
      'All-holy Trinity, have mercy on us.',
      'Lord, cleanse us from our sins.',
      'Master, pardon our transgressions.',
      'Holy One, visit and heal our infirmities, for Thy name’s sake.',
    ],
  },

  kyrie: {
    id: 'kyrie',
    title: { el: 'Κύριε ἐλέησον', en: 'Lord, have mercy' },
    el: ['Κύριε, ἐλέησον.'],
    en: ['Lord, have mercy.'],
    repeat: 3,
  },

  doxology: {
    id: 'doxology',
    title: { el: 'Δόξα Πατρί', en: 'Glory be' },
    el: [
      'Δόξα Πατρὶ καὶ Υἱῷ καὶ Ἁγίῳ Πνεύματι,',
      'καὶ νῦν καὶ ἀεὶ καὶ εἰς τοὺς αἰῶνας τῶν αἰώνων. Ἀμήν.',
    ],
    en: [
      'Glory to the Father, and to the Son, and to the Holy Spirit,',
      'now and ever, and unto ages of ages. Amen.',
    ],
  },

  lordsPrayer: {
    id: 'lordsPrayer',
    title: { el: 'Πάτερ ἡμῶν', en: 'The Lord’s Prayer' },
    el: [
      'Πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς, ἁγιασθήτω τὸ ὄνομά σου.',
      'Ἐλθέτω ἡ βασιλεία σου. Γενηθήτω τὸ θέλημά σου, ὡς ἐν οὐρανῷ καὶ ἐπὶ τῆς γῆς.',
      'Τὸν ἄρτον ἡμῶν τὸν ἐπιούσιον δὸς ἡμῖν σήμερον.',
      'Καὶ ἄφες ἡμῖν τὰ ὀφειλήματα ἡμῶν, ὡς καὶ ἡμεῖς ἀφίεμεν τοῖς ὀφειλέταις ἡμῶν.',
      'Καὶ μὴ εἰσενέγκῃς ἡμᾶς εἰς πειρασμόν, ἀλλὰ ῥῦσαι ἡμᾶς ἀπὸ τοῦ πονηροῦ. Ἀμήν.',
    ],
    en: [
      'Our Father, who art in heaven, hallowed be Thy name.',
      'Thy kingdom come. Thy will be done, on earth as it is in heaven.',
      'Give us this day our daily bread.',
      'And forgive us our trespasses, as we forgive those who trespass against us.',
      'And lead us not into temptation, but deliver us from evil. Amen.',
    ],
  },

  heavenlyKing: {
    id: 'heavenlyKing',
    title: { el: 'Βασιλεῦ Οὐράνιε', en: 'Heavenly King' },
    el: [
      'Βασιλεῦ Οὐράνιε, Παράκλητε, τὸ Πνεῦμα τῆς ἀληθείας,',
      'ὁ πανταχοῦ παρὼν καὶ τὰ πάντα πληρῶν,',
      'ὁ θησαυρὸς τῶν ἀγαθῶν καὶ ζωῆς χορηγός,',
      'ἐλθὲ καὶ σκήνωσον ἐν ἡμῖν καὶ καθάρισον ἡμᾶς ἀπὸ πάσης κηλῖδος,',
      'καὶ σῶσον, Ἀγαθέ, τὰς ψυχὰς ἡμῶν.',
    ],
    en: [
      'Heavenly King, Comforter, Spirit of truth,',
      'who art everywhere present and fillest all things,',
      'treasury of good things and giver of life,',
      'come and dwell in us, and cleanse us from every stain,',
      'and save our souls, O Good One.',
    ],
    note: 'Omitted between Pascha and Pentecost.',
  },

  theotokion: {
    id: 'theotokion',
    title: { el: 'Ἄξιόν ἐστιν', en: 'It is truly meet' },
    el: [
      'Ἄξιόν ἐστιν ὡς ἀληθῶς μακαρίζειν σε τὴν Θεοτόκον,',
      'τὴν ἀειμακάριστον καὶ παναμώμητον καὶ μητέρα τοῦ Θεοῦ ἡμῶν.',
      'Τὴν τιμιωτέραν τῶν Χερουβεὶμ καὶ ἐνδοξοτέραν ἀσυγκρίτως τῶν Σεραφείμ,',
      'τὴν ἀδιαφθόρως Θεὸν Λόγον τεκοῦσαν, τὴν ὄντως Θεοτόκον, σὲ μεγαλύνομεν.',
    ],
    en: [
      'It is truly meet to bless thee, the Theotokos,',
      'ever blessed and most pure, and the Mother of our God.',
      'More honourable than the Cherubim, and beyond compare more glorious than the Seraphim,',
      'who without corruption gavest birth to God the Word, true Theotokos, we magnify thee.',
    ],
  },

  jesusPrayer: {
    id: 'jesusPrayer',
    title: { el: 'Εὐχὴ τοῦ Ἰησοῦ', en: 'The Jesus Prayer' },
    el: ['Κύριε Ἰησοῦ Χριστέ, Υἱὲ τοῦ Θεοῦ, ἐλέησόν με τὸν ἁμαρτωλόν.'],
    en: ['Lord Jesus Christ, Son of God, have mercy on me, a sinner.'],
    repeat: 12,
    note: 'Slowly, with the breath.',
  },

  dismissal: {
    id: 'dismissal',
    title: { el: 'Ἀπόλυσις', en: 'Dismissal' },
    el: [
      'Δι’ εὐχῶν τῶν ἁγίων Πατέρων ἡμῶν,',
      'Κύριε Ἰησοῦ Χριστέ ὁ Θεός, ἐλέησον καὶ σῶσον ἡμᾶς. Ἀμήν.',
    ],
    en: [
      'Through the prayers of our holy fathers,',
      'Lord Jesus Christ our God, have mercy on us and save us. Amen.',
    ],
  },
};

/* ---------------- the two rules ---------------- */

// A step is either a bundled prayer id, or a marker the runner expands:
//   { custom: 'morning' }  everything you have added to that slot
//   { silence: ms }        stillness, no words

export const RULES = {
  morning: {
    id: 'morning',
    label: 'Morning',
    greek: 'Πρωινή Προσευχή',
    blurb: 'Before anything else.',
    steps: [
      'sign', 'glory', 'heavenlyKing', 'trisagion', 'doxology', 'trinity',
      'lordsPrayer', 'kyrie',
      { custom: 'morning' },
      'theotokion', 'dismissal',
    ],
  },
  evening: {
    id: 'evening',
    label: 'Night',
    greek: 'Ἀποδειπνον',
    blurb: 'Last thing, before sleep.',
    steps: [
      'sign', 'glory', 'trisagion', 'doxology', 'trinity',
      'lordsPrayer', 'kyrie',
      { custom: 'evening' },
      'jesusPrayer', { silence: 60000 },
      'theotokion', 'dismissal',
    ],
  },
};

export const RULE_LIST = Object.values(RULES);
export const ruleDef = (id) => RULES[id] || RULES.morning;

/** Resolves a rule into renderable steps, folding in anything you have added. */
export function buildRule(ruleId, custom = []) {
  const rule = ruleDef(ruleId);
  const mine = custom.filter((c) => c.slot === ruleId);
  const out = [];

  for (const step of rule.steps) {
    if (typeof step === 'string') {
      const p = PRAYERS[step];
      if (p) out.push({ kind: 'prayer', prayer: p });
      continue;
    }
    if (step.silence) {
      out.push({ kind: 'silence', ms: step.silence });
      continue;
    }
    if (step.custom) {
      for (const c of mine) {
        out.push({
          kind: 'prayer',
          prayer: {
            id: c.id,
            title: { el: c.title || 'Προσευχή', en: c.title || 'Prayer' },
            el: c.el ? c.el.split('\n').filter(Boolean) : [],
            en: c.en ? c.en.split('\n').filter(Boolean) : [],
            own: true,
          },
        });
      }
    }
  }
  return out;
}

/** Rough length, used to set expectations before you start. */
export function ruleMinutes(ruleId, custom = []) {
  const steps = buildRule(ruleId, custom);
  const ms = steps.reduce((a, s) => {
    if (s.kind === 'silence') return a + s.ms;
    const lines = Math.max(s.prayer.en.length, s.prayer.el.length);
    return a + lines * 4200 * (s.prayer.repeat || 1);
  }, 0);
  return Math.max(1, Math.round(ms / 60000));
}
