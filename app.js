(function(){
  // film captions synced to the video timeline (seconds)
  var CAPS=[
    [0.6,4.7,"GLYPH","The key to your accounts. You hold it."],
    [4.9,8.2,"IT STAYS PUT","On your desk, in a pocket, on a keyring."],
    [8.7,12.4,"TAP THE PHONE'S TOP EDGE","It glows while it signs you in."],
    [13.0,15.6,"SET IT DOWN","Done. Nothing to charge."],
    [15.9,20.2,"LIVES ON YOUR DESK","Drop it on the dock by your laptop."],
    [20.5,26.8,"NO PASSWORDS INSIDE","NFC antenna. FIDO2 chip. Light. Magnets."],
    [27.3,31.2,"ONLY SIGNS REAL SITES","If you tap on a fake page, Glyph does not sign you in."]
  ];
  var v=document.getElementById('film'),cap=document.getElementById('filmcap');
  var t=cap.querySelector('.lt-t'),s=cap.querySelector('.lt-s'),cur=-1;
  function tick(){
    var x=v.currentTime,i=-1;
    for(var k=0;k<CAPS.length;k++){if(x>=CAPS[k][0]&&x<CAPS[k][1]){i=k;break;}}
    if(i!==cur){
      cur=i;
      if(i<0){cap.classList.add('out');}
      else{cap.classList.add('out');setTimeout(function(){if(cur<0)return;t.textContent=CAPS[cur][2];s.textContent=CAPS[cur][3];cap.classList.remove('out');},cap.classList.contains('out')?450:0);}
    }
  }
  if(v){v.addEventListener('timeupdate',tick);
    var p=v.play&&v.play();if(p&&p.catch)p.catch(function(){});}
  var b=document.getElementById('sound');
  if(b)b.addEventListener('click',function(){v.muted=!v.muted;if(!v.muted){v.volume=.8;v.play();}b.setAttribute('aria-pressed',String(!v.muted));b.textContent=v.muted?'Sound on':'Sound off';});

  // slow reveal on scroll
  var els=document.querySelectorAll('.problem .line,.solution .sol,.beats .lt,.stills figure');
  for(var i=0;i<els.length;i++)els[i].classList.add('reveal');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -12% 0px'});
    for(var j=0;j<els.length;j++)io.observe(els[j]);
  }else{for(var j2=0;j2<els.length;j2++)els[j2].classList.add('in');}

  // waitlist: POST /api/waitlist (Postgres on the server)
  var f=document.getElementById('wl'),m=document.getElementById('wl-msg');
  var KEY='glyph_waitlist';
  try{if(localStorage.getItem(KEY)){m.textContent="You're on the list.";m.className='note ok';}}catch(e){}
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var val=(f.email.value||'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)){m.textContent='That email looks off. Try again.';m.className='note';return;}
    var btn=f.querySelector('button');if(btn)btn.disabled=true;
    m.textContent='Adding you...';m.className='note';
    fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:val})})
      .then(function(r){
        if(r.ok||r.status===409){
          try{localStorage.setItem(KEY,val);}catch(e){}
          m.textContent="You're on the list.";m.className='note ok';f.reset();
        }else if(r.status===400){m.textContent='That email looks off. Try again.';m.className='note';}
        else{m.textContent='Something broke on our end. Try again in a minute.';m.className='note';}
      })
      .catch(function(){m.textContent='Could not reach the server. Try again.';m.className='note';})
      .then(function(){if(btn)btn.disabled=false;});
  });
})();
