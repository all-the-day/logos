// PM2 配置：由 deploy/remote-deploy.sh 同步到 /root/logos/shared/ 后使用
// 运行时环境变量统一从 /root/logos/shared/.env 读取（唯一真源，不进代码目录）
const fs = require("fs");
const path = require("path");

const BASE = "/root/logos";
const ENV_FILE = path.join(BASE, "shared/.env");

function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: "logos",
      cwd: path.join(BASE, "current"),
      script: "server.js", // .next/standalone 产物
      // 这台机器只有 1.6G 内存且还与其它应用共享，给 Node 堆设上限，宁可自己重启也别拖死整机
      node_args: "--max-old-space-size=512",
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOSTNAME: "127.0.0.1",
        ...readEnvFile(ENV_FILE),
      },
    },
  ],
};
