import { Progress, ProgressIndicator } from "@hope-ui/solid"
import { Route, Routes, useIsRouting } from "@solidjs/router"
import {
  Component,
  createEffect,
  createSignal,
  lazy,
  Match,
  onCleanup,
  Switch,
} from "solid-js"
import { Portal } from "solid-js/web"
import { useLoading, useRouter, useT } from "~/hooks"
import { globalStyles } from "./theme"
import {
  bus,
  r,
  handleRespWithoutAuthAndNotify,
  base_path,
  fsGet,
} from "~/utils"
import { password, setSettings } from "~/store"
import { Error, FullScreenLoading } from "~/components"
import { MustUser } from "./MustUser"
import "./index.css"
import { useI18n } from "@solid-primitives/i18n"
import { initialLang, langMap, loadedLangs } from "./i18n"
import { Resp } from "~/types"

const Home = lazy(() => import("~/pages/home/Layout"))
const Manage = lazy(() => import("~/pages/manage"))
const Login = lazy(() => import("~/pages/login"))
const Test = lazy(() => import("~/pages/test"))

const App: Component = () => {
  const t = useT()
  globalStyles()
  const [, { add }] = useI18n()
  const isRouting = useIsRouting()
  const { to, pathname } = useRouter()
  const onTo = (path: string) => {
    to(path)
  }
  bus.on("to", onTo)
  onCleanup(() => {
    bus.off("to", onTo)
  })
  function getVideoBase64(url: string, num: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video")
      video.crossOrigin = "anonymous"
      video.src = url
      video.autoplay = true
      video.muted = true

      video.onloadedmetadata = function () {
        video.currentTime = video.duration * num
        const handleTimeUpdate = function () {
          if (
            video.currentTime.toFixed(2) >= (video.duration * num).toFixed(2)
          ) {
            video.removeEventListener("timeupdate", handleTimeUpdate)
            const canvas = document.createElement("canvas")
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext("2d")
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              const dataURL = canvas.toDataURL("image/webp")
              resolve(dataURL)
              video.pause()
              video.remove()
            }
          }
        }
        video.addEventListener("timeupdate", handleTimeUpdate)
      }
    })
  }

  function dataURLtoBlob(
    url: any,
    filePath: string,
    fileName: string,
    num: number,
  ) {
    getVideoBase64(url, num).then(async (res) => {
      let path = filePath + "/.thumbnails/" + fileName + ".webp"
      // @ts-ignore
      let arr = res.split(","),
        // @ts-ignore
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]),
        n = bstr.length,
        u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      let file = new Blob([u8arr], { type: mime })

      r.put("/fs/put", file, {
        headers: {
          "File-Path": encodeURIComponent(path),
          "As-Task": false,
          "Content-Type": file.type || "application/octet-stream",
          Password: password(),
        },
      }).then((res) => {
        // @ts-ignore
        if (res.code == 200) {
          r.post("/fs/saveUploadThumb", {
            filePath: filePath,
            fileName: fileName,
          }).then((res) => {})
        }
      })
    })
  }
  function upLoadThumb() {
    r.get("/fs/getUploadThumb").then((res) => {
      // @ts-ignore
      if (res.code == 200 && res.data != null) {
        let temp = res.data
        for (const a of temp) {
          fsGet(a.filePath + "/" + a.fileName).then((res) => {
            if (res.code == 200)
              fsGet(a.filePath + "/.thumbnails/" + a.fileName + ".webp").then(
                (res1) => {
                  if (res1.code == 200 && res1.message == "success") {
                    r.post("/fs/saveUploadThumb", {
                      filePath: a.filePath,
                      fileName: a.fileName,
                    }).then((res) => {})
                  } else {
                    dataURLtoBlob(
                      res.data.raw_url,
                      a.filePath,
                      a.fileName,
                      0.03,
                    )
                  }
                },
              )
          })
        }
      }
    })
  }
  createEffect(() => {
    bus.emit("pathname", pathname())
    if (pathname() == "/") upLoadThumb()
  })

  const [err, setErr] = createSignal<string>()
  const [loading, data] = useLoading(() =>
    Promise.all([
      (async () => {
        add(initialLang, (await langMap[initialLang]()).default)
        loadedLangs.add(initialLang)
      })(),
      (async () => {
        handleRespWithoutAuthAndNotify(
          (await r.get("/public/settings")) as Resp<Record<string, string>>,
          setSettings,
          setErr,
        )
      })(),
    ]),
  )
  data()

  return (
    <>
      <Portal>
        <Progress
          indeterminate
          size="xs"
          position="fixed"
          top="0"
          left="0"
          right="0"
          zIndex="$banner"
          d={isRouting() ? "block" : "none"}
        >
          <ProgressIndicator />
        </Progress>
      </Portal>
      <Switch
        fallback={
          <Routes base={base_path}>
            <Route path="/@test" component={Test} />
            <Route path="/@login" component={Login} />
            <Route
              path="/@manage/*"
              element={
                <MustUser>
                  <Manage />
                </MustUser>
              }
            />
            <Route
              path="*"
              element={
                <MustUser>
                  <Home />
                </MustUser>
              }
            />
          </Routes>
        }
      >
        <Match when={err() !== undefined}>
          <Error
            h="100vh"
            msg={
              t("home.fetching_settings_failed") + t("home." + (err() || ""))
            }
          />
        </Match>
        <Match when={loading()}>
          <FullScreenLoading />
        </Match>
      </Switch>
    </>
  )
}

export default App
