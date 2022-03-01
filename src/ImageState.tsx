// types/interfaces/classes for individual image states
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

class ReducedImages {
  dataURLs: (string|Blob|imURL)[];
  imgStates: DerefImageState[];
  datatype?: 'B64' | 'Blob' | 'OURL';

  constructor(imgs: Images) {
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
    this.dataURLs = objURLs;
    this.imgStates = imgStates;
    this.datatype = 'OURL';
  }

  static fromObj(obj: ReducedImages) {
    const res = Object.create(ReducedImages.prototype);
    Object.assign(res, obj);
    return res;
  }

  add_type_if_needed() {
    if (this.datatype) return;
    const d = this.dataURLs[0];
    if (d instanceof Blob) this.datatype = 'Blob';
    else if (d.slice(0,5) === 'data:') this.datatype = 'B64';
    else this.datatype = 'OURL';
  }

  async intoB64() {
    this.add_type_if_needed();
    if (this.datatype === 'OURL')
      await this.intoBlobs();
    if (this.datatype === 'Blob') {
      this.dataURLs = await Promise.all(
        this.dataURLs.map(blobToB64)
      );
      this.datatype = 'B64';
    }
    return this;
  }

  async intoBlobs() {
    this.add_type_if_needed();
    if (this.datatype !== 'Blob') {
      this.dataURLs = await Promise.all(
        this.dataURLs.map(URLToBlob)
      );
      this.datatype = 'Blob';
    }
    return this;
  }

  async intoOURLs() {
    this.add_type_if_needed();
    if (this.datatype === 'B64')
      await this.intoBlobs();
    if (this.datatype === 'Blob') {
      this.dataURLs = await Promise.all(
        this.dataURLs.map(blobToOURL)
      );
      this.datatype = 'OURL';
    }
    return this;
  }

  async intoImgs() {
    this.add_type_if_needed();
    await this.intoOURLs();
    return this.imgStates.map(im => (
      {...im, src: this.dataURLs[im.src]}
    ));
  }
}

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

// exported types:
export {Images,FullImageState,ReducedImages,DerefImageState};

const URLToBlob = (url:imURL) => fetch(url).then(res => res.blob());
export const blobToOURL = (blob:Blob) => URL.createObjectURL(blob);
const blobToB64 = readerProducer(r => r.readAsDataURL) as (b:Blob) => Promise<string>;
export const blobToText = readerProducer(r => r.readAsText) as (b:Blob) => Promise<string>;

