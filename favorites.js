// Public, restricted Supabase RPC access. This is a publishable key, not an admin key.
const FAVORITE_API='https://lkseatzydyvxvkbsvplf.supabase.co/rest/v1/rpc/';
const FAVORITE_API_KEY='sb_publishable_7QDX12YCdIm-zEUCFjPJ6g_jP7dLwwG';
const favoriteTotals=new Map(),favoritePending=new Set();
let favoriteCountsReady=false,favoriteCountsBusy=false,favoriteMigrationDone=false;
function browserFavoriteToken(){
  const key='animation-library.browser.v1';
  let token=localStorage.getItem(key);
  if(!token){token=crypto.randomUUID();localStorage.setItem(key,token)}
  return token;
}
async function favoriteRpc(name,body={}){
  const response=await fetch(FAVORITE_API+name,{method:'POST',headers:{apikey:FAVORITE_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Favorite service unavailable');
  return response.json();
}
function favoriteLabel(id){return `${favorites.has(id)?'已收藏':'收藏'} · ${favoriteCountsReady?(favoriteTotals.get(id)||0):'—'}`}
function paintFavoriteButtons(){
  document.querySelectorAll('[data-favorite]').forEach(button=>{
    const id=button.dataset.favorite;
    button.textContent=favoriteLabel(id);
    button.disabled=favoritePending.has(id);
    button.setAttribute('aria-pressed',String(favorites.has(id)));
    button.title=favoriteCountsReady?`共有 ${favoriteTotals.get(id)||0} 个浏览器收藏`:'收藏总数暂未加载';
  });
}
async function syncFavoriteCounts(){
  if(!data||favoriteCountsBusy||document.hidden)return;
  favoriteCountsBusy=true;
  try{
    // Import pre-existing browser favorites once. Upserts make repeated imports safe.
    if(!favoriteMigrationDone){
      const marker='animation-library.favorites.migrated.v1';
      if(!localStorage.getItem(marker)){
        const token=browserFavoriteToken();
        for(const id of readFavorites()){
          if(data.topics.some(t=>t.id===id))await favoriteRpc('set_favorite',{p_browser_token:token,p_topic_id:id,p_saved:readFavorites().has(id)});
        }
        localStorage.setItem(marker,'1');
      }
      favoriteMigrationDone=true;
    }
    const rows=await favoriteRpc('favorite_counts');
    favoriteTotals.clear();for(const row of rows)favoriteTotals.set(row.topic_id,Number(row.total));
    favoriteCountsReady=true;paintFavoriteButtons();
  }catch{favoriteCountsReady=false;paintFavoriteButtons()}
  finally{favoriteCountsBusy=false}
}
async function saveSharedFavorite(id){
  if(!data?.topics.some(t=>t.id===id)||favoritePending.has(id))return;
  if(!favoriteMigrationDone){notify('收藏数据正在连接，请稍后重试');syncFavoriteCounts();return}
  favoritePending.add(id);paintFavoriteButtons();
  try{
    const token=browserFavoriteToken(),saved=!readFavorites().has(id);
    // Check writable browser storage before committing remotely.
    localStorage.setItem(FAVORITES_KEY,JSON.stringify([...readFavorites()]));
    const total=await favoriteRpc('set_favorite',{p_browser_token:token,p_topic_id:id,p_saved:saved});
    const next=readFavorites();if(saved)next.add(id);else next.delete(id);
    localStorage.setItem(FAVORITES_KEY,JSON.stringify([...next]));favorites=next;
    favoriteTotals.set(id,Number(total));favoriteCountsReady=true;
    if(!$('#overview').hidden)render();else nav();readerActions();
    notify(saved?'已收藏，公开收藏数已更新':'已取消收藏，公开收藏数已更新');
  }catch{notify('收藏同步失败，请稍后重试')}
  finally{favoritePending.delete(id);paintFavoriteButtons();syncFavoriteCounts()}
}
setInterval(syncFavoriteCounts,5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncFavoriteCounts()});
