(() => {
  const root = document.querySelector('[data-gacha]');
  if (!root) return;
  const copy = root.querySelector('.gacha-copy');
  const facts = [...copy.children].map(el => el.textContent.trim()).filter(Boolean);
  if (!facts.length) return;
  const coin = root.querySelector('.gacha-coin');
  const dial = root.querySelector('.gacha-dial');
  const capsule = root.querySelector('.gacha-capsule');
  const scene = root.querySelector('.gacha-scene');
  const status = root.querySelector('.gacha-status');
  const output = root.querySelector('.gacha-fact');
  const reveal = root.querySelector('.gacha-reveal');
  const steps = [...root.querySelectorAll('.gacha-steps span')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let state, bag = [], seen = new Set(), drag = null, suppressClick = false;
  const animations = new Set();
  const animate = async (el, frames, duration, delay = 0) => {
    if (reduce.matches || !el.animate) return;
    const a = el.animate(frames, { duration, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'none' });
    animations.add(a);
    try { await a.finished; } catch {} finally { animations.delete(a); }
  };
  function setState(next) {
    state = next; root.dataset.state = next;
    coin.disabled = next !== 'coin'; dial.disabled = next !== 'dial'; capsule.disabled = next !== 'capsule';
    steps.forEach((s, i) => s.classList.toggle('is-active', ['coin','dial','capsule'][i] === next));
    status.textContent = copy.dataset[next === 'coin' ? 'insert' : next === 'dial' ? 'turn' : next === 'capsule' ? 'open' : 'empty'] || '';
    if (['inserting','dropping','revealing','revealed'].includes(next)) status.textContent = '';
  }
  function updateCount() { root.querySelector('.gacha-count').textContent = `${seen.size} / ${facts.length} ${copy.dataset.count}`; }
  function takeFact() {
    if (!bag.length) { bag = facts.map((_,i) => i); for (let i=bag.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; } seen.clear(); }
    const i=bag.pop(); seen.add(i); updateCount(); return facts[i];
  }
  async function insert() {
    if (state !== 'coin') return;
    output.textContent='';
    root.classList.remove('is-aiming');
    setState('inserting');
    const box=scene.getBoundingClientRect(), c=coin.getBoundingClientRect();
    const start=coin.style.transform || 'translate(0,0)';
    const dx=box.width*.301-(coin.offsetLeft+c.width/2), dy=box.height*.63-(coin.offsetTop+c.height/2);
    await animate(coin,[{transform:start+' scale(1)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.2)`,opacity:0}],450);
    coin.hidden=true; coin.style.transform=''; setState('dial'); dial.focus({preventScroll:true});
  }
  async function turn() {
    if (state !== 'dial') return;
    setState('dropping');
    const balls=[...root.querySelectorAll('.gacha-balls > g')];
    await Promise.all([animate(dial,[{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],650), ...balls.map((b,i)=>animate(b,[{transform:'translate(0,0)'},{transform:`translate(${(i%2 ? 1:-1)*6}px,-${8+i*2}px)`},{transform:'translate(0,0)'}],500,i*20))]);
    capsule.hidden=false;
    await animate(capsule,[{transform:'translateY(-70px) rotate(-20deg)',opacity:0},{transform:'translateY(0) rotate(12deg)',opacity:1,offset:.65},{transform:'translateY(-8px) rotate(-5deg)',offset:.82},{transform:'translateY(0) rotate(0)'}],550);
    setState('capsule'); capsule.focus({preventScroll:true});
  }
  async function open() {
    if(state!=='capsule')return;
    setState('revealing');
    await Promise.all([...capsule.children].map((el,i)=>animate(el,[{transform:'translate(0) rotate(0)',opacity:1},{transform:`translate(${i?14:-14}px,${i?8:-12}px) rotate(${i?30:-30}deg)`,opacity:0}],350)));
    capsule.hidden=true;
    const fact=takeFact();
    // A finite upward spark, followed by a sparse randomised pixel burst.
    const launch=document.createElement('i'); launch.className='gacha-spark'; reveal.append(launch);
    await animate(launch,[{transform:`translate(-8px,${scene.clientHeight*.8+reveal.clientHeight/2}px) scale(.7)`,opacity:0},{opacity:1,offset:.2},{transform:'translate(0,0) scale(1.8)',opacity:1}],450);
    launch.remove();
    output.textContent=fact;
    const sparks=[];
    if(!reduce.matches)for(let i=0;i<14;i++) {
      const el=document.createElement('i');el.className='gacha-spark';reveal.append(el);
      const angle=2*Math.PI*i/14+Math.random()*.2, radius=35+Math.random()*55;
      sparks.push(animate(el,[{transform:'translate(0,0) scale(1)',opacity:.9},{transform:`translate(${Math.cos(angle)*radius}px,${Math.sin(angle)*radius}px) rotate(90deg) scale(.3)`,opacity:0}],550+Math.random()*250).then(()=>el.remove()));
    }
    await Promise.all([animate(output,[{opacity:0,transform:'translateY(9px) scale(.97)'},{opacity:1,transform:'none'}],350),...sparks]);
    setState('revealed');
    reset();
    await Promise.all([animate(coin,[{transform:'scale(.1)',opacity:0},{transform:'scale(1.18)',opacity:1,offset:.7},{transform:'scale(1)',opacity:1}],350), poof()]);
    coin.focus({preventScroll:true});
  }
  function poof() {
    if (reduce.matches) return Promise.resolve();
    return Promise.all(Array.from({length:8},(_,i)=>{
      const el=document.createElement('i');el.className='gacha-poof';scene.append(el);
      const a=i*Math.PI/4;
      return animate(el,[{transform:'translate(0,0) scale(1)',opacity:.8},{transform:`translate(${Math.cos(a)*25}px,${Math.sin(a)*25}px) scale(.1)`,opacity:0}],320).then(()=>el.remove());
    }));
  }
  function reset() {
    if (state && state!=='revealed')return;
    coin.hidden=false; coin.style.transform=''; capsule.hidden=true; setState('coin');
  }
  coin.addEventListener('click',()=>{if(suppressClick===coin){suppressClick=false;return;}insert();});
  dial.addEventListener('click',()=>{if(suppressClick===dial){suppressClick=false;return;}turn();});
  capsule.addEventListener('click',open);
  for(const control of [coin,dial]) {
    control.addEventListener('pointerdown',e=>{
      if(control.disabled || e.button!==0)return;
      suppressClick=false; drag={control,x:e.clientX,y:e.clientY,moved:false};control.setPointerCapture(e.pointerId);control.classList.add('is-dragging'); if(control===coin)root.classList.add('is-aiming');
    });
    control.addEventListener('pointermove',e=>{
      if(drag?.control!==control)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(dx,dy)>5)drag.moved=true;
      if(control===coin)control.style.transform=`translate(${dx}px,${dy}px)`;
      else control.style.transform=`rotate(${Math.max(-180,Math.min(360,(dx+dy)*2))}deg)`;
    });
    const finish=(e,cancel=false)=>{
      if(drag?.control!==control)return;
      const d=drag;drag=null;control.classList.remove('is-dragging');root.classList.remove('is-aiming');
      suppressClick=d.moved ? control : false;
      if(control===coin && d.moved && !cancel){
        const b=scene.getBoundingClientRect();
        if(Math.hypot(e.clientX-(b.left+b.width*.301),e.clientY-(b.top+b.height*.63))<Math.max(35,b.width*.14)){insert();return;}
      }
      control.style.transform='';
      if(control===dial && d.moved && !cancel && Math.hypot(e.clientX-d.x,e.clientY-d.y)>22)turn();
    };
    control.addEventListener('pointerup',e=>finish(e));
    control.addEventListener('pointercancel',e=>finish(e,true));
    control.addEventListener('lostpointercapture',e=>{if(drag?.control===control)finish(e,true);});
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)animations.forEach(a=>a.finish());});
  reduce.addEventListener('change',()=>{if(reduce.matches)animations.forEach(a=>a.finish());});
  root.hidden=false;updateCount();reset();
})();
