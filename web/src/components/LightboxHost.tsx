import { useEffect, useLayoutEffect, useState } from "react";
import { useLayer } from "../hooks/useLayer";
import {
  attachLightboxHost,
  mountLightboxDialog,
  type LightboxPayload,
} from "../lib/lightbox";

/**
 * 全局灯箱宿主，挂在路由之外（任何页面都在）。
 *
 * 灯箱"开没开"完全由 `useLayer` 从 location 派生，所以系统返回手势、Esc、点遮罩、点关闭
 * 按钮全部收敛到 `close()` = `navigate(-1)` 这一条路（规则 3）。本组件只额外持有"看什么"
 * ——图集与当前张，它不参与开关判定，因此不构成与历史栈并行的第二套真相源。
 *
 * 用 `useLayoutEffect` 挂载：灯箱要赶在本次提交绘制前上屏，避免开关时闪一下底层页面。
 */
export function LightboxHost() {
  const { isOpen, open, close } = useLayer("lightbox");
  const [payload, setPayload] = useState<LightboxPayload | null>(null);

  useEffect(
    () =>
      attachLightboxHost({
        open: (next) => {
          setPayload(next);
          open();
        },
      }),
    [open],
  );

  useLayoutEffect(() => {
    if (!isOpen || !payload) return;
    return mountLightboxDialog(payload, close);
  }, [isOpen, payload, close]);

  return null;
}
