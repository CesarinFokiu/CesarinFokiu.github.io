document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'taskflow_pro_dataset_v2';

  // Colección inicial con fechas calculadas automáticamente
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const initialDataset = [
    {
      id: 'tf-1',
      title: 'Refactorizar arquitectura de CSS con Variables dinámicas',
      category: 'dev',
      priority: 'alta',
      dueDate: today.toISOString().split('T')[0],
      completed: true,
      order: 0
    },
    {
      id: 'tf-2',
      title: 'Implementar eventos nativos de Drag & Drop (HTML5 API)',
      category: 'dev',
      priority: 'media',
      dueDate: tomorrow.toISOString().split('T')[0],
      completed: false,
      order: 1
    },
    {
      id: 'tf-3',
      title: 'Auditoría de accesibilidad con lector de pantalla y teclado',
      category: 'work',
      priority: 'baja',
      dueDate: '',
      completed: false,
      order: 2
    }
  ];

  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialDataset;
  let currentFilter = 'all';
  let searchQuery = '';
  let draggedTaskId = null;

  // Referencias DOM
  const taskForm = document.getElementById('taskForm');
  const taskInput = document.getElementById('taskInput');
  const categorySelect = document.getElementById('categorySelect');
  const prioritySelect = document.getElementById('prioritySelect');
  const dueDateInput = document.getElementById('dueDateInput');
  const taskList = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const filterChips = document.querySelectorAll('.filter-chip');
  const clearCompletedBtn = document.getElementById('clearCompletedBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');

  // Métricas
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressAria = document.getElementById('progressAria');
  const statTotal = document.getElementById('statTotal');
  const statPending = document.getElementById('statPending');
  const statDone = document.getElementById('statDone');

  // Sintetizador Web Audio para microinteracciones de sonido sin ficheros externos
  function playBeep(type = 'success') {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      } else {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.15);
      }

      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Ignorar si el usuario no ha interactuado aún con el audio
    }
  }

  // Guardado persistente
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    updateAnalytics();
  }

  // Actualización de progreso y analíticas
  function updateAnalytics() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressAria.setAttribute('aria-valuenow', percentage);

    statTotal.textContent = `Total: ${total}`;
    statPending.textContent = `Pendientes: ${pending}`;
    statDone.textContent = `Hechas: ${completed}`;
  }

  // Helper para formato de fecha de vencimiento
  function getDueLabel(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `Venció hace ${Math.abs(diffDays)}d`, isOverdue: true };
    if (diffDays === 0) return { label: 'Vence hoy', isOverdue: false };
    if (diffDays === 1) return { label: 'Vence mañana', isOverdue: false };
    return { label: `Faltan ${diffDays}d`, isOverdue: false };
  }

  // Render principal del tablero
  function render() {
    taskList.innerHTML = '';

    // Filtrado combinado por estado y búsqueda
    let filtered = tasks.slice().sort((a, b) => a.order - b.order);

    if (currentFilter === 'pending') filtered = filtered.filter(t => !t.completed);
    if (currentFilter === 'completed') filtered = filtered.filter(t => t.completed);

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;

      filtered.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.id = `item-${task.id}`;
        li.setAttribute('draggable', 'true');
        li.dataset.id = task.id;

        const dueInfo = getDueLabel(task.dueDate);
        const dueHtml = dueInfo 
          ? `<span class="due-tag ${dueInfo.isOverdue ? 'overdue' : ''}">📅 ${dueInfo.label}</span>`
          : '';

        li.innerHTML = `
          <span class="drag-handle" title="Arrastra para reordenar" aria-hidden="true">⋮⋮</span>
          <div class="task-main">
            <input 
              type="checkbox" 
              class="task-checkbox" 
              id="chk-${task.id}" 
              ${task.completed ? 'checked' : ''} 
              aria-label="Marcar como hecha"
            >
            <div class="task-details">
              <span class="task-title" title="Doble clic para editar">${escapeHtml(task.title)}</span>
              <div class="task-badges">
                <span class="tag-badge">#${task.category}</span>
                <span class="priority-tag priority-${task.priority}">${task.priority}</span>
                ${dueHtml}
              </div>
            </div>
          </div>
          <div class="task-actions">
            <button class="btn-icon btn-edit" title="Editar tarea (Enter)">✎</button>
            <button class="btn-icon btn-delete" title="Eliminar tarea">&times;</button>
          </div>
        `;

        // Evento checkbox
        const chk = li.querySelector('.task-checkbox');
        chk.addEventListener('change', () => toggleTask(task.id));

        // Evento eliminar
        const delBtn = li.querySelector('.btn-delete');
        delBtn.addEventListener('click', () => deleteTask(task.id));

        // Evento edición en línea (Click en botón o doble clic en el texto)
        const editBtn = li.querySelector('.btn-edit');
        const titleSpan = li.querySelector('.task-title');
        editBtn.addEventListener('click', () => startInlineEdit(task.id, titleSpan));
        titleSpan.addEventListener('dblclick', () => startInlineEdit(task.id, titleSpan));

        // Listeners para HTML5 Drag and Drop
        setupDragAndDrop(li);

        taskList.appendChild(li);
      });
    }

    updateAnalytics();
  }

  // Edición Inline al vuelo
  function startInlineEdit(id, textElement) {
    const currentTitle = textElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = currentTitle;

    textElement.replaceWith(input);
    input.focus();
    input.select();

    function finishEdit() {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentTitle) {
        tasks = tasks.map(t => t.id === id ? { ...t, title: newTitle } : t);
        saveState();
      }
      render();
    }

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finishEdit();
      if (e.key === 'Escape') render();
    });
  }

  // Configuración de Drag and Drop
  function setupDragAndDrop(item) {
    item.addEventListener('dragstart', (e) => {
      draggedTaskId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const targetId = item.dataset.id;

      if (draggedTaskId && targetId && draggedTaskId !== targetId) {
        reorderTasks(draggedTaskId, targetId);
      }
    });
  }

  // Reordenar posiciones del arreglo
  function reorderTasks(fromId, toId) {
    const fromIndex = tasks.findIndex(t => t.id === fromId);
    const toIndex = tasks.findIndex(t => t.id === toId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const [movedItem] = tasks.splice(fromIndex, 1);
      tasks.splice(toIndex, 0, movedItem);

      // Reindexar orden
      tasks.forEach((t, i) => t.order = i);
      saveState();
      render();
    }
  }

  // Crear tarea
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    if (!title) return;

    const newTask = {
      id: 'tf-' + Date.now(),
      title: title,
      category: categorySelect.value,
      priority: prioritySelect.value,
      dueDate: dueDateInput.value,
      completed: false,
      order: tasks.length
    };

    tasks.unshift(newTask);
    tasks.forEach((t, i) => t.order = i);

    saveState();
    render();
    playBeep('success');

    taskForm.reset();
    prioritySelect.value = 'media';
    categorySelect.value = 'dev';
    taskInput.focus();
  });

  // Alternar completado
  function toggleTask(id) {
    tasks = tasks.map(t => {
      if (t.id === id) {
        const nextState = !t.completed;
        if (nextState) playBeep('success');
        return { ...t, completed: nextState };
      }
      return t;
    });
    saveState();
    render();
  }

  // Eliminar tarea
  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    playBeep('danger');
    saveState();
    render();
  }

  // Limpiar terminadas
  clearCompletedBtn.addEventListener('click', () => {
    tasks = tasks.filter(t => !t.completed);
    saveState();
    render();
  });

  // Filtros de estado
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');
      currentFilter = chip.dataset.filter;
      render();
    });
  });

  // Búsqueda interactiva en tiempo real
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  // Exportar a JSON
  exportBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `taskflow_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Importar desde JSON
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          tasks = imported;
          saveState();
          render();
          alert('¡Tareas importadas con éxito!');
        } else {
          alert('Formato JSON no válido.');
        }
      } catch {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Inicialización
  render();
});