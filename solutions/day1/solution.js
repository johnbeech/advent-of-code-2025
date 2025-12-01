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
  for (const instruction of instructions) {
    dialPosition += (instruction.directionVal * instruction.turnCounts)
    dialPosition = dialPosition % 100
    if (dialPosition < 0) {
      dialPosition += 100
    }
    console.log(`The dial is rotated ${instruction.direction} to point at ${dialPosition}.`)
    if (dialPosition === 0) {
      zeroCount += 1
    }
  }

  const solution = zeroCount

  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
