// app.js - client logic for the Tailwind control panel
// Connects to the server via socket.io, shows health, agents list, realtime logs,
// and provides a simple Create Agent modal using settings_spec.json.

(() => {
  // Helpers
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));
  const human = (v) => (v === undefined || v === null) ? '-' : String(v);

  // Elements
  const agentsTbody = document.getElementById('agentsTbody');
  const healthEl = document.getElementById('health');
  const logsEl = document.getElementById('logs');
  const rawEl = document.getElementById('raw');
  const refreshBtn = document.getElementById('refreshBtn');
  const createBtn = document.getElementById('createBtn');

  const createModal = document.getElementById('createAgentModal');
  const uploadProfileBtn = document.getElementById('uploadProfileBtn');
  const profileFileInput = document.getElementById('profileFileInput');
  const submitCreateAgentBtn = document.getElementById('submitCreateAgentBtn');
  const profileStatus = document.getElementById('profileStatus');
  const createError = document.getElementById('createError');
  const settingsForm = document.getElementById('settingsForm');

  // State
  let settingsSpec = {};
  let uploadedProfile = null;
  let socket = null;
  let lastStates = {};
  let latestAgents = [];

  // Connect socket.io
  function connectSocket() {
    try {
      socket = io();
    } catch (e) {
      appendLog('error', 'Socket.io client failed to load or connect: ' + e.message);
      return;
    }
    socket.on('connect', () => {
      appendLog('info', 'Socket connected');
      updateHealth('connected');
      socket.emit('listen-to-agents');
      socket.emit('request-agents-status'); // harmless if not handled
    });
    socket.on('disconnect', () => {
      appendLog('warn', 'Socket disconnected');
      updateHealth('disconnected');
    });
    socket.on('agents-status', (agents) => {
      latestAgents = agents || [];
      renderAgentsTable(latestAgents);
    });
    socket.on('bot-output', (agentName, message) => {
      appendLog('bot', `${agentName}: ${message}`);
      // also show in raw box for quick inspection
      rawEl.textContent += `[bot] ${agentName}: ${message}\n`;
      rawEl.scrollTop = rawEl.scrollHeight;
    });
    socket.on('state-update', (states) => {
      lastStates = states || {};
      // update small per-agent fields if table exists
      for (const name in states) {
        updateAgentRow(name, states[name]);
      }
    });
    socket.on('connect_error', (err) => {
      appendLog('error', 'Socket connect_error: ' + (err && err.message));
      updateHealth('error');
    });
  }

  // Health check (also used on page load)
  async function refreshHealth() {
    try {
      const r = await fetch('/health', { cache: 'no-store' });
      if (r.ok) {
        const text = await r.text();
        updateHealth('ok', text);
      } else {
        updateHealth('bad', `status ${r.status}`);
      }
    } catch (e) {
      updateHealth('down', e.message);
    }
  }

  function updateHealth(state, msg) {
    if (!healthEl) return;
    switch (state) {
      case 'ok':
        healthEl.textContent = 'Health: OK';
        healthEl.className = 'px-3 py-2 bg-green-100 text-green-800 rounded text-sm';
        break;
      case 'connected':
        healthEl.textContent = 'Socket: connected';
        healthEl.className = 'px-3 py-2 bg-blue-100 text-blue-800 rounded text-sm';
        break;
      case 'disconnected':
        healthEl.textContent = 'Socket: disconnected';
        healthEl.className = 'px-3 py-2 bg-yellow-100 text-yellow-800 rounded text-sm';
        break;
      default:
        healthEl.textContent = (msg ? `${state}: ${msg}` : `Status: ${state}`);
        healthEl.className = 'px-3 py-2 bg-gray-100 text-gray-800 rounded text-sm';
    }
  }

  // Logging
  function appendLog(level, message) {
    const el = document.createElement('div');
    el.className = 'text-xs py-1';
    const time = new Date().toLocaleTimeString();
    el.innerHTML = `<strong>[${time}]</strong> <span class="text-gray-600">[${level}]</span> ${escapeHtml(message)}`;
    logsEl.appendChild(el);
    logsEl.scrollTop = logsEl.scrollHeight;
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Fetch server-provided settings spec
  async function loadSettingsSpec() {
    try {
      const r = await fetch('/settings_spec.json');
      if (!r.ok) { appendLog('warn', 'Failed to fetch settings_spec.json'); return; }
      settingsSpec = await r.json();
      // nothing to show until create modal opens
      appendLog('info', 'Loaded settings_spec.json');
    } catch (e) {
      appendLog('error', 'Error loading settings_spec.json: ' + e.message);
    }
  }

  // Render agents table
  function renderAgentsTable(agents) {
    agentsTbody.innerHTML = '';
    if (!agents || agents.length === 0) {
      agentsTbody.insertAdjacentHTML('beforeend', `<tr><td colspan="5" class="py-4 px-2 text-sm text-gray-500">No agents</td></tr>`);
      return;
    }
    agents.forEach(agent => {
      const row = document.createElement('tr');
      row.id = `row-${agent.name}`;
      row.innerHTML = `
        <td class="py-2 px-2 font-medium">${escapeHtml(agent.name)}</td>
        <td class="py-2 px-2">${agent.in_game ? '<span class="text-green-600">Yes</span>' : '<span class="text-red-600">No</span>'}</td>
        <td class="py-2 px-2">${agent.viewerPort ? escapeHtml(String(agent.viewerPort)) : '-'}</td>
        <td class="py-2 px-2">${agent.socket_connected ? 'connected' : 'disconnected'}</td>
        <td class="py-2 px-2">
          <div class="flex gap-2">
            <button class="px-2 py-1 bg-blue-600 text-white rounded start-btn" data-action="start" data-name="${escapeHtml(agent.name)}">Start</button>
            <button class="px-2 py-1 bg-yellow-500 text-white rounded stop-btn" data-action="stop" data-name="${escapeHtml(agent.name)}">Stop</button>
            <button class="px-2 py-1 bg-indigo-600 text-white rounded" data-action="restart" data-name="${escapeHtml(agent.name)}">Restart</button>
            <button class="px-2 py-1 bg-red-600 text-white rounded" data-action="destroy" data-name="${escapeHtml(agent.name)}">Remove</button>
          </div>
        </td>
      `;
      agentsTbody.appendChild(row);
    });

    // attach handlers (delegation also ok)
    $all('button[data-action]').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        const name = btn.dataset.name;
        handleAgentAction(action, name);
      };
    });
  }

  // Update agent row with detailed state
  function updateAgentRow(name, state) {
    const row = document.getElementById(`row-${name}`);
    if (!row) return;
    // optional: add a tooltip or small details
    // show last action in socket 'raw' output
    const lastMsg = (state && state.gameplay && state.gameplay.position) ? `pos:${state.gameplay.position.x.toFixed?.(0)||state.gameplay.position.x}` : '';
    const detailCell = row.children[1];
    if (detailCell) {
      // leave basic content; you could append more details here if needed
    }
  }

  // Agent actions (emit to server)
  function handleAgentAction(action, name) {
    if (!socket) { appendLog('error', 'Not connected'); return; }
    switch (action) {
      case 'start':
        socket.emit('start-agent', name);
        appendLog('info', `Requested start of ${name}`);
        break;
      case 'stop':
        socket.emit('stop-agent', name);
        appendLog('info', `Requested stop of ${name}`);
        break;
      case 'restart':
        socket.emit('restart-agent', name);
        appendLog('info', `Requested restart of ${name}`);
        break;
      case 'destroy':
        if (!confirm(`Remove agent ${name}? This cannot be undone in the UI.`)) return;
        socket.emit('destroy-agent', name);
        appendLog('warn', `Requested destroy of ${name}`);
        break;
      default:
        appendLog('warn', 'Unknown action ' + action);
    }
  }

  // Create agent modal & form
  function openCreateModal() {
    // Clear previous
    createError.textContent = '';
    profileStatus.textContent = 'Profile: Not uploaded';
    uploadedProfile = null;
    submitCreateAgentBtn.disabled = true;
    buildCreateSettingsForm();
    createModal.style.display = 'flex';
  }
  function closeCreateModal() {
    createModal.style.display = 'none';
  }

  function buildCreateSettingsForm() {
    settingsForm.innerHTML = '';
    if (!settingsSpec || !Object.keys(settingsSpec).length) {
      settingsForm.innerHTML = '<div class="text-sm text-gray-500">Settings spec not available</div>';
      return;
    }
    Object.keys(settingsSpec).forEach(k => {
      if (k === 'profile') return;
      const cfg = settingsSpec[k];
      const wrapper = document.createElement('div');
      wrapper.className = 'setting-wrapper';
      const label = document.createElement('label');
      label.textContent = k;
      label.title = cfg.description || '';
      let input;
      if (cfg.type === 'boolean') {
        input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(cfg.default);
      } else if (cfg.type === 'number') {
        input = document.createElement('input'); input.type = 'number'; input.value = cfg.default ?? '';
      } else {
        input = document.createElement('input'); input.type = 'text'; input.value = typeof cfg.default === 'object' ? JSON.stringify(cfg.default) : (cfg.default ?? '');
      }
      input.id = `create-setting-${k}`;
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      settingsForm.appendChild(wrapper);
    });
  }

  // Profile upload logic
  profileFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        uploadedProfile = JSON.parse(ev.target.result);
        profileStatus.textContent = `Profile: ${uploadedProfile.name || 'Uploaded'}`;
        submitCreateAgentBtn.disabled = false;
        createError.textContent = '';
      } catch (err) {
        uploadedProfile = null;
        profileStatus.textContent = 'Profile: Not uploaded';
        submitCreateAgentBtn.disabled = true;
        createError.textContent = 'Invalid JSON: ' + err.message;
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  uploadProfileBtn.addEventListener('click', () => profileFileInput.click());

  submitCreateAgentBtn.addEventListener('click', () => {
    if (!uploadedProfile) { createError.textContent = 'Upload a profile JSON first'; return; }
    const settings = { profile: uploadedProfile };
    Object.keys(settingsSpec).forEach(k => {
      if (k === 'profile') return;
      const input = document.getElementById(`create-setting-${k}`);
      if (!input) return;
      const type = settingsSpec[k].type;
      let val;
      if (type === 'boolean') val = input.checked;
      else if (type === 'number') val = Number(input.value);
      else {
        try { val = JSON.parse(input.value); } catch { val = input.value; }
      }
      settings[k] = val;
    });
    socket.emit('create-agent', settings, (res) => {
      if (!res || !res.success) {
        createError.textContent = res?.error || 'Failed to create agent';
        appendLog('error', 'Create agent error: ' + createError.textContent);
      } else {
        appendLog('info', `Agent ${settings.profile.name || '(unknown)'} created`);
        uploadedProfile = null;
        closeCreateModal();
      }
    });
  });

  // UI handlers
  createBtn.addEventListener('click', openCreateModal);
  refreshBtn.addEventListener('click', () => { refreshHealth(); if (socket) socket.emit('listen-to-agents'); });

  // Clear logs
  $('#clearLogs')?.addEventListener('click', () => { logsEl.innerHTML = ''; rawEl.textContent = ''; });

  // Initial boot
  (async function init() {
    await loadSettingsSpec();
    connectSocket();
    await refreshHealth();
    appendLog('info', 'Control panel loaded');
  })();

})();
