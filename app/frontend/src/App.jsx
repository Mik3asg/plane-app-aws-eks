import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import './App.css'

const API = '/api/tasks'

const COLUMNS    = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done']
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low']
const TASK_TYPES = ['Task', 'Bug', 'Feature', 'Improvement']
const LABELS     = ['Bug', 'Feature', 'Improvement', 'Tech Debt', 'Documentation', 'Design', 'Research', 'Refactor']

const PRIORITY_COLOR = { Urgent: '#ef4444', High: '#f97316', Medium: '#3b82f6', Low: '#9ca3af' }
const COLUMN_COLOR   = { Backlog: '#6b7280', 'To Do': '#3b82f6', 'In Progress': '#f59e0b', Review: '#8b5cf6', Done: '#10b981' }
const TYPE_ICON      = { Task: '📋', Bug: '🐛', Feature: '✨', Improvement: '🔧' }

const EMPTY_TASK = {
  title: '', description: '', status: 'To Do', assignee: '',
  priority: 'Medium', task_type: 'Task', labels: [], due_date: '',
}

// ── Task Modal ──────────────────────────────────────────────────────────────
function TaskModal({ task, onSave, onClose }) {
  const [form, setForm] = useState({ ...task, labels: task.labels || [] })

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const toggleLabel = (label) =>
    set('labels', form.labels.includes(label)
      ? form.labels.filter(l => l !== label)
      : [...form.labels, label])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task.id ? 'Edit Task' : 'New Task'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="modal-form">
          <label>Title *
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Task title" required />
          </label>
          <label>Description
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Detailed description..." rows={3} />
          </label>
          <div className="modal-row">
            <label>Status
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {COLUMNS.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Priority
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <div className="modal-row">
            <label>Task Type
              <select value={form.task_type} onChange={e => set('task_type', e.target.value)}>
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Assignee
              <input value={form.assignee} onChange={e => set('assignee', e.target.value)}
                placeholder="e.g. alice" />
            </label>
          </div>
          <label>Due Date
            <input type="date" value={form.due_date || ''}
              onChange={e => set('due_date', e.target.value)} />
          </label>
          <label>Labels
            <div className="label-picker">
              {LABELS.map(label => (
                <button key={label} type="button"
                  className={`label-chip ${form.labels.includes(label) ? 'active' : ''}`}
                  onClick={() => toggleLabel(label)}>
                  {label}
                </button>
              ))}
            </div>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {task.id ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Task Card ───────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete, innerRef, draggableProps, dragHandleProps, isDragging }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done'
  const pc = PRIORITY_COLOR[task.priority] || '#9ca3af'

  return (
    <div ref={innerRef} {...draggableProps} {...dragHandleProps}
      className={`task-card ${isDragging ? 'dragging' : ''}`}>
      <div className="card-top">
        <span className="card-type-icon">{TYPE_ICON[task.task_type] || '📋'}</span>
        <span className="card-title">{task.title}</span>
        <div className="card-actions">
          <button onClick={() => onEdit(task)} title="Edit">✏️</button>
          <button onClick={() => onDelete(task.id)} title="Delete">✕</button>
        </div>
      </div>
      {task.description && <p className="card-desc">{task.description}</p>}
      <div className="card-meta">
        <span className="priority-badge"
          style={{ background: pc + '18', color: pc, border: `1px solid ${pc}40` }}>
          {task.priority}
        </span>
        {task.assignee && <span className="assignee-chip">👤 {task.assignee}</span>}
        {task.due_date && (
          <span className={`due-chip ${isOverdue ? 'overdue' : ''}`}>
            📅 {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
      {task.labels && task.labels.length > 0 && (
        <div className="card-labels">
          {task.labels.map(l => <span key={l} className="label-tag">{l}</span>)}
        </div>
      )}
    </div>
  )
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [modal,   setModal]   = useState(null)
  const [filters, setFilters] = useState({ search: '', priority: '', task_type: '', assignee: '' })

  const fetchTasks = async () => {
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error('Failed to load tasks')
      setTasks(await res.json())
    } catch (e) { setError(e.message) }
    finally     { setLoading(false)   }
  }

  useEffect(() => { fetchTasks() }, [])

  const openCreate = (status = 'To Do') => setModal({ task: { ...EMPTY_TASK, status } })
  const openEdit   = (task) => setModal({ task: { ...task, due_date: task.due_date ? task.due_date.split('T')[0] : '', labels: task.labels || [] } })
  const closeModal = () => setModal(null)

  const saveTask = async (form) => {
    const method = form.id ? 'PUT' : 'POST'
    const url    = form.id ? `${API}/${form.id}` : API
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    closeModal()
    fetchTasks()
  }

  const deleteTask = async (id) => {
    if (!confirm('Delete this task?')) return
    await fetch(`${API}/${id}`, { method: 'DELETE' })
    fetchTasks()
  }

  const handleDragEnd = async ({ draggableId, destination }) => {
    if (!destination) return
    const task = tasks.find(t => String(t.id) === draggableId)
    if (!task || task.status === destination.droppableId) return
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: destination.droppableId } : t))
    await fetch(`${API}/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: destination.droppableId }),
    })
  }

  const setFilter    = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const resetFilters = () => setFilters({ search: '', priority: '', task_type: '', assignee: '' })
  const hasFilters   = Object.values(filters).some(Boolean)

  const filtered = tasks.filter(t => {
    if (filters.search    && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.priority  && t.priority  !== filters.priority)  return false
    if (filters.task_type && t.task_type !== filters.task_type) return false
    if (filters.assignee  && t.assignee  !== filters.assignee)  return false
    return true
  })

  const assignees = [...new Set(tasks.map(t => t.assignee).filter(Boolean))]
  const done      = filtered.filter(t => t.status === 'Done').length

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-left">
          <h1>TaskBoard</h1>
          <span className="header-sub">Kanban Board</span>
        </div>
        <div className="header-center">
          <span className="header-stats">{done} / {filtered.length} done</span>
        </div>
        <div className="header-right">
          <button className="btn-primary" onClick={() => openCreate()}>+ New Task</button>
        </div>
      </header>

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <input className="filter-search" placeholder="🔍  Search tasks…"
          value={filters.search} onChange={e => setFilter('search', e.target.value)} />
        <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={filters.task_type} onChange={e => setFilter('task_type', e.target.value)}>
          <option value="">All Types</option>
          {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filters.assignee} onChange={e => setFilter('assignee', e.target.value)}>
          <option value="">All Assignees</option>
          {assignees.map(a => <option key={a}>{a}</option>)}
        </select>
        {hasFilters && <button className="btn-reset" onClick={resetFilters}>✕ Reset</button>}
      </div>

      {error   && <p className="error">{error}</p>}
      {loading && <p className="loading">Loading…</p>}

      {/* ── Kanban Board ── */}
      {!loading && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="board">
            {COLUMNS.map(col => {
              const colTasks = filtered.filter(t => t.status === col)
              return (
                <div key={col} className="column">
                  <div className="column-header">
                    <span className="col-dot" style={{ background: COLUMN_COLOR[col] }} />
                    <span className="col-title">{col}</span>
                    <span className="col-count">{colTasks.length}</span>
                    <button className="col-add" onClick={() => openCreate(col)} title="Add task">+</button>
                  </div>
                  <Droppable droppableId={col}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}
                        className={`column-body ${snapshot.isDraggingOver ? 'drag-over' : ''}`}>
                        {colTasks.map((task, i) => (
                          <Draggable key={task.id} draggableId={String(task.id)} index={i}>
                            {(provided, snapshot) => (
                              <TaskCard
                                task={task}
                                onEdit={openEdit}
                                onDelete={deleteTask}
                                innerRef={provided.innerRef}
                                draggableProps={provided.draggableProps}
                                dragHandleProps={provided.dragHandleProps}
                                isDragging={snapshot.isDragging}
                              />
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="col-empty">Drop tasks here</div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {/* ── Modal ── */}
      {modal && <TaskModal task={modal.task} onSave={saveTask} onClose={closeModal} />}

      {/* ── Footer ── */}
      <footer className="app-footer">
        <div className="footer-credit">
          Created by <strong>Mickael Asghar</strong> · Cloud DevOps Engineer
        </div>
        <div className="footer-stack">
          <span>⚛️ React 18</span>
          <span>⚡ Vite</span>
          <span>🟢 Node.js</span>
          <span>🐘 PostgreSQL 15</span>
          <span>🔴 Redis 7</span>
          <span>☸️ AWS EKS 1.32</span>
          <span>🏗️ Terraform</span>
          <span>🔄 ArgoCD</span>
          <span>🚀 GitHub Actions</span>
        </div>
      </footer>
    </div>
  )
}
