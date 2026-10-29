(function(){
  // First-party analytics. Cookies are set by our own server. No third parties.
  var dnt=navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  if(dnt)return;
  function post(u,b){
    try{return fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{}),credentials:'same-origin',keepalive:true});}catch(e){}
  }
  var p=post('/api/analytics/pageview',{path:location.pathname+location.search,referrer:document.referrer||'',title:document.title||''});
  // heartbeat every 30s while the tab is visible keeps the 30-min session alive
  setInterval(function(){if(document.visibilityState==='visible')post('/api/analytics/heartbeat',{});},30000);
})();
