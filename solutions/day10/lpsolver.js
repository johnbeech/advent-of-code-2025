const EPSILON = 1e-9

function deepCopyConstraints (constraints) {
  return constraints.map(constraint => ({
    relation: constraint.relation,
    rhs: constraint.rhs,
    coeffs: constraint.coeffs.slice()
  }))
}

function normalizeModel (model) {
  return {
    numVars: model.numVars,
    objective: {
      sense: model.objective.sense || 'min',
      coeffs: model.objective.coeffs.slice()
    },
    constraints: deepCopyConstraints(model.constraints)
  }
}

function cloneModelWithConstraint (model, varIndex, relation, rhs) {
  const cloned = normalizeModel(model)
  const coeffs = Array(cloned.numVars).fill(0)
  coeffs[varIndex] = 1
  cloned.constraints.push({ relation, rhs, coeffs })
  return cloned
}

function buildInitialTableau (model) {
  const numOriginalVars = model.numVars
  const constraints = model.constraints
  const numConstraints = constraints.length

  let slackCount = 0
  let artificialCount = 0
  constraints.forEach(constraint => {
    if (constraint.relation === '<=') {
      slackCount++
    } else if (constraint.relation === '>=') {
      slackCount++
      artificialCount++
    } else if (constraint.relation === '=') {
      artificialCount++
    }
  })

  const totalVars = numOriginalVars + slackCount + artificialCount
  const rhsColumn = totalVars
  const tableau = Array.from({ length: numConstraints + 1 }, () => Array(totalVars + 1).fill(0))
  const basis = new Array(numConstraints).fill(-1)

  let slackOffset = numOriginalVars
  let artificialOffset = numOriginalVars + slackCount
  const slackIndex = new Array(numConstraints).fill(null)
  const artificialIndex = new Array(numConstraints).fill(null)

  constraints.forEach((constraint, rowIndex) => {
    const row = tableau[rowIndex]
    constraint.coeffs.forEach((value, colIndex) => {
      row[colIndex] = value
    })
    if (constraint.relation === '<=') {
      const idx = slackOffset++
      slackIndex[rowIndex] = idx
      row[idx] = 1
      basis[rowIndex] = idx
    } else if (constraint.relation === '>=') {
      const slackIdx = slackOffset++
      const artIdx = artificialOffset++
      slackIndex[rowIndex] = slackIdx
      artificialIndex[rowIndex] = artIdx
      row[slackIdx] = -1
      row[artIdx] = 1
      basis[rowIndex] = artIdx
    } else if (constraint.relation === '=') {
      const artIdx = artificialOffset++
      artificialIndex[rowIndex] = artIdx
      row[artIdx] = 1
      basis[rowIndex] = artIdx
    }
    row[rhsColumn] = constraint.rhs
  })

  return {
    tableau,
    basis,
    totalVars,
    rhsColumn,
    numOriginalVars,
    artificialStart: numOriginalVars + slackCount,
    artificialCount,
    phaseOneNeeded: artificialCount > 0
  }
}

function pivot (tableau, basis, pivotRow, pivotCol) {
  const width = tableau[0].length
  const pivotValue = tableau[pivotRow][pivotCol]
  for (let col = 0; col < width; col++) {
    tableau[pivotRow][col] /= pivotValue
  }
  for (let row = 0; row < tableau.length; row++) {
    if (row === pivotRow) continue
    const factor = tableau[row][pivotCol]
    if (Math.abs(factor) < EPSILON) continue
    for (let col = 0; col < width; col++) {
      tableau[row][col] -= factor * tableau[pivotRow][col]
    }
  }
  basis[pivotRow] = pivotCol
}

function simplex (tableau, basis, columnCount) {
  const rows = tableau.length
  const rhsColumn = tableau[0].length - 1
  while (true) {
    let entering = -1
    let mostNegative = -EPSILON
    for (let col = 0; col < columnCount; col++) {
      const value = tableau[rows - 1][col]
      if (value < mostNegative) {
        mostNegative = value
        entering = col
      }
    }
    if (entering === -1) {
      return { status: 'optimal' }
    }
    let leaving = -1
    let bestRatio = Infinity
    for (let row = 0; row < rows - 1; row++) {
      const coefficient = tableau[row][entering]
      if (coefficient > EPSILON) {
        const ratio = tableau[row][rhsColumn] / coefficient
        if (ratio < bestRatio - EPSILON) {
          bestRatio = ratio
          leaving = row
        }
      }
    }
    if (leaving === -1) {
      return { status: 'unbounded' }
    }
    pivot(tableau, basis, leaving, entering)
  }
}

function setObjectiveRow (tableau, basis, coeffs, columnCount) {
  const rows = tableau.length
  const rhsColumn = tableau[0].length - 1
  const lastRow = rows - 1
  for (let col = 0; col < columnCount; col++) {
    tableau[lastRow][col] = -(coeffs[col] || 0)
  }
  tableau[lastRow][rhsColumn] = 0
  for (let row = 0; row < rows - 1; row++) {
    const basicVar = basis[row]
    if (basicVar == null || basicVar < 0) continue
    const coefficient = coeffs[basicVar] || 0
    if (Math.abs(coefficient) < EPSILON) continue
    for (let col = 0; col <= rhsColumn; col++) {
      tableau[lastRow][col] += coefficient * tableau[row][col]
    }
  }
}

function eliminateArtificialVariables (tableau, basis, artificialStart, columnCount) {
  for (let row = 0; row < basis.length; row++) {
    const variableIndex = basis[row]
    if (variableIndex >= artificialStart) {
      let entering = -1
      for (let col = 0; col < artificialStart; col++) {
        if (Math.abs(tableau[row][col]) > EPSILON) {
          entering = col
          break
        }
      }
      if (entering !== -1) {
        pivot(tableau, basis, row, entering)
      } else {
        basis[row] = -1
      }
    }
  }
}

function removeArtificialColumns (tableau, columnCount, artificialStart) {
  if (columnCount === artificialStart) {
    return tableau
  }
  const rhsColumn = columnCount
  const keepColumns = []
  for (let col = 0; col < artificialStart; col++) {
    keepColumns.push(col)
  }
  keepColumns.push(rhsColumn)
  return tableau.map(row => keepColumns.map(col => row[col]))
}

function extractSolution (tableau, basis, numVars) {
  const solution = Array(numVars).fill(0)
  const rhsColumn = tableau[0].length - 1
  for (let row = 0; row < basis.length; row++) {
    const varIndex = basis[row]
    if (varIndex != null && varIndex >= 0 && varIndex < numVars) {
      solution[varIndex] = tableau[row][rhsColumn]
    }
  }
  return solution
}

function solveLinearProgram (model) {
  const normalized = normalizeModel(model)
  const prepared = buildInitialTableau(normalized)
  let { tableau, basis, totalVars, rhsColumn, numOriginalVars, artificialStart, phaseOneNeeded } = prepared

  const rows = tableau.length

  if (phaseOneNeeded) {
    const phaseOneCoeffs = Array(totalVars).fill(0)
    for (let col = artificialStart; col < totalVars; col++) {
      phaseOneCoeffs[col] = -1
    }
    setObjectiveRow(tableau, basis, phaseOneCoeffs, totalVars)
    const phaseOneResult = simplex(tableau, basis, totalVars)
    if (phaseOneResult.status !== 'optimal') {
      return { feasible: false }
    }
    const phaseOneValue = tableau[rows - 1][rhsColumn]
    if (Math.abs(phaseOneValue) > EPSILON) {
      return { feasible: false }
    }
    eliminateArtificialVariables(tableau, basis, artificialStart, totalVars)
    tableau = removeArtificialColumns(tableau, totalVars, artificialStart)
    totalVars = artificialStart
    rhsColumn = totalVars
  } else {
    for (let col = 0; col <= rhsColumn; col++) {
      tableau[rows - 1][col] = 0
    }
  }

  const maximizingCoeffs = Array(totalVars).fill(0)
  const originalObjective = normalized.objective.coeffs
  for (let col = 0; col < numOriginalVars; col++) {
    maximizingCoeffs[col] = -(originalObjective[col] || 0)
  }
  setObjectiveRow(tableau, basis, maximizingCoeffs, totalVars)
  const phaseTwoResult = simplex(tableau, basis, totalVars)
  if (phaseTwoResult.status !== 'optimal') {
    return { feasible: false }
  }

  const solution = extractSolution(tableau, basis, numOriginalVars)
  const maximizedValue = tableau[rows - 1][rhsColumn]
  const minimizedValue = -maximizedValue
  return {
    feasible: true,
    solution,
    objective: minimizedValue
  }
}

function findFractionalIndex (values) {
  let index = -1
  let maxFraction = 0
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    const fractional = Math.abs(value - Math.round(value))
    if (fractional > EPSILON && fractional > maxFraction) {
      maxFraction = fractional
      index = i
    }
  }
  return index
}

function solveIntegerProgram (model) {
  const normalized = normalizeModel(model)
  let bestSolution = null

  function branch (currentModel) {
    const lpResult = solveLinearProgram(currentModel)
    if (!lpResult.feasible) {
      return
    }
    if (bestSolution && lpResult.objective >= bestSolution.objective - EPSILON) {
      return
    }
    const fractionalIndex = findFractionalIndex(lpResult.solution)
    if (fractionalIndex === -1) {
      if (!bestSolution || lpResult.objective < bestSolution.objective - EPSILON) {
        bestSolution = lpResult
      }
      return
    }

    const value = lpResult.solution[fractionalIndex]
    const floorValue = Math.floor(value)
    const ceilValue = Math.ceil(value)

    if (floorValue >= 0) {
      const leftModel = cloneModelWithConstraint(currentModel, fractionalIndex, '<=', floorValue)
      branch(leftModel)
    }
    const rightModel = cloneModelWithConstraint(currentModel, fractionalIndex, '>=', ceilValue)
    branch(rightModel)
  }

  branch(normalized)
  if (!bestSolution) {
    return { feasible: false }
  }
  return {
    feasible: true,
    solution: bestSolution.solution,
    objective: bestSolution.objective
  }
}

module.exports = {
  solveIntegerProgram
}
