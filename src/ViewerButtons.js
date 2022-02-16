import React from 'react'
// MUI imports
import IconButton from '@mui/material/Button';
import {PhotoCamera, Download, Upload, Collections, Archive} from '@mui/icons-material';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import {green,red} from '@mui/material/colors';

import {invoke} from '@tauri-apps/api/tauri'
import {saveAs} from 'file-saver'

import {IconButtonSimple,UploadButton,isTauri} from './UI'

const readerProducer = meth => (
  blob => new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    meth(reader).bind(reader)(blob)
  })
)

const URLToBlob = url => fetch(url).then(res => res.blob());
const BlobToOURL = blob => URL.createObjectURL(blob);
const blobToB64 = blob => readerProducer(r => r.readAsDataURL)(blob);

// button 1: upload images from local filesystem
const Uploader = ({addImgs}) => {
  const onChange = e => // run addImg on all images uploaded
    Promise.all(Array.from(e.target.files)
      .filter(f => f.type.match('image.*'))
      .map(BlobToOURL))
      .then(addImgs)

  return <UploadButton id="icon-button-file"
    icon={<PhotoCamera />} onChange={onChange}/>
}

// button 2: load image viewer from pickled state
const UploadAll = ({setImgs}) => {
  const blobToText = readerProducer(r => r.readAsText)

  const onChange = e => blobToText(e.target.files[0]).then(obj => {
    obj = JSON.parse(obj);
      Promise.all(obj.dataURLs.map(b64 => URLToBlob(b64).then(BlobToOURL))).then(urls => {
      setImgs(obj.imgStates.map(im => (
        {...im, src: urls[im.src]}
      )))
    })
  })

  return <UploadButton id="icon-button-file-all"
    icon={<Upload/>} onChange={onChange}/>
}

// TODO:check the speed of this (is it fast enough?)
const compressImgs = imgs => {
  let dataURLs = [];
  let imgStates = imgs.map(i => {
    let ind = dataURLs.findIndex(d => d === i.src)
    if (ind === -1) {
      dataURLs.push(i.src)
      ind = dataURLs.length - 1
    }
    return {...i, src: ind}
  });
    return Promise.all(dataURLs.map(objURL => URLToBlob(objURL).then(blobToB64)))
        .then(dataURLs => ({dataURLs, imgStates}))
}

// button 3: save image viewer state to pickle (image-$timestamp.json)
const SaveAll = ({imgs}) => {
  const saveAll = () => {
    compressImgs(imgs).then(compImgs => 
      saveAs(new Blob([JSON.stringify(compImgs)],
        {type: "text/json;charset=utf-8"}),
        `images-${Date.now()}.json`)
    )
  }
  return <IconButtonSimple icon={<Download/>} onClick={saveAll}/>
}

const LoadingButton = ({icon, onClick}) => {
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(null);

  const buttonSx = {
    ...(success!==null && ( success ? {
      bgcolor: green[500],
      '&:hover': { bgcolor: green[700], },
    } : {
      bgcolor: red[500],
      '&:hover': { bgcolor: red[700], },
    })),
  };

  const handleButtonClick = () => {
    if (!loading) {
      setSuccess(null); setLoading(true);
      onClick().then(() => setSuccess(true)
      ).catch(() => setSuccess(false)
      ).finally(() => setLoading(false));
    }
  };
  // have no idea how this works, copied from MUI examples
  return (<Box sx={{ display: 'flex', alignItems: 'center' }}>
    <Box sx={{ m: 1, position: 'relative' }}>
      <IconButton sx={buttonSx} variant="contained" disabled={loading} onClick={handleButtonClick}>
        {icon}
      </IconButton>
      {loading && (
        <CircularProgress
          size={24}
          sx={{
            color: green[500],
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-12px',
            marginLeft: '-12px',
          }}
        />
      )}
    </Box>
  </Box>);
}

// button 4: save image viewer state to a bunch of images in a zip
const CompileButton = ({imgs}) => {
  if (!isTauri()) // TODO: find the correct way to check for Tauri
    return <></>;
  return <LoadingButton icon={<Archive/>} onClick={() => {
    // this will be really slow!
    return compressImgs(imgs).then(compImgs =>
      invoke('compile_compressed_images', {json:
        //{imgStates: imgs, zoom: window.devicePixelRatio}
        {json_images: compImgs, zoom: window.devicePixelRatio}
      }).then(res => {
        let byteArray = new Uint8Array(res);
        saveAs(new Blob([byteArray], {type: "application/zip"}),
      `images-${Date.now()}.zip`)
      }).catch(e => {
        window.alert(`something went wrong in tauri command "compile_compressed_images": ${e}`);
        throw new Error('invoke error')
      })
    )
  }}/>
}

// button 5: TESTING
const ZipButton = ({imgs}) => {
  if (!('rpc' in window)) // TODO: find the correct way to check for Tauri
    return <></>;
  return <LoadingButton icon={<Archive/>} onClick={() => {
    // this will be really slow!
    return invoke('zip_imagestate', {json:
        //{imgStates: imgs, zoom: window.devicePixelRatio}
        {json_images: imgs, zoom: window.devicePixelRatio}
      }).then(res => {
        window.alert(res);
          /*
        let byteArray = new Uint8Array(res);
        saveAs(new Blob([byteArray], {type: "application/zip"}),
      `images-${Date.now()}.zip`)
      */
      }).catch(e => {
        window.alert(`something went wrong in tauri command "zip_imagestate": ${e}`);
        throw new Error('invoke error')
      })
  }}/>
}

export const ViewerButtons = ({state}) => {
  let [setShow,imgs,updateImgs] = state;
  // TODO: in UploadAll, why do I need that updateImgs wrapper?
  return (<>
    <Uploader addImgs={ls => updateImgs(_ => imgs
      .concat(ls.map((i,ind) => (
        {src: i, alt: imgs.length+ind, scale: 1}
      )))
    )}/>
    <UploadAll setImgs={imgs => updateImgs(()=>imgs)}/>
    {imgs.length>0 && (()=>(<>
      <IconButtonSimple icon={<Collections/>}
        onClick={() => setShow(true)}/>
      <SaveAll imgs={imgs}/>
      <CompileButton imgs={imgs}/>
      <ZipButton imgs={imgs}/>
    </>))()}
  </>);
}
