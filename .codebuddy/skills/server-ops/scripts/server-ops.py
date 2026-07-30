#!/usr/bin/env python3
"""Logos 服务部署/管理工具 — 通过 paramiko SSH 操作服务器"""
import paramiko, sys, os, json

HOST = "124.222.74.115"
USER = "root"
PWD = "duoban@0118"
PORT = 22

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=USER, password=PWD, timeout=10)
    return c

def run(cmd):
    c = connect()
    _, stdout, stderr = c.exec_command(cmd, timeout=300)
    out = stdout.read().decode()
    err = stderr.read().decode()
    c.close()
    return out, err

# ── Commands ──────────────────────────────────────

def cmd_status():
    c = connect()
    _, out, _ = c.exec_command("pm2 status")
    pm2 = out.read().decode()
    _, out, _ = c.exec_command("free -h | head -2")
    mem = out.read().decode()
    _, out, _ = c.exec_command("df -h / | tail -1")
    disk = out.read().decode()
    _, out, _ = c.exec_command("curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/plan")
    api = out.read().decode()
    c.close()
    print(pm2)
    print(mem.strip())
    print(disk.strip())
    print(f"API status: {api}")

def cmd_deploy():
    print("[1/5] Pulling latest code...")
    out, err = run("cd /root/logos && git pull")
    print(out.strip())

    print("[2/5] Installing dependencies...")
    out, err = run("cd /root/logos && npm install 2>&1")
    print(out.strip()[-200:] if out.strip() else "OK")

    print("[3/5] Building...")
    out, err = run("cd /root/logos && npm run build 2>&1")
    print(out.strip()[-300:])

    print("[4/5] Restarting PM2...")
    out, err = run("cd /root/logos && pm2 restart logos")
    print(out.strip())

    print("[5/5] Verifying...")
    out, err = run("sleep 3 && curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/plan")
    print(f"API: {out.strip()}")
    print("Done!")

def cmd_logs(lines=20):
    c = connect()
    _, out, _ = c.exec_command(f"pm2 logs logos --lines {lines} --nostream 2>&1")
    print(out.read().decode())
    c.close()

def cmd_seed():
    print("Seeding data...")
    out, err = run("cd /root/logos && npx tsx prisma/seed.ts 2>&1")
    print(out.strip())
    print(err.strip()[:200] if err.strip() else "")

def cmd_upload(local, remote):
    c = connect()
    sftp = c.open_sftp()
    print(f"Uploading {local} → {remote}...")
    sftp.put(local, remote)
    sftp.close()
    c.close()
    print("Done")

def cmd_exec(command):
    out, err = run(command)
    if out: print(out)
    if err: print(err[:500])

if __name__ == "__main__":
    cmds = {
        "status": cmd_status,
        "deploy": cmd_deploy,
        "logs": cmd_logs,
        "seed": cmd_seed,
        "upload": lambda: cmd_upload(sys.argv[2], sys.argv[3]),
        "exec": lambda: cmd_exec(" ".join(sys.argv[2:])),
    }
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        print("Usage: python scripts/server-ops.py <command>")
        print("Commands: status, deploy, logs, seed, upload <local> <remote>, exec <cmd>")
        sys.exit(1)
    cmds[sys.argv[1]]()
