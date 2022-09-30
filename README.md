# a homemade tauri native application
This is a small React.js Tauri App I developed to learn the basics of modern Full Stack development.

![](https://152334h.github.io/about/Screenshot_2022_0817_102654.jpg)

The backend API for this project can be found [here](https://github.com/152334H/react-viewer-viewer-api)

Frontend tests have not been developed for this app. I rely primarily on the correctness of TypeScript to avoid basic errors, as well as the tests that exist for the `react-viewer` app upstream.

## How can I use this?
A web demo exists at [GitHub Pages](https://152334h.github.io/react-viewer-viewer). Additionally,

### running webpage locally 

1. install nodejs (I have only tested with `nvm use lts/gallium`)
2. run `git clone https://github.com/152334H/react-viewer-viewer`
3. `npm install && npm start`

### Great, now how do I show that on my desktop as a native window?

1. switch to the `release` branch because `package.json` is slightly different for tauri compilation here.
2. run `npm run tauri dev`.

### That sounds stupid. My computer doesn't even have Rust.

There are outdated builds available in the [releases](https://github.com/152334H/react-viewer-viewer/releases) page. I suggest vetting the open source code before running an arbitrary executable.
