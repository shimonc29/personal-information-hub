import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createProjectsModel } from './projects-model.mjs'

const initialData = () => ({ projects: createProjectsModel(), tasks: [] })

async function readDatabase(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return initialData()
  }
}

async function writeDatabase(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, filePath)
}

export function createDataStore(filePath) {
  let writeQueue = Promise.resolve()

  return {
    async listProjects() {
      return (await readDatabase(filePath)).projects
    },
    async listTasks() {
      return (await readDatabase(filePath)).tasks
    },
    async createTask(input) {
      let createdTask
      writeQueue = writeQueue.then(async () => {
        const data = await readDatabase(filePath)
        createdTask = {
          id: randomUUID(),
          projectId: input.projectId,
          title: input.title.trim(),
          dueLabel: input.dueLabel ?? '',
          priority: input.priority ?? 'בינונית',
          createdAt: new Date().toISOString(),
        }
        data.tasks.push(createdTask)
        await writeDatabase(filePath, data)
      })
      await writeQueue
      return createdTask
    },
    async updateTask(taskId, changes) {
      let updatedTask
      writeQueue = writeQueue.then(async () => {
        const data = await readDatabase(filePath)
        const index = data.tasks.findIndex((task) => task.id === taskId)
        if (index < 0) throw new Error('Task does not exist')
        updatedTask = { ...data.tasks[index], ...changes }
        data.tasks[index] = updatedTask
        await writeDatabase(filePath, data)
      })
      await writeQueue
      return updatedTask
    },
    async deleteTask(taskId) {
      writeQueue = writeQueue.then(async () => {
        const data = await readDatabase(filePath)
        data.tasks = data.tasks.filter((task) => task.id !== taskId)
        await writeDatabase(filePath, data)
      })
      await writeQueue
      return null
    },
  }
}
