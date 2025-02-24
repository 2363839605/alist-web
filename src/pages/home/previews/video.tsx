import { Box } from "@hope-ui/solid"
import { createSignal, onCleanup, onMount } from "solid-js"
import { useRouter, useLink } from "~/hooks"
import { getSettingBool, objStore, password } from "~/store"
import { ObjType } from "~/types"
import { ext, fsGet, pathDir, pathJoin, r } from "~/utils"
import Artplayer from "artplayer"
import { type Option } from "artplayer/types/option"
import { type Setting } from "artplayer/types/setting"
import { type Events } from "artplayer/types/events"
import artplayerPluginDanmuku from "artplayer-plugin-danmuku"
import artplayerPluginAss from "~/components/artplayer-plugin-ass"
import flvjs from "flv.js"
import Hls from "hls.js"
import { currentLang } from "~/app/i18n"
import { AutoHeightPlugin, VideoBox } from "./video_box"
import { ArtPlayerIconsSubtitle } from "~/components/icons"
import { useNavigate } from "@solidjs/router"

const Preview = () => {
  const { pathname, searchParams } = useRouter()
  const { proxyLink } = useLink()
  const navigate = useNavigate()
  let videos = objStore.objs.filter((obj) => obj.type === ObjType.VIDEO)
  if (videos.length === 0) {
    videos = [objStore.obj]
  }
  const next_video = () => {
    const index = videos.findIndex((f) => f.name === objStore.obj.name)
    if (index < videos.length - 1) {
      navigate(
        pathJoin(pathDir(location.pathname), videos[index + 1].name) +
          "?auto_fullscreen=" +
          player.fullscreen,
      )
    }
  }
  const previous_video = () => {
    const index = videos.findIndex((f) => f.name === objStore.obj.name)
    if (index > 0) {
      navigate(
        pathJoin(pathDir(location.pathname), videos[index - 1].name) +
          "?auto_fullscreen=" +
          player.fullscreen,
      )
    }
  }
  let player: Artplayer
  let flvPlayer: flvjs.Player
  let hlsPlayer: Hls
  let option: Option = {
    id: pathname(),
    container: "#video-player",
    url: objStore.raw_url,
    title: objStore.obj.name,
    volume: 0.5,
    autoplay: getSettingBool("video_autoplay"),
    autoSize: false,
    autoMini: true,
    loop: false,
    flip: true,
    playbackRate: true,
    aspectRatio: true,
    setting: true,
    hotkey: true,
    pip: true,
    mutex: true,
    fullscreen: true,
    fullscreenWeb: true,
    subtitleOffset: true,
    miniProgressBar: false,
    playsInline: true,
    // layers: [],
    // settings: [],
    // contextmenu: [],
    controls: [
      {
        name: "previous-button",
        index: 10,
        position: "left",
        html: '<svg fill="none" stroke-width="2" xmlns="http://www.w3.org/2000/svg" height="22" width="22" class="icon icon-tabler icon-tabler-player-track-prev-filled" width="1em" height="1em" viewBox="0 0 24 24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="overflow: visible; color: currentcolor;"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M20.341 4.247l-8 7a1 1 0 0 0 0 1.506l8 7c.647 .565 1.659 .106 1.659 -.753v-14c0 -.86 -1.012 -1.318 -1.659 -.753z" stroke-width="0" fill="currentColor"></path><path d="M9.341 4.247l-8 7a1 1 0 0 0 0 1.506l8 7c.647 .565 1.659 .106 1.659 -.753v-14c0 -.86 -1.012 -1.318 -1.659 -.753z" stroke-width="0" fill="currentColor"></path></svg>',
        tooltip: "Previous",
        click: function () {
          previous_video()
        },
      },
      {
        name: "next-button",
        index: 11,
        position: "left",
        html: '<svg fill="none" stroke-width="2" xmlns="http://www.w3.org/2000/svg" height="22" width="22" class="icon icon-tabler icon-tabler-player-track-next-filled" width="1em" height="1em" viewBox="0 0 24 24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="overflow: visible; color: currentcolor;"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M2 5v14c0 .86 1.012 1.318 1.659 .753l8 -7a1 1 0 0 0 0 -1.506l-8 -7c-.647 -.565 -1.659 -.106 -1.659 .753z" stroke-width="0" fill="currentColor"></path><path d="M13 5v14c0 .86 1.012 1.318 1.659 .753l8 -7a1 1 0 0 0 0 -1.506l-8 -7c-.647 -.565 -1.659 -.106 -1.659 .753z" stroke-width="0" fill="currentColor"></path></svg>',
        tooltip: "Next",
        click: function () {
          next_video()
        },
      },
    ],
    quality: [],
    // highlight: [],
    plugins: [AutoHeightPlugin],
    whitelist: [],
    settings: [],
    // subtitle:{}
    moreVideoAttr: {
      // @ts-ignore
      "webkit-playsinline": true,
      playsInline: true,
    },
    type: ext(objStore.obj.name),
    customType: {
      flv: function (video: HTMLMediaElement, url: string) {
        flvPlayer = flvjs.createPlayer(
          {
            type: "flv",
            url: url,
          },
          { referrerPolicy: "same-origin" },
        )
        flvPlayer.attachMediaElement(video)
        flvPlayer.load()
      },
      m3u8: function (video: HTMLMediaElement, url: string) {
        hlsPlayer = new Hls()
        hlsPlayer.loadSource(url)
        hlsPlayer.attachMedia(video)
        if (!video.src) {
          video.src = url
        }
      },
    },
    lang: ["en", "zh-cn", "zh-tw"].includes(currentLang().toLowerCase())
      ? (currentLang().toLowerCase() as string)
      : "en",
    lock: true,
    fastForward: true,
    autoPlayback: true,
    autoOrientation: true,
    airplay: true,
  }

  let subtitle = objStore.related.filter((obj) => {
    for (const ext of [".srt", ".ass", ".vtt"]) {
      if (obj.name.endsWith(ext)) {
        return true
      }
    }
    return false
  })
  const danmu = objStore.related.find((obj) => {
    for (const ext of [".xml"]) {
      if (obj.name.endsWith(ext)) {
        return true
      }
    }
    return false
  })

  // TODO: add a switch in manage panel to choose whether to enable `libass-wasm`
  const enableEnhanceAss = true
  let isEnhanceAssMode = false
  if (subtitle.length != 0) {
    // set default subtitle
    const defaultSubtitle = subtitle[0]
    if (enableEnhanceAss && ext(defaultSubtitle.name).toLowerCase() === "ass") {
      isEnhanceAssMode = true
      option.plugins?.push(
        artplayerPluginAss({
          // debug: true,
          subUrl: proxyLink(defaultSubtitle, true),
        }),
      )
    } else {
      option.subtitle = {
        url: proxyLink(defaultSubtitle, true),
        type: ext(defaultSubtitle.name),
        escape: false,
      }
    }
    subtitlePer()
  }

  function subtitlePer() {
    // render subtitle toggle menu
    const innerMenu: Setting[] = [
      {
        id: "setting_subtitle_display",
        html: "Display",
        tooltip: "Show",
        switch: true,
        onSwitch: function (item: Setting) {
          item.tooltip = item.switch ? "Hide" : "Show"
          setSubtitleVisible(!item.switch)

          // sync menu subtitle tooltip
          const menu_sub = option.settings?.find(
            (_) => _.id === "setting_subtitle",
          )
          menu_sub && (menu_sub.tooltip = item.tooltip)

          return !item.switch
        },
      },
    ]
    subtitle.forEach((item, i) => {
      innerMenu.push({
        default: i === 0,
        html: (
          <span
            title={item.name}
            style={{
              "max-width": "200px",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "word-break": "break-all",
              "white-space": "normal",
              display: "-webkit-box",
              "-webkit-line-clamp": "2",
              "-webkit-box-orient": "vertical",
              "font-size": "12px",
            }}
          >
            {item.name}
          </span>
        ) as HTMLElement,
        name: item.name,
        url: proxyLink(item, true),
      })
    })

    option.settings?.push({
      id: "setting_subtitle",
      html: "Subtitle",
      tooltip: "Show",
      icon: ArtPlayerIconsSubtitle({ size: 24 }) as HTMLElement,
      selector: innerMenu,
      onSelect: function (item: Setting) {
        if (enableEnhanceAss && ext(item.name).toLowerCase() === "ass") {
          isEnhanceAssMode = true
          this.emit("artplayer-plugin-ass:switch" as keyof Events, item.url)
          setSubtitleVisible(true)
        } else {
          isEnhanceAssMode = false
          this.subtitle.switch(item.url, { name: item.name })
          this.once("subtitleLoad", setSubtitleVisible.bind(this, true))
        }

        const switcher = innerMenu.find(
          (_) => _.id === "setting_subtitle_display",
        )

        if (switcher && !switcher.switch) switcher.$html?.click?.()

        // sync from display switcher
        return switcher?.tooltip
      },
    })

    function setSubtitleVisible(visible: boolean) {
      const type = isEnhanceAssMode ? "ass" : "webvtt"

      switch (type) {
        case "ass":
          player.subtitle.show = false
          player.emit("artplayer-plugin-ass:visible" as keyof Events, visible)
          break

        case "webvtt":
        default:
          player.subtitle.show = visible
          player.emit("artplayer-plugin-ass:visible" as keyof Events, false)
          break
      }
    }
  }

  if (danmu) {
    option.plugins?.push(
      artplayerPluginDanmuku({
        danmuku: proxyLink(danmu, true),
        speed: 5,
        opacity: 1,
        fontSize: 25,
        color: "#FFFFFF",
        mode: 0,
        margin: [0, "0%"],
        antiOverlap: false,
        useWorker: true,
        synchronousPlayback: false,
        lockTime: 5,
        maxLength: 100,
        minWidth: 200,
        maxWidth: 400,
        theme: "dark",
        heatmap: true,
      }),
    )
  }
  onMount(() => {
    /*
     * 截取视频的第一帧
     */
    // function getVideoBase64(url: string,num:number): Promise<string> {
    //   return new Promise((resolve, reject) => {
    //     const video = document.createElement("video");
    //     video.crossOrigin = 'anonymous'; // 处理跨域
    //     video.src = url;
    //     video.autoplay = true;
    //     video.muted = true; // 可选：静音视频以避免自动播放策略阻止
    //
    //     // 监听视频加载完成并可以播放
    //     video.onloadedmetadata = function () {
    //       // 设置视频当前时间为第二秒
    //       video.currentTime = video.duration*num;
    //
    //       // 监听时间更新事件
    //       const handleTimeUpdate = function () {
    //         // 检查是否已到达或超过了第二秒
    //         if (video.currentTime >=num*video.duration) {
    //           // 移除时间更新事件监听器
    //           video.removeEventListener('timeupdate', handleTimeUpdate);
    //
    //           // 绘制视频帧到canvas
    //           const canvas = document.createElement("canvas");
    //           canvas.width = video.videoWidth; // 使用视频的原始宽度
    //           canvas.height = video.videoHeight; // 使用视频的原始高度
    //           const ctx = canvas.getContext("2d");
    //           if (ctx) {
    //             ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    //
    //             // 将canvas转换为Base64图片
    //             const dataURL = canvas.toDataURL('image/webp');
    //             resolve(dataURL);
    //             // 如果需要，可以在这里清理视频元素
    //             video.pause();
    //             video.remove();
    //           }
    //         }
    //       };
    //
    //       video.addEventListener('timeupdate', handleTimeUpdate);
    //
    //
    //       // 可选：监听加载失败事件
    //       video.onabort = function () {
    //         reject(new Error('Video loading aborted'));
    //         // 移除时间更新事件监听器
    //         video.removeEventListener('timeupdate', handleTimeUpdate);
    //       };
    //     };
    //
    //     // 通常不需要将视频元素添加到DOM中，除非需要显示视频
    //     // document.body.appendChild(video);
    //   });
    // }
    //
    // function dataURLtoBlob(url:any,path:string,num:number) {
    //   getVideoBase64(url,num).then(async res => {
    //     // @ts-ignore
    //     let arr = res.split(","),
    //       // @ts-ignore
    //       mime = arr[0].match(/:(.*?);/)[1],
    //       bstr = atob(arr[1]),
    //       n = bstr.length,
    //       u8arr = new Uint8Array(n)
    //     while (n--) {
    //       u8arr[n] = bstr.charCodeAt(n)
    //     }
    //     let file = new Blob([u8arr], { type: mime })
    //     await r.put("/fs/put", file, {
    //       headers: {
    //         "File-Path": encodeURIComponent(path),
    //         "As-Task": false,
    //         "Content-Type": file.type || "application/octet-stream",
    //         Password: password(),
    //       },
    //     })
    //   })
    // }

    player = new Artplayer(option)

    // @ts-ignore

    let auto_fullscreen: boolean
    switch (searchParams["auto_fullscreen"]) {
      case "true":
        auto_fullscreen = true
      case "false":
        auto_fullscreen = false
      default:
        auto_fullscreen = false
    }
    player.on("ready", () => {
      player.fullscreen = auto_fullscreen
      //   console.log("加载完成")
      // dataURLtoBlob(objStore.raw_url,pathname().slice(0,pathname().lastIndexOf('/')+1)+".thumbnails/"+objStore.obj.name+".webp",0.03)
    })
    if (subtitle.length == 0) {
      function find(str: string, cha: any, num: number) {
        let x = str.indexOf(cha)
        for (let i = 0; i < num; i++) {
          x = str.indexOf(cha, x + 1)
        }
        return x
      }
      function setSubtitle(result: any, type: string) {
        const defaultSubtitle = result.data
        if (
          enableEnhanceAss &&
          ext(defaultSubtitle.name).toLowerCase() === "ass"
        ) {
          isEnhanceAssMode = true
          option.plugins?.push(
            artplayerPluginAss({
              // debug: true,
              subUrl:
                option.url.slice(0, find(option.url, "/", 2)) +
                "/d" +
                subtitlePath +
                "." +
                type +
                "?sign=" +
                result.data.sign,
            }),
          )
        } else {
          option.subtitle = {
            url:
              option.url.slice(0, find(option.url, "/", 2)) +
              "/d" +
              subtitlePath +
              "." +
              type +
              "?sign=" +
              result.data.sign,
            type: ext(result.data.name),
          }
        }
        subtitlePer()
        player.destroy()
        player = new Artplayer(option)
        //
        // player.on("ready", () => {
        //   player.fullscreen = auto_fullscreen
        //   console.log("加载完成")
        //   dataURLtoBlob(objStore.raw_url,pathname().slice(0,pathname().lastIndexOf('/')+1)+".thumbnails/"+objStore.obj.name+".webp",0.03)
        // })
      }
      let subtitlePath =
        useRouter()
          .pathname()
          .slice(0, useRouter().pathname().lastIndexOf("/") + 1) +
        ".subtitle/" +
        objStore.obj.name.slice(0, objStore.obj.name.lastIndexOf("."))
      fsGet(subtitlePath + ".srt").then((result) => {
        if (result.code == 200) {
          setSubtitle(result, "srt")
        }
      })
      fsGet(subtitlePath + ".ass").then((result) => {
        if (result.code == 200) {
          setSubtitle(result, "ass")
        }
      })
      fsGet(subtitlePath + ".vtt").then((result) => {
        if (result.code == 200) {
          setSubtitle(result, "vtt")
        }
      })
    }
    player.on("video:ended", () => {
      if (!autoNext()) return
      next_video()
    })
  })
  onCleanup(() => {
    if (player && player.video) player.video.src = ""
    player?.destroy()
    flvPlayer?.destroy()
    hlsPlayer?.destroy()
  })
  const [autoNext, setAutoNext] = createSignal()
  return (
    <VideoBox onAutoNextChange={setAutoNext}>
      <Box w="$full" h="60vh" id="video-player" />
    </VideoBox>
  )
}

export default Preview
