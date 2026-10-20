import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产构建由 GitHub Actions 完成，服务器只接收 .next/standalone 产物。
  // 本地 npm run build / npm start 保持默认输出；CI 通过 NEXT_STANDALONE=1 开启。
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  // 腾讯云 SDK 是 CommonJS 且带动态依赖，交给 Node 运行时加载，避免被 bundler 处理
  serverExternalPackages: ["tencentcloud-sdk-nodejs-asr"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
    // 关闭动态页面（/learn、/plan 等）的客户端 Router Cache：
    // 复习/签到等操作后，30 秒内客户端导航会复用旧 RSC 载荷，导致队列/摘要过期（反馈 #14）。
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
