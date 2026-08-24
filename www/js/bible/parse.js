// Parses a plain-text export of The Orthodox Study Bible into chapters and
// verses, in the browser, on your own device.
//
// The app ships this parser and not the scripture. You import the copy you
// own, once, and it is stored on the phone. Nothing of the text is in this
// repository and nothing leaves the device, which is the same line the Prayer
// section draws around its prayer book.
//
// The export is not clean, and two faults have to be undone before any of it
// is readable.
//
// Letter spacing. The exporter turns the kerning after a wide glyph into a
// space, so every italic and poetic passage arrives broken: "B lessed is the
// m an", "com m andm ents", "judgm ent and salv ation". That is most of the
// Psalter. Two things make repairing it tractable rather than guesswork, and
// both are written up where they happen: the gap only ever opens after m, v,
// w or y or a lone letter, so every other space is known to be real; and a
// broken run is re-segmented by dynamic programming over the whole run, since
// "com m andm ents" needs a four-way merge whose intermediate steps are not
// words and no pairwise rule can reach it.
//
// Drop caps. Each chapter opens with one, and the exporter emits the words
// beside the cap as their own short line, out of order with the lines above
// and below. Nothing is lost, it is transposed, so the opening is put back in
// reading order. Without it verse 1 of all 1,344 chapters is missing.
//
// It is not perfect. Roughly a fifth of chapters still have a rough opening,
// and the app marks a verse it could not recover rather than quietly skipping
// it, because a Bible that silently drops a verse is worse than one that
// admits to it.

import { BOOKS } from './canon.js';

/** Parses the whole book. `onProgress(fraction)` is called as it goes, since
 *  this takes a few seconds and runs on the main thread. */
export function parseBible(raw, onProgress = () => {}) {
  const lines = String(raw).split('\n').map((l) => l.replace(/\f/g, ''));

  const CAUSES=new Set(['m','v','w','y']);
  // Drop caps are handled where chapters are assembled, not here: a lone capital
  // mid-line is far more often a real word ("O my God", "I am") than a drop cap,
  // and merging those produced "omy" and "iam".
  // A lone letter is a fragment too: the gap can open after the first glyph of
  // a word, and after a drop cap. "a", "I" and "O" are real words and are the
  // only ones excluded.
  const causal=a=>CAUSES.has(a.slice(-1)) || (a.length===1 && !/[aAiIoO]/.test(a));

  // The vocabulary has to be learned somewhere the artefact never reaches, or
  // the broken forms teach the repairer their own mistakes: counted over the
  // whole book, "judgm" occurs 158 times and "ent" 247, and a DP scoring pieces
  // independently will then happily keep "judgm ent" split.
  //
  // The damage is confined to the poetry and wisdom books, so the vocabulary is
  // built from everything outside that stretch: the OT narrative, the whole New
  // Testament, and the endnotes, which discuss the same subject matter in clean
  // prose and are far larger than what they replace.
  // A fragment is only ever created *before* another lowercase word, because the
  // gap opens mid-word. So a token that appears immediately before punctuation
  // or a capital is, by construction, a whole word. Counting only those
  // positions gives a vocabulary the artefact cannot contaminate.
  //
  // Selecting by region does not work: the Beatitudes are set as poetry inside
  // an otherwise clean gospel, so "heav" was being learned as a word from the
  // very text used to define "clean".
  const vocab=new Map();
  let total=0, cleanLines=0;
  for (const l of lines){
    cleanLines++;
    const toks=l.split(/\s+/);
    for (let i=0;i<toks.length;i++){
      const w=toks[i];
      if (!/^[A-Za-z]{2,}[^A-Za-z]*$/.test(w)) continue;
      const bare=w.replace(/[^A-Za-z]/g,'').toLowerCase();
      if (!bare) continue;
      const trailing=/[^A-Za-z]$/.test(w);            // word runs into punctuation
      const next=toks[i+1];
      const terminal = trailing || i===toks.length-1 || (next && /^[A-Z“‘"(]/.test(next));
      if (!terminal) continue;
      vocab.set(bare,(vocab.get(bare)||0)+1); total++;
    }
  }
  const freq=w=>vocab.get(String(w).toLowerCase())||0;

  // The vocabulary above deliberately only counts words in positions the
  // artefact cannot reach, which skews it against function words: "the", "in"
  // and "and" are almost never followed by punctuation or a capital, so they
  // score nothing. That is fine for joining broken words, where the causal
  // constraint does the work, and useless for splitting a jammed run, which
  // is mostly function words. So splitting gets its own count of every token.
  const allVocab=new Map();
  let allTotal=0;
  for (const l of lines){
    for (const w of l.toLowerCase().matchAll(/[a-z]{1,}/g)){ allVocab.set(w[0],(allVocab.get(w[0])||0)+1); allTotal++; }
  }
  const anyFreq=w=>allVocab.get(String(w).toLowerCase())||0;

  // A line is damaged when it contains positive evidence of the artefact: a
  // fragment that no English word ends in but the kerning gap always leaves
  // behind. Gating on the *joined* form being a known word does not work, since
  // a word that only ever occurs in these books has no clean occurrence to be
  // known from, which is how "discernm ent" and "testim onies" survived.
  const known=w=>freq(w)>=20;
  function damaged(line){
    // A lone letter sitting against a lowercase word is the plainest evidence
    // there is: "m ourn", "m y", "T he". Scanning only tokens of two letters or
    // more missed every one of them, which is why Psalm 22 still read
    // "T he Lord is m y shepherd".
    if (/(?:^|[ ("“‘])([B-HJ-NP-Zb-hj-np-z]) [a-z]/.test(line)) return true;
    for (const m of line.matchAll(/\b([A-Za-z]{2,})\b/g)){
      const t=m[1].toLowerCase();
      if (!CAUSES.has(t.slice(-1))) continue;
      if (known(t)) continue;
      // a short unknown fragment ending in a causing glyph is the tell
      if (t.length<=9) return true;
    }
    // the same tracking opens a gap before punctuation and inside references
    if (/[A-Za-z] [,.;:]/.test(line) || /\d :\d/.test(line)) return true;
    return false;
  }

  // Straight log-probability, with no per-piece bonus. A bonus pays for
  // splitting, which is exactly the wrong incentive: two mediocre pieces should
  // never beat one good word. An unknown piece is penalised by its length, so a
  // long unrecognisable fragment is worse than a short one.
  const score=p=>{
    const f=freq(p);
    if (f>0) return Math.log(f/total);
    return Math.log(1/(total*Math.pow(12,Math.min(p.length,12))));
  };

  const MAX_MERGE=6;

  /** Re-segments one line's tokens by DP, merging only across causal boundaries. */
  function repairLine(line){
    const parts=line.split(' ');
    // Only word tokens take part; punctuation and numbers anchor the run.
    const n=parts.length;
    const best=new Array(n+1).fill(-Infinity);
    const from=new Array(n+1).fill(-1);
    best[0]=0;
    for (let i=0;i<n;i++){
      if (best[i]===-Infinity) continue;
      for (let k=1;k<=MAX_MERGE && i+k<=n;k++){
        const toks=parts.slice(i,i+k);
        // a merge is only allowed when every internal boundary is causal and
        // both sides are plain letters
        let ok=true;
        for (let j=0;j<toks.length-1;j++){
          // The right half may carry the punctuation that ended the word, which
          // is why "heav en." went unrepaired while "heav en" did not.
          if (!/^[A-Za-z]+$/.test(toks[j]) || !/^[a-z]+[^A-Za-z]*$/.test(toks[j+1]) || !causal(toks[j])) { ok=false; break; }
        }
        if (!ok) break;
        const piece=toks.join('');
        const core=piece.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g,'');
        const s = k===1 ? (/^[A-Za-z]+$/.test(core)? score(core) : 0)
                        : score(core);
        if (best[i]+s>best[i+k]){ best[i+k]=best[i]+s; from[i+k]=i; }
      }
    }
    if (best[n]===-Infinity) return line;
    const out=[];
    for (let i=n;i>0;i=from[i]) out.unshift(parts.slice(from[i],i).join(''));
    return out.join(' ').replace(/ +([,.;:!?])/g,'$1').replace(/ {2,}/g,' ');
  }

  function repair(line){ return damaged(line) ? repairLine(line) : line; }

  /** Splits a run of words that arrived with no spaces at all.
   *
   *  Where a drop cap spans two printed lines, the exporter concatenates the
   *  fragments beside it with nothing between them, so Genesis opens
   *  "Inandthedarkness". The same segmentation used to join broken words puts
   *  these back apart, and it only runs on a long token that is not itself a
   *  word, so ordinary long words are never touched. */
  function unjam(token){
    if (token.length < 12 || anyFreq(token) > 40) return null;
    const n=token.length;
    const best=new Array(n+1).fill(-Infinity);
    const from=new Array(n+1).fill(-1);
    best[0]=0;
    for (let i=0;i<n;i++){
      if (best[i]===-Infinity) continue;
      for (let j=i+2;j<=Math.min(n,i+14);j++){
        const piece=token.slice(i,j);
        const f=anyFreq(piece);
        if (f<20) continue;                 // a real word, not a chance substring
        const sc=best[i]+Math.log(f/allTotal);
        if (sc>best[j]){ best[j]=sc; from[j]=i; }
      }
    }
    if (best[n]===-Infinity) return null;
    const out=[];
    for (let i=n;i>0;i=from[i]) out.unshift(token.slice(from[i],i));
    // two pieces or more, and every piece a real word, or it is not a fix
    return out.length>1 ? out : null;
  }

  function unjamLine(s){
    return s.replace(/[A-Za-z]{12,}/g,(w)=>{
      const parts=unjam(w.toLowerCase());
      if (!parts) return w;
      // keep the original capitalisation of the first letter
      const joined=parts.join(' ');
      return w[0]===w[0].toUpperCase() ? joined[0].toUpperCase()+joined.slice(1) : joined;
    });
  }





  /* ---- book boundaries, from the ebook's own navigation index ---- */
  const idxRe=/^Verses in (?:Psalm (\d+)(?:\s*\(.*\))?|(.+?) Chapter (\d+))\s*$/;
  const hits=[];
  lines.forEach((l,i)=>{
    const m=l.match(idxRe); if(!m) return;
    const book=m[1]?'Psalms':m[2]; const ch=+(m[1]||m[3]);
    let last=0;
    for(let j=i+1;j<i+40;j++){ const t=(lines[j]||'').trim();
      if(!t) continue; if(/^Back to/.test(t)) break;
      const nums=t.split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s));
      if(!nums.length) break; last=Math.max(last,...nums.map(Number)); }
    hits.push({i,book,ch,last});
  });
  const blocks=[];
  for(const h of hits){ const b=blocks[blocks.length-1];
    if(b&&b.book===h.book){ b.end=h.i; b.chapters.push(h); } else blocks.push({book:h.book,start:h.i,end:h.i,chapters:[h]}); }

  function bodyLines(bi){
    const b=blocks[bi], next=blocks[bi+1];
    let s=b.end; while(s<lines.length && !/^Back to Table of Contents/.test(lines[s])) s++;
    return lines.slice(s+1, next?next.start:lines.length);
  }

  /* ---- what counts as scripture on a line ---- */
  const ALLCAPS=/^[A-Z][A-Z0-9 ,'’\-–—:;?!().]*$/;
  const isArticleHead=l=>{ const t=l.trim();
    return t.length>3 && t.length<80 && ALLCAPS.test(t) && (t.match(/[A-Z]/g)||[]).length>=4; };

  /** Strips the book introduction: it runs from the title to just before the
   *  first verse, and is study material rather than scripture. */
  function afterIntro(body){
    let i=0;
    for(;i<body.length;i++){ if(/^Outline\s*$/.test(body[i].trim())) break; }
    if(i===body.length) return body;
    // the outline runs until a line that is not an outline entry
    for(i++;i<body.length;i++){ const t=body[i].trim();
      if(!t) continue;
      if(/^[IVXLC]+\s*\.|^[A-Z]\s*\.|^\d+\s*\./.test(t)) continue;
      break; }
    return body.slice(i);
  }

  /* ---- extraction ---- */
  /** Puts a chapter's opening back in reading order.
   *
   *  A chapter starts with a drop cap, and the exporter emits the words sitting
   *  beside that cap as their own short line, out of order with the lines above
   *  and below it. Nothing is lost, it is just transposed, so the opening is
   *  rebuilt rather than abandoned, and verse 1 of all 1,344 chapters, which is
   *  otherwise missing outright, comes back with it.
   *
   *  Two shapes occur. Usually the cap line holds only the two or three words
   *  beside the cap and they belong in front of the line above ("2 And" +
   *  "again He entered Capernaum"). Where the cap sits on a full text line, that
   *  line is already in place and the line above simply precedes it. Length
   *  separates the two reliably. */
  function reflowChapterOpenings(body, chapterNumbers){
    const out=body.slice();
    const wanted=new Set(chapterNumbers);
    const seen=new Set();
    for(let i=1;i<out.length;i++){
      const m=out[i].match(/^(\d{1,3})[ \t]+(\S.*)$/);
      if(!m) continue;
      const n=+m[1];
      if(!wanted.has(n) || seen.has(n)) continue;
      const rest=m[2].trim();
      // a verse marker glued to a word is not a chapter opening
      if(/^\d/.test(rest)) continue;
      seen.add(n);
      const prev=out[i-1];
      out[i-1]='';
      out[i] = rest.length<=40 ? `${rest} ${prev}` : `${prev} ${rest}`;
      // verse 1 has no marker of its own; the drop cap was it
      out[i] = '1' + out[i].replace(/^\s+/,'');
    }
    return out;
  }

  function extractBook(bi){
    const b=blocks[bi];
    const chapterNums=b.chapters.map(c=>c.ch);
    const body=reflowChapterOpenings(afterIntro(bodyLines(bi)), chapterNums).map(repair);
    const want=[]; for(const c of b.chapters) for(let v=1;v<=c.last;v++) want.push([c.ch,v]);

    // Verse markers come in two shapes. In prose the number is glued to the word
    // that follows it ("2The earth was"). In poetry the line breaks after the
    // number, so it sits alone on its own line, which is why matching only the
    // glued form found nothing at all in the Psalms, Proverbs or Sirach.
    const text=body.join('\n');
    const cands=[];
    for(const m of text.matchAll(/(?<![0-9:.–—-])(\d{1,3})(?=[A-Za-z“‘"'(])/g))
      cands.push({v:+m[1], at:m.index, len:m[1].length});
    for(const m of text.matchAll(/(?:^|\n)[ \t]*(\d{1,3})[ \t]*(?=\n)/g)){
      const at=m.index+m[0].indexOf(m[1]);
      cands.push({v:+m[1], at, len:m[1].length});
    }

    cands.sort((a,b)=>a.at-b.at);

    const marks=[]; let k=0;
    for(const c of cands){
      if(k>=want.length) break;
      for(let d=0; d<=3 && k+d<want.length; d++){
        if(want[k+d][1]===c.v){ marks.push({ch:want[k+d][0], v:c.v, at:c.at, len:c.len}); k=k+d+1; break; }
      }
    }

    // Where the drop cap took a shape the reflow did not recognise, verse 1 has
    // no marker of its own. It is still recoverable by position: it is whatever
    // lies between the end of the previous chapter and this chapter's verse 2.
    for(let i=0;i<marks.length;i++){
      const m=marks[i];
      if(m.v!==2) continue;
      if(marks[i-1] && marks[i-1].ch===m.ch && marks[i-1].v===1) continue;
      const prevEnd = i>0 ? marks[i-1].at+marks[i-1].len : 0;
      marks.splice(i,0,{ch:m.ch, v:1, at:prevEnd, len:0, synthesised:true});
      i++;
    }

    const chapters=new Map();
    for(let i=0;i<marks.length;i++){
      const m=marks[i], end=i+1<marks.length?marks[i+1].at:text.length;
      let raw=text.slice(m.at+m.len, end);
      // a study article starts at an ALL-CAPS heading and runs to the next verse
      const cut=raw.split('\n').findIndex(isArticleHead);
      if(cut>=0) raw=raw.split('\n').slice(0,cut).join('\n');
      const clean=unjamLine(raw.replace(/\n/g,' ').replace(/[†ω]/g,''))
                     // A digit welded to the end of a word is always debris from
                     // the reflow, never scripture: "In2 the beginning". Real
                     // numbers in the text stand as their own word.
                     .replace(/(?<=[a-z])\d+(?=[\s,.;:]|$)/g,'')
                     .replace(/\s+/g,' ').replace(/\s+([,.;:!?])/g,'$1').trim();
      if(!chapters.has(m.ch)) chapters.set(m.ch, new Map());
      chapters.get(m.ch).set(m.v, clean);
    }
    return {book:b.book, want, marks, chapters};
  }




  /* ---- assemble ---- */

  const out = {};
  let chapters = 0, verses = 0, missing = 0;
  blocks.forEach((b, i) => {
    const meta = BOOKS[i];
    if (!meta) return;
    const r = extractBook(i);
    const bookOut = {};
    for (const c of b.chapters) {
      const got = r.chapters.get(c.ch) || new Map();
      const vs = {};
      for (let v = 1; v <= c.last; v++) {
        const t = got.get(v);
        if (t) vs[v] = t; else missing++;
      }
      bookOut[c.ch] = vs;
      chapters++;
      verses += Object.keys(vs).length;
    }
    out[meta.id] = bookOut;
    onProgress((i + 1) / blocks.length);
  });

  return { books: out, stats: { books: blocks.length, chapters, verses, missing } };
}

/** A quick check that a dropped file is the right book before parsing it. */
export function looksLikeOsb(raw) {
  const head = String(raw).slice(0, 20000);
  return /Orthodox Study Bible/i.test(head) || /Verses in Genesis Chapter/i.test(raw.slice(0, 200000));
}
