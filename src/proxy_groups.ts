import {
    CDN_URL,
    LANDING_NODE_MATCHER,
    LOW_COST_NODE_MATCHER,
    NODE_SUFFIX,
    PROXY_GROUPS,
    countriesMeta,
} from "./constants";
import type {
    BuildCountryProxyGroupsInput,
    BuildProxyGroupsInput,
    CountryInfoItem,
    GroupType,
    ProxyGroup,
    SmartOptions,
} from "./types";
import { isNotNull } from "./utils";

interface BuildGroupByTypeInput {
    name: string;
    icon: string;
    groupType: GroupType;
    nodeSource: Pick<ProxyGroup, "proxies" | "include-all" | "filter" | "exclude-filter">;
    smart: SmartOptions;
}

/**
 * 根据代理组类型生成对应的代理组配置。
 * 将 groupType 映射为具体的类型字段（select/url-test/load-balance/smart），
 * 并与节点来源字段合并，消除各处重复的 switch 逻辑。
 */
function buildGroupByType({
    name,
    icon,
    groupType,
    nodeSource,
    smart,
}: BuildGroupByTypeInput): ProxyGroup {
    switch (groupType) {
        case 0:
            return { name, icon, type: "select", ...nodeSource };
        case 1:
            return {
                name,
                icon,
                type: "url-test",
                url: "https://cp.cloudflare.com/generate_204",
                interval: 60,
                tolerance: 20,
                ...nodeSource,
            };
        case 2:
            return {
                name,
                icon,
                type: "load-balance",
                strategy: "sticky-sessions",
                url: "https://cp.cloudflare.com/generate_204",
                interval: 60,
                tolerance: 20,
                ...nodeSource,
            };
        case 3:
            return {
                name,
                icon,
                type: "smart",
                uselightgbm: smart.uselightgbm,
                ...(smart.collectdata ? { collectdata: true } : {}),
                ...(smart.preferAsn ? { "prefer-asn": true } : {}),
                ...nodeSource,
            };
    }
}

/**
 * 为每个地区生成对应的代理组配置。
 * @param input - 构建地区代理组所需的输入参数
 * @param input.countries - 需要生成代理组的地区名称列表（不含后缀）
 * @param input.landing - 是否启用落地节点模式；启用时将排除落地节点
 * @param input.groupType - 代理组类型：0=select, 1=url-test, 2=load-balance
 * @param input.regexFilter - 是否使用正则过滤模式（`include-all` + `filter`）
 * @param input.countryInfo - 地区节点信息数组，用于非正则模式下直接枚举节点名称
 * @param input.smartExclude - grouptype=3 时不走 smart 的地区名列表（不含「节点」后缀）
 * @param input.smartFallback - 被排除地区的回退类型（0=select, 1=url-test, 2=load-balance）
 * @param input.smart - smart 组的可配置项（uselightgbm/collectdata/prefer-asn）
 * @returns 生成的地区代理组配置数组
 */
export function buildCountryProxyGroups({
    countries,
    landing,
    groupType,
    regexFilter,
    countryInfo,
    smartExclude,
    smartFallback,
    smart,
}: BuildCountryProxyGroupsInput): ProxyGroup[] {
    const groups: ProxyGroup[] = [];

    const nodesByCountry: Record<string, string[]> | null = !regexFilter
        ? Object.fromEntries(countryInfo.map((item: CountryInfoItem) => [item.country, item.nodes]))
        : null;

    const excludeSet = new Set(smartExclude);

    for (const country of countries) {
        const meta = countriesMeta[country];
        if (!meta) continue;

        const name = `${country}${NODE_SUFFIX}`;
        const icon = meta.icon;

        // grouptype=3 且该地区被排除时，回退为 smartFallback 类型；其余沿用 groupType。
        const effectiveType: GroupType =
            groupType === 3 && excludeSet.has(country) ? smartFallback : groupType;

        const nodeSource = !regexFilter
            ? { proxies: nodesByCountry?.[country] ?? [] }
            : {
                  "include-all": true as const,
                  filter: meta.pattern,
                  ...(landing ? { "exclude-filter": LANDING_NODE_MATCHER.pattern } : {}),
              };

        groups.push(buildGroupByType({ name, icon, groupType: effectiveType, nodeSource, smart }));
    }

    return groups;
}

export function buildProxyGroups({
    landing,
    regexFilter,
    groupType,
    countries,
    countryProxyGroups,
    lowCostNodes,
    landingNodes,
    defaultProxies,
    defaultProxiesDirect,
    defaultSelector,
    defaultFallback,
    frontProxySelector,
    smart,
}: BuildProxyGroupsInput): ProxyGroup[] {
    const hasTW = countries.includes("台湾");
    const hasHK = countries.includes("香港");
    const hasUS = countries.includes("美国");

    // 仅名称/图标不同、统一为 select + defaultProxies 的功能分组助手。
    const sel = (name: string, icon: string): ProxyGroup => ({
        name,
        icon,
        type: "select",
        proxies: defaultProxies,
    });

    const groups: Array<ProxyGroup | null> = [
        {
            name: PROXY_GROUPS.SELECT,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Proxy.png`,
            type: "select",
            proxies: defaultSelector,
        },
        {
            name: PROXY_GROUPS.MANUAL,
            icon: `${CDN_URL}/gh/shindgewongxj/WHATSINStash@master/icon/select.png`,
            "include-all": true,
            type: "select",
        },
        landing
            ? {
                  name: PROXY_GROUPS.FRONT_PROXY,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Area.png`,
                  type: "select",
                  ...(regexFilter
                      ? {
                            "include-all": true,
                            "exclude-filter": LANDING_NODE_MATCHER.pattern,
                            proxies: frontProxySelector,
                        }
                      : { proxies: frontProxySelector }),
              }
            : null,
        landing
            ? {
                  name: PROXY_GROUPS.LANDING,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Airport.png`,
                  type: "select",
                  ...(regexFilter
                      ? { "include-all": true, filter: LANDING_NODE_MATCHER.pattern }
                      : { proxies: landingNodes }),
              }
            : null,
        sel(
            PROXY_GROUPS.STATIC_RESOURCES,
            `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Cloudflare.png`
        ),
        sel(PROXY_GROUPS.AI_SERVICE, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png`),
        sel(
            PROXY_GROUPS.CRYPTO,
            `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Cryptocurrency_1.png`
        ),
        sel(PROXY_GROUPS.APPLE, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Apple_2.png`),
        sel(PROXY_GROUPS.GOOGLE, `${CDN_URL}/gh/Orz-3/mini@master/Color/Google.png`),
        sel(
            PROXY_GROUPS.MICROSOFT,
            `${CDN_URL}/gh/CodeIntegrity/override-rules@master/icons/Microsoft_Copilot.png`
        ),
        sel(PROXY_GROUPS.XBOX, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Xbox.png`),
        sel(PROXY_GROUPS.GITHUB, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/GitHub.png`),
        {
            name: PROXY_GROUPS.BILIBILI,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/bilibili.png`,
            type: "select",
            proxies: hasTW && hasHK ? ["DIRECT", "台湾节点", "香港节点"] : defaultProxiesDirect,
        },
        {
            name: PROXY_GROUPS.BAHAMUT,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Bahamut.png`,
            type: "select",
            proxies: hasTW
                ? ["台湾节点", PROXY_GROUPS.SELECT, PROXY_GROUPS.MANUAL, "DIRECT"]
                : defaultProxies,
        },
        sel(PROXY_GROUPS.YOUTUBE, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/YouTube.png`),
        sel(PROXY_GROUPS.TWITCH, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Twitch.png`),
        sel(PROXY_GROUPS.NETFLIX, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Netflix.png`),
        sel(PROXY_GROUPS.TIKTOK, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/TikTok.png`),
        sel(PROXY_GROUPS.SPOTIFY, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Spotify.png`),
        sel(
            PROXY_GROUPS.TELEGRAM,
            `${CDN_URL}/gh/CodeIntegrity/override-rules@master/icons/Telegram.png`
        ),
        sel(PROXY_GROUPS.TWITTER, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Twitter.png`),
        {
            name: PROXY_GROUPS.WEIBO,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Weibo.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxiesDirect,
        },
        {
            name: PROXY_GROUPS.TRUTH_SOCIAL,
            icon: `${CDN_URL}/gh/CodeIntegrity/override-rules@master/icons/Truth_Social.png`,
            type: "select",
            proxies: hasUS
                ? ["美国节点", PROXY_GROUPS.SELECT, PROXY_GROUPS.MANUAL]
                : defaultProxies,
        },
        sel(
            PROXY_GROUPS.EHENTAI,
            `${CDN_URL}/gh/CodeIntegrity/override-rules@master/icons/Ehentai.png`
        ),
        sel(
            PROXY_GROUPS.PIKPAK,
            `${CDN_URL}/gh/CodeIntegrity/override-rules@master/icons/PikPak.png`
        ),
        {
            name: PROXY_GROUPS.SOGOU_INPUT,
            icon: `${CDN_URL}/gh/CodeIntegrity/override-rules@master/icons/Sougou.png`,
            type: "select",
            proxies: ["DIRECT", "REJECT"],
        },
        sel(PROXY_GROUPS.SSH, `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Server.png`),
        {
            name: PROXY_GROUPS.FINAL,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Final.png`,
            type: "select",
            proxies: [PROXY_GROUPS.SELECT, "DIRECT"],
        },
        {
            name: PROXY_GROUPS.AUTO,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Auto.png`,
            type: "url-test",
            url: "https://cp.cloudflare.com/generate_204",
            proxies: defaultFallback,
            interval: 60,
            tolerance: 20,
        },
        {
            name: PROXY_GROUPS.FALLBACK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
            type: "fallback",
            url: "https://cp.cloudflare.com/generate_204",
            proxies: defaultFallback,
            interval: 60,
            tolerance: 20,
        },
        {
            name: PROXY_GROUPS.AD_BLOCK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/AdBlack.png`,
            type: "select",
            proxies: ["REJECT", "REJECT-DROP", "DIRECT"],
        },
        lowCostNodes.length > 0 || regexFilter
            ? buildGroupByType({
                  name: PROXY_GROUPS.LOW_COST,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Lab.png`,
                  groupType,
                  nodeSource: !regexFilter
                      ? { proxies: lowCostNodes }
                      : { "include-all": true as const, filter: LOW_COST_NODE_MATCHER.pattern },
                  smart,
              })
            : null,
        ...countryProxyGroups,
    ];

    return groups.filter(isNotNull);
}
