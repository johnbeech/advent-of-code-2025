const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function run () {
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

function parseInstructions (input) {
  return input.split('\n').map(line => line.trim()).filter(line => line.length > 0).map(line => {
    const direction = line.charAt(0)
    return {
      direction,
      directionVal: direction === 'L' ? -1 : 1,
      turnCounts: parseInt(line.slice(1))
    }
  })
}

async function solveForFirstStar (input) {
  const instructions = parseInstructions(input)
  let zeroCount = 0
  let dialPosition = 50
  console.log(`The dial starts by pointing at ${dialPosition}.`)
  for (const instruction of instructions) {
    dialPosition += (instruction.directionVal * instruction.turnCounts)
    dialPosition = dialPosition % 100
    if (dialPosition < 0) {
      dialPosition += 100
    }
    console.log(`The dial is rotated ${instruction.direction}${instruction.turnCounts} to point at ${dialPosition}.`)
    if (dialPosition === 0) {
      zeroCount += 1
    }
  }

  const solution = zeroCount

  report('Solution 1:', solution)
}

function lookupCountAsText (count) {
  return {
    1: 'once',
    2: 'twice',
    3: 'thrice'
  }[count] || `${count} times`
}

async function solveForSecondStar (input) {
  const instructions = parseInstructions(input)
  let zeroCount = 0
  let dialPosition = 50
  console.log(`The dial starts by pointing at ${dialPosition}.`)

  for (const instruction of instructions) {
    const { directionVal, turnCounts } = instruction
    const instructionStart = dialPosition

    let firstZero
    if (directionVal === 1) {
      firstZero = (100 - instructionStart) % 100
      if (firstZero === 0) {
        firstZero = 100
      }
    } else {
      firstZero = instructionStart % 100
      if (firstZero === 0) {
        firstZero = 100
      }
    }

    let dialTurnsPastZero = 0
    if (firstZero > 0 && firstZero <= turnCounts) {
      dialTurnsPastZero = 1 + Math.floor((turnCounts - firstZero) / 100)
    }

    zeroCount += dialTurnsPastZero
    dialPosition = (instructionStart + directionVal * turnCounts) % 100
    if (dialPosition < 0) {
      dialPosition += 100
    }

    let additionalInfo = '.'
    if (dialTurnsPastZero > 0 && firstZero < turnCounts) {
      additionalInfo = `; during this rotation, it points at 0 ${lookupCountAsText(dialTurnsPastZero)}.`
    }

    console.log(`The dial is rotated ${instruction.direction}${instruction.turnCounts} to point at ${dialPosition}${additionalInfo}`)
  }

  const solution = zeroCount
  report('Solution 2:', solution)
}

run()
