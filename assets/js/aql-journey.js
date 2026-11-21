(() => {
  const root=document.querySelector('.cv-page'),canvas=document.getElementById('cv-journey');
  const ctx=canvas?.getContext('2d');
  if(!root||!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,frame=0,geometry=null,accent='#b6a5ff',light=false;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const mix=(a,b,t)=>a+(b-a)*t;
  function curve(a,b,c,d,t){const s=1-t;return{x:s*s*s*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t*t*t*d.x,y:s*s*s*a.y+3*s*s*t*b.y+3*s*t*t*c.y+t*t*t*d.y};}
  function setup(){
    width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const bounds=root.getBoundingClientRect(),mobile=width<=760;
    const profile=root.querySelector('.cv-profile').getBoundingClientRect();
    const story=root.querySelector('.cv-story').getBoundingClientRect();
    const soma={x:bounds.left+bounds.width*(mobile?.57:.79),y:mobile?92:220};
    const axisX=mobile?bounds.left+5:bounds.left+bounds.width*.23;
    const storyStart=story.top-bounds.top;
    const targets=[...root.querySelectorAll('.cv-section-heading, .cv-roles li')].map(el=>{
      const rect=el.getBoundingClientRect();return{x:rect.left-14,y:rect.top-bounds.top+20,role:el.matches('li')};
    });
    accent=getComputedStyle(root).getPropertyValue('--accent').trim();light=document.documentElement.dataset.theme==='light';
    geometry={bounds,rootHeight:bounds.height,mobile,soma,axisX,storyStart,targets,profileHeight:profile.height,radius:mobile?47:110};
    requestPaint();
  }
  function line(points,alpha,w=.7){
    if(!points.length)return;ctx.globalAlpha=alpha;ctx.lineWidth=w;ctx.beginPath();
    points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  }
  function tube(a,b,c,d,radius,rotation,alpha=.3,steps=24,endRadius=radius*.25){
    // The mesh is a projected tubular surface, not a stack of flat parallel strokes.
    const rows=[];const sides=6;
    for(let i=0;i<=steps;i++){
      const t=i/steps,p=curve(a,b,c,d,t),next=curve(a,b,c,d,Math.min(1,t+.005));
      const angle=Math.atan2(next.y-p.y,next.x-p.x)+Math.PI/2;
      const thickness=mix(radius,endRadius,t),row=[];
      for(let j=0;j<sides;j++){
        const theta=j*Math.PI*2/sides+rotation+t*.9;
        const offset=Math.cos(theta)*thickness;
        row.push({x:p.x+Math.cos(angle)*offset,y:p.y+Math.sin(angle)*offset,depth:Math.sin(theta)});
      }rows.push(row);
    }
    rows.forEach((row,i)=>{
      if(i%3===0)line([...row,row[0]],alpha*.5);
      if(i)row.forEach((p,j)=>{
        const depth=(p.depth+1)/2;
        line([rows[i-1][j],p],alpha*(.3+depth*.7));
        line([rows[i-1][(j+1)%sides],p],alpha*.27);
      });
    });
  }
  function draw(){
    frame=0;if(document.hidden||!geometry)return;
    ctx.clearRect(0,0,width,height);
    const bounds=root.getBoundingClientRect();if(bounds.top>height||bounds.bottom<0)return;
    const g=geometry,{soma,radius,mobile,axisX,storyStart}=g;
    const fraction=clamp(-bounds.top/Math.max(1,g.rootHeight-height));
    const rotation=reduced.matches?.35:.35+fraction*Math.PI*2.2;
    const reading=height*.4-bounds.top;
    ctx.save();ctx.beginPath();ctx.rect(0,Math.max(0,bounds.top),width,Math.max(0,Math.min(height,bounds.bottom)-Math.max(0,bounds.top)));ctx.clip();
    ctx.translate(0,bounds.top);ctx.strokeStyle=accent;ctx.fillStyle=accent;
    const axisAt=y=>axisX+(mobile?3:24)*Math.sin((y-storyStart)/700+rotation*.16);
    if(soma.y+bounds.top>-310){
      // Rotating organic cell body: shaded triangular facets give the wireframe volume.
      const verts=[],lat=10,lon=18;
      for(let i=0;i<=lat;i++)for(let j=0;j<lon;j++){
        const phi=i*Math.PI/lat,theta=j*Math.PI*2/lon;
        const ripple=1+.09*Math.sin(theta*3+phi*2)+.04*Math.cos(phi*5);
        const x=Math.sin(phi)*Math.cos(theta)*radius*ripple;
        const z=Math.sin(phi)*Math.sin(theta)*radius*.8*ripple;
        const y=Math.cos(phi)*radius*.84;
        const rx=x*Math.cos(rotation)+z*Math.sin(rotation),rz=z*Math.cos(rotation)-x*Math.sin(rotation);
        verts.push({x:soma.x+rx,y:soma.y+y+rz*.12,z:rz/radius});
      }
      const halo=ctx.createRadialGradient(soma.x,soma.y,0,soma.x,soma.y,radius*1.55);
      halo.addColorStop(0,light?'#603bb112':'#b6a5ff1c');halo.addColorStop(1,'transparent');
      ctx.globalAlpha=1;ctx.fillStyle=halo;ctx.fillRect(soma.x-radius*1.6,soma.y-radius*1.6,radius*3.2,radius*3.2);
      ctx.fillStyle=accent;
      verts.forEach((p,index)=>{
        const row=Math.floor(index/lon),col=index%lon;
        const next=verts[row*lon+(col+1)%lon];const opacity=.18+(p.z+1)*.18;
        line([p,next],opacity);
        if(row<lat){const down=verts[index+lon];line([p,down],opacity);line([p,verts[(row+1)*lon+(col+1)%lon]],opacity*.6);}
      });
      // Branches stay close to the introduction; their surface twists with the soma.
      for(let i=0;i<7;i++){
        const angle=-Math.PI*.95+i*Math.PI*.28;
        const a={x:soma.x+Math.cos(angle)*radius*.82,y:soma.y+Math.sin(angle)*radius*.72};
        const reach=radius*(mobile?2:2.45);
        const end={x:soma.x+Math.cos(angle)*reach,y:soma.y+Math.sin(angle)*reach};
        end.x=Math.max(bounds.left+bounds.width*(mobile?.12:.59),Math.min(bounds.right-5,end.x));
        const mid={x:mix(a.x,end.x,.55)+Math.sin(i*2)*20,y:mix(a.y,end.y,.55)};
        tube(a,{x:a.x+(mid.x-a.x)*.3,y:mid.y},mid,end,mobile?3:5,rotation,.32,16);
        const fork=curve(a,{x:a.x,y:mid.y},mid,end,.66);
        const tip={x:end.x+Math.sin(i+1)*radius*.45,y:end.y-radius*.4};
        tube(fork,{x:fork.x,y:fork.y-radius*.25},{x:tip.x,y:tip.y+15},tip,mobile?1.7:2.3,rotation,.23,10);
      }
    }
    // One axon leaves the soma and bends into the reading column.
    const bridgeEnd=mobile?210:storyStart;
    tube({x:soma.x,y:soma.y+radius*.65},{x:soma.x+10,y:bridgeEnd-120},{x:axisX+(mobile?20:90),y:bridgeEnd-180},{x:axisAt(bridgeEnd),y:bridgeEnd},mobile?4:14,rotation,.4,36,mobile?2.7:9);
    const pathStart=mobile?210:storyStart;
    for(let y=pathStart;y<g.rootHeight-40;y+=300){
      if(y+bounds.top>height+330||y+300+bounds.top<-100)continue;
      const end=Math.min(y+300,g.rootHeight-40);
      tube({x:axisAt(y),y},{x:axisAt(y+100),y:y+100},{x:axisAt(end-100),y:end-100},{x:axisAt(end),y:end},mobile?2.7:9,rotation+y/500,.36,18,mobile?2.7:9);
    }
    g.targets.forEach((target,i)=>{
      if(target.y+bounds.top<-150||target.y+bounds.top>height+150)return;
      const a={x:axisAt(target.y-90),y:target.y-90};
      const active=Math.abs(target.y-reading)<height*.34;
      tube(a,{x:a.x+15,y:target.y-40},{x:target.x-35,y:target.y},target,mobile?1.4:3.8,rotation,active?.58:.26,20);
      ctx.fillStyle=accent;ctx.globalAlpha=active?.85:.4;ctx.shadowColor=accent;ctx.shadowBlur=active&&!reduced.matches?9:0;
      ctx.beginPath();ctx.arc(target.x,target.y,active?3:2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    });
    // A tiny reading signal follows scroll along the actual axon, never across the text.
    if(!reduced.matches&&reading>storyStart&&reading<g.rootHeight-40){
      ctx.fillStyle=accent;ctx.globalAlpha=.9;ctx.shadowColor=accent;ctx.shadowBlur=12;
      ctx.beginPath();ctx.arc(axisAt(reading),reading,mobile?2.3:3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    ctx.restore();ctx.globalAlpha=1;
  }
  function requestPaint(){if(!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
  window.addEventListener('scroll',requestPaint,{passive:true});window.addEventListener('resize',setup);
  reduced.addEventListener('change',requestPaint);
  new ResizeObserver(setup).observe(root);
  new MutationObserver(setup).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  root.addEventListener('toggle',setup,true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else requestPaint();});
  document.fonts?.ready.then(setup);setup();
})();
