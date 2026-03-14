-- ============================================================
-- CRM HCP Module - Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS crm_hcp;
USE crm_hcp;

-- HCP (Healthcare Professional) Master Table
CREATE TABLE IF NOT EXISTS hcps (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    specialty   VARCHAR(255),
    hospital    VARCHAR(255),
    city        VARCHAR(100),
    email       VARCHAR(255),
    phone       VARCHAR(50),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interactions Log Table
CREATE TABLE IF NOT EXISTS interactions (
    id                  SERIAL PRIMARY KEY,
    hcp_id              INTEGER REFERENCES hcps(id) ON DELETE SET NULL,
    hcp_name            VARCHAR(255) NOT NULL,        -- denormalized for quick access
    hospital            VARCHAR(255),
    interaction_type    VARCHAR(100) DEFAULT 'Meeting',
    interaction_date    DATE NOT NULL,
    interaction_time    TIME,
    attendees           TEXT,                          -- comma-separated or JSON
    topics_discussed    TEXT,
    materials_shared    TEXT,                          -- JSON array
    samples_distributed TEXT,                          -- JSON array
    sentiment           VARCHAR(50) DEFAULT 'Neutral', -- Positive / Neutral / Negative
    outcomes            TEXT,
    follow_up_actions   TEXT,
    follow_up_date      DATE,
    ai_summary          TEXT,                          -- LLM-generated summary
    source              VARCHAR(50) DEFAULT 'form',    -- 'form' | 'chat'
    raw_input           TEXT,                          -- original chat message if source=chat
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Suggestions Log
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id              SERIAL PRIMARY KEY,
    interaction_id  INTEGER REFERENCES interactions(id) ON DELETE CASCADE,
    hcp_name        VARCHAR(255),
    suggestion_type VARCHAR(100),   -- 'follow_up' | 'product' | 'material'
    suggestion_text TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed some HCPs for demo
INSERT INTO hcps (name, specialty, hospital, city) VALUES
  ('Dr. Priya Sharma',    'Endocrinologist',  'Apollo Hospital',      'Mumbai'),
  ('Dr. Rajesh Verma',    'Cardiologist',     'Fortis Hospital',      'Delhi'),
  ('Dr. Anita Menon',     'Oncologist',       'AIIMS',                'Delhi'),
  ('Dr. Suresh Patel',    'Diabetologist',    'Medanta Hospital',     'Gurugram'),
  ('Dr. Kavita Reddy',    'Neurologist',      'Manipal Hospital',     'Bangalore')
ON CONFLICT DO NOTHING;
