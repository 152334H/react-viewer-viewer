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
import {PhotoCamera, Download, Upload, Collections} from '@mui/icons-material';

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

// button 1: upload images from local filesystem
const Uploader = ({addImgs}) => {
  const blobToData = readerProducer(r => r.readAsDataURL)

  const onChange = e => // run addImg on all images uploaded
    Promise.all(Array.from(e.target.files)
      .filter(f => f.type.match('image.*'))
      .map(blobToData))
      .then(addImgs)

  return <UploadButton id="icon-button-file"
    icon={<PhotoCamera />} onChange={onChange}/>
}

// button 2: load image viewer from pickled state
const UploadAll = ({setImgs}) => {
  const blobToText = readerProducer(r => r.readAsText)

  const onChange = e => blobToText(e.target.files[0]).then(obj => {
    obj = JSON.parse(obj)
    setImgs(obj.imgStates.map(im => (
      {...im, src: obj.dataURLs[im.src]}
    )))
  })

  return <UploadButton id="icon-button-file-all"
    icon={<Upload/>} onChange={onChange}/>
}

// button 3: save image viewer state to pickle (image-$timestamp.json)
const SaveAll = ({imgs}) => {
  const saveAll = () => {
    let dataURLs = [];
    let imgStates = imgs.map(i => {
      let ind = dataURLs.findIndex(d => d === i.src)
      if (ind === -1) {
        dataURLs.push(i.src)
        ind = dataURLs.length - 1
      }
      return {...i, src: ind}
    });
    saveAs(new Blob([JSON.stringify({dataURLs, imgStates})],
      {type: "text/json;charset=utf-8"}),
      `images-${Date.now()}.json`)
  }
  return <IconButtonSimple icon={<Download/>} onClick={saveAll}/>
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
      <Uploader addImgs={ls => updateImgs(_ => imgs
        .concat(ls.map((i,ind) => (
          {src: i, alt: imgs.length+ind, scale: 1}
        )))
      )}/>
      <SaveAll imgs={imgs}/>
      <UploadAll setImgs={imgs => updateImgs(()=>imgs)}/>
      {imgs.length>0 && <IconButtonSimple
        icon={<Collections/>}
        onClick={() => setShow(true)}
      />}
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
    <CssBaseline/>
    <RealApp/>
</React.Fragment>)

export default App
