const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function timeSolution (label, fn) {
  const start = process.hrtime.bigint()
  const result = await fn()
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6
  report(`${label} completed in ${elapsedMs.toFixed(3)}ms`)
  return result
}

async function run () {
  const test = (await read(fromHere('test.txt'), 'utf8')).trim()
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await timeSolution('Part 1 (test)', () => solveForFirstStar(test))
  await timeSolution('Part 1', () => solveForFirstStar(input))
  await timeSolution('Part 2', () => solveForSecondStar(input))
}

function parseDeviceMap (input) {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const devices = lines.map(line => {
    const [deviceName, ...rest] = line.split(':')
    const outputIds = rest.join('').trim().split(/\s+/)
    return {
      deviceName,
      outputIds
    }
  })

  const deviceIndex = {}
  devices.forEach(device => {
    deviceIndex[device.deviceName] = device
  })

  function ensureDevice (name) {
    if (!deviceIndex[name]) {
      deviceIndex[name] = {
        deviceName: name,
        outputIds: [],
        outputs: []
      }
      devices.push(deviceIndex[name])
    }
    return deviceIndex[name]
  }

  devices.forEach(device => {
    device.outputs = device.outputIds.filter(Boolean).map(id => ensureDevice(id))
  })

  return { devices, deviceIndex, findDevice: name => deviceIndex[name] }
}

function createPathFinder () {
  const memo = new Map() // Memoization cache
  const possiblePaths = [] // Store all found paths

  function findPaths (startDevice, endDevice, visited = new Set(), path = []) {
    const currentDevice = startDevice
    if (visited.has(currentDevice.deviceName)) {
      return
    }

    // Create a cache key based on current device and visited set
    const visitedKey = Array.from(visited).sort().join(',')
    const cacheKey = `${currentDevice.deviceName}:${visitedKey}`

    if (memo.has(cacheKey)) {
      // Use memoized results and append to current path
      const cachedPathSuffixes = memo.get(cacheKey)
      for (const suffix of cachedPathSuffixes) {
        possiblePaths.push([...path, ...suffix])
      }
      return
    }

    visited.add(currentDevice.deviceName)
    path.push(currentDevice.deviceName)

    const pathsFromHere = [] // Store paths found from this device for memoization

    if (currentDevice === endDevice) {
      const completePath = [...path]
      possiblePaths.push(completePath)
      pathsFromHere.push([currentDevice.deviceName]) // Just this device for the suffix
    } else {
      const beforeCount = possiblePaths.length
      for (const outputDevice of currentDevice.outputs) {
        findPaths(outputDevice, endDevice, visited, path)
      }

      // Extract the suffixes that were added from this point
      const newPaths = possiblePaths.slice(beforeCount)
      for (const newPath of newPaths) {
        const suffixStartIndex = path.length - 1 // Start from current device
        pathsFromHere.push(newPath.slice(suffixStartIndex))
      }
    }

    // Memoize the path suffixes from this device
    memo.set(cacheKey, pathsFromHere)

    path.pop()
    visited.delete(currentDevice.deviceName)
  }

  return function (startDevice, endDevice) {
    possiblePaths.length = 0 // Clear any previous results
    findPaths(startDevice, endDevice)
    return possiblePaths
  }
}

async function solveForFirstStar (input) {
  const { devices, findDevice } = parseDeviceMap(input)

  report(`Parsed ${devices.length} devices from input`)
  const indexWidth = String(devices.length - 1).length
  devices.forEach((device, index) => {
    const outputs = device.outputIds.join(' ')
    const indexText = String(index)
    const padding = ' '.repeat(Math.max(1, indexWidth - indexText.length + 1))
    console.log(`  Device: [${indexText}]${padding}${device.deviceName} : ${outputs}`)
  })

  const start = findDevice('you')
  const end = findDevice('out')

  // Find every path from you to out
  const findPaths = createPathFinder()
  const possiblePaths = findPaths(start, end)

  report(`Found ${possiblePaths.length} possible paths from 'you' to 'out'`)

  const solution = possiblePaths.length
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
