const express = require('express')
const router  = express.Router()
const { pool } = require('../db')
const cache    = require('../cache')

const CACHE_KEY = 'tasks:all'
const CACHE_TTL = 60 // seconds

// GET /api/tasks — returns all tasks; supports ?search=, ?priority=, ?task_type=, ?assignee=
router.get('/', async (req, res) => {
  try {
    const { search, priority, task_type, assignee } = req.query
    const conditions = []
    const values = []

    if (search)    { values.push(`%${search}%`); conditions.push(`title ILIKE $${values.length}`) }
    if (priority)  { values.push(priority);       conditions.push(`priority = $${values.length}`) }
    if (task_type) { values.push(task_type);      conditions.push(`task_type = $${values.length}`) }
    if (assignee)  { values.push(assignee);       conditions.push(`assignee = $${values.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    // Only serve from cache when no filters are active
    if (!values.length) {
      const cached = await cache.get(CACHE_KEY)
      if (cached) return res.json(JSON.parse(cached))
    }

    const { rows } = await pool.query(
      `SELECT * FROM tasks ${where} ORDER BY created_at DESC`,
      values
    )

    if (!values.length) {
      await cache.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(rows))
    }

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks — create a new task
router.post('/', async (req, res) => {
  const {
    title,
    description = '',
    status      = 'To Do',
    assignee    = '',
    priority    = 'Medium',
    task_type   = 'Task',
    labels      = [],
    due_date    = null,
  } = req.body

  if (!title) return res.status(400).json({ error: 'title is required' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (title, description, status, assignee, priority, task_type, labels, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, status, assignee, priority, task_type, labels, due_date || null]
    )
    await cache.del(CACHE_KEY)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/tasks/:id — update all fields
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const {
    title,
    description = '',
    status      = 'To Do',
    assignee    = '',
    priority    = 'Medium',
    task_type   = 'Task',
    labels      = [],
    due_date    = null,
  } = req.body

  try {
    const { rows } = await pool.query(
      `UPDATE tasks
       SET title=$1, description=$2, status=$3, assignee=$4,
           priority=$5, task_type=$6, labels=$7, due_date=$8
       WHERE id=$9 RETURNING *`,
      [title, description, status, assignee, priority, task_type, labels, due_date || null, id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Task not found' })
    await cache.del(CACHE_KEY)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM tasks WHERE id=$1', [id])
    await cache.del(CACHE_KEY)
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
