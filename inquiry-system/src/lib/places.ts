import { COUNTRY_ZH, countryCodeToZh, localizeCountryCodes } from "./countries";

/** 常见英文地名 → 中文（城市 / 省州 / 地区） */
export const PLACE_ZH: Record<string, string> = {
  // 中国省级
  beijing: "北京",
  tianjin: "天津",
  shanghai: "上海",
  chongqing: "重庆",
  hebei: "河北",
  shanxi: "山西",
  liaoning: "辽宁",
  jilin: "吉林",
  heilongjiang: "黑龙江",
  jiangsu: "江苏",
  zhejiang: "浙江",
  anhui: "安徽",
  fujian: "福建",
  jiangxi: "江西",
  shandong: "山东",
  henan: "河南",
  hubei: "湖北",
  hunan: "湖南",
  guangdong: "广东",
  hainan: "海南",
  sichuan: "四川",
  guizhou: "贵州",
  yunnan: "云南",
  shaanxi: "陕西",
  gansu: "甘肃",
  qinghai: "青海",
  taiwan: "台湾",
  "inner mongolia": "内蒙古",
  neimenggu: "内蒙古",
  guangxi: "广西",
  xizang: "西藏",
  tibet: "西藏",
  ningxia: "宁夏",
  xinjiang: "新疆",
  "hong kong": "香港",
  hongkong: "香港",
  macau: "澳门",
  macao: "澳门",
  // 常见城市
  guangzhou: "广州",
  shenzhen: "深圳",
  dongguan: "东莞",
  foshan: "佛山",
  zhuhai: "珠海",
  zhongshan: "中山",
  huizhou: "惠州",
  hangzhou: "杭州",
  ningbo: "宁波",
  wenzhou: "温州",
  jiaxing: "嘉兴",
  nanjing: "南京",
  suzhou: "苏州",
  wuxi: "无锡",
  changzhou: "常州",
  xuzhou: "徐州",
  nantong: "南通",
  hefei: "合肥",
  fuzhou: "福州",
  xiamen: "厦门",
  quanzhou: "泉州",
  zhangzhou: "漳州",
  putian: "莆田",
  nanping: "南平",
  longyan: "龙岩",
  sanming: "三明",
  ningde: "宁德",
  nanchang: "南昌",
  jinan: "济南",
  qingdao: "青岛",
  yantai: "烟台",
  weifang: "潍坊",
  zhengzhou: "郑州",
  wuhan: "武汉",
  changsha: "长沙",
  chengdu: "成都",
  mianyang: "绵阳",
  kunming: "昆明",
  guiyang: "贵阳",
  nanning: "南宁",
  haikou: "海口",
  sanya: "三亚",
  xian: "西安",
  "xi'an": "西安",
  lanzhou: "兰州",
  urumqi: "乌鲁木齐",
  lhasa: "拉萨",
  shenyang: "沈阳",
  dalian: "大连",
  harbin: "哈尔滨",
  changchun: "长春",
  taiyuan: "太原",
  shijiazhuang: "石家庄",
  baoding: "保定",
  tangshan: "唐山",
  luoyang: "洛阳",
  kaifeng: "开封",
  // 新加坡等地常见
  singapore: "新加坡",
  looyang: "洛阳",
};

export function localizePlaceName(name: string): string {
  const raw = name.trim();
  if (!raw) return raw;
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  if (PLACE_ZH[key]) return PLACE_ZH[key];
  // 去掉 County/City/Province 后缀再查
  const stripped = key
    .replace(/\s+(province|city|county|shi|sheng)$/i, "")
    .trim();
  if (PLACE_ZH[stripped]) return PLACE_ZH[stripped];
  return raw;
}

export type GeoParts = {
  country: string;
  region: string;
  city: string;
  lat: string;
  lng: string;
  pageUrl: string;
  journeyRaw: string;
};

/** 解析 page_url + entry_geolocation + entry_user_journey 组合或单段文本 */
export function parseGeoSmartBlob(text: string): GeoParts {
  let v = text.replace(/\r\n/g, "\n").trim();
  let journeyRaw = "";

  // 未展开的 smart tag
  if (/\{entry_user_journey\}/i.test(v)) {
    v = v.replace(/\{entry_user_journey\}/gi, "").trim();
  }
  // 已展开的 HTML 旅程（若整段是 table）
  const htmlMatch = v.match(/(<table[\s\S]*?<\/table>)/i);
  if (htmlMatch) {
    journeyRaw = htmlMatch[1];
    v = v.replace(htmlMatch[1], "").trim();
  }

  let pageUrl = "";
  const urlMatch = v.match(/^(https?:\/\/\S+)/);
  if (urlMatch) {
    pageUrl = urlMatch[1];
    v = v.slice(urlMatch[0].length).trim();
  }

  const lines = v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let placeLine = "";
  let lat = "";
  let lng = "";
  for (const line of lines) {
    const coord = line.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s|$)/);
    if (coord && !lat) {
      lat = coord[1];
      lng = coord[2];
      const rest = line.slice(coord[0].length).trim();
      if (rest && !journeyRaw) journeyRaw = rest;
      continue;
    }
    if (!placeLine) placeLine = line;
    else if (!journeyRaw) journeyRaw = line;
  }

  let city = "";
  let region = "";
  let country = "";
  const parts = placeLine
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 1) {
    const last = parts[parts.length - 1];
    if (/^[A-Za-z]{2}$/.test(last)) {
      country = countryCodeToZh(last.toUpperCase());
      if (parts.length === 2) {
        city = localizePlaceName(parts[0]);
      } else if (parts.length >= 3) {
        city = localizePlaceName(parts[0]);
        region = parts
          .slice(1, -1)
          .map((p) => localizePlaceName(p))
          .join("·");
      }
    } else {
      if (parts.length === 1) city = localizePlaceName(parts[0]);
      else if (parts.length === 2) {
        city = localizePlaceName(parts[0]);
        country = COUNTRY_ZH[parts[1].toUpperCase()] || localizePlaceName(parts[1]);
      } else {
        city = localizePlaceName(parts[0]);
        region = parts
          .slice(1, -1)
          .map((p) => localizePlaceName(p))
          .join("·");
        const c = parts[parts.length - 1];
        country = /^[A-Za-z]{2}$/.test(c)
          ? countryCodeToZh(c.toUpperCase())
          : COUNTRY_ZH[c.toUpperCase()] || localizePlaceName(c);
      }
    }
  }

  return { country, region, city, lat, lng, pageUrl, journeyRaw };
}

/** 地理位置中文详情文案 */
export function formatGeolocationZh(text: string): string {
  const g = parseGeoSmartBlob(text);
  // 若几乎没解析出结构，退回国家码替换
  if (!g.country && !g.city && !g.region && !g.lat) {
    return localizeCountryCodes(text.replace(/\{entry_user_journey\}/gi, "").trim());
  }
  const lines: string[] = [];
  if (g.country) lines.push(`国家：${g.country}`);
  if (g.region) lines.push(`地区：${g.region}`);
  if (g.city) lines.push(`城市：${g.city}`);
  if (g.lat && g.lng) lines.push(`坐标：${g.lat}, ${g.lng}`);
  return lines.join("\n") || localizeCountryCodes(text);
}
