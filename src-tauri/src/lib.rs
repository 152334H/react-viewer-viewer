use std::error::Error;
use std::io::{Cursor,Write};
use std::convert::{TryInto,TryFrom};
use serde::{Deserialize, Serialize};
use image::{ImageBuffer, Rgba, DynamicImage};
use image::imageops::{FilterType, overlay};
use rayon::prelude::*;
use zip::write::{FileOptions, ZipWriter};

#[derive(Serialize, Deserialize)]
struct JSONImgState {
    src: String,
    alt: i32,
    scale: f64,
    left: f64,
    top: f64,
    rotate: i32
}
#[allow(non_snake_case)]
#[derive(Serialize, Deserialize)]
pub struct JSONViewerState {
    imgStates: Vec<JSONImgState>,
    zoom: f64
}

struct ImgState {
    img: DynamicImage,
    scale: f64,
    pos: (i32,i32),
    rotate: i32,
    zoom: f64
}

impl TryFrom<JSONViewerState> for Vec<ImgState> {
    type Error = Box<dyn Error>;
    //TODO: make this parallel
    fn try_from(viewerstate: JSONViewerState) -> Result<Self, Self::Error> {
        let zoom = viewerstate.zoom; // closure dumbness
        viewerstate.imgStates.into_iter().map(|imgstate| {
            // read the original image
            let blob = base64::decode(&imgstate.src[imgstate.src.find(',').unwrap()+1..])?;
            let reader = image::io::Reader::new(
                Cursor::new(&blob)
                ).with_guessed_format()?;
            Ok(ImgState {
                img: reader.decode()?,
                scale: imgstate.scale,
                pos: (imgstate.left as i32, imgstate.top as i32),
                rotate: imgstate.rotate,
                zoom
            })
        }).collect()
    }
}

const MAX_DIMENS: (u32,u32) = (1920,1080);
const FILTER: FilterType = FilterType::CatmullRom;

pub type Img = ImageBuffer::<Rgba<u8>, Vec<u8>>;

fn blank_image() -> Img {
    ImageBuffer::from_pixel(MAX_DIMENS.0, MAX_DIMENS.1, Rgba([0,0,0,255]))
}

impl Into<Img> for ImgState {
    fn into(self) -> Img {
        fn relu(x: i32) -> u32 { if x < 0 { 0 } else { x as u32 } }
        // apply rotations
        let img = match self.rotate % 360 {
            90|-270 => self.img.rotate90(),
            180|-180 => self.img.rotate180(),
            270|-90 => self.img.rotate270(),
            _ => self.img
        };

        // TODO: speed up scaling by predicting what section of the image is needed
        // apply scale
        fn mul_round(a: f64, b: u32) -> u32 { (a*b as f64) as u32 }
        let orig_dimens = img.to_rgba8().dimensions();
        let dimens = (
            mul_round(self.scale,orig_dimens.0),
            mul_round(self.scale,orig_dimens.1)
        );
        let img = img.resize(dimens.0, dimens.1, FILTER);

        // let's say the center of the original image is (0,0).
        // zooming the image will expand it in all quadrants.
        // We can put the position of the viewport on the 2d grid:
        /* /-------^------\
         * |       |      |
         * |     /-+--\   |
         * |     | |  |   |
         * |-----+-+--+--->
         * |     \-+--/   |
         * |       |      |
         * |       |      |
         * \--------------/
         */
        let viewpos: (i32,i32) = (
          -((orig_dimens.0 as i32/2) + self.pos.0),// x is negative in the above diagram
            (orig_dimens.1 as i32/2) + self.pos.1
        );
        let viewbottom = (
            viewpos.0+MAX_DIMENS.0 as i32, // x increases
            viewpos.1-MAX_DIMENS.1 as i32  // y decreases
        );
        // The scale expands the image outwards from 0. We need to find
        // the position of the viewport relative to the image.
        let img_pos: (i32,i32) = (-(dimens.0 as i32/2), dimens.1 as i32/2);
        //let img_bottom: (i32,i32) = (-img_pos.0, -img_pos.1);
        let relative_viewpos = (
            viewpos.0-img_pos.0,
          -(viewpos.1-img_pos.1) // axis direction!
        );
        let relative_viewbottom = (
            viewbottom.0-img_pos.0,
          -(viewbottom.1-img_pos.1),
        );
        // if relative_viewbottom.0.min(relative_viewbottom.1) < 0 { panic!("Your conceptualization sucks!") }
        let visible = img.crop_imm(
            relu(relative_viewpos.0),
            relu(relative_viewpos.1),
            dimens.0.min(relative_viewbottom.0 as u32),
            dimens.1.min(relative_viewbottom.1 as u32)
        );
        // `visible` is now a cropout of the part of the image that's visible on the image viewer.

        let vis_size = visible.to_rgba8().dimensions();
        let visible = visible.resize(
            (vis_size.0 as f64 * self.zoom) as u32,
            (vis_size.1 as f64 * self.zoom) as u32,
            FILTER
        ); // this is to account for windows DPI scaling. Might produce unintended consequences on other machines.

        let mut viewport = blank_image();
        overlay(&mut viewport, &visible,
            if relative_viewpos.0 < 0 { (-relative_viewpos.0) as u32 } else { 0 },
            if relative_viewpos.1 < 0 { (-relative_viewpos.1) as u32 } else { 0 }
        );
        viewport
    }
}

fn imgs_to_zip(imgs: Vec<Img>) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut buf = Vec::new();
    let mut zip = ZipWriter::new(Cursor::new(&mut buf));
    // this cannot be parallelized because the zip writer is not thread-safe
    for (i,im) in imgs.into_iter().enumerate() {
        zip.start_file(format!("{}.jpg",i).as_str(), FileOptions::default())?;
        let mut img_buf = Vec::new();
        let mut img_cur = Cursor::new(&mut img_buf);
        let mut encoder = image::jpeg::JpegEncoder::new(&mut img_cur);
        encoder.encode_image(&im)?;
        zip.write(&img_buf)?;
    }
    zip.finish()?;
    drop(zip);
    Ok(buf)
}

pub fn viewer_to_zip(json: JSONViewerState) -> Result<Vec<u8>, Box<dyn Error>> {
    let ls: Vec<ImgState> = json.try_into()?; // sequential
    imgs_to_zip( // sequential
        ls.into_par_iter().map(|is| is.into()).collect() // parallel
    )
}
