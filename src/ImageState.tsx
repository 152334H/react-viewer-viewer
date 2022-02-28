
type imURL = string; // blob url

interface ImageMeta {
    alt: number
    scale: number
    left: number
    top: number
    rotate: number
}
interface DerefImageState extends ImageMeta {
    src: number // index for dataURLs[]
};
interface FullImageState extends ImageMeta{
    src: imURL
};

type Images = FullImageState[];
type ReducedImages = {
    dataURLs: imURL[]; // this is an ObjectURL!
    imgStates: DerefImageState[];
}; 

const readerProducer = (
  meth: (r:FileReader) => (
     (_: any, blob:any) => void
  )
) => (
 (blob:any) => new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    meth(reader).bind(reader)(blob)
  })
)

export {Images,FullImageState,ReducedImages,DerefImageState};

export const URLToBlob = (url:imURL) => fetch(url).then(res => res.blob());
export const BlobToOURL = (blob:Blob) => URL.createObjectURL(blob);
export const blobToB64 = readerProducer(r => r.readAsDataURL);
export const blobToText = readerProducer(r => r.readAsText);

// TODO: refactor this (get rid of the b64 thing)
export const compressImgs = (imgs:Images, b64:boolean=true) => {
  let objURLs: imURL[] = [];
  let imgStates = imgs.map(i => {
    // this part is fast enough because we're using blob objectURLs (and not full base64 urls)
    let ind = objURLs.findIndex(d => d === i.src)
    if (ind === -1) {
      objURLs.push(i.src)
      ind = objURLs.length - 1
    }
    return {...i, src: ind}
  });
  return Promise.all(objURLs.map(
      objURL => URLToBlob(objURL).then(b64 ? blobToB64 : b=>b)
  )).then((dataURLs: (string|Blob)[]) => ({dataURLs, imgStates}))
}

// TODO: wrong typing due to b64 thing
export const uncompressImgs = (compImgs:ReducedImages, b64:boolean=true) => {
  return Promise.all(compImgs.dataURLs.map(
    async (objURL: Blob|string) => {
      const blob = b64 ? await URLToBlob(objURL as string): objURL as Blob;
      return await BlobToOURL(blob);
  })).then(urls => compImgs.imgStates.map(im => (
      {...im, src: urls[im.src]}
  )));
}


