document.addEventListener('DOMContentLoaded', () => {
  let isPaused = false;
  let isStressTesting = false;
  let secondsSinceSync = 0;
  let currentFilter = 'all';

  let nodes = [
    { id: 'srv-01', name: 'Nginx Ingress Proxy', ip: '10.0.1.5:443', status: 'healthy', ping: 12, cpu: 26, mem: 42, packetsLost: 0, uptime: '48d 14h' },
    { id: 'srv-02', name: 'Auth & JWT Service', ip: '10.0.1.18:8080', status: 'healthy', ping: 18, cpu: 34, mem: 58, packetsLost: 0, uptime: '19d 08h' },
    { id: 'srv-03', name: 'MySQL Master Cluster', ip: '10.0.2.10:3306', status: 'healthy', ping: 8, cpu: 54, mem: 78, packetsLost: 0, uptime: '92d 02h' },
    { id: 'srv-04', name: 'Redis Cache Master', ip: '10.0.2.24:6379', status: 'healthy', ping: 4, cpu: 14, mem: 65, packetsLost: 0, uptime: '110d 19h' },
    { id: 'srv-05', name: 'Async RabbitMQ Queue', ip: '10.0.3.50:5672', status: 'degraded', ping: 76, cpu: 82, mem: 89, packetsLost: 2, uptime: '04d 11h' },
    { id: 'srv-06', name: 'Static S3 Bucket Gateway', ip: '10.0.4.12:80', status: 'healthy', ping: 15, cpu: 19, mem: 31, packetsLost: 0, uptime: '60d 05h' }
  ];

  const latencyHistory = [18, 16, 20, 22, 19, 15, 25, 28, 24, 22, 19, 17, 21, 26, 23, 20, 18, 22];

  const nodesContainer = document.getElementById('nodesContainer');
  const terminalLogs = document.getElementById('terminalLogs');
  const activeNodesEl = document.getElementById('activeNodes');
  const uptimeBadgeEl = document.getElementById('uptimeBadge');
  const avgLatencyEl = document.getElementById('avgLatency');
  const latencyBadgeEl = document.getElementById('latencyBadge');
  const avgCpuEl = document.getElementById('avgCpu');
  const cpuBadgeEl = document.getElementById('cpuBadge');
  const nodesBarEl = document.getElementById('nodesBar');
  const cpuBarEl = document.getElementById('cpuBar');
  const alertCountEl = document.getElementById('alertCount');
  const alertBadgeEl = document.getElementById('alertBadge');
  const incidentSubtextEl = document.getElementById('incidentSubtext');
  const syncStatusEl = document.getElementById('syncStatus');
  const liveDot = document.getElementById('liveDot');
  const chartLiveTag = document.getElementById('chartLiveTag');
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseIcon = document.getElementById('pauseIcon');
  const stressBtn = document.getElementById('stressBtn');
  const exportLogsBtn = document.getElementById('exportLogsBtn');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const filterPills = document.querySelectorAll('.filter-pill');

  const lineCanvas = document.getElementById('lineChart');
  const lineCtx = lineCanvas.getContext('2d');
  const donutCanvas = document.getElementById('donutChart');
  const donutCtx = donutCanvas.getContext('2d');
  const donutPercent = document.getElementById('donutPercent');
  const donutLegend = document.getElementById('donutLegend');

  const nodeModal = document.getElementById('nodeModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDot = document.getElementById('modalDot');
  const modalBody = document.getElementById('modalBody');
  const closeModalBtn = document.getElementById('closeModalBtn');

  function drawLineChart() {
    const width = lineCanvas.width;
    const height = lineCanvas.height;
    lineCtx.clearRect(0, 0, width, height);

    const padding = 25;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;
    const maxVal = Math.max(80, ...latencyHistory);

    lineCtx.strokeStyle = 'rgba(35, 50, 74, 0.4)';
    lineCtx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padding + (drawHeight / 3) * i;
      lineCtx.beginPath();
      lineCtx.moveTo(padding, y);
      lineCtx.lineTo(width - padding, y);
      lineCtx.stroke();
    }

    if (latencyHistory.length === 0) return;

    const stepX = drawWidth / (latencyHistory.length - 1);
    const points = latencyHistory.map((val, idx) => {
      const x = padding + idx * stepX;
      const y = height - padding - (val / maxVal) * drawHeight;
      return { x, y, val };
    });

    const gradient = lineCtx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    lineCtx.beginPath();
    lineCtx.moveTo(points[0].x, height - padding);
    points.forEach(p => lineCtx.lineTo(p.x, p.y));
    lineCtx.lineTo(points[points.length - 1].x, height - padding);
    lineCtx.closePath();
    lineCtx.fillStyle = gradient;
    lineCtx.fill();

    lineCtx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) lineCtx.moveTo(p.x, p.y);
      else lineCtx.lineTo(p.x, p.y);
    });
    lineCtx.strokeStyle = '#38BDF8';
    lineCtx.lineWidth = 2.5;
    lineCtx.lineJoin = 'round';
    lineCtx.stroke();

    const lastP = points[points.length - 1];
    lineCtx.beginPath();
    lineCtx.arc(lastP.x, lastP.y, 4.5, 0, Math.PI * 2);
    lineCtx.fillStyle = '#E3EDF9';
    lineCtx.fill();
    lineCtx.strokeStyle = '#38BDF8';
    lineCtx.lineWidth = 2;
    lineCtx.stroke();
  }

  function drawDonutChart() {
    const width = donutCanvas.width;
    const height = donutCanvas.height;
    donutCtx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 64;
    const innerRadius = 46;

    const usedAvg = Math.round(nodes.reduce((acc, n) => acc + n.mem, 0) / nodes.length);
    const free = 100 - usedAvg;

    const segments = [
      { label: 'En uso (RAM)', value: usedAvg, color: '#38BDF8' },
      { label: 'Disponible', value: free, color: '#23324A' }
    ];

    let startAngle = -Math.PI / 2;
    segments.forEach(seg => {
      const sliceAngle = (seg.value / 100) * (Math.PI * 2);
      donutCtx.beginPath();
      donutCtx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      donutCtx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      donutCtx.closePath();
      donutCtx.fillStyle = seg.color;
      donutCtx.fill();
      startAngle += sliceAngle;
    });

    donutPercent.textContent = `${usedAvg}%`;

    donutLegend.innerHTML = segments.map(seg => `
      <div class="legend-item">
        <span class="legend-color" style="background-color: ${seg.color}"></span>
        <span>${seg.label}: <strong>${seg.value}%</strong></span>
      </div>
    `).join('');
  }

  async function fetchTelemetry() {
    if (isPaused) return;

    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
      if (!res.ok) throw new Error('Gateway unreachable');

      nodes = nodes.map(node => {
        let cpuDelta = Math.floor(Math.random() * 9) - 4;
        let pingDelta = Math.floor(Math.random() * 7) - 3;

        if (isStressTesting) {
          cpuDelta += 15;
          pingDelta += 25;
        }

        let newCpu = Math.max(10, Math.min(99, node.cpu + cpuDelta));
        let newPing = Math.max(3, Math.min(180, node.ping + pingDelta));
        let newStatus = (newCpu > 80 || newPing > 75) ? 'degraded' : 'healthy';

        return { ...node, cpu: newCpu, ping: newPing, status: newStatus };
      });

      const currentAvgPing = Math.round(nodes.reduce((acc, n) => acc + n.ping, 0) / nodes.length);
      latencyHistory.push(currentAvgPing);
      if (latencyHistory.length > 20) latencyHistory.shift();

      secondsSinceSync = 0;
      renderAll();

      if (isStressTesting) {
        appendLog('WARN', `Simulación de estrés activa: Saturación de cola detectada en ${nodes[4].name}.`);
      }
    } catch (err) {
      appendLog('ERR', `Error en canal de telemetría: ${err.message}`);
    }
  }

  function renderKPIs() {
    const total = nodes.length;
    const healthy = nodes.filter(n => n.status === 'healthy').length;
    const degraded = total - healthy;

    const avgPing = Math.round(nodes.reduce((acc, n) => acc + n.ping, 0) / total);
    const avgCpu = Math.round(nodes.reduce((acc, n) => acc + n.cpu, 0) / total);

    activeNodesEl.textContent = `${healthy}/${total}`;
    nodesBarEl.style.width = `${(healthy / total) * 100}%`;

    avgLatencyEl.textContent = `${avgPing} ms`;
    latencyBadgeEl.textContent = avgPing < 45 ? 'Óptimo' : 'Elevado';
    latencyBadgeEl.className = `kpi-badge ${avgPing < 45 ? 'badge-ok' : 'badge-warn'}`;

    avgCpuEl.textContent = `${avgCpu}%`;
    cpuBarEl.style.width = `${avgCpu}%`;
    cpuBadgeEl.textContent = avgCpu < 70 ? 'Nominal' : 'Alto';
    cpuBadgeEl.className = `kpi-badge ${avgCpu < 70 ? 'badge-ok' : 'badge-danger'}`;

    alertCountEl.textContent = degraded;
    alertBadgeEl.textContent = degraded === 0 ? 'Estable' : 'Alerta';
    alertBadgeEl.className = `kpi-badge ${degraded === 0 ? 'badge-ok' : 'badge-warn'}`;

    const totalLost = nodes.reduce((acc, n) => acc + n.packetsLost, 0);
    incidentSubtextEl.textContent = `${totalLost} paquetes perdidos (Mesh)`;
  }

  function renderNodes() {
    nodesContainer.innerHTML = '';

    const filtered = nodes.filter(n => {
      if (currentFilter === 'all') return true;
      return n.status === currentFilter;
    });

    if (filtered.length === 0) {
      nodesContainer.innerHTML = `<p style="color: #64748B; font-size: 0.85rem; padding: 1.5rem; text-align: center;">No hay nodos bajo este criterio.</p>`;
      return;
    }

    filtered.forEach(node => {
      const card = document.createElement('div');
      card.className = 'node-card-item';
      card.innerHTML = `
        <div class="node-left">
          <span class="status-indicator" style="background-color: ${node.status === 'healthy' ? 'var(--ok)' : 'var(--warn)'}"></span>
          <div class="node-title-group">
            <h4>${node.name}</h4>
            <span>${node.ip}</span>
          </div>
        </div>
        <div class="node-right">
          <div class="node-metric-cell">
            <span>PING</span>
            <strong>${node.ping}ms</strong>
          </div>
          <div class="node-metric-cell">
            <span>CPU</span>
            <strong>${node.cpu}%</strong>
          </div>
          <div class="node-metric-cell">
            <span>RAM</span>
            <strong>${node.mem}%</strong>
          </div>
        </div>
      `;

      card.addEventListener('click', () => openNodeModal(node));
      nodesContainer.appendChild(card);
    });
  }

  function appendLog(lvl, msg) {
    const time = new Date().toLocaleTimeString('es-MX', { hour12: false });
    const row = document.createElement('div');
    row.className = 'terminal-line';
    row.innerHTML = `
      <span class="term-time">[${time}]</span>
      <span class="term-lvl lvl-${lvl}">${lvl}</span>
      <span class="term-msg">${msg}</span>
    `;

    terminalLogs.appendChild(row);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }

  function renderAll() {
    renderKPIs();
    renderNodes();
    drawLineChart();
    drawDonutChart();
  }

  function openNodeModal(node) {
    modalTitle.textContent = node.name;
    modalDot.style.backgroundColor = node.status === 'healthy' ? 'var(--ok)' : 'var(--warn)';

    modalBody.innerHTML = `
      <div class="modal-grid">
        <div class="modal-field"><label>Endpoint</label><span>${node.ip}</span></div>
        <div class="modal-field"><label>Estado</label><span style="color: ${node.status === 'healthy' ? 'var(--ok)' : 'var(--warn)'}">${node.status.toUpperCase()}</span></div>
        <div class="modal-field"><label>Latencia Directa</label><span>${node.ping} ms</span></div>
        <div class="modal-field"><label>Uptime Registrado</label><span>${node.uptime}</span></div>
        <div class="modal-field"><label>Consumo de CPU</label><span>${node.cpu}%</span></div>
        <div class="modal-field"><label>Memoria Reservada</label><span>${node.mem}%</span></div>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
        Nodo enrutado mediante balanceador L4 con certificado SSL TLSv1.3 vigente. Inspección de paquetes sin anomalías críticas.
      </p>
    `;

    nodeModal.hidden = false;
  }

  closeModalBtn.addEventListener('click', () => {
    nodeModal.hidden = true;
  });

  nodeModal.addEventListener('click', (e) => {
    if (e.target === nodeModal) nodeModal.hidden = true;
  });

  pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      pauseBtn.innerHTML = `<span>▶</span> Reanudar`;
      liveDot.classList.add('paused');
      chartLiveTag.textContent = 'STREAM EN PAUSA';
      chartLiveTag.style.color = 'var(--warn)';
      appendLog('INFO', 'Telemetría pausada por el operador.');
    } else {
      pauseBtn.innerHTML = `<span>⏸</span> Pausar`;
      liveDot.classList.remove('paused');
      chartLiveTag.textContent = 'STREAM ACTIVO';
      chartLiveTag.style.color = 'var(--cyan)';
      appendLog('INFO', 'Telemetría reanudada.');
      fetchTelemetry();
    }
  });

  stressBtn.addEventListener('click', () => {
    isStressTesting = !isStressTesting;
    stressBtn.textContent = isStressTesting ? '🛑 Detener Estrés' : '⚡ Simular Estrés';
    appendLog('WARN', isStressTesting ? 'Simulador de caos INICIADO (Sobrecarga de sockets).' : 'Simulador de caos DETENIDO. Normalizando parámetros.');
    fetchTelemetry();
  });

  exportLogsBtn.addEventListener('click', () => {
    const lines = Array.from(terminalLogs.children).map(c => c.innerText);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netpulse_syslog_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  });

  clearLogsBtn.addEventListener('click', () => {
    terminalLogs.innerHTML = '';
  });

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderNodes();
    });
  });

  setInterval(() => {
    if (!isPaused) {
      secondsSinceSync++;
      syncStatusEl.textContent = `Sincronizado: hace ${secondsSinceSync}s`;
    }
  }, 1000);

  setInterval(() => {
    fetchTelemetry();
  }, 3500);

  fetchTelemetry();
  appendLog('INFO', 'Dashboard Demo conectado al socket seguro.');
  appendLog('INFO', 'Canvas render pipeline activado con aceleración GPU.');
});