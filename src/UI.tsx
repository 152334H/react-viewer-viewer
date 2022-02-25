import React, {ReactElement} from 'react'
import IconButton from '@mui/material/Button';
import Input from '@mui/material/Input';

import {toast} from 'react-toastify';

export const isTauri = () => (
  '__TAURI__' in window
) // TODO: find the correct way to check for Tauri

export const IconButtonSimple = ({icon, onClick=()=>{}}:
  {icon:ReactElement, onClick?:(e:any)=>void}) => (
  <IconButton color="primary" component="span" onClick={onClick}>
    {icon}
  </IconButton>
)

export const UploadButton = ({id, icon, onChange}:
  {id:string,icon:ReactElement,onChange:(e:any)=>void}) => (
  <label htmlFor={id}>
    <Input type='file'
      id={id} style={{display: "none"}}
      inputProps={{ multiple: true }}
      onChange={onChange} value=''/>
    <IconButtonSimple icon={icon}/>
  </label>
) // value='' allows the input to accept the same file twice in a row

export const notifyPromise = (p: Promise<any>, msg: string) => toast.promise(p, {
  pending: msg,
  success: 'Done!',
  error: "Something went wrong"
});
