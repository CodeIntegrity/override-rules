export interface ScriptArgs {
    grouptype?: string;
    loadbalance?: string;
    ipv6?: string;
    full?: string;
    keepalive?: string;
    fakeip?: string;
    quic?: string;
    regex?: string;
    threshold?: string;
    tun?: string;
    smartexclude?: string;
    smartfallback?: string;
    smartlightgbm?: string;
    smartcollect?: string;
    smartpreferasn?: string;
}

export type GroupType = 0 | 1 | 2 | 3;

/** smart 组的可配置项，从 FeatureFlags 打包后透传给组构建函数。 */
export interface SmartOptions {
    uselightgbm: boolean;
    collectdata: boolean;
    preferAsn: boolean;
}

export interface FeatureFlags {
    groupType: GroupType;
    ipv6Enabled: boolean;
    fullConfig: boolean;
    keepAliveEnabled: boolean;
    fakeIPEnabled: boolean;
    quicEnabled: boolean;
    regexFilter: boolean;
    countryThreshold: number;
    tunEnabled: boolean;
    smartExclude: string[];
    smartFallback: GroupType;
    smartLightgbm: boolean;
    smartCollect: boolean;
    smartPreferAsn: boolean;
}

export interface ProxyNode {
    name: string;
    type?: string;
    server?: string;
    port?: number;
    [key: string]: unknown;
}

export type ProxyGroupType = "select" | "url-test" | "load-balance" | "fallback" | "smart";

export type LoadBalanceStrategy = "sticky-sessions" | "consistent-hashing" | "round-robin";

export interface BaseProxyGroup {
    name: string;
    icon?: string;
    proxies?: string[];
    "include-all"?: boolean;
    filter?: string;
    "exclude-filter"?: string;
}

export interface SelectProxyGroup extends BaseProxyGroup {
    type: "select";
}

export interface UrlTestProxyGroup extends BaseProxyGroup {
    type: "url-test";
    url: string;
    interval: number;
    tolerance: number;
}

export interface LoadBalanceProxyGroup extends BaseProxyGroup {
    type: "load-balance";
    url: string;
    interval: number;
    tolerance: number;
    strategy: LoadBalanceStrategy;
}

export interface FallbackProxyGroup extends BaseProxyGroup {
    type: "fallback";
    url: string;
    interval: number;
    tolerance: number;
}

export interface SmartProxyGroup extends BaseProxyGroup {
    type: "smart";
    uselightgbm: boolean;
    collectdata?: boolean;
    "prefer-asn"?: boolean;
}

export type ProxyGroup =
    | SelectProxyGroup
    | UrlTestProxyGroup
    | LoadBalanceProxyGroup
    | FallbackProxyGroup
    | SmartProxyGroup;

export interface SnifferProtocolConfig {
    ports: number[];
}

export interface SnifferConfig {
    sniff: {
        TLS?: SnifferProtocolConfig;
        HTTP?: SnifferProtocolConfig;
        QUIC?: SnifferProtocolConfig;
    };
    "override-destination": boolean;
    enable: boolean;
    "force-dns-mapping": boolean;
    "skip-domain": string[];
}

export interface TunConfig {
    enable: boolean;
    stack: "gvisor" | "system" | "mixed";
    device: string;
    "route-exclude-address": string[];
    "dns-hijack": string[];
    mtu: number;
}

export interface DnsConfig {
    enable: boolean;
    ipv6: boolean;
    "prefer-h3": boolean;
    "enhanced-mode": "redir-host" | "fake-ip";
    "default-nameserver": string[];
    nameserver: string[];
    fallback: string[];
    "proxy-server-nameserver": string[];
    "fake-ip-filter"?: string[];
}

export type RuleProviderType = "http" | "file";
export type RuleProviderBehavior = "domain" | "classical" | "ipcidr";
export type RuleProviderFormat = "mrs" | "text" | "yaml";

export interface RuleProvider {
    type: RuleProviderType;
    behavior: RuleProviderBehavior;
    format: RuleProviderFormat;
    interval: number;
    url: string;
    path: string;
}

export interface GeoxUrl {
    geoip?: string;
    geosite?: string;
    mmdb?: string;
    asn?: string;
}

export interface ClashProfile {
    "store-selected"?: boolean;
    "store-fake-ip"?: boolean;
}

export interface ClashConfig {
    proxies?: ProxyNode[];
    "proxy-groups"?: ProxyGroup[];
    rules?: string[];
    "rule-providers"?: Record<string, RuleProvider>;
    dns?: DnsConfig;
    sniffer?: SnifferConfig;
    tun?: TunConfig;
    "geodata-mode"?: boolean;
    "geox-url"?: GeoxUrl;
    "mixed-port"?: number;
    "redir-port"?: number;
    "tproxy-port"?: number;
    "routing-mark"?: number;
    "allow-lan"?: boolean;
    "bind-address"?: string;
    ipv6?: boolean;
    mode?: "rule" | "global" | "direct";
    "unified-delay"?: boolean;
    "tcp-concurrent"?: boolean;
    "find-process-mode"?: "off" | "strict" | "always";
    "log-level"?: "info" | "warning" | "error" | "debug" | "silent";
    "geodata-loader"?: "standard" | "memconservative";
    "external-controller"?: string;
    "disable-keep-alive"?: boolean;
    profile?: ClashProfile;
}

export interface CountryMeta {
    weight?: number;
    pattern: string;
    icon: string;
}

export interface CaseInsensitiveNodeMatcher {
    source: string;
    regex: RegExp;
    pattern: string;
}

export interface BaseLists {
    defaultProxies: string[];
    defaultProxiesDirect: string[];
    defaultSelector: string[];
    defaultFallback: string[];
    frontProxySelector: string[];
}

export interface BuildBaseListsInput {
    landing: boolean;
    lowCostNodes: ProxyNode[];
    countryNames: string[];
    nonLandingNodes: ProxyNode[];
    regexFilter: boolean;
}

export interface BuildProxyGroupsInput {
    regexFilter: boolean;
    groupType: GroupType;
    countryNames: string[];
    countryNodes: Record<string, ProxyNode[]>;
    lowCostNodes: ProxyNode[];
    landing: boolean;
    landingNodes: ProxyNode[];
    defaultProxies: string[];
    defaultProxiesDirect: string[];
    defaultSelector: string[];
    defaultFallback: string[];
    frontProxySelector: string[];
    smartExclude: string[];
    smartFallback: GroupType;
    smart: SmartOptions;
}
