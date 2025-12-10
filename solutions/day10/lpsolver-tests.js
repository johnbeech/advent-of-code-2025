const assert = require('node:assert/strict')
const { solveIntegerProgram } = require('./lpsolver')

const suites = []
let totalTests = 0
let passedTests = 0
let failedTests = 0
let totalDurationNs = 0n

function describe (title, fn) {
  suites.push({ title, tests: [] })
  const suite = suites[suites.length - 1]
  fn((testTitle, testFn) => {
    suite.tests.push({ title: testTitle, fn: testFn })
  })
}

function it () {
  throw new Error('it() should only be used inside describe callback')
}

function run (test) {
  console.log(`Suite: ${test.title}`)
  test.tests.forEach(({ title, fn }) => {
    totalTests++
    const start = process.hrtime.bigint()
    try {
      fn()
      const elapsed = process.hrtime.bigint() - start
      totalDurationNs += elapsed
      const durationMs = Number(elapsed) / 1e6
      passedTests++
      console.log(`  ✓ it should ${title} (${durationMs.toFixed(3)}ms)`)
    } catch (err) {
      const elapsed = process.hrtime.bigint() - start
      totalDurationNs += elapsed
      const durationMs = Number(elapsed) / 1e6
      failedTests++
      console.error(`  ✗ it should ${title} (${durationMs.toFixed(3)}ms)`)
      throw err
    }
  })
}

// suites
describe('lpsolver core behaviour', (it) => {
  it('solve a single-variable equality with non-negativity', () => {
    const result = solveIntegerProgram({
      numVars: 1,
      objective: { sense: 'min', coeffs: [1] },
      constraints: [
        { relation: '=', rhs: 3, coeffs: [1] },
        { relation: '>=', rhs: 0, coeffs: [1] }
      ]
    })
    assert.ok(result.feasible)
    assert.ok(Math.abs(result.objective - 3) < 1e-6)
    assert.ok(Math.abs(result.solution[0] - 3) < 1e-6)
  })

  it('find a feasible symmetric solution where either variable can satisfy the equality', () => {
    const result = solveIntegerProgram({
      numVars: 2,
      objective: { sense: 'min', coeffs: [1, 1] },
      constraints: [
        { relation: '=', rhs: 3, coeffs: [1, 1] },
        { relation: '>=', rhs: 0, coeffs: [1, 0] },
        { relation: '>=', rhs: 0, coeffs: [0, 1] }
      ]
    })
    assert.ok(result.feasible)
    const sum = result.solution[0] + result.solution[1]
    assert.ok(Math.abs(sum - 3) < 1e-6)
  })

  it('respect inequality bounds when minimizing cost', () => {
    const result = solveIntegerProgram({
      numVars: 2,
      objective: { sense: 'min', coeffs: [2, 1] },
      constraints: [
        { relation: '>=', rhs: 2, coeffs: [1, 1] },
        { relation: '>=', rhs: 0, coeffs: [1, 0] },
        { relation: '>=', rhs: 0, coeffs: [0, 1] }
      ]
    })
    assert.ok(result.feasible)
    assert.ok(Math.abs(result.solution[0]) < 1e-6)
    assert.ok(Math.abs(result.solution[1] - 2) < 1e-6)
    assert.ok(Math.abs(result.objective - 2) < 1e-6)
  })

  it('branch to keep solutions integral when the LP optimum would be fractional', () => {
    const result = solveIntegerProgram({
      numVars: 2,
      objective: { sense: 'min', coeffs: [1, 1] },
      constraints: [
        { relation: '=', rhs: 1, coeffs: [2, 1] },
        { relation: '>=', rhs: 0, coeffs: [1, 0] },
        { relation: '>=', rhs: 0, coeffs: [0, 1] }
      ]
    })
    assert.ok(result.feasible)
    const lhs = 2 * result.solution[0] + result.solution[1]
    assert.ok(Math.abs(lhs - 1) < 1e-6)
    assert.ok(Number.isInteger(result.solution[0]))
    assert.ok(Number.isInteger(result.solution[1]))
  })

  it('report an infeasible model when constraints conflict', () => {
    const result = solveIntegerProgram({
      numVars: 1,
      objective: { sense: 'min', coeffs: [1] },
      constraints: [
        { relation: '=', rhs: 1, coeffs: [1] },
        { relation: '=', rhs: 2, coeffs: [1] }
      ]
    })
    assert.ok(!result.feasible)
  })
})

function runTests () {
  suites.forEach(run)
  const totalMs = Number(totalDurationNs) / 1e6
  console.log('')
  console.log('Summary:')
  console.log(`  Total tests: ${totalTests}`)
  console.log(`  Passed: ${passedTests}`)
  console.log(`  Failed: ${failedTests}`)
  console.log(`  Total time: ${totalMs.toFixed(3)}ms`)
}

if (require.main === module) {
  runTests()
}

module.exports = {
  runTests,
  describe,
  it
}
