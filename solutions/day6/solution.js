const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function run () {
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

function addOp (a, b) { return a + b }
function mulOp (a, b) { return a * b }
const opMap = {
  '+': addOp,
  '*': mulOp
}

function parseWorksheet (input) {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line)
  // lines contains columns of numeric data, the bottom line is the operation
  const data = lines.slice(0, -1).map(line => line.split(/\s+/).map(Number))
  const operations = lines[lines.length - 1].split(/\s+/)

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

  report('Solution 1:', solution)
}

function parseWorksheetCorrectly (input) {
  const lines = input.split('\n').filter(line => line)
  const operationLine = lines[lines.length - 1]
  const dataLines = lines.slice(0, -1)
  let scanIndex = 0
  let operation = ''
  const values = []
  const exerciseResults = []

  function calculateResults () {
    // calculate total for previous exercise
    const opFn = opMap[operation]
    const total = values.filter(n => n !== 0).reduce(opFn, operation === '+' ? 0 : 1)
    console.log('Total for operation', operation, 'with values', values, 'is', total)
    exerciseResults.push({
      operation,
      values: values.join(', '),
      total
    })
    values.length = 0
  }

  do {
    const newOp = String(operationLine[scanIndex] ?? '').trim()
    if (newOp) {
      if (values.length > 0) {
        calculateResults()
      }
      operation = newOp
      console.log('New operation detected:', operation)
    }

    const value = Number(dataLines.map(line => line[scanIndex]).join('').trim())
    console.log('Parsed value at column', scanIndex, ':', value)
    if (!isNaN(value)) {
      values.push(value)
    }
    scanIndex++
  } while (scanIndex < lines[0].length)
  // calculate total for last exercise
  calculateResults()

  return {
    exercises: exerciseResults,
    grandTotal: exerciseResults.reduce((sum, ex) => sum + ex.total, 0)
  }
}

async function solveForSecondStar (input) {
  const worksheet = parseWorksheetCorrectly(input)
  console.log('Parsed worksheet:', worksheet)
  const solution = worksheet.grandTotal

  report('Solution 2:', solution)
}

run()
