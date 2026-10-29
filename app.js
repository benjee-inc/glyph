(function(){
  var f=document.getElementById('wl'),m=document.getElementById('wl-msg');
  var KEY='glyph_waitlist',TO='fantasticfauna@mail.grokbot.com';
  try{if(localStorage.getItem(KEY)){m.textContent="You're on the list.";m.className='note ok';}}catch(e){}
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var v=(f.email.value||'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){m.textContent='That email looks off. Try again?';m.className='note';return;}
    try{localStorage.setItem(KEY,v);}catch(e){}
    m.textContent="You're on the list. Your mail app will open so you can send it.";m.className='note ok';
    location.href='mailto:'+TO+'?subject='+encodeURIComponent('Glyph waitlist')+'&body='+encodeURIComponent('Add me to the Glyph list: '+v);
  });
})();
