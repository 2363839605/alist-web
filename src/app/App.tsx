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
      video.crossOrigin = "anonymous" // 处理跨域
      video.src = url
      video.autoplay = true
      video.muted = true // 可选：静音视频以避免自动播放策略阻止

      // 监听视频加载完成并可以播放
      video.onloadedmetadata = function () {
        // 设置视频当前时间为第二秒
        video.currentTime = video.duration * num

        // 监听时间更新事件
        const handleTimeUpdate = function () {
          // 检查是否已到达或超过了第二秒
          if (video.currentTime >= video.duration * num) {
            // 移除时间更新事件监听器
            video.removeEventListener("timeupdate", handleTimeUpdate)

            // 绘制视频帧到canvas
            const canvas = document.createElement("canvas")
            canvas.width = video.videoWidth // 使用视频的原始宽度
            canvas.height = video.videoHeight // 使用视频的原始高度
            const ctx = canvas.getContext("2d")
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

              // 将canvas转换为Base64图片
              const dataURL = canvas.toDataURL("image/webp")
              resolve(dataURL)
              // 如果需要，可以在这里清理视频元素
              video.pause()
              video.remove()
            }
          }
        }

        video.addEventListener("timeupdate", handleTimeUpdate)
      }

      // 通常不需要将视频元素添加到DOM中，除非需要显示视频
      // document.body.appendChild(video);
    })
  }

  function dataURLtoBlob(url: any, path: string, num: number) {
    getVideoBase64(url, num).then(async (res) => {
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
      })
    })
  }
  function upLoadThumb() {
    let temp = JSON.parse(localStorage.getItem("thumbUpload") as string)
    if (temp != null && temp != []) {
      for (const a of temp) {
        fsGet(a[0] + "/" + a[1]).then((res) => {
          // console.log("=================================")
          if (res.code == 200) {
            dataURLtoBlob(
              res.data.raw_url,
              a[0] + "/.thumbnails/" + a[1] + ".webp",
              0.03,
            )
            temp.shift()
            if (temp.length == 0) {
              localStorage.removeItem("thumbUpload")
            }
          }
        })
      }
    }
  }
  createEffect(() => {
    bus.emit("pathname", pathname())
    upLoadThumb()
    console.log("12321312312312")
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
