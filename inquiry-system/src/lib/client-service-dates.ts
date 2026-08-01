import { prisma } from "./prisma";

/** 客户服务起止 = 下属网站最早开始 / 最晚结束 */
export async function syncClientServiceDates(clientId: string) {
  const sites = await prisma.site.findMany({
    where: { clientId },
    select: { startDate: true, endDate: true },
  });

  const starts = sites.map((s) => s.startDate).filter((d): d is Date => !!d);
  const ends = sites.map((s) => s.endDate).filter((d): d is Date => !!d);

  const serviceStart =
    starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
  const serviceEnd =
    ends.length > 0 ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;

  await prisma.client.update({
    where: { id: clientId },
    data: { serviceStart, serviceEnd },
  });

  return { serviceStart, serviceEnd };
}
