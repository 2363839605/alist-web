import { UploadFileProps } from "./types"
import { r } from "~/utils"
import { password } from "~/store"

export const traverseFileTree = async (entry: FileSystemEntry) => {
  let res: File[] = []
  const internalProcess = async (entry: FileSystemEntry, path: string) => {
    const promise = new Promise<{}>((resolve, reject) => {
      const errorCallback: ErrorCallback = (e) => {
        console.error(e)
        reject(e)
      }
      if (entry.isFile) {
        ;(entry as FileSystemFileEntry).file((file) => {
          const newFile = new File([file], path + file.name, {
            type: file.type,
          })
          res.push(newFile)
          console.log(newFile)
          resolve({})
        }, errorCallback)
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader()
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            for (let i = 0; i < entries.length; i++) {
              await internalProcess(entries[i], path + entry.name + "/")
            }
            resolve({})
            /**
            why? https://stackoverflow.com/questions/3590058/does-html5-allow-drag-drop-upload-of-folders-or-a-folder-tree/53058574#53058574
            Unfortunately none of the existing answers are completely correct because
            readEntries will not necessarily return ALL the (file or directory) entries for a given directory.
            This is part of the API specification (see Documentation section below).

            To actually get all the files, we'll need to call readEntries repeatedly (for each directory we encounter)
            until it returns an empty array. If we don't, we will miss some files/sub-directories in a directory
            e.g. in Chrome, readEntries will only return at most 100 entries at a time.
            */
            if (entries.length > 0) {
              readEntries()
            }
          }, errorCallback)
        }
        readEntries()
      }
    })
    await promise
  }
  await internalProcess(entry, "")
  return res
}

export const File2Upload = (file: File): UploadFileProps => {
  return {
    name: file.name,
    path: file.webkitRelativePath ? file.webkitRelativePath : file.name,
    size: file.size,
    progress: 0,
    speed: 0,
    status: "pending",
  }
}

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
        if (video.currentTime >= video.duration * num) {

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

      video.onabort = function () {
        reject(new Error("Video loading aborted"))
        video.removeEventListener("timeupdate", handleTimeUpdate)
      }
    }

  })
}

export function dataURLtoBlob(url: any, path: string, num: number) {
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
    await r.put("/fs/put", file, {
      headers: {
        "File-Path": encodeURIComponent(path),
        "As-Task": false,
        "Content-Type": file.type || "application/octet-stream",
        Password: password(),
      },
    })
  })
}
