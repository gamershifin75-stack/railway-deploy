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

  submitCreateAgentBtn.disabled = true;
  createError.textContent = 'Creating agent...';

  // server will call the callback with { success, error }
  socket.emit('create-agent', settings, (res) => {
    submitCreateAgentBtn.disabled = false;
    if (!res) {
      createError.textContent = 'No response from server (timeout)';
      appendLog('error', 'create-agent: no response');
      return;
    }
    if (!res.success) {
      createError.textContent = res.error || 'Create failed';
      appendLog('error', 'create-agent failed: ' + (res.error || JSON.stringify(res)));
    } else {
      appendLog('info', `Agent ${settings.profile.name || '(unknown)'} created`);
      uploadedProfile = null;
      profileStatus.textContent = 'Profile: Not uploaded';
      createError.textContent = '';
      closeCreateModal();
      if (socket) socket.emit('listen-to-agents'); // refresh list
    }
  });
});
