/**
 * 导航呈现层（Navigation Presentation Layer）
 *
 * 不变量：任何可被系统返回手势关闭的界面，都必须对应一个 React Router 创建的历史条目。
 *
 * 系统返回手势（Android 返回键/手势、iOS 独立 PWA 左边缘滑动）本质是浏览器联合会话
 * 历史栈的 back 操作，不是 JS 事件。因此"浮层能否被返回手势关闭"完全等价于"浮层是否
 * 存在于历史栈中"。本模块是该不变量的唯一载体：呈现层的开关状态全部由 location 派生，
 * 不存在与历史栈并行的第二套 useState 真相源。
 *
 * 层级模型：
 *   - 页面层 page：URL 路径条目（如 /albums/:id）
 *   - 呈现层 layer：同 URL 条目 + location.state.layers（搜索、抽屉、选择器等瞬时界面）
 *
 * 每个条目携带**完整的层栈快照**（自底向上）。这是嵌套正确性所必需的：外层浮层在
 * 内层打开期间必须继续渲染，因此"层是否可见"不能退化为"层是不是最上层"。栈快照让
 * 每个条目自证它当时处在第几层，回退时自然回到上一层，前进时自然恢复内层。
 *
 * 历史条目的记账权属于 React Router（history.state = { usr, key, idx }）。业务层严禁手写
 * window.history.*，否则 idx 断链会让路由拦截器静默失效；本模块只负责构造状态，写入一律
 * 经由 router 的导航 API。
 *
 * 两条挂载约束：
 *   1. 一个 key 只能由一个挂载点渲染。同一组件的两处挂载（如外壳底栏的创作抽屉与首页信息
 *      流内的同名抽屉）必须使用不同 key，否则同一层会被两个实例同时打开。
 *   2. 层必须在它可能成为当前条目的所有路由下保持挂载，否则条目会被弹到一个无人渲染的层，
 *      表现为"按一次返回没反应"。
 *
 * 本文件保持纯函数、无 React 依赖，便于单测。
 */

/** 呈现层声明，key 唯一标识一个可被返回手势关闭的界面 */
export interface LayerSpec {
  key: string;
}

type StateRecord = Record<string, unknown>;

const LAYERS_FIELD = "layers";

function asRecord(state: unknown): StateRecord {
  return typeof state === "object" && state !== null && !Array.isArray(state)
    ? (state as StateRecord)
    : {};
}

/** 读取条目携带的层栈（自底向上）；无层或结构非法时返回空数组 */
export function readLayers(state: unknown): LayerSpec[] {
  const raw = asRecord(state)[LAYERS_FIELD];
  if (!Array.isArray(raw)) return [];
  const stack: LayerSpec[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const key = (item as StateRecord).key;
    if (typeof key === "string" && key !== "") stack.push({ key });
  }
  return stack;
}

/** 当前条目的最上层呈现层；无层时返回 undefined */
export function topLayer(state: unknown): LayerSpec | undefined {
  const stack = readLayers(state);
  return stack.length > 0 ? stack[stack.length - 1] : undefined;
}

/**
 * 在当前条目状态上压入一层，保留既有非层状态（如登录来源 from）与既有层栈。
 * 重复压入同一 key 视为幂等，不产生堆叠。
 */
export function withLayer(state: unknown, key: string): StateRecord {
  const stack = readLayers(state);
  const next = stack.some((layer) => layer.key === key)
    ? stack
    : [...stack, { key } satisfies LayerSpec];
  return { ...asRecord(state), [LAYERS_FIELD]: next };
}

/** 剥离呈现层状态：会话历史条目跨刷新保留，瞬时层不应随之恢复 */
export function withoutLayer(state: unknown): StateRecord {
  const next: StateRecord = { ...asRecord(state) };
  delete next[LAYERS_FIELD];
  return next;
}

/**
 * 把栈顶换成另一层，层级深度不变（栈为空时等同于压入一层）。
 *
 * 用于「离开当前浮层、就地进入另一个浮层」的横向移动，例如全屏编辑器退出时改问
 * 「保存到草稿？」。这类场景若写成「先回退再压入」，两次导航会在同一 tick 内竞争：
 * `history.go(-1)` 是异步任务，`pushState` 同步落地在前，随后那次回退会把刚压入的
 * 条目弹掉，表现为"新浮层根本没出现"。
 */
export function replaceTopLayer(state: unknown, key: string): StateRecord {
  const stack = readLayers(state);
  const next = [
    ...stack.slice(0, Math.max(0, stack.length - 1)),
    { key } satisfies LayerSpec,
  ];
  return { ...asRecord(state), [LAYERS_FIELD]: next };
}

/** 呈现层的同 URL 表示：开关呈现层不改动地址 */
export function sameUrl(location: { pathname: string; search: string }): string {
  return `${location.pathname}${location.search}`;
}

/**
 * 读取条目在 React Router 记账中的序号（`history.state.idx`）。
 *
 * `0` 表示这是 App 内的第一条条目 —— 冷启动直达深链时正是如此，栈里没有可返回的上一层，
 * 返回手势会直接离开 App。把它与「App 内导航后刷新」区分开是根锚点判断的依据：后者的
 * 历史条目仍由本 App 创建（idx > 0），返回是安全的，不需要补锚点。
 *
 * 只读，不写入；写入仍然只能经 router 的导航 API。
 */
export function historyIndex(historyState: unknown): number {
  const idx = (historyState as StateRecord | null)?.idx;
  return typeof idx === "number" && Number.isFinite(idx) ? idx : 0;
}
