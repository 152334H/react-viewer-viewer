import React from 'react'
import IconButton from '@mui/material/Button';
import Input from '@mui/material/Input';

export const isTauri = () => (
  'rpc' in window
) // TODO: find the correct way to check for Tauri

export const IconButtonSimple = ({icon, onClick=()=>0}) => (
  <IconButton color="primary" component="span" onClick={onClick}>
    {icon}
  </IconButton>
)

export const UploadButton = ({id,icon,onChange}) => (
  <label htmlFor={id}>
    <Input accept="text/json" type='file'
      id={id} style={{display: "none"}}
      inputProps={{ multiple: true }}
      onChange={onChange}/>
    <IconButtonSimple icon={icon}/>
  </label>
)
