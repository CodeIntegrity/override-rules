import { parseBool, parseNumber } from "./utils";
import type { FeatureFlags, GroupType, ScriptArgs } from "./types";

/**
 * 解析 grouptype 参数，支持向后兼容旧 loadbalance 参数。
 * - 优先使用 `grouptype`（0=select, 1=url-test, 2=load-balance, 3=smart）
 * - 若 `grouptype` 不存在但 `loadbalance` 存在：true→2, false→1
 * - 均不存在时默认为 1（url-test）
 * - 非法值回退为 1
 * @param args - 从外部脚本环境传入的原始参数对象
 * @returns 解析后的代理组类型：0=select, 1=url-test, 2=load-balance, 3=smart
 */
function parseGroupType(args: ScriptArgs): GroupType {
    const fallback: GroupType =
        args.loadbalance !== undefined ? (parseBool(args.loadbalance) ? 2 : 1) : 1;
    const raw = parseNumber(args.grouptype, fallback);
    if (raw === 0 || raw === 1 || raw === 2 || raw === 3) return raw;
    return 1;
}

/**
 * 解析被排除地区的回退代理组类型（仅在 grouptype=3 时使用）。
 * 复用 GroupType 语义，但禁止 3（smart）——回退到 smart 无意义，遇 3 或非法值均回退为 0。
 * @param args - 从外部脚本环境传入的原始参数对象
 * @returns 回退类型：0=select, 1=url-test, 2=load-balance
 */
function parseSmartFallback(args: ScriptArgs): GroupType {
    const raw = parseNumber(args.smartfallback, 0);
    if (raw === 0 || raw === 1 || raw === 2) return raw;
    return 0;
}

/**
 * 解析 smartexclude 参数：逗号分隔的地区名列表（对齐 countriesMeta 的 key，不含「节点」后缀）。
 * 切分后去除首尾空白并过滤空串。
 * @param raw - 原始 smartexclude 字符串
 * @returns 地区名数组
 */
function parseSmartExclude(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

/**
 * 解析传入的脚本参数，并将其转换为内部使用的功能开关（feature flags）。
 * @param args - 从外部脚本环境（如 Substore）传入的原始参数对象
 * @returns 经过解析和类型转换后的功能开关集合 `FeatureFlags`
 */
export function buildFeatureFlags(args: ScriptArgs): FeatureFlags {
    return {
        groupType: parseGroupType(args),
        ipv6Enabled: parseBool(args.ipv6),
        fullConfig: parseBool(args.full),
        keepAliveEnabled: parseBool(args.keepalive),
        fakeIPEnabled: parseBool(args.fakeip, true),
        quicEnabled: parseBool(args.quic),
        regexFilter: parseBool(args.regex),
        tunEnabled: parseBool(args.tun),
        countryThreshold: parseNumber(args.threshold, 2),
        smartExclude: parseSmartExclude(args.smartexclude),
        smartFallback: parseSmartFallback(args),
        smartLightgbm: parseBool(args.smartlightgbm, true),
        smartCollect: parseBool(args.smartcollect),
        smartPreferAsn: parseBool(args.smartpreferasn),
    };
}
