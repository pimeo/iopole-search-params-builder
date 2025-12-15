/**
 * Represents the allowed operators based on your specifications.
 */
export const Ops = {
  EQUALS: ':',
  STRICT_EQUALS: ':=', // For integer or boolean
  GT: ':>',
  GTE: ':>=',
  LT: ':<',
  LTE: ':<=',
  BETWEEN: ':[',
  STRICT_BETWEEN: ':{',

  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  OR_NOT: 'OR NOT',
  AND_NOT: 'AND NOT',
}

export class QueryNode {
  toString () { throw new Error('Method not implemented') }
}

export class Condition extends QueryNode {
  constructor (field, operator, value) {
    super()
    this.field = field
    this.operator = operator
    this.value = value
  }

  /**
 * Helper to format values.
 * Adds quotes to strings if they aren't already quoted.
 */
  formatValue (value) {
    if (typeof value === 'string') {
      // If it's a wildcard or already quoted, return as is
      if (value.startsWith('"')) return value
      // Otherwise, wrap in quotes for safety
      return `"${value}"`
    }

    return value // Numbers/Booleans return as is
  }

  toString () {
    return `${this.field}${this.operator}${this.formatValue(this.value)}`
  }
}

export class BetweenCondition extends QueryNode {
  constructor (field, operator, fromValue, toValue) {
    super()
    this.field = field
    this.operator = operator
    this.fromValue = fromValue
    this.toValue = toValue
  }

  /**
 * Helper to format values.
 * Adds quotes to strings if they aren't already quoted.
 */
  formatValue (value) {
    if (typeof value === 'string') {
      // If it's a wildcard or already quoted, return as is
      if (value.startsWith('"')) return value
      // Otherwise, wrap in quotes for safety
      return `"${value}"`
    }

    return value // Numbers/Booleans return as is
  }

  toString () {
    const endOperator = this.operator === Ops.STRICT_BETWEEN ? '}' : ']'
    return `${this.field}${this.operator}${this.formatValue(this.fromValue)} TO ${this.formatValue(this.toValue)}${endOperator}`
  }
}

export class Group extends QueryNode {
  constructor (logicOperator) {
    super()
    this.logicOperator = logicOperator // 'AND' or 'OR'
    this.nodes = []
  }

  add (node) {
    this.nodes.push(node)
  }

  toString () {
    if (this.nodes.length === 0) return ''

    // Join all children with the logical operator
    const parts = this.nodes.map(n => n.toString())
    const joined = parts.join(` ${this.logicOperator} `)

    // If this group contains multiple items, wrap in parens
    // (Optimization: Root group often doesn't need parens, but explicit is safer)
    return this.nodes.length > 1 ? `(${joined})` : joined
  }
}

/**
 * The Main Builder Class
 */
export class Builder {
  constructor () {
    // The root is implicitly an AND group usually, but we treat the top level carefully.
    this.root = new Group(Ops.AND)
  }

  /**
   * Adds a generic condition
   */
  where (field, operator, value) {
    this.root.add(new Condition(field, operator, value))
    return this
  }

  /**
   * Helper for exact match (using : or using := for integer/boolean)
   */
  matches (field, value) {
    if (typeof value === 'number' || typeof value === 'boolean') {
      return this.is(field, value)
    }

    return this.where(field, Ops.EQUALS, value)
  }

  /**
   * Helper for strict match (using :=) for int/bool
   */
  is (field, value) {
    return this.where(field, Ops.STRICT_EQUALS, value)
  }

  /**
   * Helper for between included range expression (using :[])
   */
  between (field, fromValue, toValue) {
    this.root.add(new BetweenCondition(field, Ops.BETWEEN, fromValue, toValue))
    return this
  }

  /**
   * Helper for between excluded range expression (using :{})
   */
  strictBetween (field, fromValue, toValue) {
    this.root.add(new BetweenCondition(field, Ops.STRICT_BETWEEN, fromValue, toValue))
    return this
  }

  /**
   * Adds a nested group (AND/OR)
   * @param {'AND'|'OR'} logic - The logic for the group
   * @param {Function} callback - A function receiving a new builder to populate the group
   */
  group (logic, callback) {
    const subBuilder = new Builder()
    // Re-assign the root of the sub-builder to be a specific group type
    subBuilder.root = new Group(logic)

    callback(subBuilder)

    // Add the fully formed group node to our current list
    this.root.add(subBuilder.root)
    return this
  }

  /**
   * Shortcut for AND group
   * @param {Function} callback - A function receiving a new builder to populate the group
   */
  and (callback) {
    return this.group(Ops.AND, callback)
  }

  /**
   * Shortcut for AND NOT group
   * @param {Function} callback - A function receiving a new builder to populate the group
   */
  andNot (callback) {
    return this.group(Ops.AND_NOT, callback)
  }

  /**
   * Shortcut for OR group
   * @param {Function} callback - A function receiving a new builder to populate the group
   */
  or (callback) {
    return this.group(Ops.OR, callback)
  }

  /**
   * Shortcut for OR NOT group
   * @param {Function} callback - A function receiving a new builder to populate the group
   */
  orNot (callback) {
    return this.group(Ops.OR_NOT, callback)
  }

  /**
   * Generates the final query string.
   * Removes outer parentheses if they exist for cleaner output.
   */
  build () {
    let str = this.root.toString()
    // Optional cosmetic cleanup: remove surrounding parens if they wrap the whole query
    if (str.startsWith('(') && str.endsWith(')')) {
      str = str.slice(1, -1)
    }
    return str
  }
}
