function renderAgentsTable(agents) {
  agentsTbody.innerHTML = '';
  if (!agents || agents.length === 0) {
    agentsTbody.insertAdjacentHTML('beforeend', `<tr><td colspan="6" class="py-4 px-2 text-sm text-gray-500">No agents</td></tr>`);
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
          <button class="px-2 py-1 bg-green-600 text-white rounded" data-action="viewer" data-name="${escapeHtml(agent.name)}">Viewer</button>
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
