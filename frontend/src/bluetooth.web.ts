// Web: no Bluetooth printing (the regular 80mm print button is used instead).
export type BtPrinter = { address: string; name: string };
export type BtPermission = "granted" | "denied" | "blocked";
export const btPlatform = false;
export const btAvailable = false;
export const getSavedPrinter = async (): Promise<BtPrinter | null> => null;
export const savePrinter = async (_p: BtPrinter | null) => {};
export const btPermissionGranted = async () => false;
export const requestBtPermission = async (): Promise<BtPermission> => "denied";
export const bondedPrinters = async (): Promise<BtPrinter[]> => [];
export const btPrintPng = async (_png: string, _p: BtPrinter) => {};
