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
  const testP1 = (await read(fromHere('test-p1.txt'), 'utf8')).trim()
  const testP2 = (await read(fromHere('test-p2.txt'), 'utf8')).trim()
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await timeSolution('Part 1 (test)', () => solveForFirstStar(testP1))
  await timeSolution('Part 1', () => solveForFirstStar(input))
  await timeSolution('Part 2 (test)', () => solveForSecondStar(testP2))
  await timeSolution('Part 2', () => solveForSecondStar(input))
}

function parseDeviceMap (input) {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const devices = lines.map(line => {
    const [deviceName, ...rest] = line.split(':')
    const outputIds = rest.join('').trim().split(/\s+/)
    return {
      deviceName,
      outputIds,
      outputs: [],
      inputs: []
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
        outputs: [],
        inputs: []
      }
      devices.push(deviceIndex[name])
    }
    return deviceIndex[name]
  }

  devices.forEach(device => {
    device.outputs = device.outputIds.filter(Boolean).map(id => {
      const target = ensureDevice(id)
      target.inputs.push(device)
      return target
    })
  })

  const findDevice = name => ensureDevice(name)

  return { devices, deviceIndex, findDevice }
}

function createPathCounter ({ shouldTraverseDevice = null, endDevice, requiredDevices = [] }) {
  const memo = new Map()
  let expansions = 0

  const requiredDeviceBits = new Map()
  requiredDevices.forEach((device, index) => {
    requiredDeviceBits.set(device.deviceName, 1 << index)
  })
  const requiredMask = requiredDevices.length ? (1 << requiredDevices.length) - 1 : 0

  function countPaths (device, visitedMask = 0, stack = new Set()) {
    const bit = requiredDeviceBits.get(device.deviceName) || 0
    const nextMask = visitedMask | bit
    const memoKey = `${device.deviceName}:${nextMask}`
    if (memo.has(memoKey)) {
      return memo.get(memoKey)
    }

    if (stack.has(device.deviceName)) {
      // Cycle detected - no simple paths continue through this branch
      return { count: 0, longestPath: null }
    }

    if (shouldTraverseDevice && !shouldTraverseDevice(device)) {
      return { count: 0, longestPath: null }
    }

    expansions++

    if (device === endDevice) {
      const isValid = requiredMask === 0 ? true : (nextMask === requiredMask)
      const result = {
        count: isValid ? 1 : 0,
        longestPath: isValid ? [device.deviceName] : null
      }
      memo.set(memoKey, result)
      return result
    }

    stack.add(device.deviceName)
    let total = 0
    let bestPath = null
    for (const outputDevice of device.outputs) {
      const childResult = countPaths(outputDevice, nextMask, stack)
      total += childResult.count
      if (childResult.longestPath) {
        const candidatePath = [device.deviceName, ...childResult.longestPath]
        if (!bestPath || candidatePath.length > bestPath.length) {
          bestPath = candidatePath
        }
      }
    }
    stack.delete(device.deviceName)

    const result = { count: total, longestPath: bestPath }
    memo.set(memoKey, result)
    return result
  }

  return function (startDevice, options = {}) {
    const startTime = Date.now()
    expansions = 0
    const totalPaths = countPaths(startDevice, 0, new Set())
    const durationMs = Date.now() - startTime
    report(`PathCounter expanded ${expansions.toLocaleString()} states in ${durationMs}ms`)
    return totalPaths
  }
}

function computeDevicesThatReach (targetDevice) {
  const reachable = new Set()
  const stack = [targetDevice]

  while (stack.length > 0) {
    const device = stack.pop()
    if (!device || reachable.has(device.deviceName)) {
      continue
    }
    reachable.add(device.deviceName)
    for (const inputDevice of device.inputs) {
      stack.push(inputDevice)
    }
  }

  return reachable
}

function computeDevicesReachableFrom (startDevice) {
  const reachable = new Set()
  const stack = [startDevice]

  while (stack.length > 0) {
    const device = stack.pop()
    if (!device || reachable.has(device.deviceName)) {
      continue
    }
    reachable.add(device.deviceName)
    for (const outputDevice of device.outputs) {
      stack.push(outputDevice)
    }
  }

  return reachable
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
  const countPaths = createPathCounter({ endDevice: end })
  const { count: pathCount, longestPath } = countPaths(start)

  report(`Found ${pathCount} possible paths from 'you' to 'out'`)
  if (longestPath) {
    report(`Longest path (${longestPath.length} nodes): ${longestPath.join(' -> ')}`)
  }

  const solution = pathCount
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const { findDevice } = parseDeviceMap(input)

  const start = findDevice('svr')
  const end = findDevice('out')
  const devicesOnRoute = [findDevice('dac'), findDevice('fft')]

  const reachableFromStart = computeDevicesReachableFrom(start)
  const reachableToOut = computeDevicesThatReach(end)
  const traverseFilter = device => reachableFromStart.has(device.deviceName) && reachableToOut.has(device.deviceName)

  const countPaths = createPathCounter({
    endDevice: end,
    shouldTraverseDevice: traverseFilter,
    requiredDevices: devicesOnRoute
  })
  const { count: validPathCount, longestPath } = countPaths(start)

  report(`Found ${validPathCount} possible paths from 'svr' to 'out' via 'dac' and 'fft'`)
  if (longestPath) {
    report(`Longest valid path (${longestPath.length} nodes): ${longestPath.join(' -> ')}`)
  }

  const solution = validPathCount
  report('Solution 2:', solution)
}

run()
