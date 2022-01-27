# How can I use this?

The right question to ask is, "_Why_ should I use this?"

# Why should I use this?

You should not. As the project description notes, this project is a personal exercise and will be filled with unintentional examples of terrible development practices. I am only publishing this for the free Github Action hours I want to use to compile native Windows binaries.

# But I really want to, though.

Okay, but don't say I didn't warn you.

The first step is to clone this repository AND my fork of [react-viewer](https://github.com/152334H/react-viewer) into separate directories, with your filesystem looking like this:

```sh
$ tree ~ -L 1 | grep react
├── react-viewer
├── react-viewer-viewer
```

Then, you will need to build `react-viewer` with `node < 17.0.0`. I'm not sure why it doesn't work on the latest npm version and the webdevs I know were unable/unavailable to explain it too.

```sh
~/react-viewer$ nvm use lts/gallium && npm install && npm build
```

If you're wondering how to test the application, there is no testing. I broke the test suite for react-viewer because I had to remove a package (the package-lock.json link was a 404) to get it to compile locally successfully.

Anyway, once react-viewer compiles, you can move to react-viewer-viewer to try out the thing on development mode:

```sh
~/react-viewer-viewer$ nvm use v17.3.0 && npm install && npm start
```

#### Great, now how do I turn that webpage into a native binary?

I have no idea. The next twenty commits or so in the `.github/` folder will be my discovery process for that.
