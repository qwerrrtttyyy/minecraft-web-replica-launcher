/** 内置示例插件库：可一键安装到游戏内的实用插件 */

export interface SamplePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  category: '玩法' | '工具' | '美化' | '示例';
  /** 插件源码（JS，符合游戏的 PluginDefinition 格式） */
  source: string;
}

export const SAMPLE_PLUGINS: SamplePlugin[] = [
  {
    id: 'welcome:greeter',
    name: '欢迎助手',
    description: '玩家进入时自动问好，并在夜晚提示小心僵尸。展示插件生命周期与事件订阅。',
    version: '1.0.0',
    category: '玩法',
    source: `(function(){
  return {
    manifest: {
      id: 'welcome:greeter',
      version: '1.0.0',
      description: '玩家进入时问好，夜晚提示小心僵尸。',
      permissions: ['api:emit'],
    },
    setup: function(ctx){
      var api = ctx.api;
      // 进入世界时问好
      setTimeout(function(){
        try { api.hud && api.hud.toast && api.hud.toast('欢迎来到世界！祝你玩得开心'); } catch(e){}
      }, 1500);
      // 订阅夜晚事件，提示小心僵尸
      var off = ctx.events.on('time:set', function(e){
        try {
          var t = typeof e === 'number' ? e : (e && e.value);
          if (t > 0.7 && t < 0.85) {
            api.hud && api.hud.toast && api.hud.toast('夜晚降临，小心僵尸！');
          }
        } catch(e){}
      });
      return function(){ try { off && off(); } catch(e){} };
    },
  };
})();`,
  },
  {
    id: 'tools:daylight',
    name: '昼夜控制器',
    description: '按 H 键在白天与夜晚间切换，按 J 锁定正午。展示插件对时间系统的写操作。',
    version: '1.0.0',
    category: '工具',
    source: `(function(){
  return {
    manifest: {
      id: 'tools:daylight',
      version: '1.0.0',
      description: 'H 键昼夜切换，J 键锁正午。',
      permissions: ['time:write', 'api:emit'],
    },
    setup: function(ctx){
      var api = ctx.api;
      var locked = false;
      function onKey(e){
        try {
          if (e.key === 'h' || e.key === 'H') {
            var t = api.time.get();
            api.time.set(t > 0.3 && t < 0.7 ? 0.85 : 0.3);
            api.hud.toast('已切换到 ' + api.time.text());
          } else if (e.key === 'j' || e.key === 'J') {
            locked = !locked;
            api.hud.toast(locked ? '已锁定正午' : '已解除时间锁定');
            if (locked) api.time.set(0.3);
          }
        } catch(e){}
      }
      window.addEventListener('keydown', onKey);
      var timer = null;
      if (api.engine && api.engine.addSystem) {
        timer = api.engine.addSystem({ update: function(){ if (locked) { try { api.time.set(0.3); } catch(e){} } } });
      }
      return function(){
        window.removeEventListener('keydown', onKey);
        try { if (timer && api.engine.removeSystem) api.engine.removeSystem(timer); } catch(e){}
      };
    },
  };
})();`,
  },
  {
    id: 'style:sundial',
    name: '日晷 HUD',
    description: '在 HUD 上常驻显示当前游戏时刻与坐标，展示插件读取世界状态的能力。',
    version: '1.0.0',
    category: '美化',
    source: `(function(){
  return {
    manifest: {
      id: 'style:sundial',
      version: '1.0.0',
      description: 'HUD 常驻显示时刻与坐标。',
    },
    setup: function(ctx){
      var api = ctx.api;
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(0,0,0,0.45);color:#fff;padding:6px 14px;border-radius:8px;font:12px monospace;pointer-events:none;letter-spacing:0.5px';
      el.textContent = '日晷加载中…';
      document.body.appendChild(el);
      var timer = setInterval(function(){
        try {
          var p = api.player.position();
          var t = api.time.text();
          var b = api.world.biomeAt(p.x, p.z);
          el.textContent = '⏱ ' + t + '  📍 ' + p.x.toFixed(0) + ', ' + p.y.toFixed(0) + ', ' + p.z.toFixed(0) + '  🌲 ' + b;
        } catch(e){}
      }, 500);
      return function(){
        clearInterval(timer);
        try { el.remove(); } catch(e){}
      };
    },
  };
})();`,
  },
  {
    id: 'example:counter',
    name: '示例 · 计数器',
    description: '最简插件示例：每 10 秒计数并提示。适合作为二次开发模板。',
    version: '1.0.0',
    category: '示例',
    source: `(function(){
  return {
    manifest: {
      id: 'example:counter',
      version: '1.0.0',
      description: '每 10 秒计数并提示，插件开发模板。',
      permissions: ['api:emit'],
    },
    setup: function(ctx){
      var api = ctx.api;
      var count = 0;
      var timer = setInterval(function(){
        count++;
        try { api.hud.toast('计数器: ' + count + ' 次'); } catch(e){}
      }, 10000);
      return function(){ clearInterval(timer); };
    },
  };
})();`,
  },
];
