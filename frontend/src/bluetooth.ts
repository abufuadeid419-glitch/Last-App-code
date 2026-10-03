// Android Bluetooth Classic (SPP) thermal printing. Receipts are printed as a raster image
// (ESC/POS "GS v 0"), so Arabic text renders exactly as on screen. Needs an installed build
// (the native module is not available in Expo Go, iOS or web).
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import UPNG from "upng-js";

import { storage } from "@/src/utils/storage";

export type BtPrinter = { address: string; name: string };
export type BtPermission = "granted" | "denied" | "blocked";

export const btPlatform = Platform.OS === "android";
export const btAvailable = btPlatform && !!NativeModules.RNBluetoothClassic;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib = () => require("react-native-bluetooth-classic").default;
const KEY = "bt_printer";

// Stored as JSON (storage only holds primitives).
export const getSavedPrinter = async (): Promise<BtPrinter | null> => {
  const raw = await storage.getItem<string | null>(KEY, null);
  try {
    return raw ? (JSON.parse(raw) as BtPrinter) : null;
  } catch {
    return null;
  }
};
export const savePrinter = (p: BtPrinter | null) => (p ? storage.setItem(KEY, JSON.stringify(p)) : storage.removeItem(KEY));

const needsRuntimePerm = () => btPlatform && Number(Platform.Version) >= 31;

export async function btPermissionGranted() {
  if (!needsRuntimePerm()) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
}

export async function requestBtPermission(): Promise<BtPermission> {
  if (!needsRuntimePerm()) return "granted";
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  return r === PermissionsAndroid.RESULTS.GRANTED ? "granted" : r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? "blocked" : "denied";
}

export async function bondedPrinters(): Promise<BtPrinter[]> {
  const bt = lib();
  if (!(await bt.isBluetoothEnabled()) && !(await bt.requestBluetoothEnabled())) throw new Error("فعّل البلوتوث أولاً");
  const devices = await bt.getBondedDevices();
  return devices.map((d: any) => ({ address: d.address, name: d.name || d.address }));
}

// ---- PNG -> ESC/POS raster ----
function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 4096)));
  return btoa(s);
}

export function escposFromPng(pngB64: string): Uint8Array {
  const img = UPNG.decode(b64ToBytes(pngB64).buffer);
  const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
  const w = img.width;
  const h = img.height;
  const bw = Math.ceil(w / 8);
  const BAND = 255;
  const bands = Math.ceil(h / BAND);
  const out = new Uint8Array(2 + bands * 8 + bw * h + 7);
  let o = 0;
  out[o++] = 0x1b; out[o++] = 0x40; // ESC @ init
  for (let y0 = 0; y0 < h; y0 += BAND) {
    const rows = Math.min(BAND, h - y0);
    out.set([0x1d, 0x76, 0x30, 0x00, bw & 0xff, bw >> 8, rows & 0xff, rows >> 8], o);
    o += 8;
    for (let y = y0; y < y0 + rows; y++) {
      for (let bx = 0; bx < bw; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x >= w) continue;
          const p = (y * w + x) * 4;
          const lum = rgba[p + 3] < 128 ? 255 : 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
          if (lum < 150) byte |= 0x80 >> bit;
        }
        out[o++] = byte;
      }
    }
  }
  out.set([0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00], o); // feed 4 lines + cut (ignored by printers without a cutter)
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connect(address: string) {
  const bt = lib();
  if (await bt.isDeviceConnected(address)) return bt.getConnectedDevice(address);
  try {
    return await bt.connectToDevice(address, { connectorType: "rfcomm", secureSocket: true });
  } catch {
    return bt.connectToDevice(address, { connectorType: "rfcomm", secureSocket: false }); // some printers need an insecure socket
  }
}

export async function btPrintPng(pngB64: string, printer: BtPrinter) {
  const bytes = escposFromPng(pngB64);
  const dev = await connect(printer.address);
  for (let i = 0; i < bytes.length; i += 2048) {
    await dev.write(bytesToB64(bytes.subarray(i, i + 2048)), "base64");
    await sleep(25); // small printers have tiny buffers
  }
}
