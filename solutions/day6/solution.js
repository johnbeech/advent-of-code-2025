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

function leftPadString (str, length, padChar = ' ') {
  while (str.length < length) {
    str = padChar + str
  }
  return str
}

function rightPadString (str, length, padChar = ' ') {
  while (str.length < length) {
    str = str + padChar
  }
  return str
}

function parseWorksheetCorrectly (input) {
  // In part two we discover that the numbers are written vertically, top to bottom in each column,
  // e.g.
  // 1   34
  // 42  14
  // +   *
  //
  // means (2 + 14) and (44 * 31)
  //
  // So we need to transpose the data differently,
  // but the operations are still applied on the column as a whole

  const lines = input.split('\n').map(line => line.trim()).filter(line => line)
  const data = lines.slice(0, -1).map(line => line.split(/\s+/).map(Number))
  const operations = lines[lines.length - 1].split(/\s+/)

  // transpose data to get columns as a list of { values, operation }
  const exercises = data[0].map((_, colIndex) => {
    const rows = data.map(row => row[colIndex])
    // Need to recreate the numbers by building a vertical slice of single digits from each line
    // e.g. 1 and 4, becomes 14, then nothing and 2 becomes 2
    // then the next exercise is 3 and 1 becomes 31, then 4 and 4 becomes 44
    const operation = operations[colIndex]

    // Switch pad function based on operator
    // Multiplication columns are right aligned
    // Addition columns are left aligned
    const padFn = operation === '*' ? leftPadString : rightPadString

    const largestVal = Math.max(...rows).toString().length
    const values = []
    do {
      const index = values.length
      const tranposedValue = Number.parseInt(rows.map(item => padFn(item.toString(), largestVal).charAt(index)).join(''), 10)
      values.push(tranposedValue)
    } while (values.length < largestVal)
    return {
      values: values.join(' '),
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

async function solveForSecondStar (input) {
  const worksheet = parseWorksheetCorrectly(input)
  console.log('Parsed worksheet:', worksheet)
  const solution = worksheet.grandTotal

  report('Solution 2:', solution)
}

run()
