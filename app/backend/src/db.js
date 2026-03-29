const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Run on startup — creates table on fresh install, migrates existing installs safely
async function initDB() {
  // Fresh install: create with full schema
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(255) NOT NULL,
      description TEXT         DEFAULT '',
      status      VARCHAR(50)  DEFAULT 'To Do',
      assignee    VARCHAR(100) DEFAULT '',
      priority    VARCHAR(20)  DEFAULT 'Medium',
      task_type   VARCHAR(30)  DEFAULT 'Task',
      labels      TEXT[]       DEFAULT '{}',
      due_date    DATE,
      done        BOOLEAN      DEFAULT false,
      created_at  TIMESTAMP    DEFAULT NOW()
    )
  `)

  // Migration: add new columns to existing installs (safe — IF NOT EXISTS)
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status    VARCHAR(50)  DEFAULT 'To Do'`)
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee  VARCHAR(100) DEFAULT ''`)
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority  VARCHAR(20)  DEFAULT 'Medium'`)
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(30)  DEFAULT 'Task'`)
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels    TEXT[]       DEFAULT '{}'`)
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date  DATE`)

  // Migrate legacy done=true rows to status='Done'
  await pool.query(`UPDATE tasks SET status = 'Done' WHERE done = true AND status = 'To Do'`)

  console.log('Database ready')
}

module.exports = { pool, initDB }
