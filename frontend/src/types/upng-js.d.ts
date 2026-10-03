declare module "upng-js" {
  type Image = { width: number; height: number; depth: number; ctype: number; frames: any[]; tabs: any; data: ArrayBuffer };
  const UPNG: {
    decode(buf: ArrayBuffer): Image;
    toRGBA8(img: Image): ArrayBuffer[];
  };
  export default UPNG;
}
