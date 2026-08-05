"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UserInfo {
  id: number;
  email: string;
  name: string;
  role: string;
}

export default function AdminClient({ user }: { user: UserInfo }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">后台管理</h1>
          <p className="text-sm text-muted-foreground">{user.name} · {user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/plan")}>
            返回
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            退出
          </Button>
        </div>
      </div>

      <AccountAdminCard />
      <ImportBooksCard />
    </div>
  );
}

function AccountAdminCard() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: number; email: string; name: string; role: string; createdAt: string }>>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!email || !name || !password) {
      setNotice("请填写邮箱、昵称和密码");
      setTimeout(() => setNotice(null), 3000);
      return;
    }
    if (password.length < 6) {
      setNotice("密码至少 6 位");
      setTimeout(() => setNotice(null), 3000);
      return;
    }
    setCreating(true);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setNotice("账号创建成功");
        setEmail(""); setName(""); setPassword("");
        const usersRes = await fetch("/api/users");
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      } else {
        setNotice(data?.error || "创建失败");
      }
    } catch {
      setNotice("网络错误");
    }
    setCreating(false);
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">账号管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <input
            type="email"
            placeholder="邮箱"
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="text"
            placeholder="昵称"
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="password"
            placeholder="初始密码（至少 6 位）"
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button className="w-full" size="sm" onClick={handleCreate} disabled={creating}>
            {creating ? "创建中..." : "创建账号"}
          </Button>
          {notice && (
            <p className={`text-sm ${notice.includes("成功") ? "text-green-600" : "text-red-600"}`}>{notice}</p>
          )}
        </div>

        {users.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <p className="text-xs text-muted-foreground">用户列表 ({users.length})</p>
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-secondary/40">
                <div className="min-w-0">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground text-xs ml-2">{u.email}</span>
                </div>
                <span className={`text-xs ${u.role === "admin" ? "text-primary" : "text-muted-foreground"}`}>
                  {u.role === "admin" ? "管理员" : "用户"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImportBooksCard() {
  const router = useRouter();
  const [books, setBooks] = useState<Array<{ id: number; name: string; chapters: number; imported: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<number | null>(null);
  const [selectedNt, setSelectedNt] = useState<number>(0);
  const [selectedOt, setSelectedOt] = useState<number>(0);
  const [lastImported, setLastImported] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const showNotice = useCallback((msg: string, ms = 3000) => {
    setLastImported(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setLastImported(null), ms);
  }, []);

  useEffect(() => {
    fetch("/api/book/import")
      .then((r) => r.json())
      .then((d) => setBooks(d.books || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleImport = useCallback(async (bookId: number, name: string) => {
    setImporting(bookId);
    try {
      const res = await fetch("/api/book/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (res.ok) {
        setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, imported: true } : b));
        showNotice(name, 3000);
        setSelectedNt(0);
        setSelectedOt(0);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        console.error("导入失败", data?.error || res.status);
        showNotice(`导入失败：${data?.error || res.status}`, 4000);
      }
    } catch (e) {
      console.error("导入请求异常", e);
      showNotice("导入失败：网络错误", 4000);
    }
    setImporting(null);
  }, [router, showNotice]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">导入书卷</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-spin">◌</span> 加载书卷列表...
          </div>
        </CardContent>
      </Card>
    );
  }

  const imported = books.filter((b) => b.imported);
  const notImported = books.filter((b) => !b.imported);
  const otAvail = notImported.filter((b) => b.id <= 39);
  const ntAvail = notImported.filter((b) => b.id > 39);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">导入书卷</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          已导入 {imported.length}/66 卷
          {lastImported && (
            <span className={cn("ml-2", lastImported.startsWith("导入失败") ? "text-red-600" : "text-green-600")}>
              {lastImported.startsWith("导入失败") ? "✗ " : "✓ "}
              {lastImported}
            </span>
          )}
        </p>
        {importing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <span className="animate-spin inline-block">⟳</span> 正在导入经文、注解和 KJV 对照...
          </div>
        )}
        {notImported.length === 0 ? (
          <p className="text-sm text-muted-foreground">全部 66 卷已导入 ✓</p>
        ) : (
          <div className="space-y-4">
            {ntAvail.length > 0 && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">新约</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                    value={selectedNt}
                    onChange={(e) => setSelectedNt(Number(e.target.value))}
                    disabled={importing !== null}
                  >
                    <option value={0} disabled>选择新约书卷...</option>
                    {ntAvail.map((b) => (
                      <option key={`nt-${b.id}`} value={b.id}>
                        {b.name}（{b.chapters} 章）
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm"
                  disabled={!selectedNt || importing !== null}
                  onClick={() => {
                    const b = ntAvail.find((x) => x.id === selectedNt);
                    if (b) handleImport(b.id, b.name);
                  }}>
                  {importing ? (
                    <span className="flex items-center gap-1">
                      <span className="animate-spin inline-block">⟳</span> 导入中
                    </span>
                  ) : "导入"}
                </Button>
              </div>
            )}
            {otAvail.length > 0 && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">旧约</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                    value={selectedOt}
                    onChange={(e) => setSelectedOt(Number(e.target.value))}
                    disabled={importing !== null}
                  >
                    <option value={0} disabled>选择旧约书卷...</option>
                    {otAvail.map((b) => (
                      <option key={`ot-${b.id}`} value={b.id}>
                        {b.name}（{b.chapters} 章）
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm"
                  disabled={!selectedOt || importing !== null}
                  onClick={() => {
                    const b = otAvail.find((x) => x.id === selectedOt);
                    if (b) handleImport(b.id, b.name);
                  }}>
                  {importing ? (
                    <span className="flex items-center gap-1">
                      <span className="animate-spin inline-block">⟳</span> 导入中
                    </span>
                  ) : "导入"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
