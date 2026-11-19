(() => {
  const root = document.getElementById('charge-game');
  if (!root) return;
  const get = id => root.querySelector(`#charge-${id}`);
  const copy = get('copy').dataset;
  const canvas = get('canvas'), ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = get('controls'), start = get('start'), release = get('release'), pause = get('pause'), finish = get('finish');
  const status = get('status'), fill = get('fill'), value = get('value');
  let state = 'idle', elapsed = 0, charge = 0, energy = 0, pulses = 0, longest = 0, totalWait = 0;
  let frame = 0, previous = 0, lastStatus = '', width = 600, height = 360, visualTime = 0;
  let effects = [], lastUI = 0;
  const clamp = x => Math.max(0, Math.min(1, x));
  const reward = () => Math.round(1 + 11 * clamp(charge / 6) ** 2);
  const nodes = Array.from({length: 27}, (_, i) => {
    const angle = i * 2.39996, radius = .48 + .46 * ((i * 7 % 13) / 13);
    return {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * .75};
  });
  const sphere = [];
  for (let row = 0; row <= 8; row++) for (let col = 0; col < 14; col++) {
    const phi = row * Math.PI / 8, theta = col * 2 * Math.PI / 14;
    sphere.push({x: Math.sin(phi) * Math.cos(theta), y: Math.cos(phi), z: Math.sin(phi) * Math.sin(theta)});
  }
  function setState(next) { state = next; root.dataset.state = state; }
  function announce(text) { if (text !== lastStatus) { status.textContent = text; lastStatus = text; } }
  function ui() {
    get('energy').textContent = energy;
    get('time').textContent = `${Math.ceil(Math.max(0, 60 - elapsed))} seconds`;
    fill.style.transform = `scaleX(${clamp(charge / 6)})`;
    release.disabled = state !== 'running' || charge < 1;
    pause.disabled = !['running', 'paused'].includes(state);
    finish.disabled = !['running', 'paused'].includes(state);
    pause.textContent = state === 'paused' ? copy.resume : copy.pause;
    if (state === 'running') {
      announce(charge < 1 ? copy.cooldown : charge >= 6 ? copy.full : copy.charging);
      value.textContent = `${reward()} energy available`;
    } else if (state === 'paused') announce(copy.paused);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const accent = getComputedStyle(root).getPropertyValue('--accent').trim() || '#b6a5ff';
    const q = clamp(charge / 6), cx = width / 2, cy = height / 2, scale = Math.min(width * .44, height * .56);
    ctx.strokeStyle = accent; ctx.fillStyle = accent;
    const line = (a,b,alpha,w=1) => { ctx.globalAlpha=alpha;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); };
    const network = nodes.map(p => ({x:cx+p.x*scale,y:cy+p.y*scale}));
    network.forEach((p,i) => {
      let glow = 0;
      effects.forEach(e => { const d = Math.hypot(p.x-cx,p.y-cy)/scale; glow=Math.max(glow, Math.max(0,1-Math.abs(d-e.age*.7)*8)*e.power); });
      network.forEach((other,j) => { if(j>i && Math.hypot(p.x-other.x,p.y-other.y)<scale*.48)line(p,other,.1+glow*.35); });
      ctx.globalAlpha=.3+glow*.7;ctx.beginPath();ctx.arc(p.x,p.y,1.7+glow*1.8,0,Math.PI*2);ctx.fill();
    });
    if (!reduced.matches) effects.forEach(e => {
      const radius = (e.age*.7) * scale;
      ctx.globalAlpha=Math.max(0,1-e.age/1.8)*(.25+.4*e.power);
      ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(cx,cy,radius,radius*.78,0,0,Math.PI*2);ctx.stroke();
    });
    const radius = Math.min(width*.15,62)*(1+q*.14), angle = reduced.matches? .3 : visualTime*.12;
    const projected=sphere.map(p=>{const x=p.x*Math.cos(angle)+p.z*Math.sin(angle),z=p.z*Math.cos(angle)-p.x*Math.sin(angle);return {x:cx+x*radius,y:cy+p.y*radius,depth:z};});
    if (!reduced.matches) {ctx.shadowBlur=5+q*13;ctx.shadowColor=accent;}
    projected.forEach((p,i)=>{
      const row=Math.floor(i/14),col=i%14;
      const alpha=.2+.35*(p.depth+1)/2+q*.28;
      line(p,projected[row*14+(col+1)%14],alpha,.7);
      if(row<8){line(p,projected[i+14],alpha,.7);line(p,projected[(row+1)*14+(col+1)%14],alpha*.65,.6);}
    });
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  function loop(now) {
    frame=0;
    if (state!=='running') return;
    const dt = previous ? Math.max(0,(now-previous)/1000) : 0; previous=now;
    elapsed=Math.min(60,elapsed+dt);charge+=dt;visualTime+=Math.min(dt,.1);
    effects=effects.map(e=>({...e,age:e.age+dt})).filter(e=>e.age<1.8);
    if (elapsed>=60) { end(); return; }
    if(now-lastUI>80){ui();lastUI=now;}
    draw();frame=requestAnimationFrame(loop);
  }
  function run() { previous=0; if(!frame)frame=requestAnimationFrame(loop); }
  function stop() { if(frame)cancelAnimationFrame(frame);frame=0;previous=0; }
  function begin() {
    stop();elapsed=0;charge=0;energy=0;pulses=0;longest=0;totalWait=0;effects=[];
    get('reflection').hidden=true;setState('running');ui();run();release.focus();
  }
  function fire() {
    if(state!=='running'||charge<1)return;
    energy+=reward();pulses++;longest=Math.max(longest,charge);totalWait+=charge;
    // Keep only a handful of short-lived rings; never build an unbounded effect queue.
    effects.push({age:0,power:clamp(charge/6)});effects=effects.slice(-4);
    charge=0;ui();draw();
  }
  function togglePause() {
    if(state==='running'){stop();setState('paused');effects=[];}
    else if(state==='paused'){setState('running');run();}
    ui();draw();
  }
  function end() {
    stop();setState('done');effects=[];ui();draw();
    announce('Round finished');start.textContent=copy.again;
    get('summary').textContent=pulses ? `${pulses} ${pulses === 1 ? "pulse" : "pulses"} · ${energy} energy. Average pause: ${(totalWait/pulses).toFixed(1)} seconds; longest pause before a pulse: ${longest.toFixed(1)} seconds.` : 'You chose not to release a pulse in this round. What was that experience like?';
    value.textContent='There is no pass or fail.';get('reflection').hidden=false;get('reflection-title').focus();
  }
  start.addEventListener('click',begin);release.addEventListener('click',fire);pause.addEventListener('click',togglePause);finish.addEventListener('click',end);
  document.addEventListener('keydown',event=>{
    if(event.code!=='Space'||state!=='running')return;
    const target=event.target;
    if(target.closest('dialog,input,textarea,select,[contenteditable="true"]'))return;
    // Preserve keyboard activation of every other button/link.
    if(target.closest('button,a') && target!==release)return;
    event.preventDefault();if(!event.repeat)fire();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')togglePause();});
  window.addEventListener('blur',()=>{if(state==='running')togglePause();});
  reduced.addEventListener('change',()=>{effects=[];draw();});
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  controls.hidden=false;resize();
})();
