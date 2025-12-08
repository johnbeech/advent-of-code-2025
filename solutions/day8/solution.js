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

function parseJunctionBoxes (input) {
  const lines = input.split('\n').map(line => line.trim()).filter(n => n)
  const junctionBoxes = lines.map((line, index) => {
    const [x, y, z] = line.split(',').map(Number)
    const connections = []
    const circuit = null
    return { x, y, z, index, connections, circuit }
  })
  return junctionBoxes
}

async function run () {
  const test = (await read(fromHere('test.txt'), 'utf8')).trim()
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await timeSolution('Part 1 (test)', () => solveForFirstStar(test, 10))
  await timeSolution('Part 1 (input)', () => solveForFirstStar(input))

  await timeSolution('Part 2 (test)', () => solveForSecondStar(test, 10))
  await timeSolution('Part 2 (input)', () => solveForSecondStar(input))
}

function mergeCircuits (boxA, boxB) {
  const circuitA = boxA.circuit
  const circuitB = boxB.circuit

  if (circuitA === null && circuitB === null) {
    const newCircuit = new Set([boxA, boxB])
    boxA.circuit = newCircuit
    boxB.circuit = newCircuit
    return
  }

  if (circuitA !== null && circuitB === null) {
    circuitA.add(boxB)
    boxB.circuit = circuitA
    return
  }

  if (circuitA === null && circuitB !== null) {
    circuitB.add(boxA)
    boxA.circuit = circuitB
    return
  }

  if (circuitA === circuitB) {
    return
  }

  const [targetCircuit, sourceCircuit] = circuitA.size >= circuitB.size ? [circuitA, circuitB] : [circuitB, circuitA]
  sourceCircuit.forEach(box => {
    targetCircuit.add(box)
    box.circuit = targetCircuit
  })
}

function squaredDistance (boxA, boxB) {
  const dx = boxA.x - boxB.x
  const dy = boxA.y - boxB.y
  const dz = boxA.z - boxB.z
  return dx * dx + dy * dy + dz * dz
}

function findAllPairs (junctionBoxes) {
  // Pre-calculate and sort all possible pairs by distance
  const allPairs = []
  junctionBoxes.forEach((boxA, i) => {
    junctionBoxes.forEach((boxB, j) => {
      if (j <= i) return
      const distance = squaredDistance(boxA, boxB)
      allPairs.push({ boxA, boxB, distance, indexA: i, indexB: j })
    })
  })
  allPairs.sort((a, b) => a.distance - b.distance)
  return allPairs
}

function formCircuitConnections (pairs, junctionBoxes, maxConnections) {
  const connections = []
  let attemptCount = 0

  for (const pair of pairs) {
    if (attemptCount >= maxConnections) break

    const { boxA, boxB } = pair
    attemptCount++

    // Check if already directly connected
    if (boxA.connections.includes(boxB.index)) {
      // console.log(`Attempt ${attemptCount}: Already connected Box ${boxA.index} <-> Box ${boxB.index} (distance: ${distance.toFixed(2)})`)
      continue
    }

    // Check if in same circuit
    if (boxA.circuit !== null && boxA.circuit === boxB.circuit) {
      // console.log(`Attempt ${attemptCount}: Skipping Box ${boxA.index} <-> Box ${boxB.index} - same circuit (distance: ${distance.toFixed(2)})`)
      boxA.connections.push(boxB.index)
      boxB.connections.push(boxA.index)
      continue
    }

    // Make the connection
    boxA.connections.push(boxB.index)
    boxB.connections.push(boxA.index)
    connections.push([boxA.index, boxB.index])
    mergeCircuits(boxA, boxB)
    // console.log(`Attempt ${attemptCount}: Connected Box ${boxA.index} <-> Box ${boxB.index} (distance: ${distance.toFixed(2)}) [Connection #${connections.length}]`)
  }
  return connections
}

async function solveForFirstStar (input, connectionCount = 1000) {
  const junctionBoxes = parseJunctionBoxes(input)

  const allPairs = findAllPairs(junctionBoxes)
  formCircuitConnections(allPairs, junctionBoxes, connectionCount)

  // Count connected circuits
  const connectedCircuits = new Set(
    junctionBoxes
      .map(box => box.circuit)
      .filter(circuit => circuit !== null)
  )

  // Count unconnected boxes (each is its own circuit)
  const unconnectedCount = junctionBoxes.filter(box => box.circuit === null).length

  const totalCircuits = connectedCircuits.size + unconnectedCount
  report('Distinct Circuits:', totalCircuits)

  // Build circuit size map
  const circuitSizes = []

  // Add connected circuit sizes
  connectedCircuits.forEach(circuitSet => {
    const members = Array.from(circuitSet).map(box => box.index).sort((a, b) => a - b)
    circuitSizes.push({ circuitMembers: members, size: circuitSet.size })
  })

  // Add unconnected boxes (each as size 1)
  junctionBoxes.forEach(box => {
    if (box.circuit === null) {
      circuitSizes.push({ circuitMembers: [box.index], size: 1 })
    }
  })

  // Sort and get three largest
  const threeLargestCircuits = circuitSizes
    .sort((a, b) => b.size - a.size)
    .slice(0, 3)

  report('Three Largest Circuits:', threeLargestCircuits)

  const solution = threeLargestCircuits.reduce((product, circuit) => product * circuit.size, 1)

  report('Solution 1:', solution, 'for', connectionCount, 'connections')
}

async function solveForSecondStar (input, connectionCount = 1000) {
  const junctionBoxes = parseJunctionBoxes(input)

  const allPairs = findAllPairs(junctionBoxes)
  formCircuitConnections(allPairs, junctionBoxes, connectionCount)

  let lastConnectedPair = null
  let currentPair = null

  // Continue connecting until all boxes are in the same circuit
  for (const pair of allPairs) {
    const { boxA, boxB } = pair

    // Skip if already directly connected
    if (boxA.connections.includes(boxB.index)) {
      continue
    }

    // Skip if already in same circuit
    if (boxA.circuit !== null && boxA.circuit === boxB.circuit) {
      continue
    }

    // Connect them
    boxA.connections.push(boxB.index)
    boxB.connections.push(boxA.index)
    mergeCircuits(boxA, boxB)
    currentPair = { boxA, boxB }

    // Check if all boxes are now in the same circuit
    const circuits = new Set(
      junctionBoxes
        .map(box => box.circuit)
        .filter(circuit => circuit !== null)
    )

    const unconnectedCount = junctionBoxes.filter(box => box.circuit === null).length

    // All boxes must be connected AND in the same circuit
    if (circuits.size === 1 && unconnectedCount === 0) {
      lastConnectedPair = currentPair
      break
    }
  }

  const solution = lastConnectedPair.boxA.x * lastConnectedPair.boxB.x
  report('Last Connected Pair:', `Box ${lastConnectedPair.boxA.index} (${lastConnectedPair.boxA.x},${lastConnectedPair.boxA.y},${lastConnectedPair.boxA.z}) <-> Box ${lastConnectedPair.boxB.index} (${lastConnectedPair.boxB.x},${lastConnectedPair.boxB.y},${lastConnectedPair.boxB.z})`)
  report('Solution 2:', solution)
}

run()
