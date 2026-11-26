(() => {
  const root = document.getElementById('puzzle-game');
  if (!root) return;
  const get = id => root.querySelector(`#puzzle-${id}`), copy = get('copy').dataset;
  const board = get('board'), tray = get('tray'), status = get('status');
  const initial = [[[0,0],[1,0],[0,1],[1,1]],[[0,0]],[[0,0]],[[0,0],[0,1],[0,2]]];
  const starts = [[0,0],[0,2],[1,2],[2,0]];
  const solution = [[[0,0],[1,0],[0,1],[1,1]],[[0,2]],[[2,0]],[[2,1],[1,2],[2,2]]];
  const names = [copy.pieceOne,copy.pieceTwo,copy.pieceThree,copy.pieceFinal];
  let pieces = [], selected = null, changed = false, wide = false, hint = false, playing = false;
  const cells = [], buttons = [];
  const picture = '<g fill="none" stroke="currentColor" stroke-width="1.1"><path d="M150 20 260 85 260 215 150 280 40 215 40 85Z M150 20 150 280 M40 85 260 215 M260 85 40 215 M40 85 260 85 150 280 40 85 M40 215 260 215 150 20 40 215 M40 85 150 150 260 85 M40 215 150 150 260 215"/><circle cx="150" cy="150" r="66"/><path d="M150 84 207 117 207 183 150 216 93 183 93 117Z M150 84 150 216 M93 117 207 183 M207 117 93 183"/></g>';
  for (let y=0;y<3;y++) for(let x=0;x<3;x++) {
    const button=document.createElement('button');button.type='button';button.className='puzzle-cell';button.id=`puzzle-cell-${x}-${y}`;
    button.addEventListener('click',()=>place(x,y));board.append(button);cells.push(button);
  }
  for(let i=0;i<4;i++) {
    const button=document.createElement('button');button.type='button';button.className='puzzle-piece';button.id=`puzzle-piece-${i}`;
    button.addEventListener('click',()=>select(i));tray.append(button);buttons.push(button);
  }
  function say(text){status.textContent=text;}
  function shapeSVG(shape) {
    return '<svg viewBox="0 0 66 66" aria-hidden="true">'+shape.map(([x,y])=>`<rect x="${x*20+3}" y="${y*20+3}" width="19" height="19" rx="1"/><path fill="none" stroke-width=".6" d="M${x*20+3} ${y*20+3}l19 19m0-19-19 19"/>`).join('')+`<circle cx="${shape[0][0]*20+8}" cy="${shape[0][1]*20+8}" r="2.2" fill="var(--text)" stroke="none"/></svg>`;
  }
  function occupied(except=null) {
    const result=new Map();pieces.forEach((p,i)=>{if(i!==except&&p.pos)p.shape.forEach(([x,y])=>result.set(`${x+p.pos[0]},${y+p.pos[1]}`,i));});return result;
  }
  function render() {
    const filled=occupied(), count=pieces.filter(p=>p.pos).length;
    const guide=selected!==null&&!changed?starts[selected]:null;
    cells.forEach((cell,index)=>{
      const x=index%3,y=Math.floor(index/3),owner=filled.get(`${x},${y}`);
      const has=owner!==undefined;
      if(has)cell.dataset.piece=owner;else delete cell.dataset.piece;
      cell.classList.toggle('puzzle-selected',has&&owner===selected);
      cell.classList.toggle('puzzle-guide',!!guide&&x===guide[0]&&y===guide[1]);
      cell.classList.toggle('puzzle-hint',hint&&solution.some((shape,i)=>shape.some(([sx,sy])=>sx===x&&sy===y)&&pieces[i].pos===null));
      // A labelled cell remains a native button for both keyboard and touch input.
      cell.setAttribute('aria-label',`Row ${y+1}, column ${x+1}: ${has?names[owner]:'empty'}${guide&&x===guide[0]&&y===guide[1]?'; outlined starting square':''}`);
      cell.style.color='var(--accent)';
      cell.innerHTML=has?`<svg viewBox="${x*100} ${y*100} 100 100" aria-hidden="true">${picture}</svg>`:'';
      if(hint){const target=solution.findIndex(shape=>shape.some(([sx,sy])=>sx===x&&sy===y));cell.classList.add('puzzle-hint');cell.innerHTML+=`<span class="puzzle-hint-number" aria-hidden="true">${target+1}</span>`;}
    });
    buttons.forEach((button,i)=>{
      button.disabled=i===3&&!changed&&count<3;
      button.setAttribute('aria-pressed',String(selected===i));
      button.setAttribute('aria-label',`${names[i]}${pieces[i].pos?', on the board':', in the tray'}${i===3&&changed?', new L shape':''}`);
      button.innerHTML=shapeSVG(pieces[i].shape);
      const label=document.createElement('span');label.textContent=names[i];
      const location=document.createElement('small');location.textContent=pieces[i].pos?'On the board':'In the tray';
      button.append(label,location);
    });
    get('rotate').disabled=selected===null||pieces[selected].shape.length===1||(!changed&&selected!==3);
    get('perspective').setAttribute('aria-pressed',String(wide));
    get('perspective').textContent=wide?copy.closeView:copy.stepBack;
    get('perspective-copy').hidden=!wide;
    root.dataset.wide=String(wide);get('hint').hidden=!changed;
  }
  function select(i) {
    if(!playing||buttons[i].disabled)return;
    selected=selected===i?null:i;
    say(selected===null?copy.setup:copy.place);render();
  }
  function place(x,y) {
    if(!playing)return;
    if(selected===null) {
      const owner=occupied().get(`${x},${y}`);
      if(owner!==undefined){selected=owner;say(copy.place);render();}return;
    }
    if(!changed) {
      const expected=starts[selected];
      if(x!==expected[0]||y!==expected[1]){say(copy.guided);return;}
      if(selected===3) {
        changed=true;pieces[3].shape=[[0,0],[1,0],[1,1]];
        get('stage').classList.add('puzzle-shift');say(copy.changed);render();return;
      }
    }
    const p=pieces[selected], filled=occupied(selected);
    const offset=[x-p.shape[0][0],y-p.shape[0][1]];
    const candidate=p.shape.map(([sx,sy])=>[sx+offset[0],sy+offset[1]]);
    if(candidate.some(([cx,cy])=>cx<0||cy<0||cx>2||cy>2||filled.has(`${cx},${cy}`))){say(copy.blocked);return;}
    p.pos=offset;selected=null;render();
    if(occupied().size===9){end(true);return;}
    say(!changed&&pieces.slice(0,3).every(p=>p.pos)?copy.ready:copy.placed);
  }
  function rotate() {
    if(selected===null||get('rotate').disabled)return;
    const p=pieces[selected], rotated=p.shape.map(([x,y])=>[-y,x]);
    const minX=Math.min(...rotated.map(p=>p[0])),minY=Math.min(...rotated.map(p=>p[1]));
    // A rotated piece goes back to the tray, retaining every other placed piece.
    p.shape=rotated.map(([x,y])=>[x-minX,y-minY]);p.pos=null;say(copy.place);render();
  }
  function perspective() {
    if(!playing)return;wide=!wide;selected=null;render();say(wide?copy.perspective:changed?copy.changed:copy.setup);
  }
  function begin() {
    pieces=initial.map(shape=>({shape:shape.map(cell=>[...cell]),pos:null}));
    selected=null;changed=false;wide=false;hint=false;playing=true;
    cells.forEach(cell=>cell.disabled=false);
    root.dataset.state='playing';get('start').hidden=true;get('play').hidden=false;get('reflection').hidden=true;
    get('stage').classList.remove('puzzle-shift');say(copy.setup);render();buttons[0].focus();
  }
  function end(solved) {
    playing=false;root.dataset.state=solved?'solved':'done';get('play').hidden=!solved;get('reflection').hidden=false;
    if(solved){say(copy.success);cells.forEach(cell=>cell.disabled=true);}
    get('outcome').textContent=solved?copy.success:copy.unfinished;get('reflection-title').focus();
  }
  get('start').addEventListener('click',begin);get('again').addEventListener('click',begin);
  get('rotate').addEventListener('click',rotate);get('perspective').addEventListener('click',perspective);
  get('finish').addEventListener('click',()=>end(false));
  get('hint').addEventListener('click',()=>{hint=true;wide=true;selected=null;render();say(copy.hintText);});
  document.addEventListener('keydown',event=>{
    if(!playing||event.code!=='Space'||event.repeat)return;
    if(event.target.closest('dialog,input,textarea,select,[contenteditable="true"]'))return;
    if(event.target.closest('button,a')&&!event.target.closest('.puzzle-cell,.puzzle-piece'))return;
    event.preventDefault();perspective();
  });
  get('start').hidden=false;
})();
