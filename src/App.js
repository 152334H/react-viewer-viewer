/* Just a simple extension of react-viewer into a native app.
 * With a few added bells and whistles like:
 * - additional toolbar buttons
 * - 'pickle'ing the state of the image viewer for future use
 */

import React from 'react'
import Viewer from 'react-viewer'
import {saveAs} from 'file-saver'

import IconButton from '@mui/material/Button';
import Input from '@mui/material/Input';
import CssBaseline from '@mui/material/CssBaseline';
import {PhotoCamera, Download, Upload, Collections, Archive} from '@mui/icons-material';
import {createTheme, ThemeProvider} from '@mui/material/styles'

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { green, red } from '@mui/material/colors';

import {invoke} from '@tauri-apps/api/tauri'

const IconLocal = ({type}) => { // cribbed from react-viewer/Icon.tsx
  const prefixCls = 'react-viewer-icon'
  return <i className={`${prefixCls} ${prefixCls}-${type}`}></i>
}

const IconButtonSimple = ({icon, onClick=()=>0}) => (
  <IconButton color="primary" component="span" onClick={onClick}>
    {icon}
  </IconButton>
)

const UploadButton = ({id,icon,onChange}) => (
  <label htmlFor={id}>
    <Input accept="text/json" type='file'
      id={id} style={{display: "none"}}
      inputProps={{ multiple: true }}
      onChange={onChange}/>
    <IconButtonSimple icon={icon}/>
  </label>
)

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

const logAndRet = v => {console.log(v); return v}

// button 2: load image viewer from pickled state
const UploadAll = ({setImgs}) => {
  const blobToText = readerProducer(r => r.readAsText)

  const onChange = e => blobToText(e.target.files[0]).then(obj => {
    obj = JSON.parse(obj);
      Promise.all(obj.dataURLs.map(b64 => URLToBlob(logAndRet(b64)).then(b=>BlobToOURL(logAndRet(b))))).then(urls => {
      setImgs(obj.imgStates.map(im => (
        {...im, src: urls[im.src]}
      )))
    })
  })

  return <UploadButton id="icon-button-file-all"
    icon={<Upload/>} onChange={onChange}/>
}

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

// button 4: save image viewer state to a bunch of images in a zip (TODO)
const CompileButton = ({imgs}) => {
  if (!('rpc' in window)) // TODO: find the correct way to check for Tauri
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

// additional toolbar buttons.
// TODO: I haven't figured out how to make these display icons yet
const makeButtons = (setImgs, setActiveIndex) => [
  {
    key: "dupe",
    actionType: 100,
    render: <IconLocal type="a" style={{
      content: '\uea0a'}}/>,
    onClick: activeImage => {
      setImgs(imgs => {
        let newImgs = imgs.slice(0, activeImage.alt);
        newImgs.push(activeImage);
        return newImgs.concat(imgs.slice(activeImage.alt)
          .map(i => ({...i,alt: i.alt+1})))
      })
      setActiveIndex(activeImage.alt+1)
    }
  }, {
    key: "trash",
    actionType: 101,
    render: <IconLocal type="b"/>,
    onClick: activeImage => {
      setActiveIndex(activeImage.alt ? activeImage.alt-1 : 0)
      setTimeout(() => setImgs(imgs => imgs
        .slice(0, activeImage.alt)
        .concat(imgs
          .slice(activeImage.alt+1)
          .map(i => ({...i,alt: i.alt-1}))
        )
      ), 0) // timeout forces sAI to run first. Needed to prevent oob index when .alt == imgs.length-1.
    }
  }
]

// the main component from react-viewer. default options written here
// TODO: button to hide the toolbar and etc
const ViewerButMoreSimple = ({setShow, setActiveIndex, activeIndex, imgs, addedButtons}) => (
  <Viewer visible={true} zoomSpeed={0.1}
    drag={true} 
    noResetZoomAfterChange={true}
    noLimitInitializationSize={true}
    maxScale={500}
    onClose={() => setShow(false)}
    images={imgs}
    customToolbar={ls => ls.concat(addedButtons)}
    onIndexChange={setActiveIndex}
    activeIndex={activeIndex}
  />)

function RealApp() {
  const [imgs, setImgs] = React.useState([])
  const [show, setShow] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  const updateImgs = cb => {
    setImgs(imgs => cb(imgs));
    setShow(true);
  }
  const addedButtons = makeButtons(setImgs, setActiveIndex)

  return (<div className="App">
    <header className="App-header">
      <h1>test</h1>
      <h5>zoom level: {window.devicePixelRatio}</h5>
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
      {show && <ViewerButMoreSimple
        imgs={imgs}
        setShow={setShow}
        addedButtons={addedButtons}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />}
    </header>
  </div>)
}

const App = () => (<React.Fragment>
  <ThemeProvider theme={createTheme({
      palette: { mode : 'dark' }
  })}>
    <CssBaseline/>
    <RealApp/>
  </ThemeProvider>
</React.Fragment>)

export default App
