import { LANDING_NODE_MATCHER, LOW_COST_NODE_MATCHER, countriesMeta } from "./constants";
import type { ClashConfig, CountryInfoItem } from "./types";

const COUNTRY_REGEX_MAP = Object.fromEntries(
    Object.entries(countriesMeta).map(([country, meta]) => {
        return [country, new RegExp(meta.pattern)];
    })
) as Record<string, RegExp>;

/**
 * 从 Clash 配置中筛选出所有低价节点的名称。
 * @param config - 当前的 Clash 配置对象，需包含 `proxies` 字段
 * @returns 匹配低价节点正则的节点名称数组
 */
export function parseLowCost(config: ClashConfig): string[] {
    return (config.proxies || [])
        .filter((proxy) => LOW_COST_NODE_MATCHER.regex.test(proxy.name || ""))
        .map((proxy) => proxy.name)
        .filter((name): name is string => Boolean(name));
}

/**
 * 将订阅中的所有节点按是否为落地节点进行分类。
 * @param config - 当前的 Clash 配置对象，需包含 `proxies` 字段
 * @returns 包含 `landingNodes`（落地节点名称列表）和 `nonLandingNodes`（非落地节点名称列表）的对象
 */
export function parseNodesByLanding(config: ClashConfig): {
    landingNodes: string[];
    nonLandingNodes: string[];
} {
    const landingNodes: string[] = [];
    const nonLandingNodes: string[] = [];

    for (const proxy of config.proxies || []) {
        const name = proxy.name;
        if (!name) continue;

        if (LANDING_NODE_MATCHER.regex.test(name)) {
            landingNodes.push(name);
            continue;
        }

        nonLandingNodes.push(name);
    }

    return { landingNodes, nonLandingNodes };
}

/**
 * 遍历订阅中的所有节点，按 `countriesMeta` 中定义的地区进行归类。
 * @param config - 当前的 Clash 配置对象，需包含 `proxies` 字段
 * @param landing - 是否启用落地节点模式；为 `true` 时将跳过落地节点，默认为 `false`
 * @returns 按地区归类后的节点信息数组，每项包含 `country`（地区名）和 `nodes`（节点名称列表）
 */
export function parseCountries(config: ClashConfig, landing = false): CountryInfoItem[] {
    const proxies = config.proxies || [];
    const countryNodes: Record<string, string[]> = Object.create(null);

    for (const proxy of proxies) {
        const name = proxy.name || "";

        if (landing && LANDING_NODE_MATCHER.regex.test(name)) continue;

        for (const [country, regex] of Object.entries(COUNTRY_REGEX_MAP)) {
            if (!regex.test(name)) continue;

            if (!countryNodes[country]) {
                countryNodes[country] = [];
            }
            countryNodes[country].push(name);
            break;
        }
    }

    return Object.entries(countryNodes).map(([country, nodes]) => ({ country, nodes }));
}

/**
 * 根据最小节点数量阈值过滤地区，并按权重升序排序，返回纯地区名称列表（不含后缀）。
 * 带后缀的分组名由调用方按需拼接 `NODE_SUFFIX` 得到，避免「加后缀又剥离」的往返。
 * @param countryInfo - 由 `parseCountries` 返回的地区节点信息数组
 * @param minCount - 地区节点数量的最小阈值，节点数不足该值的地区将被过滤掉
 * @returns 按权重升序排列的纯地区名称数组（不含 `NODE_SUFFIX` 后缀）
 */
export function getSortedCountries(countryInfo: CountryInfoItem[], minCount: number): string[] {
    return countryInfo
        .filter((item) => item.nodes.length >= minCount)
        .sort((a, b) => {
            const wa = countriesMeta[a.country]?.weight ?? Infinity;
            const wb = countriesMeta[b.country]?.weight ?? Infinity;
            return wa - wb;
        })
        .map((item) => item.country);
}
