  case 'viewer':
    // open proxied viewer in a new tab — server will forward to the agent's viewer port
    window.open(`/viewer/${encodeURIComponent(name)}/`, '_blank', 'noopener');
    appendLog('info', `Opened viewer for ${name}`);
    break;
