export interface ImageDimensions { width: number; height: number }
export function containImage(image:ImageDimensions,frame:ImageDimensions):ImageDimensions {
  const scale=Math.min(Math.max(1,frame.width)/Math.max(1,image.width),Math.max(1,frame.height)/Math.max(1,image.height),1);
  return {width:Math.max(1,image.width*scale),height:Math.max(1,image.height*scale)};
}
