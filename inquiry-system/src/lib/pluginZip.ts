import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const PLUGIN_DIR_NAME = "wp-inquiry-bridge";

/** 候选路径：仓库根旁 / 应用内拷贝 */
function pluginDirCandidates() {
  const cwd = /* turbopackIgnore: true */ process.cwd();
  return [
    path.resolve(cwd, "..", PLUGIN_DIR_NAME),
    path.resolve(cwd, PLUGIN_DIR_NAME),
    path.resolve(cwd, "vendor", PLUGIN_DIR_NAME),
  ];
}

export async function resolvePluginDir() {
  for (const dir of pluginDirCandidates()) {
    try {
      const main = path.join(dir, "inquiry-bridge.php");
      await fs.access(main);
      return dir;
    } catch {
      // try next
    }
  }
  return null;
}

async function listFilesRecursive(root: string, rel = ""): Promise<string[]> {
  const abs = path.join(root, rel);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      out.push(...(await listFilesRecursive(root, childRel)));
    } else {
      out.push(childRel.replace(/\\/g, "/"));
    }
  }
  return out;
}

/** 无依赖 ZIP（store，不压缩），包内顶层目录为 wp-inquiry-bridge/ */
export async function buildPluginZip(): Promise<{ buffer: Buffer; fileCount: number }> {
  const dir = await resolvePluginDir();
  if (!dir) {
    throw new Error("找不到 wp-inquiry-bridge 插件目录");
  }

  const files = await listFilesRecursive(dir);
  if (!files.length) {
    throw new Error("插件目录为空");
  }

  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const rel of files) {
    const data = await fs.readFile(path.join(dir, rel));
    const entryName = `${PLUGIN_DIR_NAME}/${rel}`;
    const nameBuf = Buffer.from(entryName, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    parts.push(local, data);

    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc >>> 0, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);

    offset += local.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return {
    buffer: Buffer.concat([...parts, centralBuf, end]),
    fileCount: files.length,
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function pluginZipEtag(buffer: Buffer) {
  return createHash("sha1").update(buffer).digest("hex").slice(0, 16);
}
