const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function run () {
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

function parseWorksheet (input) {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line)
  // lines contains columns of numeric data, the bottom line is the operation
  const data = lines.slice(0, -1).map(line => line.split(/\s+/).map(Number))
  const operations = lines[lines.length - 1].split(/\s+/)

  function addOp (a, b) { return a + b }
  function mulOp (a, b) { return a * b }
  const opMap = {
    '+': addOp,
    '*': mulOp
  }

  // transpose data to get columns as a list of { values, operation }
  const exercises = data[0].map((_, colIndex) => {
    const values = data.map(row => row[colIndex])
    const operation = operations[colIndex]
    return {
      values,
      operation,
      opFn: opMap[operation],
      total: values.reduce(opMap[operation], operation === '+' ? 0 : 1)
    }
  })

  return {
    exercises,
    grandTotal: exercises.reduce((sum, ex) => sum + ex.total, 0)
  }
}

async function solveForFirstStar (input) {
  const worksheet = parseWorksheet(input)

  console.log('Parsed worksheet:', worksheet)

  const solution = worksheet.grandTotal

  report('Input:', input)
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
