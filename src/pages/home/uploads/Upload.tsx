import {
  VStack,
  Input,
  Heading,
  HStack,
  IconButton,
  Checkbox,
  Text,
  Badge,
  Progress,
  ProgressIndicator,
  Button,
  Box,
} from "@hope-ui/solid"
import { createSignal, For, Show } from "solid-js"
import { usePath, useRouter, useT } from "~/hooks"
import { getMainColor, objStore } from "~/store"
import {
  RiDocumentFolderUploadFill,
  RiDocumentFileUploadFill,
} from "solid-icons/ri"
import { fsDirs, fsGet, getFileSize, notify, pathJoin } from "~/utils"
import { asyncPool } from "~/utils/async_pool"
import { createStore } from "solid-js/store"
import { UploadFileProps, StatusBadge } from "./types"
import { File2Upload, dataURLtoBlob, traverseFileTree } from "./util"
import { SelectWrapper } from "~/components"
import { getUploads } from "./uploads"

const UploadFile = (props: UploadFileProps) => {
  const t = useT()

  return (
    <VStack
      w="$full"
      spacing="$1"
      rounded="$lg"
      border="1px solid $neutral7"
      alignItems="start"
      p="$2"
      _hover={{
        border: `1px solid ${getMainColor()}`,
      }}
    >
      <Text
        css={{
          wordBreak: "break-all",
        }}
      >
        {props.path}
      </Text>
      <HStack spacing="$2">
        <Badge colorScheme={StatusBadge[props.status]}>
          {t(`home.upload.${props.status}`)}
        </Badge>
        <Text>{getFileSize(props.speed)}/s</Text>
      </HStack>
      <Progress
        w="$full"
        trackColor="$info3"
        rounded="$full"
        value={props.progress}
        size="sm"
      >
        <ProgressIndicator color={getMainColor()} rounded="$md" />
        {/* <ProgressLabel /> */}
      </Progress>
      <Text color="$danger10">{props.msg}</Text>
    </VStack>
  )
}

const Upload = () => {
  const t = useT()
  const { pathname } = useRouter()
  const { refresh } = usePath()
  const [drag, setDrag] = createSignal(false)
  const [uploading, setUploading] = createSignal(false)
  const [asTask, setAsTask] = createSignal(false)
  const [uploadFiles, setUploadFiles] = createStore<{
    uploads: UploadFileProps[]
  }>({
    uploads: [],
  })
  const allDone = () => {
    return uploadFiles.uploads.every(({ status }) =>
      ["success", "error"].includes(status),
    )
  }
  let fileInput: HTMLInputElement
  let folderInput: HTMLInputElement
  const handleAddFiles = async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)
    for (const file of files) {
      const upload = File2Upload(file)
      setUploadFiles("uploads", (uploads) => [...uploads, upload])
    }
    for await (const ms of asyncPool(3, files, handleFile)) {
      console.log(ms)
    }
    refresh(undefined, true)
  }
  const setUpload = (path: string, key: keyof UploadFileProps, value: any) => {
    setUploadFiles("uploads", (upload) => upload.path === path, key, value)
  }
  const uploaders = getUploads()
  const [curUploader, setCurUploader] = createSignal(uploaders[0])
  const handleFile = async (file: File) => {
    const path = file.webkitRelativePath ? file.webkitRelativePath : file.name
    setUpload(path, "status", "uploading")
    const uploadPath = pathJoin(pathname(), path)
    try {
      const err = await curUploader().upload(
        uploadPath,
        file,
        (key, value) => {
          setUpload(path, key, value)
        },
        asTask(),
      )
      if (!err) {
        setUpload(path, "status", "success")
        setUpload(path, "progress", 100)
        let isVideo = false
        for (const ext of [
          ".mp4",
          ".wmv",
          ".flv",
          ".mkv",
          ".f4v",
          ".avi",
          ".webm",
          ".rmvb",
        ]) {
          if (path.endsWith(ext)) {
            isVideo = true
          }
        }
        if (isVideo) {
          if (!asTask())
            fsDirs(pathname() + "/.thumbnails").then((res) => {
              if (res.code == 200) {
                fsGet(uploadPath).then((res) => {
                  dataURLtoBlob(
                    res.data.raw_url,
                    pathname() + "/.thumbnails/" + path + ".webp",
                    0.03,
                  )
                })
              }
            })
          else {
            let arrayHasElement = function (array: any, element: any): boolean {
              // 判断二维数组array中是否存在一维数组element
              for (let el of array) {
                if (el.length === element.length) {
                  for (let index in el) {
                    if (el[index] !== element[index]) {
                      break
                    }
                    // @ts-ignore
                    if (index == el.length - 1) {
                      // 到最后一个元素都没有出现不相等，就说明这两个数组相等。
                      return true
                    }
                  }
                }
              }
              return false
            }
            if (localStorage.getItem("thumbUpload") == null) {
              localStorage.setItem(
                "thumbUpload",
                JSON.stringify([[pathname(), path]]),
              )
            }
            let last = JSON.parse(localStorage.getItem("thumbUpload") as string)
            if (!arrayHasElement(last, [pathname(), path])) {
              last.push([pathname(), path])
              // console.log(last.includes(videoPath+videoName))
              localStorage.setItem("thumbUpload", JSON.stringify(last))
            }
          }
        }
      } else {
        setUpload(path, "status", "error")
        setUpload(path, "msg", err.message)
      }
    } catch (e: any) {
      console.error(e)
      setUpload(path, "status", "error")
      setUpload(path, "msg", e.message)
    }
  }
  return (
    <VStack w="$full" pb="$2" spacing="$2">
      <Show
        when={!uploading()}
        fallback={
          <>
            <HStack spacing="$2">
              <Button
                colorScheme="accent"
                onClick={() => {
                  setUploadFiles("uploads", (_uploads) =>
                    _uploads.filter(
                      ({ status }) => !["success", "error"].includes(status),
                    ),
                  )
                  console.log(uploadFiles.uploads)
                }}
              >
                {t("home.upload.clear_done")}
              </Button>
              <Show when={allDone()}>
                <Button
                  onClick={() => {
                    setUploading(false)
                  }}
                >
                  {t("home.upload.back")}
                </Button>
              </Show>
            </HStack>
            <For each={uploadFiles.uploads}>
              {(upload) => <UploadFile {...upload} />}
            </For>
          </>
        }
      >
        <Input
          type="file"
          multiple
          ref={fileInput!}
          display="none"
          onChange={(e) => {
            // @ts-ignore
            handleAddFiles(Array.from(e.target.files ?? []))
          }}
        />
        <Input
          type="file"
          multiple
          // @ts-ignore
          webkitdirectory
          ref={folderInput!}
          display="none"
          onChange={(e) => {
            // @ts-ignore
            handleAddFiles(Array.from(e.target.files ?? []))
          }}
        />
        <VStack
          w="$full"
          justifyContent="center"
          border={`2px dashed ${drag() ? getMainColor() : "$neutral8"}`}
          rounded="$lg"
          onDragOver={(e: DragEvent) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => {
            setDrag(false)
          }}
          onDrop={async (e: DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setDrag(false)
            const res: File[] = []
            const items = Array.from(e.dataTransfer?.items ?? [])
            const files = Array.from(e.dataTransfer?.files ?? [])
            let itemLength = items.length
            const folderEntries = []
            for (let i = 0; i < itemLength; i++) {
              const item = items[i]
              const entry = item.webkitGetAsEntry()
              if (entry?.isFile) {
                res.push(files[i])
              } else if (entry?.isDirectory) {
                folderEntries.push(entry)
              }
            }
            for (const entry of folderEntries) {
              const innerFiles = await traverseFileTree(entry)
              res.push(...innerFiles)
            }
            if (res.length === 0) {
              notify.warning(t("home.upload.no_files_drag"))
            }
            handleAddFiles(res)
          }}
          spacing="$4"
          // py="$4"
          h="$56"
        >
          <Show
            when={!drag()}
            fallback={<Heading>{t("home.upload.release")}</Heading>}
          >
            <Heading>{t("home.upload.upload-tips")}</Heading>
            <Box w="30%">
              <SelectWrapper
                value={curUploader().name}
                onChange={(name) => {
                  setCurUploader(
                    uploaders.find((uploader) => uploader.name === name)!,
                  )
                }}
                options={uploaders.map((uploader) => {
                  return {
                    label: uploader.name,
                    value: uploader.name,
                  }
                })}
              />
            </Box>
            <HStack spacing="$4">
              <IconButton
                compact
                size="xl"
                aria-label={t("home.upload.upload_folder")}
                colorScheme="accent"
                icon={<RiDocumentFolderUploadFill />}
                onClick={() => {
                  folderInput.click()
                }}
              />
              <IconButton
                compact
                size="xl"
                aria-label={t("home.upload.upload_files")}
                icon={<RiDocumentFileUploadFill />}
                onClick={() => {
                  fileInput.click()
                }}
              />
            </HStack>
            <Checkbox
              checked={asTask()}
              onChange={() => {
                setAsTask(!asTask())
              }}
            >
              {t("home.upload.add_as_task")}
            </Checkbox>
          </Show>
        </VStack>
      </Show>
    </VStack>
  )
}

export default Upload
