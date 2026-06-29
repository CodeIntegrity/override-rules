import {
    CDN_URL,
    LOW_COST_NODE_MATCHER,
    NODE_SUFFIX,
    PROXY_GROUPS,
    SPEEDTEST_URL,
    countriesMeta,
} from "./constants";
import type { BuildProxyGroupsInput, GroupType, ProxyGroup, SmartOptions } from "./types";
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
                url: SPEEDTEST_URL,
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
                url: SPEEDTEST_URL,
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
 * 生成所有代理组配置，包含内联的国家地区代理组。
 * @param input - 构建代理组所需的输入参数（详见 BuildProxyGroupsInput）
 * @returns 代理组配置数组
 */
export function buildProxyGroups({
    regexFilter,
    groupType,
    countryNames,
    countryNodes,
    lowCostNodes,
    landing,
    landingNodes,
    defaultProxies,
    defaultProxiesDirect,
    defaultSelector,
    defaultFallback,
    frontProxySelector,
    smartExclude,
    smartFallback,
    smart,
}: BuildProxyGroupsInput): ProxyGroup[] {
    const hasTW = countryNames.includes("台湾");
    const hasHK = countryNames.includes("香港");
    const hasUS = countryNames.includes("美国");
    const smartExcludeSet = new Set(smartExclude);

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
                  proxies: frontProxySelector,
              }
            : null,
        landing
            ? {
                  name: PROXY_GROUPS.LANDING,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Airport.png`,
                  type: "select",
                  proxies: landingNodes.map((node) => node.name).filter(isNotNull),
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
            name: PROXY_GROUPS.AD_BLOCK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/AdBlack.png`,
            type: "select",
            proxies: ["REJECT", "REJECT-DROP", "DIRECT"],
        },
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
            url: SPEEDTEST_URL,
            proxies: defaultFallback,
            interval: 60,
            tolerance: 20,
        },
        {
            name: PROXY_GROUPS.FALLBACK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
            type: "fallback",
            url: SPEEDTEST_URL,
            proxies: defaultFallback,
            interval: 60,
            tolerance: 20,
        },
        lowCostNodes.length > 0 || regexFilter
            ? buildGroupByType({
                  name: PROXY_GROUPS.LOW_COST,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Lab.png`,
                  groupType,
                  nodeSource: !regexFilter
                      ? { proxies: lowCostNodes.map((node) => node.name).filter(isNotNull) }
                      : { "include-all": true as const, filter: LOW_COST_NODE_MATCHER.pattern },
                  smart,
              })
            : null,
        ...countryNames.map((country) => {
            const meta = countriesMeta[country];
            if (!meta) return null;

            const effectiveType: GroupType =
                groupType === 3 && smartExcludeSet.has(country) ? smartFallback : groupType;
            const nodeSource = regexFilter
                ? {
                      "include-all": true as const,
                      filter: meta.pattern,
                  }
                : { proxies: countryNodes[country]?.map((node) => node.name).filter(isNotNull) };

            return buildGroupByType({
                name: `${country}${NODE_SUFFIX}`,
                icon: meta.icon,
                groupType: effectiveType,
                nodeSource,
                smart,
            });
        }),
    ];

    return groups.filter(isNotNull);
}
