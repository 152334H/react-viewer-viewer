/* This file is only responsible for the buttons that appear on the Viewer viewer page
*/

// react imports
import * as React from 'react'
import {FC} from 'react'
// MUI Icons
import CollectionsIcon from '@mui/icons-material/Collections';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import ArchiveIcon from '@mui/icons-material/Archive';
// other imports
import {invoke} from '@tauri-apps/api/tauri'
import {saveAs} from 'file-saver'
// imports developed / edited for project
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
    icon={<PhotoCameraIcon />} onChange={onChange}/>
}

// button 2: load viewerstate from json file
const UploadAll = ({setImgs,setName}: {
  setImgs: (imgs:Images) => void,
  setName: (name:string) => void
}) => {
  const onChange = (e:any) => {
    const f: File = e.target.files[0];
    blobToText(f).then((json: string) => {
      const obj = JSON.parse(json);
      ReducedImages.fromObj(obj)
        .intoImgs().then(setImgs);
      if (obj.name) setName(obj.name);
    })
  }

  return <UploadButton id="icon-button-file-all"
    icon={<UploadIcon/>} onChange={onChange}/>
}

export const saveObjAsJSON = (obj:any,name:string) =>
  saveAs(new Blob([JSON.stringify(obj)],
      {type: "text/json;charset=utf-8"}
    ), name+'.json');

const nameTimestamp = (name:string) => 
  `images-${Date.now()}-${name
    .replace(/[^a-zA-Z0-9 ]/gi, '_')
  }`

// button 3: save image viewer state to pickle (image-$timestamp.json)
const SaveAll = ({imgs,name}: {imgs:Images,name:string}) => {
  const saveAll = () => {
    new ReducedImages(imgs).intoB64()
    .then(compImgs => saveObjAsJSON(
      {...compImgs, name },
      nameTimestamp(name))
    )
  }
  return <IconButtonSimple icon={<DownloadIcon/>} onClick={saveAll}/>
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
const CompileButton = ({imgs,name}: {imgs:Images,name:string}) => {
  if (!isTauri())
    return <></>;
  return <LoadingButton icon={<ArchiveIcon/>}
    onClick={
      () => zipImages(imgs).then(b =>
        saveAs(b, nameTimestamp(name)+'.zip')
    )}/>
}

interface VBProps {
  setShow: (b:boolean) => void;
  imgs: Images;
  updateImgs: (imgs:Images) => void;
  setActiveIndex: (i:number) => void;
  setName: (name:string) => void;
  name: string;
}

export const ViewerButtons: FC<VBProps> = (
  {setShow,imgs,updateImgs,setActiveIndex,name,setName}
  ) => {
  const replaceImgs = (newImgs:Images) => {
    if (imgs.length !== 0) { setActiveIndex(0); }
    updateImgs(newImgs);
  }
  const calcScale = (w: number, h: number) => {
    // TODO: apply window.screen.* elsewhere.
    // also maybe use availableHeight/Width instead???
    const rat_w = window.screen.width/w;
    const rat_h = window.screen.height/h;
    if (rat_w >= 1 || rat_h >= 1) return 1; // don't zoom in
    return rat_w > rat_h ? rat_w : rat_h; // keep screen filled
  }
  return (<>
    <Uploader addImgs={(ls:string[]) => {
      Promise.all(ls.map(url => new Promise((res,rej) => {
        const img = new Image();
        img.onload = () => {
          const [w,h] = [img.naturalWidth, img.naturalHeight];
          const scale = calcScale(w, h);
          const left = -w/2+window.screen.width/2;
          const top = -h/2+window.screen.height/2;
          res({scale, src: url, left, top});
        }
        img.onerror = e => rej(e);
        img.src = url
      }))).then(ls => updateImgs(imgs
        .concat(ls.map(({src,scale,left,top},ind) => ({
          src, alt: imgs.length+ind, scale, left, top,
          rotate: 0, mirror: false
        })))
    ))}}/>
    <UploadAll setImgs={replaceImgs} setName={setName}/>
    {imgs.length>0 && (()=>(<>
      <IconButtonSimple icon={<CollectionsIcon/>}
        onClick={() => setShow(true)}/>
      <SaveAll imgs={imgs} name={name}/>
      <CompileButton imgs={imgs} name={name}/>
    </>))()}
  </>);
}
