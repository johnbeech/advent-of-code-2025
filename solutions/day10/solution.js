const path = require('path')
const { read, position } = require('promise-path')
const { writeFile } = require('fs/promises')
const { solveIntegerProgram } = require('./lpsolver')
const fromHere = position(__dirname)
const logPrefix = `[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`
const report = (...messages) => console.log(logPrefix, ...messages)

async function timeSolution (label, fn) {
  const start = process.hrtime.bigint()
  const result = await fn()
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6
  report(`${label} completed in ${elapsedMs.toFixed(3)}ms`)
  return result
}

const OFF = { state: 'OFF', char: '.' }
const ON = { state: 'ON', char: '#' }

const LIGHT_STATES = {
  OFF,
  ON
}

function renderLightDiagram (lightDiagram) {
  if (!lightDiagram || lightDiagram.length === 0) {
    return '[]'
  }
  const characters = lightDiagram.map(light => (light.targetState === LIGHT_STATES.ON ? '🟨' : '⬛'))
  return `[ ${characters.join(' ')} ]`
}

function parseMachineInstructions (input) {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  function parseLine (line) {
    const lightDiagram = []
    const wiringSchematics = []
    const joltageRequirements = []
    const tokenParser = {
      '[': parseLightDiagram,
      '(': parseWiringSchematic,
      '{': parseJoltageRequirements
    }

    function parseLightDiagram (token) {
      token.slice(1, -1).split('').forEach(value => {
        lightDiagram.push({
          char: value,
          targetState: value === '#' ? LIGHT_STATES.ON : LIGHT_STATES.OFF,
          currentState: LIGHT_STATES.OFF
        })
      })
    }

    function parseWiringSchematic (token) {
      const indexes = token.slice(1, -1).split(',')
        .filter(value => value.length > 0)
        .map(Number)
      const wiredButtons = indexes.map(index => ({
        lightIndex: index
      }))
      wiringSchematics.push({
        wiredButtons,
        label: token
      })
    }

    function parseJoltageRequirements (token) {
      const values = token.slice(1, -1).split(',').filter(value => value.length > 0).map(Number)
      joltageRequirements.push(...values)
    }

    const tokens = line.split(' ')
    tokens.forEach(token => {
      const firstChar = token.charAt(0)
      if (tokenParser[firstChar]) {
        tokenParser[firstChar](token)
      }
    })

    // Link wired buttons to their corresponding lights
    wiringSchematics.forEach(schematic => {
      schematic.wiredButtons.forEach(button => {
        if (button.lightIndex < 0 || button.lightIndex >= lightDiagram.length) {
          throw new Error(`Invalid light index ${button.lightIndex} in wiring schematic`)
        }
        button.light = lightDiagram[button.lightIndex]
      })
    })

    // Each line represents a machine configuration
    return {
      lightDiagram,
      wiringSchematics,
      joltageRequirements
    }
  }

  return lines.map(parseLine)
}

async function run () {
  const test = (await read(fromHere('test.txt'), 'utf8')).trim()
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await timeSolution('Part 1 (test)', () => solveForFirstStar(test, 'output-p1-test.txt'))
  await timeSolution('Part 1', () => solveForFirstStar(input, 'output-p1-input.txt'))
  await timeSolution('Part 2 (test)', () => solveForSecondStar(test, 'output-p2-test.txt'))
  await timeSolution('Part 2', () => solveForSecondStar(input, 'output-p2-input.txt'))
}

function solveMachineInFewestButtonPresses (lightDiagram, wiringSchematics, joltageRequirements) {
  // Represent the current light state as a bitmask (BigInt to support > 32 lights)
  const targetMask = lightDiagram.reduce((mask, light, index) => {
    if (light.targetState === LIGHT_STATES.ON) {
      return mask | (1n << BigInt(index))
    }
    return mask
  }, 0n)

  // If no lights need to be on, zero presses are required
  if (targetMask === 0n) {
    return {
      bestSolution: 0,
      combinations: [[]],
      lightDiagram,
      wiringSchematics,
      joltageRequirements
    }
  }

  const buttons = wiringSchematics
    .map(schematic => {
      const mask = schematic.wiredButtons.reduce((mask, button) => {
        return mask ^ (1n << BigInt(button.lightIndex))
      }, 0n)
      return {
        mask,
        label: schematic.label || `(${schematic.wiredButtons.map(button => button.lightIndex).join(',')})`
      }
    })
    // Buttons that toggle nothing are pointless, skip them
    .filter(button => button.mask !== 0n)

  if (buttons.length === 0) {
    return {
      bestSolution: null,
      combinations: [],
      lightDiagram,
      wiringSchematics,
      joltageRequirements
    }
  }

  // BFS over every light configuration (there are 2^n of them).
  // Because every button press has the same cost, this guarantees the fewest presses.
  const visited = new Map()
  const queue = []
  visited.set('0', { presses: 0, previousKey: null, buttonLabel: null })
  queue.push(0n)

  while (queue.length > 0) {
    const state = queue.shift()
    const stateKey = state.toString()
    const { presses } = visited.get(stateKey)

    for (const button of buttons) {
      const nextState = state ^ button.mask
      const key = nextState.toString()
      if (visited.has(key)) {
        continue
      }

      visited.set(key, { presses: presses + 1, previousKey: stateKey, buttonLabel: button.label })
      if (nextState === targetMask) {
        // Reconstruct the button sequence for output later
        const combinations = []
        let cursorKey = key
        while (cursorKey !== '0') {
          const node = visited.get(cursorKey)
          if (node.buttonLabel === null) {
            break
          }
          combinations.push(node.buttonLabel)
          cursorKey = node.previousKey
        }
        combinations.reverse()
        return {
          bestSolution: presses + 1,
          combinations,
          lightDiagram,
          wiringSchematics,
          joltageRequirements
        }
      }

      queue.push(nextState)
    }
  }

  return {
    bestSolution: null,
    combinations: [],
    lightDiagram,
    wiringSchematics,
    joltageRequirements
  }
}

async function solveForFirstStar (input, outputFilename) {
  const machines = parseMachineInstructions(input)
  const outputLines = []

  const sumOfFewestButtonPresses = machines.reduce((sum, machine) => {
    const result = solveMachineInFewestButtonPresses(
      machine.lightDiagram,
      machine.wiringSchematics,
      machine.joltageRequirements
    )
    report('Machine result:', result)
    outputLines.push(renderLightDiagram(machine.lightDiagram))
    if (result.bestSolution == null) {
      outputLines.push('No solution found.')
    } else if (result.combinations.length === 0) {
      outputLines.push('Best solution: (no presses required)')
    } else {
      outputLines.push(`Best solution: (${result.combinations.join(' ')})`)
    }
    outputLines.push('')
    return sum + (result.bestSolution ?? 0)
  }, 0)

  outputLines.push(`Total presses: ${sumOfFewestButtonPresses}`)
  if (outputFilename) {
    const outputPath = fromHere(outputFilename)
    const content = outputLines.join('\n').trimEnd() + '\n'
    await writeFile(outputPath, content, 'utf8')
    report(`Wrote output to ${outputPath}`)
  }

  const solution = sumOfFewestButtonPresses
  report('Solution 1:', solution)
}

function solveMachineForJoltage (machine) {
  const targets = machine.joltageRequirements
  if (!targets || targets.length === 0) {
    return { bestSolution: 0, pressesPerButton: [], combination: [] }
  }

  const buttons = machine.wiringSchematics
    .map(schematic => {
      const effect = Array(targets.length).fill(0)
      schematic.wiredButtons.forEach(button => {
        const idx = button.lightIndex
        if (idx < 0 || idx >= targets.length) {
          throw new Error(`Invalid joltage index ${idx} for machine`)
        }
        effect[idx] = 1
      })
      return {
        label: schematic.label || `(${schematic.wiredButtons.map(button => button.lightIndex).join(',')})`,
        effect,
        coverage: schematic.wiredButtons.length
      }
    })
    .filter(button => button.coverage > 0)

  if (buttons.length === 0) {
    return { bestSolution: null, pressesPerButton: null, combination: [], reason: 'No buttons available' }
  }

  const coverage = Array(targets.length).fill(0)
  buttons.forEach(button => {
    button.effect.forEach((value, idx) => {
      if (value > 0) {
        coverage[idx]++
      }
    })
  })

  for (let i = 0; i < targets.length; i++) {
    if (targets[i] > 0 && coverage[i] === 0) {
      return {
        bestSolution: null,
        pressesPerButton: null,
        combination: [],
        reason: `Counter ${i} cannot be increased`
      }
    }
  }

  const numButtons = buttons.length
  const constraints = []

  targets.forEach((targetValue, counterIdx) => {
    const coeffs = buttons.map(button => button.effect[counterIdx] || 0)
    constraints.push({
      relation: '=',
      rhs: targetValue,
      coeffs
    })
  })

  for (let i = 0; i < numButtons; i++) {
    const coeffs = Array(numButtons).fill(0)
    coeffs[i] = 1
    constraints.push({
      relation: '>=',
      rhs: 0,
      coeffs
    })
  }

  const model = {
    numVars: numButtons,
    objective: {
      sense: 'min',
      coeffs: Array(numButtons).fill(1)
    },
    constraints
  }

  const solution = solveIntegerProgram(model)
  if (!solution.feasible) {
    return {
      bestSolution: null,
      pressesPerButton: null,
      combination: [],
      reason: 'No valid combination found'
    }
  }

  const pressesPerButton = solution.solution.map(value => Math.round(value))
  const combination = []
  pressesPerButton.forEach((count, idx) => {
    for (let i = 0; i < count; i++) {
      combination.push(buttons[idx].label)
    }
  })
  const totalPresses = pressesPerButton.reduce((sum, value) => sum + value, 0)

  return {
    bestSolution: totalPresses,
    pressesPerButton,
    combination
  }
}

async function solveForSecondStar (input, outputFilename) {
  const machines = parseMachineInstructions(input)
  let builder = ''
  const total = machines.reduce((sum, machine, index) => {
    const result = solveMachineForJoltage(machine)
    const sampleSize = 5
    const sampleCombination = result.combination.slice(0, sampleSize)
    const hiddenCount = Math.max(0, result.combination.length - sampleCombination.length)
    const sampleDescription = hiddenCount > 0
      ? [...sampleCombination, '...', `(${hiddenCount} hidden)`]
      : sampleCombination
    if (result.bestSolution == null) {
      throw new Error(`Unable to configure machine joltage for diagram ${renderLightDiagram(machine.lightDiagram)}`)
    }
    const pressesPerButtonStr = result.pressesPerButton ? result.pressesPerButton.join(', ') : ''
    const summaryLines = [
      `Machine ${index}:`,
      `  Diagram: ${renderLightDiagram(machine.lightDiagram)}`,
      `  Best presses: ${result.bestSolution}`,
      `  Presses per button: [${pressesPerButtonStr}]`,
      `  Sample combo: [${sampleDescription.join(', ')}]`
    ]
    const block = summaryLines.join('\n')
    console.log(block)
    console.log()
    builder += block + '\n\n'
    return sum + result.bestSolution
  }, 0)

  const totalLine = `Solution 2: ${total}`
  report(totalLine)
  builder += `${totalLine}\n`

  if (outputFilename) {
    const outputPath = fromHere(outputFilename)
    await writeFile(outputPath, builder, 'utf8')
    report(`Wrote output to ${outputPath}`)
  }

  report('Solution 2:', total)
}

run()
