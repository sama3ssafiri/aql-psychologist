(() => {
  const canvas = document.getElementById('aql-constellation');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,points=[],accent='#b6a5ff',frame=0,lastPaint=0;
  let origin={x:-1000,y:-1000},activated=-Infinity,mode='pointer';
  function resize(){
    width=innerWidth;height=innerHeight;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const gap=width<640?62:82;points=[];
    for(let y=25,row=0;y<height;y+=gap,row++)for(let x=25,col=0;x<width;x+=gap,col++){
      const seed=row*31+col*17;points.push({x:x+Math.sin(seed)*12,y:y+Math.cos(seed*.7)*12});
    }
    requestPaint();
  }
  function paint(now){
    frame=0;
    if(document.hidden)return;
    if(now-lastPaint<30){frame=requestAnimationFrame(paint);return;}
    lastPaint=now;
    ctx.clearRect(0,0,width,height);ctx.fillStyle=accent;ctx.strokeStyle=accent;
    const age=Math.max(0,now-activated),life=reduced.matches?0:Math.max(0,1-age/1050);
    const reach=mode==='scroll'?150:175,near=[];
    points.forEach(p=>{
      const dist=Math.hypot(p.x-origin.x,p.y-origin.y),strength=life*Math.max(0,1-dist/reach);
      ctx.globalAlpha=.055+strength*.55;ctx.shadowColor=accent;ctx.shadowBlur=strength*10;
      ctx.beginPath();ctx.arc(p.x,p.y,.9+strength*1.3,0,Math.PI*2);ctx.fill();
      if(strength>.03)near.push({...p,strength,dist});
    });
    ctx.shadowBlur=0;
    near.sort((a,b)=>a.dist-b.dist);
    // A small star, not a full-screen web: at most seven thin connections.
    const hub=near[0];
    if(hub)near.slice(1,8).forEach(p=>{
      ctx.globalAlpha=Math.min(hub.strength,p.strength)*.3;ctx.lineWidth=.65;
      ctx.beginPath();ctx.moveTo(hub.x,hub.y);ctx.lineTo(p.x,p.y);ctx.stroke();
    });
    ctx.globalAlpha=1;
    if(life>0)frame=requestAnimationFrame(paint);
  }
  function requestPaint(){if(!frame&&!document.hidden)frame=requestAnimationFrame(paint);}
  function activate(x,y,kind){if(reduced.matches)return;origin={x,y};mode=kind;activated=performance.now();requestPaint();}
  document.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||event.target.closest('dialog'))return;
    activate(event.clientX,event.clientY,'pointer');
  },{passive:true});
  window.addEventListener('scroll',()=>{
    if(performance.now()-activated<90&&mode==='pointer')return;
    activate(width*.52,height*.48,'scroll');
  },{passive:true});
  document.addEventListener('pointerleave',()=>{activated=performance.now()-800;requestPaint();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;}
    else{activated=-Infinity;requestPaint();}
  });
  reduced.addEventListener('change',()=>{activated=-Infinity;requestPaint();});
  new MutationObserver(resize).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  window.addEventListener('resize',resize);resize();
})();
