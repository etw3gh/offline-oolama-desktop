import { saveAs } from 'file-saver'
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Alert, AlertActions, AlertDescription, AlertTitle } from './catalyst/alert'
import { Checkbox } from './catalyst/checkbox'
import { Field, FieldGroup } from './catalyst/fieldset'
import { Textarea } from './catalyst/textarea'
import { Button } from './catalyst/button'
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
} from './catalyst/table'
import { ArrowDownTrayIcon, ArrowPathIcon, PlusCircleIcon } from '@heroicons/react/16/solid'
import Spinner from './components/spinner'
import Markdown from 'react-markdown'

import './App.css'

const tableRowClassName = 'border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left'

function formatBytes(bytes) {
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDateSimple(isoString) {
  const date = new Date(isoString);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `${dateStr} ${timeStr}`
}

function msToSeconds(ms) {
  return (ms / 1000).toFixed(2)  
}

// for web debugging as invoke will fail in the browser
const dummy = [{ name: "model1", modified_at: "2024-01-01", size: 1024 }]

function App() {
  const [alertText, setAlertText] = useState(null)
  const [aiResp, setAiResp] = useState("")
  const [availModels, setAvailModels] = useState([])
  const [checkedModel, setCheckedModel] = useState([])
  const [info, setInfo] = useState({})
  const [models, setModels] = useState(dummy)
  const [modelName, setModelName] = useState("")
  const [query, setQuery] = useState("")
  const [timer, setTimer] = useState(0)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    const getModels = async () => {
      // [{name, modified_at, size}]
      setModels(await invoke("get_models"))
      setAvailModels(await invoke("fetch_avail_models"))
    }
    getModels()
  }, [])

  useEffect(() => {
    if (models.length > 1) {
      setCheckedModel(Array(models.length).fill(false))
      const infoState = {}
      models.forEach(async (model) => {
        try {
          const modelInfo = await invoke("fetch_model_info", { model: model.name })
          infoState[model.name] = modelInfo
        } catch (fetchInfoErr) {
          console.error(fetchInfoErr)
        }
      })
      setInfo(infoState)
    }
  }, [models])

  useEffect(() => {
    const model = models.find((_, i) => checkedModel[i])?.name
    if (model) {
      setModelName(model)
    }
  }, [checkedModel])

  useEffect(() => {
    getCurrentWindow().listen("pull-progress", (event) => {
      console.log(event)
    })
  }, [])

  async function makeQuery() {
    setTimer(0)
    setWorking(true)
    const time = Date.now()
    try {
      const resp = await invoke("lama", { model: modelName, query })
      setAiResp(resp)
    } catch (e) {
      const err = e.error.replace("An error occurred with ollama-rs: ", "")
      const aiErr = JSON.parse(err)
      setAiResp(`${e.code}: ${aiErr.error}`)
    }
    setTimer(msToSeconds(Date.now() - time))
    setWorking(false)
  }

  const handleModelChange = (i) => {
    setCheckedModel(checkedModel.map((_, j) => j === i))
  }

  const downloadInfo = async (modelName) => {
    const modelInfo = JSON.stringify(info[modelName], null, 2)
    const json = new Blob([modelInfo], { type: 'application/json' })
    const fileName = `${modelName}.json`
    try {
      saveAs(json, fileName)
      setAlertText(fileName)
    } catch(saveAsErr) {
      setAlertText(`Error downloading file: ${saveAsErr}`)
    }
  }

  const pullModel = async (modelName) => {
    const resp = await invoke("pull_model", { model: modelName })

    if (resp.status === "completed") {
      setModels(await invoke("get_models"))
    }
  }

  const refreshModels = async () => {
    setModels(await invoke("get_models"))
    setAvailModels(await invoke("fetch_avail_models"))
  }

  return (
    <main className="m-4">
      <h1 className="text-3xl font-bold underline">
        Welcome to Tauri + React
      </h1>
      <br />

      <div className="text-2xl font-bold flex items-center gap-2">
        <ArrowPathIcon
          className="size-6 text-blue-500"
          onClick={() => refreshModels()}
          title='Refresh Models'
        />
        <PlusCircleIcon
            className="size-6 text-blue-500"
            onClick={() => refreshModels()}
            title='Add Models'
        />
        Models
      </div>
      {
        alertText ? (
          <Alert open={true} onClose={() => setAlertText(null)}>
            <AlertTitle>
              Licence and Info Downloaded
            </AlertTitle>
            <AlertDescription>
              <span>
                <span className="italic font-bold mr-1">
                  {alertText}
                </span>
                has been downloaded. (Check your Downloads folder)
              </span>
            </AlertDescription>
            <AlertActions>
              <Button onClick={() => setAlertText(null)}>
                Close
              </Button>
            </AlertActions>
          </Alert>
        ) : null
      }
      <div className="m-4">
        {
          !models ? (
            <Spinner text="Loading models..." />
          ) : (
            <Table className="border-collapse table-auto w-full text-sm">
              <TableHead className="">
                <TableRow className={tableRowClassName}>
                  <TableHeader>
                    Select
                  </TableHeader>
                  <TableHeader>
                    Licence etc
                  </TableHeader>
                  <TableHeader>
                    Name
                  </TableHeader>
                  <TableHeader>
                    Update
                  </TableHeader>
                  <TableHeader>
                    Last Modified Date
                  </TableHeader>
                  <TableHeader>
                    Size
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {
                  models.map((model, i) => (
                    <TableRow key={i} className={tableRowClassName}>
                      <TableCell>
                        <Checkbox
                          checked={checkedModel[i]}
                          onChange={() => handleModelChange(i)}
                        />
                      </TableCell>
                      <TableCell>
                          <Button onClick={() => downloadInfo(model.name)}>
                            <ArrowDownTrayIcon className="size-6 text-blue-500" />
                            Info
                          </Button>
                      </TableCell>
                      <TableCell className={checkedModel[i] ? "text-green-600 font-bold" : "text-zinc-500"}>
                        {
                          info[model.name] ? (
                            <div id="tooltip-default" role="tooltip" className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip dark:bg-gray-700">
                                Tooltip content
                                <div className="tooltip-arrow" data-popper-arrow></div>
                            </div>
                          ) : null
                        }
                        {model.name}
                      </TableCell>
                      <TableCell>
                        <Button onClick={() => pullModel(model.name)}>
                          <ArrowPathIcon className="size-6 text-blue-500" />
                          Update
                        </Button>
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {
                          formatDateSimple(model.modified_at)
                        }
                      </TableCell>
                      <TableCell>
                        {
                          formatBytes(model.size)
                        }
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          )
        }
      </div>
      <FieldGroup>
        <Field>
          <h3>
            Ask{' '}
            {
              modelName ? (
              <span className="font-bold text-green-600">
                {
                  modelName
                }
              </span>
             ) :
             (
              <span>
                No model selected
              </span>
            )
          }
          </h3>
          <Textarea
            disabled={working || !modelName}
            onChange={(e) => setQuery(e.currentTarget.value)}
            value={query}
            rows={3}
          />
        </Field>
        <Button
          disabled={working || !query}
          onClick={makeQuery}
        >
          Submit
        </Button>
      </FieldGroup>
      <h6 className="mt-5">
        {
          timer > 0 ? `Time: ${timer}s` : null
        }
      </h6>
      <div className="mt-5 rounded-md border border-zinc-200 p-4">
        {
          working ? (
            <Spinner text="Working..." />
          ) : (
            <Markdown>{aiResp || 'No Results Yet'}</Markdown>
          )
        }
      </div>
    </main>
  );
}

export default App;
