import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
