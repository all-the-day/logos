import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto p-8 text-center space-y-4 pt-20">
      <p className="text-5xl font-light text-muted-foreground">404</p>
      <p className="text-muted-foreground">页面不存在</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        返回首页
      </Link>
    </div>
  );
}
