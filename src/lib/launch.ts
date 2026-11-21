import type { GameSource, Instance, LaunchFlags } from './types';

/** 启动参数预设模板 */
export interface FlagPreset {
  key: string;
  name: string;
  description: string;
  flags: Partial<LaunchFlags>;
}

export const FLAG_PRESETS: FlagPreset[] = [
  {
    key: 'default',
    name: '默认',
    description: '平衡画质与性能',
    flags: { wasm: false, greedy: true, workers: null, mesherMain: false, aa: 'off', mergeEmissive: true },
  },
  {
    key: 'performance',
    name: '高性能',
    description: '多线程 + 合并优化，适合好机器',
    flags: { wasm: true, greedy: true, workers: 4, mesherMain: false, aa: 'off', mergeEmissive: true },
  },
  {
    key: 'low',
    name: '低配',
    description: '少线程、关合并，避免卡顿',
    flags: { wasm: false, greedy: false, workers: 1, mesherMain: false, aa: 'off', mergeEmissive: true },
  },
  {
    key: 'debug',
    name: '调试',
    description: '主线程网格化便于排查，关合并',
    flags: { wasm: false, greedy: false, workers: null, mesherMain: true, aa: 'off', mergeEmissive: false },
  },
  {
    key: 'quality',
    name: '高画质',
    description: 'MSAA 抗锯齿，画面更细腻',
    flags: { wasm: false, greedy: true, workers: null, mesherMain: false, aa: 'msaa', mergeEmissive: true },
  },
];

/** 生成启动参数的可读预览串（用于展示与复制） */
export function describeQuery(inst: Instance): string {
  const q = buildQuery(inst);
  return q ? `?${q.replace(/^\?/, '')}` : '（无附加参数）';
}

/**
 * 根据实例参数构造游戏 URL 查询串。
 * 与游戏 main.ts 的解析逻辑一一对应。
 */
export function buildQuery(inst: Instance): string {
  const p = new URLSearchParams();
  if (!inst.flags.wasm) p.set('wasm', '0');
  if (!inst.flags.greedy) p.set('greedy', '0');
  if (inst.flags.mesherMain) p.set('mesher', 'main');
  if (inst.flags.workers != null) p.set('workers', String(inst.flags.workers));
  if (inst.flags.aa !== 'off') p.set('aa', inst.flags.aa);
  if (!inst.flags.mergeEmissive) p.set('emerge', '0');
  // 自定义参数：覆盖/补充上面的预设
  if (inst.flags.customParams) {
    for (const [k, v] of Object.entries(inst.flags.customParams)) {
      if (k.trim()) p.set(k.trim(), v);
    }
  }
  // 注意：seed/mode 游戏侧从 sessionStorage 读取，不走 URL 参数。
  // 且设置后会强制开新世界（丢弃存档），因此仅在"新建世界"操作时注入，见 buildFreshWorldBootstrap。
  const q = p.toString();
  return q ? `?${q}` : '';
}

/**
 * 生成注入到游戏 iframe 的 bootstrap 脚本。
 *
 * 职责：
 * 1. 在所有游戏代码执行前 patch localStorage / sessionStorage / indexedDB，
 *    用实例的 saveKey 加前缀，实现零改动的存档隔离；
 * 2. 通过 postMessage 向启动器回报就绪 / 诊断 / 错误。
 *
 * 注意：此脚本会以 <script> 内联形式放在游戏 HTML 的 <head> 最前面，
 * 因此必须使用普通 JS（非 TS），且不能引用外部变量。
 */
export function buildBootstrap(inst: Instance, query = ''): string {
  const key = JSON.stringify(`launcher:${inst.saveKey}:`);
  const queryStr = JSON.stringify(query);
  // sessionStorage 的新世界参数必须在 patch 之前用原始 API 写入：
  // 这样游戏 boot 读取时（patch 后 getItem 会加前缀）能命中同一份数据。
  const freshWorld = inst.seed != null
    ? `try{sessionStorage.setItem('mc-ts-new-seed',${JSON.stringify(String(inst.seed))});sessionStorage.setItem('mc-ts-new-mode',${JSON.stringify(inst.mode)})}catch(e){}`
    : '';
  // 使用 IIFE + JSON 序列化注入，避免转义问题
  return `<script>(function(){
  var PREFIX=${key};
  var QUERY=${queryStr};
  var LOG=function(level,msg,detail){
    try{parent.postMessage({__launcher:true,type:'log',level:level,message:msg,detail:detail},'*')}catch(e){}
  };
  // ---- 0a. srcdoc 下 location.search 为空，patch URLSearchParams 让启动参数生效 ----
  try{
    var RealUSP=window.URLSearchParams;
    var PatchedUSP=function(init){
      if(init===undefined||init===null||init==='')return new RealUSP(QUERY.replace(/^\\?/,''));
      try{return new RealUSP(init)}catch(e){return new RealUSP(QUERY.replace(/^\\?/,''))}
    };
    PatchedUSP.prototype=RealUSP.prototype;
    window.URLSearchParams=PatchedUSP;
  }catch(e){LOG('warn','patch URLSearchParams 失败: '+e.message)}
  // ---- 0. 新建世界参数（仅在用户显式指定种子时写入）----
  ${freshWorld}
  // ---- 1. patch 存储：localStorage / sessionStorage ----
  // 游戏所有 key 都加前缀；启动器保留 key（mc-web-launcher-*）不碰。
  function patchStorage(storage){
    if(!storage)return;
    var origGet=storage.getItem.bind(storage);
    var origSet=storage.setItem.bind(storage);
    var origRemove=storage.removeItem.bind(storage);
    var origClear=storage.clear.bind(storage);
    storage.getItem=function(a){
      var k=String(a);
      if(k.indexOf('mc-web-launcher-')===0)return origGet(k);
      return origGet(PREFIX+k);
    };
    storage.setItem=function(a,b){
      var k=String(a);
      if(k.indexOf('mc-web-launcher-')===0)return origSet(k,b);
      return origSet(PREFIX+k,b);
    };
    storage.removeItem=function(a){
      var k=String(a);
      if(k.indexOf('mc-web-launcher-')===0)return origRemove(k);
      return origRemove(PREFIX+k);
    };
    // clear 只清本实例前缀，避免误伤其他世界
    storage.clear=function(){
      try{
        var toDel=[];
        for(var i=0;i<storage.length;i++){
          var k=storage.key(i);
          if(k&&k.indexOf(PREFIX)===0)toDel.push(k);
        }
        toDel.forEach(function(k){origRemove(k)});
      }catch(e){}
    };
  }
  try{patchStorage(window.localStorage)}catch(e){LOG('warn','patch localStorage 失败: '+e.message)}
  try{patchStorage(window.sessionStorage)}catch(e){LOG('warn','patch sessionStorage 失败: '+e.message)}
  // ---- 2. patch IndexedDB：库名加前缀，实现存档库隔离 ----
  try{
    var realOpen=window.indexedDB.open.bind(window.indexedDB);
    window.indexedDB.open=function(name,version){
      return realOpen(PREFIX+name,version);
    };
  }catch(e){LOG('warn','patch indexedDB 失败: '+e.message)}
  // ---- 3. 等待 CraftAPI 挂载后回报 ----
  var tries=0;
  var timer=setInterval(function(){
    tries++;
    if(window.CraftAPI){
      clearInterval(timer);
      LOG('success','游戏已就绪 · 实例 '+${JSON.stringify(inst.name)});
      // 注入插件
      var plugins=${JSON.stringify(inst.pluginIds)};
      if(plugins.length&&window.CraftAPI.plugins){
        plugins.forEach(function(pid){
          var src=window.__launcherPluginSource&&window.__launcherPluginSource[pid];
          if(src){
            try{
              window.CraftAPI.plugins.install(src);
              window.CraftAPI.plugins.enable(pid);
              LOG('info','已加载插件 '+pid);
            }catch(e){LOG('error','插件 '+pid+' 加载失败: '+e.message)}
          }
        });
      }
      // 注入设置快照
      var snap=${JSON.stringify(inst.settingsSnapshot)};
      if(snap&&window.CraftAPI.settings){
        try{
          var n=window.CraftAPI.settings.importOptions(snap);
          LOG('info','已应用设置快照（'+n+' 项）');
        }catch(e){LOG('warn','设置快照应用失败: '+e.message)}
      }
    }else if(tries>300){
      clearInterval(timer);
      LOG('error','等待 CraftAPI 超时');
    }
  },100);
  // 捕获游戏运行时错误
  window.addEventListener('error',function(e){
    LOG('error',(e.message||'运行时错误'));
  });
  // ---- 4. 命令执行器：启动器通过 postMessage 调用 CraftAPI / eval JS ----
  // 消息格式：{__launcher:true,type:'cmd',id,action,payload}
  // 回执格式：{__launcher:true,type:'result',id,ok,value,error}
  function reply(id,ok,value,error){
    try{parent.postMessage({__launcher:true,type:'result',id:id,ok:ok,value:value,error:error},'*')}catch(e){}
  }
  function collectStatus(){
    var api=window.CraftAPI;
    if(!api)return {ready:false};
    var out={ready:true};
    try{out.time=api.time.text()}catch(e){}
    try{out.dayTime=api.time.get()}catch(e){}
    try{out.seed=api.world.seed()}catch(e){}
    try{out.mode=api.survival.mode()}catch(e){}
    try{out.health=api.survival.health()}catch(e){}
    try{out.hunger=api.survival.hunger()}catch(e){}
    try{out.breath=api.survival.breath()}catch(e){}
    try{out.player=api.player.position()}catch(e){}
    try{var bi=api.world.biomeAt(out.player?out.player.x:0,out.player?out.player.z:0);out.biome=bi}catch(e){}
    try{out.entities=api.entities.list().length}catch(e){}
    try{out.wasm=api.wasm.status()}catch(e){}
    try{out.plugins=api.plugins.stats()}catch(e){}
    try{out.blocks=Object.keys(api.blocks.all?api.blocks.all():{}).length}catch(e){}
    return out;
  }
  window.addEventListener('message',function(ev){
    var d=ev.data;
    if(!d||d.__launcher!==true||d.type!=='cmd')return;
    var id=d.id,action=d.action,payload=d.payload||{};
    try{
      if(action==='exec'){
        // 执行任意 JS（开发者控制台），返回其值
        var val=(new Function('CraftAPI','__payload','return ('+payload.code+')'))(window.CraftAPI,payload);
        if(val===undefined)val=null;
        reply(id,true,val,null);
      }else if(action==='call'){
        // 调用 CraftAPI 路径，如 'player.teleport' 传 args
        var parts=payload.path.split('.');
        var obj=window.CraftAPI,fn=null;
        for(var i=0;i<parts.length-1;i++){obj=obj&&obj[parts[i]]}
        fn=obj&&obj[parts[parts.length-1]];
        if(typeof fn!=='function')throw new Error('方法不存在: '+payload.path);
        var result=fn.apply(obj,payload.args||[]);
        if(result===undefined)result=null;
        reply(id,true,result,null);
      }else if(action==='status'){
        reply(id,true,collectStatus(),null);
      }else if(action==='diag'){
        var rep=window.CraftAPI&&window.CraftAPI.diagnostics?window.CraftAPI.diagnostics.run():null;
        reply(id,true,rep,null);
      }else if(action==='diag-last'){
        var last=window.CraftAPI&&window.CraftAPI.diagnostics?window.CraftAPI.diagnostics.last():null;
        reply(id,true,last,null);
      }else if(action==='plugin-install'){
        var rec=window.CraftAPI.plugins.install(payload.source);
        reply(id,true,{id:rec.manifest.id,state:rec.state},null);
      }else if(action==='plugin-enable'){
        window.CraftAPI.plugins.enable(payload.id);
        reply(id,true,true,null);
      }else if(action==='plugin-disable'){
        window.CraftAPI.plugins.disable(payload.id);
        reply(id,true,true,null);
      }else if(action==='plugin-list'){
        var list=window.CraftAPI.plugins.list().map(function(r){
          return {id:r.manifest.id,state:r.state,version:r.manifest.version,error:r.error};
        });
        reply(id,true,list,null);
      }else if(action==='plugin-unload'){
        window.CraftAPI.plugins.unload(payload.id);
        reply(id,true,true,null);
      }else if(action==='wasm-register'){
        var info=window.CraftAPI.wasm.registerModule(payload.id,payload.data);
        reply(id,true,info,null);
      }else{
        reply(id,false,null,'未知命令: '+action);
      }
    }catch(e){
      reply(id,false,null,(e&&e.message)||String(e));
    }
  });
})();<\/script>`;
}

/**
 * 把 bootstrap 注入到游戏 HTML：
 * - 优先放在 <head> 之后（最早执行）；
 * - 找不到 <head> 时放在文档最前。
 */
export function injectBootstrap(html: string, bootstrap: string): string {
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    const idx = headMatch.index! + headMatch[0].length;
    return html.slice(0, idx) + '\n' + bootstrap + '\n' + html.slice(idx);
  }
  return bootstrap + '\n' + html;
}

/**
 * 为本地 HTML 处理相对资源路径：注入 <base href> 让 manifest / icon 等相对路径可解析。
 * 对单文件构建产物而言影响很小，但更稳妥。
 */
export function ensureBaseTag(html: string): string {
  if (/<base\s/i.test(html)) return html;
  return injectBootstrap(html, '<base href="./">');
}

/**
 * 从游戏 HTML 生成注入后的 srcdoc。
 * 在线与本地两种来源统一走这条路径，确保存档隔离与参数注入都生效。
 */
export function buildSrcdoc(html: string, inst: Instance): string {
  const query = buildQuery(inst);
  const bootstrap = buildBootstrap(inst, query);
  return injectBootstrap(ensureBaseTag(html), bootstrap);
}

/**
 * 在线模式：fetch 游戏 HTML 原文（不注入），交由 buildSrcdoc 处理。
 * 跨域失败时抛出错误，由调用方降级为直接 src。
 */
export async function fetchOnlineHtml(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`拉取游戏失败：HTTP ${res.status}`);
  return res.text();
}

/** 在线降级的直接 URL（无隔离，仅在外链 fetch 失败时使用） */
export function fallbackUrl(source: GameSource, inst: Instance): string {
  const url = new URL(source.onlineUrl, window.location.href);
  url.search = buildQuery(inst).replace(/^\?/, '');
  return url.toString();
}
