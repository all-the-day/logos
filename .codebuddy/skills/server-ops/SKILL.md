---
name: server-ops
description: Logos server deployment & management via SSH. Run status, deploy, restart, seed, view logs, or execute commands on the remote server (124.222.74.115). Uses Python paramiko for SSH, zero external deps after pip install paramiko.
---

# Logos Server Operations

Use this skill to manage the Logos production server.

## Prerequisites

The script requires `paramiko`. It should already be installed; if not:

```bash
python -m pip install paramiko -q
```

## Commands

All commands run from the project root:

```bash
# View server status (PM2, memory, disk, API health)
python .codebuddy/skills/server-ops/scripts/server-ops.py status

# Full deploy: git pull → npm install → build → restart PM2 → verify
python .codebuddy/skills/server-ops/scripts/server-ops.py deploy

# View recent server logs
python .codebuddy/skills/server-ops/scripts/server-ops.py logs

# Re-seed database (import verses from bible.db)
python .codebuddy/skills/server-ops/scripts/server-ops.py seed

# Upload a local file to server
python .codebuddy/skills/server-ops/scripts/server-ops.py upload <local-path> <remote-path>

# Execute arbitrary command (use sparingly, prefer specific commands)
python .codebuddy/skills/server-ops/scripts/server-ops.py exec "<command>"
```

## Server Info

| Field | Value |
|-------|-------|
| IP | 124.222.74.115 |
| App path | /root/logos |
| PM2 name | logos |
| Internal port | 3000 |
| Caddy TLS | :8443 → 3000 |
| Access URL | https://124.222.74.115:8443 |

## When to use each command

- **status** — User asks "server status", "how's the server", "check pm2"
- **deploy** — User pushes code and wants to update production
- **logs** — Debugging errors, user asks "why isn't it working"
- **seed** — After adding bible.db data or resetting database
- **upload** — Transfer files that aren't in git (e.g., updated bible.db)
