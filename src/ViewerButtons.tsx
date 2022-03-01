import * as React from 'react'
import {FC} from 'react'
// MUI imports
import {PhotoCamera, Download, Upload, Collections, Archive} from '@mui/icons-material';

import {invoke} from '@tauri-apps/api/tauri'
import {saveAs} from 'file-saver'

import {IconButtonSimple,UploadButton,isTauri,LoadingButton} from './UI'
import {Images,ReducedImages} from './ImageState'
import {blobToOURL,blobToText} from './ImageState'

// button 1: upload images from local fs
const Uploader = ({addImgs}: {addImgs: (urls:string[])=>void}) => {
  const onChange = (e:any) => // run addImg on all images uploaded
    Promise.all(Array.from(e.target.files)
      .filter((f:File) => f.type.match('image.*'))
      .map(blobToOURL)
    ).then(addImgs)

  return <UploadButton id="icon-button-file"
    icon={<PhotoCamera />} onChange={onChange}/>
}

// button 2: load viewerstate from json file
const UploadAll = ({setImgs}: {setImgs:(imgs:Images)=>void}) => {
  const onChange = (e:any) => blobToText(e.target.files[0]).then((json: string) => {
    const obj = ReducedImages.fromObj(JSON.parse(json))
    obj.intoImgs().then(setImgs);
  })

  return <UploadButton id="icon-button-file-all"
    icon={<Upload/>} onChange={onChange}/>
}

// button 3: save image viewer state to pickle (image-$timestamp.json)
const SaveAll = ({imgs}: {imgs:Images}) => {
  const saveAll = () => {
    new ReducedImages(imgs).intoB64().then(compImgs => 
      saveAs(new Blob([JSON.stringify(compImgs)],
        {type: "text/json;charset=utf-8"}),
        `images-${Date.now()}.json`)
    )
  }
  return <IconButtonSimple icon={<Download/>} onClick={saveAll}/>
}

export const flattenImages = async (imgs:Images) => {
  const compImgs = await new ReducedImages(imgs).intoB64();
  const flattened = await invoke('flatten_images', {
    compImgs: compImgs.dataURLs, derefImgStates: compImgs.imgStates
  }).catch(e => window.alert("rust::flatten_images: "+e)) as any[];
  // TODO: figure out how to make the serialisation send/return Uint8Array, not number[]
  return flattened
    .map((arr: number[]) => new Uint8Array(arr))
    .map(d => new Blob([d],{type:'image/png'}))
    .map((b,i) => ({ src: blobToOURL(b), alt:i,
         scale: 1, left: 0, top: 0, rotate: 0
    }));
}

const zipImages = async (imgs:Images) => {
  // this will be really slow!
  const reduced = await new ReducedImages(imgs).intoB64();
  const {datatype, ...jsonImages} = reduced;
  try {
    const zip_bytes: number[] = await invoke(
      'compile_compressed_images', {
        zoom: window.devicePixelRatio,
        jsonImages,
      }
    );
    const bArr = new Uint8Array(zip_bytes);
    return new Blob([bArr], {type: 'application/zip'});
  } catch (e) {
    window.alert(`something went wrong in tauri command "compile_compressed_images": ${e}`);
    throw new Error('invoke error')
  }
}

// button 4: save image viewer state to a bunch of images in a zip
const CompileButton = ({imgs}: {imgs:Images}) => {
  if (!isTauri())
    return <></>;
  return <LoadingButton icon={<Archive/>}
    onClick={
      () => zipImages(imgs).then(b =>
        saveAs(b, `images-${Date.now()}.zip`)
    )}/>
}

interface VBProps {
  setShow: (b:boolean) => void;
  imgs: Images;
  updateImgs: (imgs:Images) => void;
  setFlattened: (flat: null|Images) => void;
  setActiveIndex: (i:number) => void;
}

export const ViewerButtons: FC<VBProps> = (
  {setShow,imgs,updateImgs,setFlattened,setActiveIndex}
  ) => {
  const replaceImgs = (newImgs:Images) => {
    if (imgs.length !== 0) { setActiveIndex(0); }
    updateImgs(newImgs);
  }
  return (<>
    <Uploader addImgs={(ls:string[]) => updateImgs(imgs
      .concat(ls.map((url,ind) => ({
          src: url, alt: imgs.length+ind,
          scale: 1, left: 0, top: 0, rotate: 0
      })))
    )}/>
    <UploadAll setImgs={replaceImgs}/>
    {imgs.length>0 && (()=>(<>
      <IconButtonSimple icon={<Collections/>}
        onClick={() => setShow(true)}/>
      <SaveAll imgs={imgs}/>
      <CompileButton imgs={imgs}/>
    </>))()}
  </>);
}
