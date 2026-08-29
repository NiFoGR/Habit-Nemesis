// Parses a plain-text OSB export into chapters and verses. Used by
// tools/extract-bible-text.mjs, not by the app.
//
// Two faults in the export have to be undone:
//
//   Letter spacing. Kerning after m, v, w, y or a lone letter becomes a space:
//   "B lessed is the m an", "com m andm ents". Repaired by DP over the whole
//   run, because a four-way merge has intermediate steps that are not words.
//
//   Drop caps. The words beside the cap are emitted as their own line, out of
//   order, and sometimes interleaved with the line below. Put back in reading
//   order, or verse 1 of all 1,344 chapters is missing.
//
// About a fifth of chapters still open roughly. An unrecoverable verse is
// marked rather than skipped.

import { BOOKS } from '../../www/js/bible/canon.js';

/** The whole book. `onProgress(fraction)` runs on the main thread. */
export function parseBible(raw, onProgress = () => {}) {
  const lines = String(raw).split('\n').map((l) => l.replace(/\f/g, ''));

  const CAUSES=new Set(['m','v','w','y']);
  // Drop caps are handled at assembly: a lone capital mid-line is more often a
  // real word ("O my God") than a cap, and merging those gave "omy".
  // A lone letter is a fragment too. "a", "I" and "O" are the only exceptions.
  const causal=a=>CAUSES.has(a.slice(-1)) || (a.length===1 && !/[aAiIoO]/.test(a));

  // The vocabulary is learned where the artefact cannot reach, or the broken
  // forms teach the repairer its own mistakes: "judgm" occurs 158 times.
  // Only tokens sitting before punctuation or a capital are counted, because a
  // fragment is only ever created before another lowercase word.
  // Selecting by region fails: the Beatitudes are poetry inside a clean gospel.
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

  // That skew leaves function words scoring nothing, which is fine for joining
  // and useless for splitting, so splitting keeps its own count of every token.
  const allVocab=new Map();
  let allTotal=0;
  for (const l of lines){
    for (const w of l.toLowerCase().matchAll(/[a-z]{1,}/g)){ allVocab.set(w[0],(allVocab.get(w[0])||0)+1); allTotal++; }
  }
  const anyFreq=w=>allVocab.get(String(w).toLowerCase())||0;

  // Damage is positive evidence: a fragment no English word ends in. Gating on
  // the joined form being known fails for words that only occur in these books,
  // which is how "discernm ent" survived.
  const known=w=>freq(w)>=20;
  function damaged(line){
    // A lone letter against a lowercase word is the plainest evidence: "m ourn",
    // "T he". Scanning only tokens of two letters or more missed all of them.
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

  // Log-probability, no per-piece bonus: a bonus pays for splitting, and two
  // mediocre pieces must never beat one good word. Unknown pieces are penalised
  // by length.
  const score=p=>{
    const f=freq(p);
    if (f>0) return Math.log(f/total);
    return Math.log(1/(total*Math.pow(12,Math.min(p.length,12))));
  };

  const MAX_MERGE=6;

  /** Re-segments a line by DP, merging only across causal boundaries. */
  function repairLine(line){
    const parts=line.split(' ');
    // Word tokens only; punctuation and numbers anchor the run.
    const n=parts.length;
    const best=new Array(n+1).fill(-Infinity);
    const from=new Array(n+1).fill(-1);
    best[0]=0;
    for (let i=0;i<n;i++){
      if (best[i]===-Infinity) continue;
      for (let k=1;k<=MAX_MERGE && i+k<=n;k++){
        const toks=parts.slice(i,i+k);
        // merge only where every internal boundary is causal and both sides are letters
        let ok=true;
        for (let j=0;j<toks.length-1;j++){
          // The right half may carry the punctuation that ended the word, which is why
          // "heav en." went unrepaired while "heav en" did not.
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

  /** Splits a run that arrived with no spaces at all: a drop cap spanning two
   *  printed lines concatenates its fragments, so Genesis opens
   *  "Inandthedarkness". Only runs that are not themselves a word. */
  function unjam(token, min=12){
    if (token.length < min || anyFreq(token) > 40) return null;
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
    // two pieces or more, every piece a real word, or it is not a fix
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

  /** Strips the introduction: title to first verse, study material not scripture. */
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
     *  Two shapes: usually the cap line holds the two or three words beside the
     *  cap and belongs in front of the line above; where the cap sits on a full
     *  text line, the line above simply precedes it. Length separates them. */
  const OPENER=/^(In|It|And|Thus|Now|So|After|When|Behold|But|Woe|Hear|Take)(?=[a-z])/;
  /** What is left after the opener. Short runs go straight to the splitter:
     *  unjamLine only looks at twelve letters or more and left "kingcame" whole. */
  function splitTail(tail){
    // Punctuation is already a boundary the splitter cannot use: it reads letters.
    const byPunct=tail.split(/(?<=[,.;:])(?=[A-Za-z])/).filter(Boolean);
    if(byPunct.length>1) return byPunct;
    const parts=unjam(tail.toLowerCase(), 6);
    return parts && parts.length>1 ? parts : [tail];
  }

  function peelOpener(rest){
    const cap=rest.match(/^([A-Z][a-z]+)([A-Z][a-z].*)$/);
    if(cap) return [cap[1], ...splitTail(cap[2])];
    // "Ithe..." is "I" woven with "the", not "It" with "he". Both parse, but the
    // epistles open in the first person and "It say then" reads as though right.
    if(/^Ithe[a-z]/.test(rest)){
      const parts=splitTail(rest.slice(1));
      if(parts.length>1) return ['I', ...parts];
    }
    const m=rest.match(OPENER);
    if(!m) return [];
    const tail=rest.slice(m[1].length);
    if(tail.length<4) return [];
    return [m[1], ...splitTail(tail)];
  }

  function weave(rest, prev){
    if(/\s/.test(rest)) return `${rest} ${prev}`;
    let words=unjamLine(rest).split(/\s+/).filter(Boolean);
    // Two pieces is what a mis-split of one real word looks like, so a weave needs
    // at least three.
    if(words.length<3) words=[];
    // Only a run long enough to be two fragments is worth peeling.
    if(!words.length && rest.length>=10) words=peelOpener(rest);
    if(words.length<2) return `${rest} ${prev}`;
    const head=words.filter((_,k)=>k%2===0).join(' ');
    const tail=words.filter((_,k)=>k%2===1).join(' ');
    return tail ? `${head} ${prev} ${tail}` : `${head} ${prev}`;
  }

  function reflowChapterOpenings(body, chapterNumbers){
    const out=body.slice();
    const wanted=new Set(chapterNumbers);
    const seen=new Set();
    // Study articles sit between verses and their numbered lines look exactly like
    // a chapter opening: one claimed Genesis 4 and cost its first verse. An article
    // runs from its heading until a verse marker resumes.
    let inArticle=false;
    for(let i=1;i<out.length;i++){
      if(isArticleHead(out[i])) { inArticle=true; continue; }
      if(inArticle && /(?<![0-9:.–—-])\d{1,3}[A-Za-z“‘]/.test(out[i])) inArticle=false;
      if(inArticle) continue;
      const m=out[i].match(/^(\d{1,3})[ \t]+(\S.*)$/);
      if(!m) continue;
      const n=+m[1];
      if(!wanted.has(n) || seen.has(n)) continue;
      const rest=m[2].trim();
      // a verse marker glued to a word is not a chapter opening
      if(/^\d/.test(rest)) continue;
      seen.add(n);
      // The cap belongs in front of the nearest line with text, not always i-1: a
      // page break between them left the chapter with no verse-1 marker, and the
      // synthesiser then emptied the previous chapter's last verse.
      let p=i-1;
      while(p>0 && !out[p].trim()) p--;
      let prev=out[p];
      // Only skip a blank when what is behind it is really this verse running on. A
      // page number and a heading look the same and cost Genesis 11 three verses, so
      // the candidate has to look like a sentence still running.
      if(p<i-1){
        const t=prev.trim();
        const runOn=/\d[A-Za-z]/.test(prev) || (/[^.!?”"]\s*$/.test(prev) && t.split(/\s+/).length>8);
        if(!t || /^\d{1,4}$/.test(t) || !runOn) prev='';
      }
      if(prev) out[p]='';
      out[i] = rest.length<=40 ? weave(rest, prev) : `${prev} ${rest}`;
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

    // Two shapes: glued to the next word in prose ("2The earth was"), alone on its
    // own line in poetry. Matching only the glued form found nothing in the Psalms.
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

    // Where the cap took an unrecognised shape, verse 1 is recoverable by position:
    // whatever lies between the previous chapter and this chapter's verse 2.
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
                     // A digit welded to a word is reflow debris: "In2 the beginning".
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

/** Is this the right book, before parsing it? */
export function looksLikeOsb(raw) {
  const head = String(raw).slice(0, 20000);
  return /Orthodox Study Bible/i.test(head) || /Verses in Genesis Chapter/i.test(raw.slice(0, 200000));
}
