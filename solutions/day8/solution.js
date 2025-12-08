const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

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

  await solveForFirstStar(test, 10)
  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

function mergeCircuits (junctionBoxes, boxA, boxB) {
  if (boxA.circuit === null && boxB.circuit === null) {
    const newCircuitId = `circuit-${boxA.index}-${boxB.index}`
    boxA.circuit = newCircuitId
    boxB.circuit = newCircuitId
  } else if (boxA.circuit !== null && boxB.circuit === null) {
    boxB.circuit = boxA.circuit
  } else if (boxA.circuit === null && boxB.circuit !== null) {
    boxA.circuit = boxB.circuit
  } else {
    const oldCircuitId = boxB.circuit
    const newCircuitId = boxA.circuit
    junctionBoxes.forEach(box => {
      if (box.circuit === oldCircuitId) {
        box.circuit = newCircuitId
      }
    })
  }
}

function findAllPairs (junctionBoxes) {
  // Pre-calculate and sort all possible pairs by distance
  const allPairs = []
  junctionBoxes.forEach((boxA, i) => {
    junctionBoxes.forEach((boxB, j) => {
      if (j <= i) return
      const distance = Math.sqrt(
        Math.pow(boxA.x - boxB.x, 2) +
        Math.pow(boxA.y - boxB.y, 2) +
        Math.pow(boxA.z - boxB.z, 2)
      )
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

    const { boxA, boxB, distance } = pair
    attemptCount++

    // Check if already directly connected
    if (boxA.connections.includes(boxB.index)) {
      console.log(`Attempt ${attemptCount}: Already connected Box ${boxA.index} <-> Box ${boxB.index} (distance: ${distance.toFixed(2)})`)
      continue
    }

    // Check if in same circuit
    if (boxA.circuit !== null && boxA.circuit === boxB.circuit) {
      console.log(`Attempt ${attemptCount}: Skipping Box ${boxA.index} <-> Box ${boxB.index} - same circuit (distance: ${distance.toFixed(2)})`)
      boxA.connections.push(boxB.index)
      boxB.connections.push(boxA.index)
      continue
    }

    // Make the connection
    boxA.connections.push(boxB.index)
    boxB.connections.push(boxA.index)
    connections.push([boxA.index, boxB.index])
    mergeCircuits(junctionBoxes, boxA, boxB)
    console.log(`Attempt ${attemptCount}: Connected Box ${boxA.index} <-> Box ${boxB.index} (distance: ${distance.toFixed(2)}) [Connection #${connections.length}]`)
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
  connectedCircuits.forEach(circuitId => {
    const size = junctionBoxes.filter(box => box.circuit === circuitId).length
    circuitSizes.push({ circuitId, size })
  })

  // Add unconnected boxes (each as size 1)
  junctionBoxes.forEach(box => {
    if (box.circuit === null) {
      circuitSizes.push({ circuitId: `unconnected-${box.index}`, size: 1 })
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

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
