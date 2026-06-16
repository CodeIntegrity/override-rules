/*!
powerfullz 的 Substore 订阅转换脚本
https://github.com/CodeIntegrity/override-rules

支持的传入参数：
- grouptype: 地区代理组类型（0=select 手动选择, 1=url-test 自动测速, 2=load-balance 负载均衡, 3=smart 智能选路，默认 0）
  - 向后兼容：若未传 grouptype 但传了 loadbalance，则 loadbalance=true 映射为 grouptype=2，loadbalance=false 映射为 grouptype=1
  - smart 组（grouptype=3）需 OpenClash mihomo smart 内核支持，普通内核无法识别 type: smart
- smartexclude: grouptype=3 时不走 smart 的地区名列表，逗号分隔（如 香港,台湾，对齐地区名不含「节点」后缀，默认空）
- smartfallback: 被 smartexclude 排除的地区的回退类型（0=select, 1=url-test, 2=load-balance，默认 0）
- smartlightgbm: smart 组使用 LightGBM 模型预测权重（uselightgbm，默认 true）
- smartcollect: smart 组采集训练数据（collectdata，默认 false）
- smartpreferasn: smart 组选路优先匹配 ASN（prefer-asn，默认 false）
- landing: 启用落地节点功能（如机场家宽/星链/落地分组，默认 false）
- ipv6: 启用 IPv6 支持（默认 false）
- tun: 启用 TUN 模式（默认 false）
- full: 输出完整配置（适合纯内核启动，默认 false）
- keepalive: 启用 tcp-keep-alive（默认 false）
- fakeip: DNS 使用 FakeIP 模式（默认 true；传 false 时为 RedirHost）
- quic: 允许 QUIC 流量（UDP 443，默认 false）
- threshold: 地区节点数量小于该值时不显示分组 (默认 0)
- regex: 使用正则过滤模式（include-all + filter）写入各地区代理组，而非直接枚举节点名称（默认 false）

源码已迁移至 `src/*.ts`。
*/

import { CDN_URL, NODE_SUFFIX, PROXY_GROUPS } from "./constants";
import { buildFeatureFlags } from "./args";
import { buildCountryProxyGroups, buildProxyGroups } from "./proxy_groups";
import {
    getSortedCountries,
    parseCountries,
    parseLowCost,
    parseNodesByLanding,
} from "./node_parser";
import { buildRules } from "./rules";
import { ruleProviders } from "./rule_providers";
import { buildDns, snifferConfig } from "./dns";
import { buildTunConfig } from "./tun";
import { buildBaseLists } from "./selectors";
import type { ClashConfig, ScriptArgs } from "./types";

const geoxURL = {
    geoip: `${CDN_URL}/gh/MetaCubeX/meta-rules-dat@release/geoip.dat`,
    geosite: `${CDN_URL}/gh/MetaCubeX/meta-rules-dat@release/geosite.dat`,
    mmdb: `${CDN_URL}/gh/MetaCubeX/meta-rules-dat@release/country.mmdb`,
    asn: `${CDN_URL}/gh/MetaCubeX/meta-rules-dat@release/GeoLite2-ASN.mmdb`,
};

declare const $arguments: ScriptArgs;

function getRawArgs(): ScriptArgs {
    try {
        return $arguments;
    } catch {
        console.log("[powerfullz 的覆写脚本] 未检测到传入参数，使用默认参数。", {});
        return {};
    }
}

const rawArgs = getRawArgs();
const {
    groupType,
    landing,
    ipv6Enabled,
    fullConfig,
    keepAliveEnabled,
    fakeIPEnabled,
    quicEnabled,
    regexFilter,
    tunEnabled,
    countryThreshold,
    smartExclude,
    smartFallback,
    smartLightgbm,
    smartCollect,
    smartPreferAsn,
} = buildFeatureFlags(rawArgs);

const smartOptions = {
    uselightgbm: smartLightgbm,
    collectdata: smartCollect,
    preferAsn: smartPreferAsn,
};

function main(config: ClashConfig): ClashConfig {
    const countryInfo = parseCountries(config, landing);
    const lowCostNodes = parseLowCost(config);
    const countries = getSortedCountries(countryInfo, countryThreshold);
    const countryGroupNames = countries.map((country) => country + NODE_SUFFIX);

    const { landingNodes, nonLandingNodes } = landing
        ? parseNodesByLanding(config)
        : { landingNodes: [], nonLandingNodes: [] };

    const {
        defaultProxies,
        defaultProxiesDirect,
        defaultSelector,
        defaultFallback,
        frontProxySelector,
    } = buildBaseLists({
        landing,
        lowCostNodes,
        countryGroupNames,
        nonLandingNodes,
        regexFilter,
    });

    const countryProxyGroups = buildCountryProxyGroups({
        countries,
        landing,
        groupType,
        regexFilter,
        countryInfo,
        smartExclude,
        smartFallback,
        smart: smartOptions,
    });

    const proxyGroups = buildProxyGroups({
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
        smart: smartOptions,
    });

    const globalProxies = proxyGroups.map((item) => String(item.name));
    proxyGroups.push({
        name: PROXY_GROUPS.GLOBAL,
        icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Global.png`,
        "include-all": true,
        type: "select",
        proxies: globalProxies,
    });

    const finalRules = buildRules({ quicEnabled });

    return {
        proxies: config.proxies,
        ...(fullConfig && {
            "mixed-port": 7890,
            "redir-port": 7892,
            "tproxy-port": 7893,
            "routing-mark": 7894,
            "allow-lan": true,
            "bind-address": "*",
            ipv6: ipv6Enabled,
            mode: "rule",
            "unified-delay": true,
            "tcp-concurrent": true,
            "find-process-mode": "off",
            "log-level": "info",
            "geodata-loader": "standard",
            "external-controller": ":9999",
            "disable-keep-alive": !keepAliveEnabled,
            profile: { "store-selected": true },
        }),
        "proxy-groups": proxyGroups,
        "rule-providers": ruleProviders,
        rules: finalRules,
        sniffer: snifferConfig,
        dns: buildDns({ fakeIPEnabled, ipv6Enabled }),
        tun: buildTunConfig(tunEnabled),
        "geodata-mode": true,
        "geox-url": geoxURL,
    };
}

(globalThis as Record<string, unknown>).main = main;
