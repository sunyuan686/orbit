/**
 * CompanionScheduler — Durable Object
 *
 * 替代 Cron Trigger，用 DO Alarm 实现动态调度：
 *  - alarm()      时间到了自动触发，跑完引擎后自己算下次窗口再 setAlarm
 *  - reschedule() 用户改完配置后调用，立即重算并更新 alarm
 *  - status()     返回当前 alarm 时间，供设置页展示
 *
 * 全局唯一实例，通过 getByName("companion") 访问。
 */

import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { runCompanionEngine, isQuietHours } from "./companion-engine.js";
import { deliverCompanionCard } from "./feishu-companion-card.js";
import { readSettingsMap } from "../db/settings-store.js";

// ─── 时间窗口计算 ─────────────────────────────────────────────────────────────

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

/**
 * 根据当前时间和安静时段配置，计算下次合法投递检查时间（毫秒时间戳）。
 *
 * 策略：
 *  - 若现在不在安静时段 → 1 小时后再检查（覆盖各场景的投递窗口判断）
 *  - 若现在在安静时段 → 精确跳到安静时段结束后 5 分钟
 */
function calcNextAlarmMs(
  nowMs: number,
  quietStartMinutes: number,  // e.g. 22*60+30
  quietEndMinutes: number,    // e.g. 8*60+30
  pushStartMinutes = 9 * 60,   // e.g. 9*60 (09:00)
  pushEndMinutes = 21 * 60 + 30 // e.g. 21*60+30 (21:30)
): number {
  const nowTs = Math.floor(nowMs / 1000);

  if (!isQuietHoursCustom(nowTs, quietStartMinutes, quietEndMinutes)) {
    // 不在安静时段，1 小时后检查
    return nowMs + 60 * 60 * 1000;
  }

  // 在安静时段，跳到结束后 5 分钟
  const d = new Date(nowMs + BEIJING_OFFSET_MS);
  const currentMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();

  let minutesUntilEnd: number;
  if (quietStartMinutes > quietEndMinutes) {
    // 跨午夜
    if (currentMinutes >= quietStartMinutes) {
      minutesUntilEnd = 24 * 60 - currentMinutes + quietEndMinutes;
    } else {
      minutesUntilEnd = quietEndMinutes - currentMinutes;
    }
  } else {
    minutesUntilEnd = quietEndMinutes - currentMinutes;
  }

  return nowMs + (minutesUntilEnd + 5) * 60 * 1000;
}

function isQuietHoursCustom(
  nowTs: number,
  quietStartMinutes: number,
  quietEndMinutes: number
): boolean {
  const d = new Date((nowTs + 8 * 3600) * 1000);
  const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (quietStartMinutes > quietEndMinutes) {
    return m >= quietStartMinutes || m < quietEndMinutes;
  }
  return m >= quietStartMinutes && m < quietEndMinutes;
}

// ─── DO 类 ────────────────────────────────────────────────────────────────────

export interface CompanionSchedulerEnv {
  DB: D1Database;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}

export class CompanionScheduler extends DurableObject<CompanionSchedulerEnv> {
  constructor(ctx: DurableObjectState, env: CompanionSchedulerEnv) {
    super(ctx, env);
  }

  // ─── 读取安静时段配置 ───────────────────────────────────────────────────────

  private async loadTimeSettings(): Promise<{
    startMinutes: number;
    endMinutes: number;
    pushStartMinutes: number;
    pushEndMinutes: number;
  }> {
    const db = drizzle(this.env.DB, { schema });
    const settingsMap = await readSettingsMap(db);

    const parseTime = (raw: string | undefined, fallback: number): number => {
      if (!raw) return fallback;
      const [h, m] = raw.split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return fallback;
      return h * 60 + m;
    };

    return {
      startMinutes: parseTime(settingsMap["companion_quiet_start"], 22 * 60 + 30),
      endMinutes: parseTime(settingsMap["companion_quiet_end"], 8 * 60 + 30),
      pushStartMinutes: parseTime(settingsMap["companion_push_start"], 9 * 60),
      pushEndMinutes: parseTime(settingsMap["companion_push_end"], 21 * 60 + 30),
    };
  }

  // ─── Alarm handler ──────────────────────────────────────────────────────────

  override async alarm(): Promise<void> {
    const nowTs = Math.floor(Date.now() / 1000);
    const db = drizzle(this.env.DB, { schema });

    const { startMinutes, endMinutes, pushStartMinutes, pushEndMinutes } = await this.loadTimeSettings();

    // 安静时段内跳过执行（直接 reschedule 到结束后）
    if (!isQuietHoursCustom(nowTs, startMinutes, endMinutes)) {
      const aiEnv = {
        AI: this.env.AI,
        BETTER_AUTH_SECRET: this.env.BETTER_AUTH_SECRET,
        CF_ACCOUNT_ID: this.env.CF_ACCOUNT_ID,
        CF_API_TOKEN: this.env.CF_API_TOKEN,
      };

      try {
        const result = await runCompanionEngine(db, nowTs);

        for (const candidate of result.dispatched) {
          await deliverCompanionCard(
            candidate,
            {
              db,
              secret: this.env.BETTER_AUTH_SECRET,
              baseUrl: this.env.BETTER_AUTH_URL,
              aiEnv,
            },
            nowTs
          ).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            const code = (err as any)?.code !== undefined ? ` (code=${(err as any).code})` : "";
            console.error(`[CompanionScheduler] deliver error: ${msg}${code}`, err instanceof Error ? err.stack : err);
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[CompanionScheduler] engine error: ${msg}`, err instanceof Error ? err.stack : err);
        // alarm 会自动重试，这里不 rethrow 避免无限快速重试
      }
    }

    // 无论是否执行，都 reschedule 下次
    const nextMs = calcNextAlarmMs(Date.now(), startMinutes, endMinutes, pushStartMinutes, pushEndMinutes);
    await this.ctx.storage.setAlarm(nextMs);
  }

  // ─── RPC：重设 alarm（用户改配置后调用） ────────────────────────────────────

  async reschedule(): Promise<{ nextAlarmAt: number }> {
    const { startMinutes, endMinutes, pushStartMinutes, pushEndMinutes } = await this.loadTimeSettings();
    const nextMs = calcNextAlarmMs(Date.now(), startMinutes, endMinutes, pushStartMinutes, pushEndMinutes);
    await this.ctx.storage.setAlarm(nextMs);
    return { nextAlarmAt: nextMs };
  }

  // ─── RPC：查询当前 alarm 状态 ────────────────────────────────────────────────

  async status(): Promise<{ nextAlarmAt: number | null }> {
    const alarm = await this.ctx.storage.getAlarm();
    return { nextAlarmAt: alarm };
  }

  // ─── RPC：首次启动（部署后调用一次） ────────────────────────────────────────

  async bootstrap(): Promise<{ nextAlarmAt: number }> {
    const existing = await this.ctx.storage.getAlarm();
    if (existing) return { nextAlarmAt: existing };
    return this.reschedule();
  }
}
